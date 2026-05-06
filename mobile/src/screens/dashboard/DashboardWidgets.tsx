import React, { useMemo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { CheckCircle2, Pencil, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type {
  BudgetProgress,
  CustomCategory,
  Goal,
  GoalProgress,
  LedgerAccount,
} from '../../types';
import { colorFor } from '../../theme';
import { createDashboardStyles } from './dashboardStyles';

export function ArchivedLedgersSheet({
  visible,
  ledgers,
  onClose,
  onPick,
}: {
  visible: boolean;
  ledgers: LedgerAccount[];
  onClose: () => void;
  onPick: (ledger: LedgerAccount) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Archived accounts</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          {ledgers.length === 0 ? (
            <Text style={styles.archivedEmpty}>No archived accounts.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {ledgers.map((ledger) => (
                <Pressable
                  key={ledger.id}
                  onPress={() => onPick(ledger)}
                  style={styles.archivedRow}
                >
                  <View
                    style={[
                      styles.ledgerChipDot,
                      { backgroundColor: ledger.color || colors.rust },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archivedRowName}>{ledger.name}</Text>
                    <Text style={styles.archivedRowMeta}>
                      {ledger.currencyCode}
                      {ledger.description ? ` - ${ledger.description}` : ''}
                    </Text>
                  </View>
                  <Pencil size={14} color={colors.stone500} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function BudgetProgressCard({
  progress,
  ledgers,
  onPress,
  formatMoney,
  customCategories,
}: {
  progress: BudgetProgress;
  ledgers: LedgerAccount[];
  onPress: () => void;
  formatMoney: (n: number) => string;
  customCategories: CustomCategory[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const { budget, spent, cap, percent, status, missingCurrencyCodes, carryOverAmount } = progress;
  const ledger = budget.ledgerId
    ? ledgers.find((item) => item.id === budget.ledgerId)
    : null;
  const accent =
    status === 'over' ? colors.clay : status === 'warning' ? colors.rust : colors.moss;
  const fillWidth = `${Math.min(100, Math.max(percent * 100, 0))}%` as `${number}%`;
  const remaining = cap - spent;

  return (
    <Pressable onPress={onPress} style={styles.budgetCard}>
      <View style={styles.budgetCardHead}>
        <View style={styles.budgetCardTitleGroup}>
          <View
            style={[
              styles.budgetCategoryDot,
              { backgroundColor: colorFor(budget.category, customCategories) },
            ]}
          />
          <Text style={styles.budgetCardTitle}>{budget.category}</Text>
          {ledger ? (
            <View style={[styles.budgetLedgerPill, { borderColor: ledger.color || colors.borderSoft }]}>
              <Text style={styles.budgetLedgerPillLabel}>{ledger.name}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.budgetStatusLabel, { color: accent }]}>
          {status === 'over' ? 'Over' : `${Math.round(percent * 100)}%`}
        </Text>
      </View>

      <View style={styles.budgetBarTrack}>
        <View style={[styles.budgetBarFill, { width: fillWidth, backgroundColor: accent }]} />
      </View>

      <View style={styles.budgetMetaRow}>
        <Text style={styles.budgetMetaPrimary}>
          {formatMoney(spent)} of {formatMoney(cap)}
        </Text>
        <Text
          style={[
            styles.budgetMetaSecondary,
            { color: remaining < 0 ? colors.clay : colors.stone500 },
          ]}
        >
          {remaining < 0
            ? `Over by ${formatMoney(Math.abs(remaining))}`
            : `${formatMoney(Math.max(remaining, 0))} left`}
        </Text>
      </View>

      {budget.carryOver && Math.abs(carryOverAmount) > 0.005 ? (
        <Text
          style={[
            styles.budgetWarning,
            { color: carryOverAmount < 0 ? colors.clay : colors.stone500 },
          ]}
        >
          Carry-over {carryOverAmount >= 0 ? '+' : '-'}
          {formatMoney(Math.abs(carryOverAmount))}
        </Text>
      ) : null}

      {missingCurrencyCodes.length > 0 ? (
        <Text style={styles.budgetWarning}>
          Estimate: missing rates for {missingCurrencyCodes.join(', ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatGoalMoney(value: number, symbol: string) {
  return `${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function goalPacingLabel(progress: GoalProgress) {
  if (progress.pacing === 'complete') return 'Ready';
  if (progress.pacing === 'paused') return 'Paused';
  if (progress.pacing === 'behind') return 'Behind';
  if (progress.pacing === 'ahead') return 'Ahead';
  if (progress.pacing === 'on-track') return 'On track';
  return 'No deadline';
}

function deadlineLabel(progress: GoalProgress) {
  if (progress.pacing === 'complete') return 'Target reached';
  if (progress.goal.status === 'paused') return 'Paused';
  if (progress.daysRemaining == null) return 'No deadline';
  if (progress.daysRemaining < 0) return 'Deadline passed';
  if (progress.daysRemaining === 0) return 'Due today';
  return `${progress.daysRemaining} days left`;
}

export function GoalProgressCard({
  progress,
  onPress,
  onMarkComplete,
}: {
  progress: GoalProgress;
  onPress: () => void;
  onMarkComplete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const { goal, saved, remaining, percent, pacing, suggestedMonthly } = progress;
  const completeReady = pacing === 'complete' && goal.status === 'active';
  const fillWidth = `${Math.min(100, Math.max(percent * 100, 0))}%` as `${number}%`;
  const accent =
    pacing === 'behind'
      ? colors.clay
      : pacing === 'paused'
      ? colors.stone500
      : pacing === 'complete'
      ? colors.rust
      : colors.moss;

  return (
    <Pressable onPress={onPress} style={styles.goalCard}>
      <View style={styles.goalHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.goalTitle} numberOfLines={2}>
            {goal.name}
          </Text>
          <View style={styles.goalMetaRow}>
            <View style={[styles.goalStatusPill, { borderColor: accent }]}>
              <Text style={[styles.goalStatusLabel, { color: accent }]}>
                {goalPacingLabel(progress)}
              </Text>
            </View>
            <Text style={styles.goalLedgerText} numberOfLines={1}>
              {progress.linkedLedgerName ?? 'Link an account'}
            </Text>
          </View>
        </View>
        <Text style={[styles.goalPercent, { color: accent }]}>
          {Math.round(Math.max(percent, 0) * 100)}%
        </Text>
      </View>

      <View style={styles.budgetBarTrack}>
        <View style={[styles.budgetBarFill, { width: fillWidth, backgroundColor: accent }]} />
      </View>

      <View style={styles.goalAmountRow}>
        <Text style={styles.budgetMetaPrimary}>
          {formatGoalMoney(saved, progress.currencySymbol)} of{' '}
          {formatGoalMoney(goal.targetAmount, progress.currencySymbol)}
        </Text>
        <Text
          style={[
            styles.budgetMetaSecondary,
            { color: remaining <= 0 ? colors.rust : colors.stone500 },
          ]}
        >
          {remaining <= 0
            ? 'Ready to complete'
            : `${formatGoalMoney(remaining, progress.currencySymbol)} left`}
        </Text>
      </View>

      <View style={styles.goalDetailRow}>
        <Text style={styles.goalDetailText}>{deadlineLabel(progress)}</Text>
        {suggestedMonthly > 0 ? (
          <Text style={styles.goalDetailText}>
            {formatGoalMoney(suggestedMonthly, progress.currencySymbol)} / month
          </Text>
        ) : null}
      </View>

      {progress.linkedLedgerArchived ? (
        <Text style={styles.budgetWarning}>Linked account archived.</Text>
      ) : null}
      {!goal.ledgerId ? (
        <Text style={styles.budgetWarning}>Link an account to start tracking.</Text>
      ) : null}
      {progress.currencyMismatch ? (
        <Text style={[styles.budgetWarning, { color: colors.clay }]}>
          Account currency changed. Re-edit this goal.
        </Text>
      ) : null}

      {completeReady ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onMarkComplete();
          }}
          style={styles.goalCompleteButton}
        >
          <CheckCircle2 size={14} color={colors.paper} />
          <Text style={styles.goalCompleteButtonLabel}>Mark complete</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function CompletedGoalsSheet({
  visible,
  goals,
  onClose,
  onPick,
}: {
  visible: boolean;
  goals: GoalProgress[];
  onClose: () => void;
  onPick: (goal: Goal) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Completed goals</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.stone500} />
            </Pressable>
          </View>
          {goals.length === 0 ? (
            <Text style={styles.archivedEmpty}>No completed goals yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {goals.map((progress) => (
                <Pressable
                  key={progress.goal.id}
                  onPress={() => onPick(progress.goal)}
                  style={styles.completedGoalRow}
                >
                  <CheckCircle2 size={16} color={colors.rust} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.archivedRowName}>{progress.goal.name}</Text>
                    <Text style={styles.archivedRowMeta}>
                      {formatGoalMoney(progress.saved, progress.currencySymbol)} saved
                      {progress.goal.completedAt
                        ? ` - completed ${new Date(progress.goal.completedAt).toLocaleDateString()}`
                        : ''}
                    </Text>
                  </View>
                  <Pencil size={14} color={colors.stone500} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function LedgerChip({
  label,
  active,
  color,
  onPress,
  onLongPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.ledgerChip, active && { backgroundColor: colors.ink }]}
    >
      <View
        style={[
          styles.ledgerChipDot,
          { backgroundColor: active ? colors.paper : color ?? colors.rust },
        ]}
      />
      <Text style={[styles.ledgerChipLabel, active && { color: colors.paper }]}>
        {label}
      </Text>
    </Pressable>
  );
}
