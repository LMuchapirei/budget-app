import type { PaymentEvidence, PaymentEvidenceDraft, PaymentEvidenceType } from '../types';

const AMOUNT_PATTERN =
  /(?:R|ZAR|USD|\$|GBP|£|EUR|€)?\s*([0-9]+(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{1,2})/i;
const DATE_PATTERNS = [
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/,
];
const REFERENCE_PATTERN = /\b(?:ref|reference|rrn|stan|auth|approval)\s*[:#-]?\s*([A-Z0-9-]{4,})/i;

export function paymentEvidenceId() {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export function parsePaymentEvidenceText(
  rawText: string,
  fallbackCurrencyCode: string,
): Partial<PaymentEvidenceDraft> {
  const clean = rawText.trim();
  const amountMatch = clean.match(AMOUNT_PATTERN);
  const referenceMatch = clean.match(REFERENCE_PATTERN);
  const date = parseEvidenceDate(clean);

  return {
    amount: amountMatch ? Number(amountMatch[1].replace(/[,\s]/g, '')) : undefined,
    currencyCode: currencyFromText(clean) ?? fallbackCurrencyCode,
    paidAt: date,
    reference: referenceMatch?.[1],
    confidence: amountMatch || referenceMatch || date ? 'parsed' : 'manual',
  };
}

export function summarizeEvidence(evidence: PaymentEvidence | PaymentEvidenceDraft) {
  if (evidence.providerTransactionId) return evidence.providerTransactionId;
  if (evidence.reference) return `Ref ${evidence.reference}`;
  if (evidence.merchant) return evidence.merchant;
  if (evidence.amount != null) return `${evidence.currencyCode ?? ''} ${evidence.amount}`;
  if (evidence.rawText) return evidence.rawText.replace(/\s+/g, ' ').slice(0, 48);
  if (evidence.attachmentName) return evidence.attachmentName;
  return evidence.note ?? evidenceTypeLabel(evidence.type);
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

function currencyFromText(text: string) {
  if (/\bZAR\b|R\s*\d/i.test(text)) return 'ZAR';
  if (/\bUSD\b|\$\s*\d/i.test(text)) return 'USD';
  if (/\bGBP\b|£\s*\d/i.test(text)) return 'GBP';
  if (/\bEUR\b|€\s*\d/i.test(text)) return 'EUR';
  return undefined;
}
