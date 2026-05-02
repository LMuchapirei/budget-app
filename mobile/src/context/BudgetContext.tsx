import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  BudgetStatus,
  Goal,
  GoalProgress,
  GoalPacing,
  ConfirmOccurrenceOverride,
  ScheduledOccurrence,
  ScheduledOccurrenceDisplayStatus,
  BillOccurrenceRecord,
  BillNotificationStatus,
  BillNotificationSyncResult,
  ScheduledOccurrenceRecord,
  ScheduledOccurrenceStatus,
  PaymentEvidence,
  PaymentEvidenceDraft,
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
  deriveScheduledOccurrences,
  estimateMonthlyImpact,
  formatISODate,
  normalizeRecurringSchedule,
} from '../utils/recurring';
import {
  cancelAllOccurrenceReminders,
  cancelOccurrenceReminder,
  getScheduledNotificationPermission,
  requestScheduledNotificationPermission as requestDeviceScheduledNotificationPermission,
  scheduleOccurrenceReminder,
} from '../services/scheduledNotifications';
import { clearEvidenceFiles, deleteEvidenceFile } from '../services/paymentEvidenceFiles';
import { paymentEvidenceId } from '../utils/paymentEvidence';

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
const DEFAULT_LEDGER_ID = 'default-ledger';
export const ALL_LEDGER_ID = 'all-ledgers';

const DEFAULT_LEDGER: LedgerAccount = {
  id: DEFAULT_LEDGER_ID,
  name: 'Cash Ledger',
  description: 'Default account for existing entries',
  color: '#8B5A3C',
  currencyCode: DEFAULT_REPORTING_CURRENCY.code,
  currencySymbol: DEFAULT_REPORTING_CURRENCY.symbol,
  isDefault: true,
};

function normalizeLedger(ledger: LedgerAccount): LedgerAccount {
  const currencyCode = normalizeCurrencyCode(ledger.currencyCode);
  return {
    ...ledger,
    currencyCode,
    currencySymbol: ledger.currencySymbol ?? currencyOptionFromCode(currencyCode).symbol,
  };
}

function maskAccountNumberValue(accountNumber?: string) {
  const clean = accountNumber?.replace(/\s+/g, '') ?? '';
  if (!clean) return '';
  const visible = clean.slice(-4);
  return `${'*'.repeat(Math.max(4, clean.length - visible.length))} ${visible}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function parseTransactionDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function parseBudgetDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseLocalDate(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function daysBetween(start: Date, end: Date) {
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setHours(0, 0, 0, 0);
  endDay.setHours(0, 0, 0, 0);
  return Math.ceil((endDay.getTime() - startDay.getTime()) / 86400000);
}

function scheduledOccurrenceId(sourceTransactionId: string, dueDate: string) {
  return `${sourceTransactionId}:${dueDate}`;
}

function parseScheduledOccurrenceId(id: string) {
  const splitAt = id.lastIndexOf(':');
  if (splitAt === -1) return { sourceTransactionId: id, dueDate: '' };
  return {
    sourceTransactionId: id.slice(0, splitAt),
    dueDate: id.slice(splitAt + 1),
  };
}

function migrateLegacyBillRecords(
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

  const persistTransactions = useCallback(async (next: Transaction[]) => {
    setTransactions(next);
    try {
      await storage.saveTransactions(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistLedgers = useCallback(async (next: LedgerAccount[]) => {
    setLedgers(next);
    try {
      await storage.saveLedgers(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistCategories = useCallback(async (next: CustomCategory[]) => {
    setCustomCategories(next);
    try {
      await storage.saveCategories(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistEditHistory = useCallback(async (next: TransactionEditHistory[]) => {
    setTransactionEditHistory(next);
    try {
      await storage.saveTransactionEditHistory(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistBudgets = useCallback(async (next: Budget[]) => {
    setBudgets(next);
    try {
      await storage.saveBudgets(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistGoals = useCallback(async (next: Goal[]) => {
    setGoals(next);
    try {
      await storage.saveGoals(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistScheduledOccurrenceRecords = useCallback(async (next: ScheduledOccurrenceRecord[]) => {
    setScheduledOccurrenceRecords(next);
    try {
      await storage.saveScheduledOccurrenceRecords(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistPaymentEvidence = useCallback(async (next: PaymentEvidence[]) => {
    setPaymentEvidence(next);
    try {
      await storage.savePaymentEvidence(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

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

  const monthlyProjectionValue = (t: Transaction) => {
    return estimateMonthlyImpact(t);
  };

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

  const cleanupScheduledRecordsForSource = useCallback(
    (sourceTransactionId: string, mode: 'all' | 'pending' = 'all') => {
      const matching = scheduledOccurrenceRecords.filter(
        (record) => record.sourceTransactionId === sourceTransactionId,
      );
      if (matching.length === 0) return;
      matching.forEach((record) => {
        if (record.notificationId) {
          cancelOccurrenceReminder(record.notificationId).catch(console.error);
        }
      });
      if (mode === 'all') {
        const occurrenceIds = new Set(matching.map((record) => record.id));
        paymentEvidence
          .filter((evidence) => occurrenceIds.has(evidence.occurrenceId))
          .forEach((evidence) => deleteEvidenceFile(evidence.attachmentUri).catch(console.error));
        persistPaymentEvidence(
          paymentEvidence.filter((evidence) => !occurrenceIds.has(evidence.occurrenceId)),
        );
      }
      persistScheduledOccurrenceRecords(
        scheduledOccurrenceRecords.filter(
          (record) =>
            record.sourceTransactionId !== sourceTransactionId ||
            (mode === 'pending' && record.status !== 'pending'),
        ),
      );
    },
    [
      paymentEvidence,
      persistPaymentEvidence,
      persistScheduledOccurrenceRecords,
      scheduledOccurrenceRecords,
    ],
  );

  const recurringScheduleChanged = (before: Transaction, after: Transaction) => {
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
  };

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
      cleanupScheduledRecordsForSource(updated.id, 'pending');
    }
  };

  const removeTransaction = (id: string) => {
    cleanupScheduledRecordsForSource(id, 'all');
    persistTransactions(transactions.filter((x) => x.id !== id));
  };

  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
  };

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

  const budgetProgress = useMemo<BudgetProgress[]>(() => {
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
      return transactions.reduce((sum, t) => {
        if (t.type !== 'expense') return sum;
        if (t.category !== budget.category) return sum;
        if (budget.ledgerId && (t.ledgerId ?? DEFAULT_LEDGER_ID) !== budget.ledgerId) return sum;
        const d = parseTransactionDate(t.date);
        if (d < rangeStart || d >= rangeEndExclusive) return sum;
        const conversion = convertTransactionAmountToReporting(t);
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
  }, [budgets, convertTransactionAmountToReporting, transactions]);

  const goalProgress = useMemo<GoalProgress[]>(() => {
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
      } else {
        if (daysRemaining !== undefined && daysRemaining <= 0) {
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
  }, [goals, ledgerBalance, ledgers, reportingCurrency]);

  const derivedSchedule = useMemo(
    () => deriveScheduledOccurrences(transactions, scheduledOccurrenceRecords),
    [scheduledOccurrenceRecords, transactions],
  );

  const scheduledOccurrences = useMemo<ScheduledOccurrence[]>(() => {
    return derivedSchedule.occurrences.map((occurrence) => {
      const ledger = ledgers.find((item) => item.id === (occurrence.source.ledgerId ?? DEFAULT_LEDGER_ID));
      return {
        ...occurrence,
        ledgerName: ledger?.name,
        ledgerArchived: Boolean(ledger?.archived),
        currencyCode: normalizeCurrencyCode(ledger?.currencyCode ?? reportingCurrency.code),
        currencySymbol: ledger?.currencySymbol ?? reportingCurrency.symbol,
      };
    });
  }, [derivedSchedule.occurrences, ledgers, reportingCurrency]);

  useEffect(() => {
    if (loading) return;
    if (
      derivedSchedule.autoConfirmTransactions.length > 0 &&
      derivedSchedule.autoConfirmTransactions.some(
        (next) => !transactions.some((transaction) => transaction.id === next.id),
      )
    ) {
      const existingIds = new Set(transactions.map((transaction) => transaction.id));
      const additions = derivedSchedule.autoConfirmTransactions.filter(
        (transaction) => !existingIds.has(transaction.id),
      );
      if (additions.length > 0) {
        persistTransactions([...additions, ...transactions]);
      }
    }

    if (derivedSchedule.recordsToPersist.length !== scheduledOccurrenceRecords.length) {
      persistScheduledOccurrenceRecords(derivedSchedule.recordsToPersist);
    }
  }, [
    derivedSchedule.autoConfirmTransactions,
    derivedSchedule.recordsToPersist,
    loading,
    persistScheduledOccurrenceRecords,
    persistTransactions,
    scheduledOccurrenceRecords.length,
    transactions,
  ]);

  const upsertScheduledRecord = useCallback(
    (record: ScheduledOccurrenceRecord) => {
      const rest = scheduledOccurrenceRecords.filter((item) => item.id !== record.id);
      persistScheduledOccurrenceRecords([record, ...rest]);
    },
    [persistScheduledOccurrenceRecords, scheduledOccurrenceRecords],
  );

  const evidenceForOccurrence = useCallback(
    (occurrenceId: string) =>
      paymentEvidence
        .filter((evidence) => evidence.occurrenceId === occurrenceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [paymentEvidence],
  );

  const addPaymentEvidence = useCallback(
    (occurrenceId: string, evidence: PaymentEvidenceDraft) => {
      const next: PaymentEvidence = {
        ...evidence,
        id: paymentEvidenceId(),
        occurrenceId,
        createdAt: new Date().toISOString(),
        confidence: evidence.confidence ?? 'manual',
      };
      persistPaymentEvidence([next, ...paymentEvidence]);
    },
    [paymentEvidence, persistPaymentEvidence],
  );

  const removePaymentEvidence = useCallback(
    (id: string) => {
      const existing = paymentEvidence.find((evidence) => evidence.id === id);
      if (existing?.attachmentUri) {
        deleteEvidenceFile(existing.attachmentUri).catch(console.error);
      }
      persistPaymentEvidence(paymentEvidence.filter((evidence) => evidence.id !== id));
    },
    [paymentEvidence, persistPaymentEvidence],
  );

  const confirmOccurrence = useCallback(
    (id: string, override?: ConfirmOccurrenceOverride) => {
      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const source =
        occurrence?.source ?? transactions.find((transaction) => transaction.id === parsed.sourceTransactionId);
      if (!source) return;

      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.status === 'confirmed') return;
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }

      const effectiveDueDate =
        override?.date ?? occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate;
      const originalDueDate = occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate;
      const nowStamp = Date.now();
      const markedAt = new Date().toISOString();
      const confirmedTransaction: Transaction = {
        ...source,
        id: `${source.id}-${effectiveDueDate}-${nowStamp}`,
        amount: override?.amount ?? source.amount,
        category: override?.category ?? source.category,
        ledgerId: override?.ledgerId ?? source.ledgerId,
        date: effectiveDueDate,
        recurring: false,
        recurringSchedule: undefined,
        generatedFromRecurringId: source.id,
        generatedOccurrenceDate: effectiveDueDate,
      };

      persistTransactions([confirmedTransaction, ...transactions]);
      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId: source.id,
        originalDueDate,
        effectiveDueDate,
        status: 'confirmed',
        confirmedTransactionId: confirmedTransaction.id,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt,
      });

      if (override?.evidence?.length) {
        const additions = override.evidence.map<PaymentEvidence>((draft) => ({
          ...draft,
          id: paymentEvidenceId(),
          occurrenceId: id,
          confirmedTransactionId: confirmedTransaction.id,
          createdAt: markedAt,
          confidence: draft.confidence ?? 'manual',
        }));
        persistPaymentEvidence([...additions, ...paymentEvidence]);
      }
    },
    [
      paymentEvidence,
      persistPaymentEvidence,
      persistTransactions,
      scheduledOccurrenceRecords,
      scheduledOccurrences,
      transactions,
      upsertScheduledRecord,
    ],
  );

  const setOccurrenceStatus = useCallback(
    (id: string, status: ScheduledOccurrenceStatus) => {
      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }
      const sourceTransactionId =
        occurrence?.source.id ?? existing?.sourceTransactionId ?? parsed.sourceTransactionId;
      const originalDueDate = occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate;
      const effectiveDueDate = occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate;
      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId,
        originalDueDate,
        effectiveDueDate,
        status,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt: new Date().toISOString(),
      });
    },
    [scheduledOccurrenceRecords, scheduledOccurrences, upsertScheduledRecord],
  );

  const skipOccurrence = useCallback(
    (id: string) => setOccurrenceStatus(id, 'skipped'),
    [setOccurrenceStatus],
  );

  const postponeOccurrence = useCallback(
    (id: string, newDate: string) => {
      const todayIso = formatISODate(new Date());
      if (newDate < todayIso) return;

      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const source =
        occurrence?.source ?? transactions.find((transaction) => transaction.id === parsed.sourceTransactionId);
      const schedule = source ? normalizeRecurringSchedule(source) : undefined;
      if (!source || (schedule?.endDate && newDate > schedule.endDate)) return;

      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }

      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId: source.id,
        originalDueDate: occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate,
        effectiveDueDate: newDate,
        status: 'postponed',
        postponedFrom: occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt: new Date().toISOString(),
      });
    },
    [scheduledOccurrenceRecords, scheduledOccurrences, transactions, upsertScheduledRecord],
  );

  const clearOccurrenceStatus = useCallback(
    (id: string) => {
      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }
      persistScheduledOccurrenceRecords(scheduledOccurrenceRecords.filter((record) => record.id !== id));
    },
    [persistScheduledOccurrenceRecords, scheduledOccurrenceRecords],
  );

  const pauseSchedule = useCallback(
    (transactionId: string) => {
      const nowIso = new Date().toISOString();
      const source = transactions.find((transaction) => transaction.id === transactionId);
      if (!source?.recurringSchedule) return;
      scheduledOccurrenceRecords
        .filter((record) => record.sourceTransactionId === transactionId && record.notificationId)
        .forEach((record) => cancelOccurrenceReminder(record.notificationId).catch(console.error));

      persistTransactions(
        transactions.map((transaction) =>
          transaction.id === transactionId
            ? {
                ...transaction,
                recurringSchedule: {
                  ...transaction.recurringSchedule!,
                  paused: true,
                  pausedAt: nowIso,
                },
              }
            : transaction,
        ),
      );
    },
    [persistTransactions, scheduledOccurrenceRecords, transactions],
  );

  const resumeSchedule = useCallback(
    (transactionId: string) => {
      const todayIso = formatISODate(new Date());
      persistTransactions(
        transactions.map((transaction) =>
          transaction.id === transactionId && transaction.recurringSchedule
            ? {
                ...transaction,
                recurringSchedule: {
                  ...transaction.recurringSchedule,
                  paused: false,
                  pausedAt: undefined,
                  startDate: todayIso,
                },
              }
            : transaction,
        ),
      );
    },
    [persistTransactions, transactions],
  );

  const refreshScheduledNotificationPermission = useCallback(async () => {
    const nextStatus = await getScheduledNotificationPermission();
    setScheduledNotificationStatus(nextStatus);
    return nextStatus;
  }, []);

  const syncScheduledNotifications = useCallback(async (): Promise<BillNotificationSyncResult> => {
    const permission = await getScheduledNotificationPermission();
    setScheduledNotificationStatus(permission);
    if (permission !== 'granted') return { scheduled: 0, skipped: scheduledOccurrences.length };

    const recordMap = new Map(scheduledOccurrenceRecords.map((record) => [record.id, record]));
    const nextRecordMap = new Map(recordMap);
    let scheduled = 0;
    let skipped = 0;

    for (const occurrence of scheduledOccurrences) {
      const schedule = normalizeRecurringSchedule(occurrence.source);
      const closed =
        occurrence.recordStatus === 'confirmed' ||
        occurrence.recordStatus === 'skipped' ||
        occurrence.status === 'confirmed' ||
        occurrence.status === 'skipped';
      if (closed || schedule?.paused || occurrence.reminderDaysBefore <= 0) {
        skipped += 1;
        continue;
      }

      const existing = recordMap.get(occurrence.id);
      if (existing?.notificationId) {
        await cancelOccurrenceReminder(existing.notificationId);
      }

      const notificationId = await scheduleOccurrenceReminder({
        id: occurrence.id,
        title: occurrence.source.description,
        dueDate: occurrence.effectiveDueDate,
        reminderDaysBefore: occurrence.reminderDaysBefore,
        type: occurrence.type,
      });

      if (!notificationId) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      nextRecordMap.set(occurrence.id, {
        ...existing,
        id: occurrence.id,
        sourceTransactionId: occurrence.source.id,
        originalDueDate: occurrence.originalDueDate,
        effectiveDueDate: occurrence.effectiveDueDate,
        status: occurrence.recordStatus ?? 'pending',
        notificationId,
        notificationScheduledAt: new Date().toISOString(),
      });
    }

    persistScheduledOccurrenceRecords(Array.from(nextRecordMap.values()));
    return { scheduled, skipped };
  }, [persistScheduledOccurrenceRecords, scheduledOccurrenceRecords, scheduledOccurrences]);

  const requestScheduledNotificationPermission = useCallback(async () => {
    const nextStatus = await requestDeviceScheduledNotificationPermission();
    setScheduledNotificationStatus(nextStatus);
    if (nextStatus === 'granted') {
      await syncScheduledNotifications();
    }
    return nextStatus;
  }, [syncScheduledNotifications]);

  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (autoSyncedRef.current) return;
    if (scheduledNotificationStatus !== 'granted') return;
    if (scheduledOccurrences.length === 0) return;
    autoSyncedRef.current = true;
    syncScheduledNotifications().catch(console.error);
  }, [loading, scheduledNotificationStatus, scheduledOccurrences, syncScheduledNotifications]);

  const billOccurrences = scheduledOccurrences;
  const billOccurrenceRecords = scheduledOccurrenceRecords;
  const billNotificationStatus = scheduledNotificationStatus;
  const markBillPaid = confirmOccurrence;
  const markBillMissed = skipOccurrence;
  const clearBillStatus = clearOccurrenceStatus;
  const refreshBillNotificationPermission = refreshScheduledNotificationPermission;
  const requestBillNotificationPermission = requestScheduledNotificationPermission;
  const syncBillNotifications = syncScheduledNotifications;

  const stats = useMemo<Stats>(() => {
    const start = new Date(dateFilter.startDate);
    const end = new Date(dateFilter.endDate);
    end.setHours(23, 59, 59, 999);
    const filtered = scopedTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
    const missing = new Set<string>();
    const totals = filtered.reduce(
      (next, transaction) => {
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
  }, [
    activeLedger,
    activeLedgerId,
    convertTransactionAmountToReporting,
    currency,
    dateFilter,
    fxRates,
    reportingCurrency,
    scopedTransactions,
  ]);

  return (
    <BudgetContext.Provider
      value={{
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
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be within BudgetProvider');
  return ctx;
}
