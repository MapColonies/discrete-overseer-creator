
import nock from 'nock';
import Piscina from 'piscina';
import { JobManagerWrapper } from '../../../src/serviceClients/JobManagerWrapper';
import { IMergeTilesTaskParams } from '../../../src/utils/piscina/worker';
import { JobAction, TaskAction } from '../../../src/common/enums';
import { Grid } from '../../../src/layers/interfaces';
import { validTestData } from '../../unit/utils/mock/data';
import { configMock, init as initMockConfig, clear as clearConfig } from '../../mocks/config';
import { MergeTilesTasker } from '../../../src/merge/mergeTilesTasker';
import { getContainerConfig, resetContainer } from '../testContainerConfig';
import { getApp } from '../../../src/app';
import { LayersRequestSender } from '../layers/helpers/requestSender';


jest.mock('../../../src/serviceClients/JobManagerWrapper.ts');
describe('createMergeTilesTasks', () => {
    beforeEach(function () {
        const app = getApp({
            override: [...getContainerConfig()],
            useChild: false,
        });
        initMockConfig();
    });
    afterEach(function () {
        clearConfig();
        resetContainer();
        jest.resetAllMocks();
        nock.cleanAll();
    })


    describe('runMergeTiles', () => {
        it('run merge tiles', async () => {
            //expect.assertions(3)
            const createLaterJobStub = jest.spyOn(JobManagerWrapper.prototype, 'createLayerJob');
            const createMergeTilesTasksStub = jest.spyOn(MergeTilesTasker.prototype, 'createMergeTilesTasks')
            const jobManagerUrl = configMock.get<string>('jobManagerURL');
            console.log("job", jobManagerUrl)
            nock(jobManagerUrl).post(`/jobs`).reply(200);
            const piscina = new Piscina({ filename: '/media/shlomiko/data/repositories/ingestion-repos/discrete-overseer-creator/dist/utils/piscina/worker.js', maxThreads: 1 })
            const params: IMergeTilesTaskParams = {
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
            const action = piscina.run(params);
            await expect(action).resolves.not.toThrow();
            await expect(action).resolves.toHaveLastReturnedWith('sdaffs')
            expect(createLaterJobStub).toHaveBeenCalledTimes(1);
        }, 60000);
    });
});
