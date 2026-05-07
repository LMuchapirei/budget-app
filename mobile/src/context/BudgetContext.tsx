import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Transaction,
  CustomCategory,
  Stats,
  TransactionEditHistory,
  LedgerAccount,
  ReportingCurrency,
  ExchangeRatesCache,
  FxRateStatus,
  Budget,
  BudgetProgress,
  Goal,
  GoalProgress,
  BillNotificationStatus,
  ScheduledOccurrenceRecord,
  PaymentEvidence,
} from '../types';
import { storage } from '../services/storage';
import {
  canConvertCurrency,
  fetchLatestExchangeRates,
  isExchangeRateCacheFresh,
} from '../services/exchangeRates';
import {
  DEFAULT_REPORTING_CURRENCY,
  currencyOptionFromCode,
  currencyOptionFromSymbol,
  normalizeCurrencyCode,
} from '../utils/currency';
import { cancelAllOccurrenceReminders } from '../services/scheduledNotifications';
import { clearEvidenceFiles } from '../services/paymentEvidenceFiles';
import type { BackupV1 } from '../services/backup';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER,
  maskAccountNumberValue,
  persistState,
} from './budget/budgetUtils';
import {
  buildBudgetProgress,
  buildGoalProgress,
  buildStats,
} from './budget/budgetDerivedState';
import { useScheduledOccurrences } from './budget/useScheduledOccurrences';
import type { BudgetContextValue, DateFilter } from './budget/budgetContextTypes';
import { useCategoryActions } from './budget/useCategoryActions';
import { useBudgetBootstrap } from './budget/useBudgetBootstrap';
import { useLedgerActions } from './budget/useLedgerActions';
import { useMoneyTools } from './budget/useMoneyTools';
import { usePlanningActions } from './budget/usePlanningActions';
import { useTransactionActions } from './budget/useTransactionActions';

export { ALL_LEDGER_ID };
export type { DateFilter } from './budget/budgetContextTypes';

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

  useBudgetBootstrap({
    setActiveLedgerId,
    setBudgets,
    setCustomCategories,
    setFxRates,
    setGoals,
    setLedgers,
    setLoading,
    setPaymentEvidence,
    setReportingCurrencyState,
    setScheduledNotificationStatus,
    setScheduledOccurrenceRecords,
    setTransactionEditHistory,
    setTransactions,
  });

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

  const {
    addLedger,
    updateLedger,
    archiveLedger,
    unarchiveLedger,
    deleteLedger,
    setDefaultLedger,
    ledgerTransactionCount,
    ledgerOpeningBalance,
    ledgerBalance,
  } = useLedgerActions({
    activeLedgerId,
    goals,
    ledgers,
    transactions,
    persistGoals,
    persistLedgers,
    persistTransactions,
    setActiveLedger,
  });

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

  const {
    addTransaction,
    updateTransaction,
    removeTransaction,
    addTransfer,
    updateTransfer,
    removeTransfer,
  } = useTransactionActions({
    activeLedgerId,
    fxRates,
    ledgers,
    transactionEditHistory,
    transactions,
    cleanupScheduledRecordsForSource: scheduled.cleanupScheduledRecordsForSource,
    persistEditHistory,
    persistTransactions,
  });

  const {
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
    categoryTransactionCount,
  } = useCategoryActions({
    budgets,
    customCategories,
    transactions,
    persistBudgets,
    persistCategories,
    persistTransactions,
  });

  const {
    addBudget,
    updateBudget,
    removeBudget,
    addGoal,
    updateGoal,
    removeGoal,
    pauseGoal,
    resumeGoal,
    markGoalComplete,
  } = usePlanningActions({
    budgets,
    goals,
    persistBudgets,
    persistGoals,
  });

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

  const restoreBackup = async (payload: BackupV1) => {
    const { data } = payload;
    await cancelAllOccurrenceReminders();
    await clearEvidenceFiles();
    await storage.replaceUserDataWithBackup(data);
    const restoredLedgers = data.ledgers.length > 0 ? data.ledgers : [DEFAULT_LEDGER];
    setTransactions(data.transactions);
    setTransactionEditHistory(data.transactionEditHistory);
    setLedgers(restoredLedgers);
    setActiveLedgerId(ALL_LEDGER_ID);
    setCustomCategories(data.customCategories);
    setBudgets(data.budgets);
    setGoals(data.goals);
    setScheduledOccurrenceRecords(data.scheduledOccurrenceRecords);
    setPaymentEvidence(data.paymentEvidence);
  };

  const {
    scopedTransactions,
    formatMoney,
    formatReportingMoney,
    formatCompactMoney,
    formatActiveMoney,
    formatMoneyForLedger,
    convertAmountToReporting,
    convertTransactionAmountToReporting,
    getTransactionAmountForActiveView,
  } = useMoneyTools({
    activeLedgerId,
    currency,
    fxRates,
    ledgers,
    reportingCurrency,
    transactions,
  });

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
    restoreBackup,
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
