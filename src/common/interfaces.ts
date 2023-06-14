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

//todo - should be implemented on mc-models on future
export interface IUpdateLayerMetadata {
  classification: string | undefined;
  productId: string | undefined;
  productName: string | undefined;
  productVersion: string | undefined;
  productType: ProductType | undefined
  productSubType: string | undefined;
  description: string | undefined;
  srsId: string | undefined;
  srsName: string | undefined;
  producerName: string | undefined;
  sourceDateStart: Date | undefined;
  sourceDateEnd: Date | undefined;
  maxResolutionDeg: number | undefined;
  maxResolutionMeter: number | undefined;
  minHorizontalAccuracyCE90: number | undefined;
  sensors: string[] | undefined;
  region: string[] | undefined;
  footprint: GeoJSON | undefined;
}
//todo - should be implemented on mc-models on future
export interface UpdateParams {
  /**
   * List of the layer files
   */
  fileNames: string[];
  /**
   * layer directory relative to mount
   */
  originDirectory: string;
  /**
   * layer metadata
   */
  partData: IUpdateLayerMetadata[];
}