import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  CalendarDays,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import type {
  ConfirmOccurrenceOverride,
  PaymentEvidenceDraft,
  ScheduledOccurrence,
} from '../types';
import { Empty, Section } from '../components/ui/Layout';
import { ConfirmOccurrenceSheet } from '../components/forms/ConfirmOccurrenceSheet';
import { DatePickerSheet } from '../components/forms/DatePickerSheet';
import { PaymentEvidenceSheet } from '../components/forms/PaymentEvidenceSheet';
import { formatDisplayDate } from '../utils/recurring';
import { createBillsStyles } from './bills/billsStyles';
import { Metric, OccurrenceCard } from './bills/BillsWidgets';

type OccurrenceTab = 'due' | 'upcoming' | 'confirmed' | 'skipped' | 'postponed';

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function BillsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createBillsStyles(colors), [colors]);
  const {
    scheduledOccurrences,
    scheduledNotificationStatus,
    confirmOccurrence,
    skipOccurrence,
    postponeOccurrence,
    clearOccurrenceStatus,
    evidenceForOccurrence,
    addPaymentEvidence,
    removePaymentEvidence,
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
  const [proofing, setProofing] = useState<ScheduledOccurrence | null>(null);

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

  const handleAddEvidence = (draft: PaymentEvidenceDraft) => {
    if (!proofing) return;
    addPaymentEvidence(proofing.id, draft);
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
                  evidence={evidenceForOccurrence(occurrence.id)}
                  onConfirm={() => setConfirming(occurrence)}
                  onSkip={() => handleSkip(occurrence)}
                  onPostpone={() => setPostponing(occurrence)}
                  onProof={() => setProofing(occurrence)}
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

      <PaymentEvidenceSheet
        visible={Boolean(proofing)}
        occurrence={proofing}
        evidence={proofing ? evidenceForOccurrence(proofing.id) : []}
        onAdd={handleAddEvidence}
        onRemove={removePaymentEvidence}
        onClose={() => setProofing(null)}
      />
    </View>
  );
}
