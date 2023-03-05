import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { ITocParams, SchemaType } from '../interfaces';
import { TocManager } from '../models/tocManager';

type GetTocHandler = RequestHandler<undefined, string, ITocParams>;

@injectable()
export class TocController {
  public constructor(@inject(TocManager) private readonly manager: TocManager) {}

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
