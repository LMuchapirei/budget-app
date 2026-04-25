import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { colorFor } from '../theme';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { Text } from 'react-native';
import { fonts } from '../theme';

export function ReportsScreen() {
  const { colors } = useTheme();
  const { transactions, customCategories, formatMoney } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const expenses = transactions.filter((t) => t.type === 'expense');

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byMonth = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number }> = {};
    transactions.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: key, income: 0, expenses: 0 };
      map[key][t.type === 'income' ? 'income' : 'expenses'] += Number(t.amount);
    });
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((m) => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('en-US', {
          month: 'short',
        }),
      }));
  }, [transactions]);

  const totalExpenses = byCategory.reduce((s, c) => s + c.value, 0);
  const chartW = width - 24 * 2 - 16 * 2;

  if (transactions.length === 0) {
    return <Empty msg="Add some transactions to see reports." />;
  }

  return (
    <View style={{ gap: 32 }}>
      <Section title="Spending by Category" subtitle={`${formatMoney(totalExpenses)} total`}>
        {byCategory.length === 0 ? (
          <Empty msg="No expenses recorded yet." />
        ) : (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <PieChart
                size={Math.min(chartW, 220)}
                data={byCategory.map((c) => ({
                  value: c.value,
                  color: colorFor(c.name, customCategories),
                }))}
              />
            </View>
            <View style={{ gap: 10 }}>
              {byCategory.map((c) => {
                const pct = (c.value / totalExpenses) * 100;
                return (
                  <View key={c.name} style={{ gap: 4 }}>
                    <View style={styles.legendRow}>
                      <View style={styles.legendLabelGroup}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: colorFor(c.name, customCategories) },
                          ]}
                        />
                        <Text style={styles.legendName}>{c.name}</Text>
                      </View>
                      <Text style={styles.legendValue}>
                        {formatMoney(c.value)}{' '}
                        <Text style={styles.legendPct}>· {pct.toFixed(1)}%</Text>
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: colorFor(c.name, customCategories),
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      <Section title="Monthly Comparison" subtitle="Last 6 months">
        <View style={styles.card}>
          <BarChart width={chartW} height={240} data={byMonth} />
          <View style={styles.legendWrapper}>
            <Legend color={colors.moss} label="Income" />
            <Legend color={colors.clay} label="Expenses" />
          </View>
        </View>
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
      marginTop: 12,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    legendLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendName: {
      fontFamily: fonts.display,
      fontSize: 13,
      color: colors.ink,
    },
    legendValue: {
      fontFamily: fonts.displayLight,
      fontSize: 13,
      color: colors.ink,
    },
    legendPct: { color: colors.stone400, fontSize: 11 },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2 },
  });
