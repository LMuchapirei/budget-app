import { Category, CustomCategory } from './types';
import { lightColors } from './context/ThemeContext';

// We fallback to lightColors here for static functions, but hooks should prefer useTheme.
export const colors = lightColors;

export const fonts = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  displayLight: 'Fraunces_300Light',
  displayMedium: 'Fraunces_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

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
