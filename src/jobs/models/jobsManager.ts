import { BadRequestError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { IRasterCatalogUpsertRequestBody, LayerMetadata, ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { MapServerCacheType, OperationStatus } from '../../common/enums';
import { IConfig } from '../../common/interfaces';
import { IPublishMapLayerRequest, PublishedMapLayerCacheType } from '../../layers/interfaces';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { JobManagerClient } from '../../serviceClients/jobManagerClient';
import { MapPublisherClient } from '../../serviceClients/mapPublisher';
import { OperationTypeEnum, SyncClient } from '../../serviceClients/syncClient';
import { MetadataMerger } from '../../update/metadataMerger';
import { getMapServingLayerName } from '../../utils/layerNameGenerator';
import { ICompletedTasks, IGetTaskResponse } from '../interfaces';
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
  private readonly ingestionTaskType: IngestionTaskTypes;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SyncClient) private readonly syncClient: SyncClient,
    private readonly jobManager: JobManagerClient,
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
    this.ingestionTaskType = config.get<IngestionTaskTypes>('ingestionTaskType');
    this.cacheType = this.getCacheType(mapServerCacheType);
  }

  public async completeJob(jobId: string, taskId: string): Promise<void> {
    const job = await this.jobManager.getJobStatus(jobId);
    const task = await this.jobManager.getTask(jobId, taskId);
    if (job.type === this.ingestionUpdateJobType && task.type === this.ingestionTaskType.tileMergeTask) {
      const message = `[TasksManager][taskComplete] Completing Ingestion-Update job with jobId ${jobId} and taskId ${taskId}`;
      this.logger.info({
        jobId: jobId,
        taskId: taskId,
        message: message,
      });
      await this.handleUpdateIngestion(job, task);
    } else if (
      (task.type === this.ingestionTaskType.tileMergeTask || task.type === this.ingestionTaskType.tileSplitTask) &&
      job.type === this.ingestionNewJobType
    ) {
      const message = `[TasksManager][taskComplete] Completing Ingestion-New job with jobId ${jobId} and taskId ${taskId}`;
      this.logger.info({
        jobId: jobId,
        taskId: taskId,
        message: message,
      });
      await this.handleNewIngestion(job, task);
    } else {
      const message =  `[TasksManager][taskComplete] Could not complete job id: ${job.id}. Job type "${job.type}" and task type "${task.type}" combination isn't supported`;
      this.logger.error({
        jobId: jobId,
        taskId: taskId,
        message: message,
      });
      throw new BadRequestError(message);
    }

    if (job.status === OperationStatus.IN_PROGRESS) {
      await this.jobManager.updateJobStatus(job.id, OperationStatus.IN_PROGRESS, job.percentage);
    }
  }

  private async publishToCatalog(jobId: string, metadata: LayerMetadata, layerName: string): Promise<string> {
    try {
      const message = `[TasksManager][publishToCatalog] Layer ${metadata.productId as string} version ${metadata.productVersion as string}`;
      this.logger.info({
        productId: metadata.productId,
        productVersion: metadata.productVersion,
        message: message,
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
      const message =  'Failed to publish layer to catalog';
      this.logger.error({
        jobId: jobId,
        message: message,
      });
      await this.jobManager.updateJobStatus(jobId, OperationStatus.FAILED, undefined, 'Failed to publish layer to catalog');
      throw err;
    }
  }

  private async publishToMappingServer(jobId: string, metadata: LayerMetadata, layerName: string, relativePath: string): Promise<void> {
    const productId = metadata.productId as string;
    const productVersion = metadata.productVersion as string;
    try {
      const message = `[TasksManager][publishToMappingServer] Layer ${productId} version ${productVersion}`;
      this.logger.info({
        jobId: jobId,
        productId: productId,
        productVersion: productVersion,
        message: message,
      });

      const publishReq: IPublishMapLayerRequest = {
        name: `${layerName}`,
        tilesPath: relativePath,
        cacheType: this.cacheType,
        format: metadata.tileOutputFormat as TileOutputFormat,
      };
      await this.mapPublisher.publishLayer(publishReq);
    } catch (err) {
      const message = 'Failed to publish layer to mapping server';
      this.logger.error({
        jobId: jobId,
        productId: productId,
        productVersion: productVersion,
        message: message,
      });
      await this.jobManager.updateJobStatus(jobId, OperationStatus.FAILED, undefined, 'Failed to publish layer to mapping server');
      throw err;
    }
  }

  private getCacheType(mapServerCacheType: string): PublishedMapLayerCacheType {
    let cacheType: PublishedMapLayerCacheType;
    switch (mapServerCacheType.toLowerCase()) {
      case MapServerCacheType.S3.toLowerCase(): {
        cacheType = PublishedMapLayerCacheType.S3;
        break;
      }
      case MapServerCacheType.FS.toLowerCase(): {
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
    const abortMessage = `Aborting job with ID ${jobId}, reason: ${reason}`;
    this.logger.info({
      jobId: jobId,
      message: abortMessage
    });
    await this.jobManager.abortJob(jobId);
    const updateJobMessage = `Updating job ${jobId} with status ${OperationStatus.FAILED}`;
    this.logger.info({
      jobId: jobId,
      message: updateJobMessage
    });
    await this.jobManager.updateJobStatus(jobId, OperationStatus.FAILED, undefined, reason);
  }

  private async handleUpdateIngestion(job: ICompletedTasks, task: IGetTaskResponse): Promise<void> {
    if (task.status === OperationStatus.FAILED && job.status !== OperationStatus.FAILED) {
      await this.abortJobWithStatusFailed(job.id, `Failed to update ingestion`);
      job.status = OperationStatus.FAILED;
    } else if (task.status === OperationStatus.COMPLETED) {
      const highestVersion = await this.catalogClient.getHighestLayerVersion(job.metadata.productId as string, job.metadata.productType as string);
      const highestVersionToString = Number.isInteger(highestVersion) ? (highestVersion?.toFixed(1) as string) : String(highestVersion);

      const catalogRecord = await this.catalogClient.findRecord(
        job.metadata.productId as string,
        highestVersionToString,
        job.metadata.productType as string
      );

      const mergedData = this.metadataMerger.merge(catalogRecord?.metadata as LayerMetadata, job.metadata);
      this.logger.debug({
        internalId: catalogRecord?.id,
        metadata: job.metadata,
        message: `Updating catalog record ${catalogRecord?.id as string} with new metadata`,
      });
      await this.catalogClient.update(catalogRecord?.id as string, mergedData);

      if (job.isSuccessful) {
        const message = `Updating status of job ${job.id} to be ${OperationStatus.COMPLETED}`;
        this.logger.info({
          jobId: job.id,
          message: message,
        });
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        await this.jobManager.updateJobStatus(job.id, OperationStatus.COMPLETED, 100, undefined, catalogRecord?.id);
        job.status = OperationStatus.COMPLETED;
      }
    }
  }

  private async handleNewIngestion(job: ICompletedTasks, task: IGetTaskResponse): Promise<void> {
    if (task.status === OperationStatus.FAILED && job.status !== OperationStatus.FAILED) {
      await this.abortJobWithStatusFailed(job.id, `Failed to generate tiles`);
      job.status = OperationStatus.FAILED;
    } else if (job.isSuccessful) {
      const layerName = getMapServingLayerName(job.metadata.productId as string, job.metadata.productType as ProductType);

      this.logger.debug({
        productId: job.metadata.productId,
        productType: job.metadata.productType,
        version: job.metadata.productVersion,
        message: `[TasksManager][handleNewIngestion] Publishing layer name: "${layerName}" in map services`,
      });

      await this.publishToMappingServer(job.id, job.metadata, layerName, job.relativePath);
      const catalogId = await this.publishToCatalog(job.id, job.metadata, layerName);
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      await this.jobManager.updateJobStatus(job.id, OperationStatus.COMPLETED, 100, undefined, catalogId);
      job.status = OperationStatus.COMPLETED;

      if (this.shouldSync) {
        try {
          await this.syncClient.triggerSync(
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
            productId: job.metadata.productId,
            productType: job.metadata.productType,
            version: job.metadata.productVersion,
            message: message,
          });
        }
      }
    }
  }
}
