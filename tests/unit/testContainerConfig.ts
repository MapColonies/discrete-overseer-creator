import { Registry } from 'prom-client';
import { metrics as OtelMetrics } from '@opentelemetry/api';
import { container } from 'tsyringe';
import Piscina from 'piscina';
import jsLogger from '@map-colonies/js-logger';
import { configMock, getMock, hasMock, init as initConfig } from '../mocks/config';
import { SERVICES, SERVICE_NAME } from '../../src/common/constants';
import { tracing } from '../../src/common/tracing';
import { InjectionObject } from '../../src/common/dependencyRegistration';
import { tracerMock } from '../mocks/tracer';
import { JobManagerWrapper } from '../../src/serviceClients/JobManagerWrapper';
import { MapPublisherClient } from '../../src/serviceClients/mapPublisher';
import { CatalogClient } from '../../src/serviceClients/catalogClient';
import { GdalUtilities } from '../../src/utils/GDAL/gdalUtilities';
import { MetadataMerger } from '../../src/update/metadataMerger';
import { jobManagerClientMock } from '../mocks/clients/jobManagerClient';
import { mapPublisherClientMock } from '../mocks/clients/mapPublisherClient';
import { catalogClientMock } from '../mocks/clients/catalogClient';
import { gdalUtilitiesMock } from '../mocks/gdalUtilitiesMock';
import { metadataMergerMock } from '../mocks/metadataMerger';
import { LAYERS_ROUTER_SYMBOL, layersRouterFactory } from '../../src/layers/routes/layersRouter';
import { JOBS_ROUTER_SYMBOL, jobsRouterFactory } from '../../src/jobs/routes/jobsRouter';
import { TOC_ROUTER_SYMBOL, tocRouterFactory } from '../../src/toc/routes/tocRouter';
import { splitTilesTaskerMock } from '../mocks/splitTilesTasker';
import { SplitTilesTasker } from '../../src/layers/models/splitTilesTasker';
import { MergeTilesTasker } from '../../src/merge/mergeTilesTasker';
import { mergeTilesTaskerMock } from '../mocks/mergeTilesTasker';
import { ZoomLevelCalculator } from '../../src/utils/zoomToResolution';
import { ingestionValidatorMock } from '../mocks/ingestionValidator';
import { IngestionValidator } from '../../src/layers/models/ingestionValidator';

tracing.start();
function getContainerConfig(): InjectionObject<unknown>[] {
  const piscina = new Piscina({
    filename: '/media/shlomiko/data/repositories/ingestion-repos/discrete-overseer-creator/dist/utils/piscina/worker.js'
  });
  const zoomLevelCalculator = new ZoomLevelCalculator(configMock);
  initConfig();
  return [
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
    { token: SERVICES.TRACER, provider: { useValue: tracerMock } },
    { token: LAYERS_ROUTER_SYMBOL, provider: { useFactory: layersRouterFactory } },
    { token: JOBS_ROUTER_SYMBOL, provider: { useFactory: jobsRouterFactory } },
    { token: TOC_ROUTER_SYMBOL, provider: { useFactory: tocRouterFactory } },
    { token: SERVICES.PISCINA, provider: { useValue: piscina } },
    { token: JobManagerWrapper, provider: { useValue: jobManagerClientMock } },
    { token: MapPublisherClient, provider: { useValue: mapPublisherClientMock } },
    { token: CatalogClient, provider: { useValue: catalogClientMock } },
    { token: GdalUtilities, provider: { useValue: gdalUtilitiesMock } },
    { token: MetadataMerger, provider: { useValue: metadataMergerMock } },
    { token: SplitTilesTasker, provider: { useValue: splitTilesTaskerMock } },
    { token: IngestionValidator, provider: { useValue: ingestionValidatorMock }},
    { token: MergeTilesTasker, provider: { useValue: mergeTilesTaskerMock } },
    { token: ZoomLevelCalculator, provider: { useValue: zoomLevelCalculator } },
    { token: SERVICES.METRICS_REGISTRY, provider: { useValue: new Registry() } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop()]);
          },
        },
      },
    },
  ];
}
const resetContainer = (clearInstances = true): void => {
  if (clearInstances) {
    container.clearInstances();
  }

  getMock.mockReset();
  hasMock.mockReset();
};

export { getContainerConfig, resetContainer };