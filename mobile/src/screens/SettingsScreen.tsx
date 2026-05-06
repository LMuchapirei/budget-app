import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { useLock } from '../context/LockContext';
import {
  Bell,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  DollarSign,
  Lock,
  SunMoon,
  Type,
} from 'lucide-react-native';
import { REPORTING_CURRENCY_OPTIONS } from '../utils/currency';
import { ACCENT_SWATCHES, type ThemeMode, type ThemePresetId } from '../context/ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import type { FontPairId } from '../theme';
import { PRIVACY_POLICY_URL } from '../services/legal';
import { DataHandlingSheet } from '../components/forms/DataHandlingSheet';
import { CategoryManagerSheet } from '../components/forms/CategoryManagerSheet';
import { createSettingsStyles } from './settings/settingsStyles';

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
  const { replay: replayOnboarding } = useOnboarding();

  const styles = React.useMemo(() => createSettingsStyles(colors), [colors]);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState('');
  const [showDataHandling, setShowDataHandling] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);
  };

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

      <Text style={styles.sectionHeader}>Customization</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() => setShowCategoryManager(true)}
          style={styles.aboutRow}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Tag size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Manage categories</Text>
              <Text style={styles.aboutMeta}>
                Add, rename, recolor, change icons, or delete custom categories
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.stone500} />
        </Pressable>
      </View>

      <Text style={styles.sectionHeader}>About</Text>
      <View style={styles.card}>
        <Pressable
          onPress={() => setShowDataHandling(true)}
          style={styles.aboutRow}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <ShieldCheck size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>How data is handled</Text>
              <Text style={styles.aboutMeta}>
                What stays on this device and what doesn't
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.stone500} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={openPrivacyPolicy}
          style={styles.aboutRow}
          accessibilityRole="link"
        >
          <View style={styles.rowLeft}>
            <FileText size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Privacy policy</Text>
              <Text style={styles.aboutMeta}>Opens in your browser</Text>
            </View>
          </View>
          <ExternalLink size={16} color={colors.stone500} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={replayOnboarding}
          style={styles.aboutRow}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Info size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Show intro again</Text>
              <Text style={styles.aboutMeta}>Replay the welcome screens</Text>
            </View>
          </View>
          <ChevronRight size={16} color={colors.stone500} />
        </Pressable>
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

      <DataHandlingSheet
        visible={showDataHandling}
        onClose={() => setShowDataHandling(false)}
      />

      <CategoryManagerSheet
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
      />
    </View>
  );
}
