import { LayerMetadata, ProductType, RecordType, Transparency } from "@map-colonies/mc-model-types";

const validPolygon = {
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
};

const invalidPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [
        [100, 0],
        [101, 0],
        [101, 1],
        [100, 1],
        [100, 0],
      ],
    ],
  ],
};

export const validTestImageMetadata = {
    productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    productVersion: '1.23',
    productName: 'test layer',
    description: 'test layer desc',
    minHorizontalAccuracyCE90: 0.7,
    footprint: validPolygon,
    scale: 100,
    rms: 2.6,
    maxResolutionDeg: 0.001373291015625,
    sensors: ['RGB'],
    classification: '4',
    type: RecordType.RECORD_RASTER,
    productType: ProductType.ORTHOPHOTO_HISTORY,
    srsId: '4326',
    srsName: 'wgs84',
    producerName: 'testProducer',
    creationDate: new Date('11/16/2017'),
    sourceDateEnd: new Date('11/16/2017'),
    sourceDateStart: new Date('11/16/2017'),
    region: [],
    maxResolutionMeter: 0.2,
    productBoundingBox: '34.90156677832806,32.410349688281244,36.237901242471565,33.96885230417779',
    transparency: Transparency.TRANSPARENT,
  } as unknown as LayerMetadata;
  
export const validTestData = {
    fileNames: ['indexed.gpkg'],
    metadata: validTestImageMetadata,
    originDirectory: '/files',
};
