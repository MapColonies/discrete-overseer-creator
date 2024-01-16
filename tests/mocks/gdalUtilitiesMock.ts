import { GdalUtilities } from '../../src/utils/GDAL/gdalUtilities';

const getInfoDataMock = jest.fn();

const gdalUtilitiesMock = {
  getInfoData: getInfoDataMock,
} as unknown as GdalUtilities;

export { getInfoDataMock, gdalUtilitiesMock };
