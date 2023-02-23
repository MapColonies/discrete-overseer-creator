import { promises as fsPromises, constants as fsConstants } from 'fs';
import { join, extname } from 'path';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { SQLiteClient } from '../../serviceClients/sqliteClient';

@injectable()
export class FileValidator {
  private readonly sourceMount: string;
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
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
    this.validateGpkgIndex(files, originDirectory);
    return true;
  }

  public validateGpkgIndex(files: string[], originDirectory: string): void {
    files.forEach((file) => {
      const sqliteClient = new SQLiteClient(this.config, this.logger, file, originDirectory);
      const index = sqliteClient.getGpkgIndex();
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
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
