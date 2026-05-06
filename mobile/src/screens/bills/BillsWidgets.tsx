import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  XCircle,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';
import type { PaymentEvidence, ScheduledOccurrence } from '../../types';
import { formatDisplayDate, getFrequencyLabel } from '../../utils/recurring';
import { evidenceConfidenceLabel } from '../../utils/paymentEvidence';
import { createBillsStyles } from './billsStyles';

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

function statusAccent(occurrence: ScheduledOccurrence, colors: ColorPalette) {
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

export function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBillsStyles(colors), [colors]);

  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

interface OccurrenceCardProps {
  occurrence: ScheduledOccurrence;
  amount: string;
  reportingCurrencyCode: string;
  evidence: PaymentEvidence[];
  onConfirm: () => void;
  onSkip: () => void;
  onPostpone: () => void;
  onProof: () => void;
  onUndo: () => void;
}

export function OccurrenceCard({
  occurrence,
  amount,
  reportingCurrencyCode,
  evidence,
  onConfirm,
  onSkip,
  onPostpone,
  onProof,
  onUndo,
}: OccurrenceCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBillsStyles(colors), [colors]);
  const accent = statusAccent(occurrence, colors);
  const canAct =
    occurrence.recordStatus !== 'confirmed' &&
    occurrence.recordStatus !== 'skipped';
  const canUndo =
    occurrence.recordStatus === 'skipped' ||
    occurrence.recordStatus === 'postponed';
  const strongestEvidence =
    evidence.find((item) => item.confidence === 'verified') ??
    evidence.find((item) => item.confidence === 'matched') ??
    evidence.find((item) => item.confidence === 'parsed') ??
    evidence[0];
  const firstPhotoEvidence = evidence.find(
    (item) => item.type === 'photo' && Boolean(item.attachmentUri),
  );

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
          <Pressable
            onPress={onProof}
            accessibilityRole="button"
            accessibilityLabel={
              evidence.length > 0
                ? `View ${evidence.length} proof attachment${evidence.length === 1 ? '' : 's'}`
                : 'Add proof of payment'
            }
            hitSlop={6}
            style={({ pressed }) => [
              styles.proofPill,
              evidence.length > 0
                ? {
                    borderColor: colors.moss,
                    backgroundColor: colors.cream,
                  }
                : {
                    borderColor: colors.rust,
                    borderStyle: 'dashed',
                  },
              pressed && { opacity: 0.6 },
            ]}
          >
            {firstPhotoEvidence?.attachmentUri ? (
              <Image
                source={{ uri: firstPhotoEvidence.attachmentUri }}
                style={styles.proofThumb}
              />
            ) : evidence.length > 0 ? (
              <View style={[styles.proofIconWrap, { backgroundColor: colors.moss }]}>
                <ShieldCheck size={11} color={colors.paper} />
              </View>
            ) : (
              <View style={[styles.proofIconWrap, { backgroundColor: colors.chip }]}>
                <Paperclip size={11} color={colors.rust} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  styles.proofLabel,
                  { color: evidence.length > 0 ? colors.moss : colors.rust },
                ]}
                numberOfLines={1}
              >
                {evidence.length > 0
                  ? `View ${evidence.length} proof${evidence.length === 1 ? '' : 's'}`
                  : 'Tap to add proof'}
              </Text>
              {evidence.length > 0 && strongestEvidence ? (
                <Text style={styles.proofMeta} numberOfLines={1}>
                  {evidenceConfidenceLabel(strongestEvidence)}
                </Text>
              ) : null}
            </View>
            <ChevronRight
              size={13}
              color={evidence.length > 0 ? colors.moss : colors.rust}
            />
          </Pressable>
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
