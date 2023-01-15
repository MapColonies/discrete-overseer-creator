import { NotFoundError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import XmlBuilder from 'xmlbuilder';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { CatalogClient } from '../../serviceClients/catalogClient';
import { ITocParams, TocOperation } from '../interfaces';

@injectable()
export class TocManager {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly client: CatalogClient
  ) {}

  public async getXmlLayerToc(params: ITocParams): Promise<string> {
    const toc = await this.getTocObject(params);
    const xmlString = XmlBuilder.create(toc, { version: '1.0', encoding: 'UTF-8' }).end({ pretty: true });
    return xmlString;
  }

  public async getJsonStringLayerToc(params: ITocParams): Promise<string> {
    const toc = await this.getTocObject(params);
    return JSON.stringify(toc);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private async getTocObject(params: ITocParams): Promise<Record<string, Object>> {
    let metadata = {};

    if (params.operation != TocOperation.REMOVE) {
      // Get metadata
      const data = await this.client.findRecord(params.productId, params.productVersion, params.productType);
      if (data === undefined) {
        throw new NotFoundError(
          `record not found in catalog with params: productType: ${params.productType}, productId: ${params.productId}, productVersion: ${params.productVersion}`
        );
      }
      metadata = data.metadata;
    } else {
      metadata = {
        productId: params.productId,
        productVersion: params.productVersion,
      };
    }

    return {
      operation: params.operation,
      productType: params.productType,
      metadata,
    };
  }
}
