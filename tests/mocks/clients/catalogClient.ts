import { CatalogClient } from '../../../src/serviceClients/catalogClient';

const catalogExistsMock = jest.fn();
const existsByRecordIdMock = jest.fn();
const publishToCatalogMock = jest.fn();
const findRecordMock = jest.fn();
const updateMock = jest.fn();
const getHighestLayerVersionMock = jest.fn();

const catalogClientMock = {
  exists: catalogExistsMock,
  existsByRecordId: existsByRecordIdMock,
  publish: publishToCatalogMock,
  findRecord: findRecordMock,
  update: updateMock,
  getHighestLayerVersion: getHighestLayerVersionMock,
} as unknown as CatalogClient;

export { catalogExistsMock, publishToCatalogMock, findRecordMock, updateMock, getHighestLayerVersionMock, existsByRecordIdMock, catalogClientMock };
