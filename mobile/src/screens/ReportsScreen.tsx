import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { AlertTriangle, ChevronRight, Filter, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../context/BudgetContext';
import { colorFor } from '../theme';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';
import type { CustomCategory, Transaction } from '../types';
import { createReportsStyles } from './reports/reportsStyles';

const MS_PER_DAY = 86400000;

function parseISO(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y || 1970, (m || 1) - 1, d || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatRangeLabel(startISO: string, endISO: string) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const startDayOne = start.getDate() === 1;
  const endIsLastOfMonth =
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  if (sameMonth && startDayOne && endIsLastOfMonth) {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' },
  )}`;
}

export function ReportsScreen() {
  const { colors } = useTheme();
  const {
    transactions,
    scopedTransactions,
    activeLedger,
    activeLedgerId,
    customCategories,
    budgetProgress,
    ledgers,
    dateFilter,
    reportingCurrency,
    formatReportingMoney,
    formatCompactMoney,
    convertTransactionAmountToReporting,
  } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createReportsStyles(colors), [colors]);
  const [drilldown, setDrilldown] = useState<string | null>(null);

  // Spending-by-category respects the active ledger AND the active date filter.
  const filteredExpenses = useMemo(() => {
    const start = parseISO(dateFilter.startDate);
    const end = parseISO(dateFilter.endDate);
    end.setHours(23, 59, 59, 999);
    return scopedTransactions.filter((t) => {
      if (t.type !== 'expense') return false;
      if (t.transferPairId) return false;
      const d = parseISO(t.date);
      return d >= start && d <= end;
    });
  }, [scopedTransactions, dateFilter]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((t) => {
      const amount =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(t).amount
          : Number(t.amount);
      map[t.category] = (map[t.category] || 0) + amount;
    });
    return Object.entries(map)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeLedgerId, convertTransactionAmountToReporting, filteredExpenses]);

  // Monthly comparison stays at 6 months regardless of the active period filter
  // (otherwise the comparison loses meaning), but still respects the active ledger.
  const byMonth = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number }> = {};
    scopedTransactions.forEach((t) => {
      if (t.transferPairId) return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: key, income: 0, expenses: 0 };
      const amount =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(t).amount
          : Number(t.amount);
      map[key][t.type === 'income' ? 'income' : 'expenses'] += amount;
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
  }, [activeLedgerId, convertTransactionAmountToReporting, scopedTransactions]);

  const drilldownTransactions = useMemo<Transaction[]>(() => {
    if (!drilldown) return [];
    return filteredExpenses
      .filter((t) => t.category === drilldown)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drilldown, filteredExpenses]);

  const drilldownTotal = useMemo(() => {
    return drilldownTransactions.reduce((sum, t) => {
      const amount =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(t).amount
          : Number(t.amount);
      return sum + amount;
    }, 0);
  }, [activeLedgerId, convertTransactionAmountToReporting, drilldownTransactions]);

  const totalExpenses = byCategory.reduce((s, c) => s + c.value, 0);
  const overBudget = useMemo(
    () =>
      budgetProgress
        .filter((progress) => progress.status === 'over')
        .sort((a, b) => b.percent - a.percent),
    [budgetProgress],
  );
  const chartW = width - 24 * 2 - 16 * 2;

  if (transactions.length === 0) {
    return <Empty msg="Add some transactions to see reports." />;
  }

  const scopeLabel = activeLedger?.name ?? 'All accounts';
  const periodLabel = formatRangeLabel(dateFilter.startDate, dateFilter.endDate);

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.scopeBar}>
        <Filter size={13} color={colors.stone500} />
        <Text style={styles.scopeText} numberOfLines={1}>
          {periodLabel} · {scopeLabel}
        </Text>
      </View>

      {overBudget.length > 0 ? (
        <Section
          title="Over Budget"
          subtitle={`${overBudget.length} ${overBudget.length === 1 ? 'category' : 'categories'} in ${reportingCurrency.code}`}
        >
          <View style={{ gap: 10 }}>
            {overBudget.map((progress) => {
              const ledger = progress.budget.ledgerId
                ? ledgers.find((item) => item.id === progress.budget.ledgerId)
                : null;
              const overBy = Math.max(0, progress.spent - progress.cap);
              const pct = Math.round(progress.percent * 100);
              return (
                <View key={progress.budget.id} style={styles.alertCard}>
                  <View style={styles.alertIcon}>
                    <AlertTriangle size={16} color={colors.clay} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.alertTitle}>{progress.budget.category}</Text>
                    <Text style={styles.alertMeta}>
                      {ledger?.name ?? 'All accounts'} - {pct}% used
                    </Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: colorFor(progress.budget.category, customCategories),
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.alertAmountGroup}>
                    <Text style={styles.alertAmount}>{formatReportingMoney(overBy)}</Text>
                    <Text style={styles.alertAmountLabel}>over</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      <Section
        title="Spending by Category"
        subtitle={`${formatReportingMoney(totalExpenses)} total in ${reportingCurrency.code}`}
      >
        {byCategory.length === 0 ? (
          <Empty msg="No expenses in this period." />
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
                  <Pressable
                    key={c.name}
                    onPress={() => setDrilldown(c.name)}
                    style={({ pressed }) => [
                      { gap: 4, paddingVertical: 4 },
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${c.name} transactions`}
                  >
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
                      <View style={styles.legendValueGroup}>
                        <Text style={styles.legendValue}>
                          {formatReportingMoney(c.value)}{' '}
                          <Text style={styles.legendPct}>· {pct.toFixed(1)}%</Text>
                        </Text>
                        <ChevronRight size={13} color={colors.stone400} />
                      </View>
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
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      <Section title="Monthly Comparison" subtitle={`Last 6 months in ${reportingCurrency.code}`}>
        <View style={styles.card}>
          <BarChart width={chartW} height={240} data={byMonth} formatTick={formatCompactMoney} />
          <View style={styles.legendWrapper}>
            <Legend color={colors.moss} label="Income" />
            <Legend color={colors.clay} label="Expenses" />
          </View>
        </View>
      </Section>

      <CategoryDrilldownSheet
        visible={drilldown !== null}
        categoryName={drilldown}
        transactions={drilldownTransactions}
        total={drilldownTotal}
        periodLabel={periodLabel}
        scopeLabel={scopeLabel}
        formatMoney={formatReportingMoney}
        customCategories={customCategories}
        onClose={() => setDrilldown(null)}
      />
    </View>
  );
}

function CategoryDrilldownSheet({
  visible,
  categoryName,
  transactions,
  total,
  periodLabel,
  scopeLabel,
  formatMoney,
  customCategories,
  onClose,
}: {
  visible: boolean;
  categoryName: string | null;
  transactions: Transaction[];
  total: number;
  periodLabel: string;
  scopeLabel: string;
  formatMoney: (n: number) => string;
  customCategories: CustomCategory[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createReportsStyles(colors), [colors]);
  const accent = categoryName ? colorFor(categoryName, customCategories) : colors.rust;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitleGroup}>
              <View style={[styles.drillDot, { backgroundColor: `${accent}26` }]}>
                <View style={[styles.drillDotInner, { backgroundColor: accent }]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle}>{categoryName ?? ''}</Text>
                <Text style={styles.sheetSubtitle}>
                  {transactions.length}{' '}
                  {transactions.length === 1 ? 'transaction' : 'transactions'} ·{' '}
                  {formatMoney(total)}
                </Text>
                <Text style={styles.sheetMeta} numberOfLines={1}>
                  {periodLabel} · {scopeLabel}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.drillScroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {transactions.length === 0 ? (
              <Empty msg="No transactions in this category." />
            ) : (
              <View style={styles.drillList}>
                {transactions.map((t, i) => (
                  <TxRow
                    key={t.id}
                    t={t}
                    isLast={i === transactions.length - 1}
                    customCategories={customCategories}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
