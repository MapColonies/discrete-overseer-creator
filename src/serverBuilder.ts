import express, { Router } from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { OpenapiViewerRouter, OpenapiRouterConfig } from '@map-colonies/openapi-express-viewer';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import getStorageExplorerMiddleware from '@map-colonies/storage-explorer-middleware';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpLogger from '@map-colonies/express-access-log-middleware';
import { SERVICES } from './common/constants';
import { IConfig } from './common/interfaces';
import { LAYERS_ROUTER_SYMBOL } from './layers/routes/layersRouter';
import { TASKS_ROUTER_SYMBOL } from './tasks/routes/tasksRouter';
import { TOC_ROUTER_SYMBOL } from './toc/routes/tocRouter';
import { makeInsensitive } from './utils/stringCapitalizationPermutations';


@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LAYERS_ROUTER_SYMBOL) private readonly layersRouter: Router,
    @inject(TASKS_ROUTER_SYMBOL) private readonly tasksRouter: Router,
    @inject(TOC_ROUTER_SYMBOL) private readonly tocRouter: Router
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildDocsRoutes(): void {
    const openapiRouter = new OpenapiViewerRouter(this.config.get<OpenapiRouterConfig>('openapiConfig'));
    openapiRouter.setup();
    this.serverInstance.use(this.config.get<string>('openapiConfig.basePath'), openapiRouter.getRouter());
  }

  private buildRoutes(): void {
    this.serverInstance.use('/layers', this.layersRouter);
    this.serverInstance.use('/tasks', this.tasksRouter);
    this.serverInstance.use('/toc', this.tocRouter);
    this.buildDocsRoutes();
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(httpLogger({ logger: this.logger }));

    if (this.config.get<boolean>('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get<compression.CompressionFilter>('server.response.compression.options')));
    }

    this.serverInstance.use(bodyParser.json(this.config.get<bodyParser.Options>('server.request.payload')));

    const ignorePathRegex = new RegExp(`^${this.config.get<string>('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get<string>('openapiConfig.filePath');
    this.serverInstance.use(OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: true, ignorePaths: ignorePathRegex }));
    this.serverInstance.enable('trust proxy'); // to provide real protocol from controller
    this.filePickerHandlerMiddleware();
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }

  private filePickerHandlerMiddleware(): void {
    const physicalDirPath = this.config.get<string>('layerSourceDir');
    const displayNameDir = this.config.get<string>('displayNameDir');
    const mountDirs = [
      {
        physical: physicalDirPath,
        displayName: displayNameDir,
        includeFilesExt: this.getFileExtensions(),
      },
    ];
    this.serverInstance.use(getStorageExplorerMiddleware(mountDirs, this.logger as unknown as Record<string, unknown>));
  }

  private getFileExtensions(): string[] {
    const extensionsStr = this.config.get<string>('validFileExtensions');
    const extensions = extensionsStr.split(',').map((ext) => ext.trim());
    return makeInsensitive(...extensions);
  }
}
