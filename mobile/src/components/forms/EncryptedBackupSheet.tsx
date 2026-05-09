import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';
import { exportEncryptedBackupFile } from '../../services/backup';
import {
  isBiometricAvailable,
  rememberPasswordForBackup,
} from '../../services/passwordVault';

interface EncryptedBackupSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (note: string) => void;
}

interface StrengthInfo {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
}

const MIN_PASSWORD_LENGTH = 8;

function passwordStrength(password: string): StrengthInfo {
  if (!password) return { score: 0, label: '', hint: '' };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32;
  const bits = Math.log2(Math.max(pool, 2)) * password.length;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      score: 1,
      label: 'Too short',
      hint: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (bits < 40) return { score: 1, label: 'Weak', hint: 'Mix in more variety or length.' };
  if (bits < 60) return { score: 2, label: 'OK', hint: 'A passphrase you can remember is best.' };
  if (bits < 90) return { score: 3, label: 'Strong', hint: '' };
  return { score: 4, label: 'Excellent', hint: '' };
}

export function EncryptedBackupSheet({
  visible,
  onClose,
  onSuccess,
}: EncryptedBackupSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void isBiometricAvailable().then((available) => {
      if (cancelled) return;
      setBiometricAvailable(available);
      setRemember(available);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setPassword('');
      setConfirm('');
      setShowPassword(false);
      setError('');
      setBusy(false);
    }
  }, [visible]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const matches = password.length > 0 && password === confirm;
  const canSubmit =
    !busy && password.length >= MIN_PASSWORD_LENGTH && matches;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const { envelope } = await exportEncryptedBackupFile(password);
      if (remember) {
        try {
          await rememberPasswordForBackup(envelope.kdf.salt, password);
        } catch {
          // The backup was still saved successfully — surface a softer note.
          onSuccess(
            'Encrypted backup saved. Could not remember the password on this device.',
          );
          onClose();
          return;
        }
      }
      onSuccess(
        remember
          ? 'Encrypted backup saved. Password remembered on this device.'
          : 'Encrypted backup saved. Keep your password safe — without it the file cannot be opened.',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <View style={styles.titleWrap}>
              <ShieldCheck size={20} color={colors.rust} />
              <Text style={styles.sheetTitle}>Encrypted backup</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              disabled={busy}
            >
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <Text style={styles.intro}>
            Your backup will be encrypted with this password. Anyone — including
            you on a new phone — needs it to open the file. There is no recovery
            if you lose it.
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={colors.stone500} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                placeholder="At least 8 characters"
                placeholderTextColor={colors.stone500}
                editable={!busy}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={16} color={colors.stone500} />
                ) : (
                  <Eye size={16} color={colors.stone500} />
                )}
              </Pressable>
            </View>
            {password.length > 0 ? (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            strength.score >= i ? strengthColor(strength.score, colors) : colors.chip,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.strengthLabel}>{strength.label}</Text>
              </View>
            ) : null}
            {strength.hint ? <Text style={styles.fieldHint}>{strength.hint}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={colors.stone500} />
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                placeholder="Type it again"
                placeholderTextColor={colors.stone500}
                editable={!busy}
              />
            </View>
            {confirm.length > 0 && !matches ? (
              <Text style={styles.fieldError}>Passwords don't match.</Text>
            ) : null}
          </View>

          {biometricAvailable ? (
            <Pressable
              onPress={() => setRemember((r) => !r)}
              style={styles.rememberRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              disabled={busy}
            >
              <View style={[styles.checkbox, remember && { backgroundColor: colors.rust, borderColor: colors.rust }]}>
                {remember ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rememberLabelRow}>
                  <Fingerprint size={14} color={colors.stone500} />
                  <Text style={styles.rememberLabel}>Remember on this device</Text>
                </View>
                <Text style={styles.rememberHint}>
                  Skip the password prompt when restoring on this phone — Face ID
                  or your passcode will reveal it.
                </Text>
              </View>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.cancelBtn, busy && { opacity: 0.5 }]}
              disabled={busy}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[
                styles.primaryBtn,
                !canSubmit && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.paper} size="small" />
                  <Text style={styles.primaryLabel}>Encrypting…</Text>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} color={colors.paper} />
                  <Text style={styles.primaryLabel}>Create backup</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function strengthColor(score: number, colors: any): string {
  if (score <= 1) return colors.clay;
  if (score === 2) return colors.amberDeep ?? colors.rust;
  return colors.rust;
}

const createStyles = (colors: any) =>
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
      gap: 16,
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
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 22,
      color: colors.ink,
    },
    intro: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
      lineHeight: 19,
    },
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
    },
    input: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.ink,
      padding: 0,
    },
    fieldHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    fieldError: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.clay,
    },
    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    strengthBars: { flexDirection: 'row', flex: 1, gap: 4 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      width: 60,
      textAlign: 'right',
    },
    rememberRow: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkmark: {
      color: colors.paper,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 14,
    },
    rememberLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rememberLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    rememberHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 15,
      marginTop: 4,
    },
    errorBanner: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.clay,
      backgroundColor: colors.chip,
      padding: 10,
      borderRadius: 10,
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
    primaryBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.rust,
    },
    primaryLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
  });
