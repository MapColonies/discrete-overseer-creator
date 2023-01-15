import { LayerMetadata, ProductType } from '@map-colonies/mc-model-types';

export enum TocOperation {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  REMOVE = 'REMOVE',
}

export enum SchemaType {
  JSON = 'application/json',
  XML = 'application/xml',
}

export interface ITocParams {
  operation: TocOperation;
  productType: ProductType;
  productId: string;
  productVersion: string;
}

export interface ITocResponse {
  operation: TocOperation;
  productType: ProductType;
  metadata: LayerMetadata;
}
