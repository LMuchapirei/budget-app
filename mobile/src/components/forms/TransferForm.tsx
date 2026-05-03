import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeftRight, CalendarDays, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { LedgerAccount } from '../../types';
import { fonts } from '../../theme';
import { convertExchangeAmount } from '../../services/exchangeRates';
import { formatCurrencyAmount } from '../../utils/currency';
import { Field } from './AddCategorySheet';
import { DatePickerSheet } from './DatePickerSheet';

interface TransferFormProps {
  visible: boolean;
  mode: 'add' | 'edit';
  pairId?: string | null;
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

export function TransferForm({ visible, mode, pairId, onClose }: TransferFormProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    addTransfer,
    updateTransfer,
    removeTransfer,
    transactions,
    activeLedgers,
    ledgers,
    fxRates,
  } = useBudget();

  const isEditing = mode === 'edit' && Boolean(pairId);
  const halves = useMemo(
    () => (pairId ? transactions.filter((t) => t.transferPairId === pairId) : []),
    [pairId, transactions],
  );
  const outHalf = halves.find((h) => h.transferDirection === 'out');
  const inHalf = halves.find((h) => h.transferDirection === 'in');

  const selectableLedgers = useMemo<LedgerAccount[]>(() => {
    const extras: LedgerAccount[] = [];
    [outHalf, inHalf].forEach((half) => {
      if (!half?.ledgerId) return;
      if (activeLedgers.some((l) => l.id === half.ledgerId)) return;
      const archived = ledgers.find((l) => l.id === half.ledgerId);
      if (archived) extras.push(archived);
    });
    return [...activeLedgers, ...extras];
  }, [activeLedgers, ledgers, outHalf, inHalf]);

  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [amountInOverride, setAmountInOverride] = useState<string>('');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (isEditing && outHalf && inHalf) {
      setFromId(outHalf.ledgerId ?? '');
      setToId(inHalf.ledgerId ?? '');
      setAmount(String(outHalf.amount));
      setAmountInOverride(String(inHalf.amount));
      setOverrideEnabled(Number(outHalf.amount) !== Number(inHalf.amount));
      setDate(outHalf.date);
      const isAutoDescription =
        outHalf.description === `Transfer to ${ledgers.find((l) => l.id === inHalf.ledgerId)?.name ?? ''}`;
      setDescription(isAutoDescription ? '' : outHalf.description);
    } else {
      const first = activeLedgers[0]?.id ?? '';
      const second = activeLedgers.find((l) => l.id !== first)?.id ?? '';
      setFromId(first);
      setToId(second);
      setAmount('');
      setAmountInOverride('');
      setOverrideEnabled(false);
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
    setShowDatePicker(false);
  }, [visible, isEditing, outHalf, inHalf, activeLedgers, ledgers]);

  const fromLedger = selectableLedgers.find((l) => l.id === fromId);
  const toLedger = selectableLedgers.find((l) => l.id === toId);
  const sameLedger = fromId && toId && fromId === toId;
  const currencyMismatch =
    fromLedger && toLedger && fromLedger.currencyCode !== toLedger.currencyCode;

  const parsedAmount = Number(amount);
  const parsedAmountIn = Number(amountInOverride);
  const autoConversion = useMemo(() => {
    if (!currencyMismatch || !fromLedger || !toLedger) return null;
    return convertExchangeAmount(
      parsedAmount,
      fromLedger.currencyCode,
      toLedger.currencyCode,
      fxRates,
    );
  }, [currencyMismatch, fromLedger, fxRates, parsedAmount, toLedger]);
  const requiresManualReceived = Boolean(
    currencyMismatch && autoConversion && !autoConversion.converted,
  );
  const effectiveOverrideEnabled = overrideEnabled || requiresManualReceived;
  const canSave =
    Boolean(fromLedger) &&
    Boolean(toLedger) &&
    !sameLedger &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (!effectiveOverrideEnabled ||
      (!Number.isNaN(parsedAmountIn) && parsedAmountIn > 0));

  const transferFxHint = useMemo(() => {
    if (!currencyMismatch || !fromLedger || !toLedger) return null;
    if (!autoConversion?.converted) {
      return 'No FX rate available - enter the received amount manually.';
    }
    if (!Number.isFinite(autoConversion.amount) || autoConversion.amount <= 0) return null;
    return `${formatCurrencyAmount(parsedAmount, fromLedger.currencySymbol)} will be recorded as about ${formatCurrencyAmount(autoConversion.amount, toLedger.currencySymbol)}.`;
  }, [autoConversion, currencyMismatch, fromLedger, parsedAmount, toLedger]);

  const handleSwap = () => {
    if (!fromId || !toId) return;
    const next = fromId;
    setFromId(toId);
    setToId(next);
  };

  const handleSubmit = () => {
    if (!canSave || !fromLedger || !toLedger) return;
    Keyboard.dismiss();
    const draft = {
      fromLedgerId: fromLedger.id,
      toLedgerId: toLedger.id,
      amount: parsedAmount,
      amountIn: effectiveOverrideEnabled ? parsedAmountIn : undefined,
      date,
      description: description.trim() || undefined,
    };
    if (isEditing && pairId) updateTransfer(pairId, draft);
    else addTransfer(draft);
    onClose();
  };

  const handleDelete = () => {
    if (!isEditing || !pairId) return;
    Alert.alert(
      'Delete transfer?',
      'Both sides of the transfer will be removed. Linked accounts are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeTransfer(pairId);
            onClose();
          },
        },
      ],
    );
  };

  const showOverrideToggle = currencyMismatch || overrideEnabled;

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
            <Text style={styles.sheetTitle}>
              {isEditing ? 'Edit transfer' : 'New transfer'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
            keyboardShouldPersistTaps="always"
            style={styles.scroll}
          >
            <View style={styles.amountBlock}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountSign}>{fromLedger?.currencySymbol ?? '$'}</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.stone400}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={styles.amountInput}
                />
              </View>
              {fromLedger ? (
                <Text style={styles.amountMeta}>
                  Sent in {fromLedger.currencyCode}
                </Text>
              ) : null}
              {selectableLedgers.length < 2 ? (
                <Text style={styles.warningText}>
                  Add a second active account before creating a transfer.
                </Text>
              ) : null}
            </View>

            <Field label="From">
              <View style={styles.chipWrap}>
                {selectableLedgers.map((ledger) => {
                  const active = fromId === ledger.id;
                  const disabled = ledger.id === toId;
                  return (
                    <Pressable
                      key={`from-${ledger.id}`}
                      onPress={() => setFromId(ledger.id)}
                      disabled={disabled}
                      style={[
                        styles.chip,
                        active && { backgroundColor: colors.ink },
                        disabled && { opacity: 0.35 },
                      ]}
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: ledger.color || colors.rust },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: active ? colors.paper : colors.inkSoft },
                        ]}
                      >
                        {ledger.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Pressable
              onPress={handleSwap}
              disabled={!fromId || !toId}
              style={({ pressed }) => [
                styles.swapButton,
                (!fromId || !toId) && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <ArrowLeftRight size={14} color={colors.rust} />
              <Text style={styles.swapLabel}>Swap direction</Text>
            </Pressable>

            <Field label="To">
              <View style={styles.chipWrap}>
                {selectableLedgers.map((ledger) => {
                  const active = toId === ledger.id;
                  const disabled = ledger.id === fromId;
                  return (
                    <Pressable
                      key={`to-${ledger.id}`}
                      onPress={() => setToId(ledger.id)}
                      disabled={disabled}
                      style={[
                        styles.chip,
                        active && { backgroundColor: colors.ink },
                        disabled && { opacity: 0.35 },
                      ]}
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: ledger.color || colors.rust },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: active ? colors.paper : colors.inkSoft },
                        ]}
                      >
                        {ledger.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {sameLedger ? (
              <Text style={styles.warningText}>
                From and To accounts must be different.
              </Text>
            ) : null}

            {showOverrideToggle ? (
              <View style={styles.overrideBlock}>
                <View style={styles.overrideHead}>
                  <Text style={styles.fieldLabel}>
                    Amount received {toLedger ? `(${toLedger.currencyCode})` : ''}
                  </Text>
                  <Pressable
                    onPress={() => setOverrideEnabled((v) => !v)}
                    disabled={requiresManualReceived}
                    style={styles.overrideToggle}
                  >
                    <Text
                      style={[
                        styles.overrideToggleLabel,
                        effectiveOverrideEnabled && { color: colors.rust },
                      ]}
                    >
                      {requiresManualReceived
                        ? 'Manual required'
                        : effectiveOverrideEnabled
                        ? 'Auto convert'
                        : 'Set manually'}
                    </Text>
                  </Pressable>
                </View>
                {effectiveOverrideEnabled ? (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountSign}>
                      {toLedger?.currencySymbol ?? '$'}
                    </Text>
                    <TextInput
                      value={amountInOverride}
                      onChangeText={setAmountInOverride}
                      placeholder="0.00"
                      placeholderTextColor={colors.stone400}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.amountInput}
                    />
                  </View>
                ) : (
                  transferFxHint && <Text style={styles.helperCopy}>{transferFxHint}</Text>
                )}
              </View>
            ) : null}

            <Field label="Date">
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              >
                <CalendarDays size={14} color={colors.stone500} />
                <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
              </Pressable>
            </Field>

            <Field label="Note">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional reason for the transfer"
                placeholderTextColor={colors.stone400}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </Field>

            {isEditing ? (
              <Pressable onPress={handleDelete} style={styles.deleteRow}>
                <Trash2 size={16} color={colors.clay} />
                <Text style={styles.deleteLabel}>Delete transfer</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSave}
            style={[styles.submit, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>
              {isEditing ? 'Save changes' : 'Send transfer'}
            </Text>
          </Pressable>
        </View>

        <DatePickerSheet
          visible={showDatePicker}
          title="Transfer date"
          value={date}
          onClose={() => setShowDatePicker(false)}
          onSelect={(iso) => {
            setDate(iso);
            setShowDatePicker(false);
          }}
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
    scroll: {
      maxHeight: 480,
    },
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    helperCopy: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 15,
    },
    amountBlock: {
      gap: 6,
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
    amountMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
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
    },
    swapButton: {
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
      alignSelf: 'flex-start',
    },
    swapLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.rust,
    },
    overrideBlock: {
      gap: 8,
    },
    overrideHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    overrideToggle: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    overrideToggleLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone600,
    },
    warningText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.clay,
      fontStyle: 'italic',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignSelf: 'flex-start',
    },
    dateLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    deleteLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.clay,
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
