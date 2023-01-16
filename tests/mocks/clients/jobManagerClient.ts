import { JobManagerClient } from '../../../src/serviceClients/jobManagerClient';

const createLayerJobMock = jest.fn();
const createTasksMock = jest.fn();
const getJobStatusMock = jest.fn();
const getTaskMock = jest.fn();
const updateJobStatusMock = jest.fn();
const findJobsMock = jest.fn();
const abortJobMock = jest.fn();
const findJobsByInternalIdMock = jest.fn();

const jobManagerClientMock = {
  createLayerJob: createLayerJobMock,
  createTasks: createTasksMock,
  getJobStatus: getJobStatusMock,
  getTask: getTaskMock,
  updateJobStatus: updateJobStatusMock,
  findJobs: findJobsMock,
  abortJob: abortJobMock,
  findJobsByInternalId: findJobsByInternalIdMock,
} as unknown as JobManagerClient;

export {
  createLayerJobMock,
  createTasksMock,
  updateJobStatusMock,
  getJobStatusMock,
  getTaskMock,
  findJobsMock,
  abortJobMock,
  findJobsByInternalIdMock,
  jobManagerClientMock,
};
