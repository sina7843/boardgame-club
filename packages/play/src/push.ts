// Web Push (VAPID) for in-app notifications. Runs in the worker right after notify() inserts a row. The payload is
// the same public text the notification list shows; it never carries game state. Disabled without VAPID keys.
import { eq, sql } from 'drizzle-orm';
import { setVapidDetails, sendNotification } from 'web-push';
import { alertPrefs, inQuietHours } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { toNotificationItem } from './views.ts';

const { pushSubscriptions, userSettings } = schema;

export interface PushPayload { title: string; body: string; url: string; tag: string }
export type PushSend = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string) => Promise<unknown>;

let sender: PushSend | null = null;

/** Configure delivery once at worker start. Returns false (push stays off) when any VAPID value is missing. */
export function configureWebPush(cfg: { publicKey?: string | undefined; privateKey?: string | undefined; subject?: string | undefined }): boolean {
  if (!cfg.publicKey || !cfg.privateKey || !cfg.subject) { sender = null; return false; }
  setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  sender = (sub, body) => sendNotification(sub, body, { TTL: 6 * 3600, timeout: 5000 });
  return true;
}

/** Test hook: replace the sender (null = disabled). */
export function setPushSender(s: PushSend | null): void { sender = s; }

export function buildPushPayload(n: typeof schema.notifications.$inferSelect): PushPayload {
  const item = toNotificationItem(n);
  const p = n.payload as { tableId?: string; conversationId?: string; tournamentId?: string };
  // One visible notification per table/conversation/tournament: a newer one replaces the older.
  return { title: 'بردگیم‌ورس', body: item.textFa, url: item.href, tag: `${item.kind}:${p.tableId ?? p.conversationId ?? p.tournamentId ?? n.id}` };
}

/**
 * Push one notification to every subscription of its user. Quiet hours skip the push (the in-app row stays).
 * 404/410 removes the dead subscription. Never throws: a push failure must not fail or retry the outbox event.
 */
export async function deliverPush(db: Db, n: typeof schema.notifications.$inferSelect, now = new Date()): Promise<{ sent: number; removed: number; skipped?: 'disabled' | 'quiet' }> {
  const send = sender;
  if (!send) return { sent: 0, removed: 0, skipped: 'disabled' };
  let sent = 0, removed = 0;
  try {
    const [s] = await db.select({ alerts: userSettings.alerts }).from(userSettings).where(eq(userSettings.userId, n.userId));
    const prefs = s?.alerts ? alertPrefs.safeParse(s.alerts) : null;
    if (prefs?.success && inQuietHours(prefs.data.quietHours, now)) return { sent, removed, skipped: 'quiet' };
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, n.userId));
    if (!subs.length) return { sent, removed };
    const body = JSON.stringify(buildPushPayload(n));
    for (const sub of subs) {
      try {
        await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        await db.update(pushSubscriptions).set({ lastSuccessAt: sql`now()` }).where(eq(pushSubscriptions.id, sub.id));
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          removed++;
        }
      }
    }
  } catch { /* database hiccup: the in-app notification already exists */ }
  return { sent, removed };
}
