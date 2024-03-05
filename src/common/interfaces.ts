import { IRasterCatalogUpsertRequestBody, ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';
import { ITileRange } from '@map-colonies/mc-utils';
import { GeoJSON } from 'geojson';
import { BBox } from '@turf/helpers';
import { Grid, IBBox } from '../layers/interfaces';
import { MapServerCacheType, MapServerSeedMode } from './enums';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IUpdateRecordResponse {
  id: string;
  status: string;
}

export interface IRecordIds {
  id: string;
  displayPath: string;
}

export interface IFindResponseRecord extends IRasterCatalogUpsertRequestBody {
  id: string;
}

export type FindRecordResponse = IFindResponseRecord[];

export interface ILayerMergeData {
  fileName: string;
  tilesPath: string;
  footprint?: GeoJSON;
}

export interface IMergeParameters {
  layers: ILayerMergeData[];
  destPath: string;
  maxZoom: number;
  grids: Grid[];
  extent: BBox;
  targetFormat: TileOutputFormat;
}

export interface IMergeOverlaps {
  layers: ILayerMergeData[];
  intersection: GeoJSON;
}

export interface IMergeSources {
  type: string;
  path: string;
  grid?: Grid;
  extent?: IBBox;
}

export interface IMergeTaskParams {
  targetFormat: TileOutputFormat;
  isNewTarget: boolean;
  sources: IMergeSources[];
  batches: ITileRange[];
}

export interface ISupportedIngestionSwapTypes {
  productType: ProductType;
  productSubType: string;
}

export interface ICleanupData {
  previousRelativePath: string;
  previousProductVersion: string;
}

// todo - should consider refactor it to mutual type packages
export interface ISeed {
  mode: MapServerSeedMode;
  grid: string;
  fromZoomLevel: number;
  toZoomLevel: number;
  geometry: GeoJSON;
  skipUncached: boolean;
  layerId: string; // cache name as configured in mapproxy
  refreshBefore: string;
}

export interface ISeedTaskParams {
  seedTasks: ISeed[];
  catalogId: string;
  spanId: string;
  cacheType: MapServerCacheType;
}
