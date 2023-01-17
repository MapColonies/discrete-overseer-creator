import { Logger } from '@map-colonies/js-logger';
import isValidGeoJson from '@turf/boolean-valid';
import { v4 as uuidv4 } from 'uuid';
import { GeoJSON } from 'geojson';
import { FeatureCollection, Geometry, geojsonType, bbox } from '@turf/turf';
import { IngestionParams, LayerMetadata, ProductType, Transparency, TileOutputFormat } from '@map-colonies/mc-model-types';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { getMapServingLayerName } from '../../utils/layerNameGenerator';
import { SERVICES } from '../../common/constants';
import { IConfig, IRecordIds } from '../../common/interfaces';
import { JobAction, OperationStatus, TaskAction } from '../../common/enums';
import { layerMetadataToPolygonParts } from '../../common/utils/polygonPartsBuilder';
import { createBBoxString } from '../../utils/bbox';
import { ZoomLevelCalculator } from '../../utils/zoomToResolution';
import { IGetJobResponse, JobManagerClient } from '../../serviceClients/jobManagerClient';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { MapPublisherClient } from '../../serviceClients/mapPublisher';
import { MergeTilesTasker } from '../../merge/mergeTilesTasker';
import { SQLiteClient } from '../../serviceClients/sqliteClient';
import { Grid } from '../interfaces';
import { FileValidator } from './fileValidator';
import { SplitTilesTasker } from './splitTilesTasker';

@injectable()
export class LayersManager {
  private readonly tileSplitTask: string;
  private readonly tileMergeTask: string;
  private grids: Grid[] = [];

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly zoomLevelCalculator: ZoomLevelCalculator,
    private readonly db: JobManagerClient,
    private readonly catalog: CatalogClient,
    private readonly mapPublisher: MapPublisherClient,
    private readonly fileValidator: FileValidator,
    private readonly splitTilesTasker: SplitTilesTasker,
    private readonly mergeTilesTasker: MergeTilesTasker
  ) {
    this.tileSplitTask = this.config.get<string>('ingestionTaskType.tileSplitTask');
    this.tileMergeTask = this.config.get<string>('ingestionTaskType.tileMergeTask');
  }

  public async createLayer(data: IngestionParams, overseerUrl: string): Promise<void> {
    const convertedData: LayerMetadata = data.metadata;
    const productId = data.metadata.productId as string;
    const version = data.metadata.productVersion as string;
    const productType = data.metadata.productType as ProductType;
    const transparency = data.metadata.transparency as Transparency;
    const originDirectory = data.originDirectory;
    const files = data.fileNames;
    const polygon = data.metadata.footprint;

    this.validateGeoJsons(data.metadata);
    // polygon to bbox
    const extent = bbox(polygon as GeoJSON);
    if (convertedData.id !== undefined) {
      throw new BadRequestError(`Received invalid layer id: ${convertedData.id}`);
    }
    if (data.metadata.ingestionDate !== undefined) {
      throw new BadRequestError(`received invalid field ingestionDate`);
    }
    await this.validateFiles(data);
    await this.validateJobNotRunning(productId, productType);

    const jobType = await this.getJobType(data);
    const taskType = this.getTaskType(jobType, files, originDirectory);
    const existsInMapProxy = await this.isExistsInMapProxy(productId, productType);

    this.validateCorrectProductVersion(data);

    this.logger.info(
      'info',
      `Creating job, job type: '${jobType}', tasks type: '${taskType}' for productId: ${
        data.metadata.productId as string
      } productType: ${productType}`
    );

    if (jobType === JobAction.NEW) {
      const recordIds = await this.generateRecordIds();
      const id = recordIds.id;
      const displayPath = recordIds.displayPath;

      data.metadata.displayPath = displayPath;
      data.metadata.id = id;

      await this.validateNotExistsInCatalog(productId, version, productType);
      if (existsInMapProxy) {
        throw new ConflictError(`layer '${productId}-${productType}', is already exists on MapProxy`);
      }

      data.metadata.tileOutputFormat = this.getTileOutputFormat(taskType, transparency);
      this.setDefaultValues(data);

      const layerRelativePath = `${id}/${displayPath}`;

      if (taskType === TaskAction.MERGE_TILES) {
        await this.mergeTilesTasker.createMergeTilesTasks(data, layerRelativePath, taskType, jobType, this.grids, extent, overseerUrl, true);
      } else {
        const layerZoomRanges = this.zoomLevelCalculator.createLayerZoomRanges(data.metadata.maxResolutionDeg as number);
        await this.splitTilesTasker.createSplitTilesTasks(data, layerRelativePath, layerZoomRanges, jobType, taskType);
      }

      this.logger.info(`Successfully created job & tasks for record id: ${id}`);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (jobType === JobAction.UPDATE) {
      const record = await this.catalog.findRecord(productId, undefined, productType);
      const recordId = record?.metadata.id as string;
      const dispalyPath = record?.metadata.displayPath as string;
      const layerRelativePath = `${recordId}/${dispalyPath}`;
      if (!existsInMapProxy) {
        throw new BadRequestError(`layer '${productId}-${productType}', is not exists on MapProxy`);
      }
      //todo - override data from record - on future should not be provided from new route for update
      this.logger.warn(
        `Update job - Transparency and TileOutputFormat will be override from catalog:
         Transparency => from ${data.metadata.transparency as Transparency} to ${record?.metadata.transparency as Transparency},
         TileOutputFormat => from ${data.metadata.tileOutputFormat as TileOutputFormat} to ${record?.metadata.tileOutputFormat as TileOutputFormat}`
      );
      data.metadata.transparency = record?.metadata.transparency;
      data.metadata.tileOutputFormat = record?.metadata.tileOutputFormat;

      await this.mergeTilesTasker.createMergeTilesTasks(data, layerRelativePath, taskType, jobType, this.grids, extent, overseerUrl);

      this.logger.info(`Successfully created job & tasks for record id: ${recordId}`);
    } else {
      throw new BadRequestError('Unsupported job type');
    }
  }

  private async getJobType(data: IngestionParams): Promise<JobAction> {
    const productId = data.metadata.productId as string;
    const version = data.metadata.productVersion as string;
    const productType = data.metadata.productType as ProductType;
    const highestVersion = await this.catalog.getHighestLayerVersion(productId, productType);

    if (highestVersion === undefined) {
      return JobAction.NEW;
    }

    const requestedLayerVersion = parseFloat(version);
    if (requestedLayerVersion > highestVersion) {
      return JobAction.UPDATE;
    }
    if (requestedLayerVersion === highestVersion) {
      throw new ConflictError(
        `layer id: ${productId} version: ${version} product type: ${productType} has already the same version (${highestVersion}) in catalog`
      );
    } else {
      throw new BadRequestError(
        `layer id: ${productId} version: ${version} product type: ${productType} has already higher version (${highestVersion}) in catalog`
      );
    }
  }

  private getTaskType(jobType: JobAction, files: string[], originDirectory: string): string {
    const validGpkgFiles = this.fileValidator.validateGpkgFiles(files, originDirectory);
    if (validGpkgFiles) {
      const grids: Grid[] = [];
      files.forEach((file) => {
        const sqliteClient = new SQLiteClient(this.config, this.logger, file, originDirectory);
        const grid = sqliteClient.getGrid();
        grids.push(grid as Grid);
      });
      this.grids = grids;
    }
    if (jobType === JobAction.NEW) {
      if (validGpkgFiles) {
        return this.tileMergeTask;
      } else {
        return this.tileSplitTask;
      }
    } else if (validGpkgFiles) {
      return this.tileMergeTask;
    } else {
      throw new BadRequestError(`Ingesion "Update" job type does not support Mixed/TIFF/TIF/J2k etc.. (GPKG support only)`);
    }
  }

  private async validateFiles(data: IngestionParams): Promise<void> {
    const originDirectoryExists = this.fileValidator.validateSourceDirectory(data.originDirectory);
    if (!originDirectoryExists) {
      throw new BadRequestError(`"originDirectory" is empty, files should be stored on specific directory`);
    }
    const originDirectoryNotWatch = this.fileValidator.validateNotWatchDir(data.originDirectory);
    if (!originDirectoryNotWatch) {
      throw new BadRequestError(`"originDirectory" can't be with same name as watch directory`);
    }
    const filesExists = await this.fileValidator.validateExists(data.originDirectory, data.fileNames);
    if (!filesExists) {
      throw new BadRequestError('invalid files list, some files are missing');
    }
  }

  private async isExistsInMapProxy(productId: string, productType: ProductType): Promise<boolean> {
    const layerName = getMapServingLayerName(productId, productType);
    const existsInMapServer = await this.mapPublisher.exists(layerName);
    return existsInMapServer;
  }

  private async validateJobNotRunning(resourceId: string, productType: ProductType): Promise<void> {
    const jobs = await this.db.findJobs(resourceId, productType);
    jobs.forEach((job) => {
      if (job.status == OperationStatus.IN_PROGRESS || job.status == OperationStatus.PENDING) {
        throw new ConflictError(`layer id: ${resourceId} product type: ${productType}, job is already running`);
      }
    });
  }

  private async validateNotExistsInCatalog(resourceId: string, version?: string, productType?: string): Promise<void> {
    const existsInCatalog = await this.catalog.exists(resourceId, version, productType);
    if (existsInCatalog) {
      throw new ConflictError(`layer id: ${resourceId} version: ${version as string}, already exists in catalog`);
    }
  }

  private setDefaultValues(data: IngestionParams): void {
    data.metadata.srsId = data.metadata.srsId === undefined ? '4326' : data.metadata.srsId;
    data.metadata.srsName = data.metadata.srsName === undefined ? 'WGS84GEO' : data.metadata.srsName;
    data.metadata.productBoundingBox = createBBoxString(data.metadata.footprint as GeoJSON);
    if (!data.metadata.layerPolygonParts) {
      data.metadata.layerPolygonParts = layerMetadataToPolygonParts(data.metadata);
    }
  }

  /// validate productVersion will have decmal value
  private validateCorrectProductVersion(data: IngestionParams): void {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.metadata.productVersion?.indexOf('.') === -1) {
      data.metadata.productVersion = `${data.metadata.productVersion}.0`;
    }
  }

  private validateGeoJsons(metadata: LayerMetadata): void {
    const footprint = metadata.footprint as Geometry;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if ((footprint.type != 'Polygon' && footprint.type != 'MultiPolygon') || footprint.coordinates == undefined || !isValidGeoJson(footprint)) {
      throw new BadRequestError(`received invalid footprint`);
    }
    if (metadata.layerPolygonParts != undefined) {
      const featureCollection = metadata.layerPolygonParts as FeatureCollection;
      try {
        geojsonType(featureCollection, 'FeatureCollection', 'validateGeoJsons');
      } catch {
        throw new BadRequestError(`received invalid layerPolygonParts, layerPolygonParts must be feature collection`);
      }
      featureCollection.features.forEach((feature) => {
        if (
          (feature.geometry.type != 'Polygon' && feature.geometry.type != 'MultiPolygon') ||
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          feature.geometry.coordinates == undefined ||
          !isValidGeoJson(feature)
        ) {
          throw new BadRequestError(`received invalid footprint for layerPolygonParts feature, it must be valid Polygon or MultiPolygon`);
        }
      });
    }
  }

  private async generateRecordIds(): Promise<IRecordIds> {
    let id: string;
    let isExists: boolean;
    let jobs: IGetJobResponse[];
    try {
      do {
        this.logger.debug(`generating record id`);
        id = uuidv4();
        isExists = await this.catalog.existsByRecordId(id);
        jobs = await this.db.findJobsByInternalId(id);
      } while (isExists && jobs.length > 0);

      const displayPath = uuidv4();
      const recordIds = {
        id: id,
        displayPath: displayPath,
      };

      this.logger.debug(`generated record id: ${recordIds.id}, display path: ${recordIds.displayPath}`);

      return recordIds;
    } catch (err) {
      this.logger.error(`failed to generate record id: ${(err as Error).message}`);
      throw err;
    }
  }

  private getTileOutputFormat(taskType: string, transparency: Transparency): TileOutputFormat {
    let tileOutputFormat: TileOutputFormat;
    if (transparency === Transparency.OPAQUE) {
      if (taskType === TaskAction.MERGE_TILES) {
        tileOutputFormat = TileOutputFormat.JPEG;
      } else {
        tileOutputFormat = TileOutputFormat.PNG;
      }
    } else {
      tileOutputFormat = TileOutputFormat.PNG;
    }
    return tileOutputFormat;
  }
}
