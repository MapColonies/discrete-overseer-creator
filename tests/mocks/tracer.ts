import { Tracer } from '@opentelemetry/api';

const startSpanMock = jest.fn();
const startActiveSpanMock = jest.fn();

const tracerMock = {
  startSpan: startSpanMock,
  startActiveSpan: startActiveSpanMock,
} as unknown as Tracer;

export { tracerMock, startSpanMock, startActiveSpanMock };
