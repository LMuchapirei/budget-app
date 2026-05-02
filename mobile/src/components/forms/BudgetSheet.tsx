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
import { Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ALL_LEDGER_ID, useBudget } from '../../context/BudgetContext';
import type { Budget, Category } from '../../types';
import { fonts, CATEGORIES, colorFor } from '../../theme';

interface BudgetSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  budget?: Budget | null;
  defaultCategory?: Category | null;
  onClose: () => void;
}

export function BudgetSheet({
  visible,
  mode,
  budget,
  defaultCategory,
  onClose,
}: BudgetSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    addBudget,
    updateBudget,
    removeBudget,
    budgets,
    customCategories,
    activeLedgers,
    activeLedgerId,
    reportingCurrency,
  } = useBudget();

  const isEditing = mode === 'edit' && Boolean(budget);

  const expenseCategories = useMemo<Category[]>(() => {
    const customExpense = customCategories.filter((c) => c.type === 'expense').map((c) => c.title);
    return [...CATEGORIES.expense, ...customExpense];
  }, [customCategories]);

  const [category, setCategory] = useState<Category>('Food');
  const [amount, setAmount] = useState('');
  const [ledgerScope, setLedgerScope] = useState<string>(ALL_LEDGER_ID);
  const [carryOver, setCarryOver] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (isEditing && budget) {
      setCategory(budget.category);
      setAmount(String(budget.amount));
      setLedgerScope(budget.ledgerId ?? ALL_LEDGER_ID);
      setCarryOver(Boolean(budget.carryOver));
      setNotes(budget.notes ?? '');
    } else {
      setCategory(defaultCategory ?? expenseCategories[0] ?? 'Food');
      setAmount('');
      setLedgerScope(
        activeLedgerId === ALL_LEDGER_ID ? ALL_LEDGER_ID : activeLedgerId,
      );
      setCarryOver(false);
      setNotes('');
    }
  }, [visible, isEditing, budget, defaultCategory, activeLedgerId, expenseCategories]);

  const trimmedAmount = amount.trim();
  const parsedAmount = Number(trimmedAmount);
  const canSave =
    Boolean(category) &&
    trimmedAmount.length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0;

  const duplicateExisting = useMemo(() => {
    return budgets.find(
      (b) =>
        b.id !== budget?.id &&
        b.category === category &&
        (b.ledgerId ?? ALL_LEDGER_ID) === ledgerScope,
    );
  }, [budgets, budget?.id, category, ledgerScope]);

  const handleSave = () => {
    if (!canSave) return;
    if (duplicateExisting) {
      Alert.alert(
        'Budget already exists',
        `${category} already has a budget for this scope. Edit the existing one instead.`,
      );
      return;
    }
    const payload = {
      category,
      amount: parsedAmount,
      period: 'monthly' as const,
      ledgerId: ledgerScope === ALL_LEDGER_ID ? undefined : ledgerScope,
      carryOver,
      notes: notes.trim() || undefined,
    };
    if (isEditing && budget) {
      updateBudget({ ...budget, ...payload });
    } else {
      addBudget(payload);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!budget) return;
    Alert.alert(
      'Delete budget?',
      `Remove the ${budget.category} budget? Spending history is unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeBudget(budget.id);
            onClose();
          },
        },
      ],
    );
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
            <Text style={styles.sheetTitle}>
              {isEditing ? 'Edit budget' : 'New budget'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
            keyboardShouldPersistTaps="always"
            style={styles.scroll}
          >
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {expenseCategories.map((c) => {
                  const active = category === c;
                  return (
                    <Pressable
                      key={c}
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
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Monthly cap ({reportingCurrency.code})</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountSign}>{reportingCurrency.symbol}</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.stone400}
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Scope</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  onPress={() => setLedgerScope(ALL_LEDGER_ID)}
                  style={[
                    styles.chip,
                    ledgerScope === ALL_LEDGER_ID && { backgroundColor: colors.ink },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color:
                          ledgerScope === ALL_LEDGER_ID ? colors.paper : colors.inkSoft,
                      },
                    ]}
                  >
                    All accounts
                  </Text>
                </Pressable>
                {activeLedgers.map((ledger) => {
                  const active = ledgerScope === ledger.id;
                  return (
                    <Pressable
                      key={ledger.id}
                      onPress={() => setLedgerScope(ledger.id)}
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
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Carry-over</Text>
                <Text style={styles.helperCopy}>
                  Roll unspent amount into next month.
                </Text>
              </View>
              <Switch
                value={carryOver}
                onValueChange={setCarryOver}
                trackColor={{ true: colors.rust, false: colors.chip }}
                thumbColor={colors.cream}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional reminder for yourself"
                placeholderTextColor={colors.stone400}
                style={styles.input}
              />
            </View>

            {isEditing ? (
              <Pressable onPress={handleDelete} style={styles.deleteRow}>
                <Trash2 size={16} color={colors.clay} />
                <Text style={styles.deleteLabel}>Delete budget</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.submit, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>
              {isEditing ? 'Save changes' : 'Create budget'}
            </Text>
          </Pressable>
        </View>
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
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
