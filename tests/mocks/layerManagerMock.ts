import { LayersManager } from '../../src/layers/models/layersManager';

const validateJobNotRunningMock = jest.fn();

const layersManagerMock = {
  validateJobNotRunning: validateJobNotRunningMock,
} as unknown as LayersManager;

export { validateJobNotRunningMock, layersManagerMock };
