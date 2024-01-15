import { Logger } from '@map-colonies/js-logger';
import * as gdal from 'gdal-async';
import { inject, singleton } from 'tsyringe';
import { GeoJSON } from 'geojson';
import { BadRequestError } from '@map-colonies/error-types';
import { SERVICES } from '../../common/constants';
import { InfoData } from '../interfaces';

@singleton()
export class GdalUtilities {
  public constructor(@inject(SERVICES.LOGGER) protected readonly logger: Logger) {}

  public async getInfoData(filePath: string): Promise<InfoData | undefined> {
    try {
      this.logger.debug({
        filePath: filePath,
        msg: `get gdal info for path: ${filePath}`,
      });
      const dataset: gdal.Dataset = (await this.getDataset(filePath)) as gdal.Dataset;
      const jsonString = await gdal.infoAsync(dataset, ['-json']);
      //eslint-disable-next-line @typescript-eslint/naming-convention
      const data = JSON.parse(jsonString) as { stac: { 'proj:epsg': number }; geoTransform: number[]; driverShortName: string; wgs84Extent: GeoJSON };
      const crs: number = data.stac['proj:epsg'];
      const fileFormat: string = data.driverShortName;
      const pixelSize: number = data.geoTransform[1];
      const footprint: GeoJSON = data.wgs84Extent;
      const infoData: InfoData = {
        crs: crs,
        fileFormat: fileFormat,
        pixelSize: pixelSize,
        footprint: footprint,
      };
      // Best practice is to close the data set after use -> https://mmomtchev.github.io/node-gdal-async/
      dataset.close();
      return infoData;
    } catch (err) {
      if (err instanceof BadRequestError) {
        throw new BadRequestError(err.message);
      } else {
        const message = err instanceof Error ? `${err.message}` : 'failed to get gdal info on file';
        this.logger.error({
          filePath: filePath,
          msg: `[GdalUtilities][GetInfoData] error occurred: ${message}`,
          err: err,
        });
        throw new Error(message);
      }
    }
  }

  private async getDataset(filePath: string): Promise<gdal.Dataset | undefined> {
    try {
      return await gdal.openAsync(filePath);
    } catch (err) {
      const message = 'failed to open dataset';
      this.logger.error({
        filePath: filePath,
        msg: `[GdalUtilities][getDataset] error occurred: ${message}`,
        err: err,
      });
      throw new BadRequestError(message);
    }
  }
}
