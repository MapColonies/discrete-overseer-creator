import { JobManagerWrapper } from '../../../src/serviceClients/JobManagerWrapper';

const createLayerJobMock = jest.fn();
const createTasksMock = jest.fn();
const getJobByIdMock = jest.fn();
const getTaskByIdMock = jest.fn();
const updateJobByIdMock = jest.fn();
const findJobsMock = jest.fn();
const abortJobMock = jest.fn();
const findJobsByInternalIdMock = jest.fn();

const jobManagerClientMock = {
  createLayerJob: createLayerJobMock,
  createTasks: createTasksMock,
  getJobById: getJobByIdMock,
  getTaskById: getTaskByIdMock,
  updateJobById: updateJobByIdMock,
  findJobs: findJobsMock,
  abortJob: abortJobMock,
  findJobsByInternalId: findJobsByInternalIdMock,
} as unknown as JobManagerWrapper;

export {
  createLayerJobMock,
  createTasksMock,
  updateJobByIdMock,
  getJobByIdMock,
  getTaskByIdMock,
  findJobsMock,
  abortJobMock,
  findJobsByInternalIdMock,
  jobManagerClientMock,
};
