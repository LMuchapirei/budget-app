import BudgetApp from './src/BudgetApp';
import * as Sentry from '@sentry/react-native';
import {
  isDiagnosticsEnabled,
  loadDiagnosticsPref,
} from './src/services/diagnostics';

// Hydrate the opt-in flag asap. Until it resolves, the gate stays off (privacy default).
loadDiagnosticsPref();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // Drop every event unless the user has opted into diagnostics in Settings.
  beforeSend: (event) => (isDiagnosticsEnabled() ? event : null),

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function App() {
  return <BudgetApp />;
});
