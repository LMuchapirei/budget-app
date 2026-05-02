export type Category = string;

export type TxType = 'income' | 'expense';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringPostMode = 'confirm' | 'auto';

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
  postMode?: RecurringPostMode;
  paused?: boolean;
  pausedAt?: string;
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

export type ScheduledOccurrenceStatus =
  | 'pending'
  | 'confirmed'
  | 'skipped'
  | 'postponed';

export type ScheduledOccurrenceDisplayStatus =
  | 'pending'
  | 'due-now'
  | 'due-today'
  | 'upcoming'
  | 'confirmed'
  | 'skipped'
  | 'postponed';

export interface ScheduledOccurrenceRecord {
  id: string;
  sourceTransactionId: string;
  originalDueDate: string;
  effectiveDueDate: string;
  status: ScheduledOccurrenceStatus;
  confirmedTransactionId?: string;
  postponedFrom?: string;
  notificationId?: string;
  notificationScheduledAt?: string;
  markedAt?: string;
}

export interface ScheduledOccurrence {
  id: string;
  source: Transaction;
  originalDueDate: string;
  effectiveDueDate: string;
  dueDate: string;
  amount: number;
  type: TxType;
  status: ScheduledOccurrenceDisplayStatus;
  recordStatus?: ScheduledOccurrenceStatus;
  daysUntilDue: number;
  reminderDaysBefore: number;
  ledgerName?: string;
  ledgerArchived?: boolean;
  currencyCode: string;
  currencySymbol: string;
  notificationId?: string;
  confirmedTransactionId?: string;
}

export interface ConfirmOccurrenceOverride {
  amount?: number;
  date?: string;
  ledgerId?: string;
  category?: Category;
  notes?: string;
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

export type BillOccurrence = ScheduledOccurrence;

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
