import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import type { BillDisplayStatus, BillOccurrence } from '../types';
import { Empty, Section } from '../components/ui/Layout';
import { fonts } from '../theme';
import { formatDisplayDate, getFrequencyLabel } from '../utils/recurring';

type BillTab = 'due' | 'upcoming' | 'paid' | 'missed';

function statusLabel(status: BillDisplayStatus, daysUntilDue: number) {
  if (status === 'paid') return 'Paid';
  if (status === 'missed') return 'Missed';
  if (status === 'due-today') return 'Due today';
  if (daysUntilDue === 1) return 'Tomorrow';
  if (daysUntilDue > 1) return `In ${daysUntilDue} days`;
  return 'Upcoming';
}

function statusAccent(status: BillDisplayStatus, colors: any) {
  if (status === 'paid') return colors.moss;
  if (status === 'missed') return colors.clay;
  if (status === 'due-today') return colors.rust;
  return colors.stone500;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit' });
}

function formatMonth(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
}

export function BillsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    billOccurrences,
    billNotificationStatus,
    markBillPaid,
    markBillMissed,
    clearBillStatus,
    requestBillNotificationPermission,
    syncBillNotifications,
    reportingCurrency,
    formatReportingMoney,
    convertAmountToReporting,
  } = useBudget();
  const [tab, setTab] = useState<BillTab>('due');
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  const upcomingOpenBills = useMemo(
    () =>
      billOccurrences.filter(
        (bill) => bill.status !== 'paid' && bill.status !== 'missed' && bill.daysUntilDue >= 0,
      ),
    [billOccurrences],
  );

  const dueSoonBills = useMemo(
    () =>
      billOccurrences.filter(
        (bill) =>
          bill.status !== 'paid' &&
          (bill.status === 'missed' || bill.daysUntilDue <= 7),
      ),
    [billOccurrences],
  );

  const visibleBills = useMemo(() => {
    if (tab === 'due') return dueSoonBills;
    if (tab === 'upcoming') return upcomingOpenBills;
    return billOccurrences.filter((bill) => bill.status === tab);
  }, [billOccurrences, dueSoonBills, tab, upcomingOpenBills]);

  const dueSoonTotal = dueSoonBills.reduce((sum, bill) => {
    return sum + convertAmountToReporting(bill.amount, bill.currencyCode).amount;
  }, 0);

  const missedCount = billOccurrences.filter((bill) => bill.status === 'missed').length;
  const paidCount = billOccurrences.filter((bill) => bill.status === 'paid').length;
  const openCount = upcomingOpenBills.length;

  const tabs: { id: BillTab; label: string; count: number }[] = [
    { id: 'due', label: 'Due soon', count: dueSoonBills.length },
    { id: 'upcoming', label: 'Upcoming', count: openCount },
    { id: 'paid', label: 'Paid', count: paidCount },
    { id: 'missed', label: 'Missed', count: missedCount },
  ];

  const handleReminderPress = async () => {
    setSyncing(true);
    setSyncNote('');
    try {
      if (billNotificationStatus !== 'granted') {
        const nextStatus = await requestBillNotificationPermission();
        setSyncNote(nextStatus === 'granted' ? 'Reminders enabled.' : 'Reminders not enabled.');
      } else {
        const result = await syncBillNotifications();
        setSyncNote(`${result.scheduled} reminder${result.scheduled === 1 ? '' : 's'} scheduled.`);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <View>
            <Text style={styles.heroEyebrow}>Bills due soon</Text>
            <Text style={styles.heroTitle}>{formatReportingMoney(dueSoonTotal)}</Text>
          </View>
          <View style={styles.heroIcon}>
            <CalendarDays size={22} color={colors.rust} />
          </View>
        </View>
        <View style={styles.heroMetrics}>
          <Metric label="Open" value={String(openCount)} />
          <Metric label="Paid" value={String(paidCount)} />
          <Metric label="Missed" value={String(missedCount)} tone={missedCount > 0 ? colors.clay : undefined} />
        </View>
      </View>

      <View style={styles.reminderCard}>
        <View style={styles.reminderCopy}>
          <View style={styles.reminderIcon}>
            <Bell size={16} color={colors.rust} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.reminderTitle}>
              Reminders {billNotificationStatus === 'granted' ? 'enabled' : 'off'}
            </Text>
            <Text style={styles.reminderMeta}>
              {billNotificationStatus === 'granted'
                ? `Using each bill's reminder days`
                : 'Enable local bill reminders'}
            </Text>
            {syncNote ? <Text style={styles.syncNote}>{syncNote}</Text> : null}
          </View>
        </View>
        <Pressable
          onPress={handleReminderPress}
          disabled={syncing || billOccurrences.length === 0}
          style={[styles.reminderButton, (syncing || billOccurrences.length === 0) && { opacity: 0.45 }]}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Text style={styles.reminderButtonLabel}>
              {billNotificationStatus === 'granted' ? 'Sync' : 'Enable'}
            </Text>
          )}
        </Pressable>
      </View>

      <Section title="Commitments" subtitle={`${visibleBills.length} shown`}>
        <View style={styles.tabs}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tab, active && { backgroundColor: colors.ink }]}
              >
                <Text style={[styles.tabLabel, active && { color: colors.paper }]}>
                  {item.label}
                </Text>
                <Text style={[styles.tabCount, active && { color: colors.paper }]}>
                  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visibleBills.length === 0 ? (
          <Empty msg="No bill commitments in this view." />
        ) : (
          <View style={{ gap: 10 }}>
            {visibleBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                reportingCurrencyCode={reportingCurrency.code}
                amount={formatReportingMoney(
                  convertAmountToReporting(bill.amount, bill.currencyCode).amount,
                )}
                onPaid={() => markBillPaid(bill.id)}
                onMissed={() => markBillMissed(bill.id)}
                onUndo={() => clearBillStatus(bill.id)}
              />
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function BillCard({
  bill,
  amount,
  reportingCurrencyCode,
  onPaid,
  onMissed,
  onUndo,
}: {
  bill: BillOccurrence;
  amount: string;
  reportingCurrencyCode: string;
  onPaid: () => void;
  onMissed: () => void;
  onUndo: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accent = statusAccent(bill.status, colors);
  const closed = bill.status === 'paid' || Boolean(bill.manualStatus);
  const showMissedAction = bill.status !== 'missed' && bill.daysUntilDue <= 0;

  return (
    <View style={styles.billCard}>
      <View style={styles.datePill}>
        <Text style={styles.dateMonth}>{formatMonth(bill.dueDate)}</Text>
        <Text style={styles.dateDay}>{formatDay(bill.dueDate)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={styles.billHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.billTitle} numberOfLines={2}>
              {bill.source.description}
            </Text>
            <Text style={styles.billMeta} numberOfLines={2}>
              {bill.source.category} / {bill.ledgerName ?? 'Account missing'} /{' '}
              {getFrequencyLabel(bill.source.recurringSchedule)}
            </Text>
          </View>
          <Text style={styles.billAmount}>
            {amount}
          </Text>
        </View>

        <View style={styles.billStatusRow}>
          <View style={[styles.statusPill, { borderColor: accent }]}>
            {bill.status === 'paid' ? (
              <CheckCircle2 size={12} color={accent} />
            ) : bill.status === 'missed' ? (
              <XCircle size={12} color={accent} />
            ) : (
              <Clock size={12} color={accent} />
            )}
            <Text style={[styles.statusLabel, { color: accent }]}>
              {statusLabel(bill.status, bill.daysUntilDue)}
            </Text>
          </View>
          <Text style={styles.billDueText}>
            {formatDisplayDate(bill.dueDate)} / {reportingCurrencyCode}
          </Text>
        </View>

        {bill.ledgerArchived ? (
          <Text style={styles.warningText}>Linked account archived.</Text>
        ) : null}

        <View style={styles.actions}>
          {closed ? (
            <Pressable onPress={onUndo} style={styles.secondaryAction}>
              <RotateCcw size={13} color={colors.stone600} />
              <Text style={styles.secondaryActionLabel}>Undo</Text>
            </Pressable>
          ) : null}
          {bill.status !== 'paid' ? (
            <Pressable onPress={onPaid} style={[styles.actionButton, { backgroundColor: colors.moss }]}>
              <CheckCircle2 size={13} color={colors.paper} />
              <Text style={styles.actionLabel}>Paid</Text>
            </Pressable>
          ) : null}
          {showMissedAction ? (
            <Pressable onPress={onMissed} style={[styles.actionButton, { backgroundColor: colors.clay }]}>
              <XCircle size={13} color={colors.paper} />
              <Text style={styles.actionLabel}>Missed</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    hero: {
      backgroundColor: colors.ink,
      borderRadius: 22,
      padding: 22,
      gap: 22,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    heroEyebrow: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.paper,
      opacity: 0.65,
    },
    heroTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 34,
      color: colors.paper,
      marginTop: 4,
    },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    heroMetrics: {
      flexDirection: 'row',
      gap: 10,
    },
    metric: {
      flex: 1,
      minWidth: 0,
      padding: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    metricLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.paper,
      opacity: 0.58,
    },
    metricValue: {
      fontFamily: fonts.displayLight,
      fontSize: 23,
      color: colors.paper,
      marginTop: 3,
    },
    reminderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.cream,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
    },
    reminderCopy: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 16,
      color: colors.ink,
    },
    reminderMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    syncNote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.rust,
      marginTop: 4,
    },
    reminderButton: {
      minWidth: 76,
      minHeight: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: colors.rust,
    },
    reminderButtonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.paper,
    },
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    tabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
    },
    tabCount: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
    },
    billCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
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
    billHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    billTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 16,
      color: colors.ink,
      lineHeight: 21,
    },
    billMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 16,
      marginTop: 2,
    },
    billAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
      color: colors.clay,
      textAlign: 'right',
      maxWidth: 110,
    },
    billStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    billDueText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    warningText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.clay,
      fontStyle: 'italic',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
    },
    actionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.paper,
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    secondaryActionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone600,
    },
  });
