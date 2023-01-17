import jsLogger from '@map-colonies/js-logger';
import { ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';
import { JobsManager } from '../../../../src/jobs/models/jobsManager';
import { jobManagerClientMock, getJobStatusMock, getTaskMock, abortJobMock, updateJobStatusMock } from '../../../mocks/clients/jobManagerClient';
import { mapPublisherClientMock, publishLayerMock } from '../../../mocks/clients/mapPublisherClient';
import { catalogClientMock, findRecordMock, publishToCatalogMock, updateMock } from '../../../mocks/clients/catalogClient';
import { syncClientMock, triggerSyncMock } from '../../../mocks/clients/syncClient';
import { configMock, init as initMockConfig, setValue } from '../../../mocks/config';
import { linkBuilderMock } from '../../../mocks/linkBuilder';
import { OperationTypeEnum } from '../../../../src/serviceClients/syncClient';
import { OperationStatus } from '../../../../src/common/enums';
import { mergeMock, metadataMergerMock } from '../../../mocks/metadataMerger';
import { IPublishMapLayerRequest, PublishedMapLayerCacheType } from '../../../../src/layers/interfaces';

let jobsManager: JobsManager;

const jobId = 'c3e8d0c6-6663-49e5-9257-323674161725';
const taskId = '517059cc-f60b-4542-8a41-fdd163358d74';

describe('JobsManager', () => {
  const ingestionNewJobType = 'Ingestion_New';
  const ingestionUpdateJobType = 'Ingestion_Update';
  const tileSplitTask = 'tilesSplitting';
  const tileMergeTask = 'tilesMerging';
  beforeEach(function () {
    jest.resetAllMocks();
    setValue('mapServerCacheType', 'FS');
    initMockConfig();
    jobsManager = new JobsManager(
      configMock,
      jsLogger({ enabled: false }),
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
      setValue({ mapServerCacheType: 'fs', 'tiling.zoomGroups': '0-10,11,12,13,14,15,16,17,18' });
      setValue('shouldSync', true);
      setValue('ingestionNewJobType', ingestionNewJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobStatusMock.mockReturnValue({
        isCompleted: true,
        isSuccessful: true,
        metadata: rasterMapTestData,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        type: ingestionNewJobType,
      });

      getTaskMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileSplitTask,
      });

      // tasksManager = new TasksManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      await jobsManager.completeJob(jobId, taskId);

      expect(getJobStatusMock).toHaveBeenCalledTimes(1);
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
      expect(triggerSyncMock).toHaveBeenCalledWith('test', '1', ProductType.RASTER_MAP, OperationTypeEnum.ADD, mapPublishReqForRasterMap.tilesPath);
    });

    it('do nothing if some tasks are not done', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ mapServerCacheType: 'fs', 'tiling.zoomGroups': '' });
      setValue('ingestionNewJobType', ingestionNewJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      getJobStatusMock.mockReturnValue({
        allCompleted: false,
        type: ingestionNewJobType,
      });

      getTaskMock.mockReturnValue({
        type: tileSplitTask,
      });

      // tasksManager = new TasksManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      await jobsManager.completeJob(jobId, taskId);

      expect(getJobStatusMock).toHaveBeenCalledTimes(1);
      expect(publishToCatalogMock).toHaveBeenCalledTimes(0);
      expect(publishLayerMock).toHaveBeenCalledTimes(0);
      expect(triggerSyncMock).toHaveBeenCalledTimes(0);
    });

    it('should abort all merge tasks and make job failed on task failure', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobStatusMock.mockReturnValue({
        id: jobId,
        completed: true,
        successful: true,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        percentage: 80,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        status: OperationStatus.IN_PROGRESS,
      });

      getTaskMock.mockReturnValue({
        id: taskId,
        jobId: jobId,
        type: tileMergeTask,
        status: OperationStatus.FAILED,
      });

      // tasksManager = new TasksManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      // eslint-disable-next-line @typescript-eslint/ban-types
      const tasksManagerWithHandlers = jobsManager as unknown as { handleUpdateIngestion: () => {}; handleNewIngestion: () => {} };
      const handleUpdateIngestionSpy = jest.spyOn(tasksManagerWithHandlers, 'handleUpdateIngestion');
      const handleNewIngestionSpy = jest.spyOn(tasksManagerWithHandlers, 'handleNewIngestion');
      await jobsManager.completeJob(jobId, taskId);

      expect(abortJobMock).toHaveBeenCalledTimes(1);
      expect(updateJobStatusMock).toHaveBeenCalledTimes(1);
      expect(updateJobStatusMock).toHaveBeenCalledWith(jobId, OperationStatus.FAILED, undefined, `Failed to update ingestion`);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledTimes(1);
      expect(handleNewIngestionSpy).toHaveBeenCalledTimes(0);
    });

    it('should complete job once all tasks are successful for update-merge job-task', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobStatusMock.mockReturnValue({
        id: jobId,
        isCompleted: true,
        isSuccessful: true,
        percentage: 90,
        relativePath: `test/${ProductType.RASTER_MAP}`,
        metadata: rasterMapTestData,
        type: ingestionUpdateJobType,
        successTasksCount: 3,
        status: OperationStatus.IN_PROGRESS,
      });

      getTaskMock.mockReturnValue({
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

      // tasksManager = new TasksManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobStatusMock).toHaveBeenCalledWith(jobId, OperationStatus.COMPLETED, 100, undefined, catalogRecordId);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(findRecordMock).toHaveBeenCalledTimes(1);
    });

    it('should update job status to "Failed" if task status is "Failed"', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobStatusMock.mockReturnValue({
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

      getTaskMock.mockReturnValue({
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

      // tasksManager = new TasksManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobStatusMock).toHaveBeenCalledTimes(1);
      expect(updateJobStatusMock).toHaveBeenCalledWith(jobId, OperationStatus.FAILED, undefined, 'Failed to update ingestion');
      expect(mergeMock).toHaveBeenCalledTimes(0);
      expect(updateMock).toHaveBeenCalledTimes(0);
      expect(findRecordMock).toHaveBeenCalledTimes(0);
    });

    it('should not update job status if job status is not "In-Progress"', async function () {
      setValue('ingestionUpdateJobType', ingestionUpdateJobType);
      setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });

      const rasterMapTestData = { ...testMetadata };
      rasterMapTestData.productType = ProductType.RASTER_MAP;

      getJobStatusMock.mockReturnValue({
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

      getTaskMock.mockReturnValue({
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
      // tasksManager = new JobsManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );
      // tasksManager = new JobsManager(
      //   logger,
      //   configMock,
      //   syncClientMock,
      //   jobManagerClientMock,
      //   mapPublisherClientMock,
      //   catalogClientMock,
      //   linkBuilderMock,
      //   metadataMergerMock
      // );

      await jobsManager.completeJob(jobId, taskId);

      expect(updateJobStatusMock).toHaveBeenCalledTimes(0);
      expect(mergeMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(findRecordMock).toHaveBeenCalledTimes(1);
    });
  });
});
