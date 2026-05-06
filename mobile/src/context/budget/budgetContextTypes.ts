import type {
  BillNotificationStatus,
  BillNotificationSyncResult,
  Budget,
  BudgetProgress,
  ConfirmOccurrenceOverride,
  CustomCategory,
  ExchangeRatesCache,
  FxRateStatus,
  Goal,
  GoalProgress,
  LedgerAccount,
  PaymentEvidence,
  PaymentEvidenceDraft,
  ReportingCurrency,
  ScheduledOccurrence,
  ScheduledOccurrenceRecord,
  Stats,
  Transaction,
  TransactionEditHistory,
  TransferDraft,
} from '../../types';
import type { ConversionResult } from '../../services/exchangeRates';

export interface DateFilter {
  startDate: string;
  endDate: string;
}

export interface BudgetContextValue {
  transactions: Transaction[];
  scopedTransactions: Transaction[];
  ledgers: LedgerAccount[];
  activeLedgers: LedgerAccount[];
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
  updateLedger: (ledger: LedgerAccount) => void;
  archiveLedger: (id: string) => void;
  unarchiveLedger: (id: string) => void;
  deleteLedger: (id: string, reassignToId?: string) => void;
  setDefaultLedger: (id: string) => void;
  ledgerTransactionCount: (id: string) => number;
  ledgerOpeningBalance: (id: string) => number;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
  addTransfer: (draft: TransferDraft) => void;
  updateTransfer: (pairId: string, draft: TransferDraft) => void;
  removeTransfer: (pairId: string) => void;
  budgets: Budget[];
  budgetProgress: BudgetProgress[];
  addBudget: (b: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (b: Budget) => void;
  removeBudget: (id: string) => void;
  goals: Goal[];
  goalProgress: GoalProgress[];
  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'status' | 'completedAt'>) => void;
  updateGoal: (g: Goal) => void;
  removeGoal: (id: string) => void;
  pauseGoal: (id: string) => void;
  resumeGoal: (id: string) => void;
  markGoalComplete: (id: string) => void;
  ledgerBalance: (id: string) => number;
  scheduledOccurrences: ScheduledOccurrence[];
  scheduledOccurrenceRecords: ScheduledOccurrenceRecord[];
  paymentEvidence: PaymentEvidence[];
  evidenceForOccurrence: (occurrenceId: string) => PaymentEvidence[];
  addPaymentEvidence: (occurrenceId: string, evidence: PaymentEvidenceDraft) => void;
  removePaymentEvidence: (id: string) => void;
  scheduledNotificationStatus: BillNotificationStatus;
  confirmOccurrence: (id: string, override?: ConfirmOccurrenceOverride) => void;
  skipOccurrence: (id: string) => void;
  postponeOccurrence: (id: string, newDate: string) => void;
  clearOccurrenceStatus: (id: string) => void;
  pauseSchedule: (transactionId: string) => void;
  resumeSchedule: (transactionId: string) => void;
  refreshScheduledNotificationPermission: () => Promise<BillNotificationStatus>;
  requestScheduledNotificationPermission: () => Promise<BillNotificationStatus>;
  syncScheduledNotifications: () => Promise<BillNotificationSyncResult>;
  billOccurrences: ScheduledOccurrence[];
  billOccurrenceRecords: ScheduledOccurrenceRecord[];
  billNotificationStatus: BillNotificationStatus;
  markBillPaid: (id: string) => void;
  markBillMissed: (id: string) => void;
  clearBillStatus: (id: string) => void;
  refreshBillNotificationPermission: () => Promise<BillNotificationStatus>;
  requestBillNotificationPermission: () => Promise<BillNotificationStatus>;
  syncBillNotifications: () => Promise<BillNotificationSyncResult>;
  addCustomCategory: (c: CustomCategory) => void;
  updateCustomCategory: (c: CustomCategory) => void;
  removeCustomCategory: (id: string, reassignTo?: string) => void;
  categoryTransactionCount: (name: string) => number;
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
