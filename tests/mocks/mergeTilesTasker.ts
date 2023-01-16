import { MergeTilesTasker } from '../../src/merge/mergeTilesTasker';

const createMergeTilesTasksMock = jest.fn();

const mergeTilesTasker = {
  createMergeTilesTasks: createMergeTilesTasksMock,
} as unknown as MergeTilesTasker;

export { mergeTilesTasker, createMergeTilesTasksMock };
