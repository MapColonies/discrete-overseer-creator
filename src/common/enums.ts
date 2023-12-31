export enum MapServerCacheType {
  FS = 'FS',
  S3 = 'S3',
}

export enum JobAction {
  NEW = 'Ingestion_New_Ranny',
  UPDATE = 'Ingestion_Update_Ranny',
}

export enum TaskAction {
  SPLIT_TILES = 'tilesSplitting_Ranny',
  MERGE_TILES = 'tilesMerging_Ranny',
}

export enum SourceType {
  S3 = 'S3',
  FS = 'FS',
  GPKG = 'GPKG',
}
