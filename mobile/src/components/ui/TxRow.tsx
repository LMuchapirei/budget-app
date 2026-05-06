import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ArrowLeftRight, Pencil, Trash2, Repeat, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { Transaction, CustomCategory, TransactionEditHistory } from '../../types';
import { colorFor } from '../../theme';
import { useBudget } from '../../context/BudgetContext';
import {
  formatDisplayDate,
  getNextOccurrenceDate,
  getRecurringDescription,
} from '../../utils/recurring';
import { createTxRowStyles } from './txRowStyles';

interface TxRowProps {
  t: Transaction;
  isLast: boolean;
  customCategories: CustomCategory[];
  onEdit?: (t: Transaction) => void;
}

const SWIPE_OPEN = 86;
const SWIPE_TRIGGER = 38;
const FLICK_VELOCITY = 0.45;

export function TxRow({ t, isLast, customCategories, onEdit }: TxRowProps) {
  const { colors } = useTheme();
  const {
    removeTransaction,
    formatMoneyForLedger,
    maskAccountNumber,
    transactionEditHistory,
    ledgers,
  } = useBudget();
  const styles = useMemo(() => createTxRowStyles(colors, SWIPE_OPEN), [colors]);
  const [showDetails, setShowDetails] = useState(false);
  // `translateX` is the source of truth for the row's horizontal offset. During a
  // drag we accumulate the delta via `Animated.event` (no JS setValue per move).
  // On release we flatten the offset and animate to the snap target.
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const isIncome = t.type === 'income';
  const isTransfer = Boolean(t.transferPairId);
  const accent = isTransfer ? colors.rust : colorFor(t.category, customCategories);
  const ledger = ledgers.find((item) => item.id === t.ledgerId);
  const counterpartLedger = ledgers.find(
    (item) => item.id === t.transferCounterpartLedgerId,
  );
  const maskedAccountNumber = maskAccountNumber(ledger?.accountNumber);
  const transferTitle = isTransfer
    ? t.transferDirection === 'out'
      ? `Transfer to ${counterpartLedger?.name ?? 'account'}`
      : `Transfer from ${counterpartLedger?.name ?? 'account'}`
    : t.description;
  const transferMeta = isTransfer
    ? `${ledger?.name ?? 'Cash Ledger'} ${
        t.transferDirection === 'out' ? 'to' : 'from'
      } ${counterpartLedger?.name ?? 'another account'} - ${formatShortDate(t.date)}`
    : `${t.category} - ${ledger?.name ?? 'Cash Ledger'} - ${formatShortDate(t.date)}`;
  const edits = useMemo(
    () => transactionEditHistory.filter((edit) => edit.transactionId === t.id),
    [transactionEditHistory, t.id],
  );

  // Clamp at the edges via interpolation rather than per-frame Math.min/max calls.
  const clampedTranslate = translateX.interpolate({
    inputRange: [-SWIPE_OPEN, 0, SWIPE_OPEN],
    outputRange: [-SWIPE_OPEN, 0, SWIPE_OPEN],
    extrapolate: 'clamp',
  });

  const settleTo = (value: number) => {
    offsetRef.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: false,
      friction: 14,
      tension: 70,
      overshootClamping: true,
      restSpeedThreshold: 0.5,
      restDisplacementThreshold: 0.5,
    }).start();
  };

  const closeSwipe = () => settleTo(0);

  const handleEdit = () => {
    closeSwipe();
    onEdit?.(t);
  };

  const handleDelete = () => {
    closeSwipe();
    removeTransaction(t.id);
  };

  const panResponder = useRef(
    PanResponder.create({
      // Don't claim on touch start — let the surrounding ScrollView and the inner
      // Pressable handle taps. Only claim once the gesture is clearly horizontal.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          offsetRef.current = value;
          // Move the current value into the offset and reset the value to 0 so the
          // upcoming event-driven dx accumulates cleanly without re-reading state.
          translateX.setOffset(value);
          translateX.setValue(0);
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: translateX }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, gesture) => {
        translateX.flattenOffset();
        const next = offsetRef.current + gesture.dx;
        const vx = gesture.vx;
        let target = 0;
        if ((next > SWIPE_TRIGGER || vx > FLICK_VELOCITY) && onEdit) {
          target = SWIPE_OPEN;
        } else if (next < -SWIPE_TRIGGER || vx < -FLICK_VELOCITY) {
          target = -SWIPE_OPEN;
        }
        settleTo(target);
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        settleTo(0);
      },
    }),
  ).current;

  const handleRowPress = () => {
    if (offsetRef.current !== 0) {
      closeSwipe();
      return;
    }
    setShowDetails(true);
  };

  return (
    <>
      <View style={[styles.swipeFrame, !isLast && styles.txRowBorder]}>
        <View style={styles.swipeActions}>
          <Pressable
            onPress={handleEdit}
            disabled={!onEdit}
            style={[styles.swipeAction, styles.editAction, !onEdit && styles.disabledAction]}
            accessibilityLabel={`Edit ${t.description}`}
          >
            <Pencil size={18} color={colors.paper} />
            <Text style={styles.actionLabel}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={[styles.swipeAction, styles.deleteAction]}
            accessibilityLabel={`Delete ${t.description}`}
          >
            <Trash2 size={20} color={colors.paper} />
          </Pressable>
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.animatedRow, { transform: [{ translateX: clampedTranslate }] }]}
        >
          <Pressable
            onPress={handleRowPress}
            style={({ pressed }) => [styles.txRow, pressed && { opacity: 0.88 }]}
          >
            <View style={[styles.txDot, { backgroundColor: `${accent}20` }]}>
              {isTransfer ? (
                <ArrowLeftRight size={15} color={accent} />
              ) : (
                <View style={[styles.txDotInner, { backgroundColor: accent }]} />
              )}
            </View>

            <View style={styles.txMain}>
              <View style={styles.txTitleRow}>
                <Text style={styles.txDescription} numberOfLines={2}>
                  {transferTitle}
                </Text>
                {t.recurring && <Repeat size={11} color={colors.stone400} />}
              </View>
              <Text style={styles.txMeta} numberOfLines={2}>
                {transferMeta}
              </Text>
            </View>

            <View style={styles.txSide}>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color: isTransfer
                      ? isIncome
                        ? colors.moss
                        : colors.clay
                      : isIncome
                      ? colors.moss
                      : colors.ink,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {isIncome ? '+' : '-'}
                {formatMoneyForLedger(t.amount, t.ledgerId)}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      <TransactionDetailsModal
        visible={showDetails}
        transaction={t}
        edits={edits}
        accent={accent}
        ledgerName={ledger?.name ?? 'Cash Ledger'}
        ledgerCurrency={ledger?.currencyCode ?? 'USD'}
        counterpartLedgerName={counterpartLedger?.name}
        maskedAccountNumber={maskedAccountNumber}
        onClose={() => setShowDetails(false)}
        onEdit={onEdit ? handleEdit : undefined}
        formatMoney={(value) => formatMoneyForLedger(value, t.ledgerId)}
      />
    </>
  );
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAuditChange(edit: TransactionEditHistory, formatMoney: (n: number) => string) {
  const changes: string[] = [];
  if (edit.before.amount !== edit.after.amount) {
    changes.push(`${formatMoney(edit.before.amount)} to ${formatMoney(edit.after.amount)}`);
  }
  if (edit.before.type !== edit.after.type) {
    changes.push(`${edit.before.type} to ${edit.after.type}`);
  }
  if (edit.before.category !== edit.after.category) {
    changes.push(`${edit.before.category} to ${edit.after.category}`);
  }
  if (edit.before.recurring !== edit.after.recurring) {
    changes.push(edit.after.recurring ? 'marked recurring' : 'removed recurring');
  }
  if (
    JSON.stringify(edit.before.recurringSchedule ?? null) !==
    JSON.stringify(edit.after.recurringSchedule ?? null)
  ) {
    changes.push('updated schedule');
  }
  if (edit.before.date !== edit.after.date) {
    changes.push(`${formatShortDate(edit.before.date)} to ${formatShortDate(edit.after.date)}`);
  }
  return changes.length > 0 ? changes.join(' - ') : 'Details changed';
}

function formatDelta(value: number, formatMoney: (n: number) => string) {
  if (value === 0) return formatMoney(0);
  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`;
}

function TransactionDetailsModal({
  visible,
  transaction,
  edits,
  accent,
  ledgerName,
  ledgerCurrency,
  counterpartLedgerName,
  maskedAccountNumber,
  onClose,
  onEdit,
  formatMoney,
}: {
  visible: boolean;
  transaction: Transaction;
  edits: TransactionEditHistory[];
  accent: string;
  ledgerName: string;
  ledgerCurrency: string;
  counterpartLedgerName?: string;
  maskedAccountNumber: string;
  onClose: () => void;
  onEdit?: () => void;
  formatMoney: (n: number) => string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createTxRowStyles(colors, SWIPE_OPEN), [colors]);
  const isIncome = transaction.type === 'income';
  const isTransfer = Boolean(transaction.transferPairId);
  const recurringLabel = transaction.recurring ? getRecurringDescription(transaction) : 'No';
  const nextDueDate = transaction.recurring ? getNextOccurrenceDate(transaction) : null;
  const transferTitle = isTransfer
    ? transaction.transferDirection === 'out'
      ? `Transfer to ${counterpartLedgerName ?? 'account'}`
      : `Transfer from ${counterpartLedgerName ?? 'account'}`
    : transaction.description;
  const transferMeta = isTransfer
    ? `${ledgerName} ${
        transaction.transferDirection === 'out' ? 'to' : 'from'
      } ${counterpartLedgerName ?? 'another account'} - ${formatShortDate(transaction.date)}`
    : `${transaction.category} - ${ledgerName} - ${formatShortDate(transaction.date)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {isTransfer ? 'Transfer' : 'Transaction'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close transaction details">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScroll}
          >
            <View style={styles.detailHero}>
              <View style={[styles.detailDot, { backgroundColor: `${accent}22` }]}>
                {isTransfer ? (
                  <ArrowLeftRight size={17} color={accent} />
                ) : (
                  <View style={[styles.txDotInner, { backgroundColor: accent }]} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailTitle}>{transferTitle}</Text>
                <Text style={styles.detailMeta}>{transferMeta}</Text>
              </View>
              <Text style={[styles.detailAmount, { color: isIncome ? colors.moss : colors.clay }]}>
                {isIncome ? '+' : '-'}
                {formatMoney(transaction.amount)}
              </Text>
            </View>

            <View style={styles.detailGrid}>
              <DetailItem label="Type" value={isTransfer ? 'transfer' : transaction.type} />
              {isTransfer ? (
                <DetailItem
                  label="Direction"
                  value={transaction.transferDirection === 'out' ? 'sent' : 'received'}
                />
              ) : (
                <DetailItem label="Recurring" value={recurringLabel} />
              )}
              {!isTransfer && nextDueDate ? (
                <DetailItem label="Next due" value={formatDisplayDate(nextDueDate)} />
              ) : null}
              <DetailItem label="Account" value={ledgerName} />
              {isTransfer && counterpartLedgerName ? (
                <DetailItem label="Counterparty" value={counterpartLedgerName} />
              ) : null}
              <DetailItem label="Currency" value={ledgerCurrency} />
              {maskedAccountNumber ? (
                <DetailItem label="Number" value={maskedAccountNumber} />
              ) : null}
              <DetailItem label="Date" value={formatShortDate(transaction.date)} />
            </View>

            {onEdit && (
              <Pressable
                onPress={() => {
                  onClose();
                  onEdit();
                }}
                style={styles.primaryAction}
              >
                <Pencil size={16} color={colors.paper} />
                <Text style={styles.primaryActionLabel}>
                  {isTransfer ? 'Edit transfer' : 'Edit transaction'}
                </Text>
              </Pressable>
            )}

            <View style={styles.auditSection}>
              <View style={styles.auditHeader}>
                <Text style={styles.auditTitle}>Audit Trail</Text>
                <Text style={styles.auditCount}>{edits.length} edits</Text>
              </View>

              {edits.length === 0 ? (
                <View style={styles.auditEmpty}>
                  <Text style={styles.auditEmptyText}>No edits recorded for this transaction.</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {edits.map((edit) => (
                    <View key={edit.id} style={styles.auditCard}>
                      <Text style={styles.auditDate}>{formatLongDate(edit.editedAt)}</Text>
                      <Text style={styles.auditBody}>
                        {formatAuditChange(edit, formatMoney)}
                      </Text>
                      <Text style={styles.auditDelta}>
                        Projection impact: {formatDelta(edit.projectionMonthlyDelta, formatMoney)} monthly
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createTxRowStyles(colors, SWIPE_OPEN), [colors]);

  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
