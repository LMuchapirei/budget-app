import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { X, Repeat } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import { TxType, Category } from '../../types';
import { fonts, CATEGORIES, colorFor } from '../../theme';
import { Field, AddCategorySheet } from './AddCategorySheet';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';

interface TransactionFormProps {
  onClose: () => void;
}

export function TransactionForm({ onClose }: TransactionFormProps) {
  const { colors } = useTheme();
  const { addTransaction, customCategories, addCustomCategory } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);

  useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
  }, [type]);

  const handleSubmit = () => {
    const n = Number(amount);
    if (!amount || !description || Number.isNaN(n) || n <= 0) return;
    addTransaction({ type, amount: n, description, category, date, recurring });
    onClose();
  };

  const currentCategories = [
    ...(type === 'income' ? CATEGORIES.income : CATEGORIES.expense),
    ...customCategories.filter(c => c.type === type).map(c => c.title)
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>New entry</Text>
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
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Amount">
            <View style={styles.amountRow}>
              <Text style={styles.amountSign}>$</Text>
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

          <Field label="Description">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What was it for?"
              placeholderTextColor={colors.stone400}
              style={styles.input}
            />
          </Field>

          <Field label="Category">
            <View style={styles.chipWrap}>
              {currentCategories.map((c, i) => {
                const active = category === c;
                return (
                  <Animated.View key={c} layout={LinearTransition.springify()} entering={ZoomIn.delay(i * 10).springify()}>
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
                  </Animated.View>
                );
              })}
              <Animated.View layout={LinearTransition.springify()}>
                <Pressable
                onPress={() => setShowAddCategory(true)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.borderSoft, borderStyle: 'dashed' },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.stone500 }]}>+ New</Text>
              </Pressable>
              </Animated.View>
            </View>
          </Field>

          <Field label="Date">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.stone400}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>

          <View style={styles.recurringRow}>
            <View style={styles.recurringLabelGroup}>
              <Repeat size={14} color={colors.stone500} />
              <Text style={styles.recurringRowLabel}>This repeats every month</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ true: colors.rust, false: colors.chip }}
              thumbColor={colors.cream}
            />
          </View>
        </ScrollView>

        <Pressable
          onPress={handleSubmit}
          disabled={!amount || !description}
          style={({ pressed }) => [
            styles.submit,
            (!amount || !description) && styles.submitDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitLabel}>Add to ledger</Text>
        </Pressable>
      </View>

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
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
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
