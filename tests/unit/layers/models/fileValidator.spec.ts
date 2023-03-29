import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { SERVICES } from '../../../../src/common/constants';
import { FileValidator } from '../../../../src/layers/models/fileValidator';
import { SQLiteClient } from '../../../../src/serviceClients/sqliteClient';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import { gdalUtilitiesMock, getProjectionMock } from '../../../mocks/gdalUtilitiesMock';

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

  describe('validateProjections', () => {
    it('should not throw an error due to valid projection', async function () {
      getProjectionMock.mockReturnValue('4326');
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateProjections(testData, 'files');
      await expect(action()).resolves.not.toThrow(BadRequestError);
      expect(getProjectionMock).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestError due to invalid projection', async function () {
      getProjectionMock.mockReturnValue('3857');
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateProjections(testData, 'files');
      await expect(action).rejects.toThrow(BadRequestError);
      expect(getProjectionMock).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestError due to missing projection', async function () {
      getProjectionMock.mockReturnValue(undefined);
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateProjections(testData, 'files');
      await expect(action).rejects.toThrow(BadRequestError);
      expect(getProjectionMock).toHaveBeenCalledTimes(1);
    });

    it('should call "getProjection" for each of the input files', async function () {
      getProjectionMock.mockReturnValue('4326');
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg', 'unindexed.gpkg', 'test.tif'];
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => fileValidator.validateProjections(testData, 'files');
      await expect(action()).resolves.not.toThrow(BadRequestError);
      expect(getProjectionMock).toHaveBeenCalledTimes(3);
    });
  });
});
