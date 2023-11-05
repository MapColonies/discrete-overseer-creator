import config from 'config';
import { get, has } from 'lodash';
import { IConfig } from '../../src/common/interfaces';

let mockConfig: Record<string, unknown> = {};
const getMock = jest.fn();
const hasMock = jest.fn();

const configMock = {
  get: getMock,
  has: hasMock,
} as IConfig;

const init = (): void => {
  getMock.mockImplementation((key: string): unknown => {
    return mockConfig[key] ?? config.get(key);
  });
};

const setValue = (key: string | Record<string, unknown>, value?: unknown): void => {
  if (typeof key === 'string') {
    mockConfig[key] = value;
  } else {
    mockConfig = { ...mockConfig, ...key };
  }
};

const clear = (): void => {
  mockConfig = {};
};

const setConfigValues = (values: Record<string, unknown>): void => {
  getMock.mockImplementation((key: string) => {
    const value = get(values, key) ?? config.get(key);
    return value;
  });
  hasMock.mockImplementation((key: string) => has(values, key) || config.has(key));
};

const registerDefaultConfig = (): void => {
  const config = {
    openapiConfig: {
      filePath: './bundledApi.yaml',
      basePath: '/docs',
      rawPath: '/api',
      uiPath: '/api',
    },
    telemetry: {
      logger: {
        level: 'info',
        prettyPrint: false,
      },
    },
    server: {
      port: '8080',
      request: {
        payload: {
          limit: '1mb',
        },
      },
      response: {
        compression: {
          enabled: true,
          options: null,
        },
      },
    },
    watchDirectory: 'watch',
    layerSourceDir: 'tests/mockssfs',
    mapServerCacheType: 'FS',
    displayNameDir: '\\layerSources',
    validFileExtensions: ['tif', 'tiff', 'gpkg', 'jp2', 'jpc', 'j2k'],
    jobManagerURL: 'http://localhost:8088',
    syncServiceURL: 'http://localhost:8082',
    mapPublishingServiceURL: 'http://localhost:8083',
    publicMapServerURL: 'http://localhost:8084',
    catalogPublishingServiceURL: 'http://localhost:8085',
    tiling: {
      zoomGroups: [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
      ],
    },
    httpRetry: {
      attempts: 5,
      delay: 'exponential',
      shouldResetTimeout: true,
    },
    shouldSync: true,
    linkTemplatesPath: 'config/linkTemplates.template',
    jobDomain: 'RASTER',
    ingestionNewJobType: 'Ingestion_New',
    ingestionUpdateJobType: 'Ingestion_Update',
    ingestionTaskType: {
      tileMergeTask: 'tilesMerging',
      tileSplitTask: 'tilesSplitting',
    },
    ingestionMergeTiles: {
      mergeBatchSize: 10000,
      tasksBatchSize: 10000,
      useNewTargetFlagInUpdateTasks: true,
    },
    ingestionTilesSplittingTiles: {
      bboxSizeTiles: 10000,
      tasksBatchSize: 5,
    },
  };
  setConfigValues(config);
};

export { getMock, hasMock, configMock, setValue, clear, init, setConfigValues, registerDefaultConfig };
