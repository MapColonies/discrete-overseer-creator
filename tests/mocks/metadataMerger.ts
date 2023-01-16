import { MetadataMerger } from '../../src/update/metadataMerger';

const mergeMock = jest.fn();

const metadataMergerMock = {
  merge: mergeMock,
} as unknown as MetadataMerger;

export { mergeMock, metadataMergerMock };
