import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Clipboard,
  ExternalLink,
  Mail,
  ReceiptText,
  ShieldCheck,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { PaymentEvidence, PaymentEvidenceDraft } from '../../types';
import { fonts } from '../../theme';
import {
  evidenceConfidenceLabel,
  evidenceTypeLabel,
  formatEvidenceAmount,
  formatEvidenceDate,
  insightConfidenceLabel,
  mergePaymentEvidenceAnalysis,
  summarizeEvidence,
  type PaymentEvidenceAnalysisContext,
} from '../../utils/paymentEvidence';

interface PaymentEvidencePreviewSheetProps {
  visible: boolean;
  evidence: PaymentEvidence | PaymentEvidenceDraft | null;
  analysisContext?: PaymentEvidenceAnalysisContext;
  onClose: () => void;
  onRemove?: () => void;
}

function evidenceIcon(evidence: PaymentEvidence | PaymentEvidenceDraft | null, color: string) {
  if (!evidence) return <ReceiptText size={18} color={color} />;
  if (evidence.type === 'email_text') return <Mail size={18} color={color} />;
  if (evidence.type === 'manual_note') return <StickyNote size={18} color={color} />;
  if (evidence.type === 'bank_match') return <ShieldCheck size={18} color={color} />;
  if (evidence.type === 'photo') return <ReceiptText size={18} color={color} />;
  return <Clipboard size={18} color={color} />;
}

export function PaymentEvidencePreviewSheet({
  visible,
  evidence,
  analysisContext,
  onClose,
  onRemove,
}: PaymentEvidencePreviewSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const analyzedEvidence = useMemo(() => {
    if (!evidence || !analysisContext) return evidence;
    return mergePaymentEvidenceAnalysis(evidence, analysisContext);
  }, [analysisContext, evidence]);
  const detailRows = useMemo(() => {
    if (!analyzedEvidence) return [];
    return [
      ['Amount', formatEvidenceAmount(analyzedEvidence)],
      ['Paid date', formatEvidenceDate(analyzedEvidence.paidAt)],
      ['Reference', analyzedEvidence.reference ?? ''],
      ['Merchant', analyzedEvidence.merchant ?? ''],
      ['File', analyzedEvidence.attachmentName ?? ''],
      ['Provider ID', analyzedEvidence.providerTransactionId ?? ''],
      ['Note', analyzedEvidence.note ?? ''],
    ].filter((row) => Boolean(row[1]));
  }, [analyzedEvidence]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <View style={styles.headIcon}>
              {evidenceIcon(analyzedEvidence, colors.rust)}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>Proof preview</Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {analyzedEvidence ? summarizeEvidence(analyzedEvidence) : 'Payment proof'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>

          {analyzedEvidence ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              <View style={styles.pillRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{evidenceTypeLabel(analyzedEvidence.type)}</Text>
                </View>
                <View style={[styles.pill, { borderColor: colors.moss }]}>
                  <ShieldCheck size={12} color={colors.moss} />
                  <Text style={[styles.pillText, { color: colors.moss }]}>
                    {evidenceConfidenceLabel(analyzedEvidence)}
                  </Text>
                </View>
              </View>

              {analyzedEvidence.attachmentUri ? (
                <View style={styles.imageFrame}>
                  <Image source={{ uri: analyzedEvidence.attachmentUri }} style={styles.previewImage} />
                </View>
              ) : null}

              {analyzedEvidence.insights?.length ? (
                <View style={styles.insightPanel}>
                  <Text style={styles.insightTitle}>Insights</Text>
                  <View style={styles.insightGrid}>
                    {analyzedEvidence.insights.map((insight) => (
                      <View
                        key={insight.id}
                        style={[
                          styles.insightCard,
                          insight.confidence === 'high' && { borderColor: colors.moss },
                        ]}
                      >
                        <View style={styles.insightCardHead}>
                          <Text style={styles.insightLabel}>{insight.label}</Text>
                          <Text
                            style={[
                              styles.insightConfidence,
                              insight.confidence === 'high' && { color: colors.moss },
                            ]}
                          >
                            {insightConfidenceLabel(insight.confidence)}
                          </Text>
                        </View>
                        <Text style={styles.insightValue} numberOfLines={2}>
                          {insight.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {detailRows.length > 0 ? (
                <View style={styles.detailGrid}>
                  {detailRows.map(([label, value]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {analyzedEvidence.rawText ? (
                <View style={styles.rawBlock}>
                  <View style={styles.rawHead}>
                    <Clipboard size={14} color={colors.rust} />
                    <Text style={styles.rawTitle}>Original text</Text>
                  </View>
                  <Text style={styles.rawText}>{analyzedEvidence.rawText}</Text>
                </View>
              ) : null}

              {'createdAt' in analyzedEvidence && typeof analyzedEvidence.createdAt === 'string' ? (
                <View style={styles.auditRow}>
                  <ExternalLink size={13} color={colors.stone500} />
                  <Text style={styles.auditText}>
                    Attached {formatEvidenceDate(analyzedEvidence.createdAt)}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {onRemove ? (
            <Pressable onPress={onRemove} style={styles.removeButton}>
              <Trash2 size={15} color={colors.clay} />
              <Text style={styles.removeLabel}>Remove proof</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 24,
      paddingBottom: 32,
      gap: 18,
      maxHeight: '94%',
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
      gap: 12,
    },
    headIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    sheetTitle: {
      fontFamily: fonts.displayLight,
      fontSize: 23,
      color: colors.ink,
    },
    sheetSubtitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.stone500,
      marginTop: 2,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.paper,
    },
    pillText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone600,
    },
    imageFrame: {
      minHeight: 360,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.ink,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    previewImage: {
      width: '100%',
      height: 420,
      resizeMode: 'contain',
    },
    detailGrid: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      overflow: 'hidden',
    },
    insightPanel: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      padding: 14,
      gap: 10,
    },
    insightTitle: {
      fontFamily: fonts.displayMedium,
      fontSize: 16,
      color: colors.ink,
    },
    insightGrid: {
      gap: 8,
    },
    insightCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.cream,
      padding: 11,
      gap: 5,
    },
    insightCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    insightLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    insightConfidence: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: colors.stone500,
    },
    insightValue: {
      fontFamily: fonts.displayMedium,
      fontSize: 15,
      color: colors.ink,
      lineHeight: 20,
    },
    detailRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    detailLabel: {
      width: 86,
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.stone500,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    detailValue: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
      lineHeight: 18,
    },
    rawBlock: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.paper,
      padding: 14,
      gap: 10,
    },
    rawHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    rawTitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    rawText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.stone600,
      lineHeight: 19,
    },
    auditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    auditText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.stone500,
    },
    removeButton: {
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.clay,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 7,
      backgroundColor: colors.paper,
    },
    removeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.clay,
    },
  });
