import { inject, singleton } from 'tsyringe';
import { degreesPerPixelToZoomLevel } from '@map-colonies/mc-utils';
import { Tracer } from '@opentelemetry/api';
import { withSpanV4 } from '@map-colonies/telemetry';
import { ITaskZoomRange } from '../jobs/interfaces';
import { SERVICES } from '../common/constants';
import { IConfig } from '../common/interfaces';

@singleton()
export class ZoomLevelCalculator {
  private readonly zoomRanges: ITaskZoomRange[];

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.TRACER) public readonly tracer: Tracer) {
    const batches = config.get<string[]>('tiling.zoomGroups');
    this.zoomRanges = this.getZoomRanges(batches);
  }

  @withSpanV4
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
