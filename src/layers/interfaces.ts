import { TileOutputFormat } from '@map-colonies/mc-model-types';
import { BBox } from '@turf/helpers';
import { InfoData } from '../utils/interfaces';

interface IPublishMapLayerRequest {
  name: string;
  tilesPath: string;
  cacheType: PublishedMapLayerCacheType;
  format: TileOutputFormat;
}

interface IGetCacheRequest {
  layerName: string;
  cacheType: PublishedMapLayerCacheType;
}

interface IGetCacheResponse {
  cacheName: string;
  cache: { type: PublishedMapLayerCacheType };
}

enum PublishedMapLayerCacheType {
  FS = 'file',
  S3 = 's3',
  GPKG = 'geopackage',
  REDIS = 'redis',
}

interface ITaskParameters {
  discreteId: string;
  version: string;
  originDirectory: string;
  minZoom: number;
  maxZoom: number;
  layerRelativePath: string;
  bbox: BBox;
}

interface IBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

enum Grid {
  TWO_ON_ONE = '2X1',
  ONE_ON_ONE = '1X1',
}

interface PixelRange {
  min: number;
  max: number;
}

interface SourcesValidationParams {
  fileNames: string[];
  originDirectory: string;
}

interface SourcesValidationResponse {
  isValid: boolean;
  reason?: string;
}

interface SourcesInfoRequest {
  fileNames: string[];
  originDirectory: string;
}

interface SourcesInfoResponse {
  fileName: string;
  info: InfoData;
}

export interface SourcesInfoResponses extends Array<SourcesInfoResponse> {}

export {
  IPublishMapLayerRequest,
  IGetCacheRequest,
  IGetCacheResponse,
  PublishedMapLayerCacheType,
  ITaskParameters,
  IBBox,
  Grid,
  PixelRange,
  SourcesValidationParams,
  SourcesValidationResponse,
  SourcesInfoRequest,
};
