import { singleton } from 'tsyringe';
import { GeoJSON } from 'geojson';
import { Feature, FeatureCollection, union, difference, MultiPolygon, featureCollection, Polygon } from '@turf/turf';
import { LayerMetadata } from '@map-colonies/mc-model-types';
import { Footprint } from '@map-colonies/mc-utils';
import { getUTCDate } from '@map-colonies/mc-utils';
import { createBBoxString } from '../utils/bbox';
import { layerMetadataToPolygonParts } from '../common/utils/polygonPartsBuilder';

@singleton()
export class MetadataMerger {
  public merge(oldMetadata: LayerMetadata, updateMetadata: LayerMetadata): LayerMetadata {
    const newMetadata: LayerMetadata = {
      ...oldMetadata,
      productVersion: updateMetadata.productVersion,
      sourceDateStart:
        (oldMetadata.sourceDateStart as Date) <= (updateMetadata.sourceDateStart as Date)
          ? oldMetadata.sourceDateStart
          : updateMetadata.sourceDateStart,
      sourceDateEnd:
        (oldMetadata.sourceDateEnd as Date) >= (updateMetadata.sourceDateEnd as Date) ? oldMetadata.sourceDateEnd : updateMetadata.sourceDateEnd,
      ingestionDate: getUTCDate(),
      minHorizontalAccuracyCE90: Math.max(oldMetadata.minHorizontalAccuracyCE90 ?? 0, updateMetadata.minHorizontalAccuracyCE90 ?? 0),
      layerPolygonParts: this.mergeLayerPolygonParts(updateMetadata, oldMetadata.layerPolygonParts),
      footprint: union(oldMetadata.footprint as Footprint, updateMetadata.footprint as Footprint)?.geometry as GeoJSON,
      region: this.mergeUniqueArrays(oldMetadata.region, updateMetadata.region),
      rawProductData: undefined,
      maxResolutionDeg: Math.min(oldMetadata.maxResolutionDeg as number, updateMetadata.maxResolutionDeg as number),
      maxResolutionMeter: Math.min(oldMetadata.maxResolutionMeter as number, updateMetadata.maxResolutionMeter as number),
      classification: this.mergeClassification(oldMetadata.classification, updateMetadata.classification),
    };
    newMetadata.productBoundingBox = createBBoxString(newMetadata.footprint as Footprint);
    newMetadata.sensors = this.polygonPartsToSensors(newMetadata.layerPolygonParts as FeatureCollection);
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

  private mergeLayerPolygonParts(updateMetadata: LayerMetadata, oldPolygonParts?: GeoJSON): GeoJSON | undefined {
    // handle one polygon part undefined state
    let updatePolygonParts = updateMetadata.layerPolygonParts;
    if (!oldPolygonParts) {
      return updatePolygonParts;
    } else if (!updateMetadata.layerPolygonParts) {
      updatePolygonParts = layerMetadataToPolygonParts(updateMetadata);
    }
    // handle polygon parts merging
    const updateFootprint = updateMetadata.footprint as Footprint;
    const oldFeatures = (oldPolygonParts as FeatureCollection).features;
    const updateFeatures = (updatePolygonParts as FeatureCollection).features;
    const newFeatures: Feature<Polygon | MultiPolygon>[] = [];
    // old features handling
    // for each old feature
    oldFeatures.forEach((feature : Feature<Polygon | MultiPolygon>) => {
      // clone old feature
      let updatedFeature: Feature<Polygon | MultiPolygon> | null = { ...(feature as Feature<Polygon | MultiPolygon>) };
      // remove new footprint from cloned old feature
      updatedFeature = difference(updatedFeature, updateFootprint);
      // if there is a leftover
      if (updatedFeature !== null) {
        // push leftover feature into new features collection
        newFeatures.push(updatedFeature);
      }
    });
    // push new features into new features collection
    updateFeatures.forEach((feature : Feature<Polygon | MultiPolygon>) => {
      newFeatures.push(feature as Feature<Polygon | MultiPolygon>);
    });
    return featureCollection(newFeatures);
  }

  private polygonPartsToSensors(layerPolygonParts?: FeatureCollection): string[] {
    if (!layerPolygonParts) {
      return [];
    }
    const sensors = new Set<string>();
    layerPolygonParts.features.forEach((feature) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const partSensors = (feature.properties as { SensorType: string }).SensorType.split(',');
      partSensors.forEach((sensor) => {
        if (!sensors.has(sensor)) {
          sensors.add(sensor);
        }
      });
    });
    return Array.from(sensors);
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
