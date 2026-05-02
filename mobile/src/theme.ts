import { Category, CustomCategory } from './types';

// Static fallback color used by `colorFor` when no theme context is available.
// Components rendered inside a screen should prefer `useTheme().colors`.
const STATIC_FALLBACK_COLOR = '#8A8275';

export type FontPairId =
  | 'fraunces-inter'
  | 'jost'
  | 'playfair-inter'
  | 'dm-serif-dm-sans';

export interface FontMap {
  display: string;
  displayItalic: string;
  displayLight: string;
  displayMedium: string;
  body: string;
  bodyMedium: string;
  bodySemibold: string;
}

export interface FontPair {
  id: FontPairId;
  name: string;
  description: string;
  fonts: FontMap;
}

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
  'fraunces-inter': {
    id: 'fraunces-inter',
    name: 'Fraunces / Inter',
    description: 'Sophisticated serif paired with crisp sans.',
    fonts: {
      display: 'Fraunces_400Regular',
      displayItalic: 'Fraunces_400Regular_Italic',
      displayLight: 'Fraunces_300Light',
      displayMedium: 'Fraunces_500Medium',
      body: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
      bodySemibold: 'Inter_600SemiBold',
    },
  },
  jost: {
    id: 'jost',
    name: 'Jost',
    description: 'Modern geometric sans for everything.',
    fonts: {
      display: 'Jost_400Regular',
      displayItalic: 'Jost_400Regular_Italic',
      displayLight: 'Jost_300Light',
      displayMedium: 'Jost_500Medium',
      body: 'Jost_400Regular',
      bodyMedium: 'Jost_500Medium',
      bodySemibold: 'Jost_600SemiBold',
    },
  },
  'playfair-inter': {
    id: 'playfair-inter',
    name: 'Playfair / Inter',
    description: 'Editorial serif headlines, neutral body.',
    fonts: {
      display: 'PlayfairDisplay_400Regular',
      displayItalic: 'PlayfairDisplay_400Regular_Italic',
      displayLight: 'PlayfairDisplay_400Regular',
      displayMedium: 'PlayfairDisplay_500Medium',
      body: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
      bodySemibold: 'Inter_600SemiBold',
    },
  },
  'dm-serif-dm-sans': {
    id: 'dm-serif-dm-sans',
    name: 'DM Serif / DM Sans',
    description: 'High-contrast serif with friendly sans.',
    fonts: {
      display: 'DMSerifDisplay_400Regular',
      displayItalic: 'DMSerifDisplay_400Regular_Italic',
      displayLight: 'DMSerifDisplay_400Regular',
      displayMedium: 'DMSerifDisplay_400Regular',
      body: 'DMSans_400Regular',
      bodyMedium: 'DMSans_500Medium',
      bodySemibold: 'DMSans_600SemiBold',
    },
  },
};

export const DEFAULT_FONT_PAIR: FontPairId = 'fraunces-inter';

let activeFontPairId: FontPairId = DEFAULT_FONT_PAIR;

// Mutable shared fonts object. Components import this once and read its
// properties at render time; `setActiveFontPair` mutates the fields in-place
// so every consumer sees the new font immediately on the next render.
// `ThemeContext` re-renders style memos by bumping a signal in the colors object.
export const fonts: FontMap = { ...FONT_PAIRS[DEFAULT_FONT_PAIR].fonts };

export function setActiveFontPair(id: FontPairId) {
  const pair = FONT_PAIRS[id];
  if (!pair) return;
  activeFontPairId = id;
  Object.assign(fonts, pair.fonts);
}

export function getActiveFontPair(): FontPairId {
  return activeFontPairId;
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
  return CATEGORY_COLORS[c] ?? STATIC_FALLBACK_COLOR;
};
