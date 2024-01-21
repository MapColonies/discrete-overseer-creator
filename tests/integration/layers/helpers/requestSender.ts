import * as supertest from 'supertest';

export class LayersRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async createLayer(body: Record<string, unknown>): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/layers').set('Content-Type', 'application/json').send(body);
  }

  public async checkFiles(body: Record<string, unknown>): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/layers/validateSources').set('Content-Type', 'application/json').send(body);
  }
}
