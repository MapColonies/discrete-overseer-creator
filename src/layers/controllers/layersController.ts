import { IngestionParams } from '@map-colonies/mc-model-types';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { UpdateParams } from '../../common/interfaces';
import { filterLayerMetadata } from '../../common/utils/ingestionParamExtractor';

import { LayersManager } from '../models/layersManager';

type CreateLayerHandler = RequestHandler<undefined, undefined, IngestionParams>;
type UpdateLayerHandler = RequestHandler<{recordId: string}, undefined, UpdateParams>;

@injectable()
export class LayersController {
  public constructor(@inject(LayersManager) private readonly manager: LayersManager) {}

  public createLayer: CreateLayerHandler = async (req, res, next) => {
    const hostUrl = req.get('host') as string;
    const overseerUrl = `${req.protocol}://${hostUrl}`;

    try {
      const sourceRequest: IngestionParams = {
        metadata: filterLayerMetadata(req.body.metadata),
        originDirectory: req.body.originDirectory,
        fileNames: req.body.fileNames,
      };
      await this.manager.createLayer(sourceRequest, overseerUrl);
      return res.sendStatus(httpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  public updateLayer: UpdateLayerHandler = async (req, res, next) => {
    const hostUrl = req.get('host') as string;
    const overseerUrl = `${req.protocol}://${hostUrl}`;
    console.log('----------------------')
    console.log('****************', req.params.recordId)
    try {
      const sourceRequest: UpdateParams = { //todo - replace interface on future from mc-models
        partData: req.body.partData ,
        originDirectory: req.body.originDirectory,
        fileNames: req.body.fileNames,
      };
      await new Promise<number>(resolve => {
        setTimeout(() => {
            resolve(7);
        }, 10);
    });

    console.log(sourceRequest)
      // await this.manager.createLayer(sourceRequest, overseerUrl);
      return res.sendStatus(httpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
