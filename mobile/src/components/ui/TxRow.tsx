import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pencil, Trash2, Repeat, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { Transaction, CustomCategory, TransactionEditHistory } from '../../types';
import { colorFor, fonts } from '../../theme';
import { useBudget } from '../../context/BudgetContext';
import {
  formatDisplayDate,
  getNextOccurrenceDate,
  getRecurringDescription,
} from '../../utils/recurring';

interface TxRowProps {
  t: Transaction;
  isLast: boolean;
  customCategories: CustomCategory[];
  onEdit?: (t: Transaction) => void;
}

const SWIPE_OPEN = 86;
const SWIPE_TRIGGER = 46;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function TxRow({ t, isLast, customCategories, onEdit }: TxRowProps) {
  const { colors } = useTheme();
  const {
    removeTransaction,
    formatMoneyForLedger,
    maskAccountNumber,
    transactionEditHistory,
    ledgers,
  } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showDetails, setShowDetails] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);

  const isIncome = t.type === 'income';
  const accent = colorFor(t.category, customCategories);
  const ledger = ledgers.find((item) => item.id === t.ledgerId);
  const maskedAccountNumber = maskAccountNumber(ledger?.accountNumber);
  const edits = useMemo(
    () => transactionEditHistory.filter((edit) => edit.transactionId === t.id),
    [transactionEditHistory, t.id],
  );

  const animateTo = (value: number) => {
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start(() => {
      currentOffset.current = value;
    });
  };

  const closeSwipe = () => animateTo(0);

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
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(clamp(currentOffset.current + gesture.dx, -SWIPE_OPEN, SWIPE_OPEN));
      },
      onPanResponderRelease: (_, gesture) => {
        const next = currentOffset.current + gesture.dx;
        if (next > SWIPE_TRIGGER && onEdit) {
          animateTo(SWIPE_OPEN);
        } else if (next < -SWIPE_TRIGGER) {
          animateTo(-SWIPE_OPEN);
        } else {
          closeSwipe();
        }
      },
      onPanResponderTerminate: () => closeSwipe(),
    }),
  ).current;

  const handleRowPress = () => {
    if (currentOffset.current !== 0) {
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
          style={[styles.animatedRow, { transform: [{ translateX }] }]}
        >
          <Pressable
            onPress={handleRowPress}
            style={({ pressed }) => [styles.txRow, pressed && { opacity: 0.88 }]}
          >
            <View style={[styles.txDot, { backgroundColor: `${accent}20` }]}>
              <View style={[styles.txDotInner, { backgroundColor: accent }]} />
            </View>

            <View style={styles.txMain}>
              <View style={styles.txTitleRow}>
                <Text style={styles.txDescription} numberOfLines={2}>
                  {t.description}
                </Text>
                {t.recurring && <Repeat size={11} color={colors.stone400} />}
              </View>
              <Text style={styles.txMeta} numberOfLines={2}>
                {t.category} - {ledger?.name ?? 'Cash Ledger'} - {formatShortDate(t.date)}
              </Text>
            </View>

            <View style={styles.txSide}>
              <Text
                style={[
                  styles.txAmount,
                  { color: isIncome ? colors.moss : colors.ink },
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
  maskedAccountNumber: string;
  onClose: () => void;
  onEdit?: () => void;
  formatMoney: (n: number) => string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isIncome = transaction.type === 'income';
  const recurringLabel = transaction.recurring ? getRecurringDescription(transaction) : 'No';
  const nextDueDate = transaction.recurring ? getNextOccurrenceDate(transaction) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Transaction</Text>
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
                <View style={[styles.txDotInner, { backgroundColor: accent }]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailTitle}>{transaction.description}</Text>
                <Text style={styles.detailMeta}>
                  {transaction.category} - {ledgerName} - {formatShortDate(transaction.date)}
                </Text>
              </View>
              <Text style={[styles.detailAmount, { color: isIncome ? colors.moss : colors.clay }]}>
                {isIncome ? '+' : '-'}
                {formatMoney(transaction.amount)}
              </Text>
            </View>

            <View style={styles.detailGrid}>
              <DetailItem label="Type" value={transaction.type} />
              <DetailItem label="Recurring" value={recurringLabel} />
              {nextDueDate ? <DetailItem label="Next due" value={formatDisplayDate(nextDueDate)} /> : null}
              <DetailItem label="Account" value={ledgerName} />
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
                <Text style={styles.primaryActionLabel}>Edit transaction</Text>
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
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    swipeFrame: {
      position: 'relative',
      overflow: 'hidden',
    },
    txRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    swipeActions: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    swipeAction: {
      width: SWIPE_OPEN,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    editAction: { backgroundColor: colors.moss },
    deleteAction: { backgroundColor: colors.clay },
    disabledAction: { opacity: 0.35 },
    actionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.paper,
    },
    animatedRow: {
      backgroundColor: colors.cream,
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
    },
    txDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    txDotInner: { width: 8, height: 8, borderRadius: 4 },
    txMain: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    txTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    txDescription: {
      flexShrink: 1,
      fontFamily: fonts.display,
      fontSize: 15,
      lineHeight: 19,
      color: colors.ink,
    },
    txMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
      lineHeight: 16,
    },
    txSide: {
      alignItems: 'flex-end',
      minWidth: 96,
    },
    txAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
      textAlign: 'right',
      maxWidth: 116,
    },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    sheet: {
      maxHeight: '86%',
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 16,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.chip,
      marginTop: -8,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    sheetScroll: { gap: 18, paddingBottom: 8 },
    detailHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.paper,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    detailDot: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailTitle: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.ink,
      lineHeight: 22,
    },
    detailMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
    },
    detailAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
      textAlign: 'right',
    },
    detailGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    detailItem: {
      width: '48%',
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 4,
    },
    detailLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.stone500,
    },
    detailValue: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
      textTransform: 'capitalize',
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    primaryActionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
    },
    auditSection: { gap: 12 },
    auditHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    auditTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    auditCount: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    auditEmpty: {
      padding: 18,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderSoft,
    },
    auditEmptyText: {
      fontFamily: fonts.displayItalic,
      fontSize: 13,
      color: colors.stone500,
      textAlign: 'center',
    },
    auditCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 4,
    },
    auditDate: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
    },
    auditBody: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
      lineHeight: 18,
    },
    auditDelta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
  });
