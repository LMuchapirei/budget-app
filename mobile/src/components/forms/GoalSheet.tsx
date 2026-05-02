import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { CalendarDays, CheckCircle2, Pause, Play, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { Goal } from '../../types';
import { fonts } from '../../theme';
import { DatePickerSheet } from './DatePickerSheet';

interface GoalSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  goal?: Goal | null;
  onClose: () => void;
}

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function tomorrowISO() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDateLabel(iso: string) {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function GoalSheet({ visible, mode, goal, onClose }: GoalSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    activeLedgers,
    goals,
    addGoal,
    updateGoal,
    removeGoal,
    pauseGoal,
    resumeGoal,
    markGoalComplete,
    ledgerBalance,
    formatMoneyForLedger,
  } = useBudget();

  const isEditing = mode === 'edit' && Boolean(goal);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  const selectedLedger = activeLedgers.find((ledger) => ledger.id === ledgerId) ?? null;
  const currentSaved = selectedLedger ? ledgerBalance(selectedLedger.id) : 0;
  const duplicateGoal = useMemo(
    () =>
      goals.find(
        (item) =>
          item.id !== goal?.id &&
          item.ledgerId &&
          item.ledgerId === ledgerId,
      ),
    [goal?.id, goals, ledgerId],
  );

  useEffect(() => {
    if (!visible) return;
    if (isEditing && goal) {
      const existingActiveLedger = activeLedgers.find((ledger) => ledger.id === goal.ledgerId);
      setName(goal.name);
      setTarget(String(goal.targetAmount));
      setDeadlineEnabled(Boolean(goal.deadline));
      setDeadline(goal.deadline ?? '');
      setLedgerId(existingActiveLedger?.id ?? goal.ledgerId ?? null);
      setNotes(goal.notes ?? '');
      setShowDeadlinePicker(false);
    } else {
      const firstSavings =
        activeLedgers.find((ledger) =>
          ledger.accountType === 'savings' || ledger.accountType === 'mobile-money',
        ) ?? activeLedgers[0];
      setName('');
      setTarget('');
      setDeadlineEnabled(false);
      setDeadline('');
      setLedgerId(firstSavings?.id ?? null);
      setNotes('');
      setShowDeadlinePicker(false);
    }
  }, [activeLedgers, goal, isEditing, visible]);

  const parsedTarget = Number(target.trim());
  const parsedDeadline = deadlineEnabled ? parseISODate(deadline.trim()) : null;
  const today = parseISODate(todayISO());
  const deadlineIsFuture =
    !deadlineEnabled || (Boolean(parsedDeadline) && Boolean(today) && parsedDeadline! > today!);
  const ledgerIsActive = Boolean(selectedLedger);
  const canSave =
    name.trim().length > 0 &&
    target.trim().length > 0 &&
    !Number.isNaN(parsedTarget) &&
    parsedTarget > 0 &&
    ledgerIsActive &&
    !duplicateGoal &&
    (!deadlineEnabled || Boolean(parsedDeadline)) &&
    (isEditing || deadlineIsFuture);

  const persistGoal = () => {
    if (!selectedLedger) return;
    const payload = {
      name: name.trim(),
      targetAmount: parsedTarget,
      currencyCode: selectedLedger.currencyCode,
      currencySymbol: selectedLedger.currencySymbol,
      deadline: deadlineEnabled ? deadline.trim() : undefined,
      ledgerId: selectedLedger.id,
      notes: notes.trim() || undefined,
    };

    if (isEditing && goal) {
      updateGoal({ ...goal, ...payload });
    } else {
      addGoal(payload);
    }
    onClose();
  };

  const handleSave = () => {
    if (!canSave || !selectedLedger) return;
    if (parsedTarget <= currentSaved && goal?.status !== 'completed') {
      Alert.alert(
        'Target already reached',
        `${selectedLedger.name} already has ${formatMoneyForLedger(currentSaved, selectedLedger.id)} saved. Save this goal anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: persistGoal },
        ],
      );
      return;
    }
    persistGoal();
  };

  const handleDelete = () => {
    if (!goal) return;
    Alert.alert(
      'Delete goal?',
      `Remove ${goal.name}? Transactions in the linked account are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeGoal(goal.id);
            onClose();
          },
        },
      ],
    );
  };

  const handlePauseToggle = () => {
    if (!goal) return;
    if (goal.status === 'paused') {
      resumeGoal(goal.id);
    } else {
      pauseGoal(goal.id);
    }
    onClose();
  };

  const handleMarkComplete = () => {
    if (!goal) return;
    markGoalComplete(goal.id);
    onClose();
  };

  const handleDeadlineToggle = (enabled: boolean) => {
    setDeadlineEnabled(enabled);
    if (enabled && !deadline) {
      setDeadline(tomorrowISO());
    }
    if (!enabled) {
      setDeadline('');
      setShowDeadlinePicker(false);
    }
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
            <Text style={styles.sheetTitle}>{isEditing ? 'Edit goal' : 'New goal'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
            keyboardShouldPersistTaps="always"
            style={styles.scroll}
          >
            <Field label="Goal name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Emergency fund"
                placeholderTextColor={colors.stone400}
                style={styles.input}
              />
            </Field>

            <Field label={`Target amount (${selectedLedger?.currencyCode ?? 'account currency'})`}>
              <View style={styles.amountRow}>
                <Text style={styles.amountSign}>{selectedLedger?.currencySymbol ?? '$'}</Text>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  placeholder="0.00"
                  placeholderTextColor={colors.stone400}
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                />
              </View>
              {selectedLedger ? (
                <Text style={styles.helperCopy}>
                  Current saved: {formatMoneyForLedger(currentSaved, selectedLedger.id)}
                </Text>
              ) : null}
            </Field>

            <Field label="Linked account">
              {activeLedgers.length === 0 ? (
                <Text style={styles.warningText}>Create an account before adding a goal.</Text>
              ) : (
                <View style={styles.chipWrap}>
                  {activeLedgers.map((ledger) => {
                    const active = ledgerId === ledger.id;
                    return (
                      <Pressable
                        key={ledger.id}
                        onPress={() => setLedgerId(ledger.id)}
                        style={[
                          styles.chip,
                          active && { backgroundColor: colors.ink },
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
              )}
              {isEditing && goal?.ledgerId && !selectedLedger ? (
                <Text style={styles.warningText}>
                  Linked account is archived or missing. Pick an active account to save.
                </Text>
              ) : null}
              {duplicateGoal ? (
                <Text style={styles.warningText}>
                  {duplicateGoal.name} already uses this account.
                </Text>
              ) : null}
            </Field>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Deadline</Text>
                <Text style={styles.helperCopy}>Turn on to calculate monthly pacing.</Text>
              </View>
              <Switch
                value={deadlineEnabled}
                onValueChange={handleDeadlineToggle}
                trackColor={{ true: colors.rust, false: colors.chip }}
                thumbColor={colors.cream}
              />
            </View>

            {deadlineEnabled ? (
              <Field label="Target date">
                <Pressable
                  onPress={() => setShowDeadlinePicker(true)}
                  style={styles.dateButton}
                >
                  <CalendarDays size={15} color={colors.stone500} />
                  <Text
                    style={[
                      styles.dateButtonText,
                      !deadline && styles.dateButtonPlaceholder,
                    ]}
                  >
                    {deadline ? formatDateLabel(deadline) : 'Pick a date'}
                  </Text>
                </Pressable>
                {!isEditing && !deadlineIsFuture ? (
                  <Text style={styles.warningText}>
                    Pick a future date for a new goal.
                  </Text>
                ) : null}
              </Field>
            ) : null}

            <Field label="Notes">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={colors.stone400}
                style={styles.input}
              />
            </Field>

            {isEditing && goal ? (
              <View style={styles.manageSection}>
                {goal.status !== 'completed' ? (
                  <ManageRow
                    icon={
                      goal.status === 'paused' ? (
                        <Play size={16} color={colors.moss} />
                      ) : (
                        <Pause size={16} color={colors.stone600} />
                      )
                    }
                    label={goal.status === 'paused' ? 'Resume goal' : 'Pause goal'}
                    onPress={handlePauseToggle}
                  />
                ) : null}
                {goal.status !== 'completed' ? (
                  <ManageRow
                    icon={<CheckCircle2 size={16} color={colors.rust} />}
                    label="Mark complete"
                    onPress={handleMarkComplete}
                  />
                ) : (
                  <Text style={styles.completedNote}>
                    Completed {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : ''}
                  </Text>
                )}
                <ManageRow
                  icon={<Trash2 size={16} color={colors.clay} />}
                  label="Delete goal"
                  labelColor={colors.clay}
                  onPress={handleDelete}
                />
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.submit, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>
              {isEditing ? 'Save changes' : 'Create goal'}
            </Text>
          </Pressable>
        </View>

        <DatePickerSheet
          visible={showDeadlinePicker}
          title="Goal deadline"
          value={deadline || tomorrowISO()}
          min={isEditing ? undefined : tomorrowISO()}
          onSelect={setDeadline}
          onClose={() => setShowDeadlinePicker(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ManageRow({
  icon,
  label,
  onPress,
  labelColor,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={styles.manageRow}>
      {icon}
      <Text style={[styles.manageRowLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
    </Pressable>
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
      maxHeight: 520,
    },
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
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
    dateButtonPlaceholder: {
      color: colors.stone400,
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
    helperCopy: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
      lineHeight: 17,
    },
    warningText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.clay,
      marginTop: 2,
      lineHeight: 17,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    manageSection: {
      gap: 8,
      paddingTop: 8,
    },
    manageRow: {
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
    manageRowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    completedNote: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      paddingHorizontal: 2,
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
