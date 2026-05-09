import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    tracesSampleRate: 0,
    attachStacktrace: true,
  });
  initialized = true;
}

export function wrapWithSentry<T>(component: T): T {
  if (!DSN) return component;
  return Sentry.wrap(component as never) as unknown as T;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
