import { ILinkBuilderData, LinkBuilder } from '../../../../src/jobs/models/linksBuilder';
import { getMock as configGetMock, configMock, init as initMockConfig } from '../../../mocks/config';
import { filesManagerMock } from '../../../mocks/filesManager';

let linkBuilder: LinkBuilder;
describe('LinkBuilder', () => {
  beforeEach(function () {
    jest.resetAllMocks();
    initMockConfig();
  });

  describe('createLinks', () => {
    it('do nothing if some tasks are not done', function () {
      const linksTemplate = `[{
            "name": "",
            "description": "",
            "protocol": "WMTS",
            "url": "{{serverUrl}}/wmts/1.0.0/WMTSCapabilities.xml"
          },
          {
            "name": "b",
            "description": "",
            "protocol": "WMTS_BASE",
            "url": "{{serverUrl}}/wmts"
          },
          {
            "name": "a",
            "description": "{{layerName}}",
            "protocol": "WMTS_tile",
            "url": "{{serverUrl}}/wmts/{{layerName}}/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.png"
          }]`;
      const testData: ILinkBuilderData = {
        layerName: 'testLayer',
        serverUrl: 'https://testUrl',
      };
      configGetMock.mockReturnValue('config/linkTemplates.template');
      jest.spyOn(filesManagerMock, 'readFileSync').mockReturnValue(linksTemplate);

      linkBuilder = new LinkBuilder(configMock, filesManagerMock);

      const res = linkBuilder.createLinks(testData);

      const expectedLink = [
        {
          name: '',
          description: '',
          protocol: 'WMTS',
          url: 'https://testUrl/wmts/1.0.0/WMTSCapabilities.xml',
        },
        {
          name: 'b',
          description: '',
          protocol: 'WMTS_BASE',
          url: 'https://testUrl/wmts',
        },
        {
          name: 'a',
          description: 'testLayer',
          protocol: 'WMTS_tile',
          url: 'https://testUrl/wmts/testLayer/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.png',
        },
      ];

      expect(res).toEqual(expectedLink);
    });
  });
});
