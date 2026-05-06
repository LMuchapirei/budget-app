import { ALL_LEDGER_ID, type DateFilter } from '../../context/BudgetContext';
import type { FxRateStatus, LedgerAccount, Transaction, TxType } from '../../types';

export type EntryTab = 'all' | TxType | 'transfer';

export interface PeriodStats {
  income: number;
  expenses: number;
  balance: number;
}

export interface LedgerStats extends PeriodStats {
  openingBalance: number;
  missingCurrencyCodes: string[];
}

export interface MoneyConversion {
  amount: number;
  converted: boolean;
  missingCurrencyCode?: string;
}

export interface ChartDay {
  label: string;
  income: number;
  expenses: number;
}

export const MS_PER_DAY = 86400000;
export const SCREEN_PADDING = 24;
export const CHART_CARD_PADDING = 16;
const MAX_CHART_POINTS = 30;
const MAX_SPARKLINE_POINTS = 60;

export const ENTRY_TABS: { id: EntryTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfers' },
];

export function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatRateDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getAllAccountsMeta(
  currencyCode: string,
  fxStatus: FxRateStatus,
  rateAsOf?: string,
  missingCurrencyCodes: string[] = [],
  fxError?: string | null,
) {
  if (fxStatus === 'loading') return `Updating ${currencyCode} rates - partial estimate`;
  if (missingCurrencyCodes.length > 0) {
    return `Partial estimate in ${currencyCode} - missing ${missingCurrencyCodes.join(', ')}`;
  }
  if (fxStatus === 'error') {
    return `Estimated in ${currencyCode} - rates unavailable${fxError ? ` (${fxError})` : ''}`;
  }
  const date = formatRateDate(rateAsOf);
  return `Estimated in ${currencyCode}${date ? ` - rates ${date}` : ''}`;
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  dateFilter: DateFilter,
) {
  const start = parseIsoDate(dateFilter.startDate);
  const end = parseIsoDate(dateFilter.endDate);
  end.setHours(23, 59, 59, 999);
  return transactions.filter((transaction) => {
    const date = parseIsoDate(transaction.date);
    return date >= start && date <= end;
  });
}

function buildDailyTotals(
  transactions: Transaction[],
  amountForTransaction: (transaction: Transaction) => number,
) {
  return transactions.reduce<Record<string, { income: number; expenses: number }>>(
    (totalsByDate, transaction) => {
      if (transaction.transferPairId) return totalsByDate;
      if (!totalsByDate[transaction.date]) {
        totalsByDate[transaction.date] = { income: 0, expenses: 0 };
      }
      totalsByDate[transaction.date][transaction.type === 'income' ? 'income' : 'expenses'] +=
        amountForTransaction(transaction);
      return totalsByDate;
    },
    {},
  );
}

export function buildCumulativeChartDays(
  transactions: Transaction[],
  dateFilter: DateFilter,
  amountForTransaction: (transaction: Transaction) => number,
): ChartDay[] {
  const startMs = parseIsoDate(dateFilter.startDate).getTime();
  const endMs = parseIsoDate(dateFilter.endDate).getTime();
  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  if (totalDays <= 0) return [];

  const totalsByDate = buildDailyTotals(transactions, amountForTransaction);
  const step = Math.max(1, Math.ceil(totalDays / MAX_CHART_POINTS));
  const days: ChartDay[] = [];
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startMs + i * MS_PER_DAY);
    const dayTotals = totalsByDate[isoDate(date)];
    if (dayTotals) {
      cumulativeIncome += dayTotals.income;
      cumulativeExpenses += dayTotals.expenses;
    }

    if (i % step !== 0 && i !== totalDays - 1) continue;

    days.push({
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      income: cumulativeIncome,
      expenses: cumulativeExpenses,
    });
  }

  return days;
}

export function filterRecentEntries(
  transactions: Transaction[],
  entryTab: EntryTab,
  activeLedgerId: string,
) {
  const base =
    activeLedgerId === ALL_LEDGER_ID
      ? transactions.filter(
          (transaction) =>
            !transaction.transferPairId || transaction.transferDirection === 'out',
        )
      : transactions;

  if (entryTab === 'all') return base.slice(0, 20);
  if (entryTab === 'transfer') {
    return base.filter((transaction) => Boolean(transaction.transferPairId)).slice(0, 20);
  }
  return base
    .filter(
      (transaction) =>
        !transaction.transferPairId && transaction.type === entryTab,
    )
    .slice(0, 20);
}

export function buildLedgerStats({
  activeLedger,
  activeLedgerId,
  activeLedgers,
  convertAmountToReporting,
  convertTransactionAmountToReporting,
  scopedTransactions,
}: {
  activeLedger: LedgerAccount | null;
  activeLedgerId: string;
  activeLedgers: LedgerAccount[];
  convertAmountToReporting: (amount: number, fromCurrency: string) => MoneyConversion;
  convertTransactionAmountToReporting: (transaction: Transaction) => MoneyConversion;
  scopedTransactions: Transaction[];
}): LedgerStats {
  const missing = new Set<string>();
  const totals = scopedTransactions.reduce(
    (next, transaction) => {
      const conversion =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(transaction)
          : { amount: Number(transaction.amount), converted: true };

      if (!conversion.converted && conversion.missingCurrencyCode) {
        missing.add(conversion.missingCurrencyCode);
      }

      if (transaction.transferPairId) {
        if (transaction.type === 'income') next.transfersNet += conversion.amount;
        else next.transfersNet -= conversion.amount;
        return next;
      }

      if (transaction.type === 'income') {
        next.income += conversion.amount;
      } else {
        next.expenses += conversion.amount;
      }
      return next;
    },
    { income: 0, expenses: 0, transfersNet: 0 },
  );

  let openingTotal = 0;
  if (activeLedgerId === ALL_LEDGER_ID) {
    activeLedgers.forEach((ledger) => {
      const opening = Number(ledger.openingBalance ?? 0);
      if (!opening) return;
      const conversion = convertAmountToReporting(opening, ledger.currencyCode);
      if (!conversion.converted && conversion.missingCurrencyCode) {
        missing.add(conversion.missingCurrencyCode);
      }
      openingTotal += conversion.amount;
    });
  } else if (activeLedger) {
    openingTotal = Number(activeLedger.openingBalance ?? 0);
  }

  return {
    income: totals.income,
    expenses: totals.expenses,
    balance: openingTotal + totals.income - totals.expenses + totals.transfersNet,
    openingBalance: openingTotal,
    missingCurrencyCodes: Array.from(missing),
  };
}

export function buildPreviousPeriodStats({
  activeLedgerId,
  convertTransactionAmountToReporting,
  dateFilter,
  scopedTransactions,
}: {
  activeLedgerId: string;
  convertTransactionAmountToReporting: (transaction: Transaction) => MoneyConversion;
  dateFilter: DateFilter;
  scopedTransactions: Transaction[];
}): PeriodStats {
  const start = parseIsoDate(dateFilter.startDate);
  const end = parseIsoDate(dateFilter.endDate);
  end.setHours(0, 0, 0, 0);
  const dayCount = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const prevEnd = new Date(start.getTime() - MS_PER_DAY);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - (dayCount - 1) * MS_PER_DAY);
  prevStart.setHours(0, 0, 0, 0);

  let income = 0;
  let expenses = 0;
  scopedTransactions.forEach((transaction) => {
    if (transaction.transferPairId) return;
    const date = parseIsoDate(transaction.date);
    if (date < prevStart || date > prevEnd) return;
    const amount =
      activeLedgerId === ALL_LEDGER_ID
        ? convertTransactionAmountToReporting(transaction).amount
        : Number(transaction.amount);
    if (transaction.type === 'income') income += amount;
    else expenses += amount;
  });
  return { income, expenses, balance: income - expenses };
}

export function buildNetSparkline(
  transactions: Transaction[],
  dateFilter: DateFilter,
  amountForTransaction: (transaction: Transaction) => number,
) {
  const startMs = parseIsoDate(dateFilter.startDate).getTime();
  const endMs = parseIsoDate(dateFilter.endDate).getTime();
  if (endMs < startMs) return [] as number[];

  const totalsByDate = buildDailyTotals(transactions, amountForTransaction);
  const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  const step = Math.max(1, Math.ceil(totalDays / MAX_SPARKLINE_POINTS));
  const points: number[] = [];
  let cumulativeNet = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startMs + i * MS_PER_DAY);
    const dayTotals = totalsByDate[isoDate(date)];
    if (dayTotals) {
      cumulativeNet += dayTotals.income - dayTotals.expenses;
    }
    if (i % step !== 0 && i !== totalDays - 1) continue;
    points.push(cumulativeNet);
  }
  return points;
}

function percentDelta(current: number, prev: number) {
  if (!Number.isFinite(prev) || prev === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - prev) / Math.abs(prev)) * 100;
}

function savingsRate(income: number, expenses: number) {
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}

export function getSummaryDeltas(current: PeriodStats, previous: PeriodStats) {
  return {
    net: percentDelta(current.balance, previous.balance),
    income: percentDelta(current.income, previous.income),
    expenses: percentDelta(current.expenses, previous.expenses),
    savings: savingsRate(current.income, current.expenses),
    prevSavings: savingsRate(previous.income, previous.expenses),
  };
}

export function getSummaryEyebrow(dateFilter: DateFilter) {
  const start = parseIsoDate(dateFilter.startDate);
  const end = parseIsoDate(dateFilter.endDate);
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const startOfMonth =
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  if (sameMonth && startOfMonth) {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }
  return 'SELECTED PERIOD';
}
