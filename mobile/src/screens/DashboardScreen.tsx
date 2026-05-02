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
  CreditCard,
  Pencil,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { StatCard } from '../components/ui/StatCard';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';
import { LedgerSheet } from '../components/forms/LedgerSheet';
import type { LedgerAccount, Transaction, TxType, FxRateStatus } from '../types';
import { fonts } from '../theme';

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
    dateFilter,
    reportingCurrency,
    fxRates,
    fxStatus,
    fxError,
    formatActiveMoney,
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

  const archivedLedgers = useMemo(
    () => ledgers.filter((l) => l.archived),
    [ledgers],
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

      <View style={{ gap: 12 }}>
        <StatCard
          label="Income this month"
          rawValue={stats.income}
          value={formatActiveMoney(stats.income)}
          color={colors.moss}
          Icon={TrendingUp}
          accent="i."
        />
        <StatCard
          label="Expenses this month"
          rawValue={stats.expenses}
          value={formatActiveMoney(stats.expenses)}
          color={colors.clay}
          Icon={TrendingDown}
          accent="ii."
        />
        <StatCard
          label="Net balance"
          rawValue={stats.balance}
          value={formatActiveMoney(Math.abs(stats.balance))}
          color={stats.balance >= 0 ? colors.ink : colors.clay}
          Icon={Wallet}
          accent="iii."
          signed
        />
      </View>

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

      <ArchivedLedgersSheet
        visible={showArchivedSheet}
        ledgers={archivedLedgers}
        onClose={() => setShowArchivedSheet(false)}
        onPick={(ledger) => {
          setShowArchivedSheet(false);
          setLedgerSheet({ mode: 'edit', ledger });
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
