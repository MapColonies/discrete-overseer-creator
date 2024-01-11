import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { SERVICES } from '../../../../src/common/constants';
import { GpkgValidator } from '../../../../src/layers/models/gpkgValidator';
import { SQLiteClient } from '../../../../src/serviceClients/sqliteClient';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import { Grid } from '../../../../src/layers/interfaces';

jest.mock('better-sqlite3');

describe('GpkgValidator', () => {
  beforeEach(function () {
    container.register(SERVICES.CONFIG, { useValue: configMock });
    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();
  });

  describe('validateGpkgFiles', () => {
    it('should return true if geopackage file is correct', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue({});
      const getGpkgGridFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGrid: () => unknown }, 'getGrid');
      getGpkgGridFn.mockReturnValue(Grid.TWO_ON_ONE);
      const getGpkgWidthAndHeightFn = jest.spyOn(
        SQLiteClient.prototype as unknown as { getGpkgTileWidthAndHeight: () => unknown },
        'getGpkgTileWidthAndHeight'
      );
      getGpkgWidthAndHeightFn.mockReturnValue({ tileWidth: 256, tileHeight: 256 });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['blueMarble.gpkg'];
      const gpkgValidator = new GpkgValidator(configMock, jsLogger({ enabled: false }));

      const response = gpkgValidator.validateGpkgFiles(testData, 'files');
      expect(response).toBe(true);
    });
  });

  describe('validateGpkgGrid', () => {
    it('should fail if geopackage does not have a valid grid', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue({});
      const getGpkgGridFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGrid: () => unknown }, 'getGrid');
      getGpkgGridFn.mockReturnValue(Grid.ONE_ON_ONE);
      const getGpkgWidthAndHeightFn = jest.spyOn(
        SQLiteClient.prototype as unknown as { getGpkgTileWidthAndHeight: () => unknown },
        'getGpkgTileWidthAndHeight'
      );
      getGpkgWidthAndHeightFn.mockReturnValue({ tileWidth: 256, tileHeight: 256 });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const gpkgValidator = new GpkgValidator(configMock, jsLogger({ enabled: false }));
      const action = () => gpkgValidator.validateGpkgFiles(testData, 'files');
      expect(action).toThrow(BadRequestError);
    });
  });

  describe('validateGpkgWidthAndHeight', () => {
    it('should fail if geopackage isnt in the correct tile width and height', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue({});
      const getGpkgGridFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGrid: () => unknown }, 'getGrid');
      getGpkgGridFn.mockReturnValue(Grid.TWO_ON_ONE);
      const getGpkgWidthAndHeightFn = jest.spyOn(
        SQLiteClient.prototype as unknown as { getGpkgTileWidthAndHeight: () => unknown },
        'getGpkgTileWidthAndHeight'
      );
      getGpkgWidthAndHeightFn.mockReturnValue({ tileWidth: 251, tileHeight: 256 });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const gpkgValidator = new GpkgValidator(configMock, jsLogger({ enabled: false }));
      const action = () => gpkgValidator.validateGpkgFiles(testData, 'files');
      expect(action).toThrow(BadRequestError);
    });
  });

  describe('validateGpkgIndex', () => {
    it('should fail if geopackage does not have a tiles index', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue(undefined);
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['unindexed.gpkg'];
      const gpkgValidator = new GpkgValidator(configMock, jsLogger({ enabled: false }));

      const action = () => gpkgValidator.validateGpkgFiles(testData, 'files');
      expect(action).toThrow(BadRequestError);
      expect(getGpkgIndexFn).toHaveBeenCalledTimes(1);
    });
  });

  //TODO: Add when more than gpkg is allowed
  // describe('validateGpkgExtension', () => {
  //   it('should fail if file is not a gpkg', function () {
  //     setValue({ layerSourceDir: 'tests/mocks' });
  //     const testData: string[] = ['test.ecw'];
  //     const gpkgValidator = new GpkgValidator(configMock, jsLogger({ enabled: false }));

  //     const action = () => gpkgValidator.validateGpkgFiles(testData, 'files');
  //     expect(action).toThrow(BadRequestError);
  //   });
  // });
});
