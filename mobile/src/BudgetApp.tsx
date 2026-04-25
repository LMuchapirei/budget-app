import React, { useState, useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native';
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
import { Plus } from 'lucide-react-native';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { BudgetProvider, useBudget } from './context/BudgetContext';
import { ViewTab } from './types';
import { colors as fallbackColors } from './theme';

import { Header } from './components/Header';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectionsScreen } from './screens/ProjectionsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TransactionForm } from './components/forms/TransactionForm';
import { Modal } from 'react-native';

function Layout() {
  const { colors, theme } = useTheme();
  const { loading } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [view, setView] = useState<ViewTab>('dashboard');
  const [showForm, setShowForm] = useState(false);

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderRoot}>
        <ActivityIndicator color={colors.rust} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Header view={view} setView={setView} />
        {view === 'dashboard' && <DashboardScreen />}
        {view === 'projections' && <ProjectionsScreen />}
        {view === 'reports' && <ReportsScreen />}
        {view === 'settings' && <SettingsScreen />}
      </ScrollView>

      {view !== 'settings' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          onPress={() => setShowForm(true)}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Plus size={28} color="#fff" strokeWidth={2} />
        </Pressable>
      )}

      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <TransactionForm onClose={() => setShowForm(false)} />
      </Modal>
    </SafeAreaView>
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
  });

export default function BudgetApp() {
  const [fontsLoaded] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <BudgetProvider>
        <Layout />
      </BudgetProvider>
    </ThemeProvider>
  );
}
