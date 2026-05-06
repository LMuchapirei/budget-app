import { useCallback, useMemo } from 'react';
import type {
  ExchangeRatesCache,
  LedgerAccount,
  ReportingCurrency,
  Transaction,
} from '../../types';
import { convertExchangeAmount } from '../../services/exchangeRates';
import {
  DEFAULT_REPORTING_CURRENCY,
  formatCompactCurrencyAmount,
  formatCurrencyAmount,
  normalizeCurrencyCode,
} from '../../utils/currency';
import { ALL_LEDGER_ID, DEFAULT_LEDGER_ID } from './budgetUtils';

interface UseMoneyToolsParams {
  activeLedgerId: string;
  currency: string;
  fxRates: ExchangeRatesCache | null;
  ledgers: LedgerAccount[];
  reportingCurrency: ReportingCurrency;
  transactions: Transaction[];
}

export function useMoneyTools({
  activeLedgerId,
  currency,
  fxRates,
  ledgers,
  reportingCurrency,
  transactions,
}: UseMoneyToolsParams) {
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

  return {
    scopedTransactions,
    formatMoney,
    formatReportingMoney,
    formatCompactMoney,
    formatActiveMoney,
    formatMoneyForLedger,
    convertAmountToReporting,
    convertTransactionAmountToReporting,
    getTransactionAmountForActiveView,
  };
}
