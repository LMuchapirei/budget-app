import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { fonts } from '../theme';
import { Moon, Trash2, DollarSign } from 'lucide-react-native';

export function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { clearAllData, currency, setCurrency } = useBudget();

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Settings</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Moon size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ true: colors.rust, false: colors.chip }}
            thumbColor={colors.cream}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <DollarSign size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Currency Symbol</Text>
          </View>
          <View style={styles.currencyToggle}>
            {['$', '€', '£', '¥'].map((sym) => (
              <Pressable
                key={sym}
                onPress={() => setCurrency(sym)}
                style={[
                  styles.currencyBtn,
                  currency === sym && { backgroundColor: colors.rust },
                ]}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    currency === sym && { color: colors.paper },
                  ]}
                >
                  {sym}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Danger Zone</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() => clearAllData()}
          style={styles.dangerRow}
        >
          <Trash2 size={20} color={colors.clay} />
          <Text style={styles.dangerLabel}>Clear All Data & Reset</Text>
        </Pressable>
        <Text style={styles.dangerDesc}>
          This will permanently delete all transactions and custom categories from your device.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { gap: 24 },
    headerTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 32,
      color: colors.ink,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.cream,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.ink,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSoft,
      marginHorizontal: 16,
    },
    currencyToggle: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.chip,
      padding: 4,
      borderRadius: 8,
    },
    currencyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    currencyBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.inkSoft,
    },
    sectionHeader: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.stone500,
      marginTop: 8,
    },
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
    },
    dangerLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.clay,
    },
    dangerDesc: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginTop: -8,
      lineHeight: 18,
    },
  });
