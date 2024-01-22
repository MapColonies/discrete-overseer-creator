import Piscina from 'piscina';

const runMock = jest.fn();

const piscinaMock = {
  run: runMock,
} as unknown as Piscina;

export { piscinaMock, runMock };
