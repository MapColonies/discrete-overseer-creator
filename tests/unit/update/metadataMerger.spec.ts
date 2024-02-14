/* eslint-disable @typescript-eslint/naming-convention */
import { bboxPolygon, featureCollection, polygon } from '@turf/turf';
import { LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import { MetadataMerger } from '../../../src/update/metadataMerger';

describe('MetadataMerger', () => {
  let merger: MetadataMerger;

  const baseFootprint = bboxPolygon([0, 0, 5, 5]);
  delete baseFootprint.bbox;
  const baseRawProductData = featureCollection([bboxPolygon([0, 0, 5, 5])]);
  const baseMetadata = {
    minHorizontalAccuracyCE90: 5,
    classification: '4',
    creationDate: new Date(1, 1, 1),
    description: 'test',
    footprint: baseFootprint,
    includedInBests: [],
    ingestionDate: new Date(2022, 1, 1),
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
    sourceDateEnd: new Date(1, 1, 2),
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
    sensors: ['RGB', 'Pan_Sharpen', 'VIS'],
    sourceDateEnd: new Date(1, 1, 6),
    sourceDateStart: new Date(1, 1, 4),
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

  const expectedMetadata = {
    minHorizontalAccuracyCE90: 5,
    classification: '4',
    creationDate: new Date(1, 1, 1),
    description: 'test\ntest',
    footprint: expectedFootprint.geometry,
    includedInBests: [],
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
    sourceDateEnd: new Date(1, 1, 6),
    sourceDateStart: new Date(1, 1, 1),
    srsId: 'EPSG:4326',
    srsName: 'wgs84',
    type: RecordType.RECORD_RASTER,
    rms: undefined,
    scale: undefined,
  } as unknown as LayerMetadata;

  const expectedSwapMergedMetadata = {
    minHorizontalAccuracyCE90: 3,
    classification: '6',
    creationDate: new Date(1, 1, 1),
    description: 'test',
    footprint: updateFootprint,
    includedInBests: [],
    maxResolutionMeter: 500,
    producerName: 'tester',
    productBoundingBox: '4,3,7,7',
    productId: 'testId',
    productName: 'test',
    productSubType: 'data',
    productType: ProductType.ORTHOPHOTO,
    productVersion: '2.0',
    rawProductData: undefined,
    region: ['r1', 'r4'],
    maxResolutionDeg: 0.0072,
    sensors: ['RGB', 'Pan_Sharpen', 'VIS'],
    sourceDateEnd: new Date(1, 1, 6),
    sourceDateStart: new Date(1, 1, 4),
    srsId: 'EPSG:4326',
    srsName: 'wgs84',
    type: RecordType.RECORD_RASTER,
    rms: undefined,
    scale: undefined,
    displayPath: undefined,
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

    it('merges update swap metadata properly', () => {
      const isSwap = true;
      const merged = merger.merge(baseMetadata, updateMetadata, isSwap);
      const { ingestionDate, ...restUpdateMetadata } = merged;
      expect(ingestionDate?.getTime()).toBeGreaterThan(baseMetadata.ingestionDate?.getTime() as number);
      expect(restUpdateMetadata).toEqual(expectedSwapMergedMetadata);
    });
  });
});
