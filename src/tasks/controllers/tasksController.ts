import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { BoundCounter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { TasksManager } from '../models/tasksManager';

interface ITaskId {
  jobId: string;
  taskId: string;
}

type CompleteWorkerTaskHandler = RequestHandler<ITaskId>;

@injectable()
export class TasksController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(TasksManager) private readonly manager: TasksManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public completeWorkerTask: CompleteWorkerTaskHandler = async (req, res, next) => {
    try {
      await this.manager.taskComplete(req.params.jobId, req.params.taskId);
      return res.sendStatus(httpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
