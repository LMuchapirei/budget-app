export type Category = string;

export type TxType = 'income' | 'expense';

export interface CustomCategory {
  id: string;
  title: string;
  description: string;
  type: TxType;
  color: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  category: Category;
  date: string;
  recurring: boolean;
}

export type ViewTab = 'dashboard' | 'projections' | 'reports' | 'settings';

export interface Stats {
  income: number;
  expenses: number;
  balance: number;
  count: number;
}
