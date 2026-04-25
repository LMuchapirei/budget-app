import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Transaction, CustomCategory, Stats, Category } from '../types';
import { storage } from '../services/storage';

export interface DateFilter {
  year: number;
  month: number; // 0-indexed
}

interface BudgetContextValue {
  transactions: Transaction[];
  customCategories: CustomCategory[];
  stats: Stats;
  loading: boolean;
  currency: string;
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addCustomCategory: (c: CustomCategory) => void;
  setCurrency: (c: string) => void;
  clearAllData: () => Promise<void>;
  formatMoney: (n: number) => string;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [currency, setCurrencyState] = useState<string>('$');
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  useEffect(() => {
    (async () => {
      try {
        const txs = await storage.getTransactions();
        if (txs) setTransactions(txs);
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

  const persistCategories = useCallback(async (next: CustomCategory[]) => {
    setCustomCategories(next);
    try {
      await storage.saveCategories(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    persistTransactions([{ ...t, id: Date.now().toString() }, ...transactions]);
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
    setCustomCategories([]);
  };

  const formatMoney = useCallback((n: number) => {
    return `${currency}${Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [currency]);

  const stats = useMemo<Stats>(() => {
    const monthStart = new Date(dateFilter.year, dateFilter.month, 1);
    const monthEnd = new Date(dateFilter.year, dateFilter.month + 1, 1);
    const filtered = transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= monthStart && d < monthEnd;
    });
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = filtered
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: filtered.length };
  }, [transactions, dateFilter]);

  return (
    <BudgetContext.Provider
      value={{
        transactions,
        customCategories,
        stats,
        loading,
        currency,
        dateFilter,
        setDateFilter,
        addTransaction,
        removeTransaction,
        addCustomCategory,
        setCurrency,
        clearAllData,
        formatMoney,
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
