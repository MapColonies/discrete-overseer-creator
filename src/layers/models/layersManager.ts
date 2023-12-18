import { Logger } from '@map-colonies/js-logger';
import isValidGeoJson from '@turf/boolean-valid';
import { v4 as uuidv4 } from 'uuid';
import { GeoJSON } from 'geojson';
import client from 'prom-client';
import { FeatureCollection, Geometry, geojsonType, bbox } from '@turf/turf';
import { IngestionParams, LayerMetadata, ProductType, Transparency, TileOutputFormat } from '@map-colonies/mc-model-types';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { IFindJobsRequest, OperationStatus } from '@map-colonies/mc-priority-queue';
import { getMapServingLayerName } from '../../utils/layerNameGenerator';
import { SERVICES } from '../../common/constants';
import { IConfig, IMergeTaskParams, IRecordIds } from '../../common/interfaces';
import { JobAction, TaskAction } from '../../common/enums';
import { layerMetadataToPolygonParts } from '../../common/utils/polygonPartsBuilder';
import { createBBoxString } from '../../utils/bbox';
import { ZoomLevelCalculator } from '../../utils/zoomToResolution';
import { JobResponse, JobManagerWrapper } from '../../serviceClients/JobManagerWrapper';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { MapPublisherClient } from '../../serviceClients/mapPublisher';
import { MergeTilesTasker } from '../../merge/mergeTilesTasker';
import { SQLiteClient } from '../../serviceClients/sqliteClient';
import { Grid, ITaskParameters } from '../interfaces';
import { FileValidator } from './fileValidator';
import { SplitTilesTasker } from './splitTilesTasker';

@injectable()
export class LayersManager {
  private readonly tileSplitTask: string;
  private readonly tileMergeTask: string;
  private readonly useNewTargetFlagInUpdateTasks: boolean;

  //metrics
  private readonly requestCreateLayerCounter?: client.Counter<'requestType' | 'jobType'>;
  private readonly createJobTasksHistogram?: client.Histogram<'requestType' | 'jobType' | 'taskType' | 'successCreatingJobTask'>;

  private grids: Grid[] = [];

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly zoomLevelCalculator: ZoomLevelCalculator,
    private readonly db: JobManagerWrapper,
    private readonly catalog: CatalogClient,
    private readonly mapPublisher: MapPublisherClient,
    private readonly fileValidator: FileValidator,
    private readonly splitTilesTasker: SplitTilesTasker,
    private readonly mergeTilesTasker: MergeTilesTasker,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    this.tileSplitTask = this.config.get<string>('ingestionTaskType.tileSplitTask');
    this.tileMergeTask = this.config.get<string>('ingestionTaskType.tileMergeTask');
    this.useNewTargetFlagInUpdateTasks = this.config.get<boolean>('ingestionMergeTiles.useNewTargetFlagInUpdateTasks');

    if (registry !== undefined) {
      this.requestCreateLayerCounter = new client.Counter({
        name: 'create_layer_requests_total',
        help: 'The total number of all create layer requests',
        labelNames: ['requestType', 'jobType'] as const,
        registers: [registry],
      });

      this.createJobTasksHistogram = new client.Histogram({
        name: 'layer_creation_job_tasks_duration_seconds',
        help: 'create layer and store duration time (seconds) by job type (new or update) including the tasks generating',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['requestType', 'jobType', 'taskType', 'successCreatingJobTask'] as const,
        registers: [registry],
      });
    }
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
      throw new BadRequestError(`Received invalid field ingestionDate`);
    }
    await this.validateFiles(data);
    await this.validateJobNotRunning(productId, productType);

    const jobType = await this.getJobType(data);
    const taskType = this.getTaskType(jobType, files, originDirectory);

    const fetchTimerTotalJobsEnd = this.createJobTasksHistogram?.startTimer({ requestType: 'CreateLayer', jobType, taskType });

    const existsInMapProxy = await this.isExistsInMapProxy(productId, productType);

    this.validateCorrectProductVersion(data);
    const message = `Creating job, job type: '${jobType}', tasks type: '${taskType}' for productId: ${
      data.metadata.productId as string
    } productType: ${productType}`;
    this.logger.info({
      jobType: jobType,
      taskType: taskType,
      productId: data.metadata.productId,
      msg: message,
    });
    try {
      let jobId: string;
      if (jobType === JobAction.NEW) {
        const recordIds = await this.generateRecordIds();
        const id = recordIds.id;
        const displayPath = recordIds.displayPath;

        data.metadata.displayPath = displayPath;
        data.metadata.id = id;

        await this.validateNotExistsInCatalog(productId, version, productType);
        if (existsInMapProxy) {
          const message = `Failed to create new ingestion job for layer: '${productId}-${productType}', already exists on MapProxy`;
          this.logger.error({
            productId: productId,
            productType: productType,
            version: version,
            msg: message,
          });
          throw new ConflictError(message);
        }

        data.metadata.tileOutputFormat = this.getTileOutputFormat(taskType, transparency);
        this.setDefaultValues(data);

        const layerRelativePath = `${id}/${displayPath}`;

        if (taskType === TaskAction.MERGE_TILES) {
          jobId = await this.mergeTilesTasker.createMergeTilesTasks(
            data,
            layerRelativePath,
            taskType,
            jobType,
            this.grids,
            extent,
            overseerUrl,
            true
          );
        } else {
          const layerZoomRanges = this.zoomLevelCalculator.createLayerZoomRanges(data.metadata.maxResolutionDeg as number);
          jobId = await this.splitTilesTasker.createSplitTilesTasks(data, layerRelativePath, layerZoomRanges, jobType, taskType);
        }

        this.logger.debug({
          jobId: jobId,
          productId: productId,
          productType: productType,
          version: version,
          jobType: jobType,
          taskType: taskType,
          msg: `Successfully created job type: ${jobType} and tasks type: ${taskType}`,
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      } else if (jobType === JobAction.UPDATE) {
        const record = await this.catalog.findRecord(productId, undefined, productType);
        data.metadata.id = record?.metadata.id as string;
        data.metadata.displayPath = record?.metadata.displayPath as string;
        const recordId = data.metadata.id;
        const dispalyPath = data.metadata.displayPath;
        const layerRelativePath = `${recordId}/${dispalyPath}`;
        if (!existsInMapProxy) {
          const message = `Failed to create update job for layer: '${productId}-${productType}', is not exists on MapProxy`;
          this.logger.error({
            productId: productId,
            productType: productType,
            jobType: jobType,
            taskType: taskType,
            version: version,
            msg: message,
          });
          throw new BadRequestError(message);
        }

        data.metadata.transparency = record?.metadata.transparency;
        data.metadata.tileOutputFormat = record?.metadata.tileOutputFormat;

        jobId = await this.mergeTilesTasker.createMergeTilesTasks(
          data,
          layerRelativePath,
          taskType,
          jobType,
          this.grids,
          extent,
          overseerUrl,
          this.useNewTargetFlagInUpdateTasks
        );

        const message = `Update job - Transparency and TileOutputFormat will be override from catalog:
      Transparency => from ${data.metadata.transparency as Transparency} to ${record?.metadata.transparency as Transparency},
      TileOutputFormat => from ${data.metadata.tileOutputFormat as TileOutputFormat} to ${record?.metadata.tileOutputFormat as TileOutputFormat}`;
        this.logger.warn({
          jobId: jobId,
          productId: productId,
          productType: productType,
          version: version,
          msg: message,
        });
        this.logger.debug({
          jobId: jobId,
          productId: productId,
          productType: productType,
          version: version,
          jobType: jobType,
          taskType: taskType,
          msg: `Successfully created job type: ${jobType} and tasks type: ${taskType}`,
        });
      } else {
        const message = `Unsupported job type`;
        this.logger.error({
          productId: productId,
          productType: productType,
          version: version,
          jobType: jobType,
          taskType: jobType,
          msg: message,
        });
        throw new BadRequestError(message);
      }
    } catch (e) {
      if (fetchTimerTotalJobsEnd) {
        // will add new histogram metrics to count creation duration on failure count
        fetchTimerTotalJobsEnd({ successCreatingJobTask: 'false' });
      }
      throw e;
    }
    if (fetchTimerTotalJobsEnd) {
      // will add new histogram metrics to count creation duration on success count
      fetchTimerTotalJobsEnd({ successCreatingJobTask: 'true' });
    }
    this.requestCreateLayerCounter?.inc({ requestType: 'CreateLayer', jobType });
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
      const message = `Layer id: ${productId} version: ${version} product type: ${productType} has already the same version (${highestVersion}) in catalog`;
      this.logger.error({
        productId: productId,
        productType: productType,
        version: version,
        msg: message,
      });
      throw new ConflictError(message);
    } else {
      const message = `Layer id: ${productId} version: ${version} product type: ${productType} has already higher version (${highestVersion}) in catalog`;
      this.logger.error({
        productId: productId,
        productType: productType,
        version: version,
        msg: message,
      });
      throw new BadRequestError(message);
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
      const message = `Failed to create job type: ${jobType} - does not support Mixed/TIFF/TIF/J2k etc.. (GPKG support only)`;
      this.logger.error({
        jobType: jobType,
        msg: message,
      });
      throw new BadRequestError(message);
    }
  }

  private async validateFiles(data: IngestionParams): Promise<void> {
    const fileNames = data.fileNames;
    const originDirectory = data.originDirectory;
    const originDirectoryExists = this.fileValidator.validateSourceDirectory(originDirectory);
    if (!originDirectoryExists) {
      throw new BadRequestError(`"originDirectory" is empty, files should be stored on specific directory`);
    }
    const originDirectoryNotWatch = this.fileValidator.validateNotWatchDir(originDirectory);
    if (!originDirectoryNotWatch) {
      throw new BadRequestError(`"originDirectory" can't be with same name as watch directory`);
    }
    const filesExists = await this.fileValidator.validateExists(originDirectory, fileNames);
    if (!filesExists) {
      const message = `Invalid files list, some files are missing`;
      this.logger.error({
        fileNames: fileNames,
        originDirectory: originDirectory,
        msg: message,
      });
      throw new BadRequestError(message);
    }
    //TODO: fix unit tests after the union of this 2 validations
    //await this.fileValidator.validateProjections(fileNames, originDirectory);
    await this.fileValidator.validateInfoData(fileNames, originDirectory);
  }

  private async isExistsInMapProxy(productId: string, productType: ProductType): Promise<boolean> {
    const layerName = getMapServingLayerName(productId, productType);
    const existsInMapServer = await this.mapPublisher.exists(layerName);
    return existsInMapServer;
  }

  private async validateJobNotRunning(productId: string, productType: ProductType): Promise<void> {
    const findJobParameters: IFindJobsRequest = {
      resourceId: productId,
      productType,
      isCleaned: false,
      shouldReturnTasks: false,
    };
    const ingestionJobTypes = this.config.get<string[]>('forbiddenTypesForParallelIngesion');
    const jobs = await this.db.getJobs<Record<string, unknown>, ITaskParameters | IMergeTaskParams>(findJobParameters);
    jobs.forEach((job) => {
      if ((job.status == OperationStatus.IN_PROGRESS || job.status == OperationStatus.PENDING) && ingestionJobTypes.includes(job.type)) {
        const message = `Layer id: ${productId} product type: ${productType}, conflicting job ${job.type} is already running for that layer`;
        this.logger.error({
          productId: productId,
          productType: productType,
          msg: message,
        });
        throw new ConflictError(message);
      }
    });
  }

  private async validateNotExistsInCatalog(productId: string, version?: string, productType?: string): Promise<void> {
    const existsInCatalog = await this.catalog.exists(productId, version, productType);
    if (existsInCatalog) {
      const message = `Layer id: ${productId} version: ${version as string}, already exists in catalog`;
      this.logger.error({
        productId: productId,
        version: version,
        productType: productType,
        msg: message,
      });
      throw new ConflictError(message);
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

  // validate productVersion will have decimal value
  private validateCorrectProductVersion(data: IngestionParams): void {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.metadata.productVersion?.indexOf('.') === -1) {
      data.metadata.productVersion = `${data.metadata.productVersion}.0`;
    }
  }

  private validateGeoJsons(metadata: LayerMetadata): void {
    const footprint = metadata.footprint as Geometry;
    // TODO: consider split footprint type and footprint coordinates condition to prevent misundestand error log.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if ((footprint.type != 'Polygon' && footprint.type != 'MultiPolygon') || footprint.coordinates == undefined || !isValidGeoJson(footprint)) {
      const message = `Received invalid footprint: ${JSON.stringify(footprint)}`;
      this.logger.error({
        productId: metadata.productId,
        productType: metadata.productType,
        version: metadata.productVersion,
        footprint: footprint,
        msg: message,
      });
      throw new BadRequestError(message);
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
    let jobs: JobResponse[];
    try {
      do {
        this.logger.debug({
          msg: `generating record id`,
        });
        id = uuidv4();
        isExists = await this.catalog.existsByRecordId(id);
        const findJobParameters: IFindJobsRequest = {
          internalId: id,
          shouldReturnTasks: false,
        };
        jobs = await this.db.getJobs<Record<string, unknown>, ITaskParameters | IMergeTaskParams>(findJobParameters);
      } while (isExists && jobs.length > 0);

      const displayPath = uuidv4();
      const recordIds = {
        id: id,
        displayPath: displayPath,
      };

      this.logger.debug({ msg: `generated record id: ${recordIds.id}, display path: ${recordIds.displayPath}` });

      return recordIds;
    } catch (err) {
      this.logger.error({
        msg: `failed to generate record id: ${(err as Error).message}`,
        err: err,
      });
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
