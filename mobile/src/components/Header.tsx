import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import {
  Wallet, Bell, TrendingUp, PieChart as PieIcon, Settings,
  ChevronLeft, ChevronRight, Search, type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { DateRangeSheet } from './forms/DateRangeSheet';
import { ViewTab } from '../types';
import { fonts } from '../theme';

interface HeaderProps {
  view: ViewTab;
  setView: (v: ViewTab) => void;
  onOpenSearch?: () => void;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isoToDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export function Header({ view, setView, onOpenSearch }: HeaderProps) {
  const { colors } = useTheme();
  const { dateFilter, setDateFilter } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const tabs: { id: ViewTab; label: string; Icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Ledger', Icon: Wallet },
    { id: 'bills', label: 'Bills', Icon: Bell },
    { id: 'projections', label: 'Projections', Icon: TrendingUp },
    { id: 'reports', label: 'Reports', Icon: PieIcon },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  // Prev month: shift the whole range one month back
  const goToPrevMonth = () => {
    const start = isoToDate(dateFilter.startDate);
    start.setMonth(start.getMonth() - 1);
    const newStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const newEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    setDateFilter({ startDate: isoDate(newStart), endDate: isoDate(newEnd) });
  };

  // Next month: shift forward, capped at today
  const goToNextMonth = () => {
    const today = new Date();
    const start = isoToDate(dateFilter.startDate);
    start.setMonth(start.getMonth() + 1);
    if (start > today) return;
    const newStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const newEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const cappedEnd = newEnd > today ? today : newEnd;
    setDateFilter({ startDate: isoDate(newStart), endDate: isoDate(cappedEnd) });
  };

  const isCurrentMonth = (() => {
    const today = new Date();
    const start = isoToDate(dateFilter.startDate);
    return start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();
  })();

  // Format the date label
  const dateLabel = (() => {
    const s = isoToDate(dateFilter.startDate);
    const e = isoToDate(dateFilter.endDate);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      return `${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${MONTHS_SHORT[s.getMonth()]} – ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  })();

  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>
          The <Text style={styles.titleEm}>Budget</Text>
        </Text>
        {onOpenSearch ? (
          <Pressable
            onPress={onOpenSearch}
            hitSlop={10}
            style={styles.searchButton}
            accessibilityLabel="Search and quick actions"
            accessibilityRole="button"
          >
            <Search size={18} color={colors.rust} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.rule} />

      {/* Date range navigator — its own row */}
      <View style={styles.dateRow}>
        <Pressable onPress={goToPrevMonth} hitSlop={10} style={styles.dateArrow}>
          <ChevronLeft size={14} color={colors.stone500} />
        </Pressable>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </Pressable>
        <Pressable
          onPress={goToNextMonth}
          hitSlop={10}
          style={[styles.dateArrow, isCurrentMonth && { opacity: 0.25 }]}
          disabled={isCurrentMonth}
        >
          <ChevronRight size={14} color={colors.stone500} />
        </Pressable>
      </View>
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

      <DateRangeSheet
        visible={showDatePicker}
        current={dateFilter}
        onApply={(f) => setDateFilter(f)}
        onClose={() => setShowDatePicker(false)}
      />
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
    searchButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      marginBottom: 6,
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
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 2,
      backgroundColor: colors.chip,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginTop: -4,
    },
    dateArrow: { padding: 3 },
    dateLabelWrap: {
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    dateLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      letterSpacing: 0.8,
      minWidth: 72,
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
