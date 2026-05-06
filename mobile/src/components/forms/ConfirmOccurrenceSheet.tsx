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
import { Field } from './shared/Field';
import { DatePickerSheet } from './DatePickerSheet';
import { PaymentEvidencePreviewSheet } from './PaymentEvidencePreviewSheet';
import { createConfirmOccurrenceStyles } from './confirmOccurrenceStyles';
import {
  analyzePaymentEvidenceText,
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
  const styles = useMemo(() => createConfirmOccurrenceStyles(colors), [colors]);
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
  const [previewDraftIndex, setPreviewDraftIndex] = useState<number | null>(null);

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
    setPreviewDraftIndex(null);
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
  const proofAnalysisContext = useMemo(
    () =>
      occurrence
        ? {
            expectedAmount: parsedAmount > 0 ? parsedAmount : occurrence.amount,
            expectedMerchant: occurrence.source.description,
            expectedDate: date || occurrence.effectiveDueDate,
            currencyCode: occurrence.currencyCode,
          }
        : null,
    [date, occurrence, parsedAmount],
  );
  const parsedProofPreview = useMemo(() => {
    if (!proofAnalysisContext || proofText.trim().length === 0) return null;
    return analyzePaymentEvidenceText(proofText, proofAnalysisContext);
  }, [proofAnalysisContext, proofText]);
  const previewDraft =
    previewDraftIndex == null ? null : evidenceDrafts[previewDraftIndex] ?? null;

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
      ? analyzePaymentEvidenceText(
          proofText,
          proofAnalysisContext ?? {
            currencyCode: occurrence.currencyCode,
          },
        )
      : {};
    setEvidenceDrafts([
      {
        ...parsed,
        type: proofTextType,
        rawText: proofText.trim() || undefined,
        reference: proofReference.trim() || parsed.reference,
        amount: parsed.amount ?? occurrence.amount,
        paidAt: parsed.paidAt ?? date,
        merchant: occurrence.source.description,
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
          amount: parsedAmount > 0 ? parsedAmount : occurrence.amount,
          paidAt: date,
          merchant: occurrence.source.description,
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
    if (previewDraftIndex === index) setPreviewDraftIndex(null);
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
                {parsedProofPreview ? (
                  <View style={styles.detectedPanel}>
                    <Text style={styles.detectedTitle}>Insights</Text>
                    <View style={styles.detectedChips}>
                      {(parsedProofPreview.insights ?? []).slice(0, 6).map((insight) => (
                        <Text
                          key={insight.id}
                          style={[
                            styles.detectedChip,
                            insight.confidence === 'high' && {
                              backgroundColor: colors.ink,
                              color: colors.paper,
                            },
                          ]}
                        >
                          {insight.label}: {insight.value}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
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
                      <Pressable
                        key={`${item.type}-${index}`}
                        onPress={() => setPreviewDraftIndex(index)}
                        style={styles.proofItem}
                      >
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
                      </Pressable>
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

        <PaymentEvidencePreviewSheet
          visible={Boolean(previewDraft)}
          evidence={previewDraft}
          analysisContext={proofAnalysisContext ?? undefined}
          onClose={() => setPreviewDraftIndex(null)}
          onRemove={
            previewDraftIndex == null
              ? undefined
              : () => {
                  removeDraft(previewDraftIndex);
                  setPreviewDraftIndex(null);
                }
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
