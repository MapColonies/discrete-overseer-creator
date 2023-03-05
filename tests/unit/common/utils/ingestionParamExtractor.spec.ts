import { filterLayerMetadata } from '../../../../src/common/utils/ingestionParamExtractor';

describe('ingestionParamExtractor', () => {
  describe('filterLayerMetadata', () => {
    it('Filtering returns properly filtered data', () => {
      const cleanData = {
        classification: 'test',
        description: 'test1',
        sensors: ['RGB'],
        footprint: {
          coordinates: [
            [
              [100, 0],
              [101, 0],
              [101, 1],
              [100, 1],
              [100, 0],
            ],
          ],
        },
      };
      const testData = {
        ...cleanData,
        badValue: 'should be eliminated',
        badValue2: {
          bad: 1,
          bad2: 2,
        },
      };
      const res = filterLayerMetadata(testData);
      expect(res).toEqual(cleanData);
    });
  });
});
