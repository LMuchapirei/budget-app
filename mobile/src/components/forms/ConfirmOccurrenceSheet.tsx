import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalendarDays, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { ConfirmOccurrenceOverride, ScheduledOccurrence } from '../../types';
import { fonts } from '../../theme';
import { Field } from './AddCategorySheet';
import { DatePickerSheet } from './DatePickerSheet';

interface ConfirmOccurrenceSheetProps {
  visible: boolean;
  occurrence: ScheduledOccurrence | null;
  onConfirm: (override: ConfirmOccurrenceOverride) => void;
  onClose: () => void;
}

function formatDateLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ConfirmOccurrenceSheet({
  visible,
  occurrence,
  onConfirm,
  onClose,
}: ConfirmOccurrenceSheetProps) {
  const { colors } = useTheme();
  const { activeLedgers, ledgers } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [ledgerId, setLedgerId] = useState<string | undefined>();
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const selectableLedgers = useMemo(() => {
    if (!occurrence?.source.ledgerId) return activeLedgers;
    if (activeLedgers.some((ledger) => ledger.id === occurrence.source.ledgerId)) {
      return activeLedgers;
    }
    const currentLedger = ledgers.find((ledger) => ledger.id === occurrence.source.ledgerId);
    return currentLedger ? [...activeLedgers, currentLedger] : activeLedgers;
  }, [activeLedgers, ledgers, occurrence?.source.ledgerId]);

  const selectedLedger = selectableLedgers.find((ledger) => ledger.id === ledgerId);

  useEffect(() => {
    if (!visible || !occurrence) return;
    setAmount(String(occurrence.amount));
    setDate(occurrence.effectiveDueDate);
    setLedgerId(occurrence.source.ledgerId);
    setCategory(occurrence.source.category);
    setNotes('');
    setShowDatePicker(false);
  }, [occurrence, visible]);

  const parsedAmount = Number(amount);
  const canConfirm =
    Boolean(occurrence) &&
    amount.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    Boolean(date) &&
    Boolean(ledgerId) &&
    category.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    Keyboard.dismiss();
    onConfirm({
      amount: parsedAmount,
      date,
      ledgerId,
      category: category.trim(),
      notes: notes.trim() || undefined,
    });
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
            <Text style={styles.sheetTitle}>Confirm occurrence</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {occurrence ? (
            <View style={{ gap: 18 }}>
              <Text style={styles.sourceTitle}>{occurrence.source.description}</Text>

              <Field label={`Amount (${selectedLedger?.currencyCode ?? occurrence.currencyCode})`}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountSign}>
                    {selectedLedger?.currencySymbol ?? occurrence.currencySymbol}
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.stone400}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />
                </View>
              </Field>

              <Field label="Post date">
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                  <CalendarDays size={15} color={colors.stone500} />
                  <Text style={styles.dateButtonText}>{formatDateLabel(date)}</Text>
                </Pressable>
              </Field>

              <Field label="Account">
                <View style={styles.chipWrap}>
                  {selectableLedgers.map((ledger) => {
                    const active = ledger.id === ledgerId;
                    return (
                      <Pressable
                        key={ledger.id}
                        onPress={() => setLedgerId(ledger.id)}
                        style={[styles.chip, active && { backgroundColor: colors.ink }]}
                      >
                        <View
                          style={[
                            styles.chipDot,
                            { backgroundColor: ledger.color || colors.rust },
                          ]}
                        />
                        <Text style={[styles.chipLabel, active && { color: colors.paper }]}>
                          {ledger.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Category">
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Category"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
              </Field>

              <Field label="Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
              </Field>
            </View>
          ) : null}

          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            style={[styles.submit, !canConfirm && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>Post transaction</Text>
          </Pressable>
        </View>

        <DatePickerSheet
          visible={showDatePicker}
          title="Post date"
          value={date}
          onSelect={setDate}
          onClose={() => setShowDatePicker(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      maxHeight: '92%',
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
    sourceTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 17,
      color: colors.ink,
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    amountSign: { fontFamily: fonts.displayLight, fontSize: 28, color: colors.stone400 },
    amountInput: {
      flex: 1,
      fontFamily: fonts.displayLight,
      fontSize: 28,
      color: colors.ink,
      paddingVertical: 4,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    dateButtonText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.ink,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    chipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
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
      letterSpacing: 0.5,
    },
  });
