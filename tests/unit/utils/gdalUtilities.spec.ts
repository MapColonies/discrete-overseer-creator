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

  describe('getInfoData', () => {
    it('should extract CRS, fileFormat, pixelSize and footprint from gpkg file', async () => {
      const filePath = 'tests/mocks/files/indexed.gpkg';
      const result = await gdalUtilities.getInfoData(filePath);
      const expected = {
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
      };
      expect(result).toStrictEqual(expected);
    });

    it('should extract CRS, fileFormat, pixelSize and footprint from tiff file', async () => {
      const filePath = 'tests/mocks/files/bluemarble_4km.tif';
      const result = await gdalUtilities.getInfoData(filePath);
      const expected = {
        crs: 4326,
        fileFormat: 'GTiff',
        pixelSize: 0.0333333333333333,
        footprint: {
          type: 'Polygon',
          coordinates: [
            [
              [-180, 90],
              [-180, -90],
              [180, -90],
              [180, 90],
              [-180, 90],
            ],
          ],
        },
      };
      expect(result).toStrictEqual(expected);
    });

    it('should throw error when fails to extract data', async () => {
      const filePath = 'tests/mocks/files/invalidFile.gpkg';
      const action = async () => gdalUtilities.getInfoData(filePath);
      await expect(action).rejects.toThrow(Error);
    });

    //TODO: This test should pass when we have appropriate GDAL version with ECW licence
    it('should throw error when recieves ecw file', async () => {
      const filePath = 'tests/mocks/files/test.ecw';
      const action = async () => gdalUtilities.getInfoData(filePath);
      await expect(action).rejects.toThrow(Error);
    });
  });
});
