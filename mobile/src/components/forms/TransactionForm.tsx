import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalendarDays, CreditCard, Pause, Play, X, Repeat } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../../context/BudgetContext';
import type { TxType, Category, Transaction, RecurringFrequency, RecurringSchedule } from '../../types';
import { fonts, CATEGORIES, colorFor } from '../../theme';
import { Field, AddCategorySheet } from './AddCategorySheet';
import { DatePickerSheet } from './DatePickerSheet';

interface TransactionFormProps {
  onClose: () => void;
  transaction?: Transaction | null;
}

type DatePickerTarget = 'transaction' | 'recurringStart' | 'recurringEnd';

function formatDateLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TransactionForm({ onClose, transaction }: TransactionFormProps) {
  const { colors } = useTheme();
  const {
    addTransaction,
    updateTransaction,
    pauseSchedule,
    resumeSchedule,
    customCategories,
    addCustomCategory,
    ledgers,
    activeLedgers,
    activeLedgerId,
  } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEditing = Boolean(transaction);
  const selectableLedgers = useMemo(() => {
    if (!transaction?.ledgerId) return activeLedgers;
    if (activeLedgers.some((l) => l.id === transaction.ledgerId)) return activeLedgers;
    const archivedTarget = ledgers.find((l) => l.id === transaction.ledgerId);
    return archivedTarget ? [...activeLedgers, archivedTarget] : activeLedgers;
  }, [activeLedgers, ledgers, transaction?.ledgerId]);
  const preferredLedgerId =
    transaction?.ledgerId ??
    (activeLedgerId === ALL_LEDGER_ID
      ? selectableLedgers[0]?.id
      : activeLedgerId) ??
    selectableLedgers[0]?.id;

  const [type, setType] = useState<TxType>(transaction?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [category, setCategory] = useState<Category>(transaction?.category ?? 'Food');
  const [ledgerId, setLedgerId] = useState(preferredLedgerId);
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(transaction?.recurring ?? false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>(
    transaction?.recurringSchedule?.frequency ?? 'monthly',
  );
  const [recurringInterval, setRecurringInterval] = useState(
    String(transaction?.recurringSchedule?.interval ?? 1),
  );
  const [recurringStartDate, setRecurringStartDate] = useState(
    transaction?.recurringSchedule?.startDate ?? transaction?.date ?? new Date().toISOString().split('T')[0],
  );
  const [recurringEndDate, setRecurringEndDate] = useState(transaction?.recurringSchedule?.endDate ?? '');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(
    String(transaction?.recurringSchedule?.reminderDaysBefore ?? 1),
  );
  const [autoPost, setAutoPost] = useState(
    (transaction?.recurringSchedule?.postMode ?? (transaction?.type === 'income' ? 'auto' : 'confirm')) === 'auto',
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<DatePickerTarget | null>(null);
  const skipInitialCategoryReset = useRef(Boolean(transaction));
  const selectedLedger =
    ledgers.find((ledger) => ledger.id === ledgerId) ?? selectableLedgers[0];

  useEffect(() => {
    if (skipInitialCategoryReset.current) {
      skipInitialCategoryReset.current = false;
      return;
    }
    setCategory(type === 'income' ? 'Salary' : 'Food');
    if (!transaction) {
      setAutoPost(type === 'income');
    }
  }, [type]);

  useEffect(() => {
    if (!ledgerId && preferredLedgerId) {
      setLedgerId(preferredLedgerId);
    }
  }, [ledgerId, preferredLedgerId]);

  const handleSubmit = () => {
    Keyboard.dismiss();
    const n = Number(amount);
    const targetLedgerId = ledgerId ?? selectableLedgers[0]?.id;
    if (!amount || !description.trim() || !targetLedgerId || Number.isNaN(n) || n <= 0) return;
    const interval = Math.max(1, Number(recurringInterval) || 1);
    const reminder = Math.max(0, Number(reminderDaysBefore) || 0);
    const recurringSchedule: RecurringSchedule | undefined = recurring
      ? {
          frequency: recurringFrequency,
          interval,
          startDate: recurringStartDate.trim() || date,
          endDate: recurringEndDate.trim() || undefined,
          reminderDaysBefore: reminder,
          postMode: autoPost ? 'auto' : 'confirm',
          paused: transaction?.recurringSchedule?.paused ?? false,
          pausedAt: transaction?.recurringSchedule?.pausedAt,
        }
      : undefined;
    if (transaction) {
      updateTransaction({
        ...transaction,
        type,
        amount: n,
        description: description.trim(),
        category,
        ledgerId: targetLedgerId,
        date,
        recurring,
        recurringSchedule,
      });
    } else {
      addTransaction({
        type,
        amount: n,
        description: description.trim(),
        category,
        ledgerId: targetLedgerId,
        date,
        recurring,
        recurringSchedule,
      });
    }
    onClose();
  };

  const schedulePaused = Boolean(transaction?.recurringSchedule?.paused);
  const handlePauseResumeSchedule = () => {
    if (!transaction?.id) return;
    if (schedulePaused) {
      resumeSchedule(transaction.id);
      onClose();
      return;
    }

    Alert.alert(
      'Pause this schedule?',
      'No new occurrences will be generated until you resume. Resuming starts from today without backfilling the pause gap.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause schedule',
          style: 'destructive',
          onPress: () => {
            pauseSchedule(transaction.id);
            onClose();
          },
        },
      ],
    );
  };

  const currentCategories = [
    ...(type === 'income' ? CATEGORIES.income : CATEGORIES.expense),
    ...customCategories.filter(c => c.type === type).map(c => c.title)
  ];
  const activeDateValue =
    activeDatePicker === 'recurringStart'
      ? recurringStartDate
      : activeDatePicker === 'recurringEnd'
      ? recurringEndDate || recurringStartDate || date
      : date;
  const activeDateTitle =
    activeDatePicker === 'recurringStart'
      ? 'First due date'
      : activeDatePicker === 'recurringEnd'
      ? 'Ends on'
      : 'Entry date';
  const activeDateMin = activeDatePicker === 'recurringEnd' ? recurringStartDate || date : undefined;

  const handleDateSelect = (iso: string) => {
    if (activeDatePicker === 'recurringStart') {
      setRecurringStartDate(iso);
      if (recurringEndDate && recurringEndDate < iso) {
        setRecurringEndDate(iso);
      }
      return;
    }
    if (activeDatePicker === 'recurringEnd') {
      setRecurringEndDate(iso);
      return;
    }
    const previousDate = date;
    setDate(iso);
    if (!recurringStartDate || recurringStartDate === previousDate) {
      setRecurringStartDate(iso);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      style={styles.modalRoot}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{isEditing ? 'Edit entry' : 'New entry'}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <X size={20} color={colors.stone500} />
          </Pressable>
        </View>

        <View style={styles.typeToggle}>
          {(['expense', 'income'] as TxType[]).map((t) => {
            const active = type === t;
            const bg =
              active && t === 'income'
                ? colors.moss
                : active && t === 'expense'
                ? colors.clay
                : 'transparent';
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeButton, { backgroundColor: bg }]}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    { color: active ? colors.paper : colors.inkSoft },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
        >
          <Field label="Amount">
            <View style={styles.amountRow}>
              <Text style={styles.amountSign}>{selectedLedger?.currencySymbol ?? '$'}</Text>
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
          </Field>

          <Field label="Description">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What was it for?"
              placeholderTextColor={colors.stone400}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={styles.input}
            />
          </Field>

          <Field label="Category">
            <View style={styles.chipWrap}>
              {currentCategories.map((c, i) => {
                const active = category === c;
                return (
                  <View key={c}>
                    <Pressable
                      onPress={() => setCategory(c)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? colorFor(c, customCategories)
                            : colors.chip,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: active ? colors.paper : colors.inkSoft },
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
              <View>
                <Pressable
                onPress={() => setShowAddCategory(true)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.borderSoft, borderStyle: 'dashed' },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.stone500 }]}>+ New</Text>
              </Pressable>
              </View>
            </View>
          </Field>

          <Field label="Account">
            <View style={styles.chipWrap}>
              {selectableLedgers.map((ledger) => {
                const active = ledgerId === ledger.id;
                return (
                  <Pressable
                    key={ledger.id}
                    onPress={() => setLedgerId(ledger.id)}
                    style={[
                      styles.accountChip,
                      active && { backgroundColor: colors.ink },
                    ]}
                  >
                    <CreditCard size={13} color={active ? colors.paper : colors.stone500} />
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: active ? colors.paper : colors.inkSoft },
                      ]}
                    >
                      {ledger.name}
                      <Text style={styles.accountCurrency}> {ledger.currencySymbol}</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Date">
            <Pressable
              onPress={() => setActiveDatePicker('transaction')}
              style={styles.dateButton}
            >
              <CalendarDays size={15} color={colors.stone500} />
              <Text style={styles.dateButtonText}>{formatDateLabel(date)}</Text>
            </Pressable>
          </Field>

          <View style={styles.recurringRow}>
            <View style={styles.recurringLabelGroup}>
              <Repeat size={14} color={colors.stone500} />
              <Text style={styles.recurringRowLabel}>Recurring schedule</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ true: colors.rust, false: colors.chip }}
              thumbColor={colors.cream}
            />
          </View>

          {recurring ? (
            <View style={styles.schedulePanel}>
              <Field label="Frequency">
                <View style={styles.chipWrap}>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((frequency) => {
                    const active = recurringFrequency === frequency;
                    return (
                      <Pressable
                        key={frequency}
                        onPress={() => setRecurringFrequency(frequency)}
                        style={[styles.chip, active && { backgroundColor: colors.ink }]}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            { color: active ? colors.paper : colors.inkSoft },
                          ]}
                        >
                          {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <View style={styles.scheduleGrid}>
                <View style={styles.scheduleGridItem}>
                  <Field label="Every">
                    <TextInput
                      value={recurringInterval}
                      onChangeText={setRecurringInterval}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.input}
                    />
                  </Field>
                </View>
                <View style={styles.scheduleGridItem}>
                  <Field label="Reminder days">
                    <TextInput
                      value={reminderDaysBefore}
                      onChangeText={setReminderDaysBefore}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.input}
                    />
                  </Field>
                </View>
              </View>

              <Field label="First due date">
                <Pressable
                  onPress={() => setActiveDatePicker('recurringStart')}
                  style={styles.dateButton}
                >
                  <CalendarDays size={15} color={colors.stone500} />
                  <Text style={styles.dateButtonText}>
                    {formatDateLabel(recurringStartDate)}
                  </Text>
                </Pressable>
              </Field>

              <Field label="Ends on (optional)">
                <Pressable
                  onPress={() => setActiveDatePicker('recurringEnd')}
                  style={styles.dateButton}
                >
                  <CalendarDays size={15} color={colors.stone500} />
                  <Text
                    style={[
                      styles.dateButtonText,
                      !recurringEndDate && styles.dateButtonPlaceholder,
                    ]}
                  >
                    {recurringEndDate ? formatDateLabel(recurringEndDate) : 'No end date'}
                  </Text>
                </Pressable>
              </Field>

              <View style={styles.recurringRow}>
                <View style={styles.recurringLabelGroup}>
                  <Repeat size={14} color={colors.stone500} />
                  <View>
                    <Text style={styles.recurringRowLabel}>Auto-post without confirming</Text>
                    <Text style={styles.scheduleHint}>
                      {autoPost ? 'Creates entries when due.' : 'Sends due dates to Bills first.'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={autoPost}
                  onValueChange={setAutoPost}
                  trackColor={{ true: colors.rust, false: colors.chip }}
                  thumbColor={colors.cream}
                />
              </View>

              {isEditing && transaction?.recurringSchedule ? (
                <Pressable onPress={handlePauseResumeSchedule} style={styles.pauseScheduleButton}>
                  {schedulePaused ? (
                    <Play size={14} color={colors.moss} />
                  ) : (
                    <Pause size={14} color={colors.stone600} />
                  )}
                  <Text
                    style={[
                      styles.pauseScheduleLabel,
                      schedulePaused && { color: colors.moss },
                    ]}
                  >
                    {schedulePaused ? 'Resume schedule' : 'Pause schedule'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={handleSubmit}
          disabled={!amount || !description.trim() || !selectedLedger}
          style={({ pressed }) => [
            styles.submit,
            (!amount || !description.trim() || !selectedLedger) && styles.submitDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>{isEditing ? 'Save changes' : 'Add to ledger'}</Text>
        </Pressable>
      </View>

      <DatePickerSheet
        visible={Boolean(activeDatePicker)}
        title={activeDateTitle}
        value={activeDateValue}
        min={activeDateMin}
        allowClear={activeDatePicker === 'recurringEnd'}
        clearLabel="No end date"
        onSelect={handleDateSelect}
        onClear={() => setRecurringEndDate('')}
        onClose={() => setActiveDatePicker(null)}
      />

      <Modal visible={showAddCategory} transparent animationType="slide">
        <AddCategorySheet
          type={type}
          onClose={() => setShowAddCategory(false)}
          onSave={(c) => {
            addCustomCategory(c);
            setCategory(c.title);
            setShowAddCategory(false);
          }}
        />
      </Modal>
    </KeyboardAvoidingView>
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
      borderColor: 'rgba(139,90,60,0.2)',
      gap: 18,
      maxHeight: '90%',
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
    typeToggle: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
    },
    typeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
    },
    formScroll: {
      maxHeight: 420,
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
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(139,90,60,0.2)',
      color: colors.ink,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(139,90,60,0.2)',
    },
    dateButtonText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.ink,
    },
    dateButtonPlaceholder: {
      color: colors.stone400,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
    accountCurrency: {
      fontFamily: fonts.body,
      fontSize: 11,
    },
    recurringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
    },
    recurringLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recurringRowLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
    },
    scheduleHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    schedulePanel: {
      gap: 14,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    scheduleGrid: {
      flexDirection: 'row',
      gap: 14,
    },
    scheduleGridItem: {
      flex: 1,
      minWidth: 0,
    },
    pauseScheduleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    pauseScheduleLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.stone600,
    },
    submit: {
      backgroundColor: colors.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
      marginTop: 4,
    },
    submitDisabled: { opacity: 0.4 },
    submitLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.5,
    },
  });
