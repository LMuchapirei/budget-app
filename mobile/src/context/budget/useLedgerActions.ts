import { useCallback } from 'react';
import type { Goal, LedgerAccount, Transaction } from '../../types';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER_ID,
  normalizeLedger,
} from './budgetUtils';

interface UseLedgerActionsParams {
  activeLedgerId: string;
  goals: Goal[];
  ledgers: LedgerAccount[];
  transactions: Transaction[];
  persistGoals: (next: Goal[]) => void;
  persistLedgers: (next: LedgerAccount[]) => void;
  persistTransactions: (next: Transaction[]) => void;
  setActiveLedger: (id: string) => void;
}

export function useLedgerActions({
  activeLedgerId,
  goals,
  ledgers,
  transactions,
  persistGoals,
  persistLedgers,
  persistTransactions,
  setActiveLedger,
}: UseLedgerActionsParams) {
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

  return {
    addLedger,
    updateLedger,
    archiveLedger,
    unarchiveLedger,
    deleteLedger,
    setDefaultLedger,
    ledgerTransactionCount,
    ledgerOpeningBalance,
    ledgerBalance,
  };
}
