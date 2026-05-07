import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { useLock } from '../context/LockContext';
import {
  Bell,
  Bug,
  Check,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  FileText,
  FileUp,
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
  Upload,
  X,
} from 'lucide-react-native';
import { REPORTING_CURRENCY_OPTIONS } from '../utils/currency';
import { ACCENT_SWATCHES, type ThemeMode, type ThemePresetId } from '../context/ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import type { FontPairId } from '../theme';
import { PRIVACY_POLICY_URL } from '../services/legal';
import { DataHandlingSheet } from '../components/forms/DataHandlingSheet';
import { CategoryManagerSheet } from '../components/forms/CategoryManagerSheet';
import {
  isDiagnosticsEnabled,
  loadDiagnosticsPref,
  setDiagnosticsEnabled,
} from '../services/diagnostics';
import {
  exportBackupJsonFile,
  exportTransactionsCsvFile,
  pickAndParseBackup,
} from '../services/backup';
import { fonts } from '../theme';
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
    transactions,
    ledgers,
    customCategories,
    budgets,
    goals,
    scheduledOccurrenceRecords,
    paymentEvidence,
    transactionEditHistory,
    restoreBackup,
  } = useBudget();
  const { isAppLockEnabled, setAppLockEnabled } = useLock();
  const { replay: replayOnboarding } = useOnboarding();

  const styles = React.useMemo(() => createSettingsStyles(colors), [colors]);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState('');
  const [showDataHandling, setShowDataHandling] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [diagnosticsOn, setDiagnosticsOn] = useState(isDiagnosticsEnabled);
  const [crashOnRender, setCrashOnRender] = useState(false);
  const [dataBusy, setDataBusy] = useState<null | 'csv' | 'json' | 'restore'>(null);
  const [dataNote, setDataNote] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearNote, setClearNote] = useState('');

  if (crashOnRender) {
    throw new Error('Demo: forced crash from Settings');
  }

  useEffect(() => {
    let cancelled = false;
    loadDiagnosticsPref().then((value) => {
      if (!cancelled) setDiagnosticsOn(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDiagnosticsToggle = async (next: boolean) => {
    setDiagnosticsOn(next);
    try {
      await setDiagnosticsEnabled(next);
    } catch {
      setDiagnosticsOn(!next);
    }
  };

  const handleExportCsv = async () => {
    setDataBusy('csv');
    setDataNote('');
    try {
      await exportTransactionsCsvFile(transactions, ledgers);
      setDataNote(`Exported ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setDataNote(error instanceof Error ? error.message : 'Could not export CSV.');
    } finally {
      setDataBusy(null);
    }
  };

  const handleExportBackup = async () => {
    setDataBusy('json');
    setDataNote('');
    try {
      await exportBackupJsonFile({
        transactions,
        ledgers,
        customCategories,
        budgets,
        goals,
        scheduledOccurrenceRecords,
        paymentEvidence,
        transactionEditHistory,
      });
      setDataNote('Backup file ready to share.');
    } catch (error) {
      setDataNote(error instanceof Error ? error.message : 'Could not export backup.');
    } finally {
      setDataBusy(null);
    }
  };

  const handleRestore = async () => {
    setShowRestoreConfirm(false);
    setDataBusy('restore');
    setDataNote('');
    try {
      const payload = await pickAndParseBackup();
      if (!payload) {
        setDataNote('');
        return;
      }
      await restoreBackup(payload);
      setDataNote('Backup restored. Re-enable schedule reminders if you use them.');
    } catch (error) {
      setDataNote(error instanceof Error ? error.message : 'Could not restore backup.');
    } finally {
      setDataBusy(null);
    }
  };

  const handleClearAllData = async () => {
    setClearBusy(true);
    setClearNote('');
    try {
      await clearAllData();
      setShowClearConfirm(false);
      setClearNote('All data cleared.');
    } catch (error) {
      setClearNote(error instanceof Error ? error.message : 'Could not clear data.');
    } finally {
      setClearBusy(false);
    }
  };

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

      <Text style={styles.sectionHeader}>Data</Text>
      <View style={styles.card}>
        <Pressable
          onPress={handleExportCsv}
          disabled={dataBusy !== null || transactions.length === 0}
          style={[
            styles.aboutRow,
            (dataBusy !== null || transactions.length === 0) && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Download size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Export transactions (CSV)</Text>
              <Text style={styles.aboutMeta}>
                Spreadsheet-friendly. Transactions only — no budgets or goals.
              </Text>
            </View>
          </View>
          {dataBusy === 'csv' ? (
            <ActivityIndicator color={colors.rust} />
          ) : (
            <ChevronRight size={16} color={colors.stone500} />
          )}
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={handleExportBackup}
          disabled={dataBusy !== null}
          style={[styles.aboutRow, dataBusy !== null && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Database size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Export full backup (JSON)</Text>
              <Text style={styles.aboutMeta}>
                Everything you can restore later. Receipt photos are not included.
              </Text>
            </View>
          </View>
          {dataBusy === 'json' ? (
            <ActivityIndicator color={colors.rust} />
          ) : (
            <ChevronRight size={16} color={colors.stone500} />
          )}
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={() => setShowRestoreConfirm(true)}
          disabled={dataBusy !== null}
          style={[styles.aboutRow, dataBusy !== null && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Upload size={20} color={colors.stone500} />
            <View>
              <Text style={styles.rowLabel}>Restore from backup</Text>
              <Text style={styles.aboutMeta}>
                Replaces all current data with the backup file you pick.
              </Text>
            </View>
          </View>
          {dataBusy === 'restore' ? (
            <ActivityIndicator color={colors.rust} />
          ) : (
            <ChevronRight size={16} color={colors.stone500} />
          )}
        </Pressable>

        {dataNote ? <Text style={styles.reminderNote}>{dataNote}</Text> : null}
      </View>

      <Text style={styles.sectionHeader}>Diagnostics</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.rowLeft, { flex: 1, minWidth: 0 }]}>
            <Bug size={20} color={colors.stone500} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowLabel}>Send anonymous crash reports</Text>
              <Text style={styles.aboutMeta}>
                Off by default. Helps fix bugs — no transactions or balances are sent.
              </Text>
            </View>
          </View>
          <Switch
            value={diagnosticsOn}
            onValueChange={handleDiagnosticsToggle}
            trackColor={{ true: colors.rust, false: colors.chip }}
            thumbColor={colors.cream}
          />
        </View>

        <View style={styles.divider} />

        <Pressable
          onPress={() => setCrashOnRender(true)}
          style={styles.aboutRow}
          accessibilityRole="button"
        >
          <View style={styles.rowLeft}>
            <Bug size={20} color={colors.clay} />
            <View>
              <Text style={[styles.rowLabel, { color: colors.clay }]}>
                Trigger test crash
              </Text>
              <Text style={styles.aboutMeta}>
                Demo only — throws an error to show the recovery screen.
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
          onPress={() => {
            setClearNote('');
            setShowClearConfirm(true);
          }}
          style={styles.dangerRow}
          accessibilityRole="button"
        >
          <Trash2 size={20} color={colors.clay} />
          <Text style={styles.dangerLabel}>Clear All Data & Reset</Text>
        </Pressable>
        <Text style={styles.dangerDesc}>
          This will permanently delete all transactions and custom categories from your device.
        </Text>
        {clearNote ? <Text style={styles.reminderNote}>{clearNote}</Text> : null}
      </View>

      <DataHandlingSheet
        visible={showDataHandling}
        onClose={() => setShowDataHandling(false)}
      />

      <CategoryManagerSheet
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
      />

      <RestoreConfirmModal
        visible={showRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={handleRestore}
        colors={colors}
      />

      <ClearAllConfirmModal
        visible={showClearConfirm}
        busy={clearBusy}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        colors={colors}
      />
    </View>
  );
}

interface RestoreConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function RestoreConfirmModal({ visible, onCancel, onConfirm, colors }: RestoreConfirmModalProps) {
  const styles = React.useMemo(() => createRestoreStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Restore from backup?</Text>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          <Text style={styles.body}>
            This will <Text style={styles.bodyEmphasis}>replace all of your current data</Text> with
            the contents of the file you pick — transactions, ledgers, budgets, goals, categories,
            scheduled bills, and payment evidence. This can&apos;t be undone.
          </Text>
          <Text style={styles.bodyMeta}>
            Theme, currency, lock, and reminder permissions are kept as-is.
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <FileUp size={14} color={colors.paper} />
              <Text style={styles.confirmLabel}>Pick file & restore</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CLEAR_CONFIRM_PHRASE = 'delete my data';

interface ClearAllConfirmModalProps {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function ClearAllConfirmModal({
  visible,
  busy,
  onCancel,
  onConfirm,
  colors,
}: ClearAllConfirmModalProps) {
  const styles = React.useMemo(() => createClearStyles(colors), [colors]);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!visible) setTyped('');
  }, [visible]);

  const matches = typed.trim().toLowerCase() === CLEAR_CONFIRM_PHRASE;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={busy ? undefined : onCancel} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Clear all data?</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              accessibilityLabel="Close"
              disabled={busy}
            >
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          <Text style={styles.body}>
            This <Text style={styles.bodyEmphasis}>permanently deletes</Text> every transaction,
            ledger, custom category, budget, goal, scheduled bill, payment evidence, and edit
            history on this device. This can&apos;t be undone.
          </Text>
          <Text style={styles.bodyMeta}>
            Theme, lock, currency, and onboarding state are kept.
          </Text>
          <Text style={styles.prompt}>
            Type <Text style={styles.promptPhrase}>{CLEAR_CONFIRM_PHRASE}</Text> to confirm.
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={CLEAR_CONFIRM_PHRASE}
            placeholderTextColor={colors.stone500}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            editable={!busy}
            style={styles.input}
            accessibilityLabel="Confirmation phrase"
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.85 },
                busy && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!matches || busy}
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { opacity: 0.85 },
                (!matches || busy) && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <>
                  <Trash2 size={14} color={colors.paper} />
                  <Text style={styles.confirmLabel}>Delete everything</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createClearStyles = (colors: any) =>
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
      flex: 1,
      paddingRight: 12,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 20,
      color: colors.stone600,
    },
    bodyEmphasis: {
      fontFamily: fonts.bodySemibold,
      color: colors.clay,
    },
    bodyMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 18,
      color: colors.stone500,
    },
    prompt: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 20,
      color: colors.stone600,
      marginTop: 4,
    },
    promptPhrase: {
      fontFamily: fonts.bodySemibold,
      color: colors.ink,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.paper,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    confirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.clay,
    },
    confirmLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
  });

const createRestoreStyles = (colors: any) =>
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
      flex: 1,
      paddingRight: 12,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 20,
      color: colors.stone600,
    },
    bodyEmphasis: {
      fontFamily: fonts.bodySemibold,
      color: colors.clay,
    },
    bodyMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 18,
      color: colors.stone500,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    confirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.clay,
    },
    confirmLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
  });
