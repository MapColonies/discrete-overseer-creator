import httpStatusCodes from 'http-status-codes';
import { getApp } from '../../../src/app';
import { getJobStatusMock, getTaskMock } from '../../mocks/clients/jobManagerClient';
import { publishLayerMock } from '../../mocks/clients/mapPublisherClient';
import { publishToCatalogMock } from '../../mocks/clients/catalogClient';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { setValue, init as initMockConfig, clear as clearConfig } from '../../mocks/config';
import { JobsRequestSender } from './helpers/requestSender';

const jobId = 'c3e8d0c6-6663-49e5-9257-323674161725';
const taskId = '517059cc-f60b-4542-8a41-fdd163358d74';

describe('jobs', function () {
  let requestSender: JobsRequestSender;
  const ingestionNewJobType = 'Ingestion_New';
  const tileSplitTask = 'tilesSplitting';
  const tileMergeTask = 'tilesMerging';
  beforeEach(() => {
    console.warn = jest.fn();
    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    setValue('ingestionNewJobType', 'SDFSDFSDF');
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
      getJobStatusMock.mockReturnValue({
        isCompleted: true,
        type: ingestionNewJobType,
      });

      getTaskMock.mockReturnValue({
        type: tileSplitTask,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
    });

    it('should return 200 status code when not all completed', async function () {
      getJobStatusMock.mockReturnValue({
        isCompleted: false,
        type: ingestionNewJobType,
      });

      getTaskMock.mockReturnValue({
        type: tileSplitTask,
      });

      const response = await requestSender.completeJob(jobId, taskId);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('should return 500 if failed to get completed zoom levels', async function () {
      getJobStatusMock.mockImplementation(() => {
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
