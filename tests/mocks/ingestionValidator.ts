import { IngestionValidator } from '../../src/layers/models/ingestionValidator';

const validateGpkgFilesMock = jest.fn();
const validateGdalInfoMock = jest.fn();
const validateSourceDirectoryMock = jest.fn();
const validateNotWatchDirMock = jest.fn();
const fileValidatorValidateExistsMock = jest.fn();
const validateIsGpkgMock = jest.fn();

const ingestionValidatorMock = {
  validateGpkgFiles: validateGpkgFilesMock,
  validateGdalInfo: validateGdalInfoMock,
  validateSourceDirectory: validateSourceDirectoryMock,
  validateNotWatchDir: validateNotWatchDirMock,
  validateExists: fileValidatorValidateExistsMock,
  validateIsGpkg: validateIsGpkgMock,
} as unknown as IngestionValidator;

export {
  validateGpkgFilesMock,
  validateGdalInfoMock,
  validateSourceDirectoryMock,
  validateNotWatchDirMock,
  fileValidatorValidateExistsMock,
  validateIsGpkgMock,
  ingestionValidatorMock,
};
