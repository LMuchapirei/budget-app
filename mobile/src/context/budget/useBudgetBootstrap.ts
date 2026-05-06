import { useEffect } from 'react';
import type {
  BillNotificationStatus,
  Budget,
  CustomCategory,
  ExchangeRatesCache,
  Goal,
  LedgerAccount,
  PaymentEvidence,
  ReportingCurrency,
  ScheduledOccurrenceRecord,
  Transaction,
  TransactionEditHistory,
} from '../../types';
import { storage } from '../../services/storage';
import { getScheduledNotificationPermission } from '../../services/scheduledNotifications';
import {
  DEFAULT_REPORTING_CURRENCY,
  currencyOptionFromCode,
  currencyOptionFromSymbol,
} from '../../utils/currency';
import {
  ALL_LEDGER_ID,
  DEFAULT_LEDGER,
  DEFAULT_LEDGER_ID,
  migrateLegacyBillRecords,
  normalizeLedger,
} from './budgetUtils';

interface UseBudgetBootstrapParams {
  setActiveLedgerId: (id: string) => void;
  setBudgets: (budgets: Budget[]) => void;
  setCustomCategories: (categories: CustomCategory[]) => void;
  setFxRates: (cache: ExchangeRatesCache | null) => void;
  setGoals: (goals: Goal[]) => void;
  setLedgers: (ledgers: LedgerAccount[]) => void;
  setLoading: (loading: boolean) => void;
  setPaymentEvidence: (evidence: PaymentEvidence[]) => void;
  setReportingCurrencyState: (currency: ReportingCurrency) => void;
  setScheduledNotificationStatus: (status: BillNotificationStatus) => void;
  setScheduledOccurrenceRecords: (records: ScheduledOccurrenceRecord[]) => void;
  setTransactionEditHistory: (history: TransactionEditHistory[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
}

export function useBudgetBootstrap({
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
}: UseBudgetBootstrapParams) {
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
  }, [
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
  ]);
}
