import { Tracing } from '@map-colonies/telemetry';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { Attributes, Context, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { IGNORED_INCOMING_TRACE_ROUTES, IGNORED_OUTGOING_TRACE_ROUTES } from './constants';

export const tracing = new Tracing([
  new HttpInstrumentation({
    ignoreIncomingPaths: IGNORED_INCOMING_TRACE_ROUTES,
    ignoreOutgoingUrls: IGNORED_OUTGOING_TRACE_ROUTES,
  }),
  new ExpressInstrumentation(),
]);

export const asyncCallInSpan = async <T>(
  fn: () => Promise<T>,
  tracer: Tracer,
  spanName: string,
  spanAttributes?: Attributes,
  context?: Context
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const span = tracer.startSpan(spanName, { attributes: spanAttributes }, context);
    fn()
      .then((result) => {
        handleSpanOnSuccess(span);
        resolve(result);
      })
      .catch((error) => {
        handleSpanOnError(span, error);
        reject(error);
      });
  });
};

export const callInSpan = <T>(fn: () => T, tracer: Tracer, spanName: string, spanAttributes?: Attributes, context?: Context): T => {
  const span = tracer.startSpan(spanName, { attributes: spanAttributes }, context);
  try {
    const result = fn();
    handleSpanOnSuccess(span);
    return result;
  } catch (error) {
    handleSpanOnError(span, error);
    throw error;
  }
};

export const handleSpanOnSuccess = (span?: Span): void => {
  if (span === undefined) {
    return;
  }

  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
};

export const handleSpanOnError = (span?: Span, error?: unknown): void => {
  if (span === undefined) {
    return;
  }

  span.setStatus({ code: SpanStatusCode.ERROR });

  if (error instanceof Error) {
    span.recordException(error);
  }

  span.end();
};
