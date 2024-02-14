import { singleton } from 'tsyringe';
import { GeoJSON } from 'geojson';
import { union } from '@turf/turf';
import { LayerMetadata } from '@map-colonies/mc-model-types';
import { Footprint } from '@map-colonies/mc-utils';
import { getUTCDate } from '@map-colonies/mc-utils';
import { createBBoxString } from '../utils/bbox';

@singleton()
export class MetadataMerger {
  public merge(oldMetadata: LayerMetadata, updateMetadata: LayerMetadata, isSwap = false): LayerMetadata {
    const newMetadata: LayerMetadata = {
      ...oldMetadata,
      productVersion: updateMetadata.productVersion,
      sourceDateStart: isSwap
        ? updateMetadata.sourceDateStart
        : (oldMetadata.sourceDateStart as Date) <= (updateMetadata.sourceDateStart as Date)
          ? oldMetadata.sourceDateStart
          : updateMetadata.sourceDateStart,
      sourceDateEnd: isSwap
        ? updateMetadata.sourceDateEnd
        : (oldMetadata.sourceDateEnd as Date) >= (updateMetadata.sourceDateEnd as Date)
          ? oldMetadata.sourceDateEnd
          : updateMetadata.sourceDateEnd,
      ingestionDate: getUTCDate(),
      description: isSwap ? updateMetadata.description : (oldMetadata.description as string) + '\n' + (updateMetadata.description as string),
      minHorizontalAccuracyCE90: isSwap
        ? updateMetadata.minHorizontalAccuracyCE90 ?? 0
        : Math.max(oldMetadata.minHorizontalAccuracyCE90 ?? 0, updateMetadata.minHorizontalAccuracyCE90 ?? 0),
      footprint: isSwap
        ? (updateMetadata.footprint as Footprint)
        : (union(oldMetadata.footprint as Footprint, updateMetadata.footprint as Footprint)?.geometry as GeoJSON),
      region: isSwap ? updateMetadata.region : this.mergeUniqueArrays(oldMetadata.region, updateMetadata.region),
      rawProductData: undefined,
      maxResolutionDeg: isSwap
        ? (updateMetadata.maxResolutionDeg as number)
        : Math.min(oldMetadata.maxResolutionDeg as number, updateMetadata.maxResolutionDeg as number),
      maxResolutionMeter: isSwap
        ? (updateMetadata.maxResolutionMeter as number)
        : Math.min(oldMetadata.maxResolutionMeter as number, updateMetadata.maxResolutionMeter as number),
      displayPath: isSwap ? updateMetadata.displayPath : oldMetadata.displayPath,
      classification: isSwap ? updateMetadata.classification : this.mergeClassification(oldMetadata.classification, updateMetadata.classification),
    };
    newMetadata.productBoundingBox = createBBoxString(newMetadata.footprint as Footprint);
    newMetadata.sensors = isSwap ? updateMetadata.sensors : this.mergeUniqueArrays(oldMetadata.sensors, updateMetadata.sensors)
    return newMetadata;
  }

  private mergeUniqueArrays<T>(old?: T[], update?: T[]): T[] {
    const merged = new Set<T>();
    old?.forEach((value) => {
      merged.add(value);
    });
    update?.forEach((value) => {
      if (!merged.has(value)) {
        merged.add(value);
      }
    });
    return Array.from(merged);
  }

  private mergeClassification(oldClassification?: string, newClassification?: string): string {
    //note this requires numeric classification system.
    const DEFAULT_CLASSIFICATION = '4';
    if (oldClassification != undefined && newClassification != undefined) {
      return Math.min(parseInt(oldClassification), parseInt(newClassification)).toString();
    } else if (oldClassification != undefined) {
      return oldClassification;
    } else if (newClassification != undefined) {
      return newClassification;
    } else {
      return DEFAULT_CLASSIFICATION;
    }
  }
}
