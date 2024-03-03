import { JobManagerWrapper } from '../../../src/serviceClients/JobManagerWrapper';

const createLayerJobMock = jest.fn();
const createSeedJobTaskMock = jest.fn();
const createTasksMock = jest.fn();
const getJobByIdMock = jest.fn();
const getTaskByIdMock = jest.fn();
const updateJobByIdMock = jest.fn();
const getJobsMock = jest.fn();
const abortJobMock = jest.fn();

const jobManagerClientMock = {
  createLayerJob: createLayerJobMock,
  createSeedJobTask: createSeedJobTaskMock,
  createTasks: createTasksMock,
  getJobById: getJobByIdMock,
  getTaskById: getTaskByIdMock,
  updateJobById: updateJobByIdMock,
  getJobs: getJobsMock,
  abortJob: abortJobMock,
} as unknown as JobManagerWrapper;

export {
  createLayerJobMock,
  createSeedJobTaskMock,
  createTasksMock,
  updateJobByIdMock,
  getJobByIdMock,
  getTaskByIdMock,
  getJobsMock,
  abortJobMock,
  jobManagerClientMock,
};
