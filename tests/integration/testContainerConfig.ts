// import { container } from 'tsyringe';
// import jsLogger from '@map-colonies/js-logger';
// import { SERVICES } from '../../src/common/constants';
// import { JobManagerClient } from '../../src/serviceClients/jobManagerClient';
// import { MapPublisherClient } from '../../src/serviceClients/mapPublisher';
// import { catalogClientMock } from '../mocks/clients/catalogClient';
// import { mapPublisherClientMock } from '../mocks/clients/mapPublisherClient';
// import { jobManagerClientMock } from '../mocks/clients/jobManagerClient';
// import { CatalogClient } from '../../src/serviceClients/catalogClient';
// import { configMock, init as initConfig } from '../mocks/config';

// function registerTestValues(): void {
//   initConfig();
//   container.register(SERVICES.CONFIG, { useValue: configMock });
//   container.register(SERVICES.LOGGER, { useValue: jsLogger({enabled: false}) });
//   container.register(JobManagerClient, { useValue: jobManagerClientMock });
//   container.register(MapPublisherClient, { useValue: mapPublisherClientMock });
//   container.register(CatalogClient, { useValue: catalogClientMock });
// }

// export { registerTestValues };

import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { SERVICES } from '../../src/common/constants';
import { configMock, registerDefaultConfig, getMock, hasMock, } from '../mocks/config';
import { InjectionObject } from '../../src/common/dependencyRegistration';
import { layersRouterFactory, LAYERS_ROUTER_SYMBOL } from '../../src/layers/routes/layersRouter';
import { jobsRouterFactory, JOBS_ROUTER_SYMBOL } from '../../src/jobs/routes/jobsRouter';
import { tocRouterFactory, TOC_ROUTER_SYMBOL } from '../../src/toc/routes/tocRouter';
import { jobManagerClientMock } from '../mocks/clients/jobManagerClient';
import { mapPublisherClientMock } from '../mocks/clients/mapPublisherClient';
import { catalogClientMock } from '../mocks/clients/catalogClient';
import { JobManagerClient } from '../../src/serviceClients/jobManagerClient';
import { MapPublisherClient } from '../../src/serviceClients/mapPublisher';
import { CatalogClient } from '../../src/serviceClients/catalogClient';

function getContainerConfig(): InjectionObject<unknown>[] {
  registerDefaultConfig();
  return [
    { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
    { token: SERVICES.CONFIG, provider: { useValue: configMock } },
    { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
    { token: LAYERS_ROUTER_SYMBOL, provider: { useFactory: layersRouterFactory } },
    { token: JOBS_ROUTER_SYMBOL, provider: { useFactory: jobsRouterFactory } },
    { token: TOC_ROUTER_SYMBOL, provider: { useFactory: tocRouterFactory } },
    { token: JobManagerClient , provider: { useValue: jobManagerClientMock }},
    { token: MapPublisherClient , provider: { useValue: mapPublisherClientMock }},
    { token: CatalogClient , provider: { useValue: catalogClientMock }},
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