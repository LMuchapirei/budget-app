import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type {
  Budget,
  CustomCategory,
  Goal,
  LedgerAccount,
  PaymentEvidence,
  ScheduledOccurrenceRecord,
  Transaction,
  TransactionEditHistory,
} from '../types';
import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  type EncryptedBackupEnvelope,
} from './backupCrypto';
import { storage } from './storage';

export const BACKUP_SCHEMA_VERSION = 1 as const;
const BACKUP_APP_ID = 'the-budget' as const;

export interface BackupSnapshot {
  transactions: Transaction[];
  ledgers: LedgerAccount[];
  customCategories: CustomCategory[];
  budgets: Budget[];
  goals: Goal[];
  scheduledOccurrenceRecords: ScheduledOccurrenceRecord[];
  paymentEvidence: PaymentEvidence[];
  transactionEditHistory: TransactionEditHistory[];
}

export interface BackupV1 {
  schema: typeof BACKUP_SCHEMA_VERSION;
  app: typeof BACKUP_APP_ID;
  exportedAt: string;
  data: BackupSnapshot;
}

const BACKUP_DATA_KEYS: ReadonlyArray<keyof BackupSnapshot> = [
  'transactions',
  'ledgers',
  'customCategories',
  'budgets',
  'goals',
  'scheduledOccurrenceRecords',
  'paymentEvidence',
  'transactionEditHistory',
];

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arrayField<T>(source: JsonObject, key: string): T[] {
  const value = source[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function hasBackupCollection(source: JsonObject) {
  return BACKUP_DATA_KEYS.some((key) => Array.isArray(source[key])) || Array.isArray(source.categories);
}

function isBudgetBackupApp(value: unknown) {
  if (value === BACKUP_APP_ID) return true;
  return isJsonObject(value) && value.name === BACKUP_APP_ID;
}

function assertBackupCollections(source: JsonObject) {
  for (const key of BACKUP_DATA_KEYS) {
    const value = source[key];
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Backup field "${key}" is not valid.`);
    }
  }
  if (source.categories !== undefined && !Array.isArray(source.categories)) {
    throw new Error('Backup field "categories" is not valid.');
  }
}

function sanitizePaymentEvidence(evidence: PaymentEvidence[]): PaymentEvidence[] {
  // Photos live as local file:// URIs that will not resolve on a different device,
  // so we drop the photo records entirely. Other evidence types (sms, email, manual,
  // bank match) carry only text and round-trip cleanly.
  return evidence
    .filter((entry) => entry.type !== 'photo')
    .map(({ attachmentUri: _uri, attachmentName: _name, ...rest }) => rest as PaymentEvidence);
}

function normalizeBackupSnapshot(source: JsonObject): BackupSnapshot {
  const customCategories = arrayField<CustomCategory>(source, 'customCategories');
  return {
    transactions: arrayField<Transaction>(source, 'transactions'),
    ledgers: arrayField<LedgerAccount>(source, 'ledgers'),
    customCategories:
      customCategories.length > 0 ? customCategories : arrayField<CustomCategory>(source, 'categories'),
    budgets: arrayField<Budget>(source, 'budgets'),
    goals: arrayField<Goal>(source, 'goals'),
    scheduledOccurrenceRecords: arrayField<ScheduledOccurrenceRecord>(
      source,
      'scheduledOccurrenceRecords',
    ),
    paymentEvidence: sanitizePaymentEvidence(arrayField<PaymentEvidence>(source, 'paymentEvidence')),
    transactionEditHistory: arrayField<TransactionEditHistory>(source, 'transactionEditHistory'),
  };
}

export function serializeBackupJson(snapshot: BackupSnapshot): string {
  const payload: BackupV1 = {
    schema: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_ID,
    exportedAt: new Date().toISOString(),
    data: {
      ...snapshot,
      paymentEvidence: sanitizePaymentEvidence(snapshot.paymentEvidence),
    },
  };
  return JSON.stringify(payload, null, 2);
}

function looksLikeTransaction(value: unknown): value is Transaction {
  if (!isJsonObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    typeof value.description === 'string' &&
    typeof value.category === 'string' &&
    typeof value.date === 'string'
  );
}

export function parseBackupJson(raw: string): BackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is empty or malformed.');
  }
  if (Array.isArray(parsed)) {
    if (parsed.every(looksLikeTransaction)) {
      return {
        schema: BACKUP_SCHEMA_VERSION,
        app: BACKUP_APP_ID,
        exportedAt: new Date().toISOString(),
        data: normalizeBackupSnapshot({ transactions: parsed }),
      };
    }
    throw new Error("This file isn't a The Budget backup.");
  }

  const candidate = parsed as JsonObject;
  if (candidate.app !== undefined && !isBudgetBackupApp(candidate.app)) {
    throw new Error("This file isn't a The Budget backup.");
  }
  if (candidate.schema !== undefined && candidate.schema !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Backup schema v${String(candidate.schema ?? '?')} isn't supported (expected v${BACKUP_SCHEMA_VERSION}).`,
    );
  }

  const source = isJsonObject(candidate.data) ? candidate.data : candidate;
  if (!hasBackupCollection(source)) {
    throw new Error("This file isn't a The Budget backup.");
  }
  assertBackupCollections(source);

  return {
    schema: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_ID,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    data: normalizeBackupSnapshot(source),
  };
}

const CSV_HEADER = [
  'Date',
  'Type',
  'Amount',
  'Currency',
  'Description',
  'Category',
  'Account',
  'Recurring',
  'Transfer Pair',
  'Transfer Direction',
];

export function serializeTransactionsCsv(
  transactions: Transaction[],
  ledgers: LedgerAccount[],
): string {
  const ledgerById = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
  const rows = transactions.map((t) => {
    const ledger = t.ledgerId ? ledgerById.get(t.ledgerId) : undefined;
    return [
      t.date,
      t.type,
      String(t.amount),
      ledger?.currencyCode ?? '',
      t.description,
      t.category,
      ledger?.name ?? '',
      t.recurring ? 'yes' : 'no',
      t.transferPairId ?? '',
      t.transferDirection ?? '',
    ];
  });
  return [CSV_HEADER, ...rows].map(serializeCsvRow).join('\n');
}

function serializeCsvRow(values: string[]): string {
  return values.map(serializeCsvCell).join(',');
}

function serializeCsvCell(raw: string): string {
  if (/["\n\r,]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function timestampSlug(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

async function writeAndShare(
  filename: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory available.');
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

export async function exportBackupJsonFile(snapshot: BackupSnapshot): Promise<void> {
  const content = serializeBackupJson(snapshot);
  await writeAndShare(
    `budget-backup-${timestampSlug()}.json`,
    content,
    'application/json',
    'Save backup',
  );
}

export async function exportTransactionsCsvFile(
  transactions: Transaction[],
  ledgers: LedgerAccount[],
): Promise<void> {
  const content = serializeTransactionsCsv(transactions, ledgers);
  await writeAndShare(
    `budget-transactions-${timestampSlug()}.csv`,
    content,
    'text/csv',
    'Save transactions',
  );
}

export async function pickAndParseBackup(): Promise<BackupV1 | null> {
  const raw = await pickBackupFileRaw();
  if (raw === null) return null;
  return parseBackupJson(raw);
}

/**
 * Picks a backup file and returns either the parsed plain backup or — if the
 * file is encrypted — the envelope, so the UI can prompt for a password.
 * Returns null if the user cancelled the picker.
 */
export async function pickBackupFileForRestore(): Promise<
  | { kind: 'plain'; backup: BackupV1 }
  | { kind: 'encrypted'; envelope: EncryptedBackupEnvelope }
  | null
> {
  const raw = await pickBackupFileRaw();
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  if (isEncryptedBackup(parsed)) {
    return { kind: 'encrypted', envelope: parsed };
  }
  return { kind: 'plain', backup: parseBackupJson(raw) };
}

async function pickBackupFileRaw(): Promise<string | null> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    // '*/*' so backups round-tripped through Drive, Downloads, WhatsApp, etc.
    // (which often strip or rewrite the MIME type) still show up in the picker.
    result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (error) {
    console.error('[backup] document picker failed', error);
    throw new Error("Couldn't open the file picker. Try reinstalling or rebuilding the app.");
  }
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error('No file was selected.');
  }
  try {
    return await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error('[backup] reading picked file failed', error);
    throw new Error("Couldn't read that file. Pick a backup file saved by The Budget.");
  }
}

export async function buildSnapshotFromStorage(): Promise<BackupSnapshot> {
  const [
    transactions,
    ledgers,
    customCategories,
    budgets,
    goals,
    scheduledOccurrenceRecords,
    paymentEvidence,
    transactionEditHistory,
  ] = await Promise.all([
    storage.getTransactions(),
    storage.getLedgers(),
    storage.getCategories(),
    storage.getBudgets(),
    storage.getGoals(),
    storage.getScheduledOccurrenceRecords(),
    storage.getPaymentEvidence(),
    storage.getTransactionEditHistory(),
  ]);
  return {
    transactions,
    ledgers,
    customCategories,
    budgets,
    goals,
    scheduledOccurrenceRecords,
    paymentEvidence,
    transactionEditHistory,
  };
}

export async function exportEncryptedBackupFile(
  password: string,
): Promise<{ envelope: EncryptedBackupEnvelope }> {
  const snapshot = await buildSnapshotFromStorage();
  const plaintext = serializeBackupJson(snapshot);
  const envelope = await encryptBackup(plaintext, password);
  const filename = `budget-backup-${timestampSlug()}.tbk`;
  await writeAndShare(
    filename,
    JSON.stringify(envelope),
    'application/octet-stream',
    'Save encrypted backup',
  );
  return { envelope };
}

/** Decrypts a previously-picked envelope and returns the parsed backup. */
export async function decryptAndParseBackup(
  envelope: EncryptedBackupEnvelope,
  password: string,
): Promise<BackupV1> {
  const plaintext = await decryptBackup(envelope, password);
  return parseBackupJson(plaintext);
}
