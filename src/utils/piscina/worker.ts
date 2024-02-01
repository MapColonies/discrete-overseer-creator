import 'reflect-metadata';
import config from "config";
import jsLogger from '@map-colonies/js-logger';
import { BBox } from "@turf/turf";
import { trace } from "@opentelemetry/api";
import { IngestionParams } from "@map-colonies/mc-model-types";
import { MergeTilesTasker } from "../../merge/mergeTilesTasker";
import { JobManagerWrapper } from "../../serviceClients/JobManagerWrapper";
import { ICleanupData } from "../../common/interfaces";
import { Grid } from "../../layers/interfaces";
import { SERVICE_NAME } from '../../common/constants';

// eslint-disable-next-line import/exports-last
export interface IMergeTilesTaskParams {
    data: IngestionParams;
    layerRelativePath: string;
    taskType: string;
    jobType: string;
    grids: Grid[];
    extent: BBox;
    managerCallbackUrl: string;
    isNew?: boolean;
    cleanupData?: ICleanupData;
}

const createMergeTilesTasks = async (params: IMergeTilesTaskParams): Promise<string> => {
    const logger = jsLogger({ enabled: true });
    const tracer = trace.getTracer(SERVICE_NAME);

    const jobManager = new JobManagerWrapper(config, logger, tracer);
    const mergeTilesTasker = new MergeTilesTasker(config, logger, tracer, jobManager);
    const jobId = await mergeTilesTasker.createMergeTilesTasks(
        params.data,
        params.layerRelativePath,
        params.taskType,
        params.jobType,
        params.grids,
        params.extent,
        params.managerCallbackUrl,
        true,
        undefined,
    );
    return jobId
}
createMergeTilesTasks.mergeTiles = createMergeTilesTasks;
module.exports = createMergeTilesTasks;