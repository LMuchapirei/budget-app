import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Wallet, TrendingUp, PieChart as PieIcon, Settings, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ViewTab } from '../types';
import { fonts } from '../theme';

interface HeaderProps {
  view: ViewTab;
  setView: (v: ViewTab) => void;
}

export function Header({ view, setView }: HeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tabs: { id: ViewTab; label: string; Icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Ledger', Icon: Wallet },
    { id: 'projections', label: 'Projections', Icon: TrendingUp },
    { id: 'reports', label: 'Reports', Icon: PieIcon },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>
          The <Text style={styles.titleEm}>Budget</Text>
        </Text>
        <Text style={styles.dateLabel}>
          {new Date()
            .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            .toUpperCase()}
        </Text>
      </View>
      <View style={styles.rule} />
      <Text style={styles.subtitle}>
        For your finances — a quiet place to keep score.
      </Text>

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          <View style={styles.tabs}>
            {tabs.map(({ id, label, Icon }) => {
              const active = view === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setView(id)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Icon size={14} color={active ? colors.paper : colors.inkSoft} />
                  <Text style={[styles.tabLabel, active && { color: colors.paper }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    header: { paddingTop: 16, paddingBottom: 24, gap: 8 },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: fonts.displayLight,
      fontSize: 44,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    titleEm: {
      fontFamily: fonts.displayItalic,
      color: colors.rust,
    },
    dateLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone500,
      letterSpacing: 2,
      marginBottom: 8,
    },
    rule: {
      height: 1,
      backgroundColor: 'transparent',
      borderTopWidth: 1,
      borderTopColor: colors.rust,
      borderStyle: 'dashed',
      marginVertical: 8,
      opacity: 0.5,
    },
    subtitle: {
      fontFamily: fonts.displayItalic,
      fontSize: 16,
      color: colors.stone500,
      marginBottom: 20,
    },
    tabsWrapper: {
      marginHorizontal: -24,
      paddingHorizontal: 24,
    },
    tabs: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    tabActive: { backgroundColor: colors.ink },
    tabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
  });
