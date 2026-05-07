import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

const KEY = 'budget:diagnostics:v1';

let enabled = false;
let loaded = false;

export function isDiagnosticsEnabled(): boolean {
  return enabled;
}

export async function loadDiagnosticsPref(): Promise<boolean> {
  if (loaded) return enabled;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    enabled = raw === 'true';
  } catch {
    enabled = false;
  }
  loaded = true;
  return enabled;
}

export async function setDiagnosticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  loaded = true;
  try {
    await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
  } catch {
    // Best-effort persistence; the in-memory flag still gates this session.
  }
  if (value) {
    await Sentry.flush().catch(() => undefined);
  }
}
