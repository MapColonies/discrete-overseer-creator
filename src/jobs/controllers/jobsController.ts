import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { JobsManager } from '../models/jobsManager';

interface ITaskId {
  jobId: string;
  taskId: string;
}

type CompleteJobHandler = RequestHandler<ITaskId>;

@injectable()
export class JobsController {
  public constructor(@inject(JobsManager) private readonly manager: JobsManager) {}

  public completeJob: CompleteJobHandler = async (req, res, next) => {
    try {
      await this.manager.completeJob(req.params.jobId, req.params.taskId);
      return res.sendStatus(httpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
