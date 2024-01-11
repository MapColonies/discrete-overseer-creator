import { extname } from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { PixelRange } from '../interfaces';
import { SQLiteClient } from '../../serviceClients/sqliteClient';
import { Grid } from '../interfaces';

@injectable()
export class GpkgValidator {
  private readonly sourceMount: string;
  private readonly validProjection = '4326';
  private readonly validCRS: number[];
  private readonly validFileFormat: string[];
  private readonly validPixelSizeRange: PixelRange;
  private readonly validTileSize: number;
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.sourceMount = this.config.get<string>('layerSourceDir');
    this.validCRS = this.config.get<number[]>('validationValuesByInfo.crs');
    this.validFileFormat = this.config.get<string[]>('validationValuesByInfo.fileFormat');
    this.validTileSize = this.config.get<number>('validationValuesByInfo.tileSize');
    this.validPixelSizeRange = this.config.get<PixelRange>('validationValuesByInfo.pixelSizeRange');
  }

  public validateGpkgFiles(files: string[], originDirectory: string): boolean {
    try {
      //TODO: add gpkg file validation once we remove the inforcment from swagger
      const message = 'Staring validating gpkg in GPKGValidator';
      this.logger.info({
        msg: message,
      });
      this.validateGpkgIndex(files, originDirectory);
      this.validateGpkgGrid(files, originDirectory);
      this.validateTilesWidthAndHeight(files, originDirectory);
      return true;
    } catch (err) {
      if (err instanceof BadRequestError) {
        const message = `Failed to validate File Gpkg: ${err.message}`;
        this.logger.error({
          msg: message,
          err: err,
        });
        throw new BadRequestError(message);
      } else {
        const message = `Failed to validate File Gpkg: ${(err as Error).message}`;
        this.logger.error({
          msg: message,
          err: err,
        });
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(message);
      }
    }
  }

  private validateGpkgIndex(files: string[], originDirectory: string): void {
    files.forEach((file) => {
      const sqliteClient = new SQLiteClient(this.config, this.logger, file, originDirectory);
      const index = sqliteClient.getGpkgIndex();
      if (!index) {
        const message = `Geopackage name: ${file} does not have a tiles index`;
        this.logger.error({
          originDirectory: originDirectory,
          fileName: file,
          msg: message,
        });
        throw new BadRequestError(message);
      }
    });
  }

  private isGpkg(files: string[]): boolean {
    if (!Array.isArray(files) || !files.length) {
      return false;
    }
    const validGpkgExt = '.gpkg';
    const allValid = files.every((file) => {
      return extname(file).toLowerCase() === validGpkgExt;
    });
    return allValid;
  }

  private validateGpkgGrid(files: string[], originDirectory: string): void {
    files.forEach((file) => {
      const sqliteClient = new SQLiteClient(this.config, this.logger, file, originDirectory);
      const grid: Grid | undefined = sqliteClient.getGrid();
      if (grid !== Grid.TWO_ON_ONE) {
        const message = `Geopackage name: ${file} grid is not two_on_one`;
        this.logger.error({
          originDirectory: originDirectory,
          fileName: file,
          msg: message,
        });
        throw new BadRequestError(message);
      }
    });
  }

  private validateTilesWidthAndHeight(files: string[], originDirectory: string): void {
    files.forEach((file) => {
      const sqliteClient = new SQLiteClient(this.config, this.logger, file, originDirectory);
      const tilesSizes = sqliteClient.getGpkgTileWidthAndHeight();
      if (tilesSizes.tileWidth !== this.validTileSize || tilesSizes.tileHeight !== this.validTileSize) {
        const message = `Geopackage name: ${file} - tile sizes are not 256`;
        this.logger.error({
          originDirectory: originDirectory,
          fileName: file,
          msg: message,
        });
        throw new BadRequestError(message);
      }
    });
  }
}
