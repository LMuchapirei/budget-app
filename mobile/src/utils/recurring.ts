import type { RecurringFrequency, RecurringSchedule, Transaction } from '../types';

export interface RecurringOccurrence {
  source: Transaction;
  dueDate: string;
  amount: number;
  type: Transaction['type'];
}

const MAX_OCCURRENCES = 500;

export function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addMonthsClamped(date: Date, months: number) {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  next.setHours(0, 0, 0, 0);
  return next;
}

function addYearsClamped(date: Date, years: number) {
  return addMonthsClamped(date, years * 12);
}

function addInterval(date: Date, frequency: RecurringFrequency, interval: number) {
  const safeInterval = Math.max(1, interval);
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + safeInterval);
  if (frequency === 'weekly') next.setDate(next.getDate() + safeInterval * 7);
  if (frequency === 'monthly') return addMonthsClamped(date, safeInterval);
  if (frequency === 'yearly') return addYearsClamped(date, safeInterval);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function normalizeRecurringSchedule(transaction: Transaction): RecurringSchedule | undefined {
  if (!transaction.recurring) return undefined;
  const schedule = transaction.recurringSchedule;
  return {
    frequency: schedule?.frequency ?? 'monthly',
    interval: Math.max(1, Number(schedule?.interval ?? 1)),
    startDate: schedule?.startDate || transaction.date,
    endDate: schedule?.endDate || undefined,
    reminderDaysBefore: Math.max(0, Number(schedule?.reminderDaysBefore ?? 0)),
  };
}

export function getFrequencyLabel(schedule?: RecurringSchedule) {
  if (!schedule) return 'Not recurring';
  const every = schedule.interval > 1 ? `Every ${schedule.interval} ` : 'Every ';
  const unit =
    schedule.interval > 1
      ? `${schedule.frequency.replace('daily', 'day').replace('weekly', 'week').replace('monthly', 'month').replace('yearly', 'year')}s`
      : schedule.frequency.replace('daily', 'day').replace('weekly', 'week').replace('monthly', 'month').replace('yearly', 'year');
  return `${every}${unit}`;
}

export function getRecurringDescription(transaction: Transaction) {
  const schedule = normalizeRecurringSchedule(transaction);
  if (!schedule) return 'Not recurring';
  const reminder =
    schedule.reminderDaysBefore && schedule.reminderDaysBefore > 0
      ? ` - remind ${schedule.reminderDaysBefore}d before`
      : '';
  const ending = schedule.endDate ? ` - until ${formatDisplayDate(schedule.endDate)}` : '';
  return `${getFrequencyLabel(schedule)} from ${formatDisplayDate(schedule.startDate)}${ending}${reminder}`;
}

export function getNextOccurrenceDate(transaction: Transaction, from = new Date()) {
  const schedule = normalizeRecurringSchedule(transaction);
  if (!schedule) return null;
  const rangeEnd = addYearsClamped(from, 2);
  const occurrences = generateRecurringOccurrences(
    transaction,
    formatISODate(from),
    formatISODate(rangeEnd),
  );
  return occurrences[0]?.dueDate ?? null;
}

export function generateRecurringOccurrences(
  transaction: Transaction,
  rangeStartIso: string,
  rangeEndIso: string,
): RecurringOccurrence[] {
  if (transaction.generatedFromRecurringId) return [];
  const schedule = normalizeRecurringSchedule(transaction);
  if (!schedule) return [];

  const occurrences: RecurringOccurrence[] = [];
  const rangeStart = parseISODate(rangeStartIso);
  let rangeEnd = parseISODate(rangeEndIso);
  if (schedule.endDate) {
    const endDate = parseISODate(schedule.endDate);
    if (endDate < rangeEnd) rangeEnd = endDate;
  }
  if (rangeEnd < rangeStart) return occurrences;

  let cursor = parseISODate(schedule.startDate);
  let guard = 0;
  while (cursor < rangeStart && guard < MAX_OCCURRENCES) {
    cursor = addInterval(cursor, schedule.frequency, schedule.interval);
    guard += 1;
  }

  while (cursor <= rangeEnd && guard < MAX_OCCURRENCES) {
    occurrences.push({
      source: transaction,
      dueDate: formatISODate(cursor),
      amount: Number(transaction.amount),
      type: transaction.type,
    });
    cursor = addInterval(cursor, schedule.frequency, schedule.interval);
    guard += 1;
  }

  return occurrences;
}

export function materializeRecurringTransactions(transactions: Transaction[], today = new Date()) {
  const todayIso = formatISODate(today);
  const existingGenerated = new Set(
    transactions
      .filter((transaction) => transaction.generatedFromRecurringId && transaction.generatedOccurrenceDate)
      .map((transaction) => `${transaction.generatedFromRecurringId}:${transaction.generatedOccurrenceDate}`),
  );
  const additions: Transaction[] = [];

  transactions
    .filter((transaction) => transaction.recurring && !transaction.generatedFromRecurringId)
    .forEach((source) => {
      const sourceDate = parseISODate(source.date);
      const occurrences = generateRecurringOccurrences(source, source.date, todayIso);
      occurrences.forEach((occurrence) => {
        const occurrenceDate = parseISODate(occurrence.dueDate);
        const key = `${source.id}:${occurrence.dueDate}`;
        if (occurrenceDate <= sourceDate || existingGenerated.has(key)) return;
        existingGenerated.add(key);
        additions.push({
          ...source,
          id: `${source.id}-${occurrence.dueDate}`,
          date: occurrence.dueDate,
          recurring: false,
          recurringSchedule: undefined,
          generatedFromRecurringId: source.id,
          generatedOccurrenceDate: occurrence.dueDate,
        });
      });
    });

  return additions.length > 0 ? [...additions, ...transactions] : transactions;
}

export function estimateMonthlyImpact(transaction: Transaction) {
  const schedule = normalizeRecurringSchedule(transaction);
  if (!schedule) return 0;
  const signedAmount = transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount);
  const yearlyOccurrences =
    schedule.frequency === 'daily'
      ? 365 / schedule.interval
      : schedule.frequency === 'weekly'
      ? 52 / schedule.interval
      : schedule.frequency === 'monthly'
      ? 12 / schedule.interval
      : 1 / schedule.interval;
  return (signedAmount * yearlyOccurrences) / 12;
}

export function formatDisplayDate(iso: string) {
  return parseISODate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
