import { clearConfigCache } from 'prettier';
import { getApp } from '../../../src/app';
import { setValue } from '../../mocks/config';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { LayersRequestSender } from './helpers/requestSender';
import { InfoData } from '../../../src/utils/interfaces';
import httpStatusCodes from 'http-status-codes';
// import { getInfoDataMock } from '../../mocks/gdalUtilitiesMock';
import { GdalUtilities } from '../../../src/utils/GDAL/gdalUtilities';

const validFilesForInfo = {
  fileNames: ['blueMarble.gpkg', 'indexed.gpkg'],
  originDirectory: '/files',
};
const ReversedValidFilesForInfo = {
  fileNames: ['indexed.gpkg', 'blueMarble.gpkg'],
  originDirectory: '/files',
};
const blueMarbleGdalInfo: InfoData = {
  crs: 4326,
  fileFormat: 'GPKG',
  pixelSize: 0.0439453125,
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
const indexedGdalInfo: InfoData = {
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

describe('/layers/sourcesInfo', function () {
  let requestSender: LayersRequestSender;
  beforeEach(function () {
    console.warn = jest.fn();
    setValue('tiling.zoomGroups', ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    setValue('ingestionTilesSplittingTiles.tasksBatchSize', 2);
    setValue('ingestionMergeTiles.tasksBatchSize', 10000);
    setValue('layerSourceDir', 'tests/mocks');
    setValue('watchDirectory', 'watch');

    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    requestSender = new LayersRequestSender(app);

    const func = GdalUtilities.prototype.getInfoData;
    const spy = jest.spyOn(GdalUtilities.prototype, 'getInfoData');
    spy.mockImplementation((args) => func(args));
  });
  afterEach(function () {
    clearConfigCache();
    resetContainer();
    jest.resetAllMocks();
  });
  describe('Happy path on /layers/sourcesInfo', function () {
    it('should return 200 status code with info in correct order', async function () {
      const response = await requestSender.getInfo(validFilesForInfo);
      console.log(response.body);
      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(blueMarbleGdalInfo);
      expect(response.body[1]).toEqual(indexedGdalInfo);

      const reversedResponse = await requestSender.getInfo(ReversedValidFilesForInfo);
      expect(reversedResponse.body[0]).toEqual(indexedGdalInfo);
      expect(reversedResponse.body[1]).toEqual(blueMarbleGdalInfo);
    });
  });
  describe('Sad path on /layers/sourcesInfo', function () {
    it('should return 404 when given a file that does not exist', async function () {
      const notExistsFile = {
        fileNames: ['notExists.gpkg'],
        originDirectory: '/files',
      };
      const response = await requestSender.getInfo(notExistsFile);
      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
    });

    it('should return 400 when gdalInfo fails', async function () {
      const invalidData = {
        fileNames: ['invalidFile.gpkg'],
        originDirectory: '/files',
      };

      const response = await requestSender.getInfo(invalidData);
      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });
  });
});
