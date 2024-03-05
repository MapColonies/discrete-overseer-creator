import { Logger } from '@map-colonies/js-logger';
import { NotFoundError } from '@map-colonies/error-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { IGetCacheRequest, IGetCacheResponse, IPublishMapLayerRequest } from '../layers/interfaces';

@injectable()
export class MapPublisherClient extends HttpClient {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    super(
      logger,
      config.get<string>('mapPublishingServiceURL'),
      'LayerPublisher',
      config.get<IHttpRetryConfig>('httpRetry'),
      config.get<boolean>('disableHttpClientLogs')
    );
  }

  @withSpanAsyncV4
  public async publishLayer(publishReq: IPublishMapLayerRequest): Promise<IPublishMapLayerRequest> {
    const saveMetadataUrl = '/layer';
    return this.post(saveMetadataUrl, publishReq);
  }

  @withSpanAsyncV4
  public async updateLayer(updateReq: IPublishMapLayerRequest): Promise<IPublishMapLayerRequest> {
    const saveMetadataUrl = `/layer/${updateReq.name}`;
    return this.put(saveMetadataUrl, updateReq);
  }

  @withSpanAsyncV4
  public async getCacheByNameType(getCacheReq: IGetCacheRequest): Promise<string | undefined> {
    const getCacheUrl = `/layer/${getCacheReq.layerName}/${getCacheReq.cacheType}`;
    try {
      const res: IGetCacheResponse = await this.get(getCacheUrl);
      this.logger.debug({ msg: `received cache from mapproxy`, res });
      return res.cacheName;
    } catch (err) {
      this.logger.error({ msg: `Failed on getting cache from mapproxy`, getCacheReq, err });
      if (err instanceof NotFoundError) {
        return undefined;
      } else {
        throw err;
      }
    }
  }

  @withSpanAsyncV4
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
