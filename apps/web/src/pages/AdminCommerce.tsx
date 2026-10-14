import { useState, type ReactNode } from 'react';
import { useToast } from '@bg/ui';
import { Badge, Button, Card, Icon, Segmented, Select, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';

/** Admin section card: icon tile + title head, free-form body. */
export function AdminSection({ id, icon, title, extra, children, body = true }: { id: string; icon: string; title: ReactNode; extra?: ReactNode; children: ReactNode; body?: boolean }) {
  return (
    <Card className="ac-sec" aria-labelledby={id}>
      <div className="ac-sec__head"><span className="ac-tile"><Icon name={icon} /></span><h2 id={id} className="ac-h3">{title}</h2>{extra}</div>
      {body ? <div className="ac-sec__body">{children}</div> : children}
    </Card>
  );
}

function useCall() {
  const toast = useToast();
  return async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body: object, ok: string) => {
    try { await api(path, { method, body }); toast('success', ok); return true; }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); return false; }
  };
}

const Note = ({ children }: { children: ReactNode }) => <p className="t-body-sm bgv-muted" style={{ margin: 0, textWrap: 'pretty' }}>{children}</p>;

/** Launch gift: free premium days once per user on login; while on, the store (plans, coin shop, coin packs) is hidden. */
export function WelcomePremiumAdmin() {
  const s = useApi<{ enabled: boolean; days: number }>('/admin/welcome-premium');
  const toast = useToast();
  const [days, setDays] = useState<string>();
  if (!s.data) return null;
  const save = async (enabled: boolean) => {
    const d = Number(days ?? s.data!.days);
    if (!Number.isInteger(d) || d < 1 || d > 365) { toast('error', 'تعداد روز باید بین ۱ تا ۳۶۵ باشد.'); return; }
    try { await api('/admin/welcome-premium', { method: 'PUT', body: { enabled, days: d } }); toast('success', 'ذخیره شد.'); setDays(undefined); s.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  return (
    <AdminSection id="welcome-h" icon="gift" title="هدیهٔ پریمیوم افتتاح">
      <Note>وقتی روشن است، هر کاربر با ورود یک بار این تعداد روز پریمیوم می‌گیرد و خرید اشتراک، خرید با سکه و خرید سکه پنهان می‌شود. تغییر روزها فقط برای هدیه‌های بعدی است.</Note>
      <Switch label="هدیهٔ افتتاح" checked={s.data.enabled} onChange={(v) => void save(v)} />
      <div className="ac-inline">
        <TextField label="روز پریمیوم" inputMode="numeric" dir="ltr" value={days ?? String(s.data.days)} onChange={(e) => setDays(e.target.value)} />
        <Button size="sm" disabled={days === undefined} onClick={() => void save(s.data!.enabled)}>ذخیره روزها</Button>
      </div>
    </AdminSection>
  );
}

/** Prices are a product decision: the admin sets them explicitly; every change is audited with a reason. */
export function PlansAdmin({ path = '/admin/plans', title = 'پلن‌ها و قیمت' }: { path?: string; title?: string }) {
  const plans = useApi<{ items: { id: string; titleFa: string; priceAmount: number | null; active: boolean }[] }>(path);
  const call = useCall();
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!plans.data) return null;
  return (
    <AdminSection id={`${path}-h`} icon="coins" title={title}>
      <Note>قیمت نهایی تصمیم محصول است؛ تا تعیین نشود خرید غیرفعال می‌ماند. مبلغ به ریال.</Note>
      {plans.data.items.map((p) => (
        <div key={p.id} className="ac-inline">
          <strong style={{ minInlineSize: 140 }}>{p.titleFa}</strong>
          <Badge tone={p.active ? 'success' : undefined}>{p.active ? 'فعال' : 'غیرفعال'}</Badge>
          <TextField label="قیمت (ریال)" inputMode="numeric" dir="ltr" value={draft[p.id] ?? (p.priceAmount ? String(p.priceAmount) : '')} onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })} />
          <Button size="sm" onClick={async () => { const v = Number(draft[p.id]); if (v > 0 && await call(`${path}/${p.id}`, 'PATCH', { priceAmount: v, reason: 'تعیین قیمت از پنل' }, 'قیمت ذخیره شد.')) plans.reload(); }}>ذخیره قیمت</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (await call(`${path}/${p.id}`, 'PATCH', { active: !p.active, reason: 'تغییر وضعیت عرضه' }, 'ذخیره شد.')) plans.reload(); }}>{p.active ? 'توقف عرضه' : 'عرضه'}</Button>
        </div>
      ))}
    </AdminSection>
  );
}

/** Free/premium access for one game; every change is audited with a reason. */
export function GameAccess({ game, onDone }: { game: { id: string; nameFa: string; access: 'free' | 'premium' }; onDone: () => void }) {
  const call = useCall();
  const [invites, setInvites] = useState(true);
  return (
    <>
      <div className="ac-row">
        <div className="ac-row__text"><b>دسترسی</b><span>بازی پریمیوم فقط برای مشترک‌ها میز می‌سازد.</span></div>
        <Segmented label="دسترسی" value={game.access}
          onChange={async (access) => { if (await call(`/admin/games/${game.id}/access`, 'PATCH', { access, premiumHostInvitesFree: invites, reason: 'تغییر دسترسی از پنل' }, 'دسترسی ذخیره شد.')) onDone(); }}
          options={[{ value: 'free', label: 'رایگان' }, { value: 'premium', label: 'پریمیوم' }]} />
      </div>
      {game.access === 'free' && (
        <div className="ac-row">
          <div className="ac-row__text"><b>میزبان پریمیوم می‌تواند بازیکنان رایگان را دعوت کند</b><span>هنگام پریمیوم کردن بازی اعمال می‌شود.</span></div>
          <Switch aria-label="میزبان پریمیوم می‌تواند بازیکنان رایگان را دعوت کند" checked={invites} onChange={setInvites} />
        </div>
      )}
    </>
  );
}

export function SeasonsAdmin() {
  const seasons = useApi<{ items: { id: string; nameFa: string; status: string; startsAt: string; endsAt: string }[] }>('/seasons');
  const call = useCall();
  const [name, setName] = useState('');
  const [days, setDays] = useState('90');
  const [fix, setFix] = useState({ seasonId: '', userId: '', gameId: 'line-three', mode: 'live', league: 'gold', reason: '' });
  const STATUS = { scheduled: 'زمان‌بندی‌شده', active: 'فعال', closed: 'بسته (ثابت)' } as Record<string, string>;
  return (
    <AdminSection id="seasons-h" icon="calendar" title="فصل‌ها">
      <div style={{ marginInline: -20 }}>{seasons.data?.items.map((s) => (
        <div key={s.id} className="ac-row">
          <strong style={{ flex: 1 }}>{s.nameFa}</strong><span className="ac-cap">{jalaliDate(s.startsAt)} تا {jalaliDate(s.endsAt)}</span><Badge>{STATUS[s.status]}</Badge>
          {s.status === 'scheduled' && <Button size="sm" variant="primary" onClick={async () => { if (await call(`/admin/seasons/${s.id}/activate`, 'POST', {}, 'فصل فعال شد.')) seasons.reload(); }}>فعال‌سازی</Button>}
          {s.status === 'active' && <Button size="sm" variant="danger" onClick={async () => { if (await call(`/admin/seasons/${s.id}/close`, 'POST', {}, 'فصل بسته و ثابت شد.')) seasons.reload(); }}>بستن و ثابت‌کردن</Button>}
        </div>))}</div>
      <div className="ac-inline">
        <TextField label="نام فصل تازه" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="مدت (روز)" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        <Button variant="primary" disabled={name.trim().length < 2} onClick={async () => {
          const start = new Date(); const end = new Date(start.getTime() + Number(days) * 86400_000);
          if (await call('/admin/seasons', 'POST', { nameFa: name, startsAt: start.toISOString(), endsAt: end.toISOString() }, 'فصل ساخته شد.')) { setName(''); seasons.reload(); }
        }}>ساخت فصل</Button>
      </div>
      <details className="ac-details">
        <summary>اصلاح ثبت‌شده یک جایگاه در فصل بسته</summary>
        <div className="ac-stack">
          <Select label="فصل" value={fix.seasonId} onChange={(e) => setFix({ ...fix, seasonId: e.target.value })} options={[{ value: '', label: 'انتخاب کنید' }, ...(seasons.data?.items ?? []).filter((s) => s.status === 'closed').map((s) => ({ value: s.id, label: s.nameFa }))]} />
          <TextField label="شناسه کاربر" dir="ltr" value={fix.userId} onChange={(e) => setFix({ ...fix, userId: e.target.value })} />
          <Select label="لیگ" value={fix.league} onChange={(e) => setFix({ ...fix, league: e.target.value })} options={['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'].map((l) => ({ value: l, label: l }))} />
          <TextField label="علت (در سابقه ثبت می‌شود)" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} />
          <div><Button disabled={!fix.seasonId || fix.reason.trim().length < 5} onClick={() => call(`/admin/seasons/${fix.seasonId}/corrections`, 'POST',
            { userId: fix.userId, gameId: fix.gameId, mode: fix.mode, league: fix.league, reason: fix.reason }, 'اصلاح ثبت شد.')}>ثبت اصلاح</Button></div>
        </div>
      </details>
    </AdminSection>
  );
}

export function SupportAdmin() {
  const call = useCall();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('50');
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const payments = useApi<{ items: { orderId: string; amount: number; status: string; failureReason: string | null; createdAt: string }[] }>('/admin/payments');
  return (
    <AdminSection id="support-admin-h" icon="life-buoy" title="پشتیبانی: پاداش دستی و دسترسی">
      <TextField label="شناسه کاربر" dir="ltr" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <TextField label="علت (الزامی، ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="ac-inline">
        <TextField label="XP" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button disabled={!userId || reason.trim().length < 5} onClick={() => call('/admin/rewards', 'POST', { userId, amount: Number(amount), reason }, 'پاداش ثبت شد.')}>ثبت پاداش</Button>
        <TextField label="روز پریمیوم" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        <Button disabled={!userId || reason.trim().length < 5} onClick={() => call('/admin/entitlements', 'POST', { userId, days: Number(days), reason }, 'دسترسی داده شد.')}>اعطای پریمیوم</Button>
      </div>
      <SubscriptionsList userId={/^[0-9a-f-]{36}$/i.test(userId) ? userId : ''} />
      {payments.data && payments.data.items.length > 0 && (
        <details className="ac-details" style={{ padding: 0 }}><summary>پرداخت‌های اخیر ({faNum(payments.data.items.length)})</summary>
          <div style={{ marginInline: -20 }}>{payments.data.items.map((p) => <div key={p.orderId} className="ac-row"><bdi dir="ltr" className="bgv-latin">{p.orderId}</bdi><span>{faNum(p.amount)} ریال</span><Badge>{p.status}</Badge>{p.failureReason && <span className="ac-cap">{p.failureReason}</span>}</div>)}</div>
        </details>
      )}
    </AdminSection>
  );
}

/** Subscriptions + manual grants; filtered to the user in the support form once a full id is entered. */
function SubscriptionsList({ userId }: { userId: string }) {
  const subs = useApi<{ items: { kind: 'subscription' | 'manual'; id: string; userId: string; planTitleFa: string | null; status: string; startsAt: string; endsAt: string | null }[] }>(
    `/admin/subscriptions${userId ? `?userId=${userId}` : ''}`);
  const STATUS: Record<string, string> = { active: 'فعال', expired: 'منقضی', cancelled: 'لغو', revoked: 'باطل‌شده' };
  if (!subs.data) return null;
  return (
    <details className="ac-details" style={{ padding: 0 }}>
      <summary>{userId ? 'اشتراک‌ها و دسترسی‌های این کاربر' : 'اشتراک‌ها و دسترسی‌های اخیر'} ({faNum(subs.data.items.length)})</summary>
      {subs.data.items.length === 0 ? <StateBlock kind="empty" title="موردی ثبت نشده است." /> : (
        <div style={{ marginInline: -20 }}>{subs.data.items.map((s) => (
          <div key={s.id} className="ac-row">
            <span style={{ flex: 1 }}>{s.kind === 'manual' ? 'دسترسی دستی' : s.planTitleFa}</span>
            <bdi dir="ltr" className="bgv-latin ac-cap">{s.userId.slice(0, 8)}</bdi>
            <span className="ac-cap">{jalaliDate(s.startsAt)}{s.endsAt ? ` تا ${jalaliDate(s.endsAt)}` : ''}</span>
            <Badge tone={s.status === 'active' ? 'success' : undefined}>{STATUS[s.status] ?? s.status}</Badge>
          </div>))}</div>
      )}
    </details>
  );
}

const MISSION_TYPE_FA: Record<string, string> = {
  complete_tables: 'میز کامل', distinct_games: 'بازی‌های مختلف', learn_new_game: 'یادگیری', ranked_tables: 'رتبه‌دار', friendly_tables: 'دوستانه',
  live_tables: 'زنده', turn_tables: 'نوبتی', big_tables: 'سه‌نفره به بالا', tutorials: 'آموزش'
};
const MAX_ACTIVE_MISSIONS = 8; // mirrors the API limit

/** Weekly mission picker: tick this week's set from the catalog and save it in one audited step. */
export function MissionsAdmin() {
  const missions = useApi<{ items: { id: string; key: string; ruleVersion: number; titleFa: string; descriptionFa: string; criteria: unknown; active: boolean }[] }>('/admin/missions');
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!missions.data) return null;
  const items = missions.data.items;
  const active = new Set(items.filter((m) => m.active).map((m) => m.id));
  const sel = picked ?? active;
  const dirty = sel.size !== active.size || [...sel].some((id) => !active.has(id));
  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setPicked(s); };
  const save = async () => {
    setBusy(true);
    try {
      await api('/admin/missions/active', { method: 'PUT', body: { ids: [...sel], reason: reason.trim() || 'انتخاب مأموریت‌های هفته' } });
      toast('success', `${faNum(sel.size)} مأموریت برای این هفته فعال شد.`);
      setPicked(null); setReason(''); missions.reload();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره نشد.'); } finally { setBusy(false); }
  };
  const tooMany = sel.size > MAX_ACTIVE_MISSIONS;
  return (
    <AdminSection id="missions-admin-h" icon="flag" title="مأموریت‌های هفته"
      extra={<Badge tone={tooMany || sel.size === 0 ? 'danger' : 'success'}>{faNum(sel.size)} از حداکثر {faNum(MAX_ACTIVE_MISSIONS)} انتخاب‌شده</Badge>}>
      <Note>از فهرست، مأموریت‌های این هفته را انتخاب کنید. هیچ مأموریتی برد اجباری ندارد. پیشرفت هر بازیکن از رویدادهای همین هفته حساب می‌شود و پاداش‌های قبلی دست نمی‌خورند.</Note>
      <div style={{ marginInline: -20 }}>{items.map((m) => {
        const c = m.criteria as { type?: string; count?: number; xp?: number };
        return (
          <label key={m.id} className={`ac-mission${sel.has(m.id) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
            <span className="ac-mission__body"><b>{m.titleFa}</b><span>{m.descriptionFa}</span></span>
            <span className="ac-mission__meta"><Badge>{MISSION_TYPE_FA[c.type ?? ''] ?? c.type}</Badge><span className="bgv-num">+{faNum(c.xp ?? 0)} XP</span></span>
          </label>);
      })}</div>
      <div className="ac-inline">
        <TextField label="علت (در گزارش ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="انتخاب مأموریت‌های هفته" />
        <Button variant="ghost" disabled={!dirty || busy} onClick={() => setPicked(null)}>بازگردانی</Button>
        <Button variant="primary" loading={busy} disabled={!dirty || tooMany || sel.size === 0} onClick={() => void save()}>ذخیرهٔ مأموریت‌های هفته</Button>
      </div>
    </AdminSection>
  );
}

interface ReferralSettings { enabled: boolean; inviterCoins: number; inviterDays: number; inviteeCoins: number; inviteeDays: number; maxRewardedPerInviter: number }
type Person = { id: string; displayName: string };
type Reward = { coins: number; days: number };
const REFERRAL_FIELDS: [keyof Omit<ReferralSettings, 'enabled'>, string][] = [
  ['inviterCoins', 'سکهٔ دعوت‌کننده'], ['inviterDays', 'روز پریمیوم دعوت‌کننده'],
  ['inviteeCoins', 'سکهٔ عضو جدید'], ['inviteeDays', 'روز پریمیوم عضو جدید'],
  ['maxRewardedPerInviter', 'سقف دعوت جایزه‌دار هر نفر (۰ = بی‌سقف)']
];
const rewardText = (r?: Reward) => (r ? [r.coins > 0 && `${faNum(r.coins)} سکه`, r.days > 0 && `${faNum(r.days)} روز`].filter(Boolean).join(' + ') : '') || '—';

/** Friend referral: rewards for both sides (new sign-ups only) and who joined through whose link. */
export function ReferralAdmin() {
  const s = useApi<ReferralSettings>('/admin/referral');
  const [referrerId, setReferrerId] = useState('');
  const report = useApi<{ total: number; top: { user: Person; count: number }[];
    items: { referrer: Person; referred: Person; createdAt: string; rewards: { inviter?: Reward; invitee?: Reward } }[] }>(
    `/admin/referrals${referrerId ? `?referrerId=${referrerId}` : ''}`);
  const toast = useToast();
  const [draft, setDraft] = useState<Partial<Record<keyof ReferralSettings, string>>>({});
  if (!s.data) return null;
  const save = async (enabled: boolean) => {
    const body: ReferralSettings = { ...s.data!, enabled };
    for (const [k] of REFERRAL_FIELDS) {
      const v = Number(draft[k] ?? s.data![k]);
      if (!Number.isInteger(v) || v < 0) { toast('error', 'مقدارها باید عدد صحیح و نامنفی باشند.'); return; }
      body[k] = v;
    }
    try { await api('/admin/referral', { method: 'PUT', body }); toast('success', 'ذخیره شد.'); setDraft({}); s.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  const who = (p: Person) => <button type="button" className="ac-link" onClick={() => setReferrerId(p.id)}><bdi>{p.displayName}</bdi></button>;
  return (
    <>
      <AdminSection id="referral-h" icon="user-plus" title="جایزهٔ دعوت دوستان">
        <Note>کسی که با لینک دعوت عضو شود همیشه خودکار دوست دعوت‌کننده می‌شود. وقتی جایزه روشن است، هر دو طرف هدیهٔ تعیین‌شده را می‌گیرند (فقط برای عضویت‌های بعدی). صفر یعنی بدون آن جایزه.</Note>
        <Switch label="جایزهٔ دعوت" checked={s.data.enabled} onChange={(v) => void save(v)} />
        <div className="ac-inline">
          {REFERRAL_FIELDS.map(([k, label]) => (
            <TextField key={k} label={label} inputMode="numeric" dir="ltr" value={draft[k] ?? String(s.data![k])} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          ))}
          <Button size="sm" disabled={!Object.keys(draft).length} onClick={() => void save(s.data!.enabled)}>ذخیره جایزه‌ها</Button>
        </div>
      </AdminSection>
      {report.data && (
        <AdminSection id="referral-report-h" icon="users" title={<>گزارش دعوت‌ها <span className="ac-cap" style={{ display: 'inline' }}>({faNum(report.data.total)})</span></>} body={false}>
          {report.data.top.length > 0 && (
            <details open className="ac-details"><summary>بیشترین دعوت</summary>
              {report.data.top.map((t) => (
                <div key={t.user.id} className="ac-row" style={{ paddingInline: 0 }}><span style={{ flex: 1 }}>{who(t.user)}</span><Badge>{faNum(t.count)} نفر</Badge></div>))}
            </details>
          )}
          {referrerId && <div className="ac-row"><Badge>فقط دعوت‌های یک نفر</Badge><Button size="sm" variant="ghost" onClick={() => setReferrerId('')}>نمایش همه</Button></div>}
          {report.data.items.length === 0 ? <StateBlock kind="empty" title="هنوز کسی با لینک دعوت عضو نشده است." /> : (
            report.data.items.map((i) => (
              <div key={i.referred.id} className="ac-row">
                <span>{who(i.referrer)} ← <bdi>{i.referred.displayName}</bdi></span>
                <span className="ac-cap">{jalaliDate(i.createdAt)}</span>
                <span style={{ marginInlineStart: 'auto' }} className="ac-cap">دعوت‌کننده: {rewardText(i.rewards.inviter)}<span className="bgv-sep" />عضو جدید: {rewardText(i.rewards.invitee)}</span>
              </div>))
          )}
        </AdminSection>
      )}
    </>
  );
}
