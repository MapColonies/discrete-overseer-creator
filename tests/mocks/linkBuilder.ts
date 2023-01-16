import { LinkBuilder } from '../../src/jobs/models/linksBuilder';

const createLinksMock = jest.fn();

const linkBuilderMock = {
  createLinks: createLinksMock,
} as unknown as LinkBuilder;

export { createLinksMock, linkBuilderMock };
