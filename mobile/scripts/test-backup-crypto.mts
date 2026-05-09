// Smoke test for backupCrypto.ts. Runs in plain Node — no Jest required.
//
//   cd mobile
//   npm run test:crypto
//
// Exits 0 on success, non-zero on any failure.
//
// Why a node script and not Jest? jest-expo has heavyweight transform
// configuration we don't have set up yet. This catches the high-value
// cryptographic regressions (round-trip, wrong-password rejection,
// tamper detection) without that yak-shave. When we add Jest, port
// these cases over.

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import * as backupCryptoNs from '../src/services/backupCrypto';

// tsx loads .ts files as CJS by default, which wraps the named exports under
// `.default`. When run via a true ESM loader (or once we move to Jest), this
// fallback becomes a no-op.
const backupCrypto: typeof backupCryptoNs =
  ((backupCryptoNs as unknown as { default?: typeof backupCryptoNs }).default ??
    backupCryptoNs) as typeof backupCryptoNs;

const {
  encryptBackup,
  decryptBackup,
  WrongPasswordError,
  CorruptBackupError,
  UnsupportedBackupError,
  bytesToBase64,
  base64ToBytes,
  ENCRYPTED_BACKUP_TYPE,
  ENCRYPTED_BACKUP_VERSION,
} = backupCrypto;

const rng = async (n: number): Promise<Uint8Array> => {
  const buf = nodeRandomBytes(n);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
};

const failures: { name: string; err: unknown }[] = [];
const pass = (name: string) => console.log(`  ok  ${name}`);
const fail = (name: string, err: unknown) => {
  failures.push({ name, err });
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  FAIL ${name} — ${msg}`);
};

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

const samplePlaintext = JSON.stringify({
  schema: 1,
  app: 'the-budget',
  exportedAt: '2026-05-09T12:00:00.000Z',
  data: {
    transactions: [
      {
        id: 't1',
        type: 'expense',
        amount: 12.5,
        description: 'Coffee — café "Le Pain Quotidien"',
        category: 'food',
        date: '2026-05-08',
        recurring: false,
      },
    ],
    ledgers: [],
    customCategories: [],
    budgets: [],
    goals: [],
    scheduledOccurrenceRecords: [],
    paymentEvidence: [],
    transactionEditHistory: [],
  },
});

console.log('backupCrypto smoke tests');

await test('round-trip with correct password recovers plaintext exactly', async () => {
  const env = await encryptBackup(samplePlaintext, 'correct horse battery staple', {
    randomBytes: rng,
  });
  if (env.type !== ENCRYPTED_BACKUP_TYPE) throw new Error('wrong envelope type');
  if (env.version !== ENCRYPTED_BACKUP_VERSION) throw new Error('wrong version');
  const out = await decryptBackup(env, 'correct horse battery staple');
  if (out !== samplePlaintext) throw new Error('plaintext mismatch after decrypt');
});

await test('wrong password throws WrongPasswordError', async () => {
  const env = await encryptBackup(samplePlaintext, 'rightpw', { randomBytes: rng });
  try {
    await decryptBackup(env, 'wrongpw');
    throw new Error('expected WrongPasswordError, got success');
  } catch (err) {
    if (!(err instanceof WrongPasswordError)) {
      throw new Error(
        `expected WrongPasswordError, got ${(err as Error)?.constructor?.name}`,
      );
    }
  }
});

await test('empty password is rejected on decrypt', async () => {
  const env = await encryptBackup(samplePlaintext, 'pw', { randomBytes: rng });
  try {
    await decryptBackup(env, '');
    throw new Error('expected WrongPasswordError on empty password');
  } catch (err) {
    if (!(err instanceof WrongPasswordError)) {
      throw new Error(
        `expected WrongPasswordError, got ${(err as Error)?.constructor?.name}`,
      );
    }
  }
});

await test('empty password rejected on encrypt', async () => {
  try {
    await encryptBackup(samplePlaintext, '', { randomBytes: rng });
    throw new Error('expected encrypt to throw on empty password');
  } catch (err) {
    if (!(err instanceof Error) || !/password is required/i.test(err.message)) {
      throw new Error(
        `expected "Password is required" error, got: ${(err as Error)?.message}`,
      );
    }
  }
});

await test('tampered payload ciphertext throws CorruptBackupError', async () => {
  const env = await encryptBackup(samplePlaintext, 'pw', { randomBytes: rng });
  const ctBytes = base64ToBytes(env.payload.ct);
  ctBytes[Math.floor(ctBytes.length / 2)] ^= 0x55;
  const tampered = { ...env, payload: { ...env.payload, ct: bytesToBase64(ctBytes) } };
  try {
    await decryptBackup(tampered, 'pw');
    throw new Error('expected CorruptBackupError, got success');
  } catch (err) {
    if (!(err instanceof CorruptBackupError)) {
      throw new Error(
        `expected CorruptBackupError, got ${(err as Error)?.constructor?.name}`,
      );
    }
  }
});

await test('tampered wrap ciphertext is reported as wrong password', async () => {
  // Indistinguishable from a wrong password without further oracle —
  // both manifest as a GCM tag mismatch on the wrap key. We deliberately
  // collapse them so the UI only ever asks the user to re-enter.
  const env = await encryptBackup(samplePlaintext, 'pw', { randomBytes: rng });
  const ctBytes = base64ToBytes(env.wrap.ct);
  ctBytes[0] ^= 0xff;
  const tampered = { ...env, wrap: { ...env.wrap, ct: bytesToBase64(ctBytes) } };
  try {
    await decryptBackup(tampered, 'pw');
    throw new Error('expected WrongPasswordError, got success');
  } catch (err) {
    if (!(err instanceof WrongPasswordError)) {
      throw new Error(
        `expected WrongPasswordError, got ${(err as Error)?.constructor?.name}`,
      );
    }
  }
});

await test('unknown envelope type throws UnsupportedBackupError', async () => {
  try {
    await decryptBackup({ type: 'something/else', version: 1 }, 'pw');
    throw new Error('expected UnsupportedBackupError');
  } catch (err) {
    if (!(err instanceof UnsupportedBackupError)) {
      throw new Error(
        `expected UnsupportedBackupError, got ${(err as Error)?.constructor?.name}`,
      );
    }
  }
});

await test('two backups of same plaintext produce different ciphertexts', async () => {
  const a = await encryptBackup(samplePlaintext, 'pw', { randomBytes: rng });
  const b = await encryptBackup(samplePlaintext, 'pw', { randomBytes: rng });
  if (a.payload.ct === b.payload.ct) {
    throw new Error('payload.ct collided across exports — IV/DK reuse?');
  }
  if (a.kdf.salt === b.kdf.salt) {
    throw new Error('salt collided across exports');
  }
});

await test('base64 round-trip handles edge lengths (0, 1, 2, 3, 17 bytes)', async () => {
  for (const len of [0, 1, 2, 3, 17]) {
    const original = nodeRandomBytes(len);
    const original8 = new Uint8Array(original.buffer, original.byteOffset, len);
    const round = base64ToBytes(bytesToBase64(original8));
    if (round.length !== len) throw new Error(`length mismatch at ${len}`);
    for (let i = 0; i < len; i++) {
      if (round[i] !== original8[i]) throw new Error(`byte mismatch at ${len}/${i}`);
    }
  }
});

if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log('\nAll passed.');
