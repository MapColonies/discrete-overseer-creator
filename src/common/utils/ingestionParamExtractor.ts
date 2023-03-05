import { keys, cloneDeepWith, pick } from 'lodash';
import { LayerMetadata } from '@map-colonies/mc-model-types';

export const filterLayerMetadata = (originalRequestMetadata: unknown): LayerMetadata => {
  const layerMetadataKeys = keys(new LayerMetadata());
  const filteredMetadata: LayerMetadata = cloneDeepWith(pick(originalRequestMetadata, layerMetadataKeys)) as LayerMetadata;
  return filteredMetadata;
};
