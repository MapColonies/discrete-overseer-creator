import { ZoomLevelCalculator } from '../../../src/utils/zoomToResolution';
import { init as initMockConfig, setValue, configMock } from '../../mocks/config';

let zoomLevelCalculator: ZoomLevelCalculator;

describe('zoomToResulation', () => {
  beforeEach(function () {
    jest.resetAllMocks();
    initMockConfig();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    setValue({ 'tiling.zoomGroups': ['0-10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'] });
    zoomLevelCalculator = new ZoomLevelCalculator(configMock);
  });

  describe('check zoom ranges by resolution and config zoom ranges', () => {
    it('Check for resolution res = 2.14576721191406e-5, zoom level 15 return 6 tasks', function () {
      const zoomLevelResult = zoomLevelCalculator.createLayerZoomRanges(2.14576721191406e-5);
      expect(zoomLevelResult).toHaveLength(6);
      expect(zoomLevelResult[zoomLevelResult.length - 1].minZoom).toBe(15);
      expect(zoomLevelResult[zoomLevelResult.length - 1].maxZoom).toBe(15);
    });

    it('Check for resolution res = 2.04576721191406e-5, zoom level > 15 && zoom level < 16 return 7 tasks', function () {
      const zoomLevelResult = zoomLevelCalculator.createLayerZoomRanges(2.04576721191406e-5);
      expect(zoomLevelResult).toHaveLength(6);
      expect(zoomLevelResult[zoomLevelResult.length - 1].minZoom).toBe(15);
      expect(zoomLevelResult[zoomLevelResult.length - 1].maxZoom).toBe(15);
    });

    it('Check for resolution res = 0.02197265625, zoom level = 5 return 1 task', function () {
      const zoomLevelResult = zoomLevelCalculator.createLayerZoomRanges(0.02197265625);
      expect(zoomLevelResult).toHaveLength(1);
      expect(zoomLevelResult[zoomLevelResult.length - 1].minZoom).toBe(0);
      expect(zoomLevelResult[zoomLevelResult.length - 1].maxZoom).toBe(5);
    });
  });
});
