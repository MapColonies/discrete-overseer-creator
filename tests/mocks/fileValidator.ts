import { FileValidator } from '../../src/layers/models/fileValidator';

const fileValidatorValidateExistsMock = jest.fn();
const validateSourceDirectoryMock = jest.fn();
const validateNotWatchDirMock = jest.fn();

const fileValidatorMock = {
  validateExists: fileValidatorValidateExistsMock,
  validateSourceDirectory: validateSourceDirectoryMock,
  validateNotWatchDir: validateNotWatchDirMock,
} as unknown as FileValidator;

export { fileValidatorValidateExistsMock, validateSourceDirectoryMock, validateNotWatchDirMock, fileValidatorMock };
