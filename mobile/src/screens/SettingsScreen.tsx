import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { useLock } from '../context/LockContext';
import { fonts } from '../theme';
import {
  Bell,
  Check,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Trash2,
  DollarSign,
  Lock,
  SunMoon,
  Type,
} from 'lucide-react-native';
import { REPORTING_CURRENCY_OPTIONS } from '../utils/currency';
import { ACCENT_SWATCHES, type ThemeMode, type ThemePresetId } from '../context/ThemeContext';
import type { FontPairId } from '../theme';

export function SettingsScreen() {
  const {
    mode,
    setMode,
    presetId,
    setPreset,
    presets,
    accent,
    setAccent,
    fontPairId,
    setFontPair,
    fontPairs,
    colors,
  } = useTheme();
  const {
    clearAllData,
    reportingCurrency,
    setReportingCurrency,
    scheduledOccurrences,
    scheduledNotificationStatus,
    requestScheduledNotificationPermission,
    syncScheduledNotifications,
  } = useBudget();
  const { isAppLockEnabled, setAppLockEnabled } = useLock();

  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState('');

  const reminderEnabled = scheduledNotificationStatus === 'granted';
  const reminderDenied = scheduledNotificationStatus === 'denied';
  const hasOccurrences = scheduledOccurrences.length > 0;

  const handleReminderToggle = async (next: boolean) => {
    setReminderNote('');
    if (next) {
      setReminderBusy(true);
      try {
        const status = await requestScheduledNotificationPermission();
        if (status !== 'granted') {
          setReminderNote('Reminders blocked. Enable notifications in your device settings.');
        } else if (!hasOccurrences) {
          setReminderNote('Reminders enabled. Add a recurring schedule to schedule reminders.');
        } else {
          setReminderNote('Reminders enabled.');
        }
      } finally {
        setReminderBusy(false);
      }
      return;
    }

    setReminderNote('Open device settings to disable schedule notifications.');
    Linking.openSettings().catch(() => undefined);
  };

  const handleReminderSync = async () => {
    setReminderBusy(true);
    setReminderNote('');
    try {
      const result = await syncScheduledNotifications();
      setReminderNote(
        `${result.scheduled} reminder${result.scheduled === 1 ? '' : 's'} scheduled.`,
      );
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Settings</Text>

      <View style={styles.card}>
        <View style={styles.appearanceRow}>
          <View style={styles.rowLeft}>
            <SunMoon size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Appearance</Text>
          </View>
          <View style={styles.modeToggle}>
            {([
              { id: 'light', label: 'Light', Icon: Sun },
              { id: 'dark', label: 'Dark', Icon: Moon },
              { id: 'system', label: 'Auto', Icon: SunMoon },
            ] as { id: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ id, label, Icon }) => {
              const active = mode === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setMode(id)}
                  style={[
                    styles.modeBtn,
                    active && { backgroundColor: colors.rust },
                  ]}
                >
                  <Icon size={14} color={active ? colors.paper : colors.stone500} />
                  <Text
                    style={[
                      styles.modeBtnLabel,
                      { color: active ? colors.paper : colors.inkSoft },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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

        <View style={styles.reminderBlock}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Bell size={20} color={colors.stone500} />
              <View>
                <Text style={styles.rowLabel}>Schedule reminders</Text>
                <Text style={styles.reminderMeta}>
                  {reminderEnabled
                    ? `${scheduledOccurrences.length} occurrence${scheduledOccurrences.length === 1 ? '' : 's'} watched`
                    : reminderDenied
                    ? 'Blocked in device settings'
                    : 'Local reminders for recurring income and expenses'}
                </Text>
              </View>
            </View>
            {reminderBusy ? (
              <ActivityIndicator color={colors.rust} />
            ) : (
              <Switch
                value={reminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ true: colors.rust, false: colors.chip }}
                thumbColor={colors.cream}
              />
            )}
          </View>
          {reminderEnabled ? (
            <Pressable
              onPress={handleReminderSync}
              disabled={reminderBusy || !hasOccurrences}
              style={[
                styles.reminderSyncBtn,
                (reminderBusy || !hasOccurrences) && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.reminderSyncLabel}>Sync now</Text>
            </Pressable>
          ) : reminderDenied ? (
            <Pressable
              onPress={() => Linking.openSettings().catch(() => undefined)}
              style={styles.reminderSyncBtn}
            >
              <Text style={styles.reminderSyncLabel}>Open device settings</Text>
            </Pressable>
          ) : null}
          {reminderNote ? <Text style={styles.reminderNote}>{reminderNote}</Text> : null}
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

      <Text style={styles.sectionHeader}>Theme</Text>
      <View style={styles.card}>
        <View style={styles.themeBlock}>
          <View style={styles.rowLeft}>
            <Palette size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Preset</Text>
          </View>
          <View style={styles.presetGrid}>
            {presets.map((p) => {
              const active = presetId === p.id;
              const swatchPalette = mode === 'dark' ? p.dark : p.light;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPreset(p.id as ThemePresetId)}
                  style={[
                    styles.presetCard,
                    active && { borderColor: colors.rust, backgroundColor: colors.cream },
                  ]}
                >
                  <View style={styles.presetSwatchRow}>
                    <View style={[styles.presetSwatch, { backgroundColor: swatchPalette.paper }]} />
                    <View style={[styles.presetSwatch, { backgroundColor: swatchPalette.ink }]} />
                    <View style={[styles.presetSwatch, { backgroundColor: accent ?? swatchPalette.rust }]} />
                  </View>
                  <View style={styles.presetCardHead}>
                    <Text style={styles.presetName}>{p.name}</Text>
                    {active ? <Check size={14} color={colors.rust} strokeWidth={3} /> : null}
                  </View>
                  <Text style={styles.presetDescription} numberOfLines={2}>
                    {p.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.themeBlock}>
          <View style={styles.rowLeft}>
            <Sparkles size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Accent color</Text>
          </View>
          <View style={styles.swatchGrid}>
            <Pressable
              onPress={() => setAccent(null)}
              style={[
                styles.accentSwatchAuto,
                accent === null && { borderColor: colors.rust, borderWidth: 2 },
              ]}
            >
              <Text style={styles.accentSwatchAutoLabel}>Auto</Text>
            </Pressable>
            {ACCENT_SWATCHES.map((swatch) => {
              const active = accent === swatch;
              return (
                <Pressable
                  key={swatch}
                  onPress={() => setAccent(swatch)}
                  style={[
                    styles.accentSwatch,
                    { backgroundColor: swatch },
                    active && styles.accentSwatchActive,
                  ]}
                >
                  {active ? <Check size={12} color={colors.paper} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.themeHint}>
            "Auto" uses the preset's default accent. Pick a color to override it everywhere.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.themeBlock}>
          <View style={styles.rowLeft}>
            <Type size={20} color={colors.stone500} />
            <Text style={styles.rowLabel}>Font</Text>
          </View>
          <View style={{ gap: 10 }}>
            {fontPairs.map((pair) => {
              const active = fontPairId === pair.id;
              return (
                <Pressable
                  key={pair.id}
                  onPress={() => setFontPair(pair.id as FontPairId)}
                  style={[
                    styles.fontRow,
                    active && { borderColor: colors.rust, backgroundColor: colors.cream },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.fontPreviewDisplay, { fontFamily: pair.fonts.display }]}
                      numberOfLines={1}
                    >
                      {pair.name}
                    </Text>
                    <Text
                      style={[styles.fontPreviewBody, { fontFamily: pair.fonts.body }]}
                      numberOfLines={1}
                    >
                      {pair.description}
                    </Text>
                  </View>
                  {active ? <Check size={16} color={colors.rust} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.themeHint}>
            Font changes apply right away. All bundled — no network required.
          </Text>
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
    reminderBlock: {
      paddingBottom: 12,
    },
    reminderMeta: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      marginTop: 2,
    },
    reminderSyncBtn: {
      alignSelf: 'flex-start',
      marginLeft: 48,
      marginRight: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    reminderSyncLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.rust,
    },
    reminderNote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      paddingHorizontal: 16,
      marginTop: 6,
    },
    appearanceRow: {
      padding: 16,
      gap: 12,
    },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.chip,
      borderRadius: 999,
      padding: 4,
      gap: 4,
    },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 999,
    },
    modeBtnLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.3,
    },
    themeBlock: {
      padding: 16,
      gap: 12,
    },
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    presetCard: {
      width: '48%',
      flexGrow: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      gap: 8,
    },
    presetSwatchRow: {
      flexDirection: 'row',
      gap: 4,
      height: 18,
      borderRadius: 4,
      overflow: 'hidden',
    },
    presetSwatch: {
      flex: 1,
      borderRadius: 4,
    },
    presetCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    presetName: {
      fontFamily: fonts.displayMedium,
      fontSize: 14,
      color: colors.ink,
    },
    presetDescription: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 15,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    },
    accentSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentSwatchActive: {
      borderWidth: 2,
      borderColor: colors.ink,
    },
    accentSwatchAuto: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    accentSwatchAutoLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.inkSoft,
    },
    themeHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 15,
    },
    fontRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
    },
    fontPreviewDisplay: {
      fontSize: 18,
      color: colors.ink,
    },
    fontPreviewBody: {
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
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
