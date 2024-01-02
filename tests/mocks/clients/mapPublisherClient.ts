import { MapPublisherClient } from '../../../src/serviceClients/mapPublisher';

const publishLayerMock = jest.fn();
const updateLayerMock = jest.fn();
const mapExistsMock = jest.fn();

const mapPublisherClientMock = {
  publishLayer: publishLayerMock,
  updateLayer: updateLayerMock,
  exists: mapExistsMock,
} as unknown as MapPublisherClient;

export { publishLayerMock, updateLayerMock, mapExistsMock, mapPublisherClientMock };
