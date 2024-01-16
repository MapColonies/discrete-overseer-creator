import { join } from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import { BadRequestError } from '@map-colonies/error-types';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { PixelRange } from '../interfaces';
import { GdalUtilities } from '../../utils/GDAL/gdalUtilities';
import { InfoData } from '../../utils/interfaces';

@injectable()
export class GdalInfoValidator {
  private readonly sourceMount: string;
  private readonly validCRSs: number[];
  private readonly validFileFormats: string[];
  private readonly validPixelSizeRange: PixelRange;
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    private readonly gdalUtilities: GdalUtilities
  ) {
    this.sourceMount = this.config.get<string>('layerSourceDir');
    this.validCRSs = this.config.get<number[]>('validationValuesByInfo.crs');
    this.validFileFormats = this.config.get<string[]>('validationValuesByInfo.fileFormat').map((format) => {
      return format.toLowerCase();
    });
    this.validPixelSizeRange = this.config.get<PixelRange>('validationValuesByInfo.pixelSizeRange');
  }

  public async validateInfoData(files: string[], originDirectory: string): Promise<boolean> {
    try {
      await Promise.all(
        files.map(async (file) => {
          const filePath = join(this.sourceMount, originDirectory, file);
          const infoData = (await this.gdalUtilities.getInfoData(filePath)) as InfoData;
          let message = '';
          if (!this.validCRSs.includes(infoData.crs)) {
            message = `Unsupported crs: ${infoData.crs}, for input file: ${filePath}, must have valid crs: ${this.validCRSs.toString()}.`;
          }
          if (!this.validFileFormats.includes(infoData.fileFormat.toLowerCase())) {
            message += `Unsupported file format: ${
              infoData.fileFormat
            }, for input file: ${filePath}, must have valid file format: ${this.validFileFormats.toString()}.`;
          }
          if (infoData.pixelSize > this.validPixelSizeRange.max || infoData.pixelSize < this.validPixelSizeRange.min) {
            message += `Unsupported pixel size: ${infoData.pixelSize}, for input file: ${filePath}, not in the range of: ${this.validPixelSizeRange.min} to ${this.validPixelSizeRange.max}.`;
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
      return true;
    } catch (err) {
      if (err instanceof BadRequestError) {
        const message = `Failed to validate File GDAL Info: ${err.message}`;
        this.logger.error({
          msg: message,
          err: err,
        });
        throw new BadRequestError(message);
      } else {
        const message = `Failed to validate File GDAL Info: ${(err as Error).message}`;
        this.logger.error({
          msg: message,
          err: err,
        });
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(message);
      }
    }
  }
}
