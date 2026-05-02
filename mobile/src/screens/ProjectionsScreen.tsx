import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { LineChart } from '../charts/LineChart';
import { Section, Empty } from '../components/ui/Layout';
import { fonts } from '../theme';
import {
  addMonthsClamped,
  estimateMonthlyImpact,
  formatDisplayDate,
  formatISODate,
  generateRecurringOccurrences,
  getNextOccurrenceDate,
  getRecurringDescription,
} from '../utils/recurring';

export function ProjectionsScreen() {
  const { colors } = useTheme();
  const {
    transactions,
    transactionEditHistory,
    ledgers,
    reportingCurrency,
    formatReportingMoney,
    formatMoneyForLedger,
    formatCompactMoney,
    convertAmountToReporting,
  } = useBudget();
  const { width } = useWindowDimensions();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const todayIso = formatISODate(new Date());
  const rangeEndIso = formatISODate(addMonthsClamped(new Date(), 12));

  const recurring = transactions.filter((t) => t.recurring && !t.generatedFromRecurringId);
  const upcoming = recurring
    .flatMap((transaction) => generateRecurringOccurrences(transaction, todayIso, rangeEndIso))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const ledgerCurrencyCode = (ledgerId?: string | null) =>
    ledgers.find((ledger) => ledger.id === ledgerId)?.currencyCode ?? reportingCurrency.code;

  const monthlyAverage = recurring.reduce((sum, transaction) => {
    return (
      sum +
      convertAmountToReporting(
        estimateMonthlyImpact(transaction),
        ledgerCurrencyCode(transaction.ledgerId),
      ).amount
    );
  }, 0);

  const projection = useMemo(() => {
    const months: { label: string; cumulative: number }[] = [];
    let cumulative = 0;
    for (let i = 0; i < 12; i++) {
      const monthStart = addMonthsClamped(new Date(), i);
      const monthEnd = addMonthsClamped(new Date(), i + 1);
      const monthStartIso = formatISODate(monthStart);
      const monthEndIso = formatISODate(monthEnd);
      const monthNet = upcoming
        .filter((occurrence) => occurrence.dueDate >= monthStartIso && occurrence.dueDate < monthEndIso)
        .reduce((sum, occurrence) => {
          const signedAmount = occurrence.type === 'income' ? occurrence.amount : -occurrence.amount;
          return (
            sum +
            convertAmountToReporting(
              signedAmount,
              ledgerCurrencyCode(occurrence.source.ledgerId),
            ).amount
          );
        }, 0);
      cumulative += monthNet;
      months.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        cumulative,
      });
    }
    return months;
  }, [convertAmountToReporting, ledgers, reportingCurrency.code, upcoming]);

  const chartW = width - 24 * 2 - 16 * 2;
  const positive = monthlyAverage >= 0;

  const formatLedgerDelta = (value: number, ledgerId?: string | null) => {
    if (value === 0) return formatMoneyForLedger(0, ledgerId);
    return `${value > 0 ? '+' : '-'}${formatMoneyForLedger(Math.abs(value), ledgerId)}`;
  };

  const formatEditDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.heroDark}>
        <Text style={styles.heroEyebrow}>Recurring outlook</Text>
        <Text style={styles.heroTitle}>
          {positive ? "You're tracking " : "You're carrying "}
          <Text
            style={[
              styles.heroEm,
              { color: positive ? '#9BC4A8' : '#D89992' },
            ]}
          >
            {formatReportingMoney(Math.abs(monthlyAverage))}
          </Text>{' '}
          monthly average
        </Text>
        <Text style={styles.heroBody}>
          Based on {recurring.length} scheduled {recurring.length === 1 ? 'item' : 'items'} and{' '}
          {upcoming.length} upcoming due {upcoming.length === 1 ? 'date' : 'dates'} over the next year.
        </Text>
      </View>

      <Section title="12-Month Projection" subtitle="Scheduled net balance">
        {recurring.length === 0 ? (
          <Empty msg="Create a recurring schedule to see projections here." />
        ) : (
          <View style={styles.card}>
            <LineChart
              width={chartW}
              height={240}
              values={projection.map((p) => p.cumulative)}
              labels={projection.map((p) => p.label)}
              formatTick={formatCompactMoney}
            />
          </View>
        )}
      </Section>

      <Section title="Bill Calendar" subtitle={`${upcoming.slice(0, 8).length} upcoming`}>
        {upcoming.length === 0 ? (
          <Empty msg="No upcoming recurring due dates." />
        ) : (
          <View style={{ gap: 10 }}>
            {upcoming.slice(0, 8).map((occurrence) => (
              <View key={`${occurrence.source.id}-${occurrence.dueDate}`} style={styles.calendarCard}>
                <View style={styles.datePill}>
                  <Text style={styles.dateMonth}>
                    {formatMonth(occurrence.dueDate)}
                  </Text>
                  <Text style={styles.dateDay}>{formatDay(occurrence.dueDate)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recurringTitle} numberOfLines={2}>
                    {occurrence.source.description}
                  </Text>
                  <Text style={styles.recurringMeta} numberOfLines={2}>
                    {occurrence.source.category} - {getRecurringDescription(occurrence.source)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.recurringAmount,
                    { color: occurrence.type === 'income' ? colors.moss : colors.clay },
                  ]}
                >
                  {occurrence.type === 'income' ? '+' : '-'}
                  {formatMoneyForLedger(occurrence.amount, occurrence.source.ledgerId)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Recurring Items" subtitle={`${recurring.length} active`}>
        {recurring.length === 0 ? (
          <Empty msg="No recurring transactions yet." />
        ) : (
          <View style={{ gap: 10 }}>
            {recurring.map((t) => {
              const nextDue = getNextOccurrenceDate(t);
              return (
                <View key={t.id} style={styles.recurringCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.recurringTitle} numberOfLines={2}>{t.description}</Text>
                    <Text style={styles.recurringMeta} numberOfLines={2}>
                      {getRecurringDescription(t)}
                      {nextDue ? ` - next ${formatDisplayDate(nextDue)}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recurringAmount,
                      { color: t.type === 'income' ? colors.moss : colors.clay },
                    ]}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatMoneyForLedger(t.amount, t.ledgerId)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Projection Edit Trail" subtitle={`${transactionEditHistory.length} edits`}>
        {transactionEditHistory.length === 0 ? (
          <Empty msg="Edited recurring transactions will show their projection impact here." />
        ) : (
          <View style={{ gap: 10 }}>
            {transactionEditHistory.slice(0, 12).map((edit) => {
              const deltaColor =
                edit.projectionMonthlyDelta > 0
                  ? colors.moss
                  : edit.projectionMonthlyDelta < 0
                  ? colors.clay
                  : colors.stone500;
              const changedName = edit.before.description !== edit.after.description;
              const title = changedName
                ? `${edit.before.description} -> ${edit.after.description}`
                : edit.after.description;

              return (
                <View key={edit.id} style={styles.historyCard}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.historyTitle}>{title}</Text>
                    <Text style={styles.historyMeta}>
                      Edited {formatEditDate(edit.editedAt)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {edit.before.category} / {edit.after.category}
                    </Text>
                  </View>
                  <View style={styles.historyImpact}>
                    <Text style={[styles.historyDelta, { color: deltaColor }]}>
                      {formatLedgerDelta(edit.projectionMonthlyDelta, edit.after.ledgerId)}
                    </Text>
                    <Text style={styles.historyImpactLabel}>monthly</Text>
                    <Text style={styles.historyAnnual}>
                      {formatLedgerDelta(edit.projectionAnnualDelta, edit.after.ledgerId)} yearly
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Section>
    </View>
  );
}

function formatMonth(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit' });
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    heroDark: {
      backgroundColor: colors.ink,
      borderRadius: 22,
      padding: 28,
      gap: 6,
    },
    heroEyebrow: {
      fontFamily: fonts.displayItalic,
      color: colors.paper,
      opacity: 0.65,
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
      opacity: 0.65,
      fontSize: 13,
      marginTop: 6,
    },
    card: {
      backgroundColor: colors.cream,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
    },
    calendarCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cream,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
      gap: 12,
    },
    datePill: {
      width: 50,
      borderRadius: 12,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      paddingVertical: 8,
    },
    dateMonth: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone500,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    dateDay: {
      fontFamily: fonts.displayLight,
      fontSize: 20,
      color: colors.ink,
      marginTop: 2,
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
      lineHeight: 16,
    },
    recurringAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
      textAlign: 'right',
      maxWidth: 110,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cream,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 16,
      gap: 12,
    },
    historyTitle: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    historyMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    historyImpact: {
      alignItems: 'flex-end',
      gap: 2,
    },
    historyDelta: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
    },
    historyImpactLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone500,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    historyAnnual: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.stone500,
    },
  });
