import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, CustomCategory } from '../types';

export interface DataService {
  getTheme(): Promise<string | null>;
  setTheme(theme: string): Promise<void>;
  
  getCurrency(): Promise<string | null>;
  setCurrency(curr: string): Promise<void>;
  
  getTransactions(): Promise<Transaction[]>;
  saveTransactions(txs: Transaction[]): Promise<void>;
  
  getCategories(): Promise<CustomCategory[]>;
  saveCategories(cats: CustomCategory[]): Promise<void>;
  
  clearAllData(): Promise<void>;
}

class LocalDataService implements DataService {
  private readonly THEME_KEY = 'budget:theme:v1';
  private readonly STORAGE_KEY = 'budget:transactions:v1';
  private readonly CAT_STORAGE_KEY = 'budget:categories:v1';
  private readonly CURRENCY_KEY = 'budget:currency:v1';

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

  async clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove([this.STORAGE_KEY, this.CAT_STORAGE_KEY]);
  }
}

// Export the singleton service instance.
// To use a cloud-based API later, simply initialize CloudDataService() here instead.
export const storage: DataService = new LocalDataService();
