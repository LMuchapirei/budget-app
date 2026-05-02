import type { ReportingCurrency } from '../types';

export const REPORTING_CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'ZWL', symbol: 'Z$' },
  { code: 'EUR', symbol: '\u20ac' },
  { code: 'GBP', symbol: '\u00a3' },
  { code: 'JPY', symbol: '\u00a5' },
] as const satisfies readonly ReportingCurrency[];

export const DEFAULT_REPORTING_CURRENCY: ReportingCurrency = REPORTING_CURRENCY_OPTIONS[0];

const LEGACY_SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD',
  'US$': 'USD',
  R: 'ZAR',
  'Z$': 'ZWL',
  '\u20ac': 'EUR',
  '\u00a3': 'GBP',
  '\u00a5': 'JPY',
  '\u00e2\u201a\u00ac': 'EUR',
  '\u00c2\u00a3': 'GBP',
  '\u00c2\u00a5': 'JPY',
};

export function normalizeCurrencyCode(code?: string | null) {
  return (code || DEFAULT_REPORTING_CURRENCY.code).trim().toUpperCase();
}

export function currencyOptionFromCode(code?: string | null): ReportingCurrency {
  const normalized = normalizeCurrencyCode(code);
  return (
    REPORTING_CURRENCY_OPTIONS.find((option) => option.code === normalized) ?? {
      code: normalized,
      symbol: `${normalized} `,
    }
  );
}

export function currencyOptionFromSymbol(symbol?: string | null): ReportingCurrency {
  if (!symbol) return DEFAULT_REPORTING_CURRENCY;
  return currencyOptionFromCode(LEGACY_SYMBOL_TO_CODE[symbol] ?? DEFAULT_REPORTING_CURRENCY.code);
}

export function formatCurrencyAmount(value: number, symbol: string) {
  return `${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrencyAmount(value: number, symbol: string) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}${symbol}${Math.round(abs / 1000000)}m`;
  if (abs >= 1000) return `${sign}${symbol}${Math.round(abs / 1000)}k`;
  return `${sign}${symbol}${Math.round(abs)}`;
}
