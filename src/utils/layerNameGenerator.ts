import { ProductType } from '@map-colonies/mc-model-types';

export function getMapServingLayerName(productId: string, productType: ProductType, isRedisEnabled: boolean): string {
  const layerName = isRedisEnabled ? `${productId}-${productType}`: `${productId}-${productType}-source`
  return layerName;
}
