
import 'reflect-metadata';
import config from "config";
import { container } from "tsyringe";
import jsLogger, { Logger } from '@map-colonies/js-logger';
import { JobManagerClient } from "@map-colonies/mc-priority-queue";
import { BBox } from "@turf/turf";
import { Tracer, trace } from "@opentelemetry/api";
import { IngestionParams } from "@map-colonies/mc-model-types";
import { SERVICES } from "../../common/constants";
import {MergeTilesTasker} from "../../merge/mergeTilesTasker";
import { JobManagerWrapper } from "../../serviceClients/JobManagerWrapper";
import { ICleanupData } from "../../common/interfaces";
import { Grid } from "../../layers/interfaces";

type IParams = {
    tracer: Tracer
    data: IngestionParams,
    layerRelativePath: string,
    taskType: string,
    jobType: string,
    grids: Grid[],
    extent: BBox,
    managerCallbackUrl: string,
    isNew?: boolean,
    cleanupData?: ICleanupData
}
const test2 = async (params: IParams): Promise<string> => {
    //const tracer = trace.getTracer('AVI_LO_MESHANE_MA');
    const mergeTilesTasker = new MergeTilesTasker(config, jsLogger({ enabled: true}), params.tracer, new JobManagerWrapper(config, jsLogger({ enabled: false}), params.tracer));
    const jobId = await mergeTilesTasker.createMergeTilesTasks(
        params.data,
        params.layerRelativePath,
        params.taskType,
        params.jobType,
        params.grids,
        params.extent,
        params.managerCallbackUrl,
        true
      );
    return jobId
}

module.exports = test2;