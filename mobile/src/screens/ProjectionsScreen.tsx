import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { LineChart } from '../charts/LineChart';
import { Section, Empty } from '../components/ui/Layout';
import { fonts } from '../theme';

export function ProjectionsScreen() {
  const { colors } = useTheme();
  const { transactions, formatMoney } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const recurring = transactions.filter((t) => t.recurring);
  const monthlyRecurringIncome = recurring
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyRecurringExpense = recurring
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const netMonthly = monthlyRecurringIncome - monthlyRecurringExpense;

  const projection = useMemo(() => {
    const months: { label: string; cumulative: number }[] = [];
    let cumulative = 0;
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      cumulative += netMonthly;
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        cumulative,
      });
    }
    return months;
  }, [netMonthly]);

  const chartW = width - 24 * 2 - 16 * 2;
  const positive = netMonthly >= 0;

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.heroDark}>
        <Text style={styles.heroEyebrow}>A look ahead</Text>
        <Text style={styles.heroTitle}>
          {positive ? "You're saving " : "You're losing "}
          <Text
            style={[
              styles.heroEm,
              { color: positive ? '#9BC4A8' : '#D89992' },
            ]}
          >
            {formatMoney(Math.abs(netMonthly))}
          </Text>{' '}
          per month
        </Text>
        <Text style={styles.heroBody}>
          Based on {recurring.length} recurring{' '}
          {recurring.length === 1 ? 'item' : 'items'}. In a year, that's{' '}
          {formatMoney(Math.abs(netMonthly * 12))}.
        </Text>
      </View>

      <Section title="12-Month Projection" subtitle="Cumulative balance">
        {recurring.length === 0 ? (
          <Empty msg="Mark transactions as recurring to see projections here." />
        ) : (
          <View style={styles.card}>
            <LineChart
              width={chartW}
              height={240}
              values={projection.map((p) => p.cumulative)}
              labels={projection.map((p) => p.label)}
            />
          </View>
        )}
      </Section>

      <Section title="Recurring Items" subtitle={`${recurring.length} active`}>
        {recurring.length === 0 ? (
          <Empty msg="No recurring transactions yet." />
        ) : (
          <View style={{ gap: 10 }}>
            {recurring.map((t) => (
              <View key={t.id} style={styles.recurringCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurringTitle}>{t.description}</Text>
                  <Text style={styles.recurringMeta}>{t.category} · monthly</Text>
                </View>
                <Text
                  style={[
                    styles.recurringAmount,
                    { color: t.type === 'income' ? colors.moss : colors.clay },
                  ]}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {formatMoney(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    heroDark: {
      backgroundColor: 'rgba(44,36,22,0.97)',
      borderRadius: 22,
      padding: 28,
      gap: 6,
    },
    heroEyebrow: {
      fontFamily: fonts.displayItalic,
      color: colors.paper,
      opacity: 0.6,
      letterSpacing: 2,
      fontSize: 11,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    heroTitle: {
      fontFamily: fonts.displayLight,
      color: colors.paper,
      fontSize: 26,
      lineHeight: 32,
    },
    heroEm: { fontFamily: fonts.displayItalic },
    heroBody: {
      fontFamily: fonts.body,
      color: colors.paper,
      opacity: 0.7,
      fontSize: 13,
      marginTop: 6,
    },
    card: {
      backgroundColor: 'rgba(255,251,242,0.7)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
    },
    recurringCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cream,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
      gap: 12,
    },
    recurringTitle: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    recurringMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    recurringAmount: { fontFamily: fonts.displayLight, fontSize: 17 },
  });
