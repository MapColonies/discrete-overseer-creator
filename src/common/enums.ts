export enum MapServerCacheType {
  FS = 'FS',
  S3 = 'S3',
}

export enum JobAction {
  NEW = 'Ingestion_New',
  UPDATE = 'Ingestion_Update',
  SWAP_UPDATE = 'Ingestion_Swap_Update',
}

export enum TaskAction {
  SPLIT_TILES = 'tilesSplitting',
  MERGE_TILES = 'tilesMerging',
}

export enum SourceType {
  S3 = 'S3',
  FS = 'FS',
  GPKG = 'GPKG',
}

// todo - mutual enums with cache-seeder repo - should consider one source
export enum SeedMode {
  SEED = 'seed',
  CLEAN = 'clean',
}

export enum CacheType {
  S3 = 's3',
  REDIS = 'redis',
  GPKG = 'geopackage',
}
