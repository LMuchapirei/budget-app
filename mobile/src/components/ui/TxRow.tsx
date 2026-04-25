import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trash2, Repeat } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Transaction, CustomCategory } from '../../types';
import { colorFor, fonts } from '../../theme';
import { useBudget } from '../../context/BudgetContext';

interface TxRowProps {
  t: Transaction;
  isLast: boolean;
  customCategories: CustomCategory[];
}

export function TxRow({ t, isLast, customCategories }: TxRowProps) {
  const { colors } = useTheme();
  const { removeTransaction, formatMoney } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isIncome = t.type === 'income';
  const accent = colorFor(t.category, customCategories);

  return (
    <View style={[styles.txRow, !isLast && styles.txRowBorder]}>
      <View style={[styles.txDot, { backgroundColor: `${accent}20` }]}>
        <View style={[styles.txDotInner, { backgroundColor: accent }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.txDescription} numberOfLines={1}>
            {t.description}
          </Text>
          {t.recurring && <Repeat size={11} color={colors.stone400} />}
        </View>
        <Text style={styles.txMeta}>
          {t.category} ·{' '}
          {new Date(t.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: isIncome ? colors.moss : colors.ink },
        ]}
      >
        {isIncome ? '+' : '−'}
        {formatMoney(t.amount)}
      </Text>
      <Pressable
        onPress={() => removeTransaction(t.id)}
        hitSlop={8}
        style={styles.txDelete}
        accessibilityLabel={`Delete ${t.description}`}
      >
        <Trash2 size={14} color={colors.stone400} />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    txRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    txDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txDotInner: { width: 8, height: 8, borderRadius: 4 },
    txDescription: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    txMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    txAmount: {
      fontFamily: fonts.displayLight,
      fontSize: 17,
    },
    txDelete: { padding: 6 },
  });
