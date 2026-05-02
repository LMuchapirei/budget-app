import type {
  RecurringFrequency,
  RecurringSchedule,
  ScheduledOccurrence,
  ScheduledOccurrenceDisplayStatus,
  ScheduledOccurrenceRecord,
  Transaction,
} from '../types';

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
    postMode: schedule?.postMode ?? (transaction.type === 'income' ? 'auto' : 'confirm'),
    paused: Boolean(schedule?.paused),
    pausedAt: schedule?.pausedAt,
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

export interface DerivedScheduledOccurrences {
  occurrences: ScheduledOccurrence[];
  autoConfirmTransactions: Transaction[];
  recordsToPersist: ScheduledOccurrenceRecord[];
}

function scheduledOccurrenceId(sourceTransactionId: string, originalDueDate: string) {
  return `${sourceTransactionId}:${originalDueDate}`;
}

function displayStatusFor(
  status: ScheduledOccurrenceRecord['status'] | undefined,
  effectiveDueDate: string,
  todayIso: string,
): ScheduledOccurrenceDisplayStatus {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'skipped') return 'skipped';
  if (status === 'postponed') return 'postponed';
  if (effectiveDueDate < todayIso) return 'due-now';
  if (effectiveDueDate === todayIso) return 'due-today';
  return 'upcoming';
}

export function deriveScheduledOccurrences(
  transactions: Transaction[],
  records: ScheduledOccurrenceRecord[],
  today = new Date(),
  window: { pastDays?: number; futureDays?: number } = {},
): DerivedScheduledOccurrences {
  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);
  const todayIso = formatISODate(normalizedToday);
  const rangeStart = new Date(normalizedToday);
  rangeStart.setDate(rangeStart.getDate() - (window.pastDays ?? 30));
  const rangeEnd = new Date(normalizedToday);
  rangeEnd.setDate(rangeEnd.getDate() + (window.futureDays ?? 90));

  const recordMap = new Map(records.map((record) => [record.id, record]));
  const generatedMap = new Map(
    transactions
      .filter((transaction) => transaction.generatedFromRecurringId && transaction.generatedOccurrenceDate)
      .map((transaction) => [
        scheduledOccurrenceId(transaction.generatedFromRecurringId!, transaction.generatedOccurrenceDate!),
        transaction,
      ]),
  );
  const occurrences: ScheduledOccurrence[] = [];
  const autoConfirmTransactions: Transaction[] = [];
  const recordsToPersist: ScheduledOccurrenceRecord[] = [...records];
  const nextRecordIds = new Set(records.map((record) => record.id));

  transactions
    .filter((transaction) => transaction.recurring && !transaction.generatedFromRecurringId)
    .forEach((source) => {
      const schedule = normalizeRecurringSchedule(source);
      if (!schedule || schedule.paused) return;

      generateRecurringOccurrences(
        source,
        formatISODate(rangeStart),
        formatISODate(rangeEnd),
      ).forEach((occurrence) => {
        if (occurrence.dueDate < source.date) return;

        const id = scheduledOccurrenceId(source.id, occurrence.dueDate);
        const record = recordMap.get(id);
        const generated = generatedMap.get(id);

        if (record?.status === 'skipped') {
          occurrences.push({
            id,
            source,
            originalDueDate: record.originalDueDate,
            effectiveDueDate: record.effectiveDueDate,
            dueDate: record.effectiveDueDate,
            amount: occurrence.amount,
            type: occurrence.type,
            status: 'skipped',
            recordStatus: 'skipped',
            daysUntilDue: dayDifference(normalizedToday, parseISODate(record.effectiveDueDate)),
            reminderDaysBefore: schedule.reminderDaysBefore ?? 0,
            currencyCode: '',
            currencySymbol: '',
            notificationId: record.notificationId,
          });
          return;
        }

        if (!record && generated) {
          const generatedRecord: ScheduledOccurrenceRecord = {
            id,
            sourceTransactionId: source.id,
            originalDueDate: occurrence.dueDate,
            effectiveDueDate: occurrence.dueDate,
            status: 'confirmed',
            confirmedTransactionId: generated.id,
            markedAt: new Date().toISOString(),
          };
          if (!nextRecordIds.has(id)) {
            recordsToPersist.push(generatedRecord);
            nextRecordIds.add(id);
          }
          occurrences.push({
            id,
            source,
            originalDueDate: occurrence.dueDate,
            effectiveDueDate: occurrence.dueDate,
            dueDate: occurrence.dueDate,
            amount: occurrence.amount,
            type: occurrence.type,
            status: 'confirmed',
            recordStatus: 'confirmed',
            daysUntilDue: dayDifference(normalizedToday, parseISODate(occurrence.dueDate)),
            reminderDaysBefore: schedule.reminderDaysBefore ?? 0,
            currencyCode: '',
            currencySymbol: '',
            confirmedTransactionId: generated.id,
          });
          return;
        }

        if (!record && schedule.postMode === 'auto' && occurrence.dueDate <= todayIso) {
          const child: Transaction = {
            ...source,
            id: `${source.id}-${occurrence.dueDate}`,
            date: occurrence.dueDate,
            recurring: false,
            recurringSchedule: undefined,
            generatedFromRecurringId: source.id,
            generatedOccurrenceDate: occurrence.dueDate,
          };
          const generatedRecord: ScheduledOccurrenceRecord = {
            id,
            sourceTransactionId: source.id,
            originalDueDate: occurrence.dueDate,
            effectiveDueDate: occurrence.dueDate,
            status: 'confirmed',
            confirmedTransactionId: child.id,
            markedAt: new Date().toISOString(),
          };
          autoConfirmTransactions.push(child);
          if (!nextRecordIds.has(id)) {
            recordsToPersist.push(generatedRecord);
            nextRecordIds.add(id);
          }
          occurrences.push({
            id,
            source,
            originalDueDate: occurrence.dueDate,
            effectiveDueDate: occurrence.dueDate,
            dueDate: occurrence.dueDate,
            amount: occurrence.amount,
            type: occurrence.type,
            status: 'confirmed',
            recordStatus: 'confirmed',
            daysUntilDue: dayDifference(normalizedToday, parseISODate(occurrence.dueDate)),
            reminderDaysBefore: schedule.reminderDaysBefore ?? 0,
            currencyCode: '',
            currencySymbol: '',
            confirmedTransactionId: child.id,
          });
          return;
        }

        const effectiveDueDate = record?.effectiveDueDate ?? occurrence.dueDate;
        const recordStatus = record?.status;
        const status = displayStatusFor(recordStatus, effectiveDueDate, todayIso);

        occurrences.push({
          id,
          source,
          originalDueDate: record?.originalDueDate ?? occurrence.dueDate,
          effectiveDueDate,
          dueDate: effectiveDueDate,
          amount: occurrence.amount,
          type: occurrence.type,
          status,
          recordStatus,
          daysUntilDue: dayDifference(normalizedToday, parseISODate(effectiveDueDate)),
          reminderDaysBefore: schedule.reminderDaysBefore ?? 0,
          currencyCode: '',
          currencySymbol: '',
          notificationId: record?.notificationId,
          confirmedTransactionId: record?.confirmedTransactionId,
        });
      });
    });

  return {
    occurrences: occurrences.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    autoConfirmTransactions,
    recordsToPersist,
  };
}

function dayDifference(start: Date, end: Date) {
  const nextStart = new Date(start);
  const nextEnd = new Date(end);
  nextStart.setHours(0, 0, 0, 0);
  nextEnd.setHours(0, 0, 0, 0);
  return Math.ceil((nextEnd.getTime() - nextStart.getTime()) / 86400000);
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
