import { LayerMetadata, ProductType, TileOutputFormat, Transparency } from '@map-colonies/mc-model-types';
import httpStatusCodes from 'http-status-codes';
import _ from 'lodash';
import { GeoJSON } from 'geojson';
import { FeatureCollection, LineString } from '@turf/turf';
import { RecordType } from '@map-colonies/mc-model-types/Schema/models/pycsw/coreEnums';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { getApp } from '../../../src/app';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { getJobsMock, createLayerJobMock, createTasksMock } from '../../mocks/clients/jobManagerClient';
import { mapExistsMock } from '../../mocks/clients/mapPublisherClient';
import { catalogExistsMock, getHighestLayerVersionMock, findRecordMock } from '../../mocks/clients/catalogClient';
import { setValue, clear as clearConfig, configMock } from '../../mocks/config';
import { Grid } from '../../../src/layers/interfaces';
import { SQLiteClient } from '../../../src/serviceClients/sqliteClient';
import { getInfoDataMock } from '../../mocks/gdalUtilitiesMock';
import { LayersManager } from '../../../src/layers/models/layersManager';
import { MergeTilesTasker } from '../../../src/merge/mergeTilesTasker';
import { LayersRequestSender } from './helpers/requestSender';
import { runMock } from '../../mocks/piscina/piscinaMock';

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
const validMultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [34.91692694458297, 33.952927285465876],
        [34.90156677832806, 32.42331628696577],
        [36.23406120090846, 32.410349688281244],
        [36.237901242471565, 33.96885230417779],
        [34.91692694458297, 33.952927285465876],
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
const validTestData = {
  fileNames: ['indexed.gpkg'],
  metadata: validTestImageMetadata,
  originDirectory: '/files',
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
const validFiles = {
  fileNames: ['indexed.gpkg'],
  originDirectory: '/files',
};
const invalidFiles = {
  fileNames: ['unindexed.gpkg'],
  originDirectory: '/files',
};
const invalidFileFormat = {
  fileNames: ['test.ecw'],
  originDirectory: '/files',
};

describe('layers', function () {
  let requestSender: LayersRequestSender;
  beforeEach(function () {
    console.warn = jest.fn();
    setValue('tiling.zoomGroups', ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
    setValue('ingestionMergeTiles.tasksBatchSize', 10000);
    setValue('layerSourceDir', 'tests/mocks');
    setValue('watchDirectory', 'watch');

    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    requestSender = new LayersRequestSender(app);
    //getProjectionMock.mockResolvedValue('4326');
    getInfoDataMock.mockReturnValue({
      crs: 4326,
      fileFormat: 'GPKG',
      pixelSize: 0.001373291015625,
      footprint: {
        type: 'Polygon',
        coordinates: [
          [
            [34.61517, 34.10156],
            [34.61517, 32.242124],
            [36.4361539, 32.242124],
            [36.4361539, 34.10156],
            [34.61517, 34.10156],
          ],
        ],
      },
    });
    createLayerJobMock.mockResolvedValue('jobId');
  });
  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
  });

  describe('Happy Path on /layers', function () {
    it('should return 200 status code', async function () {
      getJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(validTestData);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      //expect(createTasksMock).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 if export is running for the same layer', async function () {
      const jobs = [{ status: OperationStatus.IN_PROGRESS, type: 'tilesExport' }];
      getJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 if other jobs for same layer are Aborted Expired or Failed', async function () {
      const jobs = [
        { status: OperationStatus.ABORTED, type: 'Ingestion_New' },
        { status: OperationStatus.EXPIRED, type: 'Ingestion_New' },
        { status: OperationStatus.ABORTED, type: 'Ingestion_New' },
      ];
      getJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it.only('should return 200 status code for sending request transparency opaque with jpeg output format', async function () {
      getJobsMock.mockResolvedValue([]);
      const transparencyOpaqueMetadata = { ...validTestData.metadata, transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, metadata: transparencyOpaqueMetadata };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(runMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
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
            fileNames: validTestData.fileNames,
            originDirectory: validTestData.originDirectory,
          },
          layerRelativePath: expect.anything(),
          taskType: 'Ingestion_New',
          jobType: 'tilesMerging',
          grids: expect.anything(),
          extent: expect.anything(),
          managerCallbackUrl: undefined,
          isNew: expect.anything(),
          tracer: expect.anything()
        }));
      //expect(createTasksMock).toHaveBeenCalledTimes(3); - isnt called at all- now it is merge not split
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code and productVersion full number x will become x.0', async function () {
      getJobsMock.mockResolvedValue([]);
      const productVersionMetadata = { ...validTestData.metadata, productVersion: '3', transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, metadata: productVersionMetadata };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            productVersion: `${productVersionMetadata.productVersion}.0`,
            transparency: Transparency.OPAQUE,
            tileOutputFormat: TileOutputFormat.JPEG,
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
          fileNames: validTestData.fileNames,
          originDirectory: validTestData.originDirectory,
        }),
        expect.anything(),
        'Ingestion_New',
        'tilesMerging',
        expect.anything(),
        expect.anything(),
        undefined
      );
      //expect(createTasksMock).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    it('should return 200 status code for update layer operation with higher version on exists', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      const generateRecordIdsSpy = jest.spyOn(LayersManager.prototype as any, 'generateRecordIds');
      const createMergeTilesTaskspy = jest.spyOn(MergeTilesTasker.prototype as any, 'createMergeTilesTasks');
      //const getGpkgTileWidthAndHeightSpy = jest.spyOn(SQLiteClient.prototype, 'getGpkgTileWidthAndHeight');
      //const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getJobsMock.mockResolvedValue([]);
      getHighestLayerVersionMock.mockResolvedValue(1.0);
      mapExistsMock.mockResolvedValue(true);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      //getGpkgTileWidthAndHeightSpy.mockReturnValue({ tileWidth: 256, tileHeight: 256 });
      const higherVersionMetadata = { ...validTestData.metadata, productVersion: '3.0' };
      const validHigherVersionRecord = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: higherVersionMetadata };

      const response = await requestSender.createLayer(validHigherVersionRecord);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
      expect(generateRecordIdsSpy).toHaveBeenCalledTimes(0);
      expect(createMergeTilesTaskspy).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTaskspy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Ingestion_Update',
        expect.anything(),
        expect.anything(),
        expect.anything(), // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        true,
        undefined
      );
    });

    it('should return 200 status code for update layer with swap operation', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      const generateRecordIdsSpy = jest.spyOn(LayersManager.prototype as any, 'generateRecordIds');
      const createMergeTilesTaskspy = jest.spyOn(MergeTilesTasker.prototype as any, 'createMergeTilesTasks');
      setValue('supportedIngestionSwapTypes', [{ productType: 'RasterVectorBest', productSubType: 'testProductSubType' }]);
      getJobsMock.mockResolvedValue([]);
      getHighestLayerVersionMock.mockResolvedValue(1.0);
      mapExistsMock.mockResolvedValue(true);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const higherVersionMetadata = {
        ...validTestData.metadata,
        productVersion: '3.0',
        productType: ProductType.RASTER_VECTOR_BEST,
        productSubType: 'testProductSubType',
        displayPath: 'test',
      };
      const validHigherVersionRecord = {
        ...validTestData,
        fileNames: ['indexed.gpkg'],
        originDirectory: 'files',
        metadata: { ...higherVersionMetadata, productVersion: '1.23', displayPath: 'test' },
      };
      findRecordMock.mockResolvedValue(validHigherVersionRecord);

      const response = await requestSender.createLayer(validHigherVersionRecord);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
      expect(generateRecordIdsSpy).toHaveBeenCalledTimes(0);
      expect(createMergeTilesTaskspy).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTaskspy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Ingestion_Swap_Update',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        true,
        { previousRelativePath: 'test', previousProductVersion: '1.23' }
      );
      expect(findRecordMock).toHaveBeenCalledTimes(1);
    });

    it('should return 200 status code with valid layer polygon parts', async function () {
      getJobsMock.mockResolvedValue([]);
      const testData = _.cloneDeep(validTestData);
      testData.metadata.layerPolygonParts = validLayerPolygonParts as GeoJSON;
      testData.metadata.footprint = validMultiPolygon as GeoJSON;

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      //expect(createTasksMock).toHaveBeenCalledTimes(3);
    });

    it('should return 200 status code for sending request with extra metadata fields', async function () {
      getJobsMock.mockResolvedValue([]);
      let extraFieldTestMetaData = { ...validTestData.metadata } as Record<string, unknown>;
      extraFieldTestMetaData = { ...extraFieldTestMetaData };
      const extraTestData = { ...validTestData, metadata: extraFieldTestMetaData };

      const response = await requestSender.createLayer(extraTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(createLayerJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...validTestData.metadata,
            tileOutputFormat: TileOutputFormat.PNG,
            productBoundingBox: '34.90156677832806,32.410349688281244,36.237901242471565,33.96885230417779',
            id: expect.anything(),
            displayPath: expect.anything(),
            layerPolygonParts: expect.anything(),
            sourceDateEnd: expect.anything(),
            sourceDateStart: expect.anything(),
            creationDate: expect.anything(),
          },
          fileNames: validTestData.fileNames,
          originDirectory: validTestData.originDirectory,
        }),
        expect.anything(),
        'Ingestion_New',
        'tilesMerging',
        expect.anything(),
        expect.anything(),
        undefined
      );
      //expect(createTasksMock).toHaveBeenCalledTimes(3);
    });

    it('should return 200 status code for transparency opaque with jpeg output format', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getJobsMock.mockResolvedValue([]);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const transparencyOpaqueMetadata = { ...validTestData.metadata, transparency: Transparency.OPAQUE };
      const testData = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: transparencyOpaqueMetadata };
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);

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
        expect.anything(),
        undefined
      );
    });

    it('should return 200 status code for sending request transparency transparent with png output format', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getJobsMock.mockResolvedValue([]);
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      const transparencyTransparentMetadata = { ...validTestData.metadata, transparency: Transparency.TRANSPARENT };
      const testData = { ...validTestData, fileNames: ['indexed.gpkg'], originDirectory: 'files', metadata: transparencyTransparentMetadata };
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
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
        expect.anything(),
        undefined
      );
    });

    it('should return 200 status code for indexed gpkg', async function () {
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getHighestLayerVersionMock.mockResolvedValue(undefined);
      getJobsMock.mockResolvedValue([]);
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
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(1);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Bad Path on /layers', function () {
    // All requests with status code of 400
    it('should return 400 status code for invalid Test Data', async function () {
      const response = await requestSender.createLayer(invalidTestData);
      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(getJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for missing originDirectory value', async function () {
      getJobsMock.mockResolvedValue([]);
      const invalidTestData = { ...validTestData, originDirectory: '' };

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(getJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for originDirectory equal to watchDir', async function () {
      getJobsMock.mockResolvedValue([]);
      const invalidTestData = { ...validTestData, originDirectory: 'watch' };

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      getJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
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
      getJobsMock.mockResolvedValue([]);

      const response = await requestSender.createLayer(invalidTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 400 status code for unindexed gpkg', async function () {
      getHighestLayerVersionMock.mockResolvedValue(undefined);
      getJobsMock.mockResolvedValue([]);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      const testData = {
        fileNames: ['unindexed.gpkg'],
        metadata: { ...validTestImageMetadata },
        originDirectory: 'files',
      };

      const response = await requestSender.createLayer(testData);

      expect(response).toSatisfyApiSpec();
      //expect(getProjectionMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
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
      expect(getJobsMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Sad Path on /layers', function () {
    // All requests with status code 4XX-5XX
    it('should return 409 if tested layer is already being In-Progress', async function () {
      const jobs = [
        { status: OperationStatus.FAILED, type: 'Ingestion_New' },
        { status: OperationStatus.IN_PROGRESS, type: 'Ingestion_New' },
      ];
      getJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 if tested layer is already being generated while also having aborted job', async function () {
      const jobs = [
        { status: OperationStatus.ABORTED, type: 'Ingestion_New' },
        { status: OperationStatus.IN_PROGRESS, type: 'Ingestion_New' },
      ];
      getJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 if tested layer is already being generated while also having expired job', async function () {
      const jobs = [
        { status: OperationStatus.EXPIRED, type: 'Ingestion_New' },
        { status: OperationStatus.IN_PROGRESS, type: 'Ingestion_New' },
      ];
      getJobsMock.mockResolvedValue(jobs);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 500 status code on db error', async function () {
      getJobsMock.mockRejectedValue(new Error('db fail test'));

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(mapExistsMock).toHaveBeenCalledTimes(0);
      expect(catalogExistsMock).toHaveBeenCalledTimes(0);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 status code when layer exists in map server', async function () {
      getJobsMock.mockResolvedValue([]);
      mapExistsMock.mockResolvedValue(true);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should return 409 status code when layer exists in catalog', async function () {
      getJobsMock.mockResolvedValue([]);
      catalogExistsMock.mockResolvedValue(true);

      const response = await requestSender.createLayer(validTestData);

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.CONFLICT);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(mapExistsMock).toHaveBeenCalledTimes(1);
      expect(catalogExistsMock).toHaveBeenCalledTimes(1);
      expect(createLayerJobMock).toHaveBeenCalledTimes(0);
      expect(createTasksMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Happy path on /layers/validateSources', function () {
    it('should return 200 status code with valid file', async function () {
      const response = await requestSender.checkFiles(validFiles);
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toEqual(expect.objectContaining({ isValid: true }));
    });

    it('should return 200 status code with invalid file', async function () {
      const response = await requestSender.checkFiles(invalidFiles);
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toEqual(expect.objectContaining({ isValid: false }));
    });
  });

  describe('Sad path on /layers/validateSources', function () {
    it('should return 400 status code with invalid file format', async function () {
      const response = await requestSender.checkFiles(invalidFileFormat);
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });
  });
});
