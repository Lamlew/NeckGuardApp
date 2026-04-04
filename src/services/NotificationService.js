import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getRandomMessage } from '../constants/posture';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.warn('Notifications only work on a real device.');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('posture-alerts', {
      name: 'Posture Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6c63ff',
      sound: null,
    });

    await Notifications.setNotificationChannelAsync('critical-alerts', {
      name: 'Critical Posture Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#f44336',
      sound: null,
    });
  }

  return true;
}

// Send an immediate posture notification + haptic buzz
export async function sendPostureAlert(zone) {
  const message = getRandomMessage(zone);

  // Haptic feedback intensity based on severity
  try {
    if (zone.key === 'CRITICAL') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Double buzz for critical
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 400);
    } else if (zone.key === 'MODERATE') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch (e) {
    // Haptics may not be available on all devices
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${zone.emoji} NeckGuard`,
      body: message,
      data: { zone: zone.key },
      ...(Platform.OS === 'android' && {
        channelId: zone.key === 'CRITICAL' ? 'critical-alerts' : 'posture-alerts',
      }),
    },
    trigger: null, // Fire immediately
  });
}

// Cancel all scheduled posture notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Add a listener for when user taps a notification
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}
