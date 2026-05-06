import type {
  ExchangeRatesCache,
  LedgerAccount,
  Transaction,
  TransactionEditHistory,
  TransferDraft,
} from '../../types';
import { convertExchangeAmount } from '../../services/exchangeRates';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER_ID,
  monthlyProjectionValue,
  recurringScheduleChanged,
} from './budgetUtils';

type CleanupMode = 'all' | 'pending';

interface UseTransactionActionsParams {
  activeLedgerId: string;
  fxRates: ExchangeRatesCache | null;
  ledgers: LedgerAccount[];
  transactionEditHistory: TransactionEditHistory[];
  transactions: Transaction[];
  cleanupScheduledRecordsForSource: (sourceTransactionId: string, mode?: CleanupMode) => void;
  persistEditHistory: (next: TransactionEditHistory[]) => void;
  persistTransactions: (next: Transaction[]) => void;
}

export function useTransactionActions({
  activeLedgerId,
  fxRates,
  ledgers,
  transactionEditHistory,
  transactions,
  cleanupScheduledRecordsForSource,
  persistEditHistory,
  persistTransactions,
}: UseTransactionActionsParams) {
  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const ledgerId =
      t.ledgerId ??
      (activeLedgerId === ALL_LEDGER_ID ? DEFAULT_LEDGER_ID : activeLedgerId);
    const next = [{ ...t, ledgerId, id: Date.now().toString() }, ...transactions];
    persistTransactions(next);
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
    const target = transactions.find((x) => x.id === id);
    if (target?.transferPairId) {
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

  return {
    addTransaction,
    updateTransaction,
    removeTransaction,
    addTransfer,
    updateTransfer,
    removeTransfer,
  };
}
