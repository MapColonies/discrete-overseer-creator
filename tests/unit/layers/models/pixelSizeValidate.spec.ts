import jsLogger from '@map-colonies/js-logger';
import { zoomLevelToResolutionDeg } from '@map-colonies/mc-utils';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';
import { GdalUtilities } from '../../../../src/utils/GDAL/gdalUtilities';
import { isPixelSizeValid } from '../../../../src/utils/pixelSizeValidate';

const gdalUtilities = new GdalUtilities(jsLogger({ enabled: false }));
let resolutionFixedPointTolerance: number;
describe('pizelSizeValidate', function () {
  beforeEach(() => {
    clearMockConfig();
    initMockConfig();
    setValue('validationValuesByInfo.resolutionFixedPointTolerance', 12);
    resolutionFixedPointTolerance = configMock.get<number>('validationValuesByInfo.resolutionFixedPointTolerance');
  });

  it('should return valid pixel size for zoom level 0', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_0.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(0) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 1', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_1.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(1) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 2', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_2.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(2) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 3', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_3.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(3) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 4', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_4.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(4) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 5', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_5.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(5) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 6', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_6.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(6) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 7', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_7.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(7) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 8', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_8.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(8) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 9', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_9.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(9) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 10', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_10.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(10) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 11', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_11.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(11) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 12', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_12.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(12) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 13', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_13.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(13) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 14', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_14.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(14) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 15', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_15.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(15) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 16', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_16.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(16) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 17', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_17.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(17) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 18', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_18.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(18) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 19', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_19.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(19) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 20', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_20.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(20) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });

  it('should return valid pixel size for zoom level 21', async function () {
    const infoData = await gdalUtilities.getInfoData('tests/mocks/files/gpkg_resolution_files/zoom_21.gpkg');
    const isValidPixelSize = isPixelSizeValid(zoomLevelToResolutionDeg(21) as number, infoData?.pixelSize as number, resolutionFixedPointTolerance);
    expect(isValidPixelSize).toBe(true);
  });
});
