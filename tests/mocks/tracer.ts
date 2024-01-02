import { Tracer } from '@opentelemetry/api';

const startSpanMock = jest.fn();
const startActiveSpanMock = jest.fn();
const setStatusMock = jest.fn();
const recordExceptionMock = jest.fn();
const endMock = jest.fn();

const tracerMock = {
  startSpan: startSpanMock,
  startActiveSpan: startActiveSpanMock,
  setStatus: setStatusMock,
  recordException: recordExceptionMock,
  end: endMock,
} as unknown as Tracer;

export { tracerMock, startSpanMock, startActiveSpanMock, setStatusMock, recordExceptionMock, endMock };
