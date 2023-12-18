import { promises as fsPromises, constants as fsConstants } from 'node:fs';
import { join, extname } from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { SQLiteClient } from '../../serviceClients/sqliteClient';
import { GdalUtilities } from '../../utils/GDAL/gdalUtilities';
import { Grid } from '../interfaces';

@injectable()
export class FileValidator {
  private readonly sourceMount: string;
  private readonly validProjection = '4326';
  private readonly validCRS = 4326;
  private readonly validFileFormat = 'GPKG';
  private readonly validPixelSizeRange = {
    min: 0.000000335276,
    max: 0.703125,
  };
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly gdalUtilities: GdalUtilities
  ) {
    this.sourceMount = this.config.get<string>('layerSourceDir');
  }

  public validateSourceDirectory(srcDir: string): boolean {
    if (!srcDir) {
      const message = `"originDirectory" is empty, files should be stored on specific directory`;
      this.logger.info({
        sourceDirectory: srcDir,
        msg: message,
      });
      return false;
    } else {
      return true;
    }
  }

  public validateNotWatchDir(srcDir: string): boolean {
    const watchDir = this.config.get('watchDirectory');
    if (srcDir === watchDir) {
      const message = `"originDirectory" can't be with same name as watch directory (${watchDir})`;
      this.logger.info({
        sourceDirectory: srcDir,
        msg: message,
      });
      return false;
    } else {
      return true;
    }
  }

  public async validateExists(srcDir: string, files: string[]): Promise<boolean> {
    const filePromises = files.map(async (file) => {
      const fullPath = join(this.sourceMount, srcDir, file);
      return fsPromises
        .access(fullPath, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
    });
    const allValid = (await Promise.all(filePromises)).every((value) => value);
    return allValid;
  }

  public validateGpkgFiles(files: string[], originDirectory: string): boolean {
    const isExtensionValid = this.validateGpkgExtension(files);
    if (!isExtensionValid) {
      return false;
    }
    //TODO: add here all GPKG validations
    this.validateGpkgIndex(files, originDirectory);
    this.validateGpkgGrid(files, originDirectory);
    return true;
  }

  public validateGpkgIndex(files: string[], originDirectory: string): void {
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

  public validateGpkgGrid(files: string[], originDirectory: string): void {
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

  public async validateProjections(files: string[], originDirectory: string): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        const filePath = join(this.sourceMount, originDirectory, file);
        const projection = await this.gdalUtilities.getProjection(filePath);
        if (projection !== this.validProjection) {
          const message = `Unsupported projection: ${projection as string}, for input file: ${filePath}, must have valid projection: ${
            this.validProjection
          }`;
          this.logger.error({
            filePath: filePath,
            msg: message,
          });
          throw new BadRequestError(message);
        }
      })
    );
  }

  public async validateInfoData(files: string[], originDirectory: string): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        const filePath = join(this.sourceMount, originDirectory, file);
        const projection = await this.gdalUtilities.getProjection(filePath);
        const infoData = await this.gdalUtilities.getInfoData(filePath);
        //TODO: seperate to different mini-functions?
        let message = '';
        if (infoData.crs !== this.validCRS) {
          message = `Unsupported crs: ${infoData.crs}, for input file: ${filePath}, must have valid crs: ${this.validProjection}`;
        }
        if (infoData.fileFormat !== this.validFileFormat) {
          message += `Unsupported file format: ${infoData.fileFormat}, for input file: ${filePath}, must have valid crs: ${this.validProjection}`;
        }
        if (infoData.pixelSize > this.validPixelSizeRange.max || infoData.pixelSize < this.validPixelSizeRange.min) {
          message += `Unsupported pixel size: ${infoData.pixelSize}, for input file: ${filePath}, not in the range of: ${this.validPixelSizeRange.min} to ${this.validPixelSizeRange.max}`;
        }
        if (projection !== this.validProjection) {
          message += `Unsupported projection: ${projection as string}, for input file: ${filePath}, must have valid projection: ${
            this.validProjection
          }`;
        }
        if (message !== '') {
          this.logger.error({
            filePath: filePath,
            msg: message,
          });
          throw new BadRequestError(message);
        }
      })
    );
  }

  private validateGpkgExtension(files: string[]): boolean {
    if (!Array.isArray(files) || !files.length) {
      return false;
    }
    const validGpkgExt = '.gpkg';
    const allValid = files.every((file) => {
      return extname(file).toLowerCase() === validGpkgExt;
    });
    return allValid;
  }
}
