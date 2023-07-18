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
  fileValidatorValidateExistsMock,
  validateSourceDirectoryMock,
  validateNotWatchDirMock,
  validateGpkgFilesMock,
  fileValidatorMock,
} from '../../../mocks/fileValidator';
import { JobAction, TaskAction } from '../../../../src/common/enums';
import { ZoomLevelCalculator } from '../../../../src/utils/zoomToResolution';
import { createSplitTilesTasksMock, generateTasksParametersMock, splitTilesTaskerMock } from '../../../mocks/splitTilesTasker';
import { createMergeTilesTasksMock, mergeTilesTasker } from '../../../mocks/mergeTilesTasker';
import { SQLiteClient } from '../../../../src/serviceClients/sqliteClient';
import { Grid } from '../../../../src/layers/interfaces';

let layersManager: LayersManager;

const testImageMetadata = {
  productId: 'test',
  productVersion: '3.0',
  productName: 'test name',
  description: 'test desc',
  minHorizontalAccuracyCE90: 3,
  maxResolutionDeg: 2.68220901489258e-6,
  rms: 0.5,
  scale: 3,
  sensors: ['OTHER', 'Test'],
  footprint: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
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
  layerPolygonParts: undefined,
  includedInBests: undefined,
  maxResolutionMeter: 0.2,
  productBoundingBox: undefined,
  rawProductData: undefined,
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
      zoomLevelCalculator,
      jobManagerClientMock,
      catalogClientMock,
      mapPublisherClientMock,
      fileValidatorMock,
      splitTilesTaskerMock,
      mergeTilesTasker
    );
  });

  describe('createLayer', () => {
    it('should create "New" job type with "Split-Tiles" task type successfully', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1,2-3' });
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

      const zoomLevelCalculator = new ZoomLevelCalculator(configMock);
      layersManager = new LayersManager(
        configMock,
        jsLogger({ enabled: false }),
        zoomLevelCalculator,
        jobManagerClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock,
        splitTilesTaskerMock,
        mergeTilesTasker
      );

      await layersManager.createLayer(testData, managerCallbackUrl);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(2);
      expect(createSplitTilesTasksMock).toHaveBeenCalledTimes(1);
    });

    it('should create "Update" job type with "Merge-Tiles" task type successfully when includes only GPKG files', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1,2-3' });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      const testData: IngestionParams = {
        fileNames: ['test.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
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

      await layersManager.createLayer(testData, managerCallbackUrl);

      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(fileValidatorValidateExistsMock).toHaveBeenCalledTimes(1);
      expect(getJobsMock).toHaveBeenCalledTimes(1);
      expect(validateGpkgFilesMock).toHaveBeenCalledTimes(1);
      expect(createMergeTilesTasksMock).toHaveBeenCalledTimes(1);
    });

    it('createMergeTilesTasksMock function should be called with "isNew" parameter for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1,2-3' });
      setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
      const testData: IngestionParams = {
        fileNames: ['test.gpkg'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
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
        [0, 0, 1, 1],
        managerCallbackUrl,
        true
      );
    });

    it('should throw Bad Request Error for "Update" job type if layer is not exists in map proxy', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1,2-3' });
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
      setValue({ 'tiling.zoomGroups': '1,2-3' });
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

    // TODO: Handle test when update is supported for other formats
    it('should throw Bad Request Error for "Update" job type if there is unsupported file (not GPKG) in request', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1,2-3' });
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
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
    });

    it('fail if layer status is pending', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1' });
      const testData: IngestionParams = {
        fileNames: ['test.tif'],
        metadata: { ...testImageMetadata },
        originDirectory: '/here',
      };

      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      validateSourceDirectoryMock.mockResolvedValue(true);
      validateNotWatchDirMock.mockResolvedValue(true);
      getJobsMock.mockResolvedValue([{ status: OperationStatus.PENDING }]);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if layer status is inProgress', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1' });
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
      getJobsMock.mockResolvedValue([{ status: OperationStatus.IN_PROGRESS }]);

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
      setValue({ 'tiling.zoomGroups': '1' });
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
      getJobsMock.mockResolvedValue([{ status: OperationStatus.COMPLETED }]);
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
      setValue({ 'tiling.zoomGroups': '1' });
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
      getJobsMock.mockResolvedValue([{ status: OperationStatus.FAILED }]);
      generateTasksParametersMock.mockReturnValue(taskParams);

      const action = async () => {
        await layersManager.createLayer(testData, managerCallbackUrl);
      };
      await expect(action()).resolves.not.toThrow();
    });

    it('fail if layer exists in mapping server for "New" job type', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': '1' });
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
      setValue({ 'tiling.zoomGroups': '1' });
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
      setValue({ 'tiling.zoomGroups': '1' });
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
      setValue({ 'tiling.zoomGroups': '1,2-3' });
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
