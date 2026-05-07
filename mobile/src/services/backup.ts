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

function sanitizePaymentEvidence(evidence: PaymentEvidence[]): PaymentEvidence[] {
  // Photos live as local file:// URIs that will not resolve on a different device,
  // so we drop the photo records entirely. Other evidence types (sms, email, manual,
  // bank match) carry only text and round-trip cleanly.
  return evidence
    .filter((entry) => entry.type !== 'photo')
    .map(({ attachmentUri: _uri, attachmentName: _name, ...rest }) => rest as PaymentEvidence);
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
  const candidate = parsed as Partial<BackupV1>;
  if (candidate.app !== BACKUP_APP_ID) {
    throw new Error("This file isn't a The Budget backup.");
  }
  if (candidate.schema !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Backup schema v${String(candidate.schema ?? '?')} isn't supported (expected v${BACKUP_SCHEMA_VERSION}).`,
    );
  }
  const data = candidate.data as Partial<BackupSnapshot> | undefined;
  if (!data || typeof data !== 'object') {
    throw new Error('Backup file is missing data.');
  }
  for (const key of BACKUP_DATA_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Backup is missing "${key}".`);
    }
  }
  return parsed as BackupV1;
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
  let raw: string;
  try {
    raw = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error('[backup] reading picked file failed', error);
    throw new Error("Couldn't read that file. Pick a backup JSON saved by The Budget.");
  }
  return parseBackupJson(raw);
}
