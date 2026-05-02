import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../services/storage';
import {
  DEFAULT_FONT_PAIR,
  FONT_PAIRS,
  setActiveFontPair,
  type FontPair,
  type FontPairId,
} from '../theme';

export type ThemeType = 'light' | 'dark';

export type ThemeMode = 'system' | 'light' | 'dark';

export type ThemePresetId =
  | 'warm-cream'
  | 'slate'
  | 'forest'
  | 'marine'
  | 'plum'
  | 'carbon';

export interface ColorPalette {
  paper: string;
  cream: string;
  ink: string;
  inkSoft: string;
  rust: string;        // accent (primary call-to-action / FAB / focus)
  moss: string;        // positive / income
  clay: string;        // danger / expense
  stone400: string;
  stone500: string;
  stone600: string;
  stone800: string;
  border: string;
  borderSoft: string;
  hairline: string;
  chip: string;
  overlay: string;
  // Hidden change signal — bumped when fonts change so style memos with `[colors]`
  // dep recompute and pick up the freshly mutated `fonts` object from `theme.ts`.
  _fontPair?: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  light: ColorPalette;
  dark: ColorPalette;
}

const WARM_CREAM_LIGHT: ColorPalette = {
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

const WARM_CREAM_DARK: ColorPalette = {
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

const SLATE_LIGHT: ColorPalette = {
  paper: '#F2F3F5',
  cream: '#FAFBFC',
  ink: '#1E2530',
  inkSoft: '#48505C',
  rust: '#3F5F8F',          // accent: dusty navy blue
  moss: '#4A7F70',
  clay: '#B26D63',
  stone400: '#8A8F99',
  stone500: '#6E7480',
  stone600: '#535965',
  stone800: '#1E2530',
  border: 'rgba(30,37,48,0.14)',
  borderSoft: 'rgba(30,37,48,0.10)',
  hairline: 'rgba(30,37,48,0.06)',
  chip: 'rgba(30,37,48,0.05)',
  overlay: 'rgba(30,37,48,0.55)',
};

const SLATE_DARK: ColorPalette = {
  paper: '#13171F',
  cream: '#1B1F28',
  ink: '#E8ECF2',
  inkSoft: '#B7BCC6',
  rust: '#7BA4DC',
  moss: '#7CB1A2',
  clay: '#E29A92',
  stone400: '#969BA7',
  stone500: '#7A808C',
  stone600: '#5F6470',
  stone800: '#E8ECF2',
  border: 'rgba(232,236,242,0.14)',
  borderSoft: 'rgba(232,236,242,0.08)',
  hairline: 'rgba(232,236,242,0.05)',
  chip: 'rgba(232,236,242,0.06)',
  overlay: 'rgba(0,0,0,0.65)',
};

const FOREST_LIGHT: ColorPalette = {
  paper: '#EFEFE5',
  cream: '#F8F8EE',
  ink: '#1E2A20',
  inkSoft: '#43574A',
  rust: '#446B3F',          // accent: deep moss
  moss: '#688E55',
  clay: '#A86742',
  stone400: '#8A8F7B',
  stone500: '#6F7461',
  stone600: '#555A48',
  stone800: '#1E2A20',
  border: 'rgba(30,42,32,0.14)',
  borderSoft: 'rgba(30,42,32,0.10)',
  hairline: 'rgba(30,42,32,0.06)',
  chip: 'rgba(30,42,32,0.05)',
  overlay: 'rgba(30,42,32,0.55)',
};

const FOREST_DARK: ColorPalette = {
  paper: '#161A14',
  cream: '#1F241D',
  ink: '#E8ECDF',
  inkSoft: '#BDC4B0',
  rust: '#85A87A',
  moss: '#A0BF8C',
  clay: '#D6996F',
  stone400: '#969A85',
  stone500: '#7B7F6B',
  stone600: '#5F6451',
  stone800: '#E8ECDF',
  border: 'rgba(232,236,223,0.14)',
  borderSoft: 'rgba(232,236,223,0.08)',
  hairline: 'rgba(232,236,223,0.05)',
  chip: 'rgba(232,236,223,0.06)',
  overlay: 'rgba(0,0,0,0.65)',
};

const MARINE_LIGHT: ColorPalette = {
  paper: '#EBF1F2',
  cream: '#F6F9F9',
  ink: '#0F1F26',
  inkSoft: '#3C525A',
  rust: '#1F6F7A',          // accent: teal
  moss: '#3F8C7A',
  clay: '#C46863',
  stone400: '#7B8A8F',
  stone500: '#5F6E73',
  stone600: '#445256',
  stone800: '#0F1F26',
  border: 'rgba(15,31,38,0.14)',
  borderSoft: 'rgba(15,31,38,0.10)',
  hairline: 'rgba(15,31,38,0.06)',
  chip: 'rgba(15,31,38,0.05)',
  overlay: 'rgba(15,31,38,0.55)',
};

const MARINE_DARK: ColorPalette = {
  paper: '#0B1518',
  cream: '#142023',
  ink: '#E1ECEF',
  inkSoft: '#A9BBC1',
  rust: '#5DB4BE',
  moss: '#7DC0AC',
  clay: '#E5938E',
  stone400: '#86969B',
  stone500: '#6A7A7F',
  stone600: '#4F5E63',
  stone800: '#E1ECEF',
  border: 'rgba(225,236,239,0.14)',
  borderSoft: 'rgba(225,236,239,0.08)',
  hairline: 'rgba(225,236,239,0.05)',
  chip: 'rgba(225,236,239,0.06)',
  overlay: 'rgba(0,0,0,0.65)',
};

const PLUM_LIGHT: ColorPalette = {
  paper: '#F1ECF0',
  cream: '#F9F6F8',
  ink: '#291F2A',
  inkSoft: '#54415A',
  rust: '#7B4A82',          // accent: dusty plum
  moss: '#5B7F66',
  clay: '#B05E62',
  stone400: '#8E8593',
  stone500: '#736975',
  stone600: '#564E58',
  stone800: '#291F2A',
  border: 'rgba(41,31,42,0.14)',
  borderSoft: 'rgba(41,31,42,0.10)',
  hairline: 'rgba(41,31,42,0.06)',
  chip: 'rgba(41,31,42,0.05)',
  overlay: 'rgba(41,31,42,0.55)',
};

const PLUM_DARK: ColorPalette = {
  paper: '#15101A',
  cream: '#1F1825',
  ink: '#EAE1EE',
  inkSoft: '#C2B3CB',
  rust: '#B384BA',
  moss: '#90B098',
  clay: '#E0918E',
  stone400: '#9A8FA0',
  stone500: '#7C7282',
  stone600: '#5E5564',
  stone800: '#EAE1EE',
  border: 'rgba(234,225,238,0.14)',
  borderSoft: 'rgba(234,225,238,0.08)',
  hairline: 'rgba(234,225,238,0.05)',
  chip: 'rgba(234,225,238,0.06)',
  overlay: 'rgba(0,0,0,0.65)',
};

const CARBON_LIGHT: ColorPalette = {
  paper: '#EFEFEF',
  cream: '#F8F8F8',
  ink: '#0F0F10',
  inkSoft: '#3F3F42',
  rust: '#D45C2B',          // accent: bright orange
  moss: '#3F8F5C',
  clay: '#C2474A',
  stone400: '#8E8E90',
  stone500: '#6E6E70',
  stone600: '#525254',
  stone800: '#0F0F10',
  border: 'rgba(15,15,16,0.14)',
  borderSoft: 'rgba(15,15,16,0.10)',
  hairline: 'rgba(15,15,16,0.06)',
  chip: 'rgba(15,15,16,0.06)',
  overlay: 'rgba(15,15,16,0.55)',
};

const CARBON_DARK: ColorPalette = {
  paper: '#0A0A0B',
  cream: '#141416',
  ink: '#F2F2F4',
  inkSoft: '#BDBDBF',
  rust: '#FF8454',
  moss: '#7CC290',
  clay: '#E68080',
  stone400: '#909093',
  stone500: '#727275',
  stone600: '#535357',
  stone800: '#F2F2F4',
  border: 'rgba(242,242,244,0.12)',
  borderSoft: 'rgba(242,242,244,0.08)',
  hairline: 'rgba(242,242,244,0.05)',
  chip: 'rgba(242,242,244,0.06)',
  overlay: 'rgba(0,0,0,0.7)',
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'warm-cream',
    name: 'Warm Cream',
    description: 'Earthy rust and moss on cream paper.',
    light: WARM_CREAM_LIGHT,
    dark: WARM_CREAM_DARK,
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool gray with dusty navy accents.',
    light: SLATE_LIGHT,
    dark: SLATE_DARK,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep moss greens for a quieter feel.',
    light: FOREST_LIGHT,
    dark: FOREST_DARK,
  },
  {
    id: 'marine',
    name: 'Marine',
    description: 'Teal accents on washed sea blue.',
    light: MARINE_LIGHT,
    dark: MARINE_DARK,
  },
  {
    id: 'plum',
    name: 'Plum',
    description: 'Dusky purple over warm parchment.',
    light: PLUM_LIGHT,
    dark: PLUM_DARK,
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Stark monochrome with a bright accent.',
    light: CARBON_LIGHT,
    dark: CARBON_DARK,
  },
];

export const ACCENT_SWATCHES: string[] = [
  '#8B5A3C', // rust
  '#D45C2B', // tangerine
  '#C97B4A', // amber
  '#A85751', // clay
  '#7B4A82', // plum
  '#3F5F8F', // navy
  '#1F6F7A', // teal
  '#446B3F', // moss
  '#3D6B4A', // forest
  '#5C7A8E', // steel
  '#B5A340', // ochre
  '#2C2416', // ink
];

const DEFAULT_PRESET: ThemePresetId = 'warm-cream';
const DEFAULT_MODE: ThemeMode = 'system';

interface ThemePreferences {
  preset: ThemePresetId;
  mode: ThemeMode;
  accent: string | null;
  fontPair: FontPairId;
}

const DEFAULT_PREFERENCES: ThemePreferences = {
  preset: DEFAULT_PRESET,
  mode: DEFAULT_MODE,
  accent: null,
  fontPair: DEFAULT_FONT_PAIR,
};

function resolveFontPairId(value: string | undefined): FontPairId {
  if (value && (value in FONT_PAIRS)) return value as FontPairId;
  return DEFAULT_FONT_PAIR;
}

function getPresetById(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

function applyAccent(palette: ColorPalette, accent: string | null): ColorPalette {
  if (!accent) return palette;
  return { ...palette, rust: accent };
}

// Backward-compatible exports for any module that still imports these directly.
export const lightColors: ColorPalette = WARM_CREAM_LIGHT;
export const darkColors: ColorPalette = WARM_CREAM_DARK;
export type Colors = ColorPalette;

interface ThemeContextValue {
  theme: ThemeType;
  mode: ThemeMode;
  presetId: ThemePresetId;
  preset: ThemePreset;
  accent: string | null;
  presets: ThemePreset[];
  fontPairId: FontPairId;
  fontPair: FontPair;
  fontPairs: FontPair[];
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePresetId) => void;
  setAccent: (accent: string | null) => void;
  setFontPair: (id: FontPairId) => void;
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [preferences, setPreferences] = useState<ThemePreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    storage.getThemePreferences().then((saved) => {
      if (cancelled) return;
      if (saved) {
        const fontPair = resolveFontPairId(saved.fontPair);
        setActiveFontPair(fontPair);
        setPreferences({
          preset: getPresetById(saved.preset).id,
          mode: saved.mode ?? DEFAULT_MODE,
          accent: saved.accent ?? null,
          fontPair,
        });
        return;
      }
      // Migrate legacy `budget:theme:v1` (string 'light' | 'dark')
      storage.getTheme().then((legacy) => {
        if (cancelled) return;
        if (legacy === 'light' || legacy === 'dark') {
          const migrated: ThemePreferences = {
            ...DEFAULT_PREFERENCES,
            mode: legacy as ThemeMode,
          };
          setActiveFontPair(migrated.fontPair);
          setPreferences(migrated);
          storage
            .setThemePreferences({
              preset: migrated.preset,
              mode: migrated.mode,
              accent: migrated.accent,
              fontPair: migrated.fontPair,
            })
            .catch(() => undefined);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (next: ThemePreferences) => {
    setPreferences(next);
    storage
      .setThemePreferences({
        preset: next.preset,
        mode: next.mode,
        accent: next.accent,
        fontPair: next.fontPair,
      })
      .catch(() => undefined);
  };

  const theme: ThemeType = useMemo(() => {
    if (preferences.mode === 'system') return systemTheme === 'dark' ? 'dark' : 'light';
    return preferences.mode;
  }, [preferences.mode, systemTheme]);

  const preset = useMemo(() => getPresetById(preferences.preset), [preferences.preset]);
  const basePalette = theme === 'dark' ? preset.dark : preset.light;
  // We attach the font pair id as a hidden field so any `useMemo(() => ..., [colors])`
  // recomputes when the user changes fonts. The shared `fonts` object is mutated in
  // place by `setActiveFontPair`, so the new font is read on the next render.
  const colors = useMemo(
    () =>
      ({
        ...applyAccent(basePalette, preferences.accent),
        _fontPair: preferences.fontPair,
      } as Colors),
    [basePalette, preferences.accent, preferences.fontPair],
  );

  const fontPair = useMemo<FontPair>(
    () => FONT_PAIRS[preferences.fontPair] ?? FONT_PAIRS[DEFAULT_FONT_PAIR],
    [preferences.fontPair],
  );

  const fontPairs = useMemo<FontPair[]>(() => Object.values(FONT_PAIRS), []);

  const setMode = (mode: ThemeMode) => persist({ ...preferences, mode });
  const setPreset = (presetId: ThemePresetId) => persist({ ...preferences, preset: presetId });
  const setAccent = (accent: string | null) => persist({ ...preferences, accent });
  const setFontPair = (id: FontPairId) => {
    setActiveFontPair(id);
    persist({ ...preferences, fontPair: id });
  };
  const toggleTheme = () => {
    const nextMode: ThemeMode = theme === 'light' ? 'dark' : 'light';
    persist({ ...preferences, mode: nextMode });
  };

  const value: ThemeContextValue = {
    theme,
    mode: preferences.mode,
    presetId: preferences.preset,
    preset,
    accent: preferences.accent,
    presets: THEME_PRESETS,
    fontPairId: preferences.fontPair,
    fontPair,
    fontPairs,
    toggleTheme,
    setMode,
    setPreset,
    setAccent,
    setFontPair,
    colors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
