// Stores backup passwords behind the device's biometric/passcode lock so
// users on the original device don't have to retype the password to restore.
//
// What's stored:
//   - SecureStore entry per remembered backup (keyed by a hash of the
//     backup's KDF salt). Reading the entry triggers an OS biometric/
//     passcode prompt.
//   - AsyncStorage index of remembered salts, so UI can ask "is this
//     backup's password remembered on this device?" without prompting
//     for biometrics first.
//
// What's NOT stored:
//   - The data key (DK). The DK is per-file and reconstructible from the
//     password; storing the password is what gives us recovery, not the
//     DK. (Storing the DK only would unlock one specific file.)
//
// Threat model on the secure-store entry:
//   - Read requires a successful biometric/passcode auth at the OS level.
//   - On iOS, `keychainAccessible: WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`
//     prevents iCloud Keychain syncing — the entry never leaves this
//     device.
//   - On Android, EncryptedSharedPreferences with `requireAuthentication`
//     gates access on the keystore-bound key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/ciphers/utils';

const REMEMBERED_SALTS_KEY = 'budget:remembered-backup-salts:v1';
const SECURE_KEY_PREFIX = 'budget-backup-pw-';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock to recall your backup password',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    out += h.length === 1 ? '0' + h : h;
  }
  return out;
}

// Salts are base64 with '+/=' which aren't valid SecureStore key chars on
// every platform. Derive a stable alphanumeric key by hashing.
function secureKeyForSalt(saltBase64: string): string {
  const hash = sha256(utf8ToBytes(saltBase64));
  return SECURE_KEY_PREFIX + bytesToHex(hash).slice(0, 32);
}

async function readSaltIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REMEMBERED_SALTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

async function writeSaltIndex(salts: string[]): Promise<void> {
  await AsyncStorage.setItem(REMEMBERED_SALTS_KEY, JSON.stringify(salts));
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) return false;
    return await SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

export async function rememberPasswordForBackup(
  saltBase64: string,
  password: string,
): Promise<void> {
  if (!saltBase64 || !password) {
    throw new Error('saltBase64 and password are both required.');
  }
  const key = secureKeyForSalt(saltBase64);
  await SecureStore.setItemAsync(key, password, SECURE_OPTIONS);
  const salts = await readSaltIndex();
  if (!salts.includes(saltBase64)) {
    salts.push(saltBase64);
    await writeSaltIndex(salts);
  }
}

export async function isPasswordRemembered(saltBase64: string): Promise<boolean> {
  if (!saltBase64) return false;
  const salts = await readSaltIndex();
  return salts.includes(saltBase64);
}

export async function hasAnyRememberedPassword(): Promise<boolean> {
  const salts = await readSaltIndex();
  return salts.length > 0;
}

/** Prompts biometric/passcode. Returns null if the user cancels or no entry exists. */
export async function recallPassword(saltBase64: string): Promise<string | null> {
  if (!saltBase64) return null;
  const salts = await readSaltIndex();
  if (!salts.includes(saltBase64)) return null;
  const key = secureKeyForSalt(saltBase64);
  try {
    const value = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
    return value ?? null;
  } catch {
    // User cancelled biometric, hardware unavailable, or entry missing.
    return null;
  }
}

export async function forgetPasswordForBackup(saltBase64: string): Promise<void> {
  if (!saltBase64) return;
  const key = secureKeyForSalt(saltBase64);
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  } catch {
    // Best-effort; if the entry is gone the index cleanup below still runs.
  }
  const salts = await readSaltIndex();
  const next = salts.filter((s) => s !== saltBase64);
  if (next.length !== salts.length) await writeSaltIndex(next);
}

export async function forgetAllPasswords(): Promise<void> {
  const salts = await readSaltIndex();
  await Promise.all(
    salts.map((salt) =>
      SecureStore.deleteItemAsync(secureKeyForSalt(salt), SECURE_OPTIONS).catch(
        () => undefined,
      ),
    ),
  );
  await AsyncStorage.removeItem(REMEMBERED_SALTS_KEY);
}
