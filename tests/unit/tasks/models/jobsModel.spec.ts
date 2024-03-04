/* eslint-disable @typescript-eslint/no-explicit-any */
import jsLogger from '@map-colonies/js-logger';
import { ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';

import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { JobsManager } from '../../../../src/jobs/models/jobsManager';
import {
  jobManagerClientMock,
  getJobByIdMock,
  getTaskByIdMock,
  abortJobMock,
  updateJobByIdMock,
  createSeedJobTaskMock,
} from '../../../mocks/clients/jobManagerClient';
import { getCacheByNameTypeMock, mapPublisherClientMock, publishLayerMock, updateLayerMock } from '../../../mocks/clients/mapPublisherClient';
import {
  catalogClientMock,
  findRecordMock,
  publishToCatalogMock,
  updateMock,
  getHighestLayerVersionMock,
  findRecordByIdMock,
} from '../../../mocks/clients/catalogClient';
import { syncClientMock, triggerSyncMock } from '../../../mocks/clients/syncClient';
import { configMock, init as initMockConfig, setValue } from '../../../mocks/config';
import { linkBuilderMock } from '../../../mocks/linkBuilder';
import { OperationTypeEnum } from '../../../../src/serviceClients/syncClient';
import { mergeMock, metadataMergerMock } from '../../../mocks/metadataMerger';
import { IPublishMapLayerRequest, PublishedMapLayerCacheType } from '../../../../src/layers/interfaces';
import { tracerMock } from '../../../mocks/tracer';
import {
  intersectedGeometryNewUpdate,
  staticIngestionNewMetadata,
  staticIngestionUpdateMetadata,
  worldGeometry,
  africaGeometry,
  europeGeometry,
} from '../../../mocks/data/mockMetadata';
import { ISeed, ISeedTaskParams } from '../../../../src/common/interfaces';
import { CacheType, SeedMode } from '../../../../src/common/enums';

let jobsManager: JobsManager;

const jobId = 'c3e8d0c6-6663-49e5-9257-323674161725';
const taskId = '517059cc-f60b-4542-8a41-fdd163358d74';

describe('JobsManager', () => {
  const ingestionNewJobType = 'Ingestion_New';
  const ingestionUpdateJobType = 'Ingestion_Update';
  const ingestionSwapUpdateJobType = 'Ingestion_Swap_Update';
  const tileSplitTask = 'tilesSplitting';
  const tileMergeTask = 'tilesMerging';
  beforeEach(function () {
    jest.resetAllMocks();
    setValue('mapServerCacheType', 'FS');
    initMockConfig();
    jobsManager = new JobsManager(
      configMock,
      jsLogger({ enabled: false }),
      tracerMock,
      syncClientMock,
      jobManagerClientMock,
      mapPublisherClientMock,
      catalogClientMock,
      linkBuilderMock,
      metadataMergerMock
    );
  });

  describe('completeWorkerTask', () => {
    const testMetadata = {
      id: 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23',
      description: 'test desc',
      productType: ProductType.ORTHOPHOTO_HISTORY,
      productName: 'test',
      productVersion: '1',
      productId: 'test',
      maxResolutionDeg: 2.68220901489258e-6,
      tileOutputFormat: TileOutputFormat.JPEG,
    };

    const mapPublishReq: IPublishMapLayerRequest = {
      name: `test-${testMetadata.productType}`,
      tilesPath: `test/${testMetadata.productType}`,
      cacheType: PublishedMapLayerCacheType.FS,
      format: TileOutputFormat.JPEG,
    };

    const catalogReqData = {
      metadata: { ...testMetadata },
      links: undefined,
    };

    it('publish layer to catalog once if all tasks are done for RASTER_MAP', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ mapServerCacheType: 'fs', 'tiling.zoomGroups': ['0-10', '11', '12', '13', '14', '15', '16', '17', '18'] });
      setValue('shouldSync', true);
      setValue('ingestionNewJobType', ingestionNewJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobByIdMock.mockReturnValue({
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        metadata: rasterMapTestData,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        type: ingestionNewJobType,
      });

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileSplitTask,
      });

      await jobsManager.completeJob(jobId, taskId);

      expect(getJobByIdMock).toHaveBeenCalledTimes(1);
      expect(publishToCatalogMock).toHaveBeenCalledTimes(1);
      expect(publishLayerMock).toHaveBeenCalledTimes(1);

      expect(triggerSyncMock).toHaveBeenCalledTimes(1);
      const mapPublishReqForRasterMap = { ...mapPublishReq };
      mapPublishReqForRasterMap.name = `test-${rasterMapTestData.productType}`;
      mapPublishReqForRasterMap.tilesPath = `test/${rasterMapTestData.productType}`;
      expect(publishLayerMock).toHaveBeenCalledWith(mapPublishReqForRasterMap);

      const expectedPublishTocCatalogReq = { ...catalogReqData };
      expectedPublishTocCatalogReq.metadata.productType = ProductType.RASTER_MAP;
      expect(publishToCatalogMock).toHaveBeenCalledWith(expectedPublishTocCatalogReq);
      expect(triggerSyncMock).toHaveBeenCalledWith(
        jobId,
        'test',
        '1',
        ProductType.RASTER_MAP,
        OperationTypeEnum.ADD,
        mapPublishReqForRasterMap.tilesPath
      );
    });

    it('do nothing if some tasks are not done', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ mapServerCacheType: 'fs', 'tiling.zoomGroups': [] });
      setValue('ingestionNewJobType', ingestionNewJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      getJobByIdMock.mockReturnValue({
        allCompleted: false,
        type: ingestionNewJobType,
      });

      getTaskByIdMock.mockReturnValue({
        type: tileSplitTask,
      });

      await jobsManager.completeJob(jobId, taskId);

      expect(getJobByIdMock).toHaveBeenCalledTimes(1);
      expect(publishToCatalogMock).toHaveBeenCalledTimes(0);
      expect(publishLayerMock).toHaveBeenCalledTimes(0);
      expect(triggerSyncMock).toHaveBeenCalledTimes(0);
    });

    it('should abort all merge tasks and make job failed on task failure', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobByIdMock.mockReturnValue({
        id: jobId,
        completed: true,
        successful: true,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        percentage: 80,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        status: OperationStatus.IN_PROGRESS,
      });

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.FAILED,
      });

      // eslint-disable-next-line @typescript-eslint/ban-types
      const tasksManagerWithHandlers = jobsManager as unknown as { handleUpdateIngestion: () => {}; handleNewIngestion: () => {} };
      const handleUpdateIngestionSpy = jest.spyOn(tasksManagerWithHandlers, 'handleUpdateIngestion');
      const handleNewIngestionSpy = jest.spyOn(tasksManagerWithHandlers, 'handleNewIngestion');
      await jobsManager.completeJob(jobId, taskId);

      expect(abortJobMock).toHaveBeenCalledTimes(1);
      expect(updateJobByIdMock).toHaveBeenCalledTimes(1);
      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.FAILED, undefined, `Failed to update ingestion`);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledTimes(1);
      expect(handleNewIngestionSpy).toHaveBeenCalledTimes(0);
    });

    it('should complete job once all tasks are successful for update-merge job-task', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...staticIngestionUpdateMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;
      const generateSeedJobSpy = jest.spyOn(JobsManager.prototype as any, 'generateSeedJob');
      mergeMock.mockReturnValue(rasterMapTestData);
      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      getJobByIdMock.mockReturnValue(runningJob);

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      createSeedJobTaskMock.mockResolvedValue(undefined);

      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: staticIngestionNewMetadata,
        links: [{ name: 'test-layer' }],
      };

      findRecordByIdMock.mockResolvedValue(originalRecord);
      getCacheByNameTypeMock.mockResolvedValue({ cacheName: 'test-redis' });
      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.COMPLETED, 100, undefined, catalogRecordId);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(mergeMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), false);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateLayerMock).toHaveBeenCalledTimes(0);
      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledWith(runningJob, rasterMapTestData, originalRecord, originalRecord.links[0].name, false);
    });

    it('should complete job once all tasks are successful for update-swap-merge job-task', async function () {
      setValue('ingestionSwapUpdateJobType', ingestionSwapUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: staticIngestionNewMetadata,
        links: [{ name: 'test-layer' }],
      };
      publishToCatalogMock.mockResolvedValue(catalogRecordId);
      mergeMock.mockReturnValue(originalRecord);
      getCacheByNameTypeMock.mockResolvedValue({ cacheName: 'test-redis' });
      getJobByIdMock.mockReturnValue({
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: { ...staticIngestionNewMetadata, id: catalogRecordId },
        type: ingestionSwapUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      });

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      findRecordByIdMock.mockResolvedValue(originalRecord);
      createSeedJobTaskMock.mockResolvedValue(undefined);

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.COMPLETED, 100, undefined, catalogRecordId);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(mergeMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateLayerMock).toHaveBeenCalledTimes(1);
      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(1);
    });

    it('should update job status to "Failed" if task status is "Failed"', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobByIdMock.mockReturnValue({
        id: jobId,
        isCompleted: false,
        isSuccessful: false,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      });

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.FAILED,
      });

      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      findRecordMock.mockResolvedValue({
        id: catalogRecordId,
        metadata: {},
      });

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledTimes(1);
      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.FAILED, undefined, 'Failed to update ingestion');
      expect(mergeMock).toHaveBeenCalledTimes(0);
      expect(updateMock).toHaveBeenCalledTimes(0);
      expect(findRecordMock).toHaveBeenCalledTimes(0);
    });

    it('should failed job once for not getting original record from findRecordById API', async function () {
      findRecordByIdMock.mockResolvedValue(undefined);
      mergeMock.mockReturnValue(staticIngestionUpdateMetadata);
      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: staticIngestionUpdateMetadata,
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      getJobByIdMock.mockReturnValue(runningJob);

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      getCacheByNameTypeMock.mockResolvedValue({ cacheName: 'test-redis' });
      const action = async () => jobsManager.completeJob(jobId, taskId);
      await expect(action).rejects.toThrow(
        'Could not find record catalog for: productId: test, productType: OrthophotoHistory, version: 2.0 to merge data into'
      );
      expect(mergeMock).toHaveBeenCalledTimes(0);
      expect(updateMock).toHaveBeenCalledTimes(0);
      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(0);
    });

    it('should not update job status if job status is not "In-Progress"', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobByIdMock.mockReturnValue({
        id: jobId,
        isCompleted: false,
        isSuccessful: false,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.ABORTED,
      });

      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      findRecordMock.mockResolvedValue({
        id: catalogRecordId,
        metadata: {},
      });

      getHighestLayerVersionMock.mockResolvedValue(['1.0']);

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledTimes(0);
      expect(mergeMock).toHaveBeenCalledTimes(0);
      expect(updateMock).toHaveBeenCalledTimes(0);
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(0);
      expect(findRecordMock).toHaveBeenCalledTimes(0);
    });
  });
  describe('generateSeedTask', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

    it('Create success seed task - on update (regular)', async () => {
      const grid = configMock.get<string>('mapproxy.cache.grids');
      const seedJobType = configMock.get<string>('seedJobType');
      const seedTaskType = configMock.get<string>('seedTaskType');
      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: staticIngestionNewMetadata,
        links: [{ name: 'test-layer' }],
      };

      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.ORTHOPHOTO_HISTORY}`,
        metadata: { ...staticIngestionUpdateMetadata },
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      const runningTask = {
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      };

      getJobByIdMock.mockReturnValue(runningJob);
      getTaskByIdMock.mockReturnValue(runningTask);
      findRecordByIdMock.mockResolvedValue(originalRecord);
      mergeMock.mockReturnValue(staticIngestionUpdateMetadata);
      createSeedJobTaskMock.mockResolvedValue(undefined);
      getCacheByNameTypeMock.mockResolvedValue(`${originalRecord.links[0].name}-redis`);
      const generateSeedJobSpy = jest.spyOn(JobsManager.prototype as any, 'generateSeedJob');

      const expectedSeedOption: ISeed = {
        mode: SeedMode.SEED,
        grid,
        fromZoomLevel: 0,
        toZoomLevel: 9,
        geometry: intersectedGeometryNewUpdate,
        skipUncached: false,
        layerId: 'test-redis',
        refreshBefore: '2020-01-01T00:00:00',
      };

      const expectedSeedTaskParams: ISeedTaskParams = {
        seedTasks: [expectedSeedOption],
        catalogId: catalogRecordId,
        spanId: 'TBD',
        cacheType: CacheType.REDIS,
      };

      getCacheByNameTypeMock.mockResolvedValue('test-redis');
      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.COMPLETED, 100, undefined, catalogRecordId);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledWith(runningJob, staticIngestionUpdateMetadata, originalRecord, originalRecord.links[0].name, false);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledWith(runningJob, seedJobType, seedTaskType, [expectedSeedTaskParams]);
    });

    it('Create success clean(seeder) task - on update swap', async function () {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionSwapUpdateJobType', ingestionSwapUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const grid = configMock.get<string>('mapproxy.cache.grids');
      const seedJobType = configMock.get<string>('seedJobType');
      const seedTaskType = configMock.get<string>('seedTaskType');

      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: staticIngestionNewMetadata,
        links: [{ name: 'test-layer' }],
      };

      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.ORTHOPHOTO_HISTORY}`,
        metadata: { ...staticIngestionUpdateMetadata },
        type: ingestionSwapUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      getJobByIdMock.mockReturnValue(runningJob);
      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      findRecordByIdMock.mockResolvedValue(originalRecord);
      mergeMock.mockReturnValue(staticIngestionUpdateMetadata);
      createSeedJobTaskMock.mockResolvedValue(undefined);
      getCacheByNameTypeMock.mockResolvedValue(`${originalRecord.links[0].name}-redis`);
      const generateSeedJobSpy = jest.spyOn(JobsManager.prototype as any, 'generateSeedJob');

      const expectedSeedOption: ISeed = {
        mode: SeedMode.CLEAN,
        grid,
        fromZoomLevel: 0,
        toZoomLevel: 9,
        geometry: worldGeometry,
        skipUncached: false,
        layerId: 'test-redis',
        refreshBefore: '2020-01-01T00:00:00',
      };

      const expectedSeedTaskParams: ISeedTaskParams = {
        seedTasks: [expectedSeedOption],
        catalogId: catalogRecordId,
        spanId: 'TBD',
        cacheType: CacheType.REDIS,
      };

      getCacheByNameTypeMock.mockResolvedValue('test-redis');
      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobByIdMock).toHaveBeenCalledWith(jobId, OperationStatus.COMPLETED, 100, undefined, catalogRecordId);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledWith(runningJob, staticIngestionUpdateMetadata, originalRecord, originalRecord.links[0].name, true);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledWith(runningJob, seedJobType, seedTaskType, [expectedSeedTaskParams]);
    });

    it('Skip creating seed job(no geometry intersection) - on update (regular)', async function () {
      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: { ...staticIngestionNewMetadata, footprint: europeGeometry },
        links: [{ name: 'test-layer' }],
      };

      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.ORTHOPHOTO_HISTORY}`,
        metadata: { ...staticIngestionUpdateMetadata, footprint: africaGeometry },
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      const runningTask = {
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      };

      getJobByIdMock.mockReturnValue(runningJob);
      getTaskByIdMock.mockReturnValue(runningTask);
      findRecordByIdMock.mockResolvedValue(originalRecord);
      mergeMock.mockReturnValue(staticIngestionUpdateMetadata);
      createSeedJobTaskMock.mockResolvedValue(undefined);
      getCacheByNameTypeMock.mockResolvedValue(`${originalRecord.links[0].name}-redis`);
      const generateSeedJobSpy = jest.spyOn(JobsManager.prototype as any, 'generateSeedJob');

      await jobsManager.completeJob(jobId, taskId);

      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(0);
    });

    it('Skip creating seed job cache name not found on mapproxy config', async function () {
      const catalogRecordId = 'a6fbf0dc-d82c-4c8d-ad28-b8f56c685a23';
      const originalRecord = {
        id: catalogRecordId,
        metadata: staticIngestionNewMetadata,
        links: [{ name: 'test-layer' }],
      };

      const runningJob = {
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.ORTHOPHOTO_HISTORY}`,
        metadata: { ...staticIngestionUpdateMetadata },
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      };

      getJobByIdMock.mockReturnValue(runningJob);
      getTaskByIdMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      findRecordByIdMock.mockResolvedValue(originalRecord);
      mergeMock.mockReturnValue(staticIngestionUpdateMetadata);
      createSeedJobTaskMock.mockResolvedValue(undefined);
      getCacheByNameTypeMock.mockResolvedValue(undefined);
      const generateSeedJobSpy = jest.spyOn(JobsManager.prototype as any, 'generateSeedJob');

      await jobsManager.completeJob(jobId, taskId);

      expect(findRecordByIdMock).toHaveBeenCalledTimes(1);
      expect(generateSeedJobSpy).toHaveBeenCalledTimes(1);
      expect(createSeedJobTaskMock).toHaveBeenCalledTimes(0);
    });
  });
});
