//TODO: replace with model
export enum OperationStatus {
    PENDING = 'Pending',
    IN_PROGRESS = 'In-Progress',
    COMPLETED = 'Completed',
    FAILED = 'Failed',
    EXPIRED = 'Expired',
    ABORTED = 'Aborted',
  }
  
  export enum MapServerCacheType {
    FS = 'FS',
    S3 = 'S3',
  }
  
  export enum JobAction {
    NEW = 'Ingestion_New',
    UPDATE = 'Ingestion_Update',
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