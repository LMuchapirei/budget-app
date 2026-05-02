export type Category = string;

export type TxType = 'income' | 'expense';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportingCurrency {
  code: string;
  symbol: string;
}

export interface ExchangeRatesCache {
  provider: string;
  baseCurrency: string;
  rates: Record<string, number>;
  asOf: string;
  nextUpdateAt?: string;
  fetchedAt: string;
}

export type FxRateStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export interface RecurringSchedule {
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
  reminderDaysBefore?: number;
}

export type BudgetPeriod = 'monthly';

export type BudgetStatus = 'safe' | 'warning' | 'over';

export interface Budget {
  id: string;
  category: Category;
  amount: number;
  period: BudgetPeriod;
  ledgerId?: string;
  carryOver?: boolean;
  createdAt: string;
  notes?: string;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  cap: number;
  baseCap: number;
  carryOverAmount: number;
  percent: number;
  status: BudgetStatus;
  isConverted: boolean;
  missingCurrencyCodes: string[];
}

export type GoalStatus = 'active' | 'paused' | 'completed';

export type GoalPacing =
  | 'on-track'
  | 'behind'
  | 'ahead'
  | 'no-deadline'
  | 'paused'
  | 'complete';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currencyCode: string;
  currencySymbol: string;
  deadline?: string;
  ledgerId?: string;
  notes?: string;
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
}

export interface GoalProgress {
  goal: Goal;
  saved: number;
  remaining: number;
  percent: number;
  pacing: GoalPacing;
  suggestedMonthly: number;
  daysRemaining?: number;
  currencyCode: string;
  currencySymbol: string;
  linkedLedgerName?: string;
  linkedLedgerArchived?: boolean;
  currencyMismatch?: boolean;
}

export type BillOccurrenceStatus = 'paid' | 'missed';

export type BillDisplayStatus = 'upcoming' | 'due-today' | BillOccurrenceStatus;

export interface BillOccurrenceRecord {
  id: string;
  recurringTransactionId: string;
  dueDate: string;
  status?: BillOccurrenceStatus;
  markedAt?: string;
  notificationId?: string;
  notificationScheduledAt?: string;
}

export interface BillOccurrence {
  id: string;
  source: Transaction;
  dueDate: string;
  amount: number;
  status: BillDisplayStatus;
  manualStatus?: BillOccurrenceStatus;
  daysUntilDue: number;
  reminderDaysBefore: number;
  ledgerName?: string;
  ledgerArchived?: boolean;
  currencyCode: string;
  currencySymbol: string;
  notificationId?: string;
}

export type BillNotificationStatus = 'unknown' | 'granted' | 'denied' | 'error';

export interface BillNotificationSyncResult {
  scheduled: number;
  skipped: number;
}

export interface CustomCategory {
  id: string;
  title: string;
  description: string;
  type: TxType;
  color: string;
}

export type LedgerType =
  | 'cash'
  | 'bank'
  | 'credit-card'
  | 'savings'
  | 'mobile-money'
  | 'loan'
  | 'other';

export interface LedgerAccount {
  id: string;
  name: string;
  description: string;
  color: string;
  currencyCode: string;
  currencySymbol: string;
  accountNumber?: string;
  accountType?: LedgerType;
  openingBalance?: number;
  archived?: boolean;
  isDefault?: boolean;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  category: Category;
  date: string;
  recurring: boolean;
  recurringSchedule?: RecurringSchedule;
  generatedFromRecurringId?: string;
  generatedOccurrenceDate?: string;
  ledgerId?: string;
}

export interface TransactionEditHistory {
  id: string;
  transactionId: string;
  editedAt: string;
  before: Transaction;
  after: Transaction;
  projectionMonthlyDelta: number;
  projectionAnnualDelta: number;
}

export type ViewTab = 'dashboard' | 'bills' | 'projections' | 'reports' | 'settings';

export interface Stats {
  income: number;
  expenses: number;
  balance: number;
  count: number;
  isConverted?: boolean;
  currencyCode?: string;
  currencySymbol?: string;
  missingCurrencyCodes?: string[];
  rateAsOf?: string;
}
