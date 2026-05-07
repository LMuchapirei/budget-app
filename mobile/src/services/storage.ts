import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Transaction,
  CustomCategory,
  TransactionEditHistory,
  LedgerAccount,
  ReportingCurrency,
  ExchangeRatesCache,
  Budget,
  Goal,
  BillOccurrenceRecord,
  ScheduledOccurrenceRecord,
  PaymentEvidence,
} from '../types';

export interface ThemePreferencesPayload {
  preset: string;
  mode: 'system' | 'light' | 'dark';
  accent: string | null;
  fontPair?: string;
}

export interface DataService {
  getTheme(): Promise<string | null>;
  setTheme(theme: string): Promise<void>;

  getThemePreferences(): Promise<ThemePreferencesPayload | null>;
  setThemePreferences(payload: ThemePreferencesPayload): Promise<void>;

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

  getBudgets(): Promise<Budget[]>;
  saveBudgets(budgets: Budget[]): Promise<void>;

  getGoals(): Promise<Goal[]>;
  saveGoals(goals: Goal[]): Promise<void>;

  getBillOccurrenceRecords(): Promise<BillOccurrenceRecord[]>;
  saveBillOccurrenceRecords(records: BillOccurrenceRecord[]): Promise<void>;
  clearLegacyBillOccurrenceRecords(): Promise<void>;

  getScheduledOccurrenceRecords(): Promise<ScheduledOccurrenceRecord[]>;
  saveScheduledOccurrenceRecords(records: ScheduledOccurrenceRecord[]): Promise<void>;

  getPaymentEvidence(): Promise<PaymentEvidence[]>;
  savePaymentEvidence(evidence: PaymentEvidence[]): Promise<void>;

  getAppLock(): Promise<boolean>;
  setAppLock(enabled: boolean): Promise<void>;

  getOnboardedAt(): Promise<string | null>;
  setOnboardedAt(value: string | null): Promise<void>;

  replaceUserDataWithBackup(payload: BackupRestorePayload): Promise<void>;

  clearAllData(): Promise<void>;
}

export interface BackupRestorePayload {
  transactions: Transaction[];
  ledgers: LedgerAccount[];
  customCategories: CustomCategory[];
  budgets: Budget[];
  goals: Goal[];
  scheduledOccurrenceRecords: ScheduledOccurrenceRecord[];
  paymentEvidence: PaymentEvidence[];
  transactionEditHistory: TransactionEditHistory[];
}

class LocalDataService implements DataService {
  private readonly THEME_KEY = 'budget:theme:v1';
  private readonly THEME_PREFS_KEY = 'budget:theme:v2';
  private readonly STORAGE_KEY = 'budget:transactions:v1';
  private readonly LEDGER_KEY = 'budget:ledgers:v1';
  private readonly ACTIVE_LEDGER_KEY = 'budget:active-ledger:v1';
  private readonly EDIT_HISTORY_KEY = 'budget:transaction-edits:v1';
  private readonly CAT_STORAGE_KEY = 'budget:categories:v1';
  private readonly CURRENCY_KEY = 'budget:currency:v1';
  private readonly REPORTING_CURRENCY_KEY = 'budget:reporting-currency:v1';
  private readonly EXCHANGE_RATES_KEY = 'budget:exchange-rates:v1';
  private readonly BUDGETS_KEY = 'budget:budgets:v1';
  private readonly GOALS_KEY = 'budget:goals:v1';
  private readonly BILL_OCCURRENCES_KEY = 'budget:bill-occurrences:v1';
  private readonly SCHEDULED_OCCURRENCES_KEY = 'budget:scheduled-occurrences:v2';
  private readonly PAYMENT_EVIDENCE_KEY = 'budget:payment-evidence:v1';
  private readonly APPLOCK_KEY = 'budget:applock:v1';
  private readonly ONBOARDED_KEY = 'budget:onboarded:v1';

  async getTheme(): Promise<string | null> {
    return AsyncStorage.getItem(this.THEME_KEY);
  }

  async setTheme(theme: string): Promise<void> {
    await AsyncStorage.setItem(this.THEME_KEY, theme);
  }

  async getThemePreferences(): Promise<ThemePreferencesPayload | null> {
    const raw = await AsyncStorage.getItem(this.THEME_PREFS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ThemePreferencesPayload;
    } catch {
      return null;
    }
  }

  async setThemePreferences(payload: ThemePreferencesPayload): Promise<void> {
    await AsyncStorage.setItem(this.THEME_PREFS_KEY, JSON.stringify(payload));
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

  async getBudgets(): Promise<Budget[]> {
    const raw = await AsyncStorage.getItem(this.BUDGETS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Budget[];
    } catch {
      return [];
    }
  }

  async saveBudgets(budgets: Budget[]): Promise<void> {
    await AsyncStorage.setItem(this.BUDGETS_KEY, JSON.stringify(budgets));
  }

  async getGoals(): Promise<Goal[]> {
    const raw = await AsyncStorage.getItem(this.GOALS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Goal[];
    } catch {
      return [];
    }
  }

  async saveGoals(goals: Goal[]): Promise<void> {
    await AsyncStorage.setItem(this.GOALS_KEY, JSON.stringify(goals));
  }

  async getBillOccurrenceRecords(): Promise<BillOccurrenceRecord[]> {
    const raw = await AsyncStorage.getItem(this.BILL_OCCURRENCES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as BillOccurrenceRecord[];
    } catch {
      return [];
    }
  }

  async saveBillOccurrenceRecords(records: BillOccurrenceRecord[]): Promise<void> {
    void records;
  }

  async clearLegacyBillOccurrenceRecords(): Promise<void> {
    await AsyncStorage.removeItem(this.BILL_OCCURRENCES_KEY);
  }

  async getScheduledOccurrenceRecords(): Promise<ScheduledOccurrenceRecord[]> {
    const raw = await AsyncStorage.getItem(this.SCHEDULED_OCCURRENCES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ScheduledOccurrenceRecord[];
    } catch {
      return [];
    }
  }

  async saveScheduledOccurrenceRecords(records: ScheduledOccurrenceRecord[]): Promise<void> {
    await AsyncStorage.setItem(this.SCHEDULED_OCCURRENCES_KEY, JSON.stringify(records));
  }

  async getPaymentEvidence(): Promise<PaymentEvidence[]> {
    const raw = await AsyncStorage.getItem(this.PAYMENT_EVIDENCE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as PaymentEvidence[];
    } catch {
      return [];
    }
  }

  async savePaymentEvidence(evidence: PaymentEvidence[]): Promise<void> {
    await AsyncStorage.setItem(this.PAYMENT_EVIDENCE_KEY, JSON.stringify(evidence));
  }

  async getAppLock(): Promise<boolean> {
    const val = await AsyncStorage.getItem(this.APPLOCK_KEY);
    return val === 'true';
  }

  async setAppLock(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(this.APPLOCK_KEY, enabled ? 'true' : 'false');
  }

  async getOnboardedAt(): Promise<string | null> {
    return AsyncStorage.getItem(this.ONBOARDED_KEY);
  }

  async setOnboardedAt(value: string | null): Promise<void> {
    if (value === null) {
      await AsyncStorage.removeItem(this.ONBOARDED_KEY);
      return;
    }
    await AsyncStorage.setItem(this.ONBOARDED_KEY, value);
  }

  async replaceUserDataWithBackup(payload: BackupRestorePayload): Promise<void> {
    // Wipe user-data keys (preserves theme, lock, currency, onboarded) and write the new payload.
    await AsyncStorage.multiRemove([
      this.STORAGE_KEY,
      this.LEDGER_KEY,
      this.ACTIVE_LEDGER_KEY,
      this.EDIT_HISTORY_KEY,
      this.CAT_STORAGE_KEY,
      this.BUDGETS_KEY,
      this.GOALS_KEY,
      this.BILL_OCCURRENCES_KEY,
      this.SCHEDULED_OCCURRENCES_KEY,
      this.PAYMENT_EVIDENCE_KEY,
    ]);
    await Promise.all([
      this.saveTransactions(payload.transactions),
      this.saveLedgers(payload.ledgers),
      this.saveCategories(payload.customCategories),
      this.saveBudgets(payload.budgets),
      this.saveGoals(payload.goals),
      this.saveScheduledOccurrenceRecords(payload.scheduledOccurrenceRecords),
      this.savePaymentEvidence(payload.paymentEvidence),
      this.saveTransactionEditHistory(payload.transactionEditHistory),
    ]);
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
      this.BUDGETS_KEY,
      this.GOALS_KEY,
      this.BILL_OCCURRENCES_KEY,
      this.SCHEDULED_OCCURRENCES_KEY,
      this.PAYMENT_EVIDENCE_KEY,
    ]);
  }
}

// Export the singleton service instance.
// To use a cloud-based API later, simply initialize CloudDataService() here instead.
export const storage: DataService = new LocalDataService();
