import { Logger } from '@map-colonies/js-logger';
import { IRasterCatalogUpsertRequestBody, LayerMetadata } from '@map-colonies/mc-model-types';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { FindRecordResponse, IConfig, IFindResponseRecord, IUpdateRecordResponse } from '../common/interfaces';
import { SERVICES } from '../common/constants';

interface ICreateRecordResponse {
  id: string;
  taskIds: string[];
}

@injectable()
export class CatalogClient extends HttpClient {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    super(
      logger,
      config.get<string>('catalogPublishingServiceURL'),
      'CatalogClient',
      config.get<IHttpRetryConfig>('httpRetry'),
      config.get<boolean>('disableHttpClientLogs')
    );
  }

  @withSpanAsyncV4
  public async findRecord(productId: string, productVersion?: string, productType?: string): Promise<IFindResponseRecord | undefined> {
    const req = {
      metadata: {
        productId,
        productVersion,
        productType,
      },
    };

    // Get product information
    const res = await this.post<FindRecordResponse>('/records/find', req);
    // Check if product exists with given version
    if (res.length == 0) {
      return undefined;
    }

    // Return metadata
    return res[0];
  }

  @withSpanAsyncV4
  public async exists(productId: string, productVersion?: string, productType?: string): Promise<boolean> {
    const req = {
      metadata: {
        productId,
        productVersion,
        productType,
      },
    };
    const res = await this.post<FindRecordResponse>('/records/find', req);
    return res.length > 0;
  }

  @withSpanAsyncV4
  public async existsByRecordId(recordId: string): Promise<boolean> {
    const res = await this.get<boolean>(`/records/exists/${recordId}`);

    return res;
  }

  @withSpanAsyncV4
  public async publish(record: IRasterCatalogUpsertRequestBody): Promise<string> {
    const res = await this.post<ICreateRecordResponse>('/records', record);
    return res.id;
  }

  @withSpanAsyncV4
  public async update(id: string, metadata: LayerMetadata): Promise<IUpdateRecordResponse> {
    const req = {
      metadata,
    };

    const res = await this.put<IUpdateRecordResponse>(`/records/${id}`, req);
    return res;
  }

  @withSpanAsyncV4
  public async getHighestLayerVersion(productId: string, productType: string): Promise<number | undefined> {
    this.logger.debug({
      productId,
      productType,
      msg: `[getHighestLayerVersion] request highest version for productId: ${productId} productType: ${productType}`,
    });
    const existsLayerVersions = await this.getLayerVersions(productId, productType);
    if (Array.isArray(existsLayerVersions) && existsLayerVersions.length > 0) {
      const highestExistsLayerVersion = Math.max(...existsLayerVersions);
      this.logger.debug({
        productId,
        productType,
        msg: `[getHighestLayerVersion] highest version for productId: ${productId} productType: ${productType} was ${highestExistsLayerVersion}`,
      });
      return highestExistsLayerVersion;
    }
    this.logger.debug({
      productId,
      productType,
      msg: `[getHighestLayerVersion] highest version for productId: ${productId} productType: ${productType} was undefined`,
    });
    return undefined;
  }

  @withSpanAsyncV4
  private async getLayerVersions(productId: string, productType: string): Promise<number[] | undefined> {
    const req = {
      metadata: {
        productId,
        productType,
      },
    };
    const res = await this.post<string[]>('/records/find/versions', req);
    const layerVersions = res.map((str) => {
      return Number(str);
    });

    return layerVersions;
  }
}
