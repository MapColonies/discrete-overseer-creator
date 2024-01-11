import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { SERVICES } from '../../../../src/common/constants';
import { GdalInfoValidator } from '../../../../src/layers/models/gdalInfoValidator';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import { gdalUtilitiesMock, getInfoDataMock } from '../../../mocks/gdalUtilitiesMock';

jest.mock('better-sqlite3');

describe('GdalInfoValidator', () => {
  beforeEach(function () {
    container.register(SERVICES.CONFIG, { useValue: configMock });
    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();
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
      const gdalInfoValidator = new GdalInfoValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => gdalInfoValidator.validateInfoData(testData, 'files');
      await expect(action()).resolves.not.toThrow(BadRequestError);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if infoData parameters are not valid', async function () {
      getInfoDataMock.mockReturnValue({ crs: 4325, fileFormat: 'GPKG', pixelSize: 0.0000000335276 });
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const gdalInfoValidator = new GdalInfoValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => gdalInfoValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(BadRequestError);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if infoData fails', async function () {
      getInfoDataMock.mockReturnValue(new Error());
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['indexed.gpkg'];
      const gdalInfoValidator = new GdalInfoValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => gdalInfoValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(Error);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });

    //TODO: wait for shaziri to give good ecw file
    it('should fail when ecw file  - invalid format', async function () {
      getInfoDataMock.mockReturnValue(new Error());
      setValue({ layerSourceDir: 'tests/mocks' });
      const testData: string[] = ['avi.ecw'];
      const gdalInfoValidator = new GdalInfoValidator(configMock, jsLogger({ enabled: false }), gdalUtilitiesMock);

      const action = async () => gdalInfoValidator.validateInfoData(testData, 'files');
      await expect(action).rejects.toThrow(Error);
      expect(getInfoDataMock).toHaveBeenCalledTimes(1);
    });
  });
});
