import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { SERVICES } from '../../../../src/common/constants';
import { FileValidator } from '../../../../src/layers/models/fileValidator';
import { SQLiteClient } from '../../../../src/serviceClients/sqliteClient';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import { gdalUtilitiesMock, getInfoDataMock } from '../../../mocks/gdalUtilitiesMock';
import { Grid } from '../../../../src/layers/interfaces';

jest.mock('better-sqlite3');

describe('FileValidator', () => {
  beforeEach(function () {
    container.register(SERVICES.CONFIG, { useValue: configMock });
    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();
  });

  describe('validateGpkgIndex', () => {
    it('should fail if geopackage does not have a tiles index', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue(undefined);
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['unindexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = () => fileValidator.validateGpkgIndex(testData, 'files');
      expect(action).toThrow(BadRequestError);
      expect(getGpkgIndexFn).toHaveBeenCalledTimes(1);
    });

    it('should not throw an error if geopackage have a tile index', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue({});
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = () => fileValidator.validateGpkgIndex(testData, 'files');
      expect(action).not.toThrow();
      expect(getGpkgIndexFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateGpkgFiles', () => {
    it('should fail if geopackage does not have a tiles index', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue(undefined);
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['unindexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = () => fileValidator.validateGpkgIndex(testData, 'files');
      expect(action).toThrow(BadRequestError);
      expect(getGpkgIndexFn).toHaveBeenCalledTimes(1);
    });

    it('should not throw an error if geopackage have a tile index', function () {
      const getGpkgIndexFn = jest.spyOn(SQLiteClient.prototype as unknown as { getGpkgIndex: () => unknown }, 'getGpkgIndex');
      getGpkgIndexFn.mockReturnValue({});
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = () => fileValidator.validateGpkgIndex(testData, 'files');
      expect(action).not.toThrow();
      expect(getGpkgIndexFn).toHaveBeenCalledTimes(1);
    });

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
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const response = fileValidator.validateGpkgFiles(testData, 'files');
      expect(response).toBe(true);
    });

    it('should fail if geopackage has invalid params', function () {
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
      const testData: string[] = ['invalidGpkg.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = () => fileValidator.validateGpkgFiles(testData, 'files');
      expect(action).toThrow(BadRequestError);
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
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);
      const action = () => fileValidator.validateGpkgFiles(testData, 'files');
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
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);
      const action = () => fileValidator.validateGpkgFiles(testData, 'files');
      expect(action).toThrow(BadRequestError);
    });
  });

  describe('validateInfoData', () => {
    it('should not fail if infoData details are all correct', async function () {
      getInfoDataMock.mockReturnValue({
        crs: 4326,
        fileFormat: 'GPKG',
        pixelSize: 0.001373291015625,
        footprint: {
          type: 'Polygon',
          coordinates: [
            [
              [34.61517, 34.10156],
              [34.61517, 32.242124],
              [36.4361539, 32.242124],
              [36.4361539, 34.10156],
              [34.61517, 34.10156],
            ],
          ],
        },
      });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateInfoData(testData, 'files');
      await expect(action()).resolves.not.toThrow(BadRequestError);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if infoData parameters are not valid', async function () {
      getInfoDataMock.mockReturnValue({ crs: 4325, fileFormat: 'GPKG', pixelSize: 0.0000000335276 });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(BadRequestError);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if infoData fails', async function () {
      getInfoDataMock.mockReturnValue(new Error());
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(Error);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    //TODO: wait for shaziri to give good ecw file
    it('should fail when ecw file  - invalid format', async function () {
      getInfoDataMock.mockReturnValue(new Error());
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['avi.ecw'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(BadRequestError);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });
  });
});
