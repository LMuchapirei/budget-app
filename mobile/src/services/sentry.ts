import * as Sentry from '@sentry/react-native';
import { isDiagnosticsEnabled, loadDiagnosticsPref } from './diagnostics';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) return;
  void loadDiagnosticsPref();
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    tracesSampleRate: 0,
    attachStacktrace: true,
    beforeSend: (event) => (isDiagnosticsEnabled() ? event : null),
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
