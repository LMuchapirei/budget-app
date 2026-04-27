import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Transaction,
  CustomCategory,
  Stats,
  Category,
  TransactionEditHistory,
  LedgerAccount,
} from '../types';
import { storage } from '../services/storage';

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
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  setActiveLedger: (id: string) => void;
  addLedger: (ledger: Omit<LedgerAccount, 'id'>) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
  addCustomCategory: (c: CustomCategory) => void;
  setCurrency: (c: string) => void;
  clearAllData: () => Promise<void>;
  formatMoney: (n: number) => string;
  formatMoneyForLedger: (n: number, ledgerId?: string | null) => string;
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
  currencyCode: 'USD',
  currencySymbol: '$',
  isDefault: true,
};

function normalizeLedger(ledger: LedgerAccount): LedgerAccount {
  return {
    ...ledger,
    currencyCode: ledger.currencyCode ?? 'USD',
    currencySymbol: ledger.currencySymbol ?? '$',
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
  const [currency, setCurrencyState] = useState<string>('$');
  const [loading, setLoading] = useState(true);
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
          setTransactions(migratedTxs);
          if (migratedTxs.some((t, i) => t.ledgerId !== txs[i]?.ledgerId)) {
            await storage.saveTransactions(migratedTxs);
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
        const cur = await storage.getCurrency();
        if (cur) setCurrencyState(cur);
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

  const monthlyProjectionValue = (t: Transaction) => {
    if (!t.recurring) return 0;
    return t.type === 'income' ? Number(t.amount) : -Number(t.amount);
  };

  const setActiveLedger = (id: string) => {
    setActiveLedgerId(id);
    storage.setActiveLedger(id).catch(console.error);
  };

  const addLedger = (ledger: Omit<LedgerAccount, 'id'>) => {
    const nextLedger: LedgerAccount = {
      ...ledger,
      id: `${Date.now()}-${ledger.name.toLowerCase().replace(/\s+/g, '-')}`,
    };
    persistLedgers([...ledgers, nextLedger]);
    setActiveLedger(nextLedger.id);
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const ledgerId =
      t.ledgerId ??
      (activeLedgerId === ALL_LEDGER_ID ? DEFAULT_LEDGER_ID : activeLedgerId);
    persistTransactions([{ ...t, ledgerId, id: Date.now().toString() }, ...transactions]);
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
  };

  const removeTransaction = (id: string) => {
    persistTransactions(transactions.filter((x) => x.id !== id));
  };

  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
  };

  const setCurrency = async (cur: string) => {
    setCurrencyState(cur);
    await storage.setCurrency(cur);
  };

  const clearAllData = async () => {
    await storage.clearAllData();
    setTransactions([]);
    setTransactionEditHistory([]);
    setLedgers([DEFAULT_LEDGER]);
    setActiveLedgerId(ALL_LEDGER_ID);
    setCustomCategories([]);
  };

  const formatMoney = useCallback((n: number) => {
    return `${currency}${Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [currency]);

  const formatMoneyForLedger = useCallback((n: number, ledgerId?: string | null) => {
    const ledger = ledgers.find((item) => item.id === ledgerId);
    const symbol = ledger?.currencySymbol ?? currency;
    return `${symbol}${Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [currency, ledgers]);

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
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = filtered
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: filtered.length };
  }, [scopedTransactions, dateFilter]);

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
        dateFilter,
        setDateFilter,
        setActiveLedger,
        addLedger,
        addTransaction,
        updateTransaction,
        removeTransaction,
        addCustomCategory,
        setCurrency,
        clearAllData,
        formatMoney,
        formatMoneyForLedger,
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
