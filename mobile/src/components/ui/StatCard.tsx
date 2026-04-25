import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';

interface StatCardProps {
  label: string;
  value: string; // pre-formatted
  color: string;
  Icon: LucideIcon;
  accent: string;
  signed?: boolean;
  rawValue: number;
}

export function StatCard({ label, value, color, Icon, accent, signed, rawValue }: StatCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.statCard}>
      <Text style={styles.statAccent}>{accent}</Text>
      <Icon size={20} color={color} strokeWidth={1.5} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>
        {signed && rawValue < 0 ? '−' : ''}
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    statCard: {
      backgroundColor: colors.cream,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 22,
      gap: 8,
      position: 'relative',
    },
    statAccent: {
      position: 'absolute',
      top: 14,
      right: 18,
      fontFamily: fonts.displayItalic,
      fontSize: 12,
      color: colors.rust,
      opacity: 0.5,
    },
    statLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.6,
      color: colors.stone500,
      textTransform: 'uppercase',
      marginTop: 8,
    },
    statValue: {
      fontFamily: fonts.displayLight,
      fontSize: 32,
    },
  });
