import jsLogger from '@map-colonies/js-logger';
import { IngestionParams, LayerMetadata, ProductType, RecordType } from '@map-colonies/mc-model-types';
import { JobAction, TaskAction } from '../../../../src/common/enums';
import { SplitTilesTasker } from '../../../../src/layers/models/splitTilesTasker';
import { jobManagerClientMock } from '../../../mocks/clients/jobManagerClient';
import { configMock, init as initConfig, setValue } from '../../../mocks/config';
import { ITaskParameters } from '../../../../src/layers/interfaces';
import { tracerMock } from '../../../mocks/tracer';

describe('SplitTilesTasker', () => {
  let splitTilesTasker: SplitTilesTasker;
  let generateTasksParametersSpy: jest.SpyInstance;

  const testImageMetadata = {
    productId: 'test',
    productVersion: '1.22',
    productName: 'test name',
    description: 'test desc',
    minHorizontalAccuracyCE90: 3,
    maxResolutionDeg: 2.68220901489258e-6,
    rms: 0.5,
    scale: 3,
    sensors: ['OTHER', 'Test'],
    footprint: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 90],
          [90, 90],
          [90, 0],
          [0, 0],
        ],
      ],
    },
    classification: '',
    creationDate: new Date('02/01/2020'),
    producerName: 'testProducer',
    productType: ProductType.ORTHOPHOTO_HISTORY,
    productSubType: undefined,
    region: ['testRegion1', 'testRegion2'],
    sourceDateEnd: new Date('06/01/2020'),
    sourceDateStart: new Date('05/01/2020'),
    srsId: '4326',
    srsName: 'WGS84GEO',
    type: RecordType.RECORD_RASTER,
    includedInBests: undefined,
    maxResolutionMeter: 0.2,
    productBoundingBox: undefined,
    rawProductData: undefined,
  } as unknown as LayerMetadata;

  const testData: IngestionParams = {
    fileNames: ['file.test'],
    metadata: testImageMetadata,
    originDirectory: '/here',
  };
  const layerRelativePath = `test/OrthophotoHistory`;
  const paramTemplate = {
    discreteId: 'test',
    version: '1.22',
    originDirectory: '/here',
    layerRelativePath: layerRelativePath,
  };

  beforeEach(() => {
    initConfig();
  });

  describe('createSplitTilesTasks', () => {
    it('split the tasks based on configuration', async function () {
      splitTilesTasker = new SplitTilesTasker(configMock, jsLogger({ enabled: false }), tracerMock, jobManagerClientMock);
      generateTasksParametersSpy = jest.spyOn(SplitTilesTasker.prototype, 'generateTasksParameters');

      // eslint-disable-next-line @typescript-eslint/naming-convention
      setValue({ 'tiling.zoomGroups': ['1', '8-5', '2'] });

      await splitTilesTasker.createSplitTilesTasks(
        testData,
        layerRelativePath,
        [
          { minZoom: 1, maxZoom: 1 },
          { minZoom: 5, maxZoom: 8 },
          { minZoom: 2, maxZoom: 2 },
        ],
        JobAction.NEW,
        TaskAction.SPLIT_TILES
      );

      expect(generateTasksParametersSpy).toHaveBeenCalledTimes(1);
      expect(generateTasksParametersSpy).toHaveBeenCalledWith(testData, layerRelativePath, [
        { minZoom: 1, maxZoom: 1 },
        { minZoom: 5, maxZoom: 8 },
        { minZoom: 2, maxZoom: 2 },
      ]);
    });
  });

  describe('generateTasksParameters', () => {
    it('generate tasks for multiple ranges', async () => {
      setValue('ingestionTilesSplittingTiles.bboxSizeTiles', 10000);
      const zoomRanges = [
        { minZoom: 1, maxZoom: 1 },
        { minZoom: 5, maxZoom: 8 },
        { minZoom: 2, maxZoom: 2 },
      ];
      splitTilesTasker = new SplitTilesTasker(configMock, jsLogger({ enabled: false }), tracerMock, jobManagerClientMock);

      const gen = splitTilesTasker.generateTasksParameters(testData, layerRelativePath, zoomRanges);
      const params: ITaskParameters[] = [];
      for await (const param of gen) {
        params.push(param);
      }

      const expectedTasks = [
        { ...paramTemplate, minZoom: 1, maxZoom: 1, bbox: [0, -90, 180, 90] },
        { ...paramTemplate, minZoom: 5, maxZoom: 8, bbox: [0, 0, 45, 45] },
        { ...paramTemplate, minZoom: 5, maxZoom: 8, bbox: [0, 45, 45, 90] },
        { ...paramTemplate, minZoom: 5, maxZoom: 8, bbox: [45, 0, 90, 45] },
        { ...paramTemplate, minZoom: 5, maxZoom: 8, bbox: [45, 45, 90, 90] },
        { ...paramTemplate, minZoom: 2, maxZoom: 2, bbox: [0, -90, 180, 90] },
      ];

      expect(params).toEqual(expectedTasks);
    });
  });
});
