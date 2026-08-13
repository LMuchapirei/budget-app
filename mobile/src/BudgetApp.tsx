import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Text,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Jost_300Light,
  Jost_400Regular,
  Jost_400Regular_Italic,
  Jost_500Medium,
  Jost_600SemiBold,
} from '@expo-google-fonts/jost';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
} from '@expo-google-fonts/playfair-display';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { ArrowLeftRight, Plus, X } from 'lucide-react-native';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { BudgetProvider, useBudget } from './context/BudgetContext';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import { fonts } from './theme';
import type { Transaction, ViewTab } from './types';

import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BillsScreen } from './screens/BillsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectionsScreen } from './screens/ProjectionsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TransactionForm } from './components/forms/TransactionForm';
import { TransferForm } from './components/forms/TransferForm';
import { QuickActionsSheet } from './components/forms/QuickActionsSheet';
import { LockScreen } from './components/LockScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { OnboardingProvider } from './context/OnboardingContext';
import { storage } from './services/storage';

function Layout() {
  const { colors, theme } = useTheme();
  const { loading } = useBudget();
  const { isLocked } = useLock();
  const { defaultTab, loaded: layoutLoaded } = useLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [view, setView] = useState<ViewTab>(defaultTab);
  const [viewInitialized, setViewInitialized] = useState(false);

  // Once layout prefs hydrate, apply the saved default tab on first launch.
  // After that, the user's in-session tab choice wins.
  useEffect(() => {
    if (layoutLoaded && !viewInitialized) {
      setView(defaultTab);
      setViewInitialized(true);
    }
  }, [layoutLoaded, defaultTab, viewInitialized]);
  const [showForm, setShowForm] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTransferPairId, setEditingTransferPairId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [quickActionInitialType, setQuickActionInitialType] =
    useState<'expense' | 'income' | null>(null);

  // `undefined` while we're hydrating; null = never onboarded; ISO timestamp = onboarded.
  // `forceOnboarding` is set from Settings to replay the intro after the user is onboarded.
  const [onboardedAt, setOnboardedAt] = useState<string | null | undefined>(undefined);
  const [forceOnboarding, setForceOnboarding] = useState(false);

  useEffect(() => {
    storage
      .getOnboardedAt()
      .then((value) => setOnboardedAt(value))
      .catch(() => setOnboardedAt(null));
  }, []);

  const completeOnboarding = async () => {
    const now = new Date().toISOString();
    try {
      await storage.setOnboardedAt(now);
    } catch {
      // Even if persistence fails, advance the user out of the intro.
    }
    setOnboardedAt(now);
    setForceOnboarding(false);
  };

  const replayOnboarding = () => setForceOnboarding(true);
  const showingOnboarding = forceOnboarding || onboardedAt === null;

  const openTransactionForm = (
    transaction: Transaction | null = null,
    type: 'expense' | 'income' | null = null,
  ) => {
    setShowCreateMenu(false);
    setEditingTransaction(transaction);
    setQuickActionInitialType(type);
    setShowForm(true);
  };

  const openTransferForm = (pairId: string | null = null) => {
    setShowCreateMenu(false);
    setEditingTransaction(null);
    setEditingTransferPairId(pairId);
    setShowTransferForm(true);
  };

  if (loading || onboardedAt === undefined) {
    return (
      <SafeAreaView style={styles.loaderRoot}>
        <ActivityIndicator color={colors.rust} />
      </SafeAreaView>
    );
  }

  if (showingOnboarding) {
    return (
      <OnboardingProvider replay={replayOnboarding}>
        <SafeAreaView style={styles.root}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <OnboardingScreen onComplete={completeOnboarding} />
        </SafeAreaView>
      </OnboardingProvider>
    );
  }

  return (
    <OnboardingProvider replay={replayOnboarding}>
    <SafeAreaView style={styles.root}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Header
          view={view}
          setView={setView}
          onOpenSearch={() => setShowQuickActions(true)}
        />
        
        <View style={{ flex: 1 }}>
          <ErrorBoundary key={view} tag={view}>
            {view === 'dashboard' && (
              <DashboardScreen
                onEditTransaction={(transaction) => {
                  if (transaction.transferPairId) {
                    openTransferForm(transaction.transferPairId);
                    return;
                  }
                  openTransactionForm(transaction);
                }}
              />
            )}
            {view === 'bills' && <BillsScreen />}
            {view === 'projections' && <ProjectionsScreen />}
            {view === 'reports' && <ReportsScreen />}
            {view === 'settings' && <SettingsScreen />}
          </ErrorBoundary>
        </View>
      </ScrollView>

      {view !== 'settings' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add entry or transfer"
          onPress={() => {
            setShowCreateMenu(true);
          }}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Plus size={28} color="#fff" strokeWidth={2} />
        </Pressable>
      )}

      <Modal
        visible={showCreateMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateMenu(false)}
      >
        <View style={styles.menuRoot}>
          <Pressable style={styles.menuBackdrop} onPress={() => setShowCreateMenu(false)} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHead}>
              <Text style={styles.menuTitle}>Add money movement</Text>
              <Pressable onPress={() => setShowCreateMenu(false)} hitSlop={8}>
                <X size={20} color={colors.stone500} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => openTransactionForm(null)}
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.menuIcon}>
                <Plus size={18} color={colors.rust} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuOptionTitle}>Income or expense</Text>
                <Text style={styles.menuOptionMeta}>
                  Record money earned, spent, or scheduled.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => openTransferForm(null)}
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.menuIcon}>
                <ArrowLeftRight size={18} color={colors.rust} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuOptionTitle}>Transfer between accounts</Text>
                <Text style={styles.menuOptionMeta}>
                  Move funds without counting it as income or spending.
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEditingTransaction(null);
          setShowForm(false);
        }}
      >
        {showForm && (
          <TransactionForm
            transaction={editingTransaction}
            initialType={quickActionInitialType ?? undefined}
            onClose={() => {
              setEditingTransaction(null);
              setQuickActionInitialType(null);
              setShowForm(false);
            }}
          />
        )}
      </Modal>

      <QuickActionsSheet
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onOpenAddExpense={() => openTransactionForm(null, 'expense')}
        onOpenAddIncome={() => openTransactionForm(null, 'income')}
        onOpenTransfer={() => openTransferForm(null)}
        onNavigate={(target) => setView(target)}
        onSelectTransaction={(t) => {
          if (t.transferPairId) openTransferForm(t.transferPairId);
          else openTransactionForm(t);
        }}
      />

      <TransferForm
        visible={showTransferForm}
        mode={editingTransferPairId ? 'edit' : 'add'}
        pairId={editingTransferPairId}
        onClose={() => {
          setEditingTransferPairId(null);
          setShowTransferForm(false);
        }}
      />

      {isLocked && <LockScreen />}
    </SafeAreaView>
    </OnboardingProvider>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.paper },
    loaderRoot: {
      flex: 1,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 120 },
    fab: {
      position: 'absolute',
      right: 24,
      bottom: 32,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.rust,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.rust,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    menuRoot: { flex: 1, justifyContent: 'flex-end' },
    menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    menuSheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 34,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 14,
    },
    menuHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      marginTop: -8,
      marginBottom: 2,
    },
    menuHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 2,
    },
    menuTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 24,
      color: colors.ink,
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    menuIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chip,
    },
    menuCopy: { flex: 1, minWidth: 0 },
    menuOptionTitle: {
      fontFamily: fonts.bodySemibold,
      fontSize: 15,
      color: colors.ink,
    },
    menuOptionMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.stone500,
      marginTop: 2,
    },
  });

import { LockProvider, useLock } from './context/LockContext';

export default function BudgetApp() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Jost_300Light,
    Jost_400Regular,
    Jost_400Regular_Italic,
    Jost_500Medium,
    Jost_600SemiBold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LayoutProvider>
          <BudgetProvider>
            <LockProvider>
              <ErrorBoundary tag="root">
                <Layout />
              </ErrorBoundary>
            </LockProvider>
          </BudgetProvider>
        </LayoutProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
