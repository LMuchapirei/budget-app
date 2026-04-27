import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CreditCard, Plus, TrendingUp, TrendingDown, Wallet, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../context/BudgetContext';
import { AreaChart } from '../charts/AreaChart';
import { StatCard } from '../components/ui/StatCard';
import { Section, Empty, Legend } from '../components/ui/Layout';
import { TxRow } from '../components/ui/TxRow';
import type { Transaction, TxType } from '../types';
import { fonts } from '../theme';

type EntryTab = 'all' | TxType;

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$' },
  { code: 'USD', symbol: 'US$' },
  { code: 'ZWL', symbol: 'Z$' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
] as const;

type CurrencyOption = typeof CURRENCY_OPTIONS[number];

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

export function DashboardScreen({ onEditTransaction }: DashboardScreenProps) {
  const { colors } = useTheme();
  const {
    scopedTransactions,
    ledgers,
    activeLedgerId,
    activeLedger,
    setActiveLedger,
    addLedger,
    stats,
    customCategories,
    dateFilter,
    currency,
    formatMoney,
    maskAccountNumber,
  } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entryTab, setEntryTab] = useState<EntryTab>('all');
  const [showLedgerForm, setShowLedgerForm] = useState(false);

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
      totalsByDate[t.date][t.type === 'income' ? 'income' : 'expenses'] += Number(t.amount);
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
  }, [monthlyTxs, dateFilter]);

  // Filtered recent entries based on tab
  const filteredEntries = useMemo(() => {
    const base = monthlyTxs;
    if (entryTab === 'all') return base.slice(0, 20);
    return base.filter((t) => t.type === entryTab).slice(0, 20);
  }, [monthlyTxs, entryTab]);

  const ledgerStats = useMemo(() => {
    const income = scopedTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = scopedTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses };
  }, [scopedTransactions]);

  const chartW = width - 24 * 2 - 16 * 2;
  const ledgerSymbol = activeLedger?.currencySymbol ?? currency;
  const formatLedgerMoney = (n: number) =>
    `${ledgerSymbol}${Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const maskedAccountNumber = activeLedger ? maskAccountNumber(activeLedger.accountNumber) : '';

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
            {activeLedger && (
              <Text style={styles.ledgerAccountMeta}>
                {activeLedger.currencyCode} {maskedAccountNumber ? `- ${maskedAccountNumber}` : ''}
              </Text>
            )}
          </View>
          <View style={styles.ledgerIcon}>
            <CreditCard size={20} color={colors.rust} />
          </View>
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
          {ledgers.map((ledger) => (
            <LedgerChip
              key={ledger.id}
              label={ledger.name}
              active={activeLedgerId === ledger.id}
              color={ledger.color}
              onPress={() => setActiveLedger(ledger.id)}
            />
          ))}
          <Pressable
            onPress={() => setShowLedgerForm(true)}
            style={styles.addLedgerChip}
          >
            <Plus size={14} color={colors.rust} />
            <Text style={styles.addLedgerLabel}>Account</Text>
          </Pressable>
        </ScrollView>
      </View>

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

      <Section title="Cash Flow" subtitle="Cumulative">
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

      <AddLedgerSheet
        visible={showLedgerForm}
        onClose={() => setShowLedgerForm(false)}
        onSave={(name, description, currencyCode, currencySymbol, accountNumber) => {
          addLedger({
            name,
            description,
            currencyCode,
            currencySymbol,
            accountNumber,
            color: colors.rust,
          });
          setShowLedgerForm(false);
        }}
      />
    </View>
  );
}

function LedgerChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
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

function AddLedgerSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    description: string,
    currencyCode: string,
    currencySymbol: string,
    accountNumber?: string,
  ) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(CURRENCY_OPTIONS[0]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(
      name.trim(),
      description.trim(),
      selectedCurrency.code,
      selectedCurrency.symbol,
      accountNumber.trim() || undefined,
    );
    setName('');
    setDescription('');
    setAccountNumber('');
    setSelectedCurrency(CURRENCY_OPTIONS[0]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>New account</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <View style={{ gap: 16 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Account name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. FBC Staff Account"
                placeholderTextColor={colors.stone400}
                style={styles.input}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional note"
                placeholderTextColor={colors.stone400}
                style={styles.input}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.currencyGrid}>
                {CURRENCY_OPTIONS.map((option) => {
                  const active =
                    selectedCurrency.code === option.code &&
                    selectedCurrency.symbol === option.symbol;
                  return (
                    <Pressable
                      key={`${option.code}-${option.symbol}`}
                      onPress={() => setSelectedCurrency(option)}
                      style={[
                        styles.currencyOption,
                        active && { backgroundColor: colors.ink },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencySymbol,
                          active && { color: colors.paper },
                        ]}
                      >
                        {option.symbol}
                      </Text>
                      <Text
                        style={[
                          styles.currencyCode,
                          active && { color: colors.paper },
                        ]}
                      >
                        {option.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Account number</Text>
              <TextInput
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Optional"
                placeholderTextColor={colors.stone400}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!name.trim()}
            style={[styles.submit, !name.trim() && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>Create account</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    currencyOption: {
      minWidth: 70,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 2,
    },
    currencySymbol: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    currencyCode: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.stone500,
    },
    submit: {
      backgroundColor: colors.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
    },
    submitLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
    },
  });
