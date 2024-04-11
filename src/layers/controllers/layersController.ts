import { IngestionParams } from '@map-colonies/mc-model-types';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SourcesValidationParams, SourcesValidationResponse, SourcesInfoRequest } from '../interfaces';
import { filterLayerMetadata } from '../../common/utils/ingestionParamExtractor';

import { LayersManager } from '../models/layersManager';
import { InfoData } from '../../utils/interfaces';

type CreateLayerHandler = RequestHandler<undefined, undefined, IngestionParams>;
type CheckFilesHandler = RequestHandler<undefined, SourcesValidationResponse, SourcesValidationParams>;
type GetSourcesInfoHandler = RequestHandler<undefined, InfoData[], SourcesInfoRequest>;

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

  public validateSources: CheckFilesHandler = async (req, res, next) => {
    try {
      const sourceRequest: SourcesValidationParams = {
        originDirectory: req.body.originDirectory,
        fileNames: req.body.fileNames,
      };
      const filesCheckResponse: SourcesValidationResponse = await this.manager.checkFiles(sourceRequest);
      res.status(httpStatus.OK).send(filesCheckResponse);
    } catch (err) {
      next(err);
    }
  };

  public getSourcesGdalInfo: GetSourcesInfoHandler = async (req, res, next) => {
    try {
      const sourceRequest: SourcesValidationParams = {
        originDirectory: req.body.originDirectory,
        fileNames: req.body.fileNames,
      };
      const info: InfoData[] = await this.manager.getFilesInfo(sourceRequest);
      res.status(httpStatus.OK).send(info);
    } catch (err) {
      next(err);
    }
  };
}
