import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  BillNotificationStatus,
  BillNotificationSyncResult,
  ConfirmOccurrenceOverride,
  LedgerAccount,
  PaymentEvidence,
  PaymentEvidenceDraft,
  ReportingCurrency,
  ScheduledOccurrence,
  ScheduledOccurrenceRecord,
  ScheduledOccurrenceStatus,
  Transaction,
} from '../../types';
import {
  cancelOccurrenceReminder,
  getScheduledNotificationPermission,
  requestScheduledNotificationPermission as requestDeviceScheduledNotificationPermission,
  scheduleOccurrenceReminder,
} from '../../services/scheduledNotifications';
import { deleteEvidenceFile } from '../../services/paymentEvidenceFiles';
import { normalizeCurrencyCode } from '../../utils/currency';
import {
  deriveScheduledOccurrences,
  formatISODate,
  normalizeRecurringSchedule,
} from '../../utils/recurring';
import { paymentEvidenceId } from '../../utils/paymentEvidence';
import {
  DEFAULT_LEDGER_ID,
  parseScheduledOccurrenceId,
} from './budgetUtils';

interface UseScheduledOccurrencesOptions {
  ledgers: LedgerAccount[];
  loading: boolean;
  paymentEvidence: PaymentEvidence[];
  persistPaymentEvidence: (next: PaymentEvidence[]) => void;
  persistScheduledOccurrenceRecords: (next: ScheduledOccurrenceRecord[]) => void;
  persistTransactions: (next: Transaction[]) => void;
  reportingCurrency: ReportingCurrency;
  scheduledNotificationStatus: BillNotificationStatus;
  scheduledOccurrenceRecords: ScheduledOccurrenceRecord[];
  setScheduledNotificationStatus: (status: BillNotificationStatus) => void;
  transactions: Transaction[];
}

export function useScheduledOccurrences({
  ledgers,
  loading,
  paymentEvidence,
  persistPaymentEvidence,
  persistScheduledOccurrenceRecords,
  persistTransactions,
  reportingCurrency,
  scheduledNotificationStatus,
  scheduledOccurrenceRecords,
  setScheduledNotificationStatus,
  transactions,
}: UseScheduledOccurrencesOptions) {
  const derivedSchedule = useMemo(
    () => deriveScheduledOccurrences(transactions, scheduledOccurrenceRecords),
    [scheduledOccurrenceRecords, transactions],
  );

  const scheduledOccurrences = useMemo<ScheduledOccurrence[]>(() => {
    return derivedSchedule.occurrences.map((occurrence) => {
      const ledger = ledgers.find((item) => item.id === (occurrence.source.ledgerId ?? DEFAULT_LEDGER_ID));
      return {
        ...occurrence,
        ledgerName: ledger?.name,
        ledgerArchived: Boolean(ledger?.archived),
        currencyCode: normalizeCurrencyCode(ledger?.currencyCode ?? reportingCurrency.code),
        currencySymbol: ledger?.currencySymbol ?? reportingCurrency.symbol,
      };
    });
  }, [derivedSchedule.occurrences, ledgers, reportingCurrency]);

  useEffect(() => {
    if (loading) return;
    if (
      derivedSchedule.autoConfirmTransactions.length > 0 &&
      derivedSchedule.autoConfirmTransactions.some(
        (next) => !transactions.some((transaction) => transaction.id === next.id),
      )
    ) {
      const existingIds = new Set(transactions.map((transaction) => transaction.id));
      const additions = derivedSchedule.autoConfirmTransactions.filter(
        (transaction) => !existingIds.has(transaction.id),
      );
      if (additions.length > 0) {
        persistTransactions([...additions, ...transactions]);
      }
    }

    if (derivedSchedule.recordsToPersist.length !== scheduledOccurrenceRecords.length) {
      persistScheduledOccurrenceRecords(derivedSchedule.recordsToPersist);
    }
  }, [
    derivedSchedule.autoConfirmTransactions,
    derivedSchedule.recordsToPersist,
    loading,
    persistScheduledOccurrenceRecords,
    persistTransactions,
    scheduledOccurrenceRecords.length,
    transactions,
  ]);

  const cleanupScheduledRecordsForSource = useCallback(
    (sourceTransactionId: string, mode: 'all' | 'pending' = 'all') => {
      const matching = scheduledOccurrenceRecords.filter(
        (record) => record.sourceTransactionId === sourceTransactionId,
      );
      if (matching.length === 0) return;
      matching.forEach((record) => {
        if (record.notificationId) {
          cancelOccurrenceReminder(record.notificationId).catch(console.error);
        }
      });
      if (mode === 'all') {
        const occurrenceIds = new Set(matching.map((record) => record.id));
        paymentEvidence
          .filter((evidence) => occurrenceIds.has(evidence.occurrenceId))
          .forEach((evidence) => deleteEvidenceFile(evidence.attachmentUri).catch(console.error));
        persistPaymentEvidence(
          paymentEvidence.filter((evidence) => !occurrenceIds.has(evidence.occurrenceId)),
        );
      }
      persistScheduledOccurrenceRecords(
        scheduledOccurrenceRecords.filter(
          (record) =>
            record.sourceTransactionId !== sourceTransactionId ||
            (mode === 'pending' && record.status !== 'pending'),
        ),
      );
    },
    [
      paymentEvidence,
      persistPaymentEvidence,
      persistScheduledOccurrenceRecords,
      scheduledOccurrenceRecords,
    ],
  );

  const upsertScheduledRecord = useCallback(
    (record: ScheduledOccurrenceRecord) => {
      const rest = scheduledOccurrenceRecords.filter((item) => item.id !== record.id);
      persistScheduledOccurrenceRecords([record, ...rest]);
    },
    [persistScheduledOccurrenceRecords, scheduledOccurrenceRecords],
  );

  const evidenceForOccurrence = useCallback(
    (occurrenceId: string) =>
      paymentEvidence
        .filter((evidence) => evidence.occurrenceId === occurrenceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [paymentEvidence],
  );

  const addPaymentEvidence = useCallback(
    (occurrenceId: string, evidence: PaymentEvidenceDraft) => {
      const next: PaymentEvidence = {
        ...evidence,
        id: paymentEvidenceId(),
        occurrenceId,
        createdAt: new Date().toISOString(),
        confidence: evidence.confidence ?? 'manual',
      };
      persistPaymentEvidence([next, ...paymentEvidence]);
    },
    [paymentEvidence, persistPaymentEvidence],
  );

  const removePaymentEvidence = useCallback(
    (id: string) => {
      const existing = paymentEvidence.find((evidence) => evidence.id === id);
      if (existing?.attachmentUri) {
        deleteEvidenceFile(existing.attachmentUri).catch(console.error);
      }
      persistPaymentEvidence(paymentEvidence.filter((evidence) => evidence.id !== id));
    },
    [paymentEvidence, persistPaymentEvidence],
  );

  const confirmOccurrence = useCallback(
    (id: string, override?: ConfirmOccurrenceOverride) => {
      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const source =
        occurrence?.source ?? transactions.find((transaction) => transaction.id === parsed.sourceTransactionId);
      if (!source) return;

      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.status === 'confirmed') return;
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }

      const effectiveDueDate =
        override?.date ?? occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate;
      const originalDueDate = occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate;
      const nowStamp = Date.now();
      const markedAt = new Date().toISOString();
      const confirmedTransaction: Transaction = {
        ...source,
        id: `${source.id}-${effectiveDueDate}-${nowStamp}`,
        amount: override?.amount ?? source.amount,
        category: override?.category ?? source.category,
        ledgerId: override?.ledgerId ?? source.ledgerId,
        date: effectiveDueDate,
        recurring: false,
        recurringSchedule: undefined,
        generatedFromRecurringId: source.id,
        generatedOccurrenceDate: effectiveDueDate,
      };

      persistTransactions([confirmedTransaction, ...transactions]);
      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId: source.id,
        originalDueDate,
        effectiveDueDate,
        status: 'confirmed',
        confirmedTransactionId: confirmedTransaction.id,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt,
      });

      if (override?.evidence?.length) {
        const additions = override.evidence.map<PaymentEvidence>((draft) => ({
          ...draft,
          id: paymentEvidenceId(),
          occurrenceId: id,
          confirmedTransactionId: confirmedTransaction.id,
          createdAt: markedAt,
          confidence: draft.confidence ?? 'manual',
        }));
        persistPaymentEvidence([...additions, ...paymentEvidence]);
      }
    },
    [
      paymentEvidence,
      persistPaymentEvidence,
      persistTransactions,
      scheduledOccurrenceRecords,
      scheduledOccurrences,
      transactions,
      upsertScheduledRecord,
    ],
  );

  const setOccurrenceStatus = useCallback(
    (id: string, status: ScheduledOccurrenceStatus) => {
      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }
      const sourceTransactionId =
        occurrence?.source.id ?? existing?.sourceTransactionId ?? parsed.sourceTransactionId;
      const originalDueDate = occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate;
      const effectiveDueDate = occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate;
      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId,
        originalDueDate,
        effectiveDueDate,
        status,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt: new Date().toISOString(),
      });
    },
    [scheduledOccurrenceRecords, scheduledOccurrences, upsertScheduledRecord],
  );

  const skipOccurrence = useCallback(
    (id: string) => setOccurrenceStatus(id, 'skipped'),
    [setOccurrenceStatus],
  );

  const postponeOccurrence = useCallback(
    (id: string, newDate: string) => {
      const todayIso = formatISODate(new Date());
      if (newDate < todayIso) return;

      const occurrence = scheduledOccurrences.find((item) => item.id === id);
      const parsed = parseScheduledOccurrenceId(id);
      const source =
        occurrence?.source ?? transactions.find((transaction) => transaction.id === parsed.sourceTransactionId);
      const schedule = source ? normalizeRecurringSchedule(source) : undefined;
      if (!source || (schedule?.endDate && newDate > schedule.endDate)) return;

      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }

      upsertScheduledRecord({
        ...existing,
        id,
        sourceTransactionId: source.id,
        originalDueDate: occurrence?.originalDueDate ?? existing?.originalDueDate ?? parsed.dueDate,
        effectiveDueDate: newDate,
        status: 'postponed',
        postponedFrom: occurrence?.effectiveDueDate ?? existing?.effectiveDueDate ?? parsed.dueDate,
        notificationId: undefined,
        notificationScheduledAt: undefined,
        markedAt: new Date().toISOString(),
      });
    },
    [scheduledOccurrenceRecords, scheduledOccurrences, transactions, upsertScheduledRecord],
  );

  const clearOccurrenceStatus = useCallback(
    (id: string) => {
      const existing = scheduledOccurrenceRecords.find((record) => record.id === id);
      if (existing?.notificationId) {
        cancelOccurrenceReminder(existing.notificationId).catch(console.error);
      }
      persistScheduledOccurrenceRecords(scheduledOccurrenceRecords.filter((record) => record.id !== id));
    },
    [persistScheduledOccurrenceRecords, scheduledOccurrenceRecords],
  );

  const pauseSchedule = useCallback(
    (transactionId: string) => {
      const nowIso = new Date().toISOString();
      const source = transactions.find((transaction) => transaction.id === transactionId);
      if (!source?.recurringSchedule) return;
      scheduledOccurrenceRecords
        .filter((record) => record.sourceTransactionId === transactionId && record.notificationId)
        .forEach((record) => cancelOccurrenceReminder(record.notificationId).catch(console.error));

      persistTransactions(
        transactions.map((transaction) =>
          transaction.id === transactionId
            ? {
                ...transaction,
                recurringSchedule: {
                  ...transaction.recurringSchedule!,
                  paused: true,
                  pausedAt: nowIso,
                },
              }
            : transaction,
        ),
      );
    },
    [persistTransactions, scheduledOccurrenceRecords, transactions],
  );

  const resumeSchedule = useCallback(
    (transactionId: string) => {
      const todayIso = formatISODate(new Date());
      persistTransactions(
        transactions.map((transaction) =>
          transaction.id === transactionId && transaction.recurringSchedule
            ? {
                ...transaction,
                recurringSchedule: {
                  ...transaction.recurringSchedule,
                  paused: false,
                  pausedAt: undefined,
                  startDate: todayIso,
                },
              }
            : transaction,
        ),
      );
    },
    [persistTransactions, transactions],
  );

  const refreshScheduledNotificationPermission = useCallback(async () => {
    const nextStatus = await getScheduledNotificationPermission();
    setScheduledNotificationStatus(nextStatus);
    return nextStatus;
  }, [setScheduledNotificationStatus]);

  const syncScheduledNotifications = useCallback(async (): Promise<BillNotificationSyncResult> => {
    const permission = await getScheduledNotificationPermission();
    setScheduledNotificationStatus(permission);
    if (permission !== 'granted') return { scheduled: 0, skipped: scheduledOccurrences.length };

    const recordMap = new Map(scheduledOccurrenceRecords.map((record) => [record.id, record]));
    const nextRecordMap = new Map(recordMap);
    let scheduled = 0;
    let skipped = 0;

    for (const occurrence of scheduledOccurrences) {
      const schedule = normalizeRecurringSchedule(occurrence.source);
      const closed =
        occurrence.recordStatus === 'confirmed' ||
        occurrence.recordStatus === 'skipped' ||
        occurrence.status === 'confirmed' ||
        occurrence.status === 'skipped';
      if (closed || schedule?.paused || occurrence.reminderDaysBefore <= 0) {
        skipped += 1;
        continue;
      }

      const existing = recordMap.get(occurrence.id);
      if (existing?.notificationId) {
        await cancelOccurrenceReminder(existing.notificationId);
      }

      const notificationId = await scheduleOccurrenceReminder({
        id: occurrence.id,
        title: occurrence.source.description,
        dueDate: occurrence.effectiveDueDate,
        reminderDaysBefore: occurrence.reminderDaysBefore,
        type: occurrence.type,
      });

      if (!notificationId) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      nextRecordMap.set(occurrence.id, {
        ...existing,
        id: occurrence.id,
        sourceTransactionId: occurrence.source.id,
        originalDueDate: occurrence.originalDueDate,
        effectiveDueDate: occurrence.effectiveDueDate,
        status: occurrence.recordStatus ?? 'pending',
        notificationId,
        notificationScheduledAt: new Date().toISOString(),
      });
    }

    persistScheduledOccurrenceRecords(Array.from(nextRecordMap.values()));
    return { scheduled, skipped };
  }, [
    persistScheduledOccurrenceRecords,
    scheduledOccurrenceRecords,
    scheduledOccurrences,
    setScheduledNotificationStatus,
  ]);

  const requestScheduledNotificationPermission = useCallback(async () => {
    const nextStatus = await requestDeviceScheduledNotificationPermission();
    setScheduledNotificationStatus(nextStatus);
    if (nextStatus === 'granted') {
      await syncScheduledNotifications();
    }
    return nextStatus;
  }, [setScheduledNotificationStatus, syncScheduledNotifications]);

  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (autoSyncedRef.current) return;
    if (scheduledNotificationStatus !== 'granted') return;
    if (scheduledOccurrences.length === 0) return;
    autoSyncedRef.current = true;
    syncScheduledNotifications().catch(console.error);
  }, [loading, scheduledNotificationStatus, scheduledOccurrences, syncScheduledNotifications]);

  return {
    cleanupScheduledRecordsForSource,
    scheduledOccurrences,
    evidenceForOccurrence,
    addPaymentEvidence,
    removePaymentEvidence,
    confirmOccurrence,
    skipOccurrence,
    postponeOccurrence,
    clearOccurrenceStatus,
    pauseSchedule,
    resumeSchedule,
    refreshScheduledNotificationPermission,
    requestScheduledNotificationPermission,
    syncScheduledNotifications,
  };
}
