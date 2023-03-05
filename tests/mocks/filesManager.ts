import { FilesManager } from '../../src/utils/filesManager';

const readFileSyncMock = jest.fn();

const filesManagerMock = {
  readFileSync: readFileSyncMock,
} as unknown as FilesManager;

export { filesManagerMock };
