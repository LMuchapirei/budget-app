import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { CATEGORIES } from '../../theme';
import { Field } from './shared/Field';
import { createAddCategoryStyles } from './addCategoryStyles';

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
  const styles = useMemo(() => createAddCategoryStyles(colors), [colors]);
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
