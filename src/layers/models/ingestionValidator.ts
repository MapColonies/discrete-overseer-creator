import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { PixelRange } from '../interfaces';
import { GpkgValidator } from './gpkgValidator';
import { GdalInfoValidator } from './gdalInfoValidator';
import { FileValidator } from './fileValidator';

@injectable()
export class IngestionValidator {
  private readonly sourceMount: string;
  private readonly validProjection = '4326';
  private readonly validCRS: number[];
  private readonly validFileFormat: string[];
  private readonly validPixelSizeRange: PixelRange;
  private readonly validTileSize: number;
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly gpkgValidator: GpkgValidator,
    private readonly gdalInfoValidator: GdalInfoValidator,
    private readonly fileValidator: FileValidator
  ) {
    this.sourceMount = this.config.get<string>('layerSourceDir');
    this.validCRS = this.config.get<number[]>('validationValuesByInfo.crs');
    this.validFileFormat = this.config.get<string[]>('validationValuesByInfo.fileFormat');
    this.validTileSize = this.config.get<number>('validationValuesByInfo.tileSize');
    this.validPixelSizeRange = this.config.get<PixelRange>('validationValuesByInfo.pixelSizeRange');
  }

  public validateGpkgFiles(files: string[], originDirectory: string): boolean {
    return this.gpkgValidator.validateGpkgFiles(files, originDirectory);
  }

  public async validateGdalInfo(files: string[], originDirectory: string): Promise<boolean> {
    return this.gdalInfoValidator.validateInfoData(files, originDirectory);
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
