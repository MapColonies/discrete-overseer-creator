import { IRasterCatalogUpsertRequestBody, ProductType, TileOutputFormat } from '@map-colonies/mc-model-types';
import { ITileRange } from '@map-colonies/mc-utils';
import { GeoJSON } from 'geojson';
import { BBox } from '@turf/helpers';
import { Grid, IBBox } from '../layers/interfaces';

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
}
