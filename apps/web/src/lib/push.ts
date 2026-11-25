// Web Push in the browser: one service worker (/sw.js), subscribed only when the server has a VAPID key and the
// user switched browser notifications on. Without a key the tab-only Notification fallback stays (realtime.tsx).
import { api, ApiFailure } from './api.ts';

const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof PushManager !== 'undefined';

/** Called once from the web entry. */
export function registerServiceWorker(): void {
  if (!supported()) return;
  void navigator.serviceWorker.register('/sw.js').catch(() => { /* push stays off */ });
}

/** iPhone/iPad Safari only delivers Web Push to a site added to the home screen. */
export function iosNeedsInstall(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

let active = false;
/** True while this browser holds a server-side push subscription (the tab then skips its own Notification). */
export const pushActive = () => active;

let key: Promise<string | null> | undefined;
const publicKey = () => (key ??= api<{ publicKey: string }>('/push/key').then((r) => r.publicKey, (e) => {
  if (!(e instanceof ApiFailure && e.status === 404)) key = undefined; // retry later after a network error
  return null;
}));

const b64ToBytes = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/**
 * Subscribe (on) or unsubscribe (off) this browser. Returns whether push is now active. Needs notification
 * permission already granted; never prompts by itself. Errors leave push off and the tab fallback in place.
 */
export async function syncPush(on: boolean): Promise<boolean> {
  if (!supported()) return (active = false);
  try {
    // `ready` never settles when registration failed: give up after a few seconds.
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, no) => setTimeout(() => no(new Error('no service worker')), 5000))]);
    const current = await reg.pushManager.getSubscription();
    if (!on) {
      if (current) {
        await api('/me/push/subscriptions', { method: 'DELETE', body: { endpoint: current.endpoint } }).catch(() => undefined);
        await current.unsubscribe();
      }
      return (active = false);
    }
    if (Notification.permission !== 'granted') return (active = false);
    const k = await publicKey();
    if (!k) return (active = false);
    const sub = current ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k) });
    const json = sub.toJSON();
    await api('/me/push/subscriptions', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
    return (active = true);
  } catch {
    return (active = false);
  }
}

/** Toast text when switching browser notifications on did not work. */
export const notifyFailFa = (): string => (iosNeedsInstall()
  ? 'در آیفون اول سایت را از «اشتراک‌گذاری» با «افزودن به صفحهٔ اصلی» نصب کنید و از همان آیکون باز کنید؛ بعد اعلان را روشن کنید.'
  : 'مرورگر اجازه اعلان نداد یا پشتیبانی نمی‌کند.');
