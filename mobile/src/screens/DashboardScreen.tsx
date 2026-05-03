import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
  ScrollView,
} from 'react-native';
import {
  Archive,
  CheckCircle2,
  CreditCard,
  Flag,
  Pencil,
  Plus,
  Target,
  X,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { MonthlySummary } from '../components/ui/MonthlySummary';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';
import { LedgerSheet } from '../components/forms/LedgerSheet';
import { BudgetSheet } from '../components/forms/BudgetSheet';
import { GoalSheet } from '../components/forms/GoalSheet';
import type {
  Budget,
  BudgetProgress,
  Goal,
  GoalProgress,
  LedgerAccount,
  Transaction,
  TxType,
  FxRateStatus,
} from '../types';
import { colorFor, fonts } from '../theme';

type EntryTab = 'all' | TxType;

interface DashboardScreenProps {
  onEditTransaction: (t: Transaction) => void;
}

const MS_PER_DAY = 86400000;

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatRateDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAllAccountsMeta(
  currencyCode: string,
  fxStatus: FxRateStatus,
  rateAsOf?: string,
  missingCurrencyCodes: string[] = [],
  fxError?: string | null,
) {
  if (fxStatus === 'loading') return `Updating ${currencyCode} rates - partial estimate`;
  if (missingCurrencyCodes.length > 0) {
    return `Partial estimate in ${currencyCode} - missing ${missingCurrencyCodes.join(', ')}`;
  }
  if (fxStatus === 'error') {
    return `Estimated in ${currencyCode} - rates unavailable${fxError ? ` (${fxError})` : ''}`;
  }
  const date = formatRateDate(rateAsOf);
  return `Estimated in ${currencyCode}${date ? ` - rates ${date}` : ''}`;
}

export function DashboardScreen({ onEditTransaction }: DashboardScreenProps) {
  const { colors } = useTheme();
  const {
    scopedTransactions,
    ledgers,
    activeLedgers,
    activeLedgerId,
    activeLedger,
    setActiveLedger,
    stats,
    customCategories,
    budgetProgress,
    goalProgress,
    markGoalComplete,
    dateFilter,
    reportingCurrency,
    fxRates,
    fxStatus,
    fxError,
    formatActiveMoney,
    formatReportingMoney,
    formatCompactMoney,
    convertAmountToReporting,
    convertTransactionAmountToReporting,
    getTransactionAmountForActiveView,
    maskAccountNumber,
  } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entryTab, setEntryTab] = useState<EntryTab>('all');
  const [ledgerSheet, setLedgerSheet] = useState<
    { mode: 'add' } | { mode: 'edit'; ledger: LedgerAccount } | null
  >(null);
  const [showArchivedSheet, setShowArchivedSheet] = useState(false);
  const [budgetSheet, setBudgetSheet] = useState<
    { mode: 'add' } | { mode: 'edit'; budget: Budget } | null
  >(null);
  const [goalSheet, setGoalSheet] = useState<
    { mode: 'add' } | { mode: 'edit'; goal: Goal } | null
  >(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);

  const visibleBudgets = useMemo(() => {
    if (activeLedgerId === ALL_LEDGER_ID) return budgetProgress;
    return budgetProgress.filter(
      (item) =>
        !item.budget.ledgerId || item.budget.ledgerId === activeLedgerId,
    );
  }, [budgetProgress, activeLedgerId]);

  const archivedLedgers = useMemo(
    () => ledgers.filter((l) => l.archived),
    [ledgers],
  );

  const activeGoalProgress = useMemo(
    () => goalProgress.filter((item) => item.goal.status !== 'completed'),
    [goalProgress],
  );

  const completedGoalProgress = useMemo(
    () => goalProgress.filter((item) => item.goal.status === 'completed'),
    [goalProgress],
  );

  // Transactions filtered to the active date range
  const monthlyTxs = useMemo(() => {
    const start = parseIsoDate(dateFilter.startDate);
    const end = parseIsoDate(dateFilter.endDate);
    end.setHours(23, 59, 59, 999);
    return scopedTransactions.filter((t) => {
      const d = parseIsoDate(t.date);
      return d >= start && d <= end;
    });
  }, [scopedTransactions, dateFilter]);

  // Chart data: cumulative totals across the selected range.
  // This avoids misleading spike/drop lines for one-off payday or bill dates.
  const chartDays = useMemo(() => {
    const startMs = parseIsoDate(dateFilter.startDate).getTime();
    const endMs = parseIsoDate(dateFilter.endDate).getTime();
    const days: { label: string; income: number; expenses: number }[] = [];
    const totalsByDate: Record<string, { income: number; expenses: number }> = {};

    monthlyTxs.forEach((t) => {
      if (!totalsByDate[t.date]) totalsByDate[t.date] = { income: 0, expenses: 0 };
      totalsByDate[t.date][t.type === 'income' ? 'income' : 'expenses'] +=
        getTransactionAmountForActiveView(t);
    });

    const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
    const step = Math.max(1, Math.ceil(totalDays / 30)); // max 30 data points
    let cumulativeIncome = 0;
    let cumulativeExpenses = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMs + i * MS_PER_DAY);
      const key = isoDate(d);
      const dayTotals = totalsByDate[key];
      if (dayTotals) {
        cumulativeIncome += dayTotals.income;
        cumulativeExpenses += dayTotals.expenses;
      }

      if (i % step !== 0 && i !== totalDays - 1) continue;

      days.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: cumulativeIncome,
        expenses: cumulativeExpenses,
      });
    }
    return days;
  }, [monthlyTxs, dateFilter, getTransactionAmountForActiveView]);

  // Filtered recent entries based on tab
  const filteredEntries = useMemo(() => {
    const base = monthlyTxs;
    if (entryTab === 'all') return base.slice(0, 20);
    return base.filter((t) => t.type === entryTab).slice(0, 20);
  }, [monthlyTxs, entryTab]);

  const ledgerStats = useMemo(() => {
    const missing = new Set<string>();
    const totals = scopedTransactions.reduce(
      (next, transaction) => {
        const conversion =
          activeLedgerId === ALL_LEDGER_ID
            ? convertTransactionAmountToReporting(transaction)
            : { amount: Number(transaction.amount), converted: true };

        if (!conversion.converted && conversion.missingCurrencyCode) {
          missing.add(conversion.missingCurrencyCode);
        }

        if (transaction.type === 'income') {
          next.income += conversion.amount;
        } else {
          next.expenses += conversion.amount;
        }
        return next;
      },
      { income: 0, expenses: 0 },
    );

    let openingTotal = 0;
    if (activeLedgerId === ALL_LEDGER_ID) {
      activeLedgers.forEach((l) => {
        const opening = Number(l.openingBalance ?? 0);
        if (!opening) return;
        const conv = convertAmountToReporting(opening, l.currencyCode);
        if (!conv.converted && conv.missingCurrencyCode) {
          missing.add(conv.missingCurrencyCode);
        }
        openingTotal += conv.amount;
      });
    } else if (activeLedger) {
      openingTotal = Number(activeLedger.openingBalance ?? 0);
    }

    return {
      income: totals.income,
      expenses: totals.expenses,
      balance: openingTotal + totals.income - totals.expenses,
      openingBalance: openingTotal,
      missingCurrencyCodes: Array.from(missing),
    };
  }, [
    activeLedger,
    activeLedgerId,
    activeLedgers,
    convertAmountToReporting,
    convertTransactionAmountToReporting,
    scopedTransactions,
  ]);

  // Prior period of equal length, immediately before the current dateFilter window.
  // Used for "vs last period" deltas in the monthly summary card.
  const prevStats = useMemo(() => {
    const start = parseIsoDate(dateFilter.startDate);
    const end = parseIsoDate(dateFilter.endDate);
    end.setHours(0, 0, 0, 0);
    const dayCount = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    const prevEnd = new Date(start.getTime() - MS_PER_DAY);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd.getTime() - (dayCount - 1) * MS_PER_DAY);
    prevStart.setHours(0, 0, 0, 0);

    let income = 0;
    let expenses = 0;
    scopedTransactions.forEach((t) => {
      const d = parseIsoDate(t.date);
      if (d < prevStart || d > prevEnd) return;
      const amount =
        activeLedgerId === ALL_LEDGER_ID
          ? convertTransactionAmountToReporting(t).amount
          : Number(t.amount);
      if (t.type === 'income') income += amount;
      else expenses += amount;
    });
    return { income, expenses, balance: income - expenses };
  }, [
    activeLedgerId,
    convertTransactionAmountToReporting,
    dateFilter,
    scopedTransactions,
  ]);

  // Daily cumulative net values for the summary sparkline (one point per day, capped at 60).
  const netSparkline = useMemo(() => {
    const startMs = parseIsoDate(dateFilter.startDate).getTime();
    const endMs = parseIsoDate(dateFilter.endDate).getTime();
    if (endMs < startMs) return [] as number[];

    const totalsByDate: Record<string, { income: number; expenses: number }> = {};
    monthlyTxs.forEach((t) => {
      if (!totalsByDate[t.date]) totalsByDate[t.date] = { income: 0, expenses: 0 };
      totalsByDate[t.date][t.type === 'income' ? 'income' : 'expenses'] +=
        getTransactionAmountForActiveView(t);
    });

    const totalDays = Math.round((endMs - startMs) / MS_PER_DAY) + 1;
    const step = Math.max(1, Math.ceil(totalDays / 60));
    const points: number[] = [];
    let cumulativeNet = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMs + i * MS_PER_DAY);
      const key = isoDate(d);
      const dayTotals = totalsByDate[key];
      if (dayTotals) {
        cumulativeNet += dayTotals.income - dayTotals.expenses;
      }
      if (i % step !== 0 && i !== totalDays - 1) continue;
      points.push(cumulativeNet);
    }
    return points;
  }, [monthlyTxs, dateFilter, getTransactionAmountForActiveView]);

  const summaryDeltas = useMemo(() => {
    const pct = (current: number, prev: number) => {
      if (!Number.isFinite(prev) || prev === 0) {
        return current === 0 ? 0 : null;
      }
      return ((current - prev) / Math.abs(prev)) * 100;
    };
    const savings = (income: number, expenses: number) =>
      income > 0 ? ((income - expenses) / income) * 100 : null;
    return {
      net: pct(stats.balance, prevStats.balance),
      income: pct(stats.income, prevStats.income),
      expenses: pct(stats.expenses, prevStats.expenses),
      savings: savings(stats.income, stats.expenses),
      prevSavings: savings(prevStats.income, prevStats.expenses),
    };
  }, [prevStats, stats]);

  const summaryCardWidth = width - 24 * 2;

  const summaryEyebrow = useMemo(() => {
    const start = parseIsoDate(dateFilter.startDate);
    const end = parseIsoDate(dateFilter.endDate);
    const sameMonth =
      start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    const startOfMonth =
      start.getDate() === 1 &&
      end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    if (sameMonth && startOfMonth) {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    return 'SELECTED PERIOD';
  }, [dateFilter]);

  const chartW = width - 24 * 2 - 16 * 2;
  const formatLedgerMoney = formatActiveMoney;
  const maskedAccountNumber = activeLedger ? maskAccountNumber(activeLedger.accountNumber) : '';
  const allAccountsMeta = activeLedger
    ? ''
    : getAllAccountsMeta(
        reportingCurrency.code,
        fxStatus,
        fxRates?.asOf,
        ledgerStats.missingCurrencyCodes,
        fxError,
      );

  const entryTabs: { id: EntryTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'expense', label: 'Expenses' },
    { id: 'income', label: 'Income' },
  ];

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.ledgerPanel}>
        <View style={styles.ledgerPanelHead}>
          <View style={styles.ledgerTitleGroup}>
            <Text style={styles.ledgerEyebrow}>
              {activeLedger ? 'Selected ledger' : 'All ledgers'}
            </Text>
            <Text style={styles.ledgerTitle}>
              {activeLedger?.name ?? 'All Accounts'}
            </Text>
            {activeLedger ? (
              <Text style={styles.ledgerAccountMeta}>
                {activeLedger.currencyCode} {maskedAccountNumber ? `- ${maskedAccountNumber}` : ''}
              </Text>
            ) : (
              <Text style={styles.ledgerAccountMeta}>{allAccountsMeta}</Text>
            )}
          </View>
          {activeLedger ? (
            <Pressable
              onPress={() => setLedgerSheet({ mode: 'edit', ledger: activeLedger })}
              style={styles.ledgerIcon}
              hitSlop={6}
              accessibilityLabel="Edit account"
            >
              <Pencil size={18} color={colors.rust} />
            </Pressable>
          ) : (
            <View style={styles.ledgerIcon}>
              <CreditCard size={20} color={colors.rust} />
            </View>
          )}
        </View>

        <View style={styles.ledgerBalanceRow}>
          <View>
            <Text style={styles.ledgerMetricLabel}>Balance</Text>
            <Text
              style={[
                styles.ledgerBalance,
                { color: ledgerStats.balance >= 0 ? colors.ink : colors.clay },
              ]}
            >
              {ledgerStats.balance < 0 ? '-' : ''}
              {formatLedgerMoney(ledgerStats.balance)}
            </Text>
          </View>
          <View style={styles.ledgerPair}>
            <View>
              <Text style={styles.ledgerMetricLabel}>Income</Text>
              <Text style={[styles.ledgerMetric, { color: colors.moss }]}>
                {formatLedgerMoney(ledgerStats.income)}
              </Text>
            </View>
            <View>
              <Text style={styles.ledgerMetricLabel}>Expenses</Text>
              <Text style={[styles.ledgerMetric, { color: colors.clay }]}>
                {formatLedgerMoney(ledgerStats.expenses)}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ledgerChips}
        >
          <LedgerChip
            label="All Accounts"
            active={activeLedgerId === ALL_LEDGER_ID}
            onPress={() => setActiveLedger(ALL_LEDGER_ID)}
          />
          {activeLedgers.map((ledger) => (
            <LedgerChip
              key={ledger.id}
              label={ledger.name}
              active={activeLedgerId === ledger.id}
              color={ledger.color}
              onPress={() => setActiveLedger(ledger.id)}
              onLongPress={() => setLedgerSheet({ mode: 'edit', ledger })}
            />
          ))}
          <Pressable
            onPress={() => setLedgerSheet({ mode: 'add' })}
            style={styles.addLedgerChip}
          >
            <Plus size={14} color={colors.rust} />
            <Text style={styles.addLedgerLabel}>Account</Text>
          </Pressable>
          {archivedLedgers.length > 0 ? (
            <Pressable
              onPress={() => setShowArchivedSheet(true)}
              style={styles.archivedChip}
            >
              <Archive size={13} color={colors.stone500} />
              <Text style={styles.archivedChipLabel}>
                {archivedLedgers.length} archived
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <MonthlySummary
        eyebrow={summaryEyebrow}
        netLabel="Net for the period"
        netValue={formatActiveMoney(Math.abs(stats.balance))}
        netRaw={stats.balance}
        netDeltaPct={summaryDeltas.net}
        income={stats.income}
        incomeDeltaPct={summaryDeltas.income}
        expenses={stats.expenses}
        expensesDeltaPct={summaryDeltas.expenses}
        savingsRatePct={summaryDeltas.savings}
        prevSavingsRatePct={summaryDeltas.prevSavings}
        formatMoney={formatActiveMoney}
        sparklineValues={netSparkline}
        cardWidth={summaryCardWidth}
      />

      <Section title="Cash Flow" subtitle="Cumulative">
        {monthlyTxs.length === 0 ? (
          <Empty msg="No transactions yet. Tap the + below to begin." />
        ) : (
          <View style={styles.card}>
            <AreaChart
              width={chartW}
              height={220}
              labels={chartDays.map((d) => d.label)}
              formatTick={formatCompactMoney}
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
        title="Budgets"
        subtitle={
          visibleBudgets.length > 0
            ? `${visibleBudgets.length} active`
            : 'this month'
        }
      >
        {visibleBudgets.length === 0 ? (
          <Pressable
            onPress={() => setBudgetSheet({ mode: 'add' })}
            style={styles.budgetEmpty}
          >
            <Target size={20} color={colors.rust} />
            <Text style={styles.budgetEmptyTitle}>Set your first budget</Text>
            <Text style={styles.budgetEmptyCopy}>
              Cap monthly spending per category and watch your progress.
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            {visibleBudgets.map((progress) => (
              <BudgetProgressCard
                key={progress.budget.id}
                progress={progress}
                ledgers={ledgers}
                onPress={() =>
                  setBudgetSheet({ mode: 'edit', budget: progress.budget })
                }
                formatMoney={formatReportingMoney}
                customCategories={customCategories}
              />
            ))}
            <Pressable
              onPress={() => setBudgetSheet({ mode: 'add' })}
              style={styles.budgetAddRow}
            >
              <Plus size={14} color={colors.rust} />
              <Text style={styles.budgetAddLabel}>Add a budget</Text>
            </Pressable>
          </View>
        )}
      </Section>

      <Section
        title="Goals"
        subtitle={
          activeGoalProgress.length > 0
            ? `${activeGoalProgress.length} tracking`
            : 'savings targets'
        }
      >
        {activeGoalProgress.length === 0 ? (
          <Pressable
            onPress={() => setGoalSheet({ mode: 'add' })}
            style={styles.goalEmpty}
          >
            <Flag size={20} color={colors.rust} />
            <Text style={styles.budgetEmptyTitle}>Create a savings goal</Text>
            <Text style={styles.budgetEmptyCopy}>
              Link a savings account and track progress automatically.
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            {activeGoalProgress.map((progress) => (
              <GoalProgressCard
                key={progress.goal.id}
                progress={progress}
                onPress={() => setGoalSheet({ mode: 'edit', goal: progress.goal })}
                onMarkComplete={() => markGoalComplete(progress.goal.id)}
              />
            ))}
            <Pressable
              onPress={() => setGoalSheet({ mode: 'add' })}
              style={styles.budgetAddRow}
            >
              <Plus size={14} color={colors.rust} />
              <Text style={styles.budgetAddLabel}>Add a goal</Text>
            </Pressable>
          </View>
        )}
        {completedGoalProgress.length > 0 ? (
          <Pressable
            onPress={() => setShowCompletedGoals(true)}
            style={styles.completedGoalsFooter}
          >
            <CheckCircle2 size={14} color={colors.stone500} />
            <Text style={styles.completedGoalsFooterLabel}>
              {completedGoalProgress.length} completed
            </Text>
          </Pressable>
        ) : null}
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
              <View key={t.id}>
                <TxRow
                  t={t}
                  isLast={i === filteredEntries.length - 1}
                  customCategories={customCategories}
                  onEdit={onEditTransaction}
                />
              </View>
            ))}
          </View>
        )}
      </Section>

      <LedgerSheet
        visible={ledgerSheet !== null}
        mode={ledgerSheet?.mode ?? 'add'}
        ledger={ledgerSheet?.mode === 'edit' ? ledgerSheet.ledger : null}
        onClose={() => setLedgerSheet(null)}
      />

      <BudgetSheet
        visible={budgetSheet !== null}
        mode={budgetSheet?.mode ?? 'add'}
        budget={budgetSheet?.mode === 'edit' ? budgetSheet.budget : null}
        onClose={() => setBudgetSheet(null)}
      />

      <GoalSheet
        visible={goalSheet !== null}
        mode={goalSheet?.mode ?? 'add'}
        goal={goalSheet?.mode === 'edit' ? goalSheet.goal : null}
        onClose={() => setGoalSheet(null)}
      />

      <ArchivedLedgersSheet
        visible={showArchivedSheet}
        ledgers={archivedLedgers}
        onClose={() => setShowArchivedSheet(false)}
        onPick={(ledger) => {
          setShowArchivedSheet(false);
          setLedgerSheet({ mode: 'edit', ledger });
        }}
      />

      <CompletedGoalsSheet
        visible={showCompletedGoals}
        goals={completedGoalProgress}
        onClose={() => setShowCompletedGoals(false)}
        onPick={(goal) => {
          setShowCompletedGoals(false);
          setGoalSheet({ mode: 'edit', goal });
        }}
      />
    </View>
  );
}

function ArchivedLedgersSheet({
  visible,
  ledgers,
  onClose,
  onPick,
}: {
  visible: boolean;
  ledgers: LedgerAccount[];
  onClose: () => void;
  onPick: (ledger: LedgerAccount) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Archived accounts</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          {ledgers.length === 0 ? (
            <Text style={styles.archivedEmpty}>No archived accounts.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {ledgers.map((ledger) => (
                <Pressable
                  key={ledger.id}
                  onPress={() => onPick(ledger)}
                  style={styles.archivedRow}
                >
                  <View
                    style={[
                      styles.ledgerChipDot,
                      { backgroundColor: ledger.color || colors.rust },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archivedRowName}>{ledger.name}</Text>
                    <Text style={styles.archivedRowMeta}>
                      {ledger.currencyCode}
                      {ledger.description ? ` - ${ledger.description}` : ''}
                    </Text>
                  </View>
                  <Pencil size={14} color={colors.stone500} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function BudgetProgressCard({
  progress,
  ledgers,
  onPress,
  formatMoney,
  customCategories,
}: {
  progress: BudgetProgress;
  ledgers: LedgerAccount[];
  onPress: () => void;
  formatMoney: (n: number) => string;
  customCategories: { title: string; color: string }[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { budget, spent, cap, percent, status, missingCurrencyCodes, carryOverAmount } = progress;
  const ledger = budget.ledgerId
    ? ledgers.find((l) => l.id === budget.ledgerId)
    : null;
  const accent =
    status === 'over' ? colors.clay : status === 'warning' ? colors.rust : colors.moss;
  const fillWidth = `${Math.min(100, Math.max(percent * 100, 0))}%` as any;
  const remaining = cap - spent;

  return (
    <Pressable onPress={onPress} style={styles.budgetCard}>
      <View style={styles.budgetCardHead}>
        <View style={styles.budgetCardTitleGroup}>
          <View
            style={[
              styles.budgetCategoryDot,
              { backgroundColor: colorFor(budget.category, customCategories as any) },
            ]}
          />
          <Text style={styles.budgetCardTitle}>{budget.category}</Text>
          {ledger ? (
            <View style={[styles.budgetLedgerPill, { borderColor: ledger.color || colors.borderSoft }]}>
              <Text style={styles.budgetLedgerPillLabel}>{ledger.name}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.budgetStatusLabel,
            { color: accent },
          ]}
        >
          {status === 'over'
            ? 'Over'
            : status === 'warning'
            ? `${Math.round(percent * 100)}%`
            : `${Math.round(percent * 100)}%`}
        </Text>
      </View>

      <View style={styles.budgetBarTrack}>
        <View
          style={[
            styles.budgetBarFill,
            { width: fillWidth, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={styles.budgetMetaRow}>
        <Text style={styles.budgetMetaPrimary}>
          {formatMoney(spent)} of {formatMoney(cap)}
        </Text>
        <Text
          style={[
            styles.budgetMetaSecondary,
            { color: remaining < 0 ? colors.clay : colors.stone500 },
          ]}
        >
          {remaining < 0
            ? `Over by ${formatMoney(Math.abs(remaining))}`
            : `${formatMoney(Math.max(remaining, 0))} left`}
        </Text>
      </View>

      {budget.carryOver && Math.abs(carryOverAmount) > 0.005 ? (
        <Text
          style={[
            styles.budgetWarning,
            { color: carryOverAmount < 0 ? colors.clay : colors.stone500 },
          ]}
        >
          Carry-over {carryOverAmount >= 0 ? '+' : '-'}
          {formatMoney(Math.abs(carryOverAmount))}
        </Text>
      ) : null}

      {missingCurrencyCodes.length > 0 ? (
        <Text style={styles.budgetWarning}>
          Estimate: missing rates for {missingCurrencyCodes.join(', ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatGoalMoney(value: number, symbol: string) {
  return `${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function goalPacingLabel(progress: GoalProgress) {
  if (progress.pacing === 'complete') return 'Ready';
  if (progress.pacing === 'paused') return 'Paused';
  if (progress.pacing === 'behind') return 'Behind';
  if (progress.pacing === 'ahead') return 'Ahead';
  if (progress.pacing === 'on-track') return 'On track';
  return 'No deadline';
}

function deadlineLabel(progress: GoalProgress) {
  if (progress.pacing === 'complete') return 'Target reached';
  if (progress.goal.status === 'paused') return 'Paused';
  if (progress.daysRemaining == null) return 'No deadline';
  if (progress.daysRemaining < 0) return 'Deadline passed';
  if (progress.daysRemaining === 0) return 'Due today';
  return `${progress.daysRemaining} days left`;
}

function GoalProgressCard({
  progress,
  onPress,
  onMarkComplete,
}: {
  progress: GoalProgress;
  onPress: () => void;
  onMarkComplete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { goal, saved, remaining, percent, pacing, suggestedMonthly } = progress;
  const completeReady = pacing === 'complete' && goal.status === 'active';
  const fillWidth = `${Math.min(100, Math.max(percent * 100, 0))}%` as any;
  const accent =
    pacing === 'behind'
      ? colors.clay
      : pacing === 'paused'
      ? colors.stone500
      : pacing === 'complete'
      ? colors.rust
      : colors.moss;

  return (
    <Pressable onPress={onPress} style={styles.goalCard}>
      <View style={styles.goalHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.goalTitle} numberOfLines={2}>
            {goal.name}
          </Text>
          <View style={styles.goalMetaRow}>
            <View style={[styles.goalStatusPill, { borderColor: accent }]}>
              <Text style={[styles.goalStatusLabel, { color: accent }]}>
                {goalPacingLabel(progress)}
              </Text>
            </View>
            <Text style={styles.goalLedgerText} numberOfLines={1}>
              {progress.linkedLedgerName ?? 'Link an account'}
            </Text>
          </View>
        </View>
        <Text style={[styles.goalPercent, { color: accent }]}>
          {Math.round(Math.max(percent, 0) * 100)}%
        </Text>
      </View>

      <View style={styles.budgetBarTrack}>
        <View
          style={[
            styles.budgetBarFill,
            { width: fillWidth, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={styles.goalAmountRow}>
        <Text style={styles.budgetMetaPrimary}>
          {formatGoalMoney(saved, progress.currencySymbol)} of{' '}
          {formatGoalMoney(goal.targetAmount, progress.currencySymbol)}
        </Text>
        <Text
          style={[
            styles.budgetMetaSecondary,
            { color: remaining <= 0 ? colors.rust : colors.stone500 },
          ]}
        >
          {remaining <= 0
            ? 'Ready to complete'
            : `${formatGoalMoney(remaining, progress.currencySymbol)} left`}
        </Text>
      </View>

      <View style={styles.goalDetailRow}>
        <Text style={styles.goalDetailText}>{deadlineLabel(progress)}</Text>
        {suggestedMonthly > 0 ? (
          <Text style={styles.goalDetailText}>
            {formatGoalMoney(suggestedMonthly, progress.currencySymbol)} / month
          </Text>
        ) : null}
      </View>

      {progress.linkedLedgerArchived ? (
        <Text style={styles.budgetWarning}>Linked account archived.</Text>
      ) : null}
      {!goal.ledgerId ? (
        <Text style={styles.budgetWarning}>Link an account to start tracking.</Text>
      ) : null}
      {progress.currencyMismatch ? (
        <Text style={[styles.budgetWarning, { color: colors.clay }]}>
          Account currency changed. Re-edit this goal.
        </Text>
      ) : null}

      {completeReady ? (
        <Pressable
          onPress={(event: any) => {
            event?.stopPropagation?.();
            onMarkComplete();
          }}
          style={styles.goalCompleteButton}
        >
          <CheckCircle2 size={14} color={colors.paper} />
          <Text style={styles.goalCompleteButtonLabel}>Mark complete</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function CompletedGoalsSheet({
  visible,
  goals,
  onClose,
  onPick,
}: {
  visible: boolean;
  goals: GoalProgress[];
  onClose: () => void;
  onPick: (goal: Goal) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Completed goals</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          {goals.length === 0 ? (
            <Text style={styles.archivedEmpty}>No completed goals yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {goals.map((progress) => (
                <Pressable
                  key={progress.goal.id}
                  onPress={() => onPick(progress.goal)}
                  style={styles.completedGoalRow}
                >
                  <CheckCircle2 size={16} color={colors.rust} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.archivedRowName}>{progress.goal.name}</Text>
                    <Text style={styles.archivedRowMeta}>
                      {formatGoalMoney(progress.saved, progress.currencySymbol)} saved
                      {progress.goal.completedAt
                        ? ` - completed ${new Date(progress.goal.completedAt).toLocaleDateString()}`
                        : ''}
                    </Text>
                  </View>
                  <Pencil size={14} color={colors.stone500} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function LedgerChip({
  label,
  active,
  color,
  onPress,
  onLongPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.ledgerChip, active && { backgroundColor: colors.ink }]}
    >
      <View
        style={[
          styles.ledgerChipDot,
          { backgroundColor: active ? colors.paper : color ?? colors.rust },
        ]}
      />
      <Text style={[styles.ledgerChipLabel, active && { color: colors.paper }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    ledgerPanel: {
      backgroundColor: colors.cream,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 18,
      gap: 18,
    },
    ledgerPanelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    ledgerTitleGroup: {
      flex: 1,
      minWidth: 0,
    },
    ledgerEyebrow: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    ledgerTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 28,
      color: colors.ink,
      marginTop: 2,
    },
    ledgerAccountMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 3,
    },
    ledgerIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ledgerBalanceRow: {
      gap: 16,
    },
    ledgerMetricLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.stone500,
      marginBottom: 4,
    },
    ledgerBalance: {
      fontFamily: fonts.displayLight,
      fontSize: 34,
    },
    ledgerPair: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    ledgerMetric: {
      fontFamily: fonts.displayLight,
      fontSize: 20,
    },
    ledgerChips: {
      gap: 8,
      paddingRight: 8,
    },
    ledgerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    ledgerChipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    ledgerChipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
    },
    addLedgerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
    },
    addLedgerLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.rust,
    },
    archivedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    archivedChipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.stone500,
    },
    archivedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    archivedRowName: {
      fontFamily: fonts.displayLight,
      fontSize: 16,
      color: colors.ink,
    },
    archivedRowMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    archivedEmpty: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone500,
      textAlign: 'center',
      paddingVertical: 16,
    },
    budgetEmpty: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
      padding: 18,
      gap: 6,
      alignItems: 'flex-start',
    },
    budgetEmptyTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
      color: colors.ink,
      marginTop: 4,
    },
    budgetEmptyCopy: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
    },
    budgetAddRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
      alignSelf: 'flex-start',
    },
    budgetAddLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.rust,
    },
    budgetCard: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
      gap: 10,
    },
    budgetCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    budgetCardTitleGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    budgetCategoryDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    budgetCardTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 16,
      color: colors.ink,
    },
    budgetLedgerPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    budgetLedgerPillLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.stone600,
    },
    budgetStatusLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.5,
    },
    budgetBarTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.chip,
      overflow: 'hidden',
    },
    budgetBarFill: {
      height: '100%',
      borderRadius: 999,
    },
    budgetMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    budgetMetaPrimary: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    budgetMetaSecondary: {
      fontFamily: fonts.body,
      fontSize: 11,
    },
    budgetWarning: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      fontStyle: 'italic',
    },
    goalEmpty: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
      padding: 18,
      gap: 6,
      alignItems: 'flex-start',
    },
    goalCard: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
      gap: 10,
    },
    goalHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    goalTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 17,
      color: colors.ink,
      lineHeight: 22,
    },
    goalMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    goalStatusPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    goalStatusLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    goalLedgerText: {
      flexShrink: 1,
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    goalPercent: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
    },
    goalAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    goalDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    goalDetailText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    goalCompleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.rust,
      marginTop: 2,
    },
    goalCompleteButtonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.paper,
    },
    completedGoalsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    completedGoalsFooterLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.stone500,
    },
    completedGoalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
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
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 18,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      marginTop: -8,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
  });
