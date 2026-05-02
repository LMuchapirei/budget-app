import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { BillNotificationStatus, TxType } from '../types';

const SCHEDULED_CHANNEL_ID = 'scheduled-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 9, 0, 0, 0);
}

function reminderDate(dueDate: string, reminderDaysBefore: number) {
  const trigger = parseLocalDate(dueDate);
  trigger.setDate(trigger.getDate() - Math.max(0, reminderDaysBefore));
  return trigger;
}

function permissionStatus(granted: boolean): BillNotificationStatus {
  return granted ? 'granted' : 'denied';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SCHEDULED_CHANNEL_ID, {
    name: 'Schedule reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getScheduledNotificationPermission(): Promise<BillNotificationStatus> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissionStatus(permissions.granted);
  } catch {
    return 'error';
  }
}

export async function requestScheduledNotificationPermission(): Promise<BillNotificationStatus> {
  try {
    const permissions = await Notifications.requestPermissionsAsync();
    return permissionStatus(permissions.granted);
  } catch {
    return 'error';
  }
}

export async function scheduleOccurrenceReminder({
  id,
  title,
  dueDate,
  reminderDaysBefore,
  type,
}: {
  id: string;
  title: string;
  dueDate: string;
  reminderDaysBefore: number;
  type: TxType;
}) {
  const triggerDate = reminderDate(dueDate, reminderDaysBefore);
  if (triggerDate <= new Date()) return null;

  await ensureAndroidChannel();
  const unit = reminderDaysBefore === 1 ? 'day' : 'days';
  const body =
    type === 'income'
      ? `${title} arrives in ${reminderDaysBefore} ${unit}.`
      : `${title} is due in ${reminderDaysBefore} ${unit}.`;

  return Notifications.scheduleNotificationAsync({
    identifier: `scheduled-${id}`,
    content: {
      title: 'Reminder',
      body,
      data: { scheduledOccurrenceId: id, dueDate },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: SCHEDULED_CHANNEL_ID,
    },
  });
}

export async function cancelOccurrenceReminder(notificationId?: string) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Delivered or removed notifications should not block status changes.
  }
}

export async function cancelAllOccurrenceReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Best effort cleanup.
  }
}

export const getBillNotificationPermission = getScheduledNotificationPermission;
export const requestBillNotificationPermission = requestScheduledNotificationPermission;
export const scheduleBillReminder = scheduleOccurrenceReminder;
export const cancelBillReminder = cancelOccurrenceReminder;
export const cancelAllBillReminders = cancelAllOccurrenceReminders;
