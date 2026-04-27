export type Category = string;

export type TxType = 'income' | 'expense';

export interface CustomCategory {
  id: string;
  title: string;
  description: string;
  type: TxType;
  color: string;
}

export interface LedgerAccount {
  id: string;
  name: string;
  description: string;
  color: string;
  currencyCode: string;
  currencySymbol: string;
  accountNumber?: string;
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

export type ViewTab = 'dashboard' | 'projections' | 'reports' | 'settings';

export interface Stats {
  income: number;
  expenses: number;
  balance: number;
  count: number;
}
