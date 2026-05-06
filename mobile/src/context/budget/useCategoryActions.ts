import { useCallback } from 'react';
import type { Budget, CustomCategory, Transaction } from '../../types';

interface UseCategoryActionsParams {
  budgets: Budget[];
  customCategories: CustomCategory[];
  transactions: Transaction[];
  persistBudgets: (next: Budget[]) => void;
  persistCategories: (next: CustomCategory[]) => void;
  persistTransactions: (next: Transaction[]) => void;
}

export function useCategoryActions({
  budgets,
  customCategories,
  transactions,
  persistBudgets,
  persistCategories,
  persistTransactions,
}: UseCategoryActionsParams) {
  const addCustomCategory = (c: CustomCategory) => {
    persistCategories([...customCategories, c]);
  };

  const updateCustomCategory = (updated: CustomCategory) => {
    const before = customCategories.find((x) => x.id === updated.id);
    if (!before) return;
    persistCategories(
      customCategories.map((x) => (x.id === updated.id ? updated : x)),
    );
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

  return {
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
    categoryTransactionCount,
  };
}
