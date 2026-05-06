import React, { useMemo } from 'react';
import { Keyboard, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { CalendarDays, Pause, Play, Repeat } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { RecurringFrequency } from '../../types';
import { Field } from './shared/Field';
import { createTransactionFormStyles } from './transactionFormStyles';
import {
  formatDateLabel,
  RECURRING_FREQUENCIES,
  type DatePickerTarget,
} from './transactionFormUtils';

interface TransactionScheduleFieldsProps {
  recurring: boolean;
  recurringFrequency: RecurringFrequency;
  recurringInterval: string;
  recurringStartDate: string;
  recurringEndDate: string;
  reminderDaysBefore: string;
  autoPost: boolean;
  isEditing: boolean;
  hasRecurringSchedule: boolean;
  schedulePaused: boolean;
  onRecurringChange: (value: boolean) => void;
  onRecurringFrequencyChange: (value: RecurringFrequency) => void;
  onRecurringIntervalChange: (value: string) => void;
  onRecurringEndDatePickerOpen: (target: DatePickerTarget) => void;
  onReminderDaysBeforeChange: (value: string) => void;
  onAutoPostChange: (value: boolean) => void;
  onPauseResumeSchedule: () => void;
}

export function TransactionScheduleFields({
  recurring,
  recurringFrequency,
  recurringInterval,
  recurringStartDate,
  recurringEndDate,
  reminderDaysBefore,
  autoPost,
  isEditing,
  hasRecurringSchedule,
  schedulePaused,
  onRecurringChange,
  onRecurringFrequencyChange,
  onRecurringIntervalChange,
  onRecurringEndDatePickerOpen,
  onReminderDaysBeforeChange,
  onAutoPostChange,
  onPauseResumeSchedule,
}: TransactionScheduleFieldsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createTransactionFormStyles(colors), [colors]);

  return (
    <>
      <View style={styles.recurringRow}>
        <View style={styles.recurringLabelGroup}>
          <Repeat size={14} color={colors.stone500} />
          <Text style={styles.recurringRowLabel}>Recurring schedule</Text>
        </View>
        <Switch
          value={recurring}
          onValueChange={onRecurringChange}
          trackColor={{ true: colors.rust, false: colors.chip }}
          thumbColor={colors.cream}
        />
      </View>

      {recurring ? (
        <View style={styles.schedulePanel}>
          <Field label="Frequency">
            <View style={styles.chipWrap}>
              {RECURRING_FREQUENCIES.map((frequency) => {
                const active = recurringFrequency === frequency;
                return (
                  <Pressable
                    key={frequency}
                    onPress={() => onRecurringFrequencyChange(frequency)}
                    style={[styles.chip, active && { backgroundColor: colors.ink }]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: active ? colors.paper : colors.inkSoft },
                      ]}
                    >
                      {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <View style={styles.scheduleGrid}>
            <View style={styles.scheduleGridItem}>
              <Field label="Every">
                <TextInput
                  value={recurringInterval}
                  onChangeText={onRecurringIntervalChange}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={styles.input}
                />
              </Field>
            </View>
            <View style={styles.scheduleGridItem}>
              <Field label="Reminder days">
                <TextInput
                  value={reminderDaysBefore}
                  onChangeText={onReminderDaysBeforeChange}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <Field label="First due date">
            <Pressable
              onPress={() => onRecurringEndDatePickerOpen('recurringStart')}
              style={styles.dateButton}
            >
              <CalendarDays size={15} color={colors.stone500} />
              <Text style={styles.dateButtonText}>
                {formatDateLabel(recurringStartDate)}
              </Text>
            </Pressable>
          </Field>

          <Field label="Ends on (optional)">
            <Pressable
              onPress={() => onRecurringEndDatePickerOpen('recurringEnd')}
              style={styles.dateButton}
            >
              <CalendarDays size={15} color={colors.stone500} />
              <Text
                style={[
                  styles.dateButtonText,
                  !recurringEndDate && styles.dateButtonPlaceholder,
                ]}
              >
                {recurringEndDate ? formatDateLabel(recurringEndDate) : 'No end date'}
              </Text>
            </Pressable>
          </Field>

          <View style={styles.recurringRow}>
            <View style={styles.recurringLabelGroup}>
              <Repeat size={14} color={colors.stone500} />
              <View>
                <Text style={styles.recurringRowLabel}>Auto-post without confirming</Text>
                <Text style={styles.scheduleHint}>
                  {autoPost ? 'Creates entries when due.' : 'Sends due dates to Bills first.'}
                </Text>
              </View>
            </View>
            <Switch
              value={autoPost}
              onValueChange={onAutoPostChange}
              trackColor={{ true: colors.rust, false: colors.chip }}
              thumbColor={colors.cream}
            />
          </View>

          {isEditing && hasRecurringSchedule ? (
            <Pressable onPress={onPauseResumeSchedule} style={styles.pauseScheduleButton}>
              {schedulePaused ? (
                <Play size={14} color={colors.moss} />
              ) : (
                <Pause size={14} color={colors.stone600} />
              )}
              <Text
                style={[
                  styles.pauseScheduleLabel,
                  schedulePaused && { color: colors.moss },
                ]}
              >
                {schedulePaused ? 'Resume schedule' : 'Pause schedule'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
