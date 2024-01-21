import "reflect-metadata";
import { join } from 'path';
import { degreesPerPixelToZoomLevel, Footprint, multiIntersect, subGroupsGen, tileBatchGenerator, TileRanger } from '@map-colonies/mc-utils';
import { IngestionParams, TileOutputFormat } from '@map-colonies/mc-model-types';
import { difference, union, Feature, Polygon, BBox } from '@turf/turf';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import client from 'prom-client';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../common/constants';
import { ICleanupData, IConfig, ILayerMergeData, IMergeOverlaps, IMergeParameters, IMergeSources, IMergeTaskParams } from '../common/interfaces';
import { Grid } from '../layers/interfaces';
import { JobManagerWrapper } from '../serviceClients/JobManagerWrapper';

@injectable()
// eslint-disable-next-line import/exports-last
export class MergeTilesTasker {
  private readonly tileRanger: TileRanger;
  private readonly batchSize: number;
  private readonly mergeTaskBatchSize: number;

  //metrics
  private readonly fillMergeTaskBatch?: client.Histogram<'operationType' | 'configurationBatchSize'>;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly jobManagerClient: JobManagerWrapper,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    this.batchSize = this.config.get('ingestionMergeTiles.mergeBatchSize');
    this.mergeTaskBatchSize = this.config.get<number>('ingestionMergeTiles.tasksBatchSize');
    this.tileRanger = new TileRanger();

    if (registry !== undefined) {
      this.fillMergeTaskBatch = new client.Histogram({
        name: 'fill_batch_tasks_merging_duration',
        help: 'time taken to fill each task batch as part of merge task',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['operationType', 'configurationBatchSize'] as const,
        registers: [registry],
      });
    }
  }

  @withSpanAsyncV4
  public async createMergeTilesTasks(
    data: IngestionParams,
    layerRelativePath: string,
    taskType: string,
    jobType: string,
    grids: Grid[],
    extent: BBox,
    managerCallbackUrl: string,
    isNew?: boolean,
    cleanupData?: ICleanupData
  ): Promise<string> {
    console.log("DATA", data)
    const layers = data.fileNames.map<ILayerMergeData>((fileName) => {
      console.log("####",fileName)
      const fileRelativePath = join(data.originDirectory, fileName);
      const footprint = data.metadata.footprint;
      return {
        fileName: fileName,
        tilesPath: fileRelativePath,
        footprint: footprint,
      };
    });
    const maxZoom = degreesPerPixelToZoomLevel(data.metadata.maxResolutionDeg as number);
    const params: IMergeParameters = {
      layers: layers,
      destPath: layerRelativePath,
      maxZoom: maxZoom,
      grids: grids,
      extent,
      targetFormat: data.metadata.tileOutputFormat as TileOutputFormat,
    };
    const mergeTasksParams = this.createBatchedTasks(params, isNew);
    let mergeTaskBatch: IMergeTaskParams[] = [];
    let jobId: string | undefined = undefined;

    let fetchTimerTaskBatchFill = this.fillMergeTaskBatch?.startTimer({
      operationType: 'taskBatchFill',
      configurationBatchSize: this.mergeTaskBatchSize,
    });

    for await (const mergeTask of mergeTasksParams) {
      mergeTaskBatch.push(mergeTask);
      if (mergeTaskBatch.length === this.mergeTaskBatchSize) {
        if (fetchTimerTaskBatchFill) {
          fetchTimerTaskBatchFill();
        }
        fetchTimerTaskBatchFill = this.fillMergeTaskBatch?.startTimer({
          operationType: 'taskBatchFill',
          configurationBatchSize: this.mergeTaskBatchSize,
        });
        if (jobId === undefined) {
          jobId = await this.jobManagerClient.createLayerJob(
            data,
            layerRelativePath,
            jobType,
            taskType,
            mergeTaskBatch,
            managerCallbackUrl,
            cleanupData
          );
        } else {
          try {
            await this.jobManagerClient.createTasks(jobId, mergeTaskBatch, taskType);
          } catch (err) {
            await this.jobManagerClient.updateJobById(jobId, OperationStatus.FAILED);
            throw err;
          }
        }
        mergeTaskBatch = [];
      }
    }
    if (mergeTaskBatch.length !== 0) {
      if (jobId === undefined) {
        jobId = await this.jobManagerClient.createLayerJob(
          data,
          layerRelativePath,
          jobType,
          taskType,
          mergeTaskBatch,
          managerCallbackUrl,
          cleanupData
        );
      } else {
        // eslint-disable-next-line no-useless-catch
        try {
          await this.jobManagerClient.createTasks(jobId, mergeTaskBatch, taskType);

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

  private *createLayerOverlaps(layers: ILayerMergeData[]): Generator<IMergeOverlaps> {
    let totalIntersection = undefined;
    const subGroups = subGroupsGen(layers, layers.length);
    for (const subGroup of subGroups) {
      const subGroupFootprints = subGroup.map((layer) => layer.footprint as Footprint);
      try {
        let intersection = multiIntersect(subGroupFootprints);
        if (intersection === null) {
          continue;
        }
        if (totalIntersection === undefined) {
          totalIntersection = intersection;
        } else {
          intersection = difference(intersection, totalIntersection as Footprint);
          if (intersection === null) {
            continue;
          }
          totalIntersection = union(totalIntersection as Footprint, intersection);
        }
        const task: IMergeOverlaps = {
          intersection,
          layers: subGroup,
        };
        yield task;
      } catch (err) {
        const error = err as Error;
        const message = `failed to calculate overlaps, error: ${error.message}, failing footprints: ${JSON.stringify(subGroupFootprints)}`;
        this.logger.error({
          subGroupFootprints: subGroupFootprints,
          msg: message,
          err: err,
        });
        throw err;
      }
    }
  }

  private async *createBatchedTasks(params: IMergeParameters, isNew = false): AsyncGenerator<IMergeTaskParams> {
    const sourceType = this.config.get<string>('mapServerCacheType');
    for (let zoom = params.maxZoom; zoom >= 0; zoom--) {
      const mappedLayers = params.layers.map((layer) => {
        return {
          fileName: layer.fileName,
          tilesPath: layer.tilesPath,
          footprint: layer.footprint,
        };
      });

      // TODO: as we send the original footprints (instead of BBOX) some tiles can be repeated in several groups (if order matters between sources they should be ingested separatedly)
      const overlaps = this.createLayerOverlaps(mappedLayers);
      for (const overlap of overlaps) {
        const rangeGen = this.tileRanger.encodeFootprint(overlap.intersection as Feature<Polygon>, zoom);
        const batches = tileBatchGenerator(this.batchSize, rangeGen);
        for await (const batch of batches) {
          yield {
            targetFormat: params.targetFormat,
            isNewTarget: isNew,
            batches: batch,
            sources: [
              {
                type: sourceType,
                path: params.destPath,
              },
            ].concat(
              overlap.layers.map<IMergeSources>((layer, index) => {
                const filenameExtension = layer.fileName.split('.').pop() as string;
                const sourceParams: IMergeSources = {
                  type: filenameExtension.toUpperCase(),
                  path: layer.tilesPath,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  grid: params.grids[index],
                  extent: {
                    minX: params.extent[0],
                    minY: params.extent[1],
                    maxX: params.extent[2],
                    maxY: params.extent[3],
                  },
                };
                return sourceParams;
              })
            ),
          };
        }
      }
    }
  }
}