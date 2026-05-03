import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';
import { Sparkline } from './Sparkline';

interface MonthlySummaryProps {
  eyebrow: string;
  netLabel: string;
  netValue: string;
  netRaw: number;
  netDeltaPct?: number | null;
  income: number;
  incomeDeltaPct?: number | null;
  expenses: number;
  expensesDeltaPct?: number | null;
  savingsRatePct?: number | null;
  prevSavingsRatePct?: number | null;
  formatMoney: (n: number) => string;
  sparklineValues: number[];
  cardWidth: number;
  onPress?: () => void;
}

function formatPct(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.5) return '~0%';
  return `${value > 0 ? '+' : ''}${Math.round(value)}%`;
}

function deltaTone(value: number | null | undefined, kind: 'positive' | 'negative') {
  // For income/savings: up is good (moss). For expenses: up is bad (clay).
  if (value === undefined || value === null || !Number.isFinite(value)) return 'neutral' as const;
  if (Math.abs(value) < 0.5) return 'neutral' as const;
  const isUp = value > 0;
  if (kind === 'positive') return isUp ? ('good' as const) : ('bad' as const);
  return isUp ? ('bad' as const) : ('good' as const);
}

export function MonthlySummary({
  eyebrow,
  netLabel,
  netValue,
  netRaw,
  netDeltaPct,
  income,
  incomeDeltaPct,
  expenses,
  expensesDeltaPct,
  savingsRatePct,
  prevSavingsRatePct,
  formatMoney,
  sparklineValues,
  cardWidth,
  onPress,
}: MonthlySummaryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const netSign = netRaw < 0 ? '-' : '';
  const netColor = netRaw >= 0 ? colors.ink : colors.clay;
  const sparklineColor = netRaw >= 0 ? colors.moss : colors.clay;

  const innerWidth = cardWidth - 36; // padding 18 each side

  const savingsDelta =
    savingsRatePct != null && prevSavingsRatePct != null
      ? savingsRatePct - prevSavingsRatePct
      : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? { opacity: 0.92 } : null]}
    >
      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.netLabel}>{netLabel}</Text>
        </View>
        <DeltaBadge value={netDeltaPct} kind="positive" />
      </View>

      <View style={styles.netRow}>
        <Text style={[styles.netValue, { color: netColor }]} numberOfLines={1}>
          {netSign}
          {netValue}
        </Text>
      </View>

      {sparklineValues.length >= 2 ? (
        <View style={styles.sparkWrap}>
          <Sparkline
            width={innerWidth}
            height={42}
            values={sparklineValues}
            color={sparklineColor}
            fillColor={sparklineColor}
            zeroLineColor={colors.borderSoft}
          />
        </View>
      ) : (
        <Text style={styles.sparkHint}>Add transactions to see your trend.</Text>
      )}

      <View style={styles.metricsRow}>
        <Metric
          label="Income"
          valueText={formatMoney(income)}
          deltaPct={incomeDeltaPct}
          kind="positive"
          accentColor={colors.moss}
        />
        <View style={styles.metricDivider} />
        <Metric
          label="Spent"
          valueText={formatMoney(expenses)}
          deltaPct={expensesDeltaPct}
          kind="negative"
          accentColor={colors.clay}
        />
        <View style={styles.metricDivider} />
        <Metric
          label="Saved"
          valueText={
            savingsRatePct != null ? `${Math.round(savingsRatePct)}%` : '—'
          }
          deltaPct={savingsDelta}
          kind="positive"
          accentColor={colors.rust}
        />
      </View>
    </Pressable>
  );
}

function Metric({
  label,
  valueText,
  deltaPct,
  kind,
  accentColor,
}: {
  label: string;
  valueText: string;
  deltaPct?: number | null;
  kind: 'positive' | 'negative';
  accentColor: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.metricCol}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accentColor }]} numberOfLines={1}>
        {valueText}
      </Text>
      <DeltaBadge value={deltaPct} kind={kind} compact />
    </View>
  );
}

function DeltaBadge({
  value,
  kind,
  compact,
}: {
  value?: number | null;
  kind: 'positive' | 'negative';
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tone = deltaTone(value, kind);
  const formatted = formatPct(value);
  const tint =
    tone === 'good' ? colors.moss : tone === 'bad' ? colors.clay : colors.stone500;

  if (!formatted) {
    return (
      <View style={[styles.deltaBadge, compact && styles.deltaBadgeCompact]}>
        <Minus size={compact ? 9 : 11} color={colors.stone500} />
        <Text style={[styles.deltaText, { color: colors.stone500 }]}>—</Text>
      </View>
    );
  }

  const Arrow = (value ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <View
      style={[
        styles.deltaBadge,
        compact && styles.deltaBadgeCompact,
        { borderColor: tint },
      ]}
    >
      <Arrow size={compact ? 9 : 11} color={tint} />
      <Text style={[styles.deltaText, { color: tint }]}>{formatted}</Text>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.cream,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 12,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    eyebrow: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    netLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 4,
    },
    netRow: {
      marginTop: -4,
    },
    netValue: {
      fontFamily: fonts.displayLight,
      fontSize: 38,
      letterSpacing: -0.5,
    },
    sparkWrap: {
      marginTop: -4,
      marginBottom: 4,
    },
    sparkHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      paddingVertical: 8,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    metricCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    metricDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSoft,
    },
    metricLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 9,
      letterSpacing: 1.2,
      color: colors.stone500,
      textTransform: 'uppercase',
    },
    metricValue: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
    },
    deltaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignSelf: 'flex-start',
    },
    deltaBadgeCompact: {
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    deltaText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.2,
    },
  });
