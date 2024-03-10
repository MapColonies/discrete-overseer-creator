// this enum represent system internal mode - source tiles location (from FS or S3)
export enum MapServerCacheSource {
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

// todo - seem that not in use, validate if can be removed
export enum SourceType {
  S3 = 'S3',
  FS = 'FS',
  GPKG = 'GPKG',
}

// todo - mutual enums with cache-seeder repo - should consider one source
export enum MapServerSeedMode {
  SEED = 'seed',
  CLEAN = 'clean',
}

// This represent the mapproxy supported cache types
export enum MapServerCacheType {
  S3 = 's3',
  FS = 'file',
  REDIS = 'redis',
  GPKG = 'geopackage',
}
