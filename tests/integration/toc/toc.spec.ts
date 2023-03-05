import { InternalServerError, NotFoundError } from '@map-colonies/error-types';
import httpStatusCodes from 'http-status-codes';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { getContainerConfig } from '../testContainerConfig';
import { findRecordMock } from '../../mocks/clients/catalogClient';
import { TocRequestSender } from './helpers/requestSender';
import { invalidTestData, validTestData, validTestImageMetadata, validTestJsonResponseData, validTestXmlResponseData } from './helpers/data';

describe('toc', function () {
  let requestSender: TocRequestSender;
  beforeAll(function () {
    const app = getApp({
      override: [...getContainerConfig()],
      useChild: false,
    });
    requestSender = new TocRequestSender(app);
  });

  beforeEach(function () {
    console.warn = jest.fn();
  });

  afterEach(function () {
    jest.resetAllMocks();
    container.clearInstances();
  });

  describe('Happy Path', function () {
    it('should return 200 status code when expecting json response', async function () {
      findRecordMock.mockImplementation(() => {
        return validTestImageMetadata;
      });

      const response = await requestSender.getMetadata(validTestData);
      // TODO: remove the test comment when the following issue will be solved: https://github.com/openapi-library/OpenAPIValidators/issues/257
      // expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toEqual(validTestJsonResponseData);
    });

    it('should return 200 status code when expecting xml response', async function () {
      findRecordMock.mockImplementation(() => {
        return validTestImageMetadata;
      });

      const response = await requestSender.getMetadata(validTestData, 'application/xml');
      // TODO: remove the test comment when the following issue will be solved: https://github.com/openapi-library/OpenAPIValidators/issues/257
      // expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.text).toEqual(validTestXmlResponseData);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400
    it('should return 400 status code', async function () {
      const response = await requestSender.getMetadata(invalidTestData);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX
    it('should return 404 if requsted layer does not exist', async function () {
      findRecordMock.mockImplementation(() => {
        throw new NotFoundError('test error');
      });

      const response = await requestSender.getMetadata(validTestData);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
    });

    it('should return 500 status code on db error', async function () {
      findRecordMock.mockImplementation(() => {
        throw new InternalServerError('test error');
      });
      const response = await requestSender.getMetadata(validTestData);
      expect(response).toSatisfyApiSpec();

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
