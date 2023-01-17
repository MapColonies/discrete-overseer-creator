import { LayerMetadata, ProductType, TileOutputFormat, Transparency } from '@map-colonies/mc-model-types';
import httpStatusCodes from 'http-status-codes';
import _ from 'lodash';
import { GeoJSON } from 'geojson';
import { FeatureCollection, LineString } from '@turf/turf';
import { RecordType } from '@map-colonies/mc-model-types/Schema/models/pycsw/coreEnums';
import { getApp } from '../../../src/app';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { findJobsMock, createLayerJobMock, createTasksMock } from '../../mocks/clients/jobManagerClient';
import { mapExistsMock } from '../../mocks/clients/mapPublisherClient';
import { catalogExistsMock, getHighestLayerVersionMock } from '../../mocks/clients/catalogClient';
import { setValue, clear as clearConfig } from '../../mocks/config';
import { OperationStatus } from '../../../src/common/enums';
import { Grid } from '../../../src/layers/interfaces';
import { SQLiteClient } from '../../../src/serviceClients/sqliteClient';
import { LayersRequestSender } from './helpers/requestSender';

const validPolygon = {
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
};
const validMultiPolygon = {
  type: 'MultiPolygon',
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
const invalidMultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [100, 0],
      [101, 0],
      [101, 1],
      [100, 1],
      [100, 0],
    ],
  ],
};
const validTestImageMetadata = {
  productId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  productVersion: '1.23',
  productName: 'test layer',
  description: 'test layer desc',
  minHorizontalAccuracyCE90: 0.7,
  footprint: validPolygon,
  scale: 100,
  rms: 2.6,
  maxResolutionDeg: 0.007,
  sensors: ['RGB'],
  classification: 'test',
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
  productBoundingBox: '100,0,101,1',
  transparency: Transparency.TRANSPARENT,
} as unknown as LayerMetadata;
const validTestData = {
  fileNames: [],
  metadata: validTestImageMetadata,
  originDirectory: '/here',
};
const invalidTestImageMetadata = {
  source: 'testId',
  invalidFiled: 'invalid',
} as unknown as LayerMetadata;
const invalidTestData = {
  fileNames: [],
  metadata: invalidTestImageMetadata,
  originDirectory: '/here',
};
const validLayerPolygonParts: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        /* eslint-disable @typescript-eslint/naming-convention */
        Dsc: 'a',
        Rms: null,
        Ep90: null,
        Scale: null,
        Cities: null,
        Source: `testid-testversion`,
        Countries: '',
        Resolution: 0.072,
        SensorType: 'a,b',
        SourceName: 'test',
        /* eslint-enable @typescript-eslint/naming-convention */
      },
      geometry: validPolygon,
    },
    {
      type: 'Feature',
      properties: {
        /* eslint-disable @typescript-eslint/naming-convention */
        Dsc: 'b',
        Rms: null,
        Ep90: null,
        Scale: null,
        Cities: null,
        Source: `testid-testversion`,
        Countries: '',
        Resolution: 0.072,
        SensorType: 'a,b',
        SourceName: 'test',
        /* eslint-enable @typescript-eslint/naming-convention */
      },
      geometry: validMultiPolygon,
    },
  ],
};
const validLine: LineString = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [10, 10],
  ],
};

describe('layers', function () {
  let requestSender: LayersRequestSender;

  beforeEach(function () {
    console.warn = jest.fn();
    setValue('tiling.zoomGroups', '0,1,2,3,4,5,6,7,8,9,10');
    setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
    setValue('layerSourceDir', 'tests/mocks');
    setValue('watchDirectory', 'watch');

    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    requestSender = new LayersRequestSender(app);
    createLayerJobMock.mockResolvedValue('jobId');
  });
  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
  });

  describe('Happy Path', function () {
    it('should return 200 status code', async function () {
      findJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code for sending request transparency opaque with png output format', async function () {
      findJobsMock.mockResolvedValue([]);
      const transparencyOpaqueMetadata = { ...validTestData.metadata, transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, metadata: transparencyOpaqueMetadata };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            transparency: Transparency.OPAQUE,
            tileOutputFormat: TileOutputFormat.PNG,
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(createTasksMock).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code and  productVersion full number x will become x.0', async function () {
      findJobsMock.mockResolvedValue([]);
      const productVersionMetadata = { ...validTestData.metadata, productVersion: '3', transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, metadata: productVersionMetadata };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            productVersion: `${productVersionMetadata.productVersion}.0`,
            transparency: Transparency.OPAQUE,
            tileOutputFormat: TileOutputFormat.PNG,
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(createTasksMock).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code for update layer operation with higher version on exists', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      findJobsMock.mockResolvedValue([]);
      getHighestLayerVersionMock.mockResolvedValue(1.0);
      mapExistsMock.mockResolvedValue(true);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const higherVersionMetadata = { ...validTestData.metadata, productVersion: '3.0' };
      const validHigherVersionRecord = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: higherVersionMetadata };

      const response = await requestSender.createLayer(validHigherVersionRecord);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 200 status code with valid layer polygon parts', async function () {
      findJobsMock.mockResolvedValue([]);
      const testData = _.cloneDeep(validTestData);
      testData.metadata.layerPolygonParts = validLayerPolygonParts as GeoJSON;
      testData.metadata.footprint = validMultiPolygon as GeoJSON;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(3);
    });

    it('should return 200 status code for sending request with extra metadata fields', async function () {
      findJobsMock.mockResolvedValue([]);
      let exrtraFieldTestMetaData = { ...validTestData.metadata } as Record<string, unknown>;
      exrtraFieldTestMetaData = { ...exrtraFieldTestMetaData };
      const extraTestData = { ...validTestData, metadata: exrtraFieldTestMetaData };

      const response = await requestSender.createLayer(extraTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            tileOutputFormat: TileOutputFormat.PNG,
            productBoundingBox: '100,0,101,1',
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
      expect(createTasksMock).toHaveBeenCalledTimes(3);
    });

    it('should return 200 status code for sending request transparency opaque with jpeg output format', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      findJobsMock.mockResolvedValue([]);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const transparencyOpaqueMetadata = { ...validTestData.metadata, transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: transparencyOpaqueMetadata };
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            transparency: Transparency.OPAQUE,
            tileOutputFormat: TileOutputFormat.JPEG,
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should return 200 status code for sending request transparency transparent with png output format', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      findJobsMock.mockResolvedValue([]);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const transparencyTransparentMetadata = { ...validTestData.metadata, transparency: Transparency.TRANSPARENT };
      const testData = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: transparencyTransparentMetadata };
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            transparency: Transparency.TRANSPARENT,
            tileOutputFormat: TileOutputFormat.PNG,
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should return 200 status code for indexed gpkg', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getHighestLayerVersionMock.mockResolvedValue(undefined);
      findJobsMock.mockResolvedValue([]);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);

      const testData = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...validTestImageMetadata },
        originDirectory: 'files',
      };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
    it('should return 400 status code for invalid Test Data', async function () {
      const response = await requestSender.createLayer(invalidTestData);
      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for missing originDirectory value', async function () {
      findJobsMock.mockResolvedValue([]);
      const invalidTestData = { ...validTestData, originDirectory: '' };

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for originDirectory equal to watchDir', async function () {
      findJobsMock.mockResolvedValue([]);
      const invalidTestData = { ...validTestData, originDirectory: 'watch' };

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for update layer operation with lower version then catalog exists', async function () {
      let invalidTestMetaDataHasLowerVersion = { ...validTestData.metadata } as Record<string, unknown>;
      invalidTestMetaDataHasLowerVersion = { ...invalidTestMetaDataHasLowerVersion, productVersion: '1.0' };
      const invalidTestData = { ...validTestData, metadata: invalidTestMetaDataHasLowerVersion };
      getHighestLayerVersionMock.mockResolvedValue(2.0);
      findJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 status code for update / ingest new layer operation with equal exists version on exists', async function () {
      let invalidTestMetaDataHasLowerVersion = { ...validTestData.metadata } as Record<string, unknown>;
      invalidTestMetaDataHasLowerVersion = { ...invalidTestMetaDataHasLowerVersion, productVersion: '1.0' };
      const invalidTestData = { ...validTestData, metadata: invalidTestMetaDataHasLowerVersion };
      getHighestLayerVersionMock.mockResolvedValue(1.0);
      findJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for unindexed gpkg', async function () {
      getHighestLayerVersionMock.mockResolvedValue(undefined);
      findJobsMock.mockResolvedValue([]);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);

      const testData = {
        fileNames: ['unindexed.gpkg'],
        metadata: { ...validTestImageMetadata },
        originDirectory: 'files',
      };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid product type', async function () {
      const invalidTestMetaDataProductType = { ...validTestData.metadata };
      invalidTestMetaDataProductType.productType = ProductType.PHOTO_REALISTIC_3D;
      const invalidTestDataForProductType = { ...validTestData, metadata: invalidTestMetaDataProductType };

      const response = await requestSender.createLayer(invalidTestDataForProductType);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid footprint polygon', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.footprint = invalidPolygon as GeoJSON;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid footprint multiPolygon', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.footprint = invalidMultiPolygon as GeoJSON;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid layerPolygonParts multiPolygon', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.layerPolygonParts = _.cloneDeep(validLayerPolygonParts) as GeoJSON;
      const polygonParts = testData.metadata.layerPolygonParts as FeatureCollection;
      polygonParts.features[1].geometry = invalidMultiPolygon;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid layerPolygonParts polygon', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.layerPolygonParts = _.cloneDeep(validLayerPolygonParts) as GeoJSON;
      const polygonParts = testData.metadata.layerPolygonParts as FeatureCollection;
      polygonParts.features[1].geometry = invalidPolygon;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid layerPolygonParts geometry type', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.layerPolygonParts = _.cloneDeep(validLayerPolygonParts) as GeoJSON;
      const polygonParts = testData.metadata.layerPolygonParts as FeatureCollection;
      polygonParts.features[1].geometry = validLine;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for invalid footprint geometry type', async function () {
      const testData = _.cloneDeep(validTestData);
      testData.metadata.footprint = validLine;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('should return 409 if rested layer is already being generated', async function () {
      const jobs = [{ status: OperationStatus.FAILED }, { status: OperationStatus.IN_PROGRESS }];
      findJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 500 status code on db error', async function () {
      findJobsMock.mockRejectedValue(new Error('db fail test'));

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 status code when layer exists in map server', async function () {
      findJobsMock.mockResolvedValue([]);
      mapExistsMock.mockResolvedValue(true);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 status code when layer exists in catalog', async function () {
      findJobsMock.mockResolvedValue([]);
      catalogExistsMock.mockResolvedValue(true);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(findJobsMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });
});
