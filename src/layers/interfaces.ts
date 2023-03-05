import { TileOutputFormat } from '@map-colonies/mc-model-types';
import { BBox } from '@turf/helpers';

export interface IPublishMapLayerRequest {
  name: string;
  tilesPath: string;
  cacheType: PublishedMapLayerCacheType;
  format: TileOutputFormat;
}

export enum PublishedMapLayerCacheType {
  FS = 'file',
  S3 = 's3',
  GPKG = 'geopackage',
}

export interface ITaskParameters {
  discreteId: string;
  version: string;
  originDirectory: string;
  minZoom: number;
  maxZoom: number;
  layerRelativePath: string;
  bbox: BBox;
}

export interface IBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export enum Grid {
  TWO_ON_ONE = '2X1',
  ONE_ON_ONE = '1X1',
}
