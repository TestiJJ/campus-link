import API from '../api';
import { playMessageNotificationSound } from './notificationSound';

/**
 * Checks if the user's browser/platform supports Service Worker Push Notifications.
 */
export const isPushSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

/**
 * Returns current browser notification permission: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export const getNotificationPermissionState = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Converts a Base64-encoded VAPID Public Key string to a Uint8Array required by PushManager.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers / confirms Service Worker registration
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('CampusLink Service Worker registration note:', err);
    return null;
  }
};

/**
 * Subscribes the current device to Native Web Push Notifications
 */
export const subscribeUserToPush = async (customApi = API) => {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported on this browser/device.' };
  }

  try {
    // 1. Request user permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was not granted. Please allow notifications when prompted.' };
    }

    // 2. Ensure Service Worker is ready
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      registration = await registerServiceWorker();
    }
    if (!registration) {
      return { success: false, error: 'Service worker could not be registered. Try refreshing the page.' };
    }

    // Wait for SW to be fully active
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID Public Key from backend
    let vapidPublicKey;
    try {
      const keyRes = await customApi.get('/notifications/vapid-public-key');
      vapidPublicKey = keyRes.data?.public_key;
    } catch (keyErr) {
      return { success: false, error: 'Could not reach the server. Make sure you are connected and try again.' };
    }

    if (!vapidPublicKey) {
      return { success: false, error: 'Server did not return a push key. Please try again later.' };
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. Check existing subscription or create new
    let subscription;
    try {
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }
    } catch (subErr) {
      // If subscription failed due to key change or stale state, unsubscribe and retry once
      try {
        const oldSub = await registration.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      } catch (retryErr) {
        return { success: false, error: 'Browser blocked the subscription. Check site notification permissions in your browser settings.' };
      }
    }

    if (!subscription) {
      return { success: false, error: 'Could not create push subscription.' };
    }

    // 5. Send subscription to CampusLink backend
    const rawSub = subscription.toJSON();
    const payload = {
      endpoint: rawSub.endpoint,
      keys: {
        p256dh: rawSub.keys?.p256dh || '',
        auth: rawSub.keys?.auth || '',
      },
      user_agent: navigator.userAgent || 'Unknown Device',
    };

    await customApi.post('/notifications/subscribe', payload);

    // Store push status in localStorage
    localStorage.setItem('campuslink_push_enabled', 'true');

    return { success: true, subscription };
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    return {
      success: false,
      error: err.response?.data?.detail || err.message || 'Failed to enable push notifications.',
    };
  }
};

/**
 * Unsubscribes the current device from Push Notifications
 */
export const unsubscribeUserFromPush = async (customApi = API) => {
  if (!isPushSupported()) return { success: false, error: 'Push not supported' };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        try {
          await customApi.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
        } catch (_) {}
        await subscription.unsubscribe();
      }
    }
    localStorage.removeItem('campuslink_push_enabled');
    return { success: true };
  } catch (err) {
    console.error('Error unsubscribing from push:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Sends an instant test push notification to this device to verify lock screen delivery & sound.
 */
export const sendTestPushNotification = async (customApi = API) => {
  try {
    // Play the in-app WhatsApp chime immediately so the user hears what alerts sound like
    playMessageNotificationSound();

    const res = await customApi.post('/notifications/test-push', {
      title: '🔔 CampusLink Alert Verified!',
      body: 'Your phone is now connected for real-time messages & order alerts even when closed!',
      url: '/',
    });
    return { success: true, data: res.data };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.detail || err.message || 'Test notification failed.',
    };
  }
};
