import { inject, singleton } from 'tsyringe';
import { degreesPerPixelToZoomLevel } from '@map-colonies/mc-utils';
import { ITaskZoomRange } from '../jobs/interfaces';
import { SERVICES } from '../common/constants';
import { IConfig } from '../common/interfaces';
import { Logger } from '@map-colonies/js-logger';
import { isArray } from 'lodash';

@singleton()
export class ZoomLevelCalculator {
  private readonly zoomRanges: ITaskZoomRange[];

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    const batches = config.get<string>('tiling.zoomGroups');
    logger.info({ msg: `batches: ${batches}, ${isArray(batches)} type: ${typeof batches}` });

    this.zoomRanges = this.getZoomRanges(batches);
  }

  public createLayerZoomRanges(resolution: number): ITaskZoomRange[] {
    const maxZoom = degreesPerPixelToZoomLevel(resolution);
    const layerZoomRanges = this.zoomRanges
      .filter((range) => {
        return range.minZoom <= maxZoom;
      })
      .map((range) => {
        const taskRange: ITaskZoomRange = { minZoom: range.minZoom, maxZoom: range.maxZoom <= maxZoom ? range.maxZoom : maxZoom };
        return taskRange;
      });
    return layerZoomRanges;
  }

  private getZoomRanges(batches: string[]): ITaskZoomRange[] {
    const zoomRanges = batches.map((batch) => {
      const limits = batch.split('-').map((value) => Number.parseInt(value));
      const zoomRange: ITaskZoomRange = {
        minZoom: Math.min(...limits),
        maxZoom: Math.max(...limits),
      };
      return zoomRange;
    });
    return zoomRanges;
  }
}
