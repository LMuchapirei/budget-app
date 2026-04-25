import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { StatCard } from '../components/ui/StatCard';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';

export function DashboardScreen() {
  const { colors } = useTheme();
  const { transactions, stats, customCategories } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const recent = transactions.slice(0, 8);

  const last30 = useMemo(() => {
    const days: { key: string; label: string; income: number; expenses: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayTx = transactions.filter((t) => t.date === key);
      const inc = dayTx
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0);
      const exp = dayTx
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0);
      days.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: inc,
        expenses: exp,
      });
    }
    return days;
  }, [transactions]);

  const chartW = width - 24 * 2 - 16 * 2;

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

      <Section title="Cash Flow" subtitle="Last 30 days">
        {transactions.length === 0 ? (
          <Empty msg="No transactions yet. Tap the + below to begin." />
        ) : (
          <View style={styles.card}>
            <AreaChart
              width={chartW}
              height={220}
              labels={last30.map((d) => d.label)}
              series={[
                {
                  color: colors.moss,
                  gradientId: 'gIn',
                  values: last30.map((d) => d.income),
                },
                {
                  color: colors.clay,
                  gradientId: 'gEx',
                  values: last30.map((d) => d.expenses),
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

      <Section title="Recent Entries" subtitle={`${transactions.length} total`}>
        {recent.length === 0 ? (
          <Empty msg="Your ledger awaits its first entry." />
        ) : (
          <View style={styles.list}>
            {recent.map((t, i) => (
              <TxRow
                key={t.id}
                t={t}
                isLast={i === recent.length - 1}
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
      backgroundColor: 'rgba(255,251,242,0.7)',
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
    list: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: 14,
    },
  });
