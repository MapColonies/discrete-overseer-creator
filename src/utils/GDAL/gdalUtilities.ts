import { Logger } from '@map-colonies/js-logger';
import * as gdal from 'gdal-async';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';

@singleton()
export class GdalUtilities {
  public constructor(@inject(SERVICES.LOGGER) protected readonly logger: Logger) {}

  public async getProjection(filePath: string): Promise<string | undefined> {
    try {
      this.logger.debug({
        filePath: filePath,
        msg: `[GdalUtilities][GetProjection] open file to read in path: ${filePath}`,
      });
      const dataset = await gdal.openAsync(filePath);
      const wktSRS = dataset.srs?.getAttrValue('AUTHORITY', 1);
      return wktSRS;
    } catch (err) {
      this.logger.error({
        filePath: filePath,
        msg: `[GdalUtilities][GetProjection] error occurred: ${(err as Error).message}`,
        err: err,
      });
      throw err;
    }
  }
}
