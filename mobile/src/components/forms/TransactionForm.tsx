import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalendarDays, CreditCard, Pause, Play, X, Repeat } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { TxType, Category, RecurringFrequency, Transaction } from '../../types';
import { CATEGORIES, colorFor } from '../../theme';
import { Field, AddCategorySheet } from './AddCategorySheet';
import { DatePickerSheet } from './DatePickerSheet';
import { createTransactionFormStyles } from './transactionFormStyles';
import {
  buildRecurringSchedule,
  datePickerConfig,
  defaultCategoryForType,
  formatDateLabel,
  isoToday,
  parsePositiveAmount,
  preferredLedgerForForm,
  RECURRING_FREQUENCIES,
  selectableLedgersForTransaction,
  TRANSACTION_TYPES,
  type DatePickerTarget,
} from './transactionFormUtils';

interface TransactionFormProps {
  onClose: () => void;
  transaction?: Transaction | null;
  initialType?: TxType;
}

export function TransactionForm({ onClose, transaction, initialType }: TransactionFormProps) {
  const { colors } = useTheme();
  const {
    addTransaction,
    updateTransaction,
    pauseSchedule,
    resumeSchedule,
    customCategories,
    ledgers,
    activeLedgers,
    activeLedgerId,
  } = useBudget();
  const styles = useMemo(() => createTransactionFormStyles(colors), [colors]);
  const isEditing = Boolean(transaction);
  const todayIso = useMemo(isoToday, []);
  const selectableLedgers = useMemo(
    () => selectableLedgersForTransaction(activeLedgers, ledgers, transaction),
    [activeLedgers, ledgers, transaction],
  );
  const preferredLedgerId = preferredLedgerForForm({
    activeLedgerId,
    selectableLedgers,
    transaction,
  });

  const [type, setType] = useState<TxType>(transaction?.type ?? initialType ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [category, setCategory] = useState<Category>(
    transaction?.category ?? defaultCategoryForType(initialType ?? 'expense'),
  );
  const [ledgerId, setLedgerId] = useState(preferredLedgerId);
  const [date, setDate] = useState(transaction?.date ?? todayIso);
  const [recurring, setRecurring] = useState(transaction?.recurring ?? false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>(
    transaction?.recurringSchedule?.frequency ?? 'monthly',
  );
  const [recurringInterval, setRecurringInterval] = useState(
    String(transaction?.recurringSchedule?.interval ?? 1),
  );
  const [recurringStartDate, setRecurringStartDate] = useState(
    transaction?.recurringSchedule?.startDate ?? transaction?.date ?? todayIso,
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
    setCategory(defaultCategoryForType(type));
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
    const parsedAmount = parsePositiveAmount(amount);
    const targetLedgerId = ledgerId ?? selectableLedgers[0]?.id;
    if (!parsedAmount || !description.trim() || !targetLedgerId) return;
    const recurringSchedule = buildRecurringSchedule({
      autoPost,
      date,
      recurring,
      recurringEndDate,
      recurringFrequency,
      recurringInterval,
      recurringStartDate,
      reminderDaysBefore,
      transaction,
    });
    if (transaction) {
      updateTransaction({
        ...transaction,
        type,
        amount: parsedAmount,
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
        amount: parsedAmount,
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

  const currentCategories = useMemo(
    () => [
      ...(type === 'income' ? CATEGORIES.income : CATEGORIES.expense),
      ...customCategories
        .filter((customCategory) => customCategory.type === type)
        .map((customCategory) => customCategory.title),
    ],
    [customCategories, type],
  );
  const activeDate = datePickerConfig({
    activeDatePicker,
    date,
    recurringEndDate,
    recurringStartDate,
  });
  const canSubmit =
    Boolean(parsePositiveAmount(amount)) &&
    Boolean(description.trim()) &&
    Boolean(selectedLedger);

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
          {TRANSACTION_TYPES.map((t) => {
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
              {currentCategories.map((c) => {
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
                    {
                      backgroundColor: colors.paper,
                      borderWidth: 1,
                      borderColor: colors.borderSoft,
                      borderStyle: 'dashed',
                    },
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
                  {RECURRING_FREQUENCIES.map((frequency) => {
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
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>{isEditing ? 'Save changes' : 'Add to ledger'}</Text>
        </Pressable>
      </View>

      <DatePickerSheet
        visible={Boolean(activeDatePicker)}
        title={activeDate.title}
        value={activeDate.value}
        min={activeDate.min}
        allowClear={activeDatePicker === 'recurringEnd'}
        clearLabel="No end date"
        onSelect={handleDateSelect}
        onClear={() => setRecurringEndDate('')}
        onClose={() => setActiveDatePicker(null)}
      />

      {showAddCategory ? (
        <AddCategorySheet
          type={type}
          onClose={() => setShowAddCategory(false)}
          onSave={(c) => setCategory(c.title)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
