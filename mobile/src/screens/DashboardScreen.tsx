import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { StatCard } from '../components/ui/StatCard';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';
import { TxType } from '../types';
import { fonts } from '../theme';

type EntryTab = 'all' | TxType;

export function DashboardScreen() {
  const { colors } = useTheme();
  const { transactions, stats, customCategories, dateFilter } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entryTab, setEntryTab] = useState<EntryTab>('all');

  // Transactions filtered to the active date range
  const monthlyTxs = useMemo(() => {
    const start = new Date(dateFilter.startDate);
    const end = new Date(dateFilter.endDate);
    end.setHours(23, 59, 59, 999);
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  }, [transactions, dateFilter]);

  // Chart data: one entry per day across the selected range
  const chartDays = useMemo(() => {
    const startMs = new Date(dateFilter.startDate).getTime();
    const endMs = new Date(dateFilter.endDate).getTime();
    const days: { label: string; income: number; expenses: number }[] = [];
    const msPerDay = 86400000;
    const totalDays = Math.round((endMs - startMs) / msPerDay) + 1;
    const step = Math.max(1, Math.ceil(totalDays / 30)); // max 30 data points
    for (let i = 0; i < totalDays; i++) {
      if (i % step !== 0 && i !== totalDays - 1) continue;
      const d = new Date(startMs + i * msPerDay);
      const key = d.toISOString().split('T')[0];
      const dayTx = transactions.filter((t) => t.date === key);
      const inc = dayTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      days.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: inc,
        expenses: exp,
      });
    }
    return days;
  }, [transactions, dateFilter]);

  // Filtered recent entries based on tab
  const filteredEntries = useMemo(() => {
    const base = monthlyTxs;
    if (entryTab === 'all') return base.slice(0, 20);
    return base.filter((t) => t.type === entryTab).slice(0, 20);
  }, [monthlyTxs, entryTab]);

  const chartW = width - 24 * 2 - 16 * 2;

  const entryTabs: { id: EntryTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'expense', label: 'Expenses' },
    { id: 'income', label: 'Income' },
  ];

  return (
    <View style={{ gap: 32 }}>
      <View style={{ gap: 12 }}>
        <StatCard
          label="Income this month"
          rawValue={stats.income}
          value={stats.income.toFixed(2)}
          color={colors.moss}
          Icon={TrendingUp}
          accent="i."
        />
        <StatCard
          label="Expenses this month"
          rawValue={stats.expenses}
          value={stats.expenses.toFixed(2)}
          color={colors.clay}
          Icon={TrendingDown}
          accent="ii."
        />
        <StatCard
          label="Net balance"
          rawValue={stats.balance}
          value={Math.abs(stats.balance).toFixed(2)}
          color={stats.balance >= 0 ? colors.ink : colors.clay}
          Icon={Wallet}
          accent="iii."
          signed
        />
      </View>

      <Section title="Cash Flow" subtitle={`${chartDays.length} data points`}>
        {monthlyTxs.length === 0 ? (
          <Empty msg="No transactions yet. Tap the + below to begin." />
        ) : (
          <View style={styles.card}>
            <AreaChart
              width={chartW}
              height={220}
              labels={chartDays.map((d) => d.label)}
              series={[
                {
                  color: colors.moss,
                  gradientId: 'gIn',
                  values: chartDays.map((d) => d.income),
                },
                {
                  color: colors.clay,
                  gradientId: 'gEx',
                  values: chartDays.map((d) => d.expenses),
                },
              ]}
            />
            <View style={styles.legendWrapper}>
              <Legend color={colors.moss} label="Income" />
              <Legend color={colors.clay} label="Expenses" />
            </View>
          </View>
        )}
      </Section>

      <Section
        title="Recent Entries"
        subtitle={`${filteredEntries.length} shown`}
      >
        {/* Type filter tabs */}
        <View style={styles.entryTabs}>
          {entryTabs.map(({ id, label }) => {
            const active = entryTab === id;
            const activeBg =
              id === 'expense' ? colors.clay : id === 'income' ? colors.moss : colors.ink;
            return (
              <Pressable
                key={id}
                onPress={() => setEntryTab(id)}
                style={[
                  styles.entryTab,
                  active && { backgroundColor: activeBg },
                ]}
              >
                <Text
                  style={[
                    styles.entryTabLabel,
                    { color: active ? colors.paper : colors.inkSoft },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredEntries.length === 0 ? (
          <Empty msg="No entries for this period." />
        ) : (
          <View style={styles.list}>
            {filteredEntries.map((t, i) => (
              <TxRow
                key={t.id}
                t={t}
                isLast={i === filteredEntries.length - 1}
                customCategories={customCategories}
              />
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.cream,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
    },
    legendWrapper: {
      flexDirection: 'row',
      gap: 18,
      justifyContent: 'center',
      marginTop: 8,
    },
    entryTabs: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
      padding: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    entryTab: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 999,
    },
    entryTabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
    list: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: 14,
    },
  });
