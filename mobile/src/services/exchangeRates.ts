import type { ExchangeRatesCache } from '../types';
import { normalizeCurrencyCode } from '../utils/currency';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest';
const FALLBACK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface ExchangeRateApiResponse {
  result: 'success' | 'error';
  provider?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  'error-type'?: string;
}

export interface ConversionResult {
  amount: number;
  converted: boolean;
  missingCurrencyCode?: string;
}

export async function fetchLatestExchangeRates(baseCurrency: string): Promise<ExchangeRatesCache> {
  const base = normalizeCurrencyCode(baseCurrency);
  const response = await fetch(`${EXCHANGE_RATE_API_URL}/${encodeURIComponent(base)}`);
  if (!response.ok) {
    throw new Error(`Exchange rate request failed with ${response.status}`);
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (data.result !== 'success' || !data.rates || !data.base_code) {
    throw new Error(data['error-type'] ?? 'Exchange rate response was not usable');
  }

  return {
    provider: data.provider ?? 'ExchangeRate-API',
    baseCurrency: normalizeCurrencyCode(data.base_code),
    rates: data.rates,
    asOf: data.time_last_update_utc ?? new Date().toISOString(),
    nextUpdateAt: data.time_next_update_utc,
    fetchedAt: new Date().toISOString(),
  };
}

export function isExchangeRateCacheFresh(cache: ExchangeRatesCache | null, baseCurrency: string) {
  if (!cache || cache.baseCurrency !== normalizeCurrencyCode(baseCurrency)) return false;

  const nextUpdate = cache.nextUpdateAt ? Date.parse(cache.nextUpdateAt) : Number.NaN;
  if (!Number.isNaN(nextUpdate)) return Date.now() < nextUpdate;

  const fetchedAt = Date.parse(cache.fetchedAt);
  return !Number.isNaN(fetchedAt) && Date.now() - fetchedAt < FALLBACK_CACHE_TTL_MS;
}

export function canConvertCurrency(
  cache: ExchangeRatesCache | null,
  fromCurrency: string,
  toCurrency: string,
) {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return true;
  if (!cache) return false;

  const fromRate = from === cache.baseCurrency ? 1 : cache.rates[from];
  const toRate = to === cache.baseCurrency ? 1 : cache.rates[to];
  return Number(fromRate) > 0 && Number(toRate) > 0;
}

export function convertExchangeAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  cache: ExchangeRatesCache | null,
): ConversionResult {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return { amount, converted: true };
  if (!cache) return { amount: 0, converted: false, missingCurrencyCode: from };

  const fromRate = from === cache.baseCurrency ? 1 : cache.rates[from];
  const toRate = to === cache.baseCurrency ? 1 : cache.rates[to];
  if (Number(fromRate) <= 0 || Number(toRate) <= 0) {
    return { amount: 0, converted: false, missingCurrencyCode: from };
  }

  return {
    amount: (amount / fromRate) * toRate,
    converted: true,
  };
}
