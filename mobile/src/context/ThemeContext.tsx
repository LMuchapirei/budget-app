import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../services/storage';

export type ThemeType = 'light' | 'dark';

export const lightColors = {
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
};

export const darkColors = {
  paper: '#1c1b18',
  cream: '#252320',
  ink: '#F5F1E8',
  inkSoft: '#D4C9B5',
  rust: '#C48A69',
  moss: '#5A8A6F',
  clay: '#D89992',
  stone400: '#A19889',
  stone500: '#8A8275',
  stone600: '#736B5C',
  stone800: '#E1DAD1',
  border: 'rgba(245,241,232,0.12)',
  borderSoft: 'rgba(245,241,232,0.08)',
  hairline: 'rgba(245,241,232,0.04)',
  chip: 'rgba(245,241,232,0.06)',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Colors = typeof lightColors;

interface ThemeContextValue {
  theme: ThemeType;
  toggleTheme: () => void;
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(systemTheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    storage.getTheme().then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
    });
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      storage.setTheme(next);
      return next;
    });
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
