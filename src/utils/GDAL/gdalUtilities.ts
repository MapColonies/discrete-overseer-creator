import { Logger } from '@map-colonies/js-logger';
import * as gdal from 'gdal-async';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { InfoData } from '../interfaces';

@singleton()
export class GdalUtilities {
  public constructor(@inject(SERVICES.LOGGER) protected readonly logger: Logger) {}

  public async getProjection(filePath: string): Promise<string | undefined> {
    try {
      this.logger.debug({
        filePath: filePath,
        msg: `[GdalUtilities][GetProjection] open file to read in path: ${filePath}`,
      });
      const dataset: gdal.Dataset = await gdal.openAsync(filePath);
      const wktSRS = dataset.srs?.getAttrValue('AUTHORITY', 1);
      // Best practice is to close the data set after use -> https://mmomtchev.github.io/node-gdal-async/
      dataset.close();
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

  public async getInfoData(filePath: string): Promise<InfoData | undefined> {
    try {
      this.logger.debug({
        filePath: filePath,
        msg: `get gdal info for path: ${filePath}`,
      });
      const dataset: gdal.Dataset = await gdal.openAsync(filePath);
      const jsonString = await gdal.infoAsync(dataset, ['-json']);
      //eslint-disable-next-line @typescript-eslint/naming-convention
      const data = JSON.parse(jsonString) as { stac: { 'proj:epsg': number }; geoTransform: number[]; driverShortName: string };
      const crs: number = data.stac['proj:epsg'];
      const fileFormat: string = data.driverShortName;
      const pixelSize: number = data.geoTransform[1];
      //TODO: see if we can add projection to here/ use CRS instead of projection
      const infoData: InfoData = {
        crs: crs,
        fileFormat: fileFormat,
        pixelSize: pixelSize,
      };
      // Best practice is to close the data set after use -> https://mmomtchev.github.io/node-gdal-async/
      dataset.close();
      return infoData;
    } catch (err) {
      const message = err instanceof Error ? `${err.message}` : 'failed to get gdal info on file';
      this.logger.error({
        filePath: filePath,
        msg: `[GdalUtilities][GetInfoData] error occurred: ${message}`,
        err: err,
      });
      throw err;
    }
  }
}
