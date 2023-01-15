import { Logger } from '@map-colonies/js-logger';
import { IngestionParams } from '@map-colonies/mc-model-types';
import { Meter } from '@map-colonies/telemetry';
import { BoundCounter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { filterLayerMetadata } from '../../common/utils/ingestionParamExtractor';

import { LayersManager } from '../models/layersManager';

type CreateLayerHandler = RequestHandler<undefined, undefined, IngestionParams>;

@injectable()
export class LayersController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LayersManager) private readonly manager: LayersManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

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
}
