import { GdalUtilities } from '../../src/utils/GDAL/gdalUtilities';

const getProjectionMock = jest.fn();

const gdalUtilitiesMock = {
  getProjection: getProjectionMock,
} as unknown as GdalUtilities;

export { getProjectionMock, gdalUtilitiesMock };
