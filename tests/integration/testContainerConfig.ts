import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { Registry } from 'prom-client';
import { SERVICES } from '../../src/common/constants';
import { configMock, getMock, hasMock, init as initConfig } from '../mocks/config';
import { InjectionObject } from '../../src/common/dependencyRegistration';
import { layersRouterFactory, LAYERS_ROUTER_SYMBOL } from '../../src/layers/routes/layersRouter';
import { jobsRouterFactory, JOBS_ROUTER_SYMBOL } from '../../src/jobs/routes/jobsRouter';
import { tocRouterFactory, TOC_ROUTER_SYMBOL } from '../../src/toc/routes/tocRouter';
import { jobManagerClientMock } from '../mocks/clients/jobManagerClient';
import { mapPublisherClientMock } from '../mocks/clients/mapPublisherClient';
import { catalogClientMock } from '../mocks/clients/catalogClient';
import { JobManagerWrapper } from '../../src/serviceClients/JobManagerWrapper';
import { MapPublisherClient } from '../../src/serviceClients/mapPublisher';
import { CatalogClient } from '../../src/serviceClients/catalogClient';
import { GdalUtilities } from '../../src/utils/GDAL/gdalUtilities';
import { gdalUtilitiesMock } from '../mocks/gdalUtilitiesMock';
import { MetadataMerger } from '../../src/update/metadataMerger';
import { metadataMergerMock } from '../mocks/metadataMerger';
import { piscinaMock } from '../mocks/piscina/piscinaMock';

function getContainerConfig(): InjectionObject<unknown>[] {
  initConfig();
  return [
    { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    { token: SERVICES.PISCINA, provider: { useValue: piscinaMock } },
    { token: LAYERS_ROUTER_SYMBOL, provider: { useFactory: layersRouterFactory } },
    { token: JOBS_ROUTER_SYMBOL, provider: { useFactory: jobsRouterFactory } },
    { token: TOC_ROUTER_SYMBOL, provider: { useFactory: tocRouterFactory } },
    { token: JobManagerWrapper, provider: { useValue: jobManagerClientMock } },
    { token: MapPublisherClient, provider: { useValue: mapPublisherClientMock } },
    { token: CatalogClient, provider: { useValue: catalogClientMock } },
    { token: GdalUtilities, provider: { useValue: gdalUtilitiesMock } },
    { token: MetadataMerger, provider: { useValue: metadataMergerMock } },
    { token: SERVICES.METRICS_REGISTRY, provider: { useValue: new Registry() } },
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
