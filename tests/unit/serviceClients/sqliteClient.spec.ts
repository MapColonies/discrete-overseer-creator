import jsLogger from '@map-colonies/js-logger';
import Database, { Statement } from 'better-sqlite3';
import { Grid } from '../../../src/layers/interfaces';
import { SQLiteClient } from '../../../src/serviceClients/sqliteClient';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../mocks/config';

jest.mock('better-sqlite3');
let sqlClient: SQLiteClient;

describe('SQLClient', () => {
  beforeEach(function () {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();

    sqlClient = new SQLiteClient(configMock, jsLogger({ enabled: false }), 'test_gpkg', 'test_dir');
  });

  describe('getGrid', () => {
    it('should return 2x1 grid', function () {
      setValue({ layerSourceDir: 'tests/mocks' });
      const mockMatrixValues = { matrixWidth: 400, matrixHeight: 200 };
      const prepareSpy = jest.spyOn(Database.prototype, 'prepare');
      prepareSpy.mockImplementation(() => {
        return { get: () => mockMatrixValues } as Statement;
      });

      const result = sqlClient.getGrid();

      expect(result).toBe(Grid.TWO_ON_ONE);
    });

    it('should return 1x1 grid', function () {
      setValue({ layerSourceDir: 'tests/mocks' });
      const mockMatrixValues = { matrixWidth: 200, matrixHeight: 200 };
      const prepareSpy = jest.spyOn(Database.prototype, 'prepare');
      prepareSpy.mockImplementation(() => {
        return { get: () => mockMatrixValues } as Statement;
      });

      const result = sqlClient.getGrid();

      expect(result).toBe(Grid.ONE_ON_ONE);
    });

    it('should return undefined grid', function () {
      setValue({ layerSourceDir: 'tests/mocks' });
      const mockMatrixValues = { matrixWidth: 400, matrixHeight: 1 };
      const prepareSpy = jest.spyOn(Database.prototype, 'prepare');
      prepareSpy.mockImplementation(() => {
        return { get: () => mockMatrixValues } as Statement;
      });

      const result = sqlClient.getGrid();

      expect(result).toBeUndefined();
    });
  });
});
