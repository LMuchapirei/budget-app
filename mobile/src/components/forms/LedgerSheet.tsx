import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Archive,
  ArchiveRestore,
  Check,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { LedgerAccount, LedgerType } from '../../types';
import { fonts } from '../../theme';
import { REPORTING_CURRENCY_OPTIONS } from '../../utils/currency';

const ACCOUNT_TYPES: { id: LedgerType; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'credit-card', label: 'Credit card' },
  { id: 'savings', label: 'Savings' },
  { id: 'mobile-money', label: 'Mobile money' },
  { id: 'loan', label: 'Loan' },
  { id: 'other', label: 'Other' },
];

const COLOR_SWATCHES = [
  '#8B5A3C',
  '#C97B4A',
  '#A85751',
  '#D4A04A',
  '#6B8E6B',
  '#3D6B4A',
  '#5A8A6F',
  '#7A8FA8',
  '#5C7A8E',
  '#9B7FA0',
  '#8A8275',
  '#2C2416',
];

type CurrencyOption = (typeof REPORTING_CURRENCY_OPTIONS)[number];

interface LedgerSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  ledger?: LedgerAccount | null;
  onClose: () => void;
}

export function LedgerSheet({ visible, mode, ledger, onClose }: LedgerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    addLedger,
    updateLedger,
    archiveLedger,
    unarchiveLedger,
    deleteLedger,
    setDefaultLedger,
    ledgerTransactionCount,
    activeLedgers,
    ledgers,
  } = useBudget();

  const isEditing = mode === 'edit' && Boolean(ledger);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [accountType, setAccountType] = useState<LedgerType>('cash');
  const [currency, setCurrency] = useState<CurrencyOption>(REPORTING_CURRENCY_OPTIONS[0]);
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (isEditing && ledger) {
      setName(ledger.name);
      setDescription(ledger.description ?? '');
      setAccountNumber(ledger.accountNumber ?? '');
      setOpeningBalance(
        ledger.openingBalance != null ? String(ledger.openingBalance) : '',
      );
      setAccountType(ledger.accountType ?? 'other');
      const matchedCurrency =
        REPORTING_CURRENCY_OPTIONS.find((c) => c.code === ledger.currencyCode) ??
        REPORTING_CURRENCY_OPTIONS[0];
      setCurrency(matchedCurrency);
      setColor(ledger.color || COLOR_SWATCHES[0]);
    } else {
      setName('');
      setDescription('');
      setAccountNumber('');
      setOpeningBalance('');
      setAccountType('cash');
      setCurrency(REPORTING_CURRENCY_OPTIONS[0]);
      setColor(COLOR_SWATCHES[0]);
    }
    setConfirmingDelete(false);
    setReassignTo(null);
  }, [visible, isEditing, ledger]);

  const reassignCandidates = useMemo(() => {
    if (!ledger) return [];
    return activeLedgers.filter((l) => l.id !== ledger.id);
  }, [activeLedgers, ledger]);

  const linkedCount = ledger ? ledgerTransactionCount(ledger.id) : 0;

  useEffect(() => {
    if (!confirmingDelete) return;
    if (linkedCount > 0 && !reassignTo && reassignCandidates[0]) {
      setReassignTo(reassignCandidates[0].id);
    }
  }, [confirmingDelete, linkedCount, reassignTo, reassignCandidates]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  const parseOpeningBalance = (): number | undefined => {
    const trimmed = openingBalance.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    if (Number.isNaN(n)) return undefined;
    return n;
  };

  const handleSave = () => {
    if (!canSave) return;
    const opening = parseOpeningBalance();
    if (isEditing && ledger) {
      updateLedger({
        ...ledger,
        name: trimmedName,
        description: description.trim(),
        accountNumber: accountNumber.trim() || undefined,
        accountType,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        openingBalance: opening,
        color,
      });
    } else {
      addLedger({
        name: trimmedName,
        description: description.trim(),
        accountNumber: accountNumber.trim() || undefined,
        accountType,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        openingBalance: opening,
        color,
      });
    }
    onClose();
  };

  const handleArchiveToggle = () => {
    if (!ledger) return;
    if (ledger.archived) {
      unarchiveLedger(ledger.id);
    } else {
      archiveLedger(ledger.id);
    }
    onClose();
  };

  const handleSetDefault = () => {
    if (!ledger || ledger.isDefault) return;
    setDefaultLedger(ledger.id);
    onClose();
  };

  const beginDelete = () => {
    if (!ledger || ledger.isDefault) return;
    if (linkedCount === 0) {
      Alert.alert(
        'Delete account?',
        `${ledger.name} has no transactions. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteLedger(ledger.id);
              onClose();
            },
          },
        ],
      );
      return;
    }
    if (reassignCandidates.length === 0) {
      Alert.alert(
        'Cannot delete',
        'Add another account first so transactions can be moved before deleting.',
      );
      return;
    }
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    if (!ledger) return;
    deleteLedger(ledger.id, reassignTo ?? undefined);
    onClose();
  };

  const cancelDelete = () => {
    setConfirmingDelete(false);
    setReassignTo(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {isEditing ? 'Edit account' : 'New account'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {confirmingDelete ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.dangerTitle}>Delete {ledger?.name}?</Text>
              <Text style={styles.dangerCopy}>
                {linkedCount} {linkedCount === 1 ? 'transaction' : 'transactions'}{' '}
                will move to:
              </Text>
              <View style={styles.chipWrap}>
                {reassignCandidates.map((candidate) => {
                  const active = reassignTo === candidate.id;
                  return (
                    <Pressable
                      key={candidate.id}
                      onPress={() => setReassignTo(candidate.id)}
                      style={[
                        styles.chip,
                        active && { backgroundColor: colors.ink },
                      ]}
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: candidate.color || colors.rust },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: active ? colors.paper : colors.inkSoft },
                        ]}
                      >
                        {candidate.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.dangerActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={[styles.actionBtn, styles.actionBtnGhost]}
                >
                  <Text style={[styles.actionBtnLabel, { color: colors.inkSoft }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={!reassignTo}
                  style={[
                    styles.actionBtn,
                    styles.actionBtnDanger,
                    !reassignTo && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[styles.actionBtnLabel, { color: colors.paper }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
                keyboardShouldPersistTaps="always"
                style={styles.scroll}
              >
                <Field label="Account name">
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. FBC Staff Account"
                    placeholderTextColor={colors.stone400}
                    style={styles.input}
                  />
                </Field>

                <Field label="Description">
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional note"
                    placeholderTextColor={colors.stone400}
                    style={styles.input}
                  />
                </Field>

                <Field label="Account type">
                  <View style={styles.chipWrap}>
                    {ACCOUNT_TYPES.map((option) => {
                      const active = accountType === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => setAccountType(option.id)}
                          style={[
                            styles.chip,
                            active && { backgroundColor: colors.ink },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipLabel,
                              { color: active ? colors.paper : colors.inkSoft },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Currency">
                  <View style={styles.currencyGrid}>
                    {REPORTING_CURRENCY_OPTIONS.map((option) => {
                      const active =
                        currency.code === option.code &&
                        currency.symbol === option.symbol;
                      return (
                        <Pressable
                          key={`${option.code}-${option.symbol}`}
                          onPress={() => setCurrency(option)}
                          style={[
                            styles.currencyOption,
                            active && { backgroundColor: colors.ink },
                          ]}
                        >
                          <Text
                            style={[
                              styles.currencySymbol,
                              active && { color: colors.paper },
                            ]}
                          >
                            {option.symbol}
                          </Text>
                          <Text
                            style={[
                              styles.currencyCode,
                              active && { color: colors.paper },
                            ]}
                          >
                            {option.code}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Account number">
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="Optional"
                    placeholderTextColor={colors.stone400}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>

                <Field label="Opening balance">
                  <View style={styles.amountRow}>
                    <Text style={styles.amountSign}>{currency.symbol}</Text>
                    <TextInput
                      value={openingBalance}
                      onChangeText={setOpeningBalance}
                      placeholder="0.00"
                      placeholderTextColor={colors.stone400}
                      keyboardType="decimal-pad"
                      style={styles.amountInput}
                    />
                  </View>
                </Field>

                <Field label="Color">
                  <View style={styles.swatchGrid}>
                    {COLOR_SWATCHES.map((swatch) => {
                      const active = color === swatch;
                      return (
                        <Pressable
                          key={swatch}
                          onPress={() => setColor(swatch)}
                          style={[
                            styles.swatch,
                            { backgroundColor: swatch },
                            active && styles.swatchActive,
                          ]}
                        >
                          {active ? (
                            <Check size={12} color={colors.paper} strokeWidth={3} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {isEditing && ledger ? (
                  <View style={styles.manageSection}>
                    <ManageRow
                      icon={
                        <Star
                          size={16}
                          color={ledger.isDefault ? colors.rust : colors.stone500}
                          fill={ledger.isDefault ? colors.rust : 'transparent'}
                        />
                      }
                      label={ledger.isDefault ? 'Default account' : 'Set as default'}
                      onPress={ledger.isDefault ? undefined : handleSetDefault}
                      disabled={ledger.isDefault}
                    />
                    {!ledger.isDefault ? (
                      <ManageRow
                        icon={
                          ledger.archived ? (
                            <ArchiveRestore size={16} color={colors.moss} />
                          ) : (
                            <Archive size={16} color={colors.stone600} />
                          )
                        }
                        label={ledger.archived ? 'Restore from archive' : 'Archive account'}
                        onPress={handleArchiveToggle}
                      />
                    ) : null}
                    {!ledger.isDefault ? (
                      <ManageRow
                        icon={<Trash2 size={16} color={colors.clay} />}
                        label="Delete account..."
                        labelColor={colors.clay}
                        onPress={beginDelete}
                      />
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.submit, !canSave && { opacity: 0.4 }]}
              >
                <Text style={styles.submitLabel}>
                  {isEditing ? 'Save changes' : 'Create account'}
                </Text>
              </Pressable>
            </>
          )}

          {!isEditing && ledgers.some((l) => l.archived) ? (
            <Text style={styles.helperFootnote}>
              Tip: archived accounts stay hidden but keep their transactions.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.stone500,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function ManageRow({
  icon,
  label,
  onPress,
  disabled,
  labelColor,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  labelColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: pressed ? colors.chip : colors.paper,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: 13,
          color: labelColor ?? colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
      gap: 18,
      maxHeight: '92%',
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
    },
    scroll: {
      maxHeight: 520,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    amountSign: { fontFamily: fonts.displayLight, fontSize: 24, color: colors.stone400 },
    amountInput: {
      flex: 1,
      fontFamily: fonts.displayLight,
      fontSize: 24,
      color: colors.ink,
      paddingVertical: 4,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    chipDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    chipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
    },
    currencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    currencyOption: {
      minWidth: 70,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      gap: 2,
    },
    currencySymbol: {
      fontFamily: fonts.display,
      fontSize: 15,
      color: colors.ink,
    },
    currencyCode: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.stone500,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchActive: {
      borderWidth: 2,
      borderColor: colors.ink,
    },
    manageSection: {
      gap: 8,
      paddingTop: 12,
    },
    submit: {
      backgroundColor: colors.ink,
      paddingVertical: 14,
      borderRadius: 999,
      alignItems: 'center',
    },
    submitLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.paper,
      letterSpacing: 0.5,
    },
    dangerPanel: {
      gap: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    dangerTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 18,
      color: colors.ink,
    },
    dangerCopy: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
    },
    dangerActions: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
    },
    actionBtnGhost: {
      backgroundColor: colors.chip,
    },
    actionBtnDanger: {
      backgroundColor: colors.clay,
    },
    actionBtnLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
    },
    helperFootnote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
      textAlign: 'center',
    },
  });
