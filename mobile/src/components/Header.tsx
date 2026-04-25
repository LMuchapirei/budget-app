import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Wallet, TrendingUp, PieChart as PieIcon, Settings, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { ViewTab } from '../types';
import { fonts } from '../theme';

interface HeaderProps {
  view: ViewTab;
  setView: (v: ViewTab) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Header({ view, setView }: HeaderProps) {
  const { colors } = useTheme();
  const { dateFilter, setDateFilter } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tabs: { id: ViewTab; label: string; Icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Ledger', Icon: Wallet },
    { id: 'projections', label: 'Projections', Icon: TrendingUp },
    { id: 'reports', label: 'Reports', Icon: PieIcon },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  const goToPrevMonth = () => {
    setDateFilter(
      dateFilter.month === 0
        ? { year: dateFilter.year - 1, month: 11 }
        : { year: dateFilter.year, month: dateFilter.month - 1 }
    );
  };

  const goToNextMonth = () => {
    const now = new Date();
    const isCurrentMonth =
      dateFilter.year === now.getFullYear() && dateFilter.month === now.getMonth();
    if (isCurrentMonth) return; // don't navigate into the future
    setDateFilter(
      dateFilter.month === 11
        ? { year: dateFilter.year + 1, month: 0 }
        : { year: dateFilter.year, month: dateFilter.month + 1 }
    );
  };

  const isCurrentMonth = (() => {
    const now = new Date();
    return dateFilter.year === now.getFullYear() && dateFilter.month === now.getMonth();
  })();

  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>
          The <Text style={styles.titleEm}>Budget</Text>
        </Text>

        {/* Date range navigator */}
        <View style={styles.datePicker}>
          <Pressable onPress={goToPrevMonth} hitSlop={10} style={styles.dateArrow}>
            <ChevronLeft size={14} color={colors.stone500} />
          </Pressable>
          <Text style={styles.dateLabel}>
            {MONTHS[dateFilter.month]} {dateFilter.year}
          </Text>
          <Pressable
            onPress={goToNextMonth}
            hitSlop={10}
            style={[styles.dateArrow, isCurrentMonth && { opacity: 0.25 }]}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={14} color={colors.stone500} />
          </Pressable>
        </View>
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
    datePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
    },
    dateArrow: {
      padding: 2,
    },
    dateLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      letterSpacing: 1,
      minWidth: 64,
      textAlign: 'center',
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
