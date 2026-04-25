import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          <Text style={styles.sectionOrnament}>§ </Text>
          {title}
        </Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Empty({ msg }: { msg: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{msg}</Text>
    </View>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 24,
      color: colors.ink,
    },
    sectionOrnament: {
      color: colors.rust,
      opacity: 0.4,
    },
    sectionSubtitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 1.6,
      color: colors.stone500,
      textTransform: 'uppercase',
    },
    empty: {
      paddingVertical: 48,
      alignItems: 'center',
      backgroundColor: 'rgba(255,251,242,0.4)',
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(139,90,60,0.2)',
      marginTop: 8,
    },
    emptyText: {
      fontFamily: fonts.displayItalic,
      color: colors.stone500,
      fontSize: 14,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
  });
