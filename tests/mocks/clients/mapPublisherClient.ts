import { MapPublisherClient } from '../../../src/serviceClients/mapPublisher';

const publishLayerMock = jest.fn();
const mapExistsMock = jest.fn();

const mapPublisherClientMock = {
  publishLayer: publishLayerMock,
  exists: mapExistsMock,
} as unknown as MapPublisherClient;

export { publishLayerMock, mapExistsMock, mapPublisherClientMock };
