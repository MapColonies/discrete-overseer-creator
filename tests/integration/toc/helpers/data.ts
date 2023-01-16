/* eslint-disable @typescript-eslint/no-magic-numbers */
import { LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import xmlbuilder from 'xmlbuilder';
import { IFindResponseRecord } from '../../../../src/common/interfaces';
import { ITocParams, TocOperation } from '../../../../src/toc/interfaces';

export const validTestImageMetadata: IFindResponseRecord = {
  id: '08ec733c-7956-4f82-b51d-a0ddb6ebfcb5',
  metadata: {
    productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    productVersion: '1.23',
    productName: 'test layer',
    description: 'test layer desc',
    minHorizontalAccuracyCE90: 0.7,
    footprint: {
      type: 'Polygon',
      coordinates: [
        [
          [100, 0],
          [101, 0],
          [101, 1],
          [100, 1],
          [100, 0],
        ],
      ],
    },
    scale: 100,
    rms: 2.6,
    maxResolutionDeg: 0.007,
    sensors: ['RGB', 'OTHER'],
    classification: 'test',
    type: RecordType.RECORD_RASTER,
    productType: ProductType.ORTHOPHOTO,
    productSubType: undefined,
    srsId: '4326',
    srsName: 'wgs84',
    producerName: 'testProducer',
    creationDate: new Date('11/16/2017'),
    ingestionDate: new Date('11/16/2017'),
    sourceDateEnd: new Date('11/16/2017'),
    sourceDateStart: new Date('11/16/2017'),
    layerPolygonParts: undefined,
    region: ['testRegion1', 'testRegion2'],
    includedInBests: undefined,
    maxResolutionMeter: 0.2,
    productBoundingBox: undefined,
    rawProductData: undefined,
  } as unknown as LayerMetadata,
};

export const validTestData: ITocParams = {
  operation: TocOperation.ADD,
  productType: ProductType.ORTHOPHOTO_HISTORY,
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  productVersion: '1.23',
};

export const validTestResponseData = {
  operation: TocOperation.ADD,
  productType: ProductType.ORTHOPHOTO_HISTORY,
  metadata: validTestImageMetadata.metadata,
};

// Stringify then parse for placing dates in string
// eslint-disable-next-line
export const validTestJsonResponseData = JSON.parse(JSON.stringify(validTestResponseData));

export const validTestXmlResponseData = xmlbuilder.create(validTestResponseData, { version: '1.0', encoding: 'UTF-8' }).end({ pretty: true });

export const invalidTestData = {
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
} as unknown as ITocParams;
