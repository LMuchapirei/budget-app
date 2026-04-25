import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, CustomCategory, Stats, Category } from '../types';

const STORAGE_KEY = 'budget:transactions:v1';
const CAT_STORAGE_KEY = 'budget:categories:v1';
const CURRENCY_KEY = 'budget:currency:v1';

interface BudgetContextValue {
  transactions: Transaction[];
  customCategories: CustomCategory[];
  stats: Stats;
  loading: boolean;
  currency: string;
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

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setTransactions(JSON.parse(raw));
        const rawCat = await AsyncStorage.getItem(CAT_STORAGE_KEY);
        if (rawCat) setCustomCategories(JSON.parse(rawCat));
        const rawCur = await AsyncStorage.getItem(CURRENCY_KEY);
        if (rawCur) setCurrencyState(rawCur);
      } catch {
        // First run
      }
      setLoading(false);
    })();
  }, []);

  const persistTransactions = useCallback(async (next: Transaction[]) => {
    setTransactions(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistCategories = useCallback(async (next: CustomCategory[]) => {
    setCustomCategories(next);
    try {
      await AsyncStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(next));
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
    await AsyncStorage.setItem(CURRENCY_KEY, cur);
  };

  const clearAllData = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEY, CAT_STORAGE_KEY]);
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = transactions.filter((t) => new Date(t.date) >= monthStart);
    const income = thisMonth
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = thisMonth
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: thisMonth.length };
  }, [transactions]);

  return (
    <BudgetContext.Provider
      value={{
        transactions,
        customCategories,
        stats,
        loading,
        currency,
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
