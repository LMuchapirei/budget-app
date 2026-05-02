import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Transaction,
  CustomCategory,
  TransactionEditHistory,
  LedgerAccount,
  ReportingCurrency,
  ExchangeRatesCache,
} from '../types';

export interface DataService {
  getTheme(): Promise<string | null>;
  setTheme(theme: string): Promise<void>;
  
  getCurrency(): Promise<string | null>;
  setCurrency(curr: string): Promise<void>;

  getReportingCurrency(): Promise<ReportingCurrency | null>;
  setReportingCurrency(currency: ReportingCurrency): Promise<void>;

  getExchangeRatesCache(): Promise<ExchangeRatesCache | null>;
  saveExchangeRatesCache(cache: ExchangeRatesCache): Promise<void>;
  
  getTransactions(): Promise<Transaction[]>;
  saveTransactions(txs: Transaction[]): Promise<void>;

  getLedgers(): Promise<LedgerAccount[]>;
  saveLedgers(ledgers: LedgerAccount[]): Promise<void>;

  getActiveLedger(): Promise<string | null>;
  setActiveLedger(id: string): Promise<void>;

  getTransactionEditHistory(): Promise<TransactionEditHistory[]>;
  saveTransactionEditHistory(history: TransactionEditHistory[]): Promise<void>;
  
  getCategories(): Promise<CustomCategory[]>;
  saveCategories(cats: CustomCategory[]): Promise<void>;
  
  getAppLock(): Promise<boolean>;
  setAppLock(enabled: boolean): Promise<void>;
  
  clearAllData(): Promise<void>;
}

class LocalDataService implements DataService {
  private readonly THEME_KEY = 'budget:theme:v1';
  private readonly STORAGE_KEY = 'budget:transactions:v1';
  private readonly LEDGER_KEY = 'budget:ledgers:v1';
  private readonly ACTIVE_LEDGER_KEY = 'budget:active-ledger:v1';
  private readonly EDIT_HISTORY_KEY = 'budget:transaction-edits:v1';
  private readonly CAT_STORAGE_KEY = 'budget:categories:v1';
  private readonly CURRENCY_KEY = 'budget:currency:v1';
  private readonly REPORTING_CURRENCY_KEY = 'budget:reporting-currency:v1';
  private readonly EXCHANGE_RATES_KEY = 'budget:exchange-rates:v1';
  private readonly APPLOCK_KEY = 'budget:applock:v1';

  async getTheme(): Promise<string | null> {
    return AsyncStorage.getItem(this.THEME_KEY);
  }

  async setTheme(theme: string): Promise<void> {
    await AsyncStorage.setItem(this.THEME_KEY, theme);
  }

  async getCurrency(): Promise<string | null> {
    return AsyncStorage.getItem(this.CURRENCY_KEY);
  }

  async setCurrency(curr: string): Promise<void> {
    await AsyncStorage.setItem(this.CURRENCY_KEY, curr);
  }

  async getReportingCurrency(): Promise<ReportingCurrency | null> {
    const raw = await AsyncStorage.getItem(this.REPORTING_CURRENCY_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ReportingCurrency;
    } catch {
      return null;
    }
  }

  async setReportingCurrency(currency: ReportingCurrency): Promise<void> {
    await AsyncStorage.setItem(this.REPORTING_CURRENCY_KEY, JSON.stringify(currency));
  }

  async getExchangeRatesCache(): Promise<ExchangeRatesCache | null> {
    const raw = await AsyncStorage.getItem(this.EXCHANGE_RATES_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ExchangeRatesCache;
    } catch {
      return null;
    }
  }

  async saveExchangeRatesCache(cache: ExchangeRatesCache): Promise<void> {
    await AsyncStorage.setItem(this.EXCHANGE_RATES_KEY, JSON.stringify(cache));
  }

  async getTransactions(): Promise<Transaction[]> {
    const raw = await AsyncStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Transaction[];
    } catch {
      return [];
    }
  }

  async saveTransactions(txs: Transaction[]): Promise<void> {
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(txs));
  }

  async getLedgers(): Promise<LedgerAccount[]> {
    const raw = await AsyncStorage.getItem(this.LEDGER_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as LedgerAccount[];
    } catch {
      return [];
    }
  }

  async saveLedgers(ledgers: LedgerAccount[]): Promise<void> {
    await AsyncStorage.setItem(this.LEDGER_KEY, JSON.stringify(ledgers));
  }

  async getActiveLedger(): Promise<string | null> {
    return AsyncStorage.getItem(this.ACTIVE_LEDGER_KEY);
  }

  async setActiveLedger(id: string): Promise<void> {
    await AsyncStorage.setItem(this.ACTIVE_LEDGER_KEY, id);
  }

  async getTransactionEditHistory(): Promise<TransactionEditHistory[]> {
    const raw = await AsyncStorage.getItem(this.EDIT_HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as TransactionEditHistory[];
    } catch {
      return [];
    }
  }

  async saveTransactionEditHistory(history: TransactionEditHistory[]): Promise<void> {
    await AsyncStorage.setItem(this.EDIT_HISTORY_KEY, JSON.stringify(history));
  }

  async getCategories(): Promise<CustomCategory[]> {
    const raw = await AsyncStorage.getItem(this.CAT_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CustomCategory[];
    } catch {
      return [];
    }
  }

  async saveCategories(cats: CustomCategory[]): Promise<void> {
    await AsyncStorage.setItem(this.CAT_STORAGE_KEY, JSON.stringify(cats));
  }

  async getAppLock(): Promise<boolean> {
    const val = await AsyncStorage.getItem(this.APPLOCK_KEY);
    return val === 'true';
  }

  async setAppLock(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(this.APPLOCK_KEY, enabled ? 'true' : 'false');
  }

  async clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove([
      this.STORAGE_KEY,
      this.CAT_STORAGE_KEY,
      this.EDIT_HISTORY_KEY,
      this.LEDGER_KEY,
      this.ACTIVE_LEDGER_KEY,
      this.CURRENCY_KEY,
      this.REPORTING_CURRENCY_KEY,
      this.EXCHANGE_RATES_KEY,
    ]);
  }
}

// Export the singleton service instance.
// To use a cloud-based API later, simply initialize CloudDataService() here instead.
export const storage: DataService = new LocalDataService();
