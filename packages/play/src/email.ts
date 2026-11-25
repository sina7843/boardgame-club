// Email over SMTP (nodemailer): the verification code (API), the daily turn digest at 09:00 Tehran and the tournament
// reminder one hour before the start (worker). Disabled without SMTP env: nothing is faked. Emails carry only public
// text (game and tournament names, deadlines, links), never game state.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { createTransport } from 'nodemailer';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { tehranDate } from './progression.ts';
import { listMyTables } from './views.ts';

const { userPrivate, users, userSettings, tournaments, tournamentEntries, games } = schema;

export interface SmtpConfig { host: string; port: number; user: string | null; password: string | null; from: string }
export interface Mail { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }
export type MailSend = (m: Mail) => Promise<unknown>;
export interface EmailJobConfig { send: MailSend; secret: string; webUrl: string }

/** SMTP settings from env; null (email off) unless host and from are both set. Port defaults to 587 (STARTTLS). */
export function smtpConfig(env: { SMTP_HOST?: string | undefined; SMTP_PORT?: number | undefined; SMTP_USER?: string | undefined; SMTP_PASSWORD?: string | undefined; SMTP_FROM?: string | undefined }): SmtpConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  return { host: env.SMTP_HOST, port: env.SMTP_PORT ?? 587, user: env.SMTP_USER ?? null, password: env.SMTP_PASSWORD ?? null, from: env.SMTP_FROM };
}

/** Real sender, or null when SMTP is not configured. */
export function mailSender(cfg: SmtpConfig | null): MailSend | null {
  if (!cfg) return null;
  const t = createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465, requireTLS: cfg.port !== 465 && cfg.port !== 25,
    ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.password ?? '' } } : {}),
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000
  });
  return (m) => t.sendMail({ from: cfg.from, ...m });
}

// ---------- Unsubscribe link (HMAC, no expiry: an old email's link keeps working) ----------
const unsubSig = (secret: string, userId: string) => createHmac('sha256', secret).update(`email-unsubscribe:${userId}`).digest('base64url').slice(0, 32);
export const unsubscribeToken = (secret: string, userId: string) => `${userId}.${unsubSig(secret, userId)}`;
export function verifyUnsubscribeToken(secret: string, token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[0-9a-f-]{36}$/i.test(parts[0]!)) return null;
  const a = Buffer.from(parts[1]!), b = Buffer.from(unsubSig(secret, parts[0]!));
  return a.length === b.length && timingSafeEqual(a, b) ? parts[0]! : null;
}

// ---------- Templates (email clients need inline styles; colours are the DS light tokens) ----------
const C = { bg: '#F2EEE7', surface: '#FFFFFF', text: '#203445', muted: '#59666B', heading: '#142B3B', line: '#E4DDD1', primary: '#E8A642' };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const faDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
const FONT = 'Peyda, Vazirmatn, Tahoma, Arial, sans-serif';

function layout(title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>`
    + `<body style="margin:0;padding:24px 12px;background:${C.bg};font-family:${FONT};color:${C.text};direction:rtl;text-align:right">`
    + `<div style="max-width:560px;margin:0 auto;background:${C.surface};border:1px solid ${C.line};border-radius:20px;padding:20px">`
    + `<p style="margin:0 0 12px;font-size:13px;color:${C.muted}">بردگیم‌ورس</p>`
    + `<h1 style="margin:0 0 16px;font-size:20px;color:${C.heading}">${esc(title)}</h1>${body}</div>`
    + `<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:${C.muted}">${footer}</p></body></html>`;
}
const button = (href: string, label: string) =>
  `<p style="margin:16px 0 0"><a href="${esc(href)}" style="display:inline-block;background:${C.primary};color:${C.heading};text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">${esc(label)}</a></p>`;

export function verificationEmail(to: string, code: string): Mail {
  const title = 'کد تأیید ایمیل';
  return {
    to, subject: `${faDigits(code)}: کد تأیید ایمیل بردگیم‌ورس`,
    text: `کد تأیید ایمیل شما در بردگیم‌ورس: ${code}\nاین کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.`,
    html: layout(title, `<p style="margin:0">کد تأیید ایمیل شما:</p><p dir="ltr" style="margin:12px 0;font-size:28px;font-weight:700;letter-spacing:4px;color:${C.heading};text-align:center">${esc(code)}</p>`
      + `<p style="margin:0;color:${C.muted}">این کد تا ۱۰ دقیقه معتبر است.</p>`, 'اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.')
  };
}

/** «۵ ساعت»، «۲ روز»، «کمتر از یک ساعت». */
export function timeLeftFa(ms: number): string {
  if (ms < 3_600_000) return 'کمتر از یک ساعت';
  const hours = Math.floor(ms / 3_600_000);
  return hours < 48 ? `${faDigits(hours)} ساعت` : `${faDigits(Math.floor(hours / 24))} روز`;
}

export interface DigestItem { tableId: string; gameNameFa: string; deadline: string | null }
export function digestEmail(to: string, items: DigestItem[], links: { web: string; unsubscribe: string }, now = new Date()): Mail {
  const title = items.length === 1 ? `نوبت شما در «${items[0]!.gameNameFa}» است` : `نوبت شما در ${faDigits(items.length)} بازی است`;
  const left = (i: DigestItem) => (i.deadline ? `${timeLeftFa(new Date(i.deadline).getTime() - now.getTime())} مانده` : 'بدون مهلت');
  const rows = items.map((i) => `<li style="padding:10px 0;border-top:1px solid ${C.line}"><a href="${esc(`${links.web}/tables/${i.tableId}`)}" style="color:${C.heading};font-weight:700">${esc(i.gameNameFa)}</a>`
    + `<span style="color:${C.muted}">، ${esc(left(i))}</span></li>`).join('');
  return {
    to, subject: title,
    headers: { 'List-Unsubscribe': `<${links.unsubscribe}>` },
    text: `${title}\n\n${items.map((i) => `${i.gameNameFa}، ${left(i)}: ${links.web}/tables/${i.tableId}`).join('\n')}\n\nلغو ایمیل‌های بردگیم‌ورس: ${links.unsubscribe}`,
    html: layout(title, `<ul style="list-style:none;margin:0;padding:0">${rows}</ul>${button(`${links.web}/tables/mine`, 'میزهای من')}`,
      `این ایمیل روزانه است و فقط وقتی نوبت شماست فرستاده می‌شود. <a href="${esc(links.unsubscribe)}" style="color:${C.muted}">لغو ایمیل‌ها</a>`)
  };
}

export function tournamentReminderEmail(to: string, t: { id: string; titleFa: string; gameNameFa: string; startsAt: Date }, links: { web: string; unsubscribe: string }): Mail {
  const tehran = new Date(t.startsAt.getTime() + 3.5 * 3_600_000);
  const at = `${faDigits(String(tehran.getUTCHours()).padStart(2, '0'))}:${faDigits(String(tehran.getUTCMinutes()).padStart(2, '0'))}`;
  const title = `تورنمنت «${t.titleFa}» یک ساعت دیگر شروع می‌شود`;
  const url = `${links.web}/tournaments/${t.id}`;
  return {
    to, subject: title,
    headers: { 'List-Unsubscribe': `<${links.unsubscribe}>` },
    text: `${title}\n${t.gameNameFa}، ساعت ${at} به وقت تهران\n${url}\n\nلغو ایمیل‌های بردگیم‌ورس: ${links.unsubscribe}`,
    html: layout(title, `<p style="margin:0">${esc(t.gameNameFa)}، ساعت ${at} به وقت تهران</p>${button(url, 'صفحهٔ تورنمنت')}`,
      `<a href="${esc(links.unsubscribe)}" style="color:${C.muted}">لغو ایمیل‌ها</a>`)
  };
}

const unsubUrl = (cfg: EmailJobConfig, userId: string) => `${cfg.webUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(cfg.secret, userId))}`;
/** Verified address, email notifications on, account active; the in-app pref (turn / invite) must not be off either. */
const wantsEmail = (pref: 'turn' | 'invite') => and(isNotNull(userPrivate.email), isNotNull(userPrivate.emailVerifiedAt), eq(userPrivate.emailDigest, true), eq(users.status, 'active'),
  sql`coalesce((${userSettings.notify}->>${pref})::boolean, true)`);

/** Digest window: 09:00 to 11:59 Tehran (a worker restarted after 09:00 still sends that morning, never in the evening). */
export const inDigestWindow = (now: Date) => { const h = new Date(now.getTime() + 3.5 * 3_600_000).getUTCHours(); return h >= 9 && h < 12; };

/**
 * Daily turn digest: one email per user per Tehran day listing the turn-based tables waiting for them. The day is
 * claimed before sending (a crash never sends twice) and released when the SMTP send fails (retried next tick).
 * Users on vacation are skipped (no reminders while away).
 */
// ponytail: listMyTables per candidate (loads snapshots); batch 200 per tick is fine at today's size, a lighter my-turn query if it grows.
export async function runEmailDigest(db: Db, registry: GameRegistry, cfg: EmailJobConfig, now = new Date()) {
  if (!inDigestWindow(now)) return { sent: 0, failed: 0 };
  const day = tehranDate(now);
  const due = await db.select({ userId: userPrivate.userId, email: userPrivate.email, previous: userPrivate.emailDigestDay }).from(userPrivate)
    .innerJoin(users, eq(users.id, userPrivate.userId)).leftJoin(userSettings, eq(userSettings.userId, userPrivate.userId))
    .where(and(wantsEmail('turn'), sql`${userPrivate.emailDigestDay} is distinct from ${day}`,
      sql`(${users.vacationUntil} is null or ${users.vacationUntil} <= ${now.toISOString()})`)).limit(200);
  let sent = 0, failed = 0;
  for (const u of due) {
    const [claimed] = await db.update(userPrivate).set({ emailDigestDay: day })
      .where(and(eq(userPrivate.userId, u.userId), sql`${userPrivate.emailDigestDay} is distinct from ${day}`)).returning({ id: userPrivate.userId });
    if (!claimed) continue;
    const items = (await listMyTables(db, registry, u.userId)).filter((t) => t.status === 'active' && t.isMyTurn && !t.isTutorial && t.pace === 'turn')
      .map((t) => ({ tableId: t.id, gameNameFa: t.gameNameFa, deadline: t.deadline }));
    if (!items.length) continue;
    try {
      await cfg.send(digestEmail(u.email!, items, { web: cfg.webUrl, unsubscribe: unsubUrl(cfg, u.userId) }, now));
      sent++;
    } catch {
      failed++;
      await db.update(userPrivate).set({ emailDigestDay: u.previous }).where(eq(userPrivate.userId, u.userId));
    }
  }
  return { sent, failed };
}

/** Tournament reminder one hour before the start to each registered player with a verified email; once per entry. */
export async function runTournamentReminders(db: Db, cfg: EmailJobConfig, now = new Date()) {
  const due = await db.select({ tournamentId: tournaments.id, userId: tournamentEntries.userId, email: userPrivate.email, titleFa: tournaments.titleFa, startsAt: tournaments.startsAt, gameNameFa: games.nameFa })
    .from(tournamentEntries).innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId)).innerJoin(games, eq(games.id, tournaments.gameId))
    .innerJoin(userPrivate, eq(userPrivate.userId, tournamentEntries.userId)).innerJoin(users, eq(users.id, tournamentEntries.userId))
    .leftJoin(userSettings, eq(userSettings.userId, tournamentEntries.userId))
    .where(and(eq(tournaments.status, 'open'), gt(tournaments.startsAt, now), lte(tournaments.startsAt, new Date(now.getTime() + 3_600_000)),
      eq(tournamentEntries.status, 'registered'), isNull(tournamentEntries.emailRemindedAt), wantsEmail('invite'))).limit(200);
  let sent = 0, failed = 0;
  for (const r of due) {
    const key = and(eq(tournamentEntries.tournamentId, r.tournamentId), eq(tournamentEntries.userId, r.userId));
    const [claimed] = await db.update(tournamentEntries).set({ emailRemindedAt: now }).where(and(key, isNull(tournamentEntries.emailRemindedAt))).returning({ id: tournamentEntries.userId });
    if (!claimed) continue;
    try {
      await cfg.send(tournamentReminderEmail(r.email!, { id: r.tournamentId, titleFa: r.titleFa, gameNameFa: r.gameNameFa, startsAt: r.startsAt }, { web: cfg.webUrl, unsubscribe: unsubUrl(cfg, r.userId) }));
      sent++;
    } catch {
      failed++;
      await db.update(tournamentEntries).set({ emailRemindedAt: null }).where(key);
    }
  }
  return { sent, failed };
}
