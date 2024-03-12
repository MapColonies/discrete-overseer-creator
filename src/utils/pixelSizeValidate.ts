import config from 'config';

export const pixelSizeValidate = (requestedPixelSize: number, sourcePixelSize: number): boolean => {
  const resolutionTolerance = config.get<number>('resolutionTolerance');
  const fixedRequestedPixelSize = parseFloat(requestedPixelSize.toFixed(resolutionTolerance));
  const fixedSourcePixelSize = parseFloat(sourcePixelSize.toFixed(resolutionTolerance));
  return fixedRequestedPixelSize >= fixedSourcePixelSize;
};
