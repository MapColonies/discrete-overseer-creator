import { GeoJSON } from 'geojson';

export interface InfoData {
  crs: number;
  fileFormat: string;
  pixelSize: number;
  extentPolygon: GeoJSON;
}
