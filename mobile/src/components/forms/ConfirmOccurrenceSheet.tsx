import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
import * as ImagePicker from 'expo-image-picker';
import { CalendarDays, Camera, Clipboard, ImagePlus, Mail, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useBudget } from '../../context/BudgetContext';
import type { ConfirmOccurrenceOverride, PaymentEvidenceDraft, ScheduledOccurrence } from '../../types';
import { deleteEvidenceFile, persistEvidenceImage } from '../../services/paymentEvidenceFiles';
import { fonts } from '../../theme';
import { Field } from './AddCategorySheet';
import { DatePickerSheet } from './DatePickerSheet';
import {
  parsePaymentEvidenceText,
  summarizeEvidence,
} from '../../utils/paymentEvidence';

interface ConfirmOccurrenceSheetProps {
  visible: boolean;
  occurrence: ScheduledOccurrence | null;
  onConfirm: (override: ConfirmOccurrenceOverride) => void;
  onClose: () => void;
}

function formatDateLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ConfirmOccurrenceSheet({
  visible,
  occurrence,
  onConfirm,
  onClose,
}: ConfirmOccurrenceSheetProps) {
  const { colors } = useTheme();
  const { activeLedgers, ledgers } = useBudget();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [ledgerId, setLedgerId] = useState<string | undefined>();
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [proofTextType, setProofTextType] = useState<'sms_text' | 'email_text'>('sms_text');
  const [proofText, setProofText] = useState('');
  const [proofReference, setProofReference] = useState('');
  const [evidenceDrafts, setEvidenceDrafts] = useState<PaymentEvidenceDraft[]>([]);
  const [savingProof, setSavingProof] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const selectableLedgers = useMemo(() => {
    if (!occurrence?.source.ledgerId) return activeLedgers;
    if (activeLedgers.some((ledger) => ledger.id === occurrence.source.ledgerId)) {
      return activeLedgers;
    }
    const currentLedger = ledgers.find((ledger) => ledger.id === occurrence.source.ledgerId);
    return currentLedger ? [...activeLedgers, currentLedger] : activeLedgers;
  }, [activeLedgers, ledgers, occurrence?.source.ledgerId]);

  const selectedLedger = selectableLedgers.find((ledger) => ledger.id === ledgerId);

  useEffect(() => {
    if (!visible || !occurrence) return;
    setAmount(String(occurrence.amount));
    setDate(occurrence.effectiveDueDate);
    setLedgerId(occurrence.source.ledgerId);
    setCategory(occurrence.source.category);
    setNotes('');
    setProofTextType('sms_text');
    setProofText('');
    setProofReference('');
    setEvidenceDrafts([]);
    setSavingProof(false);
    setShowDatePicker(false);
  }, [occurrence, visible]);

  const parsedAmount = Number(amount);
  const canConfirm =
    Boolean(occurrence) &&
    amount.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    Boolean(date) &&
    Boolean(ledgerId) &&
    category.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    Keyboard.dismiss();
    onConfirm({
      amount: parsedAmount,
      date,
      ledgerId,
      category: category.trim(),
      notes: notes.trim() || undefined,
      evidence: evidenceDrafts,
    });
  };

  const closeWithoutSaving = () => {
    evidenceDrafts.forEach((draft) => {
      if (draft.attachmentUri) deleteEvidenceFile(draft.attachmentUri).catch(console.error);
    });
    onClose();
  };

  const addTextEvidence = () => {
    if (!occurrence || (!proofText.trim() && !proofReference.trim())) return;
    const parsed = proofText.trim()
      ? parsePaymentEvidenceText(proofText, occurrence.currencyCode)
      : {};
    setEvidenceDrafts([
      {
        ...parsed,
        type: proofTextType,
        rawText: proofText.trim() || undefined,
        reference: proofReference.trim() || parsed.reference,
        currencyCode: parsed.currencyCode ?? occurrence.currencyCode,
        confidence: parsed.confidence ?? 'manual',
      },
      ...evidenceDrafts,
    ]);
    setProofText('');
    setProofReference('');
  };

  const addPhotoEvidence = async (source: 'camera' | 'library') => {
    if (!occurrence || savingProof) return;
    try {
      setSavingProof(true);
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera permission needed', 'Allow camera access to take proof photos.');
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.72,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.72,
            });
      if (result.canceled || !result.assets[0]?.uri) return;
      const storedUri = await persistEvidenceImage(result.assets[0].uri);
      setEvidenceDrafts([
        {
          type: 'photo',
          attachmentUri: storedUri,
          attachmentName: result.assets[0].fileName ?? 'Payment proof',
          note: occurrence.source.description,
          currencyCode: occurrence.currencyCode,
          confidence: 'manual',
        },
        ...evidenceDrafts,
      ]);
    } catch {
      Alert.alert('Proof not saved', 'The selected image could not be attached.');
    } finally {
      setSavingProof(false);
    }
  };

  const removeDraft = (index: number) => {
    const draft = evidenceDrafts[index];
    if (draft?.attachmentUri) deleteEvidenceFile(draft.attachmentUri).catch(console.error);
    setEvidenceDrafts(evidenceDrafts.filter((_, i) => i !== index));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeWithoutSaving}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeWithoutSaving} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Confirm occurrence</Text>
            <Pressable onPress={closeWithoutSaving} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {occurrence ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
              <Text style={styles.sourceTitle}>{occurrence.source.description}</Text>

              <Field label={`Amount (${selectedLedger?.currencyCode ?? occurrence.currencyCode})`}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountSign}>
                    {selectedLedger?.currencySymbol ?? occurrence.currencySymbol}
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.stone400}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />
                </View>
              </Field>

              <Field label="Post date">
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                  <CalendarDays size={15} color={colors.stone500} />
                  <Text style={styles.dateButtonText}>{formatDateLabel(date)}</Text>
                </Pressable>
              </Field>

              <Field label="Account">
                <View style={styles.chipWrap}>
                  {selectableLedgers.map((ledger) => {
                    const active = ledger.id === ledgerId;
                    return (
                      <Pressable
                        key={ledger.id}
                        onPress={() => setLedgerId(ledger.id)}
                        style={[styles.chip, active && { backgroundColor: colors.ink }]}
                      >
                        <View
                          style={[
                            styles.chipDot,
                            { backgroundColor: ledger.color || colors.rust },
                          ]}
                        />
                        <Text style={[styles.chipLabel, active && { color: colors.paper }]}>
                          {ledger.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Category">
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Category"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
              </Field>

              <Field label="Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
              </Field>

              <Field label="Payment proof">
                <View style={styles.proofGrid}>
                  <Pressable
                    onPress={() => addPhotoEvidence('camera')}
                    disabled={savingProof}
                    style={styles.proofButton}
                  >
                    {savingProof ? (
                      <ActivityIndicator size="small" color={colors.rust} />
                    ) : (
                      <Camera size={15} color={colors.rust} />
                    )}
                    <Text style={styles.proofButtonText}>Photo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addPhotoEvidence('library')}
                    disabled={savingProof}
                    style={styles.proofButton}
                  >
                    <ImagePlus size={15} color={colors.rust} />
                    <Text style={styles.proofButtonText}>Image</Text>
                  </Pressable>
                </View>
                <View style={styles.proofModeRow}>
                  {(['sms_text', 'email_text'] as const).map((mode) => {
                    const active = proofTextType === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setProofTextType(mode)}
                        style={[styles.proofMode, active && { backgroundColor: colors.ink }]}
                      >
                        {mode === 'email_text' ? (
                          <Mail size={13} color={active ? colors.paper : colors.stone600} />
                        ) : (
                          <Clipboard size={13} color={active ? colors.paper : colors.stone600} />
                        )}
                        <Text style={[styles.proofModeText, active && { color: colors.paper }]}>
                          {mode === 'email_text' ? 'Email' : 'SMS'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={proofText}
                  onChangeText={setProofText}
                  placeholder="Paste bank SMS or email alert"
                  placeholderTextColor={colors.stone400}
                  multiline
                  style={styles.proofTextArea}
                />
                <View style={styles.proofInline}>
                  <TextInput
                    value={proofReference}
                    onChangeText={setProofReference}
                    placeholder="Reference"
                    placeholderTextColor={colors.stone400}
                    style={styles.proofInput}
                  />
                  <Pressable
                    onPress={addTextEvidence}
                    disabled={!proofText.trim() && !proofReference.trim()}
                    style={[
                      styles.proofAdd,
                      !proofText.trim() && !proofReference.trim() && { opacity: 0.45 },
                    ]}
                  >
                    <Clipboard size={13} color={colors.paper} />
                    <Text style={styles.proofAddText}>Attach</Text>
                  </Pressable>
                </View>
                {evidenceDrafts.length > 0 ? (
                  <View style={styles.proofList}>
                    {evidenceDrafts.map((item, index) => (
                      <View key={`${item.type}-${index}`} style={styles.proofItem}>
                        {item.attachmentUri ? (
                          <Image source={{ uri: item.attachmentUri }} style={styles.proofThumb} />
                        ) : (
                          <View style={styles.proofIcon}>
                            <Clipboard size={14} color={colors.rust} />
                          </View>
                        )}
                        <Text style={styles.proofSummary} numberOfLines={1}>
                          {summarizeEvidence(item)}
                        </Text>
                        <Pressable
                          onPress={() => removeDraft(index)}
                          hitSlop={8}
                        >
                          <Trash2 size={14} color={colors.clay} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Field>
            </ScrollView>
          ) : null}

          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            style={[styles.submit, !canConfirm && { opacity: 0.4 }]}
          >
            <Text style={styles.submitLabel}>
              {evidenceDrafts.length > 0 ? 'Post with proof' : 'Post transaction'}
            </Text>
          </Pressable>
        </View>

        <DatePickerSheet
          visible={showDatePicker}
          title="Post date"
          value={date}
          onSelect={setDate}
          onClose={() => setShowDatePicker(false)}
        />
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
    sourceTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 17,
      color: colors.ink,
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    amountSign: { fontFamily: fonts.displayLight, fontSize: 28, color: colors.stone400 },
    amountInput: {
      flex: 1,
      fontFamily: fonts.displayLight,
      fontSize: 28,
      color: colors.ink,
      paddingVertical: 4,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    dateButtonText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.ink,
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
    proofGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    proofButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    proofButtonText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    proofModeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    proofMode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    proofModeText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone600,
    },
    proofTextArea: {
      minHeight: 76,
      textAlignVertical: 'top',
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    proofInline: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    proofInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.body,
      fontSize: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    proofAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 92,
      borderRadius: 999,
      backgroundColor: colors.ink,
      paddingHorizontal: 12,
    },
    proofAddText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.paper,
    },
    proofList: {
      gap: 8,
      marginTop: 10,
    },
    proofItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      padding: 9,
      borderRadius: 13,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    proofThumb: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: colors.chip,
    },
    proofIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chip,
    },
    proofSummary: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone600,
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
  });
