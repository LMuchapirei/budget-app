import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Transaction,
  CustomCategory,
  Stats,
  Category,
  TransactionEditHistory,
  LedgerAccount,
  ReportingCurrency,
  ExchangeRatesCache,
  FxRateStatus,
  Budget,
  BudgetProgress,
  Goal,
  GoalProgress,
  ConfirmOccurrenceOverride,
  ScheduledOccurrence,
  BillNotificationStatus,
  BillNotificationSyncResult,
  ScheduledOccurrenceRecord,
  PaymentEvidence,
  PaymentEvidenceDraft,
  TransferDraft,
} from '../types';
import { storage } from '../services/storage';
import {
  canConvertCurrency,
  convertExchangeAmount,
  fetchLatestExchangeRates,
  isExchangeRateCacheFresh,
  type ConversionResult,
} from '../services/exchangeRates';
import {
  DEFAULT_REPORTING_CURRENCY,
  currencyOptionFromCode,
  currencyOptionFromSymbol,
  formatCompactCurrencyAmount,
  formatCurrencyAmount,
  normalizeCurrencyCode,
} from '../utils/currency';
import {
  cancelAllOccurrenceReminders,
  getScheduledNotificationPermission,
} from '../services/scheduledNotifications';
import { clearEvidenceFiles } from '../services/paymentEvidenceFiles';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER,
  DEFAULT_LEDGER_ID,
  maskAccountNumberValue,
  migrateLegacyBillRecords,
  monthlyProjectionValue,
  normalizeLedger,
  persistState,
  recurringScheduleChanged,
} from './budget/budgetUtils';
import {
  buildBudgetProgress,
  buildGoalProgress,
  buildStats,
} from './budget/budgetDerivedState';
import { useScheduledOccurrences } from './budget/useScheduledOccurrences';

export { ALL_LEDGER_ID };

export interface DateFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface BudgetContextValue {
  transactions: Transaction[];
  scopedTransactions: Transaction[];
  ledgers: LedgerAccount[];
  activeLedgers: LedgerAccount[];
  activeLedgerId: string;
  activeLedger: LedgerAccount | null;
  transactionEditHistory: TransactionEditHistory[];
  customCategories: CustomCategory[];
  stats: Stats;
  loading: boolean;
  currency: string;
  reportingCurrency: ReportingCurrency;
  fxRates: ExchangeRatesCache | null;
  fxStatus: FxRateStatus;
  fxError: string | null;
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  setActiveLedger: (id: string) => void;
  addLedger: (ledger: Omit<LedgerAccount, 'id'>) => void;
  updateLedger: (ledger: LedgerAccount) => void;
  archiveLedger: (id: string) => void;
  unarchiveLedger: (id: string) => void;
  deleteLedger: (id: string, reassignToId?: string) => void;
  setDefaultLedger: (id: string) => void;
  ledgerTransactionCount: (id: string) => number;
  ledgerOpeningBalance: (id: string) => number;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
  addTransfer: (draft: TransferDraft) => void;
  updateTransfer: (pairId: string, draft: TransferDraft) => void;
  removeTransfer: (pairId: string) => void;
  budgets: Budget[];
  budgetProgress: BudgetProgress[];
  addBudget: (b: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (b: Budget) => void;
  removeBudget: (id: string) => void;
  goals: Goal[];
  goalProgress: GoalProgress[];
  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'status' | 'completedAt'>) => void;
  updateGoal: (g: Goal) => void;
  removeGoal: (id: string) => void;
  pauseGoal: (id: string) => void;
  resumeGoal: (id: string) => void;
  markGoalComplete: (id: string) => void;
  ledgerBalance: (id: string) => number;
  scheduledOccurrences: ScheduledOccurrence[];
  scheduledOccurrenceRecords: ScheduledOccurrenceRecord[];
  paymentEvidence: PaymentEvidence[];
  evidenceForOccurrence: (occurrenceId: string) => PaymentEvidence[];
  addPaymentEvidence: (occurrenceId: string, evidence: PaymentEvidenceDraft) => void;
  removePaymentEvidence: (id: string) => void;
  scheduledNotificationStatus: BillNotificationStatus;
  confirmOccurrence: (id: string, override?: ConfirmOccurrenceOverride) => void;
  skipOccurrence: (id: string) => void;
  postponeOccurrence: (id: string, newDate: string) => void;
  clearOccurrenceStatus: (id: string) => void;
  pauseSchedule: (transactionId: string) => void;
  resumeSchedule: (transactionId: string) => void;
  refreshScheduledNotificationPermission: () => Promise<BillNotificationStatus>;
  requestScheduledNotificationPermission: () => Promise<BillNotificationStatus>;
  syncScheduledNotifications: () => Promise<BillNotificationSyncResult>;
  billOccurrences: ScheduledOccurrence[];
  billOccurrenceRecords: ScheduledOccurrenceRecord[];
  billNotificationStatus: BillNotificationStatus;
  markBillPaid: (id: string) => void;
  markBillMissed: (id: string) => void;
  clearBillStatus: (id: string) => void;
  refreshBillNotificationPermission: () => Promise<BillNotificationStatus>;
  requestBillNotificationPermission: () => Promise<BillNotificationStatus>;
  syncBillNotifications: () => Promise<BillNotificationSyncResult>;
  addCustomCategory: (c: CustomCategory) => void;
  updateCustomCategory: (c: CustomCategory) => void;
  removeCustomCategory: (id: string, reassignTo?: string) => void;
  categoryTransactionCount: (name: string) => number;
  setCurrency: (c: string) => void;
  setReportingCurrency: (currency: ReportingCurrency) => Promise<void>;
  clearAllData: () => Promise<void>;
  formatMoney: (n: number) => string;
  formatReportingMoney: (n: number) => string;
  formatCompactMoney: (n: number) => string;
  formatActiveMoney: (n: number) => string;
  formatMoneyForLedger: (n: number, ledgerId?: string | null) => string;
  convertAmountToReporting: (amount: number, fromCurrency: string) => ConversionResult;
  convertTransactionAmountToReporting: (transaction: Transaction) => ConversionResult;
  getTransactionAmountForActiveView: (transaction: Transaction) => number;
  maskAccountNumber: (accountNumber?: string) => string;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([DEFAULT_LEDGER]);
  const [activeLedgerId, setActiveLedgerId] = useState<string>(ALL_LEDGER_ID);
  const [transactionEditHistory, setTransactionEditHistory] = useState<TransactionEditHistory[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [scheduledOccurrenceRecords, setScheduledOccurrenceRecords] = useState<ScheduledOccurrenceRecord[]>([]);
  const [paymentEvidence, setPaymentEvidence] = useState<PaymentEvidence[]>([]);
  const [scheduledNotificationStatus, setScheduledNotificationStatus] =
    useState<BillNotificationStatus>('unknown');
  const [reportingCurrency, setReportingCurrencyState] =
    useState<ReportingCurrency>(DEFAULT_REPORTING_CURRENCY);
  const [fxRates, setFxRates] = useState<ExchangeRatesCache | null>(null);
  const [fxStatus, setFxStatus] = useState<FxRateStatus>('idle');
  const [fxError, setFxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currency = reportingCurrency.symbol;
  const today = new Date();
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  });

  useEffect(() => {
    (async () => {
      try {
        const txs = await storage.getTransactions();
        const savedLedgers = storage.getLedgers ? await storage.getLedgers() : [];
        const nextLedgers = savedLedgers.length > 0
          ? savedLedgers.map(normalizeLedger)
          : [DEFAULT_LEDGER];
        setLedgers(nextLedgers);
        if (savedLedgers.some((ledger) => !ledger.currencyCode || !ledger.currencySymbol)) {
          await storage.saveLedgers(nextLedgers);
        }

        let normalizedTransactions: Transaction[] = [];
        if (txs) {
          normalizedTransactions = txs.map((t) => ({
            ...t,
            ledgerId: t.ledgerId ?? DEFAULT_LEDGER_ID,
          }));
          setTransactions(normalizedTransactions);
          if (normalizedTransactions.some((t, i) => t.ledgerId !== txs[i]?.ledgerId)) {
            await storage.saveTransactions(normalizedTransactions);
          }
        }

        const savedActiveLedger = storage.getActiveLedger ? await storage.getActiveLedger() : null;
        if (
          savedActiveLedger &&
          (savedActiveLedger === ALL_LEDGER_ID ||
            nextLedgers.some((l) => l.id === savedActiveLedger && !l.archived))
        ) {
          setActiveLedgerId(savedActiveLedger);
        }

        const edits = storage.getTransactionEditHistory
          ? await storage.getTransactionEditHistory()
          : [];
        if (edits) setTransactionEditHistory(edits);
        const cats = await storage.getCategories();
        if (cats) setCustomCategories(cats);

        const savedBudgets = storage.getBudgets ? await storage.getBudgets() : [];
        if (savedBudgets) setBudgets(savedBudgets);

        const savedGoals = storage.getGoals ? await storage.getGoals() : [];
        if (savedGoals) setGoals(savedGoals);

        const savedScheduledOccurrenceRecords = storage.getScheduledOccurrenceRecords
          ? await storage.getScheduledOccurrenceRecords()
          : [];
        const legacyBillOccurrenceRecords = storage.getBillOccurrenceRecords
          ? await storage.getBillOccurrenceRecords()
          : [];
        if (savedScheduledOccurrenceRecords.length > 0) {
          setScheduledOccurrenceRecords(savedScheduledOccurrenceRecords);
        } else if (legacyBillOccurrenceRecords.length > 0) {
          const migrated = migrateLegacyBillRecords(
            legacyBillOccurrenceRecords,
            normalizedTransactions,
          );
          setScheduledOccurrenceRecords(migrated);
          await storage.saveScheduledOccurrenceRecords(migrated);
          await storage.clearLegacyBillOccurrenceRecords();
        }

        const savedPaymentEvidence = storage.getPaymentEvidence
          ? await storage.getPaymentEvidence()
          : [];
        if (savedPaymentEvidence) setPaymentEvidence(savedPaymentEvidence);

        const savedReportingCurrency = await storage.getReportingCurrency();
        const legacyCurrencySymbol = await storage.getCurrency();
        const nextReportingCurrency = savedReportingCurrency
          ? currencyOptionFromCode(savedReportingCurrency.code)
          : currencyOptionFromSymbol(legacyCurrencySymbol);
        setReportingCurrencyState(nextReportingCurrency);
        if (!savedReportingCurrency) {
          await storage.setReportingCurrency(nextReportingCurrency);
        }

        const cachedRates = await storage.getExchangeRatesCache();
        if (cachedRates) setFxRates(cachedRates);

        setScheduledNotificationStatus(await getScheduledNotificationPermission());
      } catch {
        // First run
      }
      setLoading(false);
    })();
  }, []);

  const persistTransactions = useCallback(
    (next: Transaction[]) =>
      persistState(next, setTransactions, (value) => storage.saveTransactions(value)),
    [],
  );

  const persistLedgers = useCallback(
    (next: LedgerAccount[]) =>
      persistState(next, setLedgers, (value) => storage.saveLedgers(value)),
    [],
  );

  const persistCategories = useCallback(
    (next: CustomCategory[]) =>
      persistState(next, setCustomCategories, (value) => storage.saveCategories(value)),
    [],
  );

  const persistEditHistory = useCallback(
    (next: TransactionEditHistory[]) =>
      persistState(next, setTransactionEditHistory, (value) =>
        storage.saveTransactionEditHistory(value),
      ),
    [],
  );

  const persistBudgets = useCallback(
    (next: Budget[]) =>
      persistState(next, setBudgets, (value) => storage.saveBudgets(value)),
    [],
  );

  const persistGoals = useCallback(
    (next: Goal[]) =>
      persistState(next, setGoals, (value) => storage.saveGoals(value)),
    [],
  );

  const persistScheduledOccurrenceRecords = useCallback(
    (next: ScheduledOccurrenceRecord[]) =>
      persistState(next, setScheduledOccurrenceRecords, (value) =>
        storage.saveScheduledOccurrenceRecords(value),
      ),
    [],
  );

  const persistPaymentEvidence = useCallback(
    (next: PaymentEvidence[]) =>
      persistState(next, setPaymentEvidence, (value) => storage.savePaymentEvidence(value)),
    [],
  );

  const ledgerCurrencyCodes = useMemo(
    () => Array.from(new Set(ledgers.map((ledger) => normalizeCurrencyCode(ledger.currencyCode)))),
    [ledgers],
  );

  const ledgerCurrencyKey = ledgerCurrencyCodes.join(',');

  useEffect(() => {
    if (loading) return;

    const needsFx = ledgerCurrencyCodes.some((code) => code !== reportingCurrency.code);
    if (!needsFx) {
      setFxStatus('ready');
      setFxError(null);
      return;
    }

    let cancelled = false;
    const hasUsableCache =
      fxRates !== null &&
      ledgerCurrencyCodes.every((code) =>
        canConvertCurrency(fxRates, code, reportingCurrency.code),
      );
    const hasFreshCache =
      hasUsableCache && isExchangeRateCacheFresh(fxRates, reportingCurrency.code);

    if (hasFreshCache) {
      setFxStatus('ready');
      setFxError(null);
      return;
    }

    setFxStatus(hasUsableCache ? 'stale' : 'loading');
    setFxError(null);

    fetchLatestExchangeRates(reportingCurrency.code)
      .then(async (cache) => {
        if (cancelled) return;
        setFxRates(cache);
        setFxStatus('ready');
        setFxError(null);
        await storage.saveExchangeRatesCache(cache);
      })
      .catch((error) => {
        if (cancelled) return;
        setFxStatus(hasUsableCache ? 'stale' : 'error');
        setFxError(error instanceof Error ? error.message : 'Could not update exchange rates');
      });

    return () => {
      cancelled = true;
    };
  }, [fxRates, ledgerCurrencyCodes, ledgerCurrencyKey, loading, reportingCurrency.code]);

  const setActiveLedger = (id: string) => {
    setActiveLedgerId(id);
    storage.setActiveLedger(id).catch(console.error);
  };

  const addLedger = (ledger: Omit<LedgerAccount, 'id'>) => {
    const nextLedger: LedgerAccount = normalizeLedger({
      ...ledger,
      id: `${Date.now()}-${ledger.name.toLowerCase().replace(/\s+/g, '-')}`,
    });
    persistLedgers([...ledgers, nextLedger]);
    setActiveLedger(nextLedger.id);
  };

  const updateLedger = (updated: LedgerAccount) => {
    const normalized = normalizeLedger(updated);
    persistLedgers(ledgers.map((l) => (l.id === normalized.id ? normalized : l)));
  };

  const archiveLedger = (id: string) => {
    const ledger = ledgers.find((l) => l.id === id);
    if (!ledger || ledger.isDefault) return;
    persistLedgers(
      ledgers.map((l) => (l.id === id ? { ...l, archived: true } : l)),
    );
    if (activeLedgerId === id) setActiveLedger(ALL_LEDGER_ID);
  };

  const unarchiveLedger = (id: string) => {
    persistLedgers(
      ledgers.map((l) => (l.id === id ? { ...l, archived: false } : l)),
    );
  };

  const setDefaultLedger = (id: string) => {
    const target = ledgers.find((l) => l.id === id);
    if (!target || target.archived) return;
    persistLedgers(
      ledgers.map((l) => ({ ...l, isDefault: l.id === id })),
    );
  };

  const deleteLedger = (id: string, reassignToId?: string) => {
    const ledger = ledgers.find((l) => l.id === id);
    if (!ledger || ledger.isDefault) return;

    const linked = transactions.filter((t) => (t.ledgerId ?? DEFAULT_LEDGER_ID) === id);
    if (linked.length > 0) {
      if (!reassignToId) return;
      const target = ledgers.find((l) => l.id === reassignToId && !l.archived);
      if (!target || target.id === id) return;
      const reassigned = transactions.map((t) =>
        (t.ledgerId ?? DEFAULT_LEDGER_ID) === id ? { ...t, ledgerId: reassignToId } : t,
      );
      persistTransactions(reassigned);
    }

    persistLedgers(ledgers.filter((l) => l.id !== id));
    persistGoals(
      goals.map((goal) =>
        goal.ledgerId === id ? { ...goal, ledgerId: undefined } : goal,
      ),
    );
    if (activeLedgerId === id) setActiveLedger(ALL_LEDGER_ID);
  };

  const ledgerTransactionCount = useCallback(
    (id: string) =>
      transactions.filter((t) => (t.ledgerId ?? DEFAULT_LEDGER_ID) === id).length,
    [transactions],
  );

  const ledgerOpeningBalance = useCallback(
    (id: string) => {
      const ledger = ledgers.find((l) => l.id === id);
      return Number(ledger?.openingBalance ?? 0);
    },
    [ledgers],
  );

  const ledgerBalance = useCallback(
    (id: string) => {
      const opening = ledgerOpeningBalance(id);
      return transactions.reduce((sum, transaction) => {
        if ((transaction.ledgerId ?? DEFAULT_LEDGER_ID) !== id) return sum;
        const amount = Number(transaction.amount) || 0;
        return sum + (transaction.type === 'income' ? amount : -amount);
      }, opening);
    },
    [ledgerOpeningBalance, transactions],
  );

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const ledgerId =
      t.ledgerId ??
      (activeLedgerId === ALL_LEDGER_ID ? DEFAULT_LEDGER_ID : activeLedgerId);
    const next = [{ ...t, ledgerId, id: Date.now().toString() }, ...transactions];
    persistTransactions(next);
  };

  const scheduled = useScheduledOccurrences({
    ledgers,
    loading,
    paymentEvidence,
    persistPaymentEvidence,
    persistScheduledOccurrenceRecords,
    persistTransactions,
    reportingCurrency,
    scheduledNotificationStatus,
    scheduledOccurrenceRecords,
    setScheduledNotificationStatus,
    transactions,
  });
  const {
    scheduledOccurrences,
    evidenceForOccurrence,
    addPaymentEvidence,
    removePaymentEvidence,
    confirmOccurrence,
    skipOccurrence,
    postponeOccurrence,
    clearOccurrenceStatus,
    pauseSchedule,
    resumeSchedule,
    refreshScheduledNotificationPermission,
    requestScheduledNotificationPermission,
    syncScheduledNotifications,
  } = scheduled;

  const updateTransaction = (updated: Transaction) => {
    const before = transactions.find((x) => x.id === updated.id);
    if (!before) return;

    const nextTransactions = transactions.map((x) => (x.id === updated.id ? updated : x));
    const projectionMonthlyDelta = monthlyProjectionValue(updated) - monthlyProjectionValue(before);
    const edit: TransactionEditHistory = {
      id: `${Date.now()}-${updated.id}`,
      transactionId: updated.id,
      editedAt: new Date().toISOString(),
      before,
      after: updated,
      projectionMonthlyDelta,
      projectionAnnualDelta: projectionMonthlyDelta * 12,
    };

    persistTransactions(nextTransactions);
    persistEditHistory([edit, ...transactionEditHistory]);

    if (recurringScheduleChanged(before, updated)) {
      scheduled.cleanupScheduledRecordsForSource(updated.id, 'pending');
    }
  };

  const removeTransaction = (id: string) => {
    scheduled.cleanupScheduledRecordsForSource(id, 'all');
    const target = transactions.find((x) => x.id === id);
    if (target?.transferPairId) {
      // Removing one half of a transfer removes the other half too.
      persistTransactions(
        transactions.filter(
          (x) => x.id !== id && x.transferPairId !== target.transferPairId,
        ),
      );
      return;
    }
    persistTransactions(transactions.filter((x) => x.id !== id));
  };

  const addTransfer = (draft: TransferDraft) => {
    if (!draft.fromLedgerId || !draft.toLedgerId) return;
    if (draft.fromLedgerId === draft.toLedgerId) return;
    const amountOut = Math.abs(Number(draft.amount) || 0);
    if (amountOut <= 0) return;

    const fromLedger = ledgers.find((l) => l.id === draft.fromLedgerId);
    const toLedger = ledgers.find((l) => l.id === draft.toLedgerId);
    if (!fromLedger || !toLedger) return;

    let amountIn = draft.amountIn != null ? Math.abs(Number(draft.amountIn)) : amountOut;
    if (
      draft.amountIn == null &&
      fromLedger.currencyCode !== toLedger.currencyCode
    ) {
      const conversion = convertExchangeAmount(
        amountOut,
        fromLedger.currencyCode,
        toLedger.currencyCode,
        fxRates,
      );
      if (conversion.converted) amountIn = conversion.amount;
      else return;
    }

    const pairId = `xfer-${Date.now()}`;
    const date = draft.date;
    const description =
      draft.description?.trim() || `Transfer to ${toLedger.name}`;
    const inverseDescription =
      draft.description?.trim() || `Transfer from ${fromLedger.name}`;

    const outTx: Transaction = {
      id: `${pairId}-out`,
      type: 'expense',
      amount: amountOut,
      description,
      category: 'Transfer',
      date,
      recurring: false,
      ledgerId: fromLedger.id,
      transferPairId: pairId,
      transferDirection: 'out',
      transferCounterpartLedgerId: toLedger.id,
    };

    const inTx: Transaction = {
      id: `${pairId}-in`,
      type: 'income',
      amount: amountIn,
      description: inverseDescription,
      category: 'Transfer',
      date,
      recurring: false,
      ledgerId: toLedger.id,
      transferPairId: pairId,
      transferDirection: 'in',
      transferCounterpartLedgerId: fromLedger.id,
    };

    persistTransactions([outTx, inTx, ...transactions]);
  };

  const updateTransfer = (pairId: string, draft: TransferDraft) => {
    if (!pairId) return;
    if (draft.fromLedgerId === draft.toLedgerId) return;
    const halves = transactions.filter((x) => x.transferPairId === pairId);
    if (halves.length === 0) return;

    const amountOut = Math.abs(Number(draft.amount) || 0);
    if (amountOut <= 0) return;

    const fromLedger = ledgers.find((l) => l.id === draft.fromLedgerId);
    const toLedger = ledgers.find((l) => l.id === draft.toLedgerId);
    if (!fromLedger || !toLedger) return;

    let amountIn = draft.amountIn != null ? Math.abs(Number(draft.amountIn)) : amountOut;
    if (
      draft.amountIn == null &&
      fromLedger.currencyCode !== toLedger.currencyCode
    ) {
      const conversion = convertExchangeAmount(
        amountOut,
        fromLedger.currencyCode,
        toLedger.currencyCode,
        fxRates,
      );
      if (conversion.converted) amountIn = conversion.amount;
      else return;
    }

    const description =
      draft.description?.trim() || `Transfer to ${toLedger.name}`;
    const inverseDescription =
      draft.description?.trim() || `Transfer from ${fromLedger.name}`;

    const next = transactions.map((x) => {
      if (x.transferPairId !== pairId) return x;
      if (x.transferDirection === 'out') {
        return {
          ...x,
          amount: amountOut,
          description,
          date: draft.date,
          ledgerId: fromLedger.id,
          transferCounterpartLedgerId: toLedger.id,
        };
      }
      return {
        ...x,
        amount: amountIn,
        description: inverseDescription,
        date: draft.date,
        ledgerId: toLedger.id,
        transferCounterpartLedgerId: fromLedger.id,
      };
    });
    persistTransactions(next);
  };

  const removeTransfer = (pairId: string) => {
    if (!pairId) return;
    persistTransactions(transactions.filter((x) => x.transferPairId !== pairId));
  };

  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
  };

  const updateCustomCategory = (updated: CustomCategory) => {
    const before = customCategories.find((x) => x.id === updated.id);
    if (!before) return;
    persistCategories(
      customCategories.map((x) => (x.id === updated.id ? updated : x)),
    );
    // If the title changed, propagate the rename to existing transactions and
    // budgets so historical data stays linked.
    if (before.title !== updated.title) {
      persistTransactions(
        transactions.map((t) =>
          t.category === before.title ? { ...t, category: updated.title } : t,
        ),
      );
      persistBudgets(
        budgets.map((b) =>
          b.category === before.title ? { ...b, category: updated.title } : b,
        ),
      );
    }
  };

  const removeCustomCategory = (id: string, reassignTo?: string) => {
    const target = customCategories.find((c) => c.id === id);
    if (!target) return;
    const linkedCount = transactions.filter((t) => t.category === target.title).length;
    if (linkedCount > 0) {
      if (!reassignTo || reassignTo === target.title) return;
      persistTransactions(
        transactions.map((t) =>
          t.category === target.title ? { ...t, category: reassignTo } : t,
        ),
      );
      persistBudgets(
        budgets.map((b) =>
          b.category === target.title ? { ...b, category: reassignTo } : b,
        ),
      );
    }
    persistCategories(customCategories.filter((c) => c.id !== id));
  };

  const categoryTransactionCount = useCallback(
    (name: string) =>
      transactions.filter((t) => t.category === name).length,
    [transactions],
  );

  const addBudget = (b: Omit<Budget, 'id' | 'createdAt'>) => {
    const next: Budget = {
      ...b,
      id: `${Date.now()}-${b.category.toLowerCase().replace(/\s+/g, '-')}`,
      createdAt: new Date().toISOString(),
    };
    persistBudgets([next, ...budgets]);
  };

  const updateBudget = (updated: Budget) => {
    persistBudgets(budgets.map((b) => (b.id === updated.id ? updated : b)));
  };

  const removeBudget = (id: string) => {
    persistBudgets(budgets.filter((b) => b.id !== id));
  };

  const addGoal = (g: Omit<Goal, 'id' | 'createdAt' | 'status' | 'completedAt'>) => {
    const next: Goal = {
      ...g,
      id: `${Date.now()}-${g.name.toLowerCase().replace(/\s+/g, '-')}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    persistGoals([next, ...goals]);
  };

  const updateGoal = (updated: Goal) => {
    persistGoals(goals.map((goal) => (goal.id === updated.id ? updated : goal)));
  };

  const removeGoal = (id: string) => {
    persistGoals(goals.filter((goal) => goal.id !== id));
  };

  const pauseGoal = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id && goal.status === 'active'
          ? { ...goal, status: 'paused', completedAt: undefined }
          : goal,
      ),
    );
  };

  const resumeGoal = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id && goal.status === 'paused'
          ? { ...goal, status: 'active', completedAt: undefined }
          : goal,
      ),
    );
  };

  const markGoalComplete = (id: string) => {
    persistGoals(
      goals.map((goal) =>
        goal.id === id
          ? { ...goal, status: 'completed', completedAt: new Date().toISOString() }
          : goal,
      ),
    );
  };

  const setReportingCurrency = useCallback(async (nextCurrency: ReportingCurrency) => {
    const normalized = currencyOptionFromCode(nextCurrency.code);
    setReportingCurrencyState(normalized);
    await storage.setReportingCurrency(normalized);
    await storage.setCurrency(normalized.symbol);
  }, []);

  const setCurrency = useCallback(async (cur: string) => {
    await setReportingCurrency(currencyOptionFromSymbol(cur));
  }, [setReportingCurrency]);

  const clearAllData = async () => {
    await cancelAllOccurrenceReminders();
    await clearEvidenceFiles();
    await storage.clearAllData();
    setTransactions([]);
    setTransactionEditHistory([]);
    setLedgers([DEFAULT_LEDGER]);
    setActiveLedgerId(ALL_LEDGER_ID);
    setCustomCategories([]);
    setBudgets([]);
    setGoals([]);
    setScheduledOccurrenceRecords([]);
    setPaymentEvidence([]);
    setScheduledNotificationStatus('unknown');
    setReportingCurrencyState(DEFAULT_REPORTING_CURRENCY);
    setFxRates(null);
    setFxStatus('idle');
    setFxError(null);
  };

  const formatReportingMoney = useCallback((n: number) => {
    return formatCurrencyAmount(n, reportingCurrency.symbol);
  }, [reportingCurrency.symbol]);

  const formatMoney = formatReportingMoney;

  const formatCompactMoney = useCallback((n: number) => {
    return formatCompactCurrencyAmount(n, reportingCurrency.symbol);
  }, [reportingCurrency.symbol]);

  const formatMoneyForLedger = useCallback((n: number, ledgerId?: string | null) => {
    const ledger = ledgers.find((item) => item.id === ledgerId);
    const symbol = ledger?.currencySymbol ?? currency;
    return formatCurrencyAmount(n, symbol);
  }, [currency, ledgers]);

  const ledgerCurrencyCodeForId = useCallback((ledgerId?: string | null) => {
    const ledger = ledgers.find((item) => item.id === ledgerId);
    return normalizeCurrencyCode(ledger?.currencyCode ?? DEFAULT_REPORTING_CURRENCY.code);
  }, [ledgers]);

  const convertAmountToReporting = useCallback((amount: number, fromCurrency: string) => {
    return convertExchangeAmount(
      amount,
      fromCurrency,
      reportingCurrency.code,
      fxRates,
    );
  }, [fxRates, reportingCurrency.code]);

  const convertTransactionAmountToReporting = useCallback((transaction: Transaction) => {
    return convertAmountToReporting(
      Number(transaction.amount),
      ledgerCurrencyCodeForId(transaction.ledgerId ?? DEFAULT_LEDGER_ID),
    );
  }, [convertAmountToReporting, ledgerCurrencyCodeForId]);

  const getTransactionAmountForActiveView = useCallback((transaction: Transaction) => {
    if (activeLedgerId === ALL_LEDGER_ID) {
      return convertTransactionAmountToReporting(transaction).amount;
    }
    return Number(transaction.amount);
  }, [activeLedgerId, convertTransactionAmountToReporting]);

  const formatActiveMoney = useCallback((n: number) => {
    if (activeLedgerId === ALL_LEDGER_ID) return formatReportingMoney(n);
    return formatMoneyForLedger(n, activeLedgerId);
  }, [activeLedgerId, formatMoneyForLedger, formatReportingMoney]);

  const scopedTransactions = useMemo(() => {
    if (activeLedgerId === ALL_LEDGER_ID) return transactions;
    return transactions.filter((t) => (t.ledgerId ?? DEFAULT_LEDGER_ID) === activeLedgerId);
  }, [transactions, activeLedgerId]);

  const activeLedgers = useMemo(
    () => ledgers.filter((ledger) => !ledger.archived),
    [ledgers],
  );

  const activeLedger = useMemo(() => {
    if (activeLedgerId === ALL_LEDGER_ID) return null;
    return ledgers.find((ledger) => ledger.id === activeLedgerId) ?? null;
  }, [ledgers, activeLedgerId]);

  const budgetProgress = useMemo<BudgetProgress[]>(
    () =>
      buildBudgetProgress({
        budgets,
        convertTransactionAmountToReporting,
        transactions,
      }),
    [budgets, convertTransactionAmountToReporting, transactions],
  );

  const goalProgress = useMemo<GoalProgress[]>(
    () =>
      buildGoalProgress({
        goals,
        ledgerBalance,
        ledgers,
        reportingCurrency,
      }),
    [goals, ledgerBalance, ledgers, reportingCurrency],
  );

  const billOccurrences = scheduledOccurrences;
  const billOccurrenceRecords = scheduledOccurrenceRecords;
  const billNotificationStatus = scheduledNotificationStatus;
  const markBillPaid = confirmOccurrence;
  const markBillMissed = skipOccurrence;
  const clearBillStatus = clearOccurrenceStatus;
  const refreshBillNotificationPermission = refreshScheduledNotificationPermission;
  const requestBillNotificationPermission = requestScheduledNotificationPermission;
  const syncBillNotifications = syncScheduledNotifications;

  const stats = useMemo<Stats>(
    () =>
      buildStats({
        activeLedger,
        activeLedgerId,
        convertTransactionAmountToReporting,
        currency,
        dateFilter,
        fxRates,
        reportingCurrency,
        scopedTransactions,
      }),
    [
      activeLedger,
      activeLedgerId,
      convertTransactionAmountToReporting,
      currency,
      dateFilter,
      fxRates,
      reportingCurrency,
      scopedTransactions,
    ],
  );

  const contextValue: BudgetContextValue = {
    transactions,
    scopedTransactions,
    ledgers,
    activeLedgers,
    activeLedgerId,
    activeLedger,
    transactionEditHistory,
    customCategories,
    stats,
    loading,
    currency,
    reportingCurrency,
    fxRates,
    fxStatus,
    fxError,
    dateFilter,
    setDateFilter,
    setActiveLedger,
    addLedger,
    updateLedger,
    archiveLedger,
    unarchiveLedger,
    deleteLedger,
    setDefaultLedger,
    ledgerTransactionCount,
    ledgerOpeningBalance,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addTransfer,
    updateTransfer,
    removeTransfer,
    budgets,
    budgetProgress,
    addBudget,
    updateBudget,
    removeBudget,
    goals,
    goalProgress,
    addGoal,
    updateGoal,
    removeGoal,
    pauseGoal,
    resumeGoal,
    markGoalComplete,
    ledgerBalance,
    scheduledOccurrences,
    scheduledOccurrenceRecords,
    paymentEvidence,
    evidenceForOccurrence,
    addPaymentEvidence,
    removePaymentEvidence,
    scheduledNotificationStatus,
    confirmOccurrence,
    skipOccurrence,
    postponeOccurrence,
    clearOccurrenceStatus,
    pauseSchedule,
    resumeSchedule,
    refreshScheduledNotificationPermission,
    requestScheduledNotificationPermission,
    syncScheduledNotifications,
    billOccurrences,
    billOccurrenceRecords,
    billNotificationStatus,
    markBillPaid,
    markBillMissed,
    clearBillStatus,
    refreshBillNotificationPermission,
    requestBillNotificationPermission,
    syncBillNotifications,
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
    categoryTransactionCount,
    setCurrency,
    setReportingCurrency,
    clearAllData,
    formatMoney,
    formatReportingMoney,
    formatCompactMoney,
    formatActiveMoney,
    formatMoneyForLedger,
    convertAmountToReporting,
    convertTransactionAmountToReporting,
    getTransactionAmountForActiveView,
    maskAccountNumber: maskAccountNumberValue,
  };

  return (
    <BudgetContext.Provider value={contextValue}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be within BudgetProvider');
  return ctx;
}
