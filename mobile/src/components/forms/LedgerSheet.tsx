import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { REPORTING_CURRENCY_OPTIONS } from '../../utils/currency';
import { Field } from './shared/Field';
import { createLedgerSheetStyles } from './ledgerSheetStyles';
import { LedgerManageRow } from './LedgerManageRow';

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
  const styles = useMemo(() => createLedgerSheetStyles(colors), [colors]);
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
                    <LedgerManageRow
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
                      <LedgerManageRow
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
                      <LedgerManageRow
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
