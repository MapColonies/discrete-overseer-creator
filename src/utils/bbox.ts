import { BBox, bbox, bboxPolygon, buffer, Feature } from '@turf/turf';
import { GeoJSON } from 'geojson';

export const createBBoxString = (footprint: GeoJSON): string => {
  const bboxCords = bbox(footprint);
  //format: "minX,minY,maxX,maxY"
  return `${bboxCords[0]},${bboxCords[1]},${bboxCords[2]},${bboxCords[3]}`;
};

export const bboxToFootprint = (bbox: BBox): GeoJSON => {
  //convert it to Polygon feature
  const footprint = bboxPolygon(bbox);
  return footprint;
};

export const extentBuffer = (extentBuffer: number, extent: GeoJSON): GeoJSON => {
  return buffer(extent as Feature, extentBuffer, { units: 'meters' });
};
