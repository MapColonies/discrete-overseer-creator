import { join } from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import isValidGeoJson from '@turf/boolean-valid';
import { v4 as uuidv4 } from 'uuid';
import { GeoJSON } from 'geojson';
import client from 'prom-client';
import { Geometry, bbox } from '@turf/turf';
import { IngestionParams, LayerMetadata, ProductType, Transparency, TileOutputFormat } from '@map-colonies/mc-model-types';
import { TilesMimeFormat, lookup as mimeLookup } from '@map-colonies/types';
import { BadRequestError, ConflictError, NotFoundError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { IFindJobsRequest, OperationStatus } from '@map-colonies/mc-priority-queue';
import { getIssues } from '@placemarkio/check-geojson';
import booleanContains from '@turf/boolean-contains';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { getMapServingLayerName } from '../../utils/layerNameGenerator';
import { SERVICES } from '../../common/constants';
import { IConfig, IMergeTaskParams, IRecordIds, ISupportedIngestionSwapTypes } from '../../common/interfaces';
import { JobAction, TaskAction } from '../../common/enums';
import { createBBoxString, extentBuffer } from '../../utils/bbox';
import { ZoomLevelCalculator } from '../../utils/zoomToResolution';
import { JobResponse, JobManagerWrapper } from '../../serviceClients/JobManagerWrapper';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { MapPublisherClient } from '../../serviceClients/mapPublisher';
import { MergeTilesTasker } from '../../merge/mergeTilesTasker';
import { SourcesValidationParams, Grid, ITaskParameters, SourcesValidationResponse, SourcesInfoRequest } from '../interfaces';
import { InfoData } from '../../utils/interfaces';
import { isPixelSizeValid } from '../../utils/pixelSizeValidate';
import { GdalUtilities } from '../../utils/GDAL/gdalUtilities';
import { IngestionValidator } from './ingestionValidator';
import { SplitTilesTasker } from './splitTilesTasker';

@injectable()
export class LayersManager {
  private readonly tileSplitTask: string;
  private readonly tileMergeTask: string;
  private readonly useNewTargetFlagInUpdateTasks: boolean;
  private readonly sourceMount: string;
  private readonly resolutionFixedPointTolerance: number;
  private readonly extentBufferInMeters: number;

  //metrics
  private readonly requestCreateLayerCounter?: client.Counter<'requestType' | 'jobType'>;
  private readonly createJobTasksHistogram?: client.Histogram<'requestType' | 'jobType' | 'taskType' | 'successCreatingJobTask'>;

  private grids: Grid[] = [];

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly zoomLevelCalculator: ZoomLevelCalculator,
    private readonly db: JobManagerWrapper,
    private readonly catalog: CatalogClient,
    private readonly mapPublisher: MapPublisherClient,
    private readonly ingestionValidator: IngestionValidator,
    private readonly gdalUtilities: GdalUtilities,
    private readonly splitTilesTasker: SplitTilesTasker,
    private readonly mergeTilesTasker: MergeTilesTasker,

    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    this.sourceMount = this.config.get<string>('layerSourceDir');
    this.tileSplitTask = this.config.get<string>('ingestionTaskType.tileSplitTask');
    this.tileMergeTask = this.config.get<string>('ingestionTaskType.tileMergeTask');
    this.useNewTargetFlagInUpdateTasks = this.config.get<boolean>('ingestionMergeTiles.useNewTargetFlagInUpdateTasks');
    this.resolutionFixedPointTolerance = this.config.get<number>('validationValuesByInfo.resolutionFixedPointTolerance');
    this.extentBufferInMeters = this.config.get<number>('validationValuesByInfo.extentBufferInMeters');

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

  @withSpanAsyncV4
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
    this.validateSourceDate(data.metadata);
    const filesData: SourcesValidationParams = { fileNames: files, originDirectory: originDirectory };
    await this.validateFiles(filesData);
    await this.validateInfoDataToParams(data.fileNames, data.originDirectory, data);
    this.validateCorrectProductVersion(data);

    const isGpkg = this.ingestionValidator.validateIsGpkg(files);
    if (isGpkg) {
      this.ingestionValidator.validateGpkgFiles(files, originDirectory);
      this.grids = this.ingestionValidator.getGrids(files, originDirectory);
    }

    await this.validateJobNotRunning(productId, productType);
    const jobType = await this.validateAndGetJobType(data);
    const taskType = this.getTaskType(jobType, isGpkg);
    const fetchTimerTotalJobsEnd = this.createJobTasksHistogram?.startTimer({ requestType: 'CreateLayer', jobType, taskType });

    const existsInMapProxy = await this.isExistsInMapProxy(productId, productType);

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
        data.metadata.tileMimeFormat = mimeLookup(data.metadata.tileOutputFormat) as TilesMimeFormat;
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
      } else if (jobType === JobAction.UPDATE || jobType === JobAction.SWAP_UPDATE) {
        const record = await this.catalog.findRecord(productId, undefined, productType);
        data.metadata.id = record?.metadata.id as string;
        const recordId = data.metadata.id;
        let layerRelativePath = '';
        let useNewTargetFlagInUpdateTasks = undefined;
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
        data.metadata.tileMimeFormat = record?.metadata.tileMimeFormat;
        let cleanupData = undefined;
        let displayPath = '';
        if (jobType === JobAction.SWAP_UPDATE) {
          displayPath = uuidv4();
          // TODO: for future cleanup on previous version
          // TODO: (in cleanup) S3 Tiles wont be deleted if there is existing export job in progress
          cleanupData = {
            previousRelativePath: record?.metadata.displayPath as string,
            previousProductVersion: record?.metadata.productVersion as string,
          };
          data.metadata.displayPath = displayPath;
          useNewTargetFlagInUpdateTasks = true; // swap should upload new tiles without merging to new displayPath.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (jobType === JobAction.UPDATE) {
          useNewTargetFlagInUpdateTasks = this.useNewTargetFlagInUpdateTasks;
          data.metadata.displayPath = record?.metadata.displayPath as string;
          displayPath = data.metadata.displayPath;
        }
        layerRelativePath = `${recordId}/${displayPath}`;
        jobId = await this.mergeTilesTasker.createMergeTilesTasks(
          data,
          layerRelativePath,
          taskType,
          jobType,
          this.grids,
          extent,
          overseerUrl,
          useNewTargetFlagInUpdateTasks,
          cleanupData
        );

        const message = `Update job - Transparency, TileOutputFormat and TilesMimeFormat will be override from catalog:
    Transparency => from ${data.metadata.transparency as Transparency} to ${record?.metadata.transparency as Transparency},
    TilesMimeFormat => from ${data.metadata.tileMimeFormat as TilesMimeFormat} to ${record?.metadata.tileMimeFormat as TilesMimeFormat}
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

  //TODO: decide what the function will return -void or boolean
  @withSpanAsyncV4
  public async checkFiles(data: SourcesValidationParams): Promise<SourcesValidationResponse> {
    try {
      const files: string[] = data.fileNames;
      const originDirectory: string = data.originDirectory;
      this.logger.debug({
        files: files,
        originDirectory: originDirectory,
        msg: 'validating files',
      });
      await this.validateFiles(data);
      const isGpkg = this.ingestionValidator.validateIsGpkg(files);
      if (isGpkg) {
        this.ingestionValidator.validateGpkgFiles(files, originDirectory);
      }
      const validResponse: SourcesValidationResponse = { isValid: true };
      return validResponse;
    } catch (err) {
      if (err instanceof BadRequestError) {
        const response: SourcesValidationResponse = { isValid: false, reason: err.message };
        return response;
      } else {
        throw err;
      }
    }
  }

  @withSpanAsyncV4
  public async getFilesInfo(data: SourcesInfoRequest): Promise<InfoData[]> {
    const fileNames: string[] = data.fileNames;
    const originDirectory: string = data.originDirectory;
    this.logger.info({
      fileNames: fileNames,
      originDirectory: originDirectory,
      msg: 'Request was made to get files GDAL info',
    });
    const filesExists = await this.ingestionValidator.validateExists(originDirectory, fileNames);
    if (!filesExists) {
      const message = `Invalid files list, some files are missing`;
      this.logger.error({
        fileNames: fileNames,
        originDirectory: originDirectory,
        msg: message,
      });
      throw new NotFoundError(message);
    }
    try {
      const info: Promise<InfoData[]> = Promise.all(
        fileNames.map(async (file) => {
          const filePath = join(this.sourceMount, originDirectory, file);
          try {
            const infoData: InfoData | undefined = await this.gdalUtilities.getInfoData(filePath);
            if (!infoData) {
              throw new BadRequestError(`Invalid file: ${file}`);
            }
            return infoData;
          } catch (err) {
            const message = `failed to get gdal info on file: ${filePath}`;
            let error = err as Error;
            error = { ...error, message };
            throw error;
          }
        })
      );
      return await info;
    } catch (err) {
      this.logger.error({
        msg: `${(err as Error).message}`,
        err: err,
      });
      throw err;
    }
  }

  @withSpanAsyncV4
  private async validateAndGetJobType(data: IngestionParams): Promise<JobAction> {
    const productId = data.metadata.productId as string;
    const version = data.metadata.productVersion as string;
    const productType = data.metadata.productType as ProductType;
    const productSubType = data.metadata.productSubType;
    const highestVersion = await this.catalog.getHighestLayerVersion(productId, productType);

    if (highestVersion === undefined) {
      return JobAction.NEW;
    }
    const requestedLayerVersion = parseFloat(version);
    if (requestedLayerVersion > highestVersion) {
      const supportedIngestionSwapTypes = this.config.get<ISupportedIngestionSwapTypes[]>('supportedIngestionSwapTypes');
      const isSwapUpdate = supportedIngestionSwapTypes.find((supportedSwapObj) => {
        return supportedSwapObj.productType === productType && supportedSwapObj.productSubType === productSubType;
      });
      if (isSwapUpdate) {
        return JobAction.SWAP_UPDATE;
      }
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

  @withSpanV4
  private getTaskType(jobType: JobAction, isGpkg: boolean): string {
    if (jobType === JobAction.NEW) {
      if (isGpkg) {
        return this.tileMergeTask;
      } else {
        return this.tileSplitTask;
      }
    } else if (isGpkg) {
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

  @withSpanAsyncV4
  private async validateFiles(data: SourcesValidationParams): Promise<void> {
    const fileNames = data.fileNames;
    const originDirectory = data.originDirectory;
    if (fileNames.length !== 1) {
      const message = `Invalid files list, can contain only one file`;
      this.logger.error({
        fileNames: fileNames,
        originDirectory: originDirectory,
        msg: message,
      });
      throw new BadRequestError(message);
    }
    const originDirectoryExists = this.ingestionValidator.validateSourceDirectory(originDirectory);
    if (!originDirectoryExists) {
      throw new BadRequestError(`"originDirectory" is empty, files should be stored on specific directory`);
    }
    const originDirectoryNotWatch = this.ingestionValidator.validateNotWatchDir(originDirectory);
    if (!originDirectoryNotWatch) {
      throw new BadRequestError(`"originDirectory" can't be with same name as watch directory`);
    }
    const filesExists = await this.ingestionValidator.validateExists(originDirectory, fileNames);
    if (!filesExists) {
      const message = `Invalid files list, some files are missing`;
      this.logger.error({
        fileNames: fileNames,
        originDirectory: originDirectory,
        msg: message,
      });
      throw new BadRequestError(message);
    }
    await this.ingestionValidator.validateGdalInfo(fileNames, originDirectory);
  }

  @withSpanAsyncV4
  private async isExistsInMapProxy(productId: string, productType: ProductType): Promise<boolean> {
    const layerName = getMapServingLayerName(productId, productType);
    const existsInMapServer = await this.mapPublisher.exists(layerName);
    return existsInMapServer;
  }

  @withSpanAsyncV4
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

  @withSpanAsyncV4
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

  @withSpanV4
  private validateGeoJsons(metadata: LayerMetadata): void {
    const footprint = metadata.footprint as Geometry;
    // TODO: consider split footprint type and footprint coordinates condition to prevent misundestand error log.
    if (
      (footprint.type !== 'Polygon' && footprint.type !== 'MultiPolygon') ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      footprint.coordinates === undefined ||
      !this.validateGeometry(footprint) ||
      !isValidGeoJson(footprint)
    ) {
      const message = `Received invalid footprint: ${JSON.stringify(footprint)} `;
      this.logger.error({
        productId: metadata.productId,
        productType: metadata.productType,
        version: metadata.productVersion,
        footprint: footprint,
        msg: message,
      });
      throw new BadRequestError(message);
    }
  }

  @withSpanAsyncV4
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

  @withSpanAsyncV4
  private async validateInfoDataToParams(files: string[], originDirectory: string, data: IngestionParams): Promise<void> {
    try {
      await Promise.all(
        files.map(async (file) => {
          const filePath = join(this.sourceMount, originDirectory, file);
          const infoData = (await this.gdalUtilities.getInfoData(filePath)) as InfoData;
          const bufferedExtent = extentBuffer(this.extentBufferInMeters, infoData.footprint);
          let message = '';
          const isValidPixelSize = isPixelSizeValid(data.metadata.maxResolutionDeg as number, infoData.pixelSize, this.resolutionFixedPointTolerance);
          if (!isValidPixelSize) {
            message += `Provided ResolutionDegree: ${data.metadata.maxResolutionDeg as number} is smaller than pixel size: ${
              infoData.pixelSize
            } from GeoPackage.`;
          }
          if (data.metadata.footprint?.type === 'MultiPolygon') {
            data.metadata.footprint.coordinates.forEach((coords) => {
              const polygon = { type: 'Polygon', coordinates: coords };
              if (
                !(
                  booleanContains(bufferedExtent as Geometry, polygon as Geometry) ||
                  booleanContains(infoData.footprint as Geometry, polygon as Geometry)
                )
              ) {
                message += `Provided footprint isn't contained in the extent from GeoPackage.`;
              }
            });
          } else if (
            !(
              booleanContains(bufferedExtent as Geometry, data.metadata.footprint as Geometry) ||
              booleanContains(infoData.footprint as Geometry, data.metadata.footprint as Geometry)
            )
          ) {
            message += `Provided footprint isn't contained in the extent from GeoPackage.`;
          }
          if (message !== '') {
            this.logger.error({
              filePath: filePath,
              msg: message,
            });
            throw new BadRequestError(message);
          }
        })
      );
    } catch (err) {
      if (err instanceof BadRequestError) {
        this.logger.error({
          msg: err.message,
          err: err,
        });
        throw new BadRequestError(err.message);
      } else {
        const message = `Failed to Compare data to request: ${(err as Error).message}`;
        this.logger.error({
          msg: message,
          err: err,
        });
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(message);
      }
    }
  }

  // validate productVersion will have decimal value
  private validateCorrectProductVersion(data: IngestionParams): void {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.metadata.productVersion?.indexOf('.') === -1) {
      data.metadata.productVersion = `${data.metadata.productVersion}.0`;
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

  private validateGeometry(footprint: Geometry): boolean {
    const footprintIssues = getIssues(JSON.stringify(footprint));
    if (footprintIssues.length === 0) {
      return true;
    }
    return false;
  }

  private validateSourceDate(metaData: LayerMetadata): void {
    const sourceDateStartStr = metaData.sourceDateStart;
    const sourceDateEndStr = metaData.sourceDateEnd;

    if (sourceDateStartStr === undefined || sourceDateEndStr === undefined) {
      throw new BadRequestError('Source date start and end are required fields.');
    }

    const sourceDateStart = new Date(sourceDateStartStr);
    const sourceDateEnd = new Date(sourceDateEndStr);

    if (isNaN(sourceDateStart.getTime()) || isNaN(sourceDateEnd.getTime())) {
      throw new BadRequestError('Invalid source date format. Please provide valid Date strings.');
    }

    if (sourceDateStart > sourceDateEnd) {
      throw new BadRequestError('Invalid source date range. Start date must be before or equal to end date.');
    }

    const currentTimestamp = new Date();
    if (sourceDateStart > currentTimestamp || sourceDateEnd > currentTimestamp) {
      throw new BadRequestError('Invalid source dates. Dates cannot be larger than the current time (ingestion time).');
    }
  }

  private setDefaultValues(data: IngestionParams): void {
    data.metadata.srsId = data.metadata.srsId === undefined ? '4326' : data.metadata.srsId;
    data.metadata.srsName = data.metadata.srsName === undefined ? 'WGS84GEO' : data.metadata.srsName;
    data.metadata.productBoundingBox = createBBoxString(data.metadata.footprint as GeoJSON);
    data.metadata.layerPolygonParts = undefined;
  }
}
