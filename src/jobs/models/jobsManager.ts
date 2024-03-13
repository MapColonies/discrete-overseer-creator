import { inspect } from 'node:util';
import { BadRequestError, InternalServerError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { IRasterCatalogUpsertRequestBody, LayerMetadata, Link, ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';
import { Footprint, getUTCDate } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { intersect } from '@turf/turf';
import { SERVICES } from '../../common/constants';
import { MapServerCacheType, MapServerCacheSource, MapServerSeedMode } from '../../common/enums';
import { IConfig, IFindResponseRecord, ISeed, ISeedTaskParams } from '../../common/interfaces';
import { IPublishMapLayerRequest, PublishedMapLayerCacheType } from '../../layers/interfaces';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { JobManagerWrapper, TaskResponse } from '../../serviceClients/JobManagerWrapper';
import { MapPublisherClient } from '../../serviceClients/mapPublisher';
import { OperationTypeEnum, SyncClient } from '../../serviceClients/syncClient';
import { MetadataMerger } from '../../update/metadataMerger';
import { getMapServingLayerName } from '../../utils/layerNameGenerator';
import { ICompletedJobs } from '../interfaces';
import { ILinkBuilderData, LinkBuilder } from './linksBuilder';

interface IngestionTaskTypes {
  tileMergeTask: string;
  tileSplitTask: string;
}

@injectable()
export class JobsManager {
  private readonly mapServerUrl: string;
  private readonly cacheType: PublishedMapLayerCacheType;
  private readonly shouldSync: boolean;
  private readonly ingestionNewJobType: string;
  private readonly ingestionUpdateJobType: string;
  private readonly ingestionSwapUpdateJobType: string;
  private readonly ingestionTaskType: IngestionTaskTypes;
  private readonly seedJobType: string;
  private readonly seedTaskType: string;
  private readonly mapproxyCacheGrid: string;
  private readonly mapproxyCacheMaxZoom: number;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SyncClient) private readonly syncClient: SyncClient,
    private readonly jobManager: JobManagerWrapper,
    private readonly mapPublisher: MapPublisherClient,
    private readonly catalogClient: CatalogClient,
    private readonly linkBuilder: LinkBuilder,
    private readonly metadataMerger: MetadataMerger
  ) {
    this.mapServerUrl = config.get<string>('publicMapServerURL');
    const mapServerCacheType = config.get<string>('mapServerCacheType');
    this.shouldSync = config.get<boolean>('shouldSync');
    this.ingestionNewJobType = config.get<string>('ingestionNewJobType');
    this.ingestionUpdateJobType = config.get<string>('ingestionUpdateJobType');
    this.ingestionSwapUpdateJobType = config.get<string>('ingestionSwapUpdateJobType');
    this.ingestionTaskType = config.get<IngestionTaskTypes>('ingestionTaskType');
    this.seedJobType = config.get<string>('seed.seedJobType');
    this.seedTaskType = config.get<string>('seed.seedTaskType');
    this.cacheType = this.getCacheType(mapServerCacheType);
    this.mapproxyCacheGrid = config.get<string>('mapproxy.cache.grids');
    this.mapproxyCacheMaxZoom = config.get<number>('mapproxy.cache.maxZoom');
  }

  @withSpanAsyncV4
  public async completeJob(jobId: string, taskId: string): Promise<void> {
    const job = await this.jobManager.getJobById(jobId);
    const task = await this.jobManager.getTaskById(jobId, taskId);

    if (
      (job.type === this.ingestionUpdateJobType || job.type === this.ingestionSwapUpdateJobType) &&
      task.type === this.ingestionTaskType.tileMergeTask
    ) {
      const message = `[TasksManager][completeJob] Completing Update of ${job.type} job with jobId ${jobId} and taskId ${taskId}`;
      this.logger.info({
        jobId: jobId,
        taskId: taskId,
        msg: message,
      });

      const isSwap = job.type === this.ingestionSwapUpdateJobType; // validate if it is update with swap

      await this.handleUpdateIngestion(job, task, isSwap);
    } else if (
      (task.type === this.ingestionTaskType.tileMergeTask || task.type === this.ingestionTaskType.tileSplitTask) &&
      job.type === this.ingestionNewJobType
    ) {
      const message = `[TasksManager][completeJob] Completing Ingestion-New job with jobId ${jobId} and taskId ${taskId}`;
      this.logger.info({
        jobId: jobId,
        taskId: taskId,
        msg: message,
      });
      await this.handleNewIngestion(job, task);
    } else {
      const message = `[TasksManager][completeJob] Could not complete job id: ${job.id}. Job type "${job.type}" and task type "${task.type}" combination isn't supported`;
      this.logger.error({
        jobId: jobId,
        taskId: taskId,
        msg: message,
      });
      throw new BadRequestError(message);
    }

    if (job.status === OperationStatus.IN_PROGRESS) {
      await this.jobManager.updateJobById(job.id, OperationStatus.IN_PROGRESS, job.percentage);
    }
  }

  @withSpanAsyncV4
  private async handleUpdateIngestion(job: ICompletedJobs, task: TaskResponse, isSwap = false): Promise<void> {
    if (task.status === OperationStatus.FAILED && job.status !== OperationStatus.FAILED) {
      await this.abortJobWithStatusFailed(job.id, `Failed to update ingestion`);
      job.status = OperationStatus.FAILED;
    } else if (job.isSuccessful && task.status === OperationStatus.COMPLETED) {
      this.logger.info({
        jobId: job.id,
        taskId: task.id,
        msg: `job & task completed - executing data merge from job metadata to record`,
      });

      const previousLayerData = await this.catalogClient.findRecordById(job.internalId);
      if (previousLayerData === undefined) {
        const errMsg = `Could not find record catalog for: productId: ${job.metadata.productId as string}, productType: ${
          job.metadata.productType as string
        }, version: ${job.metadata.productVersion as string} to merge data into`;
        this.logger.error(errMsg, job.id);
        throw new InternalServerError(errMsg);
      }
      const mergedData = this.mergeUpdatedRecord(job, task, previousLayerData, isSwap);

      this.logger.debug({
        jobId: job.id,
        taskId: task.id,
        internalId: mergedData.id,
        mergedData: inspect(mergedData),
        msg: `Updating catalog record ${mergedData.id as string} with merged metadata`,
      });

      const layerName = this.getMapLayerName(previousLayerData);
      await this.publishCompletedUpdateRecord(layerName, job, task, mergedData, isSwap);

      try {
        await this.generateSeedJob(job, mergedData, previousLayerData, layerName, isSwap);
      } catch (err) {
        this.logger.warn({ msg: `Failed generate seed job`, err, jobId: job.id, layerName, catalogId: mergedData.id });
      }
    }
  }

  @withSpanAsyncV4
  private async handleNewIngestion(job: ICompletedJobs, task: TaskResponse): Promise<void> {
    if (task.status === OperationStatus.FAILED && job.status !== OperationStatus.FAILED) {
      await this.abortJobWithStatusFailed(job.id, `Failed to generate tiles`);
      job.status = OperationStatus.FAILED;
    } else if (job.isSuccessful) {
      const layerName = getMapServingLayerName(job.metadata.productId as string, job.metadata.productType as ProductType);

      this.logger.debug({
        productId: job.metadata.productId,
        productType: job.metadata.productType,
        version: job.metadata.productVersion,
        msg: `[TasksManager][handleNewIngestion] Publishing layer name: "${layerName}" in map services`,
      });

      await this.publishToMappingServer(job.id, job.metadata, layerName, job.relativePath);
      const catalogId = await this.publishToCatalog(job.id, job.metadata, layerName);
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await this.jobManager.updateJobById(job.id, OperationStatus.COMPLETED, 100, undefined, catalogId);
      job.status = OperationStatus.COMPLETED;

      if (this.shouldSync) {
        try {
          await this.syncClient.triggerSync(
            job.id,
            job.metadata.productId as string,
            job.metadata.productVersion as string,
            job.metadata.productType as ProductType,
            OperationTypeEnum.ADD,
            job.relativePath
          );
        } catch (err) {
          const message = `[TasksManager][handleNewIngestion] Failed to trigger sync productId ${job.metadata.productId as string} productVersion ${
            job.metadata.productVersion as string
          }. error=${(err as Error).message}`;

          this.logger.error({
            jobId: job.id,
            productId: job.metadata.productId,
            productType: job.metadata.productType,
            version: job.metadata.productVersion,
            msg: message,
          });
        }
      }
    }
  }

  private async publishToCatalog(jobId: string, metadata: LayerMetadata, layerName: string): Promise<string> {
    try {
      const message = `[TasksManager][publishToCatalog] Layer ${metadata.productId as string} version ${metadata.productVersion as string}`;
      this.logger.info({
        jobId: jobId,
        productId: metadata.productId,
        productVersion: metadata.productVersion,
        msg: message,
      });
      const linkData: ILinkBuilderData = {
        serverUrl: this.mapServerUrl,
        layerName: layerName,
      };
      const publishModel: IRasterCatalogUpsertRequestBody = {
        metadata: metadata,
        links: this.linkBuilder.createLinks(linkData),
      };

      return await this.catalogClient.publish(publishModel);
    } catch (err) {
      const message = `Failed to publish layer to catalog, error: ${(err as Error).message}`;
      this.logger.error({
        jobId: jobId,
        msg: message,
        err: err,
      });
      await this.jobManager.updateJobById(jobId, OperationStatus.FAILED, undefined, 'Failed to publish layer to catalog');
      throw err;
    }
  }

  private async publishToMappingServer(
    jobId: string,
    metadata: LayerMetadata,
    layerName: string,
    relativePath: string,
    isLayerUpdate = false
  ): Promise<void> {
    const productId = metadata.productId as string;
    const productVersion = metadata.productVersion as string;
    const apiMode = isLayerUpdate ? 'updateOnMappingServer' : 'publishToMappingServer'; // update exists layer or create new
    try {
      const message = `[TasksManager][${apiMode}] Layer ${productId} version ${productVersion}`;
      this.logger.info({
        jobId: jobId,
        productId: productId,
        productVersion: productVersion,
        relativePath,
        msg: message,
      });

      const publishReq: IPublishMapLayerRequest = {
        name: `${layerName}`,
        tilesPath: relativePath,
        cacheType: this.cacheType,
        format: metadata.tileOutputFormat as TileOutputFormat,
      };
      if (isLayerUpdate) {
        await this.mapPublisher.updateLayer(publishReq); // update existing mapproxy layer
      } else {
        await this.mapPublisher.publishLayer(publishReq); // publish new mapproxy layer
      }
    } catch (err) {
      const message = `Failed to publish layer to mapping server, error: ${(err as Error).message}}`;
      this.logger.error({
        jobId: jobId,
        productId: productId,
        productVersion: productVersion,
        msg: message,
        err: err,
      });
      await this.jobManager.updateJobById(jobId, OperationStatus.FAILED, undefined, 'Failed to publish layer to mapping server');
      throw err;
    }
  }

  private getCacheType(mapServerCacheType: string): PublishedMapLayerCacheType {
    let cacheType: PublishedMapLayerCacheType;
    switch (mapServerCacheType.toLowerCase()) {
      case MapServerCacheSource.S3.toLowerCase(): {
        cacheType = PublishedMapLayerCacheType.S3;
        break;
      }
      case MapServerCacheSource.FS.toLowerCase(): {
        cacheType = PublishedMapLayerCacheType.FS;
        break;
      }
      default: {
        throw new Error(`Unsupported storageProvider configuration ${mapServerCacheType}`);
      }
    }
    return cacheType;
  }

  private async abortJobWithStatusFailed(jobId: string, reason?: string): Promise<void> {
    const abortMessage = `Aborting job with ID ${jobId}, reason: ${reason as string}`;
    this.logger.info({
      jobId: jobId,
      msg: abortMessage,
    });
    await this.jobManager.abortJob(jobId);
    const updateJobMessage = `Updating job ${jobId} with status ${OperationStatus.FAILED}`;
    this.logger.info({
      jobId: jobId,
      msg: updateJobMessage,
    });
    await this.jobManager.updateJobById(jobId, OperationStatus.FAILED, undefined, reason);
  }

  private mergeUpdatedRecord(job: ICompletedJobs, task: TaskResponse, catalogRecord: IFindResponseRecord, isSwap = false): LayerMetadata {
    this.logger.debug({
      jobId: job.id,
      taskId: task.id,
      catalogRecordMetadata: inspect(catalogRecord),
      jobMetadata: inspect(job.metadata),
      msg: `Merging catalog record ${catalogRecord.metadata.id as string} with new metadata`,
    });
    const mergedData = this.metadataMerger.merge(catalogRecord.metadata, job.metadata, isSwap);

    return mergedData;
  }

  private async publishCompletedUpdateRecord(
    layerName: string,
    job: ICompletedJobs,
    task: TaskResponse,
    data: LayerMetadata,
    isSwap = false
  ): Promise<void> {
    this.logger.debug({
      productId: job.metadata.productId,
      productType: job.metadata.productType,
      version: job.metadata.productVersion,
      msg: `[TasksManager][handleNewIngestion] Publishing layer name: "${layerName}" in map services`,
    });

    if (isSwap) {
      // swap update should replace layer on mapproxy
      await this.publishToMappingServer(job.id, job.metadata, layerName, job.relativePath, true);
      // TODO: refresh redis cache on previous footprint
    }
    // TODO: else, is regular update - refresh redis cache on New part footprint

    await this.catalogClient.update(job.metadata.id as string, data);
    const message = `Updating status of job ${job.id} to be ${OperationStatus.COMPLETED}`;
    this.logger.info({
      jobId: job.id,
      taskId: task.id,
      msg: message,
    });

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await this.jobManager.updateJobById(job.id, OperationStatus.COMPLETED, 100, undefined, job.metadata.id);
    job.status = OperationStatus.COMPLETED;
  }

  private async generateSeedJob(
    job: ICompletedJobs,
    data: LayerMetadata,
    previousLayerMetadata: IFindResponseRecord,
    layerName: string,
    isSwap = false
  ): Promise<void> {
    const cacheName = await this.mapPublisher.getCacheByNameType({ layerName, cacheType: PublishedMapLayerCacheType.REDIS });
    if (cacheName === undefined) {
      // layer not include redis cache
      this.logger.warn({ msg: `skip generating seed job-task, no cache redis exists on mapproxy.yaml`, layerName });
      return;
    }
    const seedMode = isSwap ? MapServerSeedMode.CLEAN : MapServerSeedMode.SEED; // clean for swapped and seeding for regular update
    const previousGeometry = previousLayerMetadata.metadata.footprint as Footprint;
    const updatedGeometry = job.metadata.footprint as Footprint;
    const geometry = isSwap ? (previousLayerMetadata.metadata.footprint as Footprint) : intersect(previousGeometry, updatedGeometry)?.geometry;

    if (geometry === undefined) {
      // if null, no areas to seed or clean
      this.logger.warn({ msg: `skip generating seed job-task, no geometry relevant for cache seeding`, layerName, cacheName });
      return;
    }

    this.logger.info({
      productId: job.metadata.productId,
      productType: job.metadata.productType,
      version: job.metadata.productVersion,
      layerId: layerName,
      jobId: job.id,
      msg: `Generating cache-seeder job-task to refresh cache for layer name: "${layerName}"`,
    });

    const refreshBefore = getUTCDate().toISOString().replace(/\..+/, '');

    const seedOption: ISeed = {
      mode: seedMode,
      grid: this.mapproxyCacheGrid,
      fromZoomLevel: 0, // by design will alway seed\clean from zoom 0
      toZoomLevel: this.mapproxyCacheMaxZoom, // todo - on future should be calculated from mapproxy capabilities
      geometry: geometry,
      skipUncached: false,
      layerId: cacheName,
      refreshBefore,
    };

    const taskParams: ISeedTaskParams = {
      seedTasks: [seedOption],
      catalogId: data.id as string,
      spanId: 'TBD',
      cacheType: MapServerCacheType.REDIS,
    };

    const jobId = await this.jobManager.createSeedJobTask(job, this.seedJobType, this.seedTaskType, [taskParams]);
    this.logger.info({ msg: `Generated new seed job of type ${seedMode}`, seedJobId: jobId, jobId: job.id });
  }

  private getMapLayerName(catalogRecords: IFindResponseRecord): string {
    const links = catalogRecords.links as Link[]; // extract links from record
    const layerName = links[0].name as string; // get the layer name
    return layerName;
  }
}
