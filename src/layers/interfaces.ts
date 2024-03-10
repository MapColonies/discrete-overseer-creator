import { TileOutputFormat } from '@map-colonies/mc-model-types';
import { BBox } from '@turf/helpers';
import { InfoData } from '../utils/interfaces';

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

export interface PixelRange {
  min: number;
  max: number;
}

export interface SourcesValidationParams {
  fileNames: string[];
  originDirectory: string;
}

export interface SourcesValidationResponse {
  isValid: boolean;
  reason?: string;
}

export interface SourcesInfoRequest {
  fileNames: string[];
  originDirectory: string;
}

interface SourcesInfoResponse {
  fileName: string;
  info: InfoData;
}

export interface SourcesInfoResponses extends Array<SourcesInfoResponse> {}
