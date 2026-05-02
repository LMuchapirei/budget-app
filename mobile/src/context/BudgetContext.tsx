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
import { estimateMonthlyImpact, materializeRecurringTransactions } from '../utils/recurring';

export interface DateFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface BudgetContextValue {
  transactions: Transaction[];
  scopedTransactions: Transaction[];
  ledgers: LedgerAccount[];
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
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
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

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([DEFAULT_LEDGER]);
  const [activeLedgerId, setActiveLedgerId] = useState<string>(ALL_LEDGER_ID);
  const [transactionEditHistory, setTransactionEditHistory] = useState<TransactionEditHistory[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
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

        if (txs) {
          const migratedTxs = txs.map((t) => ({
            ...t,
            ledgerId: t.ledgerId ?? DEFAULT_LEDGER_ID,
          }));
          const materializedTxs = materializeRecurringTransactions(migratedTxs);
          setTransactions(materializedTxs);
          if (
            materializedTxs.length !== txs.length ||
            migratedTxs.some((t, i) => t.ledgerId !== txs[i]?.ledgerId)
          ) {
            await storage.saveTransactions(materializedTxs);
          }
        }

        const savedActiveLedger = storage.getActiveLedger ? await storage.getActiveLedger() : null;
        if (
          savedActiveLedger &&
          (savedActiveLedger === ALL_LEDGER_ID || nextLedgers.some((l) => l.id === savedActiveLedger))
        ) {
          setActiveLedgerId(savedActiveLedger);
        }

        const edits = storage.getTransactionEditHistory
          ? await storage.getTransactionEditHistory()
          : [];
        if (edits) setTransactionEditHistory(edits);
        const cats = await storage.getCategories();
        if (cats) setCustomCategories(cats);

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

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const ledgerId =
      t.ledgerId ??
      (activeLedgerId === ALL_LEDGER_ID ? DEFAULT_LEDGER_ID : activeLedgerId);
    const next = [{ ...t, ledgerId, id: Date.now().toString() }, ...transactions];
    persistTransactions(materializeRecurringTransactions(next));
  };

  const updateTransaction = (updated: Transaction) => {
    const before = transactions.find((x) => x.id === updated.id);
    if (!before) return;

    const nextTransactions = materializeRecurringTransactions(
      transactions.map((x) => (x.id === updated.id ? updated : x)),
    );
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
  };

  const removeTransaction = (id: string) => {
    persistTransactions(transactions.filter((x) => x.id !== id));
  };

  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
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
    await storage.clearAllData();
    setTransactions([]);
    setTransactionEditHistory([]);
    setLedgers([DEFAULT_LEDGER]);
    setActiveLedgerId(ALL_LEDGER_ID);
    setCustomCategories([]);
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

  const activeLedger = useMemo(() => {
    if (activeLedgerId === ALL_LEDGER_ID) return null;
    return ledgers.find((ledger) => ledger.id === activeLedgerId) ?? null;
  }, [ledgers, activeLedgerId]);

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
        addTransaction,
        updateTransaction,
        removeTransaction,
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
