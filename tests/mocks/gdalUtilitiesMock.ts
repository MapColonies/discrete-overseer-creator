import { GdalUtilities } from '../../src/utils/GDAL/gdalUtilities';

const getProjectionMock = jest.fn();
const getInfoDataMock = jest.fn();

const gdalUtilitiesMock = {
  getProjection: getProjectionMock,
  getInfoData: getInfoDataMock,
} as unknown as GdalUtilities;

export { getInfoDataMock, getProjectionMock, gdalUtilitiesMock };
