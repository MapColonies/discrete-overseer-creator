import * as supertest from 'supertest';
import { ITocParams } from '../../../../src/toc/interfaces';

export class TocRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getMetadata(body: ITocParams, accept?: string): Promise<supertest.Response> {
    let test = supertest.agent(this.app).post('/toc').set('Content-Type', 'application/json');

    if (accept !== undefined) {
      test = test.set('Accept', accept);
    }

    return test.send(body);
  }
}
