import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { withSpanV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { GpkgValidator } from './gpkgValidator';
import { GdalInfoValidator } from './gdalInfoValidator';
import { FileValidator } from './fileValidator';

@injectable()
export class IngestionValidator {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    private readonly gpkgValidator: GpkgValidator,
    private readonly gdalInfoValidator: GdalInfoValidator,
    private readonly fileValidator: FileValidator
  ) {}
  
  @withSpanV4
  public validateGpkgFiles(files: string[], originDirectory: string): boolean {
    return this.gpkgValidator.validateGpkgFiles(files, originDirectory);
  }

  @withSpanV4
  public async validateGdalInfo(files: string[], originDirectory: string): Promise<boolean> {
    return this.gdalInfoValidator.validateInfoData(files, originDirectory);
  }

  public validateIsGpkg(files: string[]): boolean {
    return this.gpkgValidator.isGpkg(files);
  }

  public validateSourceDirectory(srcDir: string): boolean {
    return this.fileValidator.validateSourceDirectory(srcDir);
  }

  public validateNotWatchDir(srcDir: string): boolean {
    return this.fileValidator.validateNotWatchDir(srcDir);
  }

  public async validateExists(srcDir: string, files: string[]): Promise<boolean> {
    return this.fileValidator.validateExists(srcDir, files);
  }
}
