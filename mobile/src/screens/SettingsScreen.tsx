import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { useLock } from '../context/LockContext';
import { fonts } from '../theme';
import { Moon, Trash2, DollarSign, Lock } from 'lucide-react-native';
import { REPORTING_CURRENCY_OPTIONS } from '../utils/currency';

export function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const { clearAllData, reportingCurrency, setReportingCurrency } = useBudget();
  const { isAppLockEnabled, setAppLockEnabled } = useLock();

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

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Lock size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>App Lock (Biometrics/Passcode)</Text>
          </View>
          <Switch
            value={isAppLockEnabled}
            onValueChange={async (val) => { await setAppLockEnabled(val); }}
            trackColor={{ true: colors.rust, false: colors.chip }}
            thumbColor={colors.cream}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.currencyRow}>
          <View style={styles.rowLeft}>
            <DollarSign size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Reporting Currency</Text>
          </View>
          <View style={styles.currencyToggle}>
            {REPORTING_CURRENCY_OPTIONS.map((option) => (
              <Pressable
                key={option.code}
                onPress={() => setReportingCurrency(option)}
                style={[
                  styles.currencyBtn,
                  reportingCurrency.code === option.code && { backgroundColor: colors.rust },
                ]}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    reportingCurrency.code === option.code && { color: colors.paper },
                  ]}
                >
                  {option.code}
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
    currencyRow: {
      padding: 16,
      gap: 12,
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
      flexWrap: 'wrap',
      gap: 8,
      backgroundColor: colors.chip,
      padding: 6,
      borderRadius: 12,
      alignSelf: 'stretch',
    },
    currencyBtn: {
      flexGrow: 1,
      flexBasis: '30%',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 8,
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
