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
import { Eye, EyeOff, Fingerprint, Lock, ShieldCheck, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme';
import {
  decryptAndParseBackup,
  type BackupV1,
} from '../../services/backup';
import {
  WrongPasswordError,
  CorruptBackupError,
  type EncryptedBackupEnvelope,
} from '../../services/backupCrypto';
import {
  isPasswordRemembered,
  recallPassword,
} from '../../services/passwordVault';

interface RestoreBackupSheetProps {
  visible: boolean;
  envelope: EncryptedBackupEnvelope | null;
  onClose: () => void;
  onDecrypted: (backup: BackupV1) => void;
}

export function RestoreBackupSheet({
  visible,
  envelope,
  onClose,
  onDecrypted,
}: RestoreBackupSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<null | 'biometric' | 'password'>(null);
  const [error, setError] = useState('');
  const [biometricKnown, setBiometricKnown] = useState(false);
  const [biometricNote, setBiometricNote] = useState('');

  useEffect(() => {
    if (!visible || !envelope) {
      setPassword('');
      setShowPassword(false);
      setBusy(null);
      setError('');
      setBiometricKnown(false);
      setBiometricNote('');
      return;
    }
    let cancelled = false;
    void isPasswordRemembered(envelope.kdf.salt).then((known) => {
      if (!cancelled) setBiometricKnown(known);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, envelope]);

  const exportedAtLabel = useMemo(() => {
    if (!envelope?.exportedAt) return '';
    try {
      const date = new Date(envelope.exportedAt);
      return date.toLocaleString();
    } catch {
      return envelope.exportedAt;
    }
  }, [envelope]);

  const handlePasswordSubmit = async () => {
    if (!envelope || password.length === 0) return;
    setBusy('password');
    setError('');
    try {
      const backup = await decryptAndParseBackup(envelope, password);
      onDecrypted(backup);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setError('Wrong password.');
      } else if (err instanceof CorruptBackupError) {
        setError('This backup file is corrupted and cannot be opened.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not decrypt backup.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleBiometric = async () => {
    if (!envelope) return;
    setBusy('biometric');
    setError('');
    setBiometricNote('');
    try {
      const recalled = await recallPassword(envelope.kdf.salt);
      if (!recalled) {
        setBiometricNote('Could not unlock. Enter the password instead.');
        return;
      }
      const backup = await decryptAndParseBackup(envelope, recalled);
      onDecrypted(backup);
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        // The remembered password no longer matches — the file was likely
        // re-encrypted on another device with a different password.
        setError(
          'The remembered password does not match this file. Enter the password manually.',
        );
      } else if (err instanceof CorruptBackupError) {
        setError('This backup file is corrupted and cannot be opened.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not decrypt backup.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={busy ? undefined : onClose}
        />
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
              disabled={busy !== null}
            >
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLine}>
              File from {exportedAtLabel || 'an unknown date'}
            </Text>
            <Text style={styles.metaSubline}>
              Restoring will replace all current data on this device.
            </Text>
          </View>

          {biometricKnown ? (
            <Pressable
              onPress={handleBiometric}
              disabled={busy !== null}
              style={[
                styles.biometricBtn,
                busy === 'biometric' && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Unlock with biometrics"
            >
              {busy === 'biometric' ? (
                <ActivityIndicator color={colors.paper} size="small" />
              ) : (
                <Fingerprint size={18} color={colors.paper} />
              )}
              <Text style={styles.biometricLabel}>
                {busy === 'biometric' ? 'Unlocking…' : 'Use Face ID / passcode'}
              </Text>
            </Pressable>
          ) : null}

          {biometricNote ? <Text style={styles.fieldHint}>{biometricNote}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {biometricKnown ? 'Or enter password' : 'Password'}
            </Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={colors.stone500} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                placeholder="Backup password"
                placeholderTextColor={colors.stone500}
                editable={busy === null}
                onSubmitEditing={handlePasswordSubmit}
                returnKeyType="go"
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
          </View>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.cancelBtn, busy !== null && { opacity: 0.5 }]}
              disabled={busy !== null}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handlePasswordSubmit}
              disabled={busy !== null || password.length === 0}
              style={[
                styles.primaryBtn,
                (busy !== null || password.length === 0) && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
            >
              {busy === 'password' ? (
                <>
                  <ActivityIndicator color={colors.paper} size="small" />
                  <Text style={styles.primaryLabel}>Decrypting…</Text>
                </>
              ) : (
                <Text style={styles.primaryLabel}>Restore</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
    metaCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 4,
    },
    metaLine: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    metaSubline: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      lineHeight: 16,
    },
    biometricBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    biometricLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
    },
    field: { gap: 6 },
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.stone500,
    },
    fieldHint: {
      fontFamily: fonts.body,
      fontSize: 11,
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
