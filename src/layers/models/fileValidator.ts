import { promises as fsPromises, constants as fsConstants } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';

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
}
