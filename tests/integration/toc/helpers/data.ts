/* eslint-disable @typescript-eslint/no-magic-numbers */
import { LayerMetadata, RecordType, SensorType } from '@map-colonies/mc-model-types';
import xmlbuilder from 'xmlbuilder';
import { ITocParams, TocOperation, TocSourceType } from '../../../../src/toc/interfaces';

export const validTestImageMetadata: LayerMetadata = {
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  productVersion: '1.234.5',
  productName: 'test layer',
  description: 'test layer desc',
  accuracyCE90: 0.7,
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
  scale: '3.5',
  rms: 2.6,
  updateDate: new Date('11/16/2017'),
  resolution: 0.7,
  sensorType: [SensorType.RGB],
  classification: 'test',
  type: RecordType.RECORD_RASTER,
  productType: 'orthophoto',
  srsId: 'EPSG:4326',
  srsName: 'wgs84',
  producerName: 'testProducer',
  creationDate: new Date('11/16/2017'),
  ingestionDate: new Date('11/16/2017'),
  sourceDateEnd: new Date('11/16/2017'),
  sourceDateStart: new Date('11/16/2017'),
  layerPolygonParts: undefined,
  region: '',
};

export const validTestData: ITocParams = {
  operation: TocOperation.ADD,
  sourceType: TocSourceType.BSETMOSAIC,
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  productVersion: '1.234.5',
};

export const validTestResponseData = {
  operation: TocOperation.ADD,
  sourceType: TocSourceType.BSETMOSAIC,
  metadata: validTestImageMetadata,
};

// Stringify then parse for placing dates in string
// eslint-disable-next-line
export const validTestJsonResponseData = JSON.parse(JSON.stringify(validTestResponseData));

export const validTestXmlResponseData = xmlbuilder.create(validTestResponseData, { version: '1.0', encoding: 'UTF-8' }).end({ pretty: true });

export const invalidTestData = ({
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
} as unknown) as ITocParams;
