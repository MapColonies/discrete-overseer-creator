import { SplitTilesTasker } from '../../src/layers/models/splitTilesTasker';

const generateTasksParametersMock = jest.fn();
const createSplitTilesTasksMock = jest.fn();

const splitTilesTaskerMock = {
  generateTasksParameters: generateTasksParametersMock,
  createSplitTilesTasks: createSplitTilesTasksMock,
} as unknown as SplitTilesTasker;

export { splitTilesTaskerMock, generateTasksParametersMock, createSplitTilesTasksMock };
