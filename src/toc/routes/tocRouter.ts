import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { TocController } from '../controllers/tocController';

const tocRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(TocController);

  router.post('/', controller.getToc.bind(controller));

  return router;
};

export const TOC_ROUTER_SYMBOL = Symbol('tocRouterFactory');

export { tocRouterFactory };
