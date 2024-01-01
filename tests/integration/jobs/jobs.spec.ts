import httpStatusCodes from 'http-status-codes';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { getApp } from '../../../src/app';
import { getJobByIdMock, getTaskByIdMock } from '../../mocks/clients/jobManagerClient';
import { mergeMock } from '../../mocks/metadataMerger';
import { publishLayerMock, updateLayerMock } from '../../mocks/clients/mapPublisherClient';
import { publishToCatalogMock, getHighestLayerVersionMock, findRecordMock } from '../../mocks/clients/catalogClient';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { setValue, init as initMockConfig, clear as clearConfig } from '../../mocks/config';
import { JobsManager } from '../../../src/jobs/models/jobsManager';
import { JobsRequestSender } from './helpers/requestSender';

const jobId = 'c3e8d0c6-6663-49e5-9257-323674161725';
const taskId = '517059cc-f60b-4542-8a41-fdd163358d74';

describe('jobs', function () {
  let requestSender: JobsRequestSender;
  const ingestionNewJobType = 'Ingestion_New';
  const ingestionSwapUpdateJobType = 'Ingestion_Swap_Update';
  const ingestionUpdateJobType = 'Ingestion_Update';

  const tileSplitTask = 'tilesSplitting';
  const tileMergeTask = 'tilesMerging';
  beforeEach(() => {
    console.warn = jest.fn();
    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    setValue('ingestionNewJobType', 'SDFSDFSDF');
    setValue('ingestionSwapUpdateJobType', 'ingestion_Swap_Update');
    setValue('ingestionTaskType', { tileMergeTask, tileSplitTask });
    initMockConfig();
    requestSender = new JobsRequestSender(app);
  });
  afterEach(function () {
    clearConfig();
    resetContainer();
    jest.resetAllMocks();
  });

  describe('Happy Path', function () {
    it('should return 200 status code when all completed', async function () {
      getJobByIdMock.mockReturnValue({
        isCompleted: true,
        type: ingestionNewJobType,
      });

      getTaskByIdMock.mockReturnValue({
        type: tileSplitTask,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code when not all completed', async function () {
      getJobByIdMock.mockReturnValue({
        isCompleted: false,
        type: ingestionNewJobType,
      });

      getTaskByIdMock.mockReturnValue({
        type: tileSplitTask,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    it('should return 200 status code on update swap job', async function () {
      const handleUpdateIngestionSpy = jest.spyOn(JobsManager.prototype as any, 'handleUpdateIngestion');
      const handleNewIngestionSpy = jest.spyOn(JobsManager.prototype as any, 'handleNewIngestion');
      getHighestLayerVersionMock.mockResolvedValue(1);
      mergeMock.mockReturnValue({ metadata: { id: 'test' } });
      updateLayerMock.mockResolvedValue({});
      findRecordMock.mockReturnValue({ metadata: { id: 'test' } });
      getJobByIdMock.mockReturnValue({
        metadata: {
          productId: 'test',
          productType: 'avirutTest',
        },
        isCompleted: true,
        isSuccessful: true,
        type: ingestionSwapUpdateJobType,
        relativePath: 'test',
      });

      getTaskByIdMock.mockReturnValue({
        type: tileMergeTask,
        status: OperationStatus.COMPLETED,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();
      expect(handleNewIngestionSpy).toHaveBeenCalledTimes(0);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledTimes(1);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledWith(
        {
          isCompleted: true,
          type: ingestionSwapUpdateJobType,
          metadata: {
            productId: 'test',
            productType: 'avirutTest',
          },
          status: OperationStatus.COMPLETED,
          isSuccessful: true,
          relativePath: 'test',
        },
        { type: tileMergeTask, status: OperationStatus.COMPLETED },
        true
      );
      expect(getHighestLayerVersionMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code on update job', async function () {
      const handleUpdateIngestionSpy = jest.spyOn(JobsManager.prototype as any, 'handleUpdateIngestion');
      const handleNewIngestionSpy = jest.spyOn(JobsManager.prototype as any, 'handleNewIngestion');
      getJobByIdMock.mockReturnValue({
        isCompleted: true,
        type: ingestionUpdateJobType,
      });

      getTaskByIdMock.mockReturnValue({
        type: tileMergeTask,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();
      expect(handleNewIngestionSpy).toHaveBeenCalledTimes(0);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledTimes(1);
      expect(handleUpdateIngestionSpy).toHaveBeenCalledWith({ isCompleted: true, type: ingestionUpdateJobType }, { type: tileMergeTask }, false);

      expect(response.status).toBe(httpStatusCodes.OK);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('should return 500 if failed to get completed zoom levels', async function () {
      getJobByIdMock.mockImplementation(() => {
        throw new Error('test error');
      });
      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 if failed to publish layer', async function () {
      publishLayerMock.mockImplementation(() => {
        throw new Error('test error');
      });
      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 if failed to publish to catalog', async function () {
      publishToCatalogMock.mockImplementation(() => {
        throw new Error('test error');
      });
      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
