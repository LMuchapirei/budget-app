import React, { useMemo, useState } from 'react';
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
import {
  Camera,
  Clipboard,
  ImagePlus,
  Mail,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { PaymentEvidence, PaymentEvidenceDraft, PaymentEvidenceType, ScheduledOccurrence } from '../../types';
import { persistEvidenceImage } from '../../services/paymentEvidenceFiles';
import { fonts } from '../../theme';
import { Field } from './AddCategorySheet';
import { PaymentEvidencePreviewSheet } from './PaymentEvidencePreviewSheet';
import {
  analyzePaymentEvidenceText,
  evidenceConfidenceLabel,
  evidenceTypeLabel,
  formatEvidenceDate,
  mergePaymentEvidenceAnalysis,
  summarizeEvidence,
} from '../../utils/paymentEvidence';

interface PaymentEvidenceSheetProps {
  visible: boolean;
  occurrence: ScheduledOccurrence | null;
  evidence: PaymentEvidence[];
  onAdd: (evidence: PaymentEvidenceDraft) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const textTypes: { id: PaymentEvidenceType; label: string }[] = [
  { id: 'sms_text', label: 'SMS' },
  { id: 'email_text', label: 'Email' },
  { id: 'manual_note', label: 'Reference' },
];

export function PaymentEvidenceSheet({
  visible,
  occurrence,
  evidence,
  onAdd,
  onRemove,
  onClose,
}: PaymentEvidenceSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [textType, setTextType] = useState<PaymentEvidenceType>('sms_text');
  const [rawText, setRawText] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [previewing, setPreviewing] = useState<PaymentEvidence | null>(null);

  const canAddText =
    Boolean(occurrence) &&
    (rawText.trim().length > 0 || reference.trim().length > 0 || note.trim().length > 0);
  const parsedPreview = useMemo(() => {
    if (!occurrence || textType === 'manual_note' || rawText.trim().length === 0) return null;
    return analyzePaymentEvidenceText(rawText, {
      expectedAmount: occurrence.amount,
      expectedMerchant: occurrence.source.description,
      expectedDate: occurrence.effectiveDueDate,
      currencyCode: occurrence.currencyCode,
    });
  }, [occurrence, rawText, textType]);
  const analysisContext = useMemo(
    () =>
      occurrence
        ? {
            expectedAmount: occurrence.amount,
            expectedMerchant: occurrence.source.description,
            expectedDate: occurrence.effectiveDueDate,
            currencyCode: occurrence.currencyCode,
          }
        : null,
    [occurrence],
  );
  const displayEvidence = useMemo(
    () =>
      analysisContext
        ? evidence.map((item) => mergePaymentEvidenceAnalysis(item, analysisContext))
        : evidence,
    [analysisContext, evidence],
  );

  const resetText = () => {
    setRawText('');
    setReference('');
    setNote('');
  };

  const addTextEvidence = () => {
    if (!occurrence || !canAddText) return;
    Keyboard.dismiss();
    const parsed =
      textType === 'manual_note'
        ? {}
        : analyzePaymentEvidenceText(rawText, {
            expectedAmount: occurrence.amount,
            expectedMerchant: occurrence.source.description,
            expectedDate: occurrence.effectiveDueDate,
            currencyCode: occurrence.currencyCode,
          });
      onAdd({
        ...parsed,
        type: textType,
        rawText: rawText.trim() || undefined,
        reference: reference.trim() || parsed.reference,
        note: note.trim() || undefined,
        amount: parsed.amount ?? occurrence.amount,
        paidAt: parsed.paidAt ?? occurrence.effectiveDueDate,
        merchant: occurrence.source.description,
        currencyCode: parsed.currencyCode ?? occurrence.currencyCode,
        confidence: parsed.confidence ?? 'manual',
      });
    resetText();
  };

  const addImageEvidence = async (source: 'camera' | 'library') => {
    if (!occurrence || savingImage) return;
    try {
      setSavingImage(true);
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
      onAdd({
        type: 'photo',
        amount: occurrence.amount,
        paidAt: occurrence.effectiveDueDate,
        merchant: occurrence.source.description,
        attachmentUri: storedUri,
        attachmentName: result.assets[0].fileName ?? 'Payment proof',
        note: occurrence.source.description,
        currencyCode: occurrence.currencyCode,
        confidence: 'manual',
      });
    } catch {
      Alert.alert('Proof not saved', 'The selected image could not be attached.');
    } finally {
      setSavingImage(false);
    }
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>Payment proof</Text>
              {occurrence ? (
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {occurrence.source.description}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
            <View style={styles.quickGrid}>
              <Pressable
                onPress={() => addImageEvidence('camera')}
                disabled={savingImage}
                style={styles.quickButton}
              >
                {savingImage ? (
                  <ActivityIndicator size="small" color={colors.rust} />
                ) : (
                  <Camera size={18} color={colors.rust} />
                )}
                <Text style={styles.quickLabel}>Take photo</Text>
              </Pressable>
              <Pressable
                onPress={() => addImageEvidence('library')}
                disabled={savingImage}
                style={styles.quickButton}
              >
                <ImagePlus size={18} color={colors.rust} />
                <Text style={styles.quickLabel}>Pick image</Text>
              </Pressable>
            </View>

            <Field label="Paste bank alert or add reference">
              <View style={styles.segmentRow}>
                {textTypes.map((item) => {
                  const active = textType === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setTextType(item.id)}
                      style={[styles.segment, active && { backgroundColor: colors.ink }]}
                    >
                      {item.id === 'email_text' ? (
                        <Mail size={13} color={active ? colors.paper : colors.stone600} />
                      ) : item.id === 'manual_note' ? (
                        <StickyNote size={13} color={active ? colors.paper : colors.stone600} />
                      ) : (
                        <Clipboard size={13} color={active ? colors.paper : colors.stone600} />
                      )}
                      <Text style={[styles.segmentLabel, active && { color: colors.paper }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={rawText}
                onChangeText={setRawText}
                placeholder="Paste the SMS/email text here"
                placeholderTextColor={colors.stone400}
                multiline
                style={styles.textArea}
                />
                {parsedPreview ? (
                  <View style={styles.detectedPanel}>
                    <Text style={styles.detectedTitle}>Insights</Text>
                    <View style={styles.detectedChips}>
                      {(parsedPreview.insights ?? []).slice(0, 6).map((insight) => (
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
              <View style={styles.inlineFields}>
                <TextInput
                  value={reference}
                  onChangeText={setReference}
                  placeholder="Reference"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Note"
                  placeholderTextColor={colors.stone400}
                  style={styles.input}
                />
              </View>
            </Field>

            <Pressable
              onPress={addTextEvidence}
              disabled={!canAddText}
              style={[styles.addButton, !canAddText && { opacity: 0.45 }]}
            >
              <Text style={styles.addButtonLabel}>Attach proof</Text>
            </Pressable>

            <View style={{ gap: 10 }}>
              <View style={styles.listHead}>
                <Text style={styles.listTitle}>Attached</Text>
                <Text style={styles.listCount}>{displayEvidence.length}</Text>
              </View>

              {displayEvidence.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No proof attached yet</Text>
                  <Text style={styles.emptyText}>
                    Add a receipt photo, pasted alert, or reference number.
                  </Text>
                </View>
              ) : (
                displayEvidence.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setPreviewing(item)}
                    style={styles.evidenceRow}
                  >
                    {item.attachmentUri ? (
                      <Image source={{ uri: item.attachmentUri }} style={styles.thumbnail} />
                    ) : (
                      <View style={styles.evidenceIcon}>
                        {item.type === 'email_text' ? (
                          <Mail size={16} color={colors.rust} />
                        ) : item.type === 'manual_note' ? (
                          <StickyNote size={16} color={colors.rust} />
                        ) : (
                          <Clipboard size={16} color={colors.rust} />
                        )}
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.evidenceTitle} numberOfLines={1}>
                        {evidenceTypeLabel(item.type)} / {evidenceConfidenceLabel(item)}
                      </Text>
                      <Text style={styles.evidenceMeta} numberOfLines={2}>
                        {summarizeEvidence(item)}
                      </Text>
                      <Text style={styles.evidenceDate}>{formatEvidenceDate(item.createdAt)}</Text>
                    </View>
                    <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
                      <Trash2 size={16} color={colors.clay} />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        </View>

        <PaymentEvidencePreviewSheet
          visible={Boolean(previewing)}
          evidence={previewing}
          analysisContext={analysisContext ?? undefined}
          onClose={() => setPreviewing(null)}
          onRemove={
            previewing
              ? () => {
                  onRemove(previewing.id);
                  setPreviewing(null);
                }
              : undefined
          }
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
      gap: 12,
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 24,
      color: colors.ink,
    },
    sheetSubtitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 3,
    },
    quickGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    quickButton: {
      flex: 1,
      minHeight: 76,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    quickLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    segmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    segmentLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone600,
    },
    textArea: {
      minHeight: 94,
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
    inlineFields: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    detectedPanel: {
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      padding: 10,
      gap: 8,
    },
    detectedTitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    detectedChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    detectedChip: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.rust,
      backgroundColor: colors.chip,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    input: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.body,
      fontSize: 14,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
      color: colors.ink,
    },
    addButton: {
      backgroundColor: colors.ink,
      paddingVertical: 13,
      borderRadius: 999,
      alignItems: 'center',
    },
    addButtonLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.paper,
    },
    listHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 17,
      color: colors.ink,
    },
    listCount: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.stone500,
    },
    emptyState: {
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
    },
    emptyTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 15,
      color: colors.ink,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 3,
      lineHeight: 17,
    },
    evidenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
    },
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.chip,
    },
    evidenceIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chip,
    },
    evidenceTitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    evidenceMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
      lineHeight: 16,
    },
    evidenceDate: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.stone400,
      marginTop: 3,
    },
  });
