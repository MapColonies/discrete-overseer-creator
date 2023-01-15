import { Logger } from '@map-colonies/js-logger';
import { ProductType } from '@map-colonies/mc-model-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';

export interface ISyncClientRequest {
  resourceId: string;
  version: string;
  operation: OperationTypeEnum;
  productType: ProductType;
  layerRelativePath: string;
}

export enum OperationTypeEnum {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  REMOVE = 'REMOVE',
}

@injectable()
export class SyncClient extends HttpClient {
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    super(logger, config.get<string>('syncServiceURL'), 'Synchronization', config.get<IHttpRetryConfig>('httpRetry'));
  }

  public async triggerSync(
    resourceId: string,
    version: string,
    productType: ProductType,
    operation: OperationTypeEnum,
    layerRelativePath: string
  ): Promise<void> {
    this.logger.info(`[SyncClient][triggerSync] resourceId=${resourceId}, version=${version}, productType=${productType}`);
    const createSyncRequest: ISyncClientRequest = {
      resourceId,
      version,
      productType,
      operation,
      layerRelativePath,
    };
    await this.post(`/synchronize/trigger`, createSyncRequest);
  }
}
