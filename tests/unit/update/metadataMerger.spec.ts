import { bboxPolygon, featureCollection, polygon } from '@turf/turf';
import { LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import { MetadataMerger } from '../../../src/update/metadataMerger';

describe('MetadataMerger', () => {
  let merger: MetadataMerger;

  const baseFootprint = bboxPolygon([0, 0, 5, 5]);
  delete baseFootprint.bbox;
  const basePolygonParts = featureCollection([
    bboxPolygon([0, 0, 4, 5], {
      properties: {
        test: '1',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'RGB',
      },
    }),
    bboxPolygon([4, 0, 5, 4], {
      properties: {
        test: '2',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'Pan_Sharpen',
      },
    }),
    bboxPolygon([4, 4, 5, 5], {
      properties: {
        test: '3',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'excluded',
      },
    }),
  ]);
  basePolygonParts.features.forEach((feat) => {
    delete feat.bbox;
  });
  const baseRawProductData = featureCollection([bboxPolygon([0, 0, 5, 5])]);
  const baseMetadata = {
    minHorizontalAccuracyCE90: 5,
    classification: '4',
    creationDate: new Date(1, 1, 1),
    description: 'test',
    footprint: baseFootprint,
    includedInBests: [],
    ingestionDate: new Date(2022, 1, 1),
    layerPolygonParts: basePolygonParts,
    maxResolutionMeter: 777,
    producerName: 'tester',
    productBoundingBox: '0,0,5,5',
    productId: 'testId',
    productName: 'test',
    productSubType: 'data',
    productType: ProductType.ORTHOPHOTO,
    productVersion: '1.0',
    rawProductData: baseRawProductData,
    region: ['r1', 'r2', 'r3'],
    maxResolutionDeg: 0.072,
    sensors: ['RGB', 'Pan_Sharpen', 'excluded'],
    sourceDateEnd: new Date(1, 1, 1),
    sourceDateStart: new Date(1, 1, 1),
    srsId: 'EPSG:4326',
    srsName: 'wgs84',
    type: RecordType.RECORD_RASTER,
    rms: undefined,
    scale: undefined,
  } as unknown as LayerMetadata;

  const updateFootprint = bboxPolygon([4, 3, 7, 7]);
  delete updateFootprint.bbox;
  const updatePolygonParts = featureCollection([
    bboxPolygon([4, 4, 7, 7], {
      properties: {
        test: '4',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'VIS',
      },
    }),
  ]);
  updatePolygonParts.features.forEach((feat) => {
    delete feat.bbox;
  });
  const updateRawProductData = featureCollection([bboxPolygon([4, 4, 7, 7])]);
  const updateMetadata = {
    minHorizontalAccuracyCE90: 3,
    classification: '6',
    creationDate: new Date(2, 1, 1),
    description: 'test',
    footprint: updateFootprint,
    includedInBests: [],
    layerPolygonParts: updatePolygonParts,
    maxResolutionMeter: 500,
    producerName: 'tester',
    productBoundingBox: '4,4,7,7',
    productId: 'testId',
    productName: 'test',
    productSubType: 'data',
    productType: ProductType.ORTHOPHOTO,
    productVersion: '2.0',
    rawProductData: updateRawProductData,
    region: ['r1', 'r4'],
    maxResolutionDeg: 0.0072,
    sensors: ['RGB', 'VIS'],
    sourceDateEnd: new Date(2, 1, 1),
    sourceDateStart: new Date(2, 1, 1),
    srsId: 'EPSG:4326',
    srsName: 'wgs84',
    type: RecordType.RECORD_RASTER,
    rms: undefined,
    scale: undefined,
  } as unknown as LayerMetadata;

  const expectedFootprint = polygon([
    [
      [0, 0],
      [5, 0],
      [5, 3],
      [7, 3],
      [7, 7],
      [4, 7],
      [4, 5],
      [0, 5],
      [0, 0],
    ],
  ]);
  delete expectedFootprint.bbox;
  const expectedPolygonParts = featureCollection([
    bboxPolygon([0, 0, 4, 5], {
      properties: {
        test: '1',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'RGB',
      },
    }),
    bboxPolygon([4, 0, 5, 3], {
      properties: {
        test: '2',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'Pan_Sharpen',
      },
    }),
    bboxPolygon([4, 4, 7, 7], {
      properties: {
        test: '4',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SensorType: 'VIS',
      },
    }),
  ]);
  expectedPolygonParts.features.forEach((feat) => {
    delete feat.bbox;
  });
  const expectedMetadata = {
    minHorizontalAccuracyCE90: 5,
    classification: '4',
    creationDate: new Date(1, 1, 1),
    description: 'test',
    footprint: expectedFootprint.geometry,
    includedInBests: [],
    layerPolygonParts: expectedPolygonParts,
    maxResolutionMeter: 500,
    producerName: 'tester',
    productBoundingBox: '0,0,7,7',
    productId: 'testId',
    productName: 'test',
    productSubType: 'data',
    productType: ProductType.ORTHOPHOTO,
    productVersion: '2.0',
    rawProductData: undefined,
    region: ['r1', 'r2', 'r3', 'r4'],
    maxResolutionDeg: 0.0072,
    sensors: ['RGB', 'Pan_Sharpen', 'VIS'],
    sourceDateEnd: new Date(2, 1, 1),
    sourceDateStart: new Date(1, 1, 1),
    srsId: 'EPSG:4326',
    srsName: 'wgs84',
    type: RecordType.RECORD_RASTER,
    rms: undefined,
    scale: undefined,
  } as unknown as LayerMetadata;

  beforeEach(() => {
    merger = new MetadataMerger();
  });
  describe('merge', () => {
    it('merges metadata properly', () => {
      const merged = merger.merge(baseMetadata, updateMetadata);
      const { ingestionDate, ...restUpdateMetadata } = merged;
      expect(ingestionDate?.getTime()).toBeGreaterThan(baseMetadata.ingestionDate?.getTime() as number);
      expect(restUpdateMetadata).toEqual(expectedMetadata);
    });
  });
});
