import config from 'config';

export const isPixelSizeValid = (requestedPixelSize: number, sourcePixelSize: number): boolean => {
  const resolutionFixedPointTolerance = config.get<number>('validationValuesByInfo.resolutionFixedPointTolerance');
  const fixedRequestedPixelSize = parseFloat(requestedPixelSize.toFixed(resolutionFixedPointTolerance));
  const fixedSourcePixelSize = parseFloat(sourcePixelSize.toFixed(resolutionFixedPointTolerance));
  return fixedRequestedPixelSize >= fixedSourcePixelSize;
};
