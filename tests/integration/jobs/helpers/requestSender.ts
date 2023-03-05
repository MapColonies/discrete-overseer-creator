import * as supertest from 'supertest';

export class JobsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async completeJob(jobId: string, taskId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/jobs/${jobId}/${taskId}/completed`).set('Content-Type', 'application/json');
  }
}
