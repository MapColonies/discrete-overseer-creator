import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { BoundCounter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ITocParams, SchemaType } from '../interfaces';
import { TocManager } from '../models/tocManager';

type GetTocHandler = RequestHandler<undefined, string, ITocParams>;

@injectable()
export class TocController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METER) private readonly meter: Meter,
    @inject(TocManager) private readonly manager: TocManager
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public getToc: GetTocHandler = async (req, res, next) => {
    try {
      // Get wanted response type (default is json), only json and xml are supported
      let responseType = req.headers.accept;
      let schemaString = '';

      if (responseType !== SchemaType.XML) {
        responseType = SchemaType.JSON;
        schemaString = await this.manager.getJsonStringLayerToc(req.body);
      } else {
        schemaString = await this.manager.getXmlLayerToc(req.body);
      }

      res.set('Content-Type', responseType);
      return res.status(httpStatus.OK).send(schemaString);
    } catch (err) {
      next(err);
    }
  };
}
