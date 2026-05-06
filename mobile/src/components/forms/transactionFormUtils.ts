import { ALL_LEDGER_ID } from '../../context/BudgetContext';
import type {
  Category,
  LedgerAccount,
  RecurringFrequency,
  RecurringSchedule,
  Transaction,
  TxType,
} from '../../types';

export type DatePickerTarget = 'transaction' | 'recurringStart' | 'recurringEnd';

export const TRANSACTION_TYPES: TxType[] = ['expense', 'income'];
export const RECURRING_FREQUENCIES: RecurringFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
];

export function isoToday() {
  return new Date().toISOString().split('T')[0];
}

export function formatDateLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function defaultCategoryForType(type: TxType): Category {
  return type === 'income' ? 'Salary' : 'Food';
}

export function selectableLedgersForTransaction(
  activeLedgers: LedgerAccount[],
  ledgers: LedgerAccount[],
  transaction?: Transaction | null,
) {
  if (!transaction?.ledgerId) return activeLedgers;
  if (activeLedgers.some((ledger) => ledger.id === transaction.ledgerId)) {
    return activeLedgers;
  }
  const archivedTarget = ledgers.find((ledger) => ledger.id === transaction.ledgerId);
  return archivedTarget ? [...activeLedgers, archivedTarget] : activeLedgers;
}

export function preferredLedgerForForm({
  activeLedgerId,
  selectableLedgers,
  transaction,
}: {
  activeLedgerId: string;
  selectableLedgers: LedgerAccount[];
  transaction?: Transaction | null;
}) {
  return (
    transaction?.ledgerId ??
    (activeLedgerId === ALL_LEDGER_ID
      ? selectableLedgers[0]?.id
      : activeLedgerId) ??
    selectableLedgers[0]?.id
  );
}

export function parsePositiveAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseIntegerAtLeast(value: string, min: number) {
  return Math.max(min, Number(value) || min);
}

export function buildRecurringSchedule({
  autoPost,
  date,
  recurring,
  recurringEndDate,
  recurringFrequency,
  recurringInterval,
  recurringStartDate,
  reminderDaysBefore,
  transaction,
}: {
  autoPost: boolean;
  date: string;
  recurring: boolean;
  recurringEndDate: string;
  recurringFrequency: RecurringFrequency;
  recurringInterval: string;
  recurringStartDate: string;
  reminderDaysBefore: string;
  transaction?: Transaction | null;
}): RecurringSchedule | undefined {
  if (!recurring) return undefined;

  return {
    frequency: recurringFrequency,
    interval: parseIntegerAtLeast(recurringInterval, 1),
    startDate: recurringStartDate.trim() || date,
    endDate: recurringEndDate.trim() || undefined,
    reminderDaysBefore: parseIntegerAtLeast(reminderDaysBefore, 0),
    postMode: autoPost ? 'auto' : 'confirm',
    paused: transaction?.recurringSchedule?.paused ?? false,
    pausedAt: transaction?.recurringSchedule?.pausedAt,
  };
}

export function datePickerConfig({
  activeDatePicker,
  date,
  recurringEndDate,
  recurringStartDate,
}: {
  activeDatePicker: DatePickerTarget | null;
  date: string;
  recurringEndDate: string;
  recurringStartDate: string;
}) {
  return {
    value:
      activeDatePicker === 'recurringStart'
        ? recurringStartDate
        : activeDatePicker === 'recurringEnd'
        ? recurringEndDate || recurringStartDate || date
        : date,
    title:
      activeDatePicker === 'recurringStart'
        ? 'First due date'
        : activeDatePicker === 'recurringEnd'
        ? 'Ends on'
        : 'Entry date',
    min: activeDatePicker === 'recurringEnd' ? recurringStartDate || date : undefined,
  };
}
