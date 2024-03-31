import { IngestionParams, LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import { BadRequestError, ConflictError } from '@map-colonies/error-types';
import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { LayersManager } from '../../../../src/layers/models/layersManager';
import { createLayerJobMock, getJobsMock, jobManagerClientMock } from '../../../mocks/clients/jobManagerClient';
import { catalogExistsMock, catalogClientMock, getHighestLayerVersionMock, findRecordMock } from '../../../mocks/clients/catalogClient';
import { mapPublisherClientMock, mapExistsMock } from '../../../mocks/clients/mapPublisherClient';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import {
  validateGpkgFilesMock,
  validateSourceDirectoryMock,
  validateNotWatchDirMock,
  fileValidatorValidateExistsMock,
  ingestionValidatorMock,
  validateIsGpkgMock,
  getGridsMock,
} from '../../../mocks/ingestionValidator';
import { JobAction, TaskAction } from '../../../../src/common/enums';
import { ZoomLevelCalculator } from '../../../../src/utils/zoomToResolution';
import { createSplitTilesTasksMock, generateTasksParametersMock, splitTilesTaskerMock } from '../../../mocks/splitTilesTasker';
import { createMergeTilesTasksMock, mergeTilesTasker } from '../../../mocks/mergeTilesTasker';
import { SQLiteClient } from '../../../../src/serviceClients/sqliteClient';
import { Grid } from '../../../../src/layers/interfaces';
import { gdalUtilitiesMock, getInfoDataMock } from '../../../mocks/gdalUtilitiesMock';
import { tracerMock } from '../../../mocks/tracer';

let layersManager: LayersManager;
const metadataDetails = {
  productId: 'test',
  productVersion: '3.0',
  productName: 'test name',
  description: 'test desc',
  minHorizontalAccuracyCE90: 3,
  maxResolutionDeg: 0.001373291015625,
  rms: 0.5,
  scale: 3,
  sensors: ['OTHER', 'Test'],
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
};

const footprintInExtent = {
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

const footprintBetweenExtentToBuffer = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [34.6151695, 32.242123964843749],
        [34.6151695, 34.10156],
        [34.61516964644661, 34.101560353553388],
        [34.61517, 34.1015605],
        [36.436153886718749, 34.1015605],
        [36.436154240272138, 34.101560353553388],
        [36.436154386718748, 34.10156],
        [36.436154386718748, 32.242123964843749],
        [36.436154240272138, 32.24212361129036],
        [36.436153886718749, 32.24212346484375],
        [34.61517, 32.24212346484375],
        [34.61516964644661, 32.24212361129036],
        [34.6151695, 32.242123964843749],
      ],
    ],
  ],
};

const footprintOverBuffer = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [24.61517, 32.242123964843749],
        [24.61517, 34.10156],
        [27.544102188134524, 41.172627811865475],
        [34.61517, 44.10156],
        [36.436153886718749, 44.10156],
        [43.507221698584225, 41.172627811865475],
        [46.436153886718749, 34.10156],
        [46.436153886718749, 32.242123964843749],
        [43.507221698584225, 25.171056152978274],
        [36.436153886718749, 22.242123964843749],
        [34.61517, 22.242123964843749],
        [27.544102188134545, 25.171056152978252],
        [24.61517, 32.242123964843749],
      ],
    ],
  ],
};

const testImageMetadata = {
  ...metadataDetails,
  footprint: footprintInExtent,
} as unknown as LayerMetadata;

const testImageMetadataExtentFootprint = {
  ...metadataDetails,
  footprint: footprintBetweenExtentToBuffer,
} as unknown as LayerMetadata;

const testImageMetadataWrongFootprint = {
  ...metadataDetails,
  footprint: footprintOverBuffer,
} as unknown as LayerMetadata;

const layerRelativePath = 'test/OrthophotoHistory';

const managerCallbackUrl = 'http://localhostTest';

describe('LayersManager', () => {
  beforeEach(function () {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();
    const zoomLevelCalculator = new ZoomLevelCalculator(configMock);
    layersManager = new LayersManager(
      configMock,
      jsLogger({ enabled: false }),
      tracerMock,
      zoomLevelCalculator,
      jobManagerClientMock,
      catalogClientMock,
      mapPublisherClientMock,
      ingestionValidatorMock,
      gdalUtilitiesMock,
      splitTilesTaskerMock,
      mergeTilesTasker
    );
    getInfoDataMock.mockResolvedValue({
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
  });

  describe('createLayer', () => {
    it('should create "New" job type with "Split-Tiles" task type successfully', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('layerSourceDir', 'tests/mocks');
      const testData: IngestionParams = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/files',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      createLayerJobMock.mockResolvedValue('testJobId');
      createSplitTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(false);

      await layersManager.createLayer(testData, managerCallbackUrl);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(createSplitTilesTasksMock).toHaveBeenCalledTimes(1);
    });

    describe('validateSourceDate', () => {
      it('should throw an error if sourceDateStart is undefined', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: undefined,
          sourceDateEnd: new Date('2022-01-01'),
        };
        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should throw an error if sourceDateEnd is undefined', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: new Date('2022-01-01'),
          sourceDateEnd: undefined,
        };
        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should throw an error if sourceDateStart is not a valid date', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: 'invalid date' as unknown as Date,
          sourceDateEnd: new Date('2022-01-01'),
        };

        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should throw an error if sourceDateEnd is not a valid date', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: new Date('2022-01-01'),
          sourceDateEnd: 'invalid date' as unknown as Date,
        };

        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should throw an error if sourceDateStart is after sourceDateEnd', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: new Date('2022-01-02'),
          sourceDateEnd: new Date('2022-01-01'),
        };

        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should throw an error if sourceDateStart or sourceDateEnd is in the future', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: new Date('2022-01-01'),
          sourceDateEnd: futureDate,
        };

        expect(() => layersManager['validateSourceDate'](metaData)).toThrow(BadRequestError);
      });

      it('should not throw an error for valid source dates', () => {
        const metaData: LayerMetadata = {
          ...testImageMetadata,
          sourceDateStart: new Date('2022-01-01'),
          sourceDateEnd: new Date('2022-01-02'),
        };

        expect(() => layersManager['validateSourceDate'](metaData)).not.toThrow();
      });
    });

    it('should create "New" job when footprint provided is between extent and buffer', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('layerSourceDir', 'tests/mocks');
      const testData: IngestionParams = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...testImageMetadataExtentFootprint },
        originDirectory: '/files',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      createLayerJobMock.mockResolvedValue('testJobId');
      createSplitTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(false);

      await layersManager.createLayer(testData, managerCallbackUrl);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(createSplitTilesTasksMock).toHaveBeenCalledTimes(1);
    });

    it('should create "Update" job type with "Merge-Tiles" task type successfully when includes only GPKG files', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('layerSourceDir', 'tests/mocks');
      const testData: IngestionParams = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/files',
      };

      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      getHighestLayerVersionMock.mockResolvedValue(2.0);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      mapExistsMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      validateGpkgFilesMock.mockReturnValue(true);
      createLayerJobMock.mockResolvedValue('testJobId');
      createMergeTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(true);
      getGridsMock.mockReturnValue([Grid.TWO_ON_ONE]);

      await layersManager.createLayer(testData, managerCallbackUrl);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(validateGpkgFilesMock).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTasksMock).toHaveBeenCalledTimes(1);
    });

    it('should create "Swap Update" job type with "Merge-Tiles" task type successfully when includes subtype of supported swap', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('supportedIngestionSwapTypes', [{ productType: 'RasterVectorBest', productSubType: 'testProductSubType' }]);

      const testData: IngestionParams = {
        fileNames: ['test.gpkg'],
        metadata: { ...testImageMetadata, productType: ProductType.RASTER_VECTOR_BEST, productSubType: 'testProductSubType', productVersion: '4.0' },
        originDirectory: '/here',
      };
      findRecordMock.mockResolvedValue({ metadata: { ...testImageMetadata, displayPath: 'test_previous_dir' } });
      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      getHighestLayerVersionMock.mockResolvedValue(3.0);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      mapExistsMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      validateGpkgFilesMock.mockReturnValue(true);
      createLayerJobMock.mockResolvedValue('testJobId');
      createMergeTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(true);
      getGridsMock.mockReturnValue([Grid.TWO_ON_ONE]);

      await layersManager.createLayer(testData, managerCallbackUrl);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(validateGpkgFilesMock).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTasksMock).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTasksMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Ingestion_Swap_Update',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        true,
        { previousRelativePath: 'test_previous_dir', previousProductVersion: '3.0' }
      );
    });

    it('createMergeTilesTasksMock function should be called with "isNew" parameter for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('layerSourceDir', 'tests/mocks');

      const testData: IngestionParams = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/files',
      };

      const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
      getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
      getHighestLayerVersionMock.mockResolvedValue(undefined);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      mapExistsMock.mockResolvedValue(false);
      getJobsMock.mockResolvedValue([]);
      validateGpkgFilesMock.mockReturnValue(true);
      createLayerJobMock.mockResolvedValue('testJobId');
      createMergeTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(true);
      getGridsMock.mockReturnValue([Grid.TWO_ON_ONE]);

      await layersManager.createLayer(testData, managerCallbackUrl);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(validateGpkgFilesMock).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTasksMock).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const mockId = createMergeTilesTasksMock.mock.calls[0][0].metadata.id;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const mockDisplayPath = createMergeTilesTasksMock.mock.calls[0][0].metadata.displayPath;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const relativePath = `${mockId}/${mockDisplayPath}`;
      expect(createMergeTilesTasksMock).toHaveBeenCalledWith(
        testData,
        relativePath,
        TaskAction.MERGE_TILES,
        JobAction.NEW,
        [Grid.TWO_ON_ONE],
        [34.90156677832806, 32.410349688281244, 36.237901242471565, 33.96885230417779],
        managerCallbackUrl,
        true
      );
    });

    /* this test is not relevant currently, since we are passing "isNew" parameter from configuration */

    // eslint-disable-next-line jest/no-commented-out-tests
    // it('createMergeTilesTasksMock function should not called with "isNew" parameter for "Update" job type', async function () {
    //   // eslint-disable-next-line @typescript-eslint/naming-convention
    //   setValue({ 'tiling.zoomGroups': '1,2-3' });
    //   setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
    //   const testData: IngestionParams = {
    //     fileNames: ['test.gpkg'],
    //     metadata: { ...testImageMetadata },
    //     originDirectory: '/here',
    //   };

    //   const getGridSpy = jest.spyOn(SQLiteClient.prototype, 'getGrid');
    //   getGridSpy.mockReturnValue(Grid.TWO_ON_ONE);
    //   getHighestLayerVersionMock.mockResolvedValue(2.0);
    //   fileValidatorValidateExistsMock.mockResolvedValue(true);
    //   validateSourceDirectoryMock.mockResolvedValue(true);
    //   validateNotWatchDirMock.mockResolvedValue(true);
    //   mapExistsMock.mockResolvedValue(true);
    //   getJobsMock.mockResolvedValue([]);
    //   validateGpkgFilesMock.mockReturnValue(true);
    //   createLayerJobMock.mockResolvedValue('testJobId');
    //   createMergeTilesTasksMock.mockResolvedValue(undefined);

    //   await layersManager.createLayer(testData, managerCallbackUrl);

    //   expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
    //   expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
    //   expect(getJobsMock).toHaveBeenCalledTimes(1);
    //   expect(findRecordMock).toHaveBeenCalledTimes(1);
    //   expect(validateGpkgFilesMock).toHaveBeenCalledTimes(1);
    //   expect(createMergeTilesTasksMock).toHaveBeenCalledTimes(1);
    //   // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    //   const relativePath = `undefined/undefined`; // its undefined because 'findRecord' function is executes when job type is "Update" and return record as undefined while testing
    //   expect(createMergeTilesTasksMock).toHaveBeenCalledWith(
    //     testData,
    //     relativePath,
    //     TaskAction.MERGE_TILES,
    //     JobAction.UPDATE,
    //     [Grid.TWO_ON_ONE],
    //     [0, 0, 1, 1],
    //     managerCallbackUrl
    //   );
    // });

    it('should throw Bad Request Error for "Update" job type if layer is not exists in map proxy', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);

      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };
      getHighestLayerVersionMock.mockResolvedValue([1.0, 2.0]);
      mapExistsMock.mockResolvedValue(false);
      getJobsMock.mockResolvedValue([]);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      validateGpkgFilesMock.mockReturnValue(true);
      createLayerJobMock.mockResolvedValue('testJobId');
      createMergeTilesTasksMock.mockResolvedValue(undefined);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };

      await expect(action).rejects.toThrow(BadRequestError);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
    });

    it('should throw Bad Request Error for "New" or "Update" job type if higher product version is already exists in catalog', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(4.0);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };

      await expect(action).rejects.toThrow(BadRequestError);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(getJobsMock).toHaveBeenCalledTimes(0);
      expect(createSplitTilesTasksMock).toHaveBeenCalledTimes(0);
    });

    it('should throw error when footprint is over the bufferedExtent', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      setValue('layerSourceDir', 'tests/mocks');
      const testData: IngestionParams = {
        fileNames: ['indexed.gpkg'],
        metadata: { ...testImageMetadataWrongFootprint },
        originDirectory: '/files',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      createLayerJobMock.mockResolvedValue('testJobId');
      createSplitTilesTasksMock.mockResolvedValue(undefined);
      validateIsGpkgMock.mockReturnValue(false);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };

      await expect(action).rejects.toThrow(BadRequestError);
    });

    // TODO: Handle test when update is supported for other formats
    it('should throw Bad Request Error for "Update" job type if there is unsupported file (not GPKG) in request', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(2.5);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      validateGpkgFilesMock.mockReturnValue(false);
      createLayerJobMock.mockResolvedValue('testJobId');
      createMergeTilesTasksMock.mockResolvedValue(undefined);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };

      await expect(action).rejects.toThrow(BadRequestError);
    });

    it('should create the new layer although an export for same layer is in progress', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.IN_PROGRESS, type: 'tilesExport' }]);

      await layersManager.createLayer(testData, managerCallbackUrl);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
    });

    it('fail if layer status is pending', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.PENDING, type: 'Ingestion_New' }]);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if layer status is inProgress', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.IN_PROGRESS, type: 'Ingestion_New' }]);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('pass if layer status is completed', async function () {
      const taskParams = [
        {
          discreteId: 'testid1',
          version: '1.0',
          fileNames: ['file1.test1'],
          originDirectory: 'test1-dir',
          minZoom: 1,
          maxZoom: 1,
          layerRelativePath: layerRelativePath,
          bbox: [0, 0, 90, 90],
        },
      ];

      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.COMPLETED, type: 'Ingestion_New' }]);
      generateTasksParametersMock.mockReturnValue(taskParams);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action()).resolves.not.toThrow();
    });

    it('pass if layer status is failed', async function () {
      const taskParams = [
        {
          discreteId: 'testid1',
          version: '1.0',
          fileNames: ['file1.test1'],
          originDirectory: 'test1-dir',
          minZoom: 1,
          maxZoom: 1,
          layerRelativePath: layerRelativePath,
          bbox: [0, 0, 90, 90],
        },
      ];

      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.FAILED, type: 'Ingestion_New' }]);
      generateTasksParametersMock.mockReturnValue(taskParams);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action()).resolves.not.toThrow();
    });

    it('fail if layer exists in mapping server for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(true);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if layer exists in catalog for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(true);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if files are missing for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1'] });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(false);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(BadRequestError);
    });
  });

  describe('generateRecordIds', () => {
    it('metadata for "new" ingestion job should includes "id" and "displayPath" while creating job tasks', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '2-3'] });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      getHighestLayerVersionMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([]);
      createLayerJobMock.mockResolvedValue('testJobId');
      createSplitTilesTasksMock.mockResolvedValue(undefined);

      await layersManager.createLayer(testData, managerCallbackUrl);

      expect(createSplitTilesTasksMock).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createSplitTilesTasksMock.mock.calls[0][0].metadata).toHaveProperty('id');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(createSplitTilesTasksMock.mock.calls[0][0].metadata).toHaveProperty('displayPath');
    });
  });
});
