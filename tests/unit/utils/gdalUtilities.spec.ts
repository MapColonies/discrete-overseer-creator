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

  describe('getProjection', () => {
    it('should return 4326 projection', async () => {
      const filePath = 'tests/mocks/files/indexed.gpkg';
      const result = await gdalUtilities.getProjection(filePath);
      expect(result).toBe('4326');
    });

    it('should return null as projection to unprojected file', async () => {
      const filePath = 'tests/mocks/files/unprojected.gpkg';
      const result = await gdalUtilities.getProjection(filePath);
      expect(result).toBeNull;
    });
  });
});
