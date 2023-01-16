import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { BoundCounter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { JobsManager } from '../models/jobsManager';

interface ITaskId {
  jobId: string;
  taskId: string;
}

type CompleteJobHandler = RequestHandler<ITaskId>;

@injectable()
export class JobsController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JobsManager) private readonly manager: JobsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public completeJob: CompleteJobHandler = async (req, res, next) => {
    try {
      await this.manager.completeJob(req.params.jobId, req.params.taskId);
      return res.sendStatus(httpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
