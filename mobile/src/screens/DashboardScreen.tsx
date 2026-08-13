import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Archive,
  CheckCircle2,
  CreditCard,
  Flag,
  Pencil,
  Plus,
  Target,
} from 'lucide-react-native';
import { ALL_LEDGER_ID, useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { MonthlySummary } from '../components/ui/MonthlySummary';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { LedgerSheet } from '../components/forms/LedgerSheet';
import { BudgetSheet } from '../components/forms/BudgetSheet';
import { GoalSheet } from '../components/forms/GoalSheet';
import type { Budget, Goal, LedgerAccount, Transaction } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  ArchivedLedgersSheet,
  BudgetProgressCard,
  CompletedGoalsSheet,
  GoalProgressCard,
  LedgerChip,
} from './dashboard/DashboardWidgets';
import { RecentEntriesSection } from './dashboard/RecentEntriesSection';
import {
  buildCumulativeChartDays,
  buildLedgerStats,
  buildNetSparkline,
  buildPreviousPeriodStats,
  CHART_CARD_PADDING,
  filterRecentEntries,
  filterTransactionsByDateRange,
  getAllAccountsMeta,
  getSummaryDeltas,
  getSummaryEyebrow,
  SCREEN_PADDING,
  type EntryTab,
} from './dashboard/dashboardMetrics';
import { createDashboardStyles } from './dashboard/dashboardStyles';

interface DashboardScreenProps {
  onEditTransaction: (transaction: Transaction) => void;
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

  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
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
    () => ledgers.filter((ledger) => ledger.archived),
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

  const monthlyTxs = useMemo(
    () => filterTransactionsByDateRange(scopedTransactions, dateFilter),
    [scopedTransactions, dateFilter],
  );

  const chartDays = useMemo(
    () =>
      buildCumulativeChartDays(
        monthlyTxs,
        dateFilter,
        getTransactionAmountForActiveView,
      ),
    [monthlyTxs, dateFilter, getTransactionAmountForActiveView],
  );

  const filteredEntries = useMemo(
    () => filterRecentEntries(monthlyTxs, entryTab, activeLedgerId),
    [activeLedgerId, monthlyTxs, entryTab],
  );

  const ledgerStats = useMemo(
    () =>
      buildLedgerStats({
        activeLedger,
        activeLedgerId,
        activeLedgers,
        convertAmountToReporting,
        convertTransactionAmountToReporting,
        scopedTransactions,
      }),
    [
      activeLedger,
      activeLedgerId,
      activeLedgers,
      convertAmountToReporting,
      convertTransactionAmountToReporting,
      scopedTransactions,
    ],
  );

  const prevStats = useMemo(
    () =>
      buildPreviousPeriodStats({
        activeLedgerId,
        convertTransactionAmountToReporting,
        dateFilter,
        scopedTransactions,
      }),
    [
      activeLedgerId,
      convertTransactionAmountToReporting,
      dateFilter,
      scopedTransactions,
    ],
  );

  const netSparkline = useMemo(
    () =>
      buildNetSparkline(
        monthlyTxs,
        dateFilter,
        getTransactionAmountForActiveView,
      ),
    [monthlyTxs, dateFilter, getTransactionAmountForActiveView],
  );

  const summaryDeltas = useMemo(
    () => getSummaryDeltas(stats, prevStats),
    [prevStats, stats],
  );
  const summaryCardWidth = width - SCREEN_PADDING * 2;
  const summaryEyebrow = useMemo(
    () => getSummaryEyebrow(dateFilter),
    [dateFilter],
  );

  const chartW = width - SCREEN_PADDING * 2 - CHART_CARD_PADDING * 2;
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
              labels={chartDays.map((day) => day.label)}
              formatTick={formatCompactMoney}
              series={[
                {
                  color: colors.moss,
                  gradientId: 'gIn',
                  values: chartDays.map((day) => day.income),
                },
                {
                  color: colors.clay,
                  gradientId: 'gEx',
                  values: chartDays.map((day) => day.expenses),
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
        subtitle={visibleBudgets.length > 0 ? `${visibleBudgets.length} active` : 'this month'}
      >
        {visibleBudgets.length === 0 ? (
          <Pressable
            onPress={() => setBudgetSheet({ mode: 'add' })}
            style={styles.budgetEmpty}
            accessibilityRole="button"
            accessibilityLabel="Create your first budget"
          >
            <Target size={20} color={colors.rust} />
            <Text style={styles.budgetEmptyTitle}>Set your first budget</Text>
            <Text style={styles.budgetEmptyCopy}>
              Tap this card to create one, cap monthly spending by category, and watch your progress.
            </Text>
            <View style={styles.budgetAddRow}>
              <Plus size={14} color={colors.rust} />
              <Text style={styles.budgetAddLabel}>Tap to create budget</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            {visibleBudgets.map((progress) => (
              <BudgetProgressCard
                key={progress.budget.id}
                progress={progress}
                ledgers={ledgers}
                onPress={() => setBudgetSheet({ mode: 'edit', budget: progress.budget })}
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
        subtitle={activeGoalProgress.length > 0 ? `${activeGoalProgress.length} tracking` : 'savings targets'}
      >
        {activeGoalProgress.length === 0 ? (
          <Pressable
            onPress={() => setGoalSheet({ mode: 'add' })}
            style={styles.goalEmpty}
            accessibilityRole="button"
            accessibilityLabel="Create your first savings goal"
          >
            <Flag size={20} color={colors.rust} />
            <Text style={styles.budgetEmptyTitle}>Create a savings goal</Text>
            <Text style={styles.budgetEmptyCopy}>
              Tap this card to create one, link a savings account, and track progress automatically.
            </Text>
            <View style={styles.budgetAddRow}>
              <Plus size={14} color={colors.rust} />
              <Text style={styles.budgetAddLabel}>Tap to create goal</Text>
            </View>
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

      <RecentEntriesSection
        entries={filteredEntries}
        entryTab={entryTab}
        customCategories={customCategories}
        onEntryTabChange={setEntryTab}
        onEditTransaction={onEditTransaction}
      />

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
