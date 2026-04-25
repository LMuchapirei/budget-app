export const colors = {
  paper: '#F5F1E8',
  cream: '#FFFBF2',
  ink: '#2C2416',
  inkSoft: '#5C5142',
  rust: '#8B5A3C',
  moss: '#3D6B4A',
  clay: '#A85751',
  stone400: '#8A8275',
  stone500: '#736B5C',
  stone600: '#5C5142',
  stone800: '#2C2416',
  border: 'rgba(139,90,60,0.18)',
  borderSoft: 'rgba(139,90,60,0.15)',
  hairline: 'rgba(44,36,22,0.08)',
  chip: 'rgba(44,36,22,0.06)',
  overlay: 'rgba(44,36,22,0.5)',
} as const;

export const fonts = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  displayLight: 'Fraunces_300Light',
  displayMedium: 'Fraunces_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

export type Category = string;

export interface CustomCategory {
  id: string;
  title: string;
  description: string;
  type: TxType;
  color: string;
}
export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  category: Category;
  date: string;
  recurring: boolean;
}

export const CATEGORIES: {
  income: string[];
  expense: string[];
} = {
  income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other Income'],
  expense: [
    'Housing',
    'Food',
    'Transport',
    'Utilities',
    'Entertainment',
    'Health',
    'Shopping',
    'Subscriptions',
    'Other',
  ],
};

export const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#8B5A3C',
  Food: '#C97B4A',
  Transport: '#6B8E6B',
  Utilities: '#9B7FA0',
  Entertainment: '#D4A04A',
  Health: '#A85751',
  Shopping: '#7A8FA8',
  Subscriptions: '#5C7A8E',
  Other: '#8A8275',
  Salary: '#3D6B4A',
  Freelance: '#5A8A6F',
  Investments: '#7AAF8E',
  Gifts: '#9BC4A8',
  'Other Income': '#B8D4BF',
};

export const colorFor = (c: string, customCategories?: CustomCategory[]): string => {
  const custom = customCategories?.find((cat) => cat.title === c);
  if (custom) return custom.color;
  return CATEGORY_COLORS[c] ?? colors.stone400;
};

export const fmt = (n: number): string =>
  `$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
