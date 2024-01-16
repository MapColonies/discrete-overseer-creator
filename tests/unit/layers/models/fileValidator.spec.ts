import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { SERVICES } from '../../../../src/common/constants';
import { FileValidator } from '../../../../src/layers/models/fileValidator';
import { init as initMockConfig, configMock, setValue, clear as clearMockConfig } from '../../../mocks/config';

jest.mock('better-sqlite3');

describe('FileValidator', () => {
  beforeEach(function () {
    container.register(SERVICES.CONFIG, { useValue: configMock });
    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    clearMockConfig();
    initMockConfig();
  });

  describe('validateSourceDir', () => {
    it('should return false if sourceDir is null', function () {
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }));
      const result = fileValidator.validateSourceDirectory('');
      expect(result).toBe(false);
    });

    it('should return true if sourceDir is not empty', function () {
      setValue({ layerSourceDir: 'tests/mocks' });
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }));
      const result = fileValidator.validateSourceDirectory('avi');
      expect(result).toBe(true);
    });
  });

  describe('validateSourceAgainstWatch', () => {
    it('should return true if sourceDir is different from watchDir', function () {
      setValue({ watchDirectory: 'tests/mocks' });
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }));
      const result = fileValidator.validateNotWatchDir('avi');
      expect(result).toBe(true);
    });

    it('should return false if sourceDir is same as watchDir', function () {
      setValue({ watchDirectory: 'tests/mocks' });
      const fileValidator = new FileValidator(configMock, jsLogger({ enabled: false }));
      const result = fileValidator.validateNotWatchDir('tests/mocks');
      expect(result).toBe(false);
    });
  });
});
