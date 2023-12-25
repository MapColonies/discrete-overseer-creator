import { FileValidator } from '../../src/layers/models/fileValidator';

const fileValidatorValidateExistsMock = jest.fn();
const validateSourceDirectoryMock = jest.fn();
const validateNotWatchDirMock = jest.fn();
const validateGpkgFilesMock = jest.fn();
// const validateProjectionsMock = jest.fn();
const validateInfoDataMock = jest.fn();

const fileValidatorMock = {
  validateExists: fileValidatorValidateExistsMock,
  validateSourceDirectory: validateSourceDirectoryMock,
  validateNotWatchDir: validateNotWatchDirMock,
  validateGpkgFiles: validateGpkgFilesMock,
  // validateProjections: validateProjectionsMock,
  validateInfoData: validateInfoDataMock,
} as unknown as FileValidator;

export {
  fileValidatorValidateExistsMock,
  validateSourceDirectoryMock,
  validateGpkgFilesMock,
  validateNotWatchDirMock,
  // validateProjectionsMock,
  fileValidatorMock,
};
