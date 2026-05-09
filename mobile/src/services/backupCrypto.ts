// Pure-crypto module for password-protected backup envelopes.
//
// Design (see STORE_LAUNCH.md / Plan):
//   user password ──PBKDF2-SHA256(iter, salt)──► KEK
//                                                  │
//   random 32-byte DK ◄────── AES-256-GCM-wrap ────┤
//           │
//           └── AES-256-GCM(payloadIv, plaintext) ─► ciphertext + tag
//
// The wrap-key indirection lets us rotate passwords on existing backups
// without re-encrypting payloads (future feature). For now, each export
// generates a fresh DK and salt.
//
// This module deliberately does no I/O and no expo-* imports at the top
// level so it stays unit-testable in plain Node.

import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

export const ENCRYPTED_BACKUP_TYPE = 'the-budget/encrypted-backup' as const;
export const ENCRYPTED_BACKUP_VERSION = 1 as const;

export const KDF_ITERATIONS = 200_000;
export const KDF_SALT_BYTES = 16;
export const DATA_KEY_BYTES = 32;
export const IV_BYTES = 12;

export interface EncryptedBackupEnvelope {
  type: typeof ENCRYPTED_BACKUP_TYPE;
  version: typeof ENCRYPTED_BACKUP_VERSION;
  exportedAt: string;
  kdf: {
    alg: 'PBKDF2-SHA256';
    iter: number;
    salt: string; // base64
  };
  wrap: {
    alg: 'AES-256-GCM';
    iv: string; // base64
    ct: string; // base64 (ciphertext || gcm tag)
  };
  payload: {
    alg: 'AES-256-GCM';
    iv: string; // base64
    ct: string; // base64 (ciphertext || gcm tag)
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password.');
    this.name = 'WrongPasswordError';
  }
}

export class CorruptBackupError extends Error {
  constructor(reason?: string) {
    super(reason ? `Backup is corrupted: ${reason}` : 'Backup is corrupted.');
    this.name = 'CorruptBackupError';
  }
}

export class UnsupportedBackupError extends Error {
  constructor(reason?: string) {
    super(reason ? `Unsupported backup: ${reason}` : 'Unsupported backup format.');
    this.name = 'UnsupportedBackupError';
  }
}

export type RandomBytesFn = (length: number) => Promise<Uint8Array>;

let cachedDefaultRandomBytes: RandomBytesFn | null = null;

async function defaultRandomBytes(length: number): Promise<Uint8Array> {
  if (!cachedDefaultRandomBytes) {
    // Lazy import so this module stays runnable in pure Node environments
    // (tests / scripts) where expo-crypto isn't installed.
    const ExpoCrypto = await import('expo-crypto');
    cachedDefaultRandomBytes = (n: number) => ExpoCrypto.getRandomBytesAsync(n);
  }
  return cachedDefaultRandomBytes(length);
}

export interface EncryptOptions {
  randomBytes?: RandomBytesFn;
  now?: () => Date;
}

export async function encryptBackup(
  plaintext: string,
  password: string,
  opts: EncryptOptions = {},
): Promise<EncryptedBackupEnvelope> {
  if (typeof plaintext !== 'string') {
    throw new TypeError('plaintext must be a string');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required.');
  }

  const rng = opts.randomBytes ?? defaultRandomBytes;
  const now = opts.now ?? (() => new Date());

  const [salt, wrapIv, payloadIv, dk] = await Promise.all([
    rng(KDF_SALT_BYTES),
    rng(IV_BYTES),
    rng(IV_BYTES),
    rng(DATA_KEY_BYTES),
  ]);

  const kek = await deriveKek(password, salt, KDF_ITERATIONS);
  const wrapCt = gcm(kek, wrapIv).encrypt(dk);
  const payloadCt = gcm(dk, payloadIv).encrypt(utf8ToBytes(plaintext));

  return {
    type: ENCRYPTED_BACKUP_TYPE,
    version: ENCRYPTED_BACKUP_VERSION,
    exportedAt: now().toISOString(),
    kdf: { alg: 'PBKDF2-SHA256', iter: KDF_ITERATIONS, salt: bytesToBase64(salt) },
    wrap: { alg: 'AES-256-GCM', iv: bytesToBase64(wrapIv), ct: bytesToBase64(wrapCt) },
    payload: {
      alg: 'AES-256-GCM',
      iv: bytesToBase64(payloadIv),
      ct: bytesToBase64(payloadCt),
    },
  };
}

export async function decryptBackup(
  envelope: unknown,
  password: string,
): Promise<string> {
  assertEnvelope(envelope);
  if (typeof password !== 'string' || password.length === 0) {
    throw new WrongPasswordError();
  }

  const salt = base64ToBytes(envelope.kdf.salt);
  const kek = await deriveKek(password, salt, envelope.kdf.iter);

  let dk: Uint8Array;
  try {
    dk = gcm(kek, base64ToBytes(envelope.wrap.iv)).decrypt(
      base64ToBytes(envelope.wrap.ct),
    );
  } catch {
    // GCM tag mismatch on the wrapped key is the canonical "wrong password"
    // signal. We do not differentiate from "tampered wrap.ct" because the
    // user-facing remediation is identical: re-enter the password.
    throw new WrongPasswordError();
  }
  if (dk.length !== DATA_KEY_BYTES) {
    throw new CorruptBackupError('unexpected data-key length');
  }

  let plaintextBytes: Uint8Array;
  try {
    plaintextBytes = gcm(dk, base64ToBytes(envelope.payload.iv)).decrypt(
      base64ToBytes(envelope.payload.ct),
    );
  } catch {
    throw new CorruptBackupError('payload authentication failed');
  }

  return bytesToUtf8(plaintextBytes);
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') return false;
  return (value as { type?: unknown }).type === ENCRYPTED_BACKUP_TYPE;
}

async function deriveKek(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(password), salt, {
    c: iterations,
    dkLen: 32,
  });
}

function assertEnvelope(value: unknown): asserts value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') {
    throw new UnsupportedBackupError('not an object');
  }
  const env = value as Partial<EncryptedBackupEnvelope>;
  if (env.type !== ENCRYPTED_BACKUP_TYPE) {
    throw new UnsupportedBackupError('not an encrypted backup');
  }
  if (env.version !== ENCRYPTED_BACKUP_VERSION) {
    throw new UnsupportedBackupError(
      `version ${String(env.version)} is not supported`,
    );
  }
  if (
    !env.kdf ||
    env.kdf.alg !== 'PBKDF2-SHA256' ||
    typeof env.kdf.iter !== 'number' ||
    env.kdf.iter < 1 ||
    typeof env.kdf.salt !== 'string'
  ) {
    throw new UnsupportedBackupError('bad kdf section');
  }
  if (
    !env.wrap ||
    env.wrap.alg !== 'AES-256-GCM' ||
    typeof env.wrap.iv !== 'string' ||
    typeof env.wrap.ct !== 'string'
  ) {
    throw new UnsupportedBackupError('bad wrap section');
  }
  if (
    !env.payload ||
    env.payload.alg !== 'AES-256-GCM' ||
    typeof env.payload.iv !== 'string' ||
    typeof env.payload.ct !== 'string'
  ) {
    throw new UnsupportedBackupError('bad payload section');
  }
}

// --- base64 helpers --------------------------------------------------------
//
// We cannot use Buffer (RN doesn't have it) and atob/btoa exist in Hermes
// but throw on non-Latin-1 input. Since we only encode binary Uint8Array
// here, the Latin-1 path is safe — but we provide an explicit implementation
// to avoid relying on host APIs in a security-sensitive code path.

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_CHARS[(n >> 18) & 0x3f] +
      B64_CHARS[(n >> 12) & 0x3f] +
      B64_CHARS[(n >> 6) & 0x3f] +
      B64_CHARS[n & 0x3f];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[(n >> 18) & 0x3f] + B64_CHARS[(n >> 12) & 0x3f] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_CHARS[(n >> 18) & 0x3f] +
      B64_CHARS[(n >> 12) & 0x3f] +
      B64_CHARS[(n >> 6) & 0x3f] +
      '=';
  }
  return out;
}

const B64_LOOKUP = (() => {
  const table = new Int8Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) {
    table[B64_CHARS.charCodeAt(i)] = i;
  }
  table['='.charCodeAt(0)] = 0;
  return table;
})();

export function base64ToBytes(input: string): Uint8Array {
  const str = input.replace(/\s+/g, '');
  if (str.length === 0) return new Uint8Array(0);
  if (str.length % 4 !== 0) {
    throw new CorruptBackupError('base64 length is not a multiple of 4');
  }
  let padCount = 0;
  if (str.endsWith('==')) padCount = 2;
  else if (str.endsWith('=')) padCount = 1;
  const outLen = (str.length / 4) * 3 - padCount;
  const out = new Uint8Array(outLen);
  let oi = 0;
  for (let i = 0; i < str.length; i += 4) {
    const a = B64_LOOKUP[str.charCodeAt(i)];
    const b = B64_LOOKUP[str.charCodeAt(i + 1)];
    const c = B64_LOOKUP[str.charCodeAt(i + 2)];
    const d = B64_LOOKUP[str.charCodeAt(i + 3)];
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new CorruptBackupError('invalid base64 character');
    }
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (oi < outLen) out[oi++] = (n >> 16) & 0xff;
    if (oi < outLen) out[oi++] = (n >> 8) & 0xff;
    if (oi < outLen) out[oi++] = n & 0xff;
  }
  return out;
}
