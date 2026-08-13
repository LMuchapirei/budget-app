// Layout preferences: which tabs the user wants in which order, and which
// tab the app opens to. Kept separate from ThemeContext because it controls
// navigation, not aesthetics.
//
// 'settings' is special-cased: it always renders last, is never reorderable,
// and cannot be the default landing tab. That's a UX guard — users should
// always have a predictable way to get to Settings, and the app shouldn't
// open into Settings on launch.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { storage, type LayoutPreferencesPayload } from '../services/storage';
import type { ViewTab } from '../types';

export const REORDERABLE_TABS: ReadonlyArray<ViewTab> = [
  'dashboard',
  'bills',
  'projections',
  'reports',
];

export const FIXED_LAST_TAB: ViewTab = 'settings';

const ALL_TABS: ReadonlyArray<ViewTab> = [...REORDERABLE_TABS, FIXED_LAST_TAB];

const DEFAULT_PREFS: LayoutPreferencesPayload = {
  order: [...REORDERABLE_TABS],
  defaultTab: 'dashboard',
};

function isViewTab(value: unknown): value is ViewTab {
  return typeof value === 'string' && (ALL_TABS as readonly string[]).includes(value);
}

function normalizeOrder(input: unknown): ViewTab[] {
  if (!Array.isArray(input)) return [...REORDERABLE_TABS];
  const seen = new Set<ViewTab>();
  const result: ViewTab[] = [];
  for (const item of input) {
    if (
      isViewTab(item) &&
      item !== FIXED_LAST_TAB &&
      !seen.has(item)
    ) {
      seen.add(item);
      result.push(item);
    }
  }
  // Append any reorderable tabs the saved prefs missed (e.g. a future tab
  // added in a later release that an old saved order doesn't know about).
  for (const tab of REORDERABLE_TABS) {
    if (!seen.has(tab)) result.push(tab);
  }
  return result;
}

function normalizeDefault(value: unknown, order: ViewTab[]): ViewTab {
  if (isViewTab(value) && value !== FIXED_LAST_TAB) return value;
  return order[0] ?? 'dashboard';
}

interface LayoutContextValue {
  /** The reorderable tabs in user-defined order. Settings is NOT in this list. */
  tabOrder: ViewTab[];
  /** Full render order including settings at the end. */
  renderedTabs: ViewTab[];
  defaultTab: ViewTab;
  setTabOrder: (order: ViewTab[]) => void;
  setDefaultTab: (tab: ViewTab) => void;
  resetLayout: () => void;
  loaded: boolean;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<LayoutPreferencesPayload>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.getLayoutPreferences().then((saved) => {
      if (cancelled) return;
      if (saved) {
        const order = normalizeOrder(saved.order);
        setPrefs({
          order,
          defaultTab: normalizeDefault(saved.defaultTab, order),
        });
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: LayoutPreferencesPayload) => {
    setPrefs(next);
    storage.setLayoutPreferences(next).catch(() => undefined);
  }, []);

  const setTabOrder = useCallback(
    (order: ViewTab[]) => {
      const normalized = normalizeOrder(order);
      persist({
        order: normalized,
        defaultTab: normalizeDefault(prefs.defaultTab, normalized),
      });
    },
    [persist, prefs.defaultTab],
  );

  const setDefaultTab = useCallback(
    (tab: ViewTab) => {
      persist({
        order: prefs.order,
        defaultTab: normalizeDefault(tab, prefs.order),
      });
    },
    [persist, prefs.order],
  );

  const resetLayout = useCallback(() => {
    persist({ order: [...REORDERABLE_TABS], defaultTab: 'dashboard' });
  }, [persist]);

  const renderedTabs = useMemo(
    () => [...prefs.order, FIXED_LAST_TAB],
    [prefs.order],
  );

  const value: LayoutContextValue = {
    tabOrder: prefs.order,
    renderedTabs,
    defaultTab: prefs.defaultTab,
    setTabOrder,
    setDefaultTab,
    resetLayout,
    loaded,
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used inside <LayoutProvider>');
  return ctx;
}
