import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { LayersController } from '../controllers/layersController';

const layersRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(LayersController);

  router.post('/', controller.createLayer.bind(controller));
  router.post('/validateSources', controller.validateSources.bind(controller));
  router.post('/sourcesInfo', controller.getSourcesGdalInfo.bind(controller));

  return router;
};

export const LAYERS_ROUTER_SYMBOL = Symbol('layersRouterFactory');

export { layersRouterFactory };
