import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  SkipForward,
  XCircle,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import type { ConfirmOccurrenceOverride, ScheduledOccurrence } from '../types';
import { Empty, Section } from '../components/ui/Layout';
import { ConfirmOccurrenceSheet } from '../components/forms/ConfirmOccurrenceSheet';
import { DatePickerSheet } from '../components/forms/DatePickerSheet';
import { fonts } from '../theme';
import { formatDisplayDate, getFrequencyLabel } from '../utils/recurring';

type OccurrenceTab = 'due' | 'upcoming' | 'confirmed' | 'skipped' | 'postponed';

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function statusLabel(occurrence: ScheduledOccurrence) {
  if (occurrence.status === 'confirmed') return 'Confirmed';
  if (occurrence.status === 'skipped') return 'Skipped';
  if (occurrence.status === 'postponed') return 'Postponed';
  if (occurrence.status === 'due-now') return 'Missed';
  if (occurrence.status === 'due-today') return 'Due today';
  if (occurrence.daysUntilDue === 1) return 'Tomorrow';
  if (occurrence.daysUntilDue > 1) return `In ${occurrence.daysUntilDue} days`;
  return 'Pending';
}

function statusAccent(occurrence: ScheduledOccurrence, colors: any) {
  if (occurrence.status === 'confirmed') return colors.moss;
  if (occurrence.status === 'skipped') return colors.stone500;
  if (occurrence.status === 'postponed') return colors.rust;
  if (occurrence.status === 'due-now') return colors.clay;
  if (occurrence.status === 'due-today') return colors.rust;
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
    scheduledOccurrences,
    scheduledNotificationStatus,
    confirmOccurrence,
    skipOccurrence,
    postponeOccurrence,
    clearOccurrenceStatus,
    requestScheduledNotificationPermission,
    syncScheduledNotifications,
    reportingCurrency,
    formatReportingMoney,
    convertAmountToReporting,
  } = useBudget();
  const [tab, setTab] = useState<OccurrenceTab>('due');
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const [confirming, setConfirming] = useState<ScheduledOccurrence | null>(null);
  const [postponing, setPostponing] = useState<ScheduledOccurrence | null>(null);

  const dueOccurrences = useMemo(
    () =>
      scheduledOccurrences.filter(
        (occurrence) =>
          occurrence.status === 'due-now' ||
          occurrence.status === 'due-today' ||
          (occurrence.recordStatus !== 'confirmed' &&
            occurrence.recordStatus !== 'skipped' &&
            occurrence.daysUntilDue >= 0 &&
            occurrence.daysUntilDue <= 7),
      ),
    [scheduledOccurrences],
  );

  const upcomingOccurrences = useMemo(
    () =>
      scheduledOccurrences.filter(
        (occurrence) =>
          occurrence.status === 'upcoming' && occurrence.daysUntilDue > 7,
      ),
    [scheduledOccurrences],
  );

  const visibleOccurrences = useMemo(() => {
    if (tab === 'due') return dueOccurrences;
    if (tab === 'upcoming') return upcomingOccurrences;
    return scheduledOccurrences.filter((occurrence) => occurrence.recordStatus === tab);
  }, [dueOccurrences, scheduledOccurrences, tab, upcomingOccurrences]);

  const dueSoonTotal = dueOccurrences.reduce((sum, occurrence) => {
    const amount = convertAmountToReporting(occurrence.amount, occurrence.currencyCode).amount;
    return sum + (occurrence.type === 'income' ? amount : -amount);
  }, 0);

  const confirmedCount = scheduledOccurrences.filter((item) => item.recordStatus === 'confirmed').length;
  const skippedCount = scheduledOccurrences.filter((item) => item.recordStatus === 'skipped').length;
  const postponedCount = scheduledOccurrences.filter((item) => item.recordStatus === 'postponed').length;
  const openCount = scheduledOccurrences.filter(
    (item) => item.recordStatus !== 'confirmed' && item.recordStatus !== 'skipped',
  ).length;

  const tabs: { id: OccurrenceTab; label: string; count: number }[] = [
    { id: 'due', label: 'Due', count: dueOccurrences.length },
    { id: 'upcoming', label: 'Upcoming', count: upcomingOccurrences.length },
    { id: 'confirmed', label: 'Confirmed', count: confirmedCount },
    { id: 'skipped', label: 'Skipped', count: skippedCount },
    { id: 'postponed', label: 'Postponed', count: postponedCount },
  ];

  const handleReminderPress = async () => {
    setSyncing(true);
    setSyncNote('');
    try {
      if (scheduledNotificationStatus !== 'granted') {
        const nextStatus = await requestScheduledNotificationPermission();
        setSyncNote(nextStatus === 'granted' ? 'Reminders enabled.' : 'Reminders not enabled.');
      } else {
        const result = await syncScheduledNotifications();
        setSyncNote(`${result.scheduled} reminder${result.scheduled === 1 ? '' : 's'} scheduled.`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSkip = (occurrence: ScheduledOccurrence) => {
    Alert.alert(
      'Skip this occurrence?',
      `${occurrence.source.description} will stay out of your ledger for ${formatDisplayDate(occurrence.effectiveDueDate)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: () => skipOccurrence(occurrence.id) },
      ],
    );
  };

  const handleConfirm = (override: ConfirmOccurrenceOverride) => {
    if (!confirming) return;
    confirmOccurrence(confirming.id, override);
    setConfirming(null);
  };

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <View>
            <Text style={styles.heroEyebrow}>Due soon net</Text>
            <Text style={styles.heroTitle}>
              {dueSoonTotal < 0 ? '-' : ''}
              {formatReportingMoney(Math.abs(dueSoonTotal))}
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <CalendarDays size={22} color={colors.rust} />
          </View>
        </View>
        <View style={styles.heroMetrics}>
          <Metric label="Open" value={String(openCount)} />
          <Metric label="Confirmed" value={String(confirmedCount)} />
          <Metric label="Skipped" value={String(skippedCount)} />
        </View>
      </View>

      <View style={styles.reminderCard}>
        <View style={styles.reminderCopy}>
          <View style={styles.reminderIcon}>
            <Bell size={16} color={colors.rust} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.reminderTitle}>
              Reminders {scheduledNotificationStatus === 'granted' ? 'enabled' : 'off'}
            </Text>
            <Text style={styles.reminderMeta}>
              {scheduledNotificationStatus === 'granted'
                ? 'Local reminders for income and expenses'
                : 'Enable local schedule reminders'}
            </Text>
            {syncNote ? <Text style={styles.syncNote}>{syncNote}</Text> : null}
          </View>
        </View>
        <Pressable
          onPress={handleReminderPress}
          disabled={syncing || scheduledOccurrences.length === 0}
          style={[
            styles.reminderButton,
            (syncing || scheduledOccurrences.length === 0) && { opacity: 0.45 },
          ]}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Text style={styles.reminderButtonLabel}>
              {scheduledNotificationStatus === 'granted' ? 'Sync' : 'Enable'}
            </Text>
          )}
        </Pressable>
      </View>

      <Section title="Commitments" subtitle={`${visibleOccurrences.length} shown`}>
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

        {visibleOccurrences.length === 0 ? (
          <Empty msg="No scheduled commitments in this view." />
        ) : (
          <View style={{ gap: 10 }}>
            {visibleOccurrences.map((occurrence) => {
              const reportingAmount = convertAmountToReporting(
                occurrence.amount,
                occurrence.currencyCode,
              ).amount;
              return (
                <OccurrenceCard
                  key={occurrence.id}
                  occurrence={occurrence}
                  reportingCurrencyCode={reportingCurrency.code}
                  amount={formatReportingMoney(reportingAmount)}
                  onConfirm={() => setConfirming(occurrence)}
                  onSkip={() => handleSkip(occurrence)}
                  onPostpone={() => setPostponing(occurrence)}
                  onUndo={() => clearOccurrenceStatus(occurrence.id)}
                />
              );
            })}
          </View>
        )}
      </Section>

      <ConfirmOccurrenceSheet
        visible={Boolean(confirming)}
        occurrence={confirming}
        onConfirm={handleConfirm}
        onClose={() => setConfirming(null)}
      />

      <DatePickerSheet
        visible={Boolean(postponing)}
        title="Postpone occurrence"
        value={postponing?.effectiveDueDate ?? todayISO()}
        min={todayISO()}
        onSelect={(iso) => {
          if (postponing) postponeOccurrence(postponing.id, iso);
          setPostponing(null);
        }}
        onClose={() => setPostponing(null)}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function OccurrenceCard({
  occurrence,
  amount,
  reportingCurrencyCode,
  onConfirm,
  onSkip,
  onPostpone,
  onUndo,
}: {
  occurrence: ScheduledOccurrence;
  amount: string;
  reportingCurrencyCode: string;
  onConfirm: () => void;
  onSkip: () => void;
  onPostpone: () => void;
  onUndo: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accent = statusAccent(occurrence, colors);
  const canAct =
    occurrence.recordStatus !== 'confirmed' &&
    occurrence.recordStatus !== 'skipped';
  const canUndo =
    occurrence.recordStatus === 'skipped' ||
    occurrence.recordStatus === 'postponed';

  return (
    <View style={styles.occurrenceCard}>
      <View style={styles.datePill}>
        <Text style={styles.dateMonth}>{formatMonth(occurrence.effectiveDueDate)}</Text>
        <Text style={styles.dateDay}>{formatDay(occurrence.effectiveDueDate)}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={styles.occurrenceHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.occurrenceTitle} numberOfLines={2}>
              {occurrence.source.description}
            </Text>
            <Text style={styles.occurrenceMeta} numberOfLines={2}>
              {occurrence.source.category} / {occurrence.ledgerName ?? 'Account missing'} /{' '}
              {getFrequencyLabel(occurrence.source.recurringSchedule)}
            </Text>
          </View>
          <Text
            style={[
              styles.occurrenceAmount,
              { color: occurrence.type === 'income' ? colors.moss : colors.clay },
            ]}
          >
            {occurrence.type === 'income' ? '+' : '-'}
            {amount}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { borderColor: accent }]}>
            {occurrence.status === 'confirmed' ? (
              <CheckCircle2 size={12} color={accent} />
            ) : occurrence.status === 'skipped' ? (
              <SkipForward size={12} color={accent} />
            ) : occurrence.status === 'due-now' ? (
              <XCircle size={12} color={accent} />
            ) : (
              <Clock size={12} color={accent} />
            )}
            <Text style={[styles.statusLabel, { color: accent }]}>
              {statusLabel(occurrence)}
            </Text>
          </View>
          <Text style={styles.dueText}>
            {formatDisplayDate(occurrence.effectiveDueDate)} / {reportingCurrencyCode}
          </Text>
        </View>

        {occurrence.ledgerArchived ? (
          <Text style={styles.warningText}>Linked account archived.</Text>
        ) : null}

        <View style={styles.actions}>
          {canUndo ? (
            <Pressable onPress={onUndo} style={styles.secondaryAction}>
              <RotateCcw size={13} color={colors.stone600} />
              <Text style={styles.secondaryActionLabel}>Undo</Text>
            </Pressable>
          ) : null}
          {canAct ? (
            <>
              <Pressable onPress={onConfirm} style={[styles.actionButton, { backgroundColor: colors.moss }]}>
                <CheckCircle2 size={13} color={colors.paper} />
                <Text style={styles.actionLabel}>Confirm</Text>
              </Pressable>
              <Pressable onPress={onPostpone} style={styles.secondaryAction}>
                <CalendarDays size={13} color={colors.stone600} />
                <Text style={styles.secondaryActionLabel}>Postpone</Text>
              </Pressable>
              <Pressable onPress={onSkip} style={styles.secondaryAction}>
                <SkipForward size={13} color={colors.stone600} />
                <Text style={styles.secondaryActionLabel}>Skip</Text>
              </Pressable>
            </>
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
    occurrenceCard: {
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
    occurrenceHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    occurrenceTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 16,
      color: colors.ink,
      lineHeight: 21,
    },
    occurrenceMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 16,
      marginTop: 2,
    },
    occurrenceAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
      textAlign: 'right',
      maxWidth: 110,
    },
    statusRow: {
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
    dueText: {
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
