import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instancePerContainerCachingFactory } from 'tsyringe';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import client from 'prom-client';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layersRouterFactory, LAYERS_ROUTER_SYMBOL } from './layers/routes/layersRouter';
import { jobsRouterFactory, JOBS_ROUTER_SYMBOL } from './jobs/routes/jobsRouter';
import { tocRouterFactory, TOC_ROUTER_SYMBOL } from './toc/routes/tocRouter';
import { IConfig } from './common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: LAYERS_ROUTER_SYMBOL, provider: { useFactory: layersRouterFactory } },
    { token: JOBS_ROUTER_SYMBOL, provider: { useFactory: jobsRouterFactory } },
    { token: TOC_ROUTER_SYMBOL, provider: { useFactory: tocRouterFactory } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instancePerContainerCachingFactory((container) => {
          const config = container.resolve<IConfig>(SERVICES.CONFIG);

          if (config.get<boolean>('telemetry.metrics.enabled')) {
            client.register.setDefaultLabels({
              app: SERVICE_NAME,
            });
            return client.register;
          }
        }),
      },
    },
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

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
