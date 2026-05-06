import type { Dispatch, SetStateAction } from 'react';
import type {
  BillOccurrenceRecord,
  LedgerAccount,
  ScheduledOccurrenceRecord,
  Transaction,
} from '../../types';
import { currencyOptionFromCode, DEFAULT_REPORTING_CURRENCY, normalizeCurrencyCode } from '../../utils/currency';
import { estimateMonthlyImpact } from '../../utils/recurring';

export const DEFAULT_LEDGER_ID = 'default-ledger';
export const ALL_LEDGER_ID = 'all-ledgers';

export const DEFAULT_LEDGER: LedgerAccount = {
  id: DEFAULT_LEDGER_ID,
  name: 'Cash Ledger',
  description: 'Default account for existing entries',
  color: '#8B5A3C',
  currencyCode: DEFAULT_REPORTING_CURRENCY.code,
  currencySymbol: DEFAULT_REPORTING_CURRENCY.symbol,
  isDefault: true,
};

export function normalizeLedger(ledger: LedgerAccount): LedgerAccount {
  const currencyCode = normalizeCurrencyCode(ledger.currencyCode);
  return {
    ...ledger,
    currencyCode,
    currencySymbol: ledger.currencySymbol ?? currencyOptionFromCode(currencyCode).symbol,
  };
}

export function maskAccountNumberValue(accountNumber?: string) {
  const clean = accountNumber?.replace(/\s+/g, '') ?? '';
  if (!clean) return '';
  const visible = clean.slice(-4);
  return `${'*'.repeat(Math.max(4, clean.length - visible.length))} ${visible}`;
}

export function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function parseTransactionDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function parseBudgetDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function parseLocalDate(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function daysBetween(start: Date, end: Date) {
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  return Math.ceil((endDay.getTime() - startDay.getTime()) / 86400000);
}

export function scheduledOccurrenceId(sourceTransactionId: string, dueDate: string) {
  return `${sourceTransactionId}:${dueDate}`;
}

export function parseScheduledOccurrenceId(id: string) {
  const splitAt = id.lastIndexOf(':');
  if (splitAt === -1) return { sourceTransactionId: id, dueDate: '' };
  return {
    sourceTransactionId: id.slice(0, splitAt),
    dueDate: id.slice(splitAt + 1),
  };
}

export function migrateLegacyBillRecords(
  legacy: BillOccurrenceRecord[],
  txs: Transaction[],
): ScheduledOccurrenceRecord[] {
  return legacy.map((record) => {
    const confirmedTransaction = txs.find(
      (transaction) =>
        transaction.generatedFromRecurringId === record.recurringTransactionId &&
        transaction.generatedOccurrenceDate === record.dueDate,
    );
    return {
      id: scheduledOccurrenceId(record.recurringTransactionId, record.dueDate),
      sourceTransactionId: record.recurringTransactionId,
      originalDueDate: record.dueDate,
      effectiveDueDate: record.dueDate,
      status: record.status === 'paid' ? 'confirmed' : 'skipped',
      confirmedTransactionId: record.status === 'paid' ? confirmedTransaction?.id : undefined,
      notificationId: record.notificationId,
      notificationScheduledAt: record.notificationScheduledAt,
      markedAt: record.markedAt,
    };
  });
}

export async function persistState<T>(
  next: T,
  setState: Dispatch<SetStateAction<T>>,
  save: (value: T) => Promise<void>,
) {
  setState(next);
  try {
    await save(next);
  } catch (e) {
    console.error(e);
  }
}

export function monthlyProjectionValue(transaction: Transaction) {
  return estimateMonthlyImpact(transaction);
}

export function recurringScheduleChanged(before: Transaction, after: Transaction) {
  if (before.recurring !== after.recurring) return true;
  if (before.date !== after.date) return true;
  const a = before.recurringSchedule;
  const b = after.recurringSchedule;
  if (!a && !b) return false;
  if (!a || !b) return true;
  return (
    a.frequency !== b.frequency ||
    a.interval !== b.interval ||
    a.startDate !== b.startDate ||
    a.endDate !== b.endDate ||
    a.reminderDaysBefore !== b.reminderDaysBefore ||
    a.postMode !== b.postMode ||
    a.paused !== b.paused
  );
}
