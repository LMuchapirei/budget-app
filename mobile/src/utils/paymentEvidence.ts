import type {
  PaymentEvidence,
  PaymentEvidenceDraft,
  PaymentEvidenceInsight,
  PaymentEvidenceInsightConfidence,
  PaymentEvidenceInsightType,
  PaymentEvidenceType,
} from '../types';

export interface PaymentEvidenceAnalysisContext {
  expectedAmount?: number;
  expectedMerchant?: string;
  expectedDate?: string;
  currencyCode: string;
}

interface AmountCandidate {
  amount: number;
  currencyCode?: string;
  sourceText: string;
  before: string;
  after: string;
  index: number;
}

const DATE_PATTERNS = [
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/,
];
const REFERENCE_PATTERN = /\b(?:ref|reference|rrn|stan|auth|approval|authcode|receipt)\s*[:#-]?\s*([A-Z0-9-]{4,})/i;
const ACCOUNT_PATTERN = /\b(?:acct|account|card|wallet|a\/c|acc)\s*(?:ending|no\.?|number)?\s*[:#-]?\s*(?:x{2,}|\*{2,})?\s*([0-9]{3,6})\b/i;
const MONEY_PATTERN =
  /(?:(ZAR|USD|GBP|EUR|ZWG|ZWL)\s*)?(R|\$)?\s*([0-9]+(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{1,2})/gi;

const paidKeywords = [
  'paid',
  'payment',
  'purchase',
  'spent',
  'debit',
  'debited',
  'charged',
  'sent',
  'transfer',
  'bill',
  'subscription',
  'successful',
  'success',
];
const balanceKeywords = ['bal', 'balance', 'available', 'avail', 'remaining'];
const feeKeywords = ['fee', 'charge', 'commission'];
const negativeStatusKeywords = ['declined', 'failed', 'reversed', 'reversal', 'unsuccessful', 'cancelled'];
const pendingStatusKeywords = ['pending', 'processing'];
const successStatusKeywords = [
  'successful',
  'success',
  'paid',
  'approved',
  'completed',
  'confirmed',
  'debited',
  'credited',
];

export function paymentEvidenceId() {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function evidenceInsightId(type: PaymentEvidenceInsightType, value: string) {
  return `${type}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`;
}

export function evidenceTypeLabel(type: PaymentEvidenceType) {
  if (type === 'photo') return 'Photo';
  if (type === 'sms_text') return 'SMS alert';
  if (type === 'email_text') return 'Email';
  if (type === 'bank_match') return 'Bank match';
  return 'Note';
}

export function evidenceConfidenceLabel(evidence: PaymentEvidence | PaymentEvidenceDraft) {
  if (evidence.confidence === 'verified') return 'Verified';
  if (evidence.confidence === 'matched') return 'Matched';
  if (evidence.confidence === 'parsed') return 'Parsed';
  return 'Manual';
}

export function insightConfidenceLabel(confidence: PaymentEvidenceInsightConfidence) {
  if (confidence === 'high') return 'High';
  if (confidence === 'medium') return 'Medium';
  return 'Low';
}

export function formatEvidenceDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEvidenceAmount(evidence: PaymentEvidence | PaymentEvidenceDraft) {
  if (evidence.amount == null) return '';
  return formatAmountValue(evidence.amount, evidence.currencyCode);
}

export function formatAmountValue(amount: number, currencyCode?: string) {
  const value = Math.abs(amount);
  return `${currencyCode ?? ''} ${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

export function analyzePaymentEvidenceText(
  rawText: string,
  context: PaymentEvidenceAnalysisContext,
): Partial<PaymentEvidenceDraft> {
  const clean = rawText.trim();
  const amountCandidates = findAmountCandidates(clean, context.currencyCode);
  const paidAmount = pickAmountCandidate(amountCandidates, context.expectedAmount);
  const balanceAmount = amountCandidates.find((candidate) =>
    hasKeyword(candidate.before + candidate.after, balanceKeywords),
  );
  const feeAmount = amountCandidates.find((candidate) =>
    hasKeyword(candidate.before + candidate.after, feeKeywords),
  );
  const reference = clean.match(REFERENCE_PATTERN)?.[1];
  const accountHint = clean.match(ACCOUNT_PATTERN)?.[1];
  const paidAt = parseEvidenceDate(clean);
  const merchant = detectMerchant(clean, context.expectedMerchant, paidAmount);
  const channel = detectChannel(clean);
  const status = detectPaymentStatus(clean);
  const currencyCode = paidAmount?.currencyCode ?? currencyFromText(clean) ?? context.currencyCode;

  const insights: PaymentEvidenceInsight[] = [];
  if (paidAmount) {
    insights.push(makeInsight('paid_amount', 'Paid amount', formatAmountValue(paidAmount.amount, currencyCode), amountConfidence(paidAmount, context.expectedAmount), paidAmount.sourceText));
  }
  if (balanceAmount && balanceAmount !== paidAmount) {
    insights.push(makeInsight('balance_amount', 'Balance', formatAmountValue(balanceAmount.amount, balanceAmount.currencyCode ?? currencyCode), 'medium', balanceAmount.sourceText));
  }
  if (feeAmount && feeAmount !== paidAmount) {
    insights.push(makeInsight('fee_amount', 'Fee', formatAmountValue(feeAmount.amount, feeAmount.currencyCode ?? currencyCode), 'medium', feeAmount.sourceText));
  }
  if (merchant) {
    insights.push(makeInsight('merchant', 'Merchant', merchant, merchantConfidence(merchant, context.expectedMerchant), merchant));
  }
  if (reference) {
    insights.push(makeInsight('reference', 'Reference', reference, 'high', reference));
  }
  if (accountHint) {
    insights.push(makeInsight('account_hint', 'Account hint', `*${accountHint}`, 'medium', accountHint));
  }
  if (status) {
    insights.push(makeInsight('payment_status', 'Status', status.label, status.confidence, status.sourceText));
  }
  if (channel) {
    insights.push(makeInsight('payment_channel', 'Channel', channel.label, channel.confidence, channel.sourceText));
  }
  if (paidAt) {
    insights.push(makeInsight('paid_date', 'Paid date', formatEvidenceDate(paidAt), dateConfidence(paidAt, context.expectedDate), paidAt));
  }
  if (currencyCode) {
    insights.push(makeInsight('currency', 'Currency', currencyCode, 'medium', currencyCode));
  }

  const match = matchQuality({
    paidAmount: paidAmount?.amount,
    merchant,
    paidAt,
    status: status?.label,
    context,
  });
  insights.push(makeInsight('match_quality', 'Match', match.label, match.confidence, clean.slice(0, 80)));

  return {
    amount: paidAmount?.amount,
    currencyCode,
    paidAt,
    merchant,
    reference,
    confidence: insights.some((insight) => insight.confidence === 'high') ? 'parsed' : 'manual',
    insights: dedupeInsights(insights),
  };
}

export function parsePaymentEvidenceText(
  rawText: string,
  fallbackCurrencyCode: string,
): Partial<PaymentEvidenceDraft> {
  return analyzePaymentEvidenceText(rawText, { currencyCode: fallbackCurrencyCode });
}

export function mergePaymentEvidenceAnalysis<
  T extends PaymentEvidence | PaymentEvidenceDraft,
>(evidence: T, context: PaymentEvidenceAnalysisContext): T {
  if (!evidence.rawText || !['sms_text', 'email_text'].includes(evidence.type)) return evidence;
  const analysis = analyzePaymentEvidenceText(evidence.rawText, context);
  return {
    ...evidence,
    amount: analysis.amount ?? evidence.amount,
    currencyCode: analysis.currencyCode ?? evidence.currencyCode,
    paidAt: analysis.paidAt ?? evidence.paidAt,
    merchant: analysis.merchant ?? evidence.merchant,
    reference: evidence.reference ?? analysis.reference,
    confidence: analysis.confidence ?? evidence.confidence,
    insights: analysis.insights ?? evidence.insights,
  };
}

export function summarizeEvidence(evidence: PaymentEvidence | PaymentEvidenceDraft) {
  if (evidence.providerTransactionId) return evidence.providerTransactionId;
  if (evidence.reference) return `Ref ${evidence.reference}`;
  if (evidence.merchant) return evidence.merchant;
  const amount = formatEvidenceAmount(evidence);
  if (amount) return amount;
  if (evidence.rawText) return evidence.rawText.replace(/\s+/g, ' ').slice(0, 48);
  if (evidence.attachmentName) return evidence.attachmentName;
  return evidence.note ?? evidenceTypeLabel(evidence.type);
}

function makeInsight(
  type: PaymentEvidenceInsightType,
  label: string,
  value: string,
  confidence: PaymentEvidenceInsightConfidence,
  sourceText?: string,
): PaymentEvidenceInsight {
  return {
    id: evidenceInsightId(type, value),
    type,
    label,
    value,
    confidence,
    sourceText,
  };
}

function findAmountCandidates(text: string, fallbackCurrencyCode: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const moneyPattern = new RegExp(MONEY_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = moneyPattern.exec(text)) !== null) {
    const rawAmount = match[3];
    const sourceText = match[0].trim();
    const index = match.index ?? 0;
    const amount = Number(rawAmount.replace(/[,\s]/g, ''));
    if (!amount || Number.isNaN(amount)) continue;
    const hasCurrency = Boolean(match[1] || match[2]);
    const before = text.slice(Math.max(0, index - 42), index).toLowerCase();
    const after = text.slice(index + sourceText.length, index + sourceText.length + 42).toLowerCase();
    if (isLikelyNonMoneyNumber(text, index, sourceText, before, after, hasCurrency)) continue;
    if (!hasCurrency && !hasKeyword(before + after, [...paidKeywords, ...balanceKeywords, ...feeKeywords])) {
      continue;
    }
    candidates.push({
      amount,
      currencyCode: match[1] ?? currencyFromSymbol(match[2]) ?? fallbackCurrencyCode,
      sourceText,
      before,
      after,
      index,
    });
  }
  return candidates;
}

function isLikelyNonMoneyNumber(
  text: string,
  index: number,
  sourceText: string,
  before: string,
  after: string,
  hasCurrency: boolean,
) {
  if (hasCurrency) return false;
  const charBefore = text[index - 1] ?? '';
  const charAfter = text[index + sourceText.length] ?? '';
  const local = `${before} ${sourceText} ${after}`;
  const numeric = sourceText.replace(/[,\s]/g, '');
  if (/^0\d+$/.test(numeric)) return true;
  if (/\b(acc|acct|account|card|wallet)\s+(ending|no|number)?\s*$/i.test(before)) return true;
  if (/[.:/]/.test(charBefore) || /[.:/]/.test(charAfter)) return true;
  if (/\b(on|date|hrs|time)\b/.test(local) && /^\d{1,2}(?:\.\d{1,2})?$/.test(sourceText)) {
    return true;
  }
  if (/\bref\s*[:.]?\s*$/i.test(before)) return true;
  return false;
}

function pickAmountCandidate(candidates: AmountCandidate[], expectedAmount?: number) {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => scoreAmountCandidate(b, expectedAmount) - scoreAmountCandidate(a, expectedAmount))[0];
}

function scoreAmountCandidate(candidate: AmountCandidate, expectedAmount?: number) {
  const context = `${candidate.before} ${candidate.after}`;
  let score = 0;
  if (hasKeyword(context, paidKeywords)) score += 8;
  if (hasKeyword(context, balanceKeywords)) score -= 7;
  if (hasKeyword(context, feeKeywords)) score -= 5;
  if (expectedAmount != null && Math.abs(candidate.amount - expectedAmount) <= 0.01) score += 10;
  if (expectedAmount != null && Math.abs(candidate.amount - expectedAmount) / Math.max(expectedAmount, 1) <= 0.05) score += 5;
  if (candidate.index < 80) score += 1;
  return score;
}

function amountConfidence(candidate: AmountCandidate, expectedAmount?: number): PaymentEvidenceInsightConfidence {
  if (expectedAmount != null && Math.abs(candidate.amount - expectedAmount) <= 0.01) return 'high';
  const context = `${candidate.before} ${candidate.after}`;
  if (hasKeyword(context, paidKeywords) && !hasKeyword(context, balanceKeywords)) return 'medium';
  return 'low';
}

function detectMerchant(text: string, expectedMerchant?: string, paidAmount?: AmountCandidate) {
  const cleanExpected = expectedMerchant?.trim();
  if (cleanExpected && text.toLowerCase().includes(cleanExpected.toLowerCase())) {
    return cleanExpected;
  }
  if (paidAmount) {
    const afterAmount = text.slice(
      paidAmount.index + paidAmount.sourceText.length,
      paidAmount.index + paidAmount.sourceText.length + 80,
    );
    const afterAmountMatch = afterAmount.match(/^\s*([A-Z][A-Z0-9 &'/-]{2,40}?)(?:\s+on\b|\s+ref\b|\.|$)/);
    if (afterAmountMatch?.[1]) return toTitleCase(afterAmountMatch[1].trim());
  }
  const merchantMatch = text.match(/\b(?:to|at|from|merchant|payee)\s+([A-Z][A-Z0-9 &.'-]{2,32})/i);
  return merchantMatch?.[1]?.replace(/\s+(ref|reference|on|for|amount|r|zar|usd).*$/i, '').trim();
}

function merchantConfidence(merchant?: string, expectedMerchant?: string): PaymentEvidenceInsightConfidence {
  if (!merchant) return 'low';
  if (expectedMerchant && merchant.toLowerCase() === expectedMerchant.toLowerCase()) return 'high';
  return 'medium';
}

function detectChannel(text: string) {
  const lower = text.toLowerCase();
  if (/\becocash|m-pesa|mpesa|mobile money|wallet\b/i.test(lower)) {
    return { label: 'Mobile money', confidence: 'medium' as const, sourceText: 'wallet' };
  }
  if (/\bcard|pos|visa|mastercard|swipe\b/i.test(lower)) {
    return { label: 'Card', confidence: 'medium' as const, sourceText: 'card' };
  }
  if (/\beft|transfer|pay by bank|rtgs|ach\b/i.test(lower)) {
    return { label: 'Bank transfer', confidence: 'medium' as const, sourceText: 'transfer' };
  }
  if (/\bdebit order|debit\s+ord\b/i.test(lower)) {
    return { label: 'Debit order', confidence: 'medium' as const, sourceText: 'debit order' };
  }
  if (/\bacc|account|debited|credited\b/i.test(lower)) {
    return { label: 'Bank account', confidence: 'medium' as const, sourceText: 'account' };
  }
  return undefined;
}

function detectPaymentStatus(text: string) {
  const lower = text.toLowerCase();
  const negative = negativeStatusKeywords.find((keyword) => lower.includes(keyword));
  if (negative) return { label: 'Needs review', confidence: 'high' as const, sourceText: negative };
  const pending = pendingStatusKeywords.find((keyword) => lower.includes(keyword));
  if (pending) return { label: 'Pending', confidence: 'medium' as const, sourceText: pending };
  const success = successStatusKeywords.find((keyword) => lower.includes(keyword));
  if (success) return { label: 'Paid', confidence: 'high' as const, sourceText: success };
  return undefined;
}

function matchQuality({
  paidAmount,
  merchant,
  paidAt,
  status,
  context,
}: {
  paidAmount?: number;
  merchant?: string;
  paidAt?: string;
  status?: string;
  context: PaymentEvidenceAnalysisContext;
}) {
  let score = 0;
  if (paidAmount != null && context.expectedAmount != null) {
    const diff = Math.abs(paidAmount - context.expectedAmount);
    score += diff <= 0.01 ? 3 : diff / Math.max(context.expectedAmount, 1) <= 0.05 ? 2 : -1;
  }
  if (merchant && context.expectedMerchant && merchant.toLowerCase() === context.expectedMerchant.toLowerCase()) {
    score += 2;
  }
  if (paidAt && context.expectedDate) {
    score += Math.abs(daysBetween(paidAt, context.expectedDate)) <= 3 ? 1 : 0;
  }
  if (status === 'Needs review') score -= 3;
  if (status === 'Paid') score += 1;
  if (score >= 5) return { label: 'Strong match', confidence: 'high' as const };
  if (score >= 2) return { label: 'Likely match', confidence: 'medium' as const };
  if (score < 0) return { label: 'Review needed', confidence: 'high' as const };
  return { label: 'Partial match', confidence: 'low' as const };
}

function dateConfidence(paidAt?: string, expectedDate?: string): PaymentEvidenceInsightConfidence {
  if (paidAt && expectedDate && Math.abs(daysBetween(paidAt, expectedDate)) <= 3) return 'high';
  return paidAt ? 'medium' : 'low';
}

function parseEvidenceDate(text: string) {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const [a, b, c] = match.slice(1).map(Number);
    const year = a > 1900 ? a : c < 100 ? 2000 + c : c;
    const month = a > 1900 ? b : b;
    const day = a > 1900 ? c : a;
    if (!year || !month || !day) continue;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) continue;
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
  return undefined;
}

function daysBetween(a: string, b: string) {
  const left = new Date(`${a}T00:00:00`).getTime();
  const right = new Date(`${b}T00:00:00`).getTime();
  return Math.round((left - right) / 86400000);
}

function hasKeyword(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function currencyFromText(text: string) {
  if (/\bZAR\b|R\s*\d/i.test(text)) return 'ZAR';
  if (/\bUSD\b|\$\s*\d/i.test(text)) return 'USD';
  if (/\bGBP\b/i.test(text)) return 'GBP';
  if (/\bEUR\b/i.test(text)) return 'EUR';
  if (/\bZWG\b/i.test(text)) return 'ZWG';
  if (/\bZWL\b/i.test(text)) return 'ZWL';
  return undefined;
}

function currencyFromSymbol(symbol?: string) {
  if (symbol === 'R') return 'ZAR';
  if (symbol === '$') return 'USD';
  return undefined;
}

function dedupeInsights(insights: PaymentEvidenceInsight[]) {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    const key = `${insight.type}:${insight.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
