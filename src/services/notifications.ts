const SEEN_ALERTS_KEY = 'wisdom_seen_alerts_v1';
const NOTIFIED_LAUNDRY_KEY = 'wisdom_notified_laundry_v1';
const PUSH_PREF_KEY = 'wisdom_push_enabled_v1';

export type PushPermissionState = NotificationPermission | 'unsupported';

export function getNotificationPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isPushEnabledPref(): boolean {
  try {
    const val = localStorage.getItem(PUSH_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setPushEnabledPref(enabled: boolean): void {
  try {
    localStorage.setItem(PUSH_PREF_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    setPushEnabledPref(true);
  }
  return result;
}

export async function sendWebPushNotification(options: {
  title: string;
  body: string;
  tag: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted' || !isPushEnabledPref()) {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(options.title, {
          body: options.body,
          tag: options.tag,
          icon: '/pwa-192x192.png',
        });
        return true;
      }
    }
  } catch {
    // Fallback to Window Notification API below
  }

  try {
    new Notification(options.title, {
      body: options.body,
      tag: options.tag,
      icon: '/pwa-192x192.png',
    });
    return true;
  } catch {
    return false;
  }
}

export function loadSeenAlertIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ALERTS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

export function saveSeenAlertIds(ids: Set<string>): void {
  try {
    const arr = Array.from(ids).slice(-100);
    localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function loadNotifiedLaundryKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_LAUNDRY_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

export function saveNotifiedLaundryKeys(keys: Set<string>): void {
  try {
    const arr = Array.from(keys).slice(-50);
    localStorage.setItem(NOTIFIED_LAUNDRY_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}
