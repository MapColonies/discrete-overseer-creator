import { Logger } from '@map-colonies/js-logger';
import * as gdal from 'gdal-async';
import { inject, singleton } from 'tsyringe';
import { GeoJSON } from 'geojson';
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
      const dataset: gdal.Dataset = await gdal.openAsync(filePath);
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
      const message = err instanceof Error ? `${err.message}` : 'failed to get gdal info on file';
      this.logger.error({
        filePath: filePath,
        msg: `[GdalUtilities][GetInfoData] error occurred: ${message}`,
        err: err,
      });
      throw new Error(message);
    }
  }

  public async getFootprint(filePath: string): Promise<{ footprint: GeoJSON; resolutionDegree: number } | undefined> {
    try {
      this.logger.debug({
        filePath: filePath,
        msg: `[GdalUtilities][GetFootprint] open file to read in path: ${filePath}`,
      });
      const dataset: gdal.Dataset = await gdal.openAsync(filePath);
      const jsonString = await gdal.infoAsync(dataset, ['-json']);
      //eslint-disable-next-line @typescript-eslint/naming-convention
      const data = JSON.parse(jsonString) as { wgs84Extent: GeoJSON };
      const footprint: GeoJSON = data.wgs84Extent;
      const resolutionDegree = 3;
      // Best practice is to close the data set after use -> https://mmomtchev.github.io/node-gdal-async/
      dataset.close();
      return { footprint: footprint, resolutionDegree: resolutionDegree };
    } catch (err) {
      this.logger.error({
        filePath: filePath,
        msg: `[GdalUtilities][GetFootprint] error occurred: ${(err as Error).message}`,
        err: err,
      });
      throw err;
    }
  }
}
