import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { BillNotificationStatus } from '../types';

const BILL_CHANNEL_ID = 'bill-reminders';

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
  await Notifications.setNotificationChannelAsync(BILL_CHANNEL_ID, {
    name: 'Bill reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getBillNotificationPermission(): Promise<BillNotificationStatus> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissionStatus(permissions.granted);
  } catch {
    return 'error';
  }
}

export async function requestBillNotificationPermission(): Promise<BillNotificationStatus> {
  try {
    const permissions = await Notifications.requestPermissionsAsync();
    return permissionStatus(permissions.granted);
  } catch {
    return 'error';
  }
}

export async function scheduleBillReminder({
  id,
  title,
  dueDate,
  reminderDaysBefore,
}: {
  id: string;
  title: string;
  dueDate: string;
  reminderDaysBefore: number;
}) {
  const triggerDate = reminderDate(dueDate, reminderDaysBefore);
  if (triggerDate <= new Date()) return null;

  await ensureAndroidChannel();
  const body =
    reminderDaysBefore > 0
      ? `${title} is due in ${reminderDaysBefore} ${reminderDaysBefore === 1 ? 'day' : 'days'}.`
      : `${title} is due today.`;

  return Notifications.scheduleNotificationAsync({
    identifier: `bill-${id}`,
    content: {
      title: 'Bill reminder',
      body,
      data: { billOccurrenceId: id, dueDate },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: BILL_CHANNEL_ID,
    },
  });
}

export async function cancelBillReminder(notificationId?: string) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // The OS may already have delivered or removed it; status changes should still succeed.
  }
}
