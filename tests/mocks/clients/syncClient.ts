import { SyncClient } from '../../../src/serviceClients/syncClient';

const triggerSyncMock = jest.fn();

const syncClientMock = {
  triggerSync: triggerSyncMock,
} as unknown as SyncClient;

export { triggerSyncMock, syncClientMock };
