/* eslint-disable @typescript-eslint/no-magic-numbers */
import { LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import { Footprint } from '@map-colonies/mc-utils';
import { intersect } from '@turf/turf';

const worldGeometry: Footprint = {
  type: 'Polygon',
  coordinates: [
    [
      [-180, -90],
      [-180, 90],
      [180, 90],
      [180, -90],
      [-180, -90],
    ],
  ],
};

const europeGeometry: Footprint = {
  type: 'Polygon',
  coordinates: [
    [
      [26.229837467420225, 51.912834376940765],
      [22.5313965395448, 51.912834376940765],
      [22.5313965395448, 49.43454673640505],
      [26.229837467420225, 49.43454673640505],
      [26.229837467420225, 51.912834376940765],
    ],
  ],
};

const africaGeometry: Footprint = {
  type: 'Polygon',
  coordinates: [
    [
      [21.787623449394744, 14.246536728675196],
      [15.485078710132626, 14.246536728675196],
      [15.485078710132626, 8.2708698625367],
      [21.787623449394744, 8.2708698625367],
      [21.787623449394744, 14.246536728675196],
    ],
  ],
};

const staticIngestionNewMetadata = {
  id: 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23',
  productId: 'test',
  productVersion: '1.0',
  productName: 'test name',
  description: 'test desc',
  minHorizontalAccuracyCE90: 3,
  maxResolutionDeg: 0.001373291015625,
  rms: 0.5,
  scale: 3,
  sensors: ['OTHER', 'Test'],
  footprint: worldGeometry,
  classification: '',
  creationDate: new Date('02/01/2020'),
  producerName: 'testProducer',
  productType: ProductType.ORTHOPHOTO_HISTORY,
  productSubType: undefined,
  region: ['testRegion1', 'testRegion2'],
  sourceDateEnd: new Date('06/01/2020'),
  sourceDateStart: new Date('05/01/2020'),
  srsId: '4326',
  srsName: 'WGS84GEO',
  type: RecordType.RECORD_RASTER,
  includedInBests: undefined,
  maxResolutionMeter: 0.2,
  productBoundingBox: undefined,
  rawProductData: undefined,
} as unknown as LayerMetadata;

const staticIngestionUpdateMetadata = {
  id: 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23',
  productId: 'test',
  productVersion: '2.0',
  productName: 'test name',
  description: 'test desc',
  minHorizontalAccuracyCE90: 3,
  maxResolutionDeg: 0.001373291015625,
  rms: 0.5,
  scale: 3,
  sensors: ['OTHER', 'Test'],
  footprint: {
    type: 'Polygon',
    coordinates: [
      [
        [34.91692694458297, 33.952927285465876],
        [34.90156677832806, 32.42331628696577],
        [36.23406120090846, 32.410349688281244],
        [36.237901242471565, 33.96885230417779],
        [34.91692694458297, 33.952927285465876],
      ],
    ],
  },
  classification: '',
  creationDate: new Date('02/01/2020'),
  producerName: 'testProducer',
  productType: ProductType.ORTHOPHOTO_HISTORY,
  productSubType: undefined,
  region: ['testRegion1', 'testRegion2'],
  sourceDateEnd: new Date('06/01/2020'),
  sourceDateStart: new Date('05/01/2020'),
  srsId: '4326',
  srsName: 'WGS84GEO',
  type: RecordType.RECORD_RASTER,
  includedInBests: undefined,
  maxResolutionMeter: 0.2,
  productBoundingBox: undefined,
  rawProductData: undefined,
} as unknown as LayerMetadata;

const intersectedGeometryNewUpdate = intersect(
  staticIngestionUpdateMetadata.footprint as Footprint,
  staticIngestionNewMetadata.footprint as Footprint
)?.geometry as Footprint;

export { staticIngestionNewMetadata, staticIngestionUpdateMetadata, intersectedGeometryNewUpdate, worldGeometry, europeGeometry, africaGeometry };
