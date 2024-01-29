
import { IMergeTilesTaskParams } from '../../../../src/utils/piscina/worker';
import Piscina from 'piscina';
import { tracerMock } from '../../../mocks/tracer';
import { JobAction, TaskAction } from '../../../../src/common/enums';
import { Grid } from '../../../../src/layers/interfaces';
import { validTestData } from '../../../integration/layers/layers.spec';



describe('createMergeTilesTasks', () => {
    beforeEach(function () {
        jest.resetAllMocks();
    });

    describe('runMergeTiles', () => {
        it('run merge tiles', async () => {
            const piscina = new Piscina({ filename: '/media/shlomiko/data/repositories/ingestion-repos/discrete-overseer-creator/tests/unit/utils/piscina/worker.spec.ts' })
            const params: IMergeTilesTaskParams = {
                tracer: tracerMock,
                data: validTestData,
                layerRelativePath: 'test/OrthophotoHistory',
                taskType: TaskAction.MERGE_TILES,
                jobType: JobAction.NEW,
                grids: [Grid.TWO_ON_ONE],
                extent: [34.90156677832806, 32.410349688281244, 36.237901242471565, 33.96885230417779],
                managerCallbackUrl: 'http://localhostTest',
                isNew: true
            };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            const action = async () => piscina.run({ params });
            await expect(action).rejects.toThrow(Error);
        });
    });
});
