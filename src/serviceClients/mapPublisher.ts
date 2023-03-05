import { Logger } from '@map-colonies/js-logger';
import { NotFoundError } from '@map-colonies/error-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { IPublishMapLayerRequest } from '../layers/interfaces';

@injectable()
export class MapPublisherClient extends HttpClient {
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    super(logger, config.get<string>('mapPublishingServiceURL'), 'LayerPublisher', config.get<IHttpRetryConfig>('httpRetry'));
  }

  public async publishLayer(publishReq: IPublishMapLayerRequest): Promise<IPublishMapLayerRequest> {
    const saveMetadataUrl = '/layer';
    return this.post(saveMetadataUrl, publishReq);
  }

  public async exists(name: string): Promise<boolean> {
    const saveMetadataUrl = `/layer/${encodeURIComponent(name)}`;
    try {
      await this.get(saveMetadataUrl);
      return true;
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false;
      } else {
        throw err;
      }
    }
  }
}
