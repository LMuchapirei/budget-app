import type {
  Budget,
  BudgetProgress,
  BudgetStatus,
  ExchangeRatesCache,
  Goal,
  GoalPacing,
  GoalProgress,
  LedgerAccount,
  ReportingCurrency,
  Stats,
  Transaction,
} from '../../types';
import { normalizeCurrencyCode } from '../../utils/currency';
import type { DateFilter } from '../BudgetContext';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER_ID,
  addMonths,
  daysBetween,
  monthStart,
  parseBudgetDate,
  parseLocalDate,
  parseTransactionDate,
} from './budgetUtils';

interface MoneyConversion {
  amount: number;
  converted: boolean;
  missingCurrencyCode?: string;
}

export function buildBudgetProgress({
  budgets,
  convertTransactionAmountToReporting,
  transactions,
}: {
  budgets: Budget[];
  convertTransactionAmountToReporting: (transaction: Transaction) => MoneyConversion;
  transactions: Transaction[];
}): BudgetProgress[] {
  if (budgets.length === 0) return [];
  const now = new Date();
  const currentMonthStart = monthStart(now);
  const nextMonthStart = addMonths(currentMonthStart, 1);

  const spendForBudgetInRange = (
    budget: Budget,
    rangeStart: Date,
    rangeEndExclusive: Date,
    missing: Set<string>,
  ) => {
    return transactions.reduce((sum, transaction) => {
      if (transaction.type !== 'expense') return sum;
      if (transaction.transferPairId) return sum;
      if (transaction.category !== budget.category) return sum;
      if (budget.ledgerId && (transaction.ledgerId ?? DEFAULT_LEDGER_ID) !== budget.ledgerId) {
        return sum;
      }
      const date = parseTransactionDate(transaction.date);
      if (date < rangeStart || date >= rangeEndExclusive) return sum;
      const conversion = convertTransactionAmountToReporting(transaction);
      if (!conversion.converted && conversion.missingCurrencyCode) {
        missing.add(conversion.missingCurrencyCode);
      }
      return sum + conversion.amount;
    }, 0);
  };

  return budgets.map((budget) => {
    const missing = new Set<string>();
    const baseCap = Number(budget.amount) || 0;
    let carryOverAmount = 0;

    if (budget.carryOver && baseCap > 0) {
      let cursor = monthStart(parseBudgetDate(budget.createdAt));
      while (cursor < currentMonthStart) {
        const next = addMonths(cursor, 1);
        carryOverAmount += baseCap - spendForBudgetInRange(budget, cursor, next, missing);
        cursor = next;
      }
    }

    const spent = spendForBudgetInRange(budget, currentMonthStart, nextMonthStart, missing);
    const cap = Math.max(0, baseCap + carryOverAmount);
    const percent = cap > 0 ? spent / cap : spent > 0 ? 1 : 0;
    let status: BudgetStatus = 'safe';
    if (percent >= 1) status = 'over';
    else if (percent >= 0.8) status = 'warning';

    return {
      budget,
      spent,
      cap,
      baseCap,
      carryOverAmount,
      percent,
      status,
      isConverted: true,
      missingCurrencyCodes: Array.from(missing),
    };
  });
}

export function buildGoalProgress({
  goals,
  ledgerBalance,
  ledgers,
  reportingCurrency,
}: {
  goals: Goal[];
  ledgerBalance: (id: string) => number;
  ledgers: LedgerAccount[];
  reportingCurrency: ReportingCurrency;
}): GoalProgress[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return goals.map((goal) => {
    const ledger = goal.ledgerId
      ? ledgers.find((item) => item.id === goal.ledgerId)
      : null;
    const target = Math.max(0, Number(goal.targetAmount) || 0);
    const saved = ledger ? ledgerBalance(ledger.id) : 0;
    const remaining = Math.max(0, target - saved);
    const percent = target > 0 ? saved / target : 0;
    const deadline = parseLocalDate(goal.deadline);
    const daysRemaining = deadline ? daysBetween(today, deadline) : undefined;
    const currencyCode = goal.currencyCode || ledger?.currencyCode || reportingCurrency.code;
    const currencySymbol =
      goal.currencySymbol || ledger?.currencySymbol || reportingCurrency.symbol;
    const currencyMismatch =
      Boolean(goal.currencyCode && ledger && goal.currencyCode !== ledger.currencyCode);

    let pacing: GoalPacing = 'no-deadline';
    let suggestedMonthly = 0;

    if (goal.status === 'completed') {
      pacing = 'complete';
    } else if (goal.status === 'paused') {
      pacing = 'paused';
    } else if (target > 0 && saved >= target) {
      pacing = 'complete';
    } else if (!deadline) {
      pacing = 'no-deadline';
    } else if (daysRemaining !== undefined && daysRemaining <= 0) {
      pacing = 'behind';
      suggestedMonthly = remaining;
    } else {
      const created = parseBudgetDate(goal.createdAt);
      created.setHours(0, 0, 0, 0);
      const totalDays = Math.max(1, daysBetween(created, deadline));
      const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(created, today)));
      const expectedByNow = target * (elapsedDays / totalDays);
      if (saved > expectedByNow * 1.05) {
        pacing = 'ahead';
      } else if (saved >= expectedByNow) {
        pacing = 'on-track';
      } else {
        pacing = 'behind';
      }
      const monthsRemaining = Math.max(1, Math.ceil((daysRemaining ?? 0) / 30.44));
      suggestedMonthly = remaining / monthsRemaining;
    }

    return {
      goal,
      saved,
      remaining,
      percent,
      pacing,
      suggestedMonthly,
      daysRemaining,
      currencyCode,
      currencySymbol,
      linkedLedgerName: ledger?.name,
      linkedLedgerArchived: Boolean(ledger?.archived),
      currencyMismatch,
    };
  });
}

export function buildStats({
  activeLedger,
  activeLedgerId,
  convertTransactionAmountToReporting,
  currency,
  dateFilter,
  fxRates,
  reportingCurrency,
  scopedTransactions,
}: {
  activeLedger: LedgerAccount | null;
  activeLedgerId: string;
  convertTransactionAmountToReporting: (transaction: Transaction) => MoneyConversion;
  currency: string;
  dateFilter: DateFilter;
  fxRates: ExchangeRatesCache | null;
  reportingCurrency: ReportingCurrency;
  scopedTransactions: Transaction[];
}): Stats {
  const start = new Date(dateFilter.startDate);
  const end = new Date(dateFilter.endDate);
  end.setHours(23, 59, 59, 999);
  const filtered = scopedTransactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return date >= start && date <= end;
  });
  const missing = new Set<string>();
  const totals = filtered.reduce(
    (next, transaction) => {
      if (transaction.transferPairId) return next;

      const conversion =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(transaction)
          : { amount: Number(transaction.amount), converted: true };

      if (!conversion.converted && conversion.missingCurrencyCode) {
        missing.add(conversion.missingCurrencyCode);
      }

      if (transaction.type === 'income') {
        next.income += conversion.amount;
      } else {
        next.expenses += conversion.amount;
      }
      return next;
    },
    { income: 0, expenses: 0 },
  );

  const currencyCode =
    activeLedgerId === ALL_LEDGER_ID
      ? reportingCurrency.code
      : normalizeCurrencyCode(activeLedger?.currencyCode);
  const currencySymbol =
    activeLedgerId === ALL_LEDGER_ID
      ? reportingCurrency.symbol
      : activeLedger?.currencySymbol ?? currency;

  return {
    income: totals.income,
    expenses: totals.expenses,
    balance: totals.income - totals.expenses,
    count: filtered.length,
    isConverted: activeLedgerId === ALL_LEDGER_ID,
    currencyCode,
    currencySymbol,
    missingCurrencyCodes: Array.from(missing),
    rateAsOf: activeLedgerId === ALL_LEDGER_ID ? fxRates?.asOf : undefined,
  };
}
