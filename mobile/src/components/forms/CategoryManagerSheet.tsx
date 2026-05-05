import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight, Pencil, Plus, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import { CATEGORIES, colorFor, fonts } from '../../theme';
import type { CustomCategory, TxType } from '../../types';
import { AddCategorySheet, getCategoryIcon } from './AddCategorySheet';

interface CategoryManagerSheetProps {
  visible: boolean;
  onClose: () => void;
}

type ListTab = 'expense' | 'income';

export function CategoryManagerSheet({ visible, onClose }: CategoryManagerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { customCategories, categoryTransactionCount } = useBudget();
  const [tab, setTab] = useState<ListTab>('expense');
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [creatingType, setCreatingType] = useState<TxType | null>(null);

  const customsForTab = useMemo(
    () => customCategories.filter((c) => c.type === tab),
    [customCategories, tab],
  );

  const builtInsForTab = tab === 'income' ? CATEGORIES.income : CATEGORIES.expense;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>Categories</Text>
              <Text style={styles.sheetMeta}>
                Built-in categories are read-only. Create custom ones for full control.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {(['expense', 'income'] as ListTab[]).map((id) => {
              const active = tab === id;
              const accent = id === 'income' ? colors.moss : colors.clay;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  style={[styles.tab, active && { backgroundColor: accent }]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: active ? colors.paper : colors.inkSoft },
                    ]}
                  >
                    {id === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ gap: 18, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: 8 }}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>
                  Custom · {customsForTab.length}
                </Text>
                <Pressable
                  onPress={() => setCreatingType(tab)}
                  style={styles.addButton}
                  accessibilityRole="button"
                >
                  <Plus size={13} color={colors.rust} />
                  <Text style={styles.addButtonLabel}>New</Text>
                </Pressable>
              </View>
              {customsForTab.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    No custom {tab} categories yet. Tap New to add one.
                  </Text>
                </View>
              ) : (
                customsForTab.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    onPress={() => setEditingCategory(c)}
                    linkedCount={categoryTransactionCount(c.title)}
                  />
                ))
              )}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>
                Built-in · {builtInsForTab.length}
              </Text>
              <View style={{ gap: 6 }}>
                {builtInsForTab.map((name) => (
                  <View key={name} style={styles.builtInRow}>
                    <View
                      style={[
                        styles.builtInDot,
                        { backgroundColor: colorFor(name, customCategories) },
                      ]}
                    />
                    <Text style={styles.builtInLabel}>{name}</Text>
                    <Text style={styles.builtInMeta}>
                      {categoryTransactionCount(name)} entries
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        {editingCategory ? (
          <AddCategorySheet
            type={editingCategory.type}
            category={editingCategory}
            onClose={() => setEditingCategory(null)}
            onSave={() => setEditingCategory(null)}
          />
        ) : null}

        {creatingType ? (
          <AddCategorySheet
            type={creatingType}
            onClose={() => setCreatingType(null)}
            onSave={() => setCreatingType(null)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function CategoryRow({
  category,
  onPress,
  linkedCount,
}: {
  category: CustomCategory;
  onPress: () => void;
  linkedCount: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = getCategoryIcon(category.icon);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      pressed && { opacity: 0.85 },
    ]}>
      <View style={[styles.rowSwatch, { backgroundColor: `${category.color}26` }]}>
        {Icon ? (
          <Icon size={16} color={category.color} />
        ) : (
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: category.color,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{category.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {category.description ? `${category.description} · ` : ''}
          {linkedCount} {linkedCount === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
      <Pencil size={14} color={colors.stone500} />
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
      gap: 14,
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    sheetMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
    },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      backgroundColor: colors.chip,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
    },
    tabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
    scroll: {
      maxHeight: 540,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
    },
    addButtonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.rust,
    },
    empty: {
      padding: 18,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
    },
    row: {
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
    rowSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 14,
      color: colors.ink,
    },
    rowMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    builtInRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    builtInDot: { width: 8, height: 8, borderRadius: 4 },
    builtInLabel: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    builtInMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
  });
