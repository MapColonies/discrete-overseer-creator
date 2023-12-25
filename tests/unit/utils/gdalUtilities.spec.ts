import jsLogger from '@map-colonies/js-logger';
import { GdalUtilities } from '../../../src/utils/GDAL/gdalUtilities';
import { init as initMockConfig } from '../../mocks/config';

let gdalUtilities: GdalUtilities;

describe('gdalUtilities', () => {
  beforeAll(() => {
    gdalUtilities = new GdalUtilities(jsLogger({ enabled: false }));
  });
  beforeEach(function () {
    jest.resetAllMocks();
    initMockConfig();
  });

  // describe('getProjection', () => {
  //   it('should return 4326 projection', async () => {
  //     const filePath = 'tests/mocks/files/indexed.gpkg';
  //     const result = await gdalUtilities.getProjection(filePath);
  //     expect(result).toBe('4326');
  //   });

  //   it('should return null as projection to unprojected file', async () => {
  //     const filePath = 'tests/mocks/files/unprojected.gpkg';
  //     const result = await gdalUtilities.getProjection(filePath);
  //     expect(result).toBeNull();
  //   });
  // });

  describe('getInfoData', () => {
    it('should extract CRS, fileFormat and pixelSize', async () => {
      const filePath = 'tests/mocks/files/indexed.gpkg';
      const result = await gdalUtilities.getInfoData(filePath);
      const expected = { crs: 4326, fileFormat: 'GPKG', pixelSize: 0.001373291015625 };
      expect(result).toStrictEqual(expected);
    });

    it('should throw error when fails to extract data', async () => {
      const filePath = 'tests/mocks/files/text.gpkg';
      const action = async () => gdalUtilities.getInfoData(filePath);
      await expect(action).rejects.toThrow(Error);
    });
  });
});
