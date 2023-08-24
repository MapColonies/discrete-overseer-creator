import { Logger } from '@map-colonies/js-logger';
import { Polygon } from '@turf/helpers';
import { IngestionParams } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import client from 'prom-client';
import { TileRanger, tileToBbox } from '@map-colonies/mc-utils';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { ITaskParameters } from '../interfaces';
import { ITaskZoomRange } from '../../jobs/interfaces';
import { JobManagerWrapper } from '../../serviceClients/JobManagerWrapper';

@injectable()
export class SplitTilesTasker {
  private readonly bboxSizeTiles: number;
  private readonly tasksBatchSize: number;

  //metrics
  private readonly fillSplitterTaskBatch?: client.Histogram<'operationType' | 'configurationBatchSize'>;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly jobManagerClient: JobManagerWrapper,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    this.bboxSizeTiles = config.get<number>('ingestionTilesSplittingTiles.bboxSizeTiles');
    this.tasksBatchSize = config.get<number>('ingestionTilesSplittingTiles.tasksBatchSize');

    if (registry !== undefined) {
      this.fillSplitterTaskBatch = new client.Histogram({
        name: 'fill_batch_tasks_splitter_duration',
        help: 'time taken to fill each task batch as part of splitter task',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['operationType', 'configurationBatchSize'] as const,
        registers: [registry],
      });
    }
  }

  public async createSplitTilesTasks(
    data: IngestionParams,
    layerRelativePath: string,
    layerZoomRanges: ITaskZoomRange[],
    jobType: string,
    taskType: string
  ): Promise<string> {
    const taskParams = this.generateTasksParameters(data, layerRelativePath, layerZoomRanges);
    let taskBatch: ITaskParameters[] = [];
    let jobId: string | undefined = undefined;

    let fetchTimerTaskBatchFill = this.fillSplitterTaskBatch?.startTimer({
      operationType: 'taskBatchFill',
      configurationBatchSize: this.tasksBatchSize,
    });
    for await (const task of taskParams) {
      taskBatch.push(task);

      if (taskBatch.length === this.tasksBatchSize) {
        if (fetchTimerTaskBatchFill) {
          fetchTimerTaskBatchFill();
        }
        fetchTimerTaskBatchFill = this.fillSplitterTaskBatch?.startTimer({
          operationType: 'taskBatchFill',
          configurationBatchSize: this.tasksBatchSize,
        });

        if (jobId === undefined) {
          jobId = await this.jobManagerClient.createLayerJob(data, layerRelativePath, jobType, taskType, taskBatch);
        } else {
          // eslint-disable-next-line no-useless-catch
          try {
            await this.jobManagerClient.createTasks(jobId, taskBatch, taskType);
          } catch (err) {
            //TODO: properly handle errors
            await this.jobManagerClient.updateJobById(jobId, OperationStatus.FAILED);
            throw err;
          }
        }
        taskBatch = [];
      }
    }
    if (taskBatch.length !== 0) {
      if (jobId === undefined) {
        jobId = await this.jobManagerClient.createLayerJob(data, layerRelativePath, jobType, taskType, taskBatch);
      } else {
        // eslint-disable-next-line no-useless-catch
        try {
          await this.jobManagerClient.createTasks(jobId, taskBatch, taskType);
          if (fetchTimerTaskBatchFill) {
            fetchTimerTaskBatchFill();
          }
        } catch (err) {
          //TODO: properly handle errors
          await this.jobManagerClient.updateJobById(jobId, OperationStatus.FAILED);
          throw err;
        }
      }
    }
    return jobId as string;
  }

  public async *generateTasksParameters(
    data: IngestionParams,
    layerRelativePath: string,
    zoomRanges: ITaskZoomRange[]
  ): AsyncGenerator<ITaskParameters> {
    const ranger = new TileRanger();
    for (const zoomRange of zoomRanges) {
      const zoom = this.getZoom(zoomRange.maxZoom);
      const tileGen = ranger.generateTiles(data.metadata.footprint as Polygon, zoom);
      for await (const tile of tileGen) {
        yield {
          discreteId: data.metadata.productId as string,
          version: data.metadata.productVersion as string,
          originDirectory: data.originDirectory,
          minZoom: zoomRange.minZoom,
          maxZoom: zoomRange.maxZoom,
          layerRelativePath: layerRelativePath,
          bbox: tileToBbox(tile),
        };
      }
    }
  }

  /**
   * this function calculate the zoom level where tile contains the maximum amount of tiles
   * in "maxRequestedZoom" that is smaller or equels to the configured value "bboxSizeTiles"
   * @param maxRequestedZoom task maximum tile`s zoom
   * @returns optimized zoom level for bbox equivalent tile
   */
  private getZoom(maxRequestedZoom: number): number {
    /* eslint-disable @typescript-eslint/no-magic-numbers */
    const diff = Math.max(0, Math.floor(Math.log2(this.bboxSizeTiles >> 1) >> 1));
    return Math.max(0, maxRequestedZoom - diff);
    /* eslint-enable @typescript-eslint/no-magic-numbers */
  }
}
