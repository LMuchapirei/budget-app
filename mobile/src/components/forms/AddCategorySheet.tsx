import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import {
  Banknote,
  BookOpen,
  Briefcase,
  Car,
  Check,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  Heart,
  HelpCircle,
  Home,
  Lightbulb,
  Music,
  PiggyBank,
  Pizza,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Trash2,
  Utensils,
  Wallet,
  Wrench,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { CustomCategory, TxType } from '../../types';
import { CATEGORIES, fonts } from '../../theme';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 10,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: colors.stone500,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const COLOR_SWATCHES = [
  '#8B5A3C',
  '#C97B4A',
  '#A85751',
  '#D4A04A',
  '#6B8E6B',
  '#3D6B4A',
  '#5A8A6F',
  '#7AAF8E',
  '#7A8FA8',
  '#5C7A8E',
  '#9B7FA0',
  '#8A8275',
];

export const CATEGORY_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'shopping-cart', Icon: ShoppingCart },
  { name: 'shopping-bag', Icon: ShoppingBag },
  { name: 'home', Icon: Home },
  { name: 'car', Icon: Car },
  { name: 'plane', Icon: Plane },
  { name: 'coffee', Icon: Coffee },
  { name: 'utensils', Icon: Utensils },
  { name: 'pizza', Icon: Pizza },
  { name: 'heart', Icon: Heart },
  { name: 'stethoscope', Icon: Stethoscope },
  { name: 'music', Icon: Music },
  { name: 'film', Icon: Film },
  { name: 'gamepad', Icon: Gamepad2 },
  { name: 'dumbbell', Icon: Dumbbell },
  { name: 'book', Icon: BookOpen },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'graduation', Icon: GraduationCap },
  { name: 'gift', Icon: Gift },
  { name: 'piggy', Icon: PiggyBank },
  { name: 'card', Icon: CreditCard },
  { name: 'wallet', Icon: Wallet },
  { name: 'receipt', Icon: Receipt },
  { name: 'banknote', Icon: Banknote },
  { name: 'coins', Icon: Coins },
  { name: 'wrench', Icon: Wrench },
  { name: 'hammer', Icon: Hammer },
  { name: 'sparkles', Icon: Sparkles },
  { name: 'lightbulb', Icon: Lightbulb },
  { name: 'phone', Icon: Smartphone },
  { name: 'help', Icon: HelpCircle },
];

const ICON_BY_NAME = new Map(CATEGORY_ICONS.map((entry) => [entry.name, entry.Icon]));

export function getCategoryIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return ICON_BY_NAME.get(name) ?? null;
}

interface AddCategorySheetProps {
  type: TxType;
  onClose: () => void;
  onSave?: (c: CustomCategory) => void;
  category?: CustomCategory | null;
}

export function AddCategorySheet({
  type: initialType,
  onClose,
  onSave,
  category,
}: AddCategorySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
    categoryTransactionCount,
    customCategories,
  } = useBudget();
  const isEditing = Boolean(category);

  const [selectedType, setSelectedType] = useState<TxType>(category?.type ?? initialType);
  const [title, setTitle] = useState(category?.title ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [color, setColor] = useState(category?.color ?? COLOR_SWATCHES[0]);
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    setSelectedType(category.type);
    setTitle(category.title);
    setDescription(category.description ?? '');
    setColor(category.color || COLOR_SWATCHES[0]);
    setIcon(category.icon ?? null);
    setConfirmingDelete(false);
    setReassignTo(null);
  }, [category]);

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0;

  const linkedCount = isEditing && category ? categoryTransactionCount(category.title) : 0;

  const reassignCandidates = useMemo(() => {
    if (!isEditing || !category) return [] as string[];
    const builtIns =
      category.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
    const customs = customCategories
      .filter((c) => c.type === category.type && c.id !== category.id)
      .map((c) => c.title);
    const combined = [...builtIns, ...customs];
    return Array.from(new Set(combined.filter((name) => name !== category.title)));
  }, [category, customCategories, isEditing]);

  useEffect(() => {
    if (!confirmingDelete) return;
    if (linkedCount > 0 && !reassignTo && reassignCandidates[0]) {
      setReassignTo(reassignCandidates[0]);
    }
  }, [confirmingDelete, linkedCount, reassignCandidates, reassignTo]);

  const handleSave = () => {
    if (!canSave) return;
    if (isEditing && category) {
      const next: CustomCategory = {
        ...category,
        type: selectedType,
        title: trimmedTitle,
        description: description.trim(),
        color,
        icon: icon ?? undefined,
      };
      updateCustomCategory(next);
      onSave?.(next);
    } else {
      const next: CustomCategory = {
        id: Date.now().toString(),
        type: selectedType,
        title: trimmedTitle,
        description: description.trim(),
        color,
        icon: icon ?? undefined,
      };
      addCustomCategory(next);
      onSave?.(next);
    }
    onClose();
  };

  const beginDelete = () => {
    if (!isEditing || !category) return;
    if (linkedCount === 0) {
      Alert.alert(
        'Delete category?',
        `${category.title} has no transactions. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              removeCustomCategory(category.id);
              onClose();
            },
          },
        ],
      );
      return;
    }
    if (reassignCandidates.length === 0) {
      Alert.alert(
        'Cannot delete',
        'Add another category first so transactions can be moved before deleting.',
      );
      return;
    }
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    if (!category || !reassignTo) return;
    removeCustomCategory(category.id, reassignTo);
    onClose();
  };

  const cancelDelete = () => {
    setConfirmingDelete(false);
    setReassignTo(null);
  };

  const previewIcon = getCategoryIcon(icon);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {isEditing ? 'Edit category' : 'New category'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {confirmingDelete && category ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.dangerTitle}>Delete {category.title}?</Text>
              <Text style={styles.dangerCopy}>
                {linkedCount} {linkedCount === 1 ? 'transaction' : 'transactions'}{' '}
                will move to:
              </Text>
              <View style={styles.chipWrap}>
                {reassignCandidates.map((candidate) => {
                  const active = reassignTo === candidate;
                  return (
                    <Pressable
                      key={candidate}
                      onPress={() => setReassignTo(candidate)}
                      style={[
                        styles.chip,
                        active && { backgroundColor: colors.ink },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: active ? colors.paper : colors.inkSoft },
                        ]}
                      >
                        {candidate}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.dangerActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={[styles.actionBtn, styles.actionBtnGhost]}
                >
                  <Text style={[styles.actionBtnLabel, { color: colors.inkSoft }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={!reassignTo}
                  style={[
                    styles.actionBtn,
                    styles.actionBtnDanger,
                    !reassignTo && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[styles.actionBtnLabel, { color: colors.paper }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.previewRow}>
                <View style={[styles.previewSwatch, { backgroundColor: `${color}26` }]}>
                  {previewIcon ? (
                    React.createElement(previewIcon, { size: 18, color })
                  ) : (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: color,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.previewName}>
                    {trimmedTitle || 'Untitled category'}
                  </Text>
                  <Text style={styles.previewMeta} numberOfLines={1}>
                    {selectedType === 'income' ? 'Income' : 'Expense'}
                    {description.trim() ? ` · ${description.trim()}` : ''}
                  </Text>
                </View>
              </View>

              <ScrollView
                contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
                keyboardShouldPersistTaps="always"
                style={styles.scroll}
              >
                <View style={styles.typeToggle}>
                  {(['expense', 'income'] as TxType[]).map((t) => {
                    const active = selectedType === t;
                    const bg =
                      active && t === 'income'
                        ? colors.moss
                        : active && t === 'expense'
                        ? colors.clay
                        : 'transparent';
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setSelectedType(t)}
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

                <Field label="Title">
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Coffee"
                    placeholderTextColor={colors.stone400}
                    style={styles.input}
                  />
                </Field>

                <Field label="Description">
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional note"
                    placeholderTextColor={colors.stone400}
                    style={styles.input}
                  />
                </Field>

                <Field label="Color">
                  <View style={styles.swatchGrid}>
                    {COLOR_SWATCHES.map((swatch) => {
                      const active = color === swatch;
                      return (
                        <Pressable
                          key={swatch}
                          onPress={() => setColor(swatch)}
                          style={[
                            styles.swatch,
                            { backgroundColor: swatch },
                            active && styles.swatchActive,
                          ]}
                        >
                          {active ? (
                            <Check size={12} color={colors.paper} strokeWidth={3} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Icon">
                  <View style={styles.iconGrid}>
                    <Pressable
                      onPress={() => setIcon(null)}
                      style={[
                        styles.iconBtn,
                        icon === null && styles.iconBtnActive,
                      ]}
                    >
                      <Text style={styles.iconNoneLabel}>None</Text>
                    </Pressable>
                    {CATEGORY_ICONS.map(({ name, Icon }) => {
                      const active = icon === name;
                      return (
                        <Pressable
                          key={name}
                          onPress={() => setIcon(name)}
                          style={[
                            styles.iconBtn,
                            active && styles.iconBtnActive,
                            active && { borderColor: color },
                          ]}
                        >
                          <Icon
                            size={16}
                            color={active ? color : colors.inkSoft}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {isEditing && category ? (
                  <Pressable onPress={beginDelete} style={styles.deleteRow}>
                    <Trash2 size={16} color={colors.clay} />
                    <Text style={styles.deleteLabel}>Delete category</Text>
                    {linkedCount > 0 ? (
                      <Text style={styles.deleteMeta}>
                        {linkedCount} linked
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
              </ScrollView>

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.submit, !canSave && { opacity: 0.4 }]}
              >
                <Text style={styles.submitLabel}>
                  {isEditing ? 'Save changes' : 'Create category'}
                </Text>
              </Pressable>
            </>
          )}
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
      gap: 16,
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
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    previewSwatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewName: {
      fontFamily: fonts.displayMedium,
      fontSize: 15,
      color: colors.ink,
    },
    previewMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    scroll: {
      maxHeight: 480,
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
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchActive: {
      borderWidth: 2,
      borderColor: colors.ink,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    iconBtnActive: {
      backgroundColor: colors.paper,
      borderColor: colors.borderSoft,
    },
    iconNoneLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone600,
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
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
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
      flex: 1,
    },
    deleteMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
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
    dangerPanel: {
      gap: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    dangerTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
      color: colors.ink,
    },
    dangerCopy: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
    },
    dangerActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
    },
    actionBtnGhost: {
      backgroundColor: colors.chip,
    },
    actionBtnDanger: {
      backgroundColor: colors.clay,
    },
    actionBtnLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
    },
  });
