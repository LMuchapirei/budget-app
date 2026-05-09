import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { storage } from './storage';
import type { Transaction } from '../types';

export interface ExportResult {
  shared: boolean;
  uri: string;
  filename: string;
}

const SCHEMA_VERSION = 1;

const pad = (n: number) => n.toString().padStart(2, '0');

const timestampSlug = () => {
  const d = new Date();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
};

async function shareIfAvailable(
  uri: string,
  mimeType: string,
  uti: string,
  dialogTitle: string,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
  return true;
}

export async function exportBackupJson(): Promise<ExportResult> {
  const [
    transactions,
    ledgers,
    activeLedger,
    transactionEditHistory,
    categories,
    currency,
    reportingCurrency,
    budgets,
    goals,
    scheduledOccurrenceRecords,
    paymentEvidence,
    onboardedAt,
    themePreferences,
  ] = await Promise.all([
    storage.getTransactions(),
    storage.getLedgers(),
    storage.getActiveLedger(),
    storage.getTransactionEditHistory(),
    storage.getCategories(),
    storage.getCurrency(),
    storage.getReportingCurrency(),
    storage.getBudgets(),
    storage.getGoals(),
    storage.getScheduledOccurrenceRecords(),
    storage.getPaymentEvidence(),
    storage.getOnboardedAt(),
    storage.getThemePreferences(),
  ]);

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'the-budget', platform: 'mobile' },
    data: {
      transactions,
      ledgers,
      activeLedger,
      transactionEditHistory,
      categories,
      currency,
      reportingCurrency,
      budgets,
      goals,
      scheduledOccurrenceRecords,
      paymentEvidence,
      onboardedAt,
      themePreferences,
    },
  };

  const filename = `the-budget-backup-${timestampSlug()}.json`;
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));

  const shared = await shareIfAvailable(
    uri,
    'application/json',
    'public.json',
    'Save your Budget backup',
  );
  return { shared, uri, filename };
}

const csvEscape = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportTransactionsCsv(): Promise<ExportResult> {
  const [transactions, ledgers, categories] = await Promise.all([
    storage.getTransactions(),
    storage.getLedgers(),
    storage.getCategories(),
  ]);

  const ledgerById = new Map(ledgers.map((l) => [l.id, l]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.title]));

  const headers = [
    'date',
    'type',
    'amount',
    'currency',
    'ledger',
    'category',
    'description',
    'recurring',
    'transfer',
  ];

  const lines = [headers.join(',')];
  for (const tx of transactions as Transaction[]) {
    const ledger = tx.ledgerId ? ledgerById.get(tx.ledgerId) : undefined;
    const categoryLabel = categoryNameById.get(tx.category) ?? tx.category;
    lines.push(
      [
        csvEscape(tx.date),
        csvEscape(tx.type),
        csvEscape(tx.amount),
        csvEscape(ledger?.currencyCode ?? ''),
        csvEscape(ledger?.name ?? ''),
        csvEscape(categoryLabel),
        csvEscape(tx.description ?? ''),
        csvEscape(tx.recurring ? 'yes' : ''),
        csvEscape(tx.transferPairId ? (tx.transferDirection ?? 'transfer') : ''),
      ].join(','),
    );
  }

  const filename = `the-budget-transactions-${timestampSlug()}.csv`;
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, lines.join('\r\n'));

  const shared = await shareIfAvailable(
    uri,
    'text/csv',
    'public.comma-separated-values-text',
    'Save your transaction CSV',
  );
  return { shared, uri, filename };
}
