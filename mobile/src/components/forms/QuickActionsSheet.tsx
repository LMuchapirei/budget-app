import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  PieChart as PieIcon,
  Plus,
  Repeat,
  Search,
  TrendingUp,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import { fonts, colorFor } from '../../theme';
import type { Transaction, ViewTab } from '../../types';

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenAddExpense: () => void;
  onOpenAddIncome: () => void;
  onOpenTransfer: () => void;
  onNavigate: (view: ViewTab) => void;
  onSelectTransaction: (t: Transaction) => void;
}

const MAX_RESULTS = 30;

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export function QuickActionsSheet({
  visible,
  onClose,
  onOpenAddExpense,
  onOpenAddIncome,
  onOpenTransfer,
  onNavigate,
  onSelectTransaction,
}: QuickActionsSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    transactions,
    ledgers,
    customCategories,
    formatMoneyForLedger,
  } = useBudget();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      // Slight delay so the modal presents before focus, avoiding a janky keyboard pop on iOS.
      const t = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
    Keyboard.dismiss();
  }, [visible]);

  const trimmed = normalize(query);
  const isSearching = trimmed.length > 0;

  const results = useMemo(() => {
    if (!isSearching) return [] as Transaction[];
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
    return transactions
      .filter((t) => {
        if (t.transferDirection === 'in') return false; // collapse transfer pairs
        const haystack = [
          t.description,
          t.category,
          ledgers.find((l) => l.id === t.ledgerId)?.name ?? '',
          t.transferPairId
            ? ledgers.find((l) => l.id === t.transferCounterpartLedgerId)?.name ?? ''
            : '',
        ]
          .map(normalize)
          .join(' ');
        if (haystack.includes(trimmed)) return true;
        if (!Number.isNaN(numeric) && numeric > 0) {
          if (Number(t.amount) === numeric) return true;
          if (String(t.amount).startsWith(trimmed)) return true;
        }
        return false;
      })
      .slice(0, MAX_RESULTS);
  }, [isSearching, ledgers, transactions, trimmed]);

  const handleAction = (fn: () => void) => () => {
    onClose();
    // Defer slightly so the modal has time to dismiss before opening the next one.
    setTimeout(fn, 120);
  };

  const quickActions: {
    Icon: LucideIcon;
    label: string;
    description: string;
    onPress: () => void;
    accent: string;
  }[] = [
    {
      Icon: Plus,
      label: 'Add expense',
      description: 'Log money going out.',
      onPress: handleAction(onOpenAddExpense),
      accent: colors.clay,
    },
    {
      Icon: Plus,
      label: 'Add income',
      description: 'Log money coming in.',
      onPress: handleAction(onOpenAddIncome),
      accent: colors.moss,
    },
    {
      Icon: ArrowLeftRight,
      label: 'Transfer',
      description: 'Move funds between accounts.',
      onPress: handleAction(onOpenTransfer),
      accent: colors.rust,
    },
    {
      Icon: Bell,
      label: 'Bills',
      description: 'Confirm or skip upcoming commitments.',
      onPress: handleAction(() => onNavigate('bills')),
      accent: colors.ink,
    },
    {
      Icon: PieIcon,
      label: 'Reports',
      description: 'Spending breakdown and trends.',
      onPress: handleAction(() => onNavigate('reports')),
      accent: colors.ink,
    },
    {
      Icon: TrendingUp,
      label: 'Projections',
      description: '12-month forecast from recurring entries.',
      onPress: handleAction(() => onNavigate('projections')),
      accent: colors.ink,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.searchBar}>
            <Search size={16} color={colors.stone500} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search transactions, categories, accounts"
              placeholderTextColor={colors.stone500}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={6} accessibilityLabel="Clear search">
                <X size={14} color={colors.stone500} />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={6} accessibilityLabel="Close" style={styles.closeBtn}>
              <Text style={styles.closeLabel}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
            contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          >
            {isSearching ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>
                  {results.length === 0
                    ? 'No matches'
                    : `${results.length} match${results.length === 1 ? '' : 'es'}`}
                </Text>
                {results.map((t) => {
                  const ledger = ledgers.find((l) => l.id === t.ledgerId);
                  const isTransfer = Boolean(t.transferPairId);
                  const counterpart = isTransfer
                    ? ledgers.find((l) => l.id === t.transferCounterpartLedgerId)
                    : null;
                  const accent = isTransfer
                    ? colors.rust
                    : colorFor(t.category, customCategories);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        onClose();
                        setTimeout(() => onSelectTransaction(t), 120);
                      }}
                      style={({ pressed }) => [
                        styles.resultRow,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={[styles.resultDot, { backgroundColor: `${accent}20` }]}>
                        {isTransfer ? (
                          <ArrowLeftRight size={13} color={accent} />
                        ) : (
                          <View style={[styles.resultDotInner, { backgroundColor: accent }]} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.resultTitleRow}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            {isTransfer
                              ? t.transferDirection === 'out'
                                ? `Transfer to ${counterpart?.name ?? 'account'}`
                                : `Transfer from ${counterpart?.name ?? 'account'}`
                              : t.description}
                          </Text>
                          {t.recurring ? (
                            <Repeat size={10} color={colors.stone500} />
                          ) : null}
                        </View>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {isTransfer ? 'Transfer' : t.category} · {ledger?.name ?? 'Cash Ledger'} ·{' '}
                          {formatShortDate(t.date)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.resultAmount,
                          {
                            color:
                              t.type === 'income'
                                ? colors.moss
                                : isTransfer
                                ? colors.clay
                                : colors.ink,
                          },
                        ]}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {formatMoneyForLedger(t.amount, t.ledgerId)}
                      </Text>
                    </Pressable>
                  );
                })}
                {results.length === 0 ? (
                  <Text style={styles.emptyHint}>
                    Try a description, category, account, or amount.
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={styles.sectionLabel}>Quick actions</Text>
                  <View style={styles.actionsGrid}>
                    {quickActions.map(({ Icon, label, description, onPress, accent }) => (
                      <Pressable
                        key={label}
                        onPress={onPress}
                        style={({ pressed }) => [
                          styles.actionRow,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        <View style={[styles.actionIcon, { backgroundColor: `${accent}1A` }]}>
                          <Icon size={16} color={accent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.actionLabel}>{label}</Text>
                          <Text style={styles.actionDescription} numberOfLines={1}>
                            {description}
                          </Text>
                        </View>
                        <ArrowRight size={14} color={colors.stone500} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Text style={styles.tip}>
                  Tip: type any text or amount to find it across your ledger.
                </Text>
              </>
            )}
          </ScrollView>
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
      padding: 20,
      paddingBottom: 28,
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.paper,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
      padding: 0,
    },
    closeBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    closeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.rust,
    },
    scroll: {
      maxHeight: '80%',
    },
    sectionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    actionsGrid: {
      gap: 8,
    },
    actionRow: {
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
    actionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontFamily: fonts.displayMedium,
      fontSize: 14,
      color: colors.ink,
    },
    actionDescription: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    tip: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      textAlign: 'center',
      paddingVertical: 6,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    resultDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultDotInner: { width: 8, height: 8, borderRadius: 4 },
    resultTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    resultTitle: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 14,
      color: colors.ink,
    },
    resultMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    resultAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 15,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      paddingVertical: 6,
    },
  });
