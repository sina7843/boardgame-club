import { useState } from 'react';
import { Badge, Button, Input, Segmented, Select, Switch, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';

function useCall() {
  const toast = useToast();
  return async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body: object, ok: string) => {
    try { await api(path, { method, body }); toast('success', ok); return true; }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); return false; }
  };
}

/** Prices are a product decision: the admin sets them explicitly; every change is audited with a reason. */
export function PlansAdmin() {
  const plans = useApi<{ items: { id: string; titleFa: string; priceAmount: number | null; active: boolean; durationDays: number }[] }>('/admin/plans');
  const call = useCall();
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!plans.data) return null;
  return (
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="plans-admin-h">
      <h2 id="plans-admin-h" className="section-title">پلن‌ها و قیمت</h2>
      <p className="muted" style={{ margin: 0 }}>قیمت نهایی تصمیم محصول است؛ تا تعیین نشود خرید غیرفعال می‌ماند. مبلغ به ریال.</p>
      {plans.data.items.map((p) => (
        <div key={p.id} className="row" style={{ alignItems: 'end' }}>
          <strong style={{ minInlineSize: 140 }}>{p.titleFa}</strong>
          <Badge tone={p.active ? 'success' : undefined}>{p.active ? 'فعال' : 'غیرفعال'}</Badge>
          <div style={{ minInlineSize: 160 }}><Input label="قیمت (ریال)" inputMode="numeric" dir="ltr" className="input--ltr" value={draft[p.id] ?? (p.priceAmount ? String(p.priceAmount) : '')} onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })} /></div>
          <Button size="sm" variant="secondary" onClick={async () => { const v = Number(draft[p.id]); if (v > 0 && await call(`/admin/plans/${p.id}`, 'PATCH', { priceAmount: v, reason: 'تعیین قیمت از پنل' }, 'قیمت ذخیره شد.')) plans.reload(); }}>ذخیره قیمت</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (await call(`/admin/plans/${p.id}`, 'PATCH', { active: !p.active, reason: 'تغییر وضعیت عرضه' }, 'ذخیره شد.')) plans.reload(); }}>{p.active ? 'توقف عرضه' : 'عرضه'}</Button>
        </div>
      ))}
    </section>
  );
}

export function GameAccessAdmin({ games, onDone }: { games: { id: string; nameFa: string; access: 'free' | 'premium' }[]; onDone: () => void }) {
  const call = useCall();
  const [invites, setInvites] = useState(true);
  return (
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="access-h">
      <h2 id="access-h" className="section-title">دسترسی بازی‌ها</h2>
      <Switch label="میزبان پریمیوم می‌تواند بازیکنان رایگان را دعوت کند" checked={invites} onChange={setInvites} />
      {games.map((g) => (
        <div key={g.id} className="row">
          <span style={{ flex: 1 }}>{g.nameFa}</span>
          <Segmented legend={`دسترسی ${g.nameFa}`} name={`access-${g.id}`} value={g.access}
            onChange={async (access) => { if (await call(`/admin/games/${g.id}/access`, 'PATCH', { access, premiumHostInvitesFree: invites, reason: 'تغییر دسترسی از پنل' }, 'دسترسی ذخیره شد.')) onDone(); }}
            options={[{ value: 'free', label: 'رایگان' }, { value: 'premium', label: 'پریمیوم' }]} />
        </div>
      ))}
    </section>
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
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="seasons-h">
      <h2 id="seasons-h" className="section-title">فصل‌ها</h2>
      <ul className="list">{seasons.data?.items.map((s) => (
        <li key={s.id} className="list__item list__item--compact">
          <strong style={{ flex: 1 }}>{s.nameFa}</strong><span className="muted">{jalaliDate(s.startsAt)} تا {jalaliDate(s.endsAt)}</span><Badge>{STATUS[s.status]}</Badge>
          {s.status === 'scheduled' && <Button size="sm" onClick={async () => { if (await call(`/admin/seasons/${s.id}/activate`, 'POST', {}, 'فصل فعال شد.')) seasons.reload(); }}>فعال‌سازی</Button>}
          {s.status === 'active' && <Button size="sm" variant="danger" onClick={async () => { if (await call(`/admin/seasons/${s.id}/close`, 'POST', {}, 'فصل بسته و ثابت شد.')) seasons.reload(); }}>بستن و ثابت‌کردن</Button>}
        </li>))}</ul>
      <div className="row" style={{ alignItems: 'end' }}>
        <div style={{ flex: 1, minInlineSize: 180 }}><Input label="نام فصل تازه" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ minInlineSize: 120 }}><Input label="مدت (روز)" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <Button disabled={name.trim().length < 2} onClick={async () => {
          const start = new Date(); const end = new Date(start.getTime() + Number(days) * 86400_000);
          if (await call('/admin/seasons', 'POST', { nameFa: name, startsAt: start.toISOString(), endsAt: end.toISOString() }, 'فصل ساخته شد.')) { setName(''); seasons.reload(); }
        }}>ساخت فصل</Button>
      </div>
      <details>
        <summary>اصلاح ثبت‌شده یک جایگاه در فصل بسته</summary>
        <div className="stack" style={{ marginBlockStart: 'var(--sp-2)' }}>
          <Select label="فصل" value={fix.seasonId} onChange={(e) => setFix({ ...fix, seasonId: e.target.value })} options={[{ value: '', label: 'انتخاب کنید' }, ...(seasons.data?.items ?? []).filter((s) => s.status === 'closed').map((s) => ({ value: s.id, label: s.nameFa }))]} />
          <Input label="شناسه کاربر" dir="ltr" className="input--ltr" value={fix.userId} onChange={(e) => setFix({ ...fix, userId: e.target.value })} />
          <Select label="لیگ" value={fix.league} onChange={(e) => setFix({ ...fix, league: e.target.value })} options={['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'].map((l) => ({ value: l, label: l }))} />
          <Input label="علت (در سابقه ثبت می‌شود)" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} />
          <div><Button variant="secondary" disabled={!fix.seasonId || fix.reason.trim().length < 5} onClick={() => call(`/admin/seasons/${fix.seasonId}/corrections`, 'POST',
            { userId: fix.userId, gameId: fix.gameId, mode: fix.mode, league: fix.league, reason: fix.reason }, 'اصلاح ثبت شد.')}>ثبت اصلاح</Button></div>
        </div>
      </details>
    </section>
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
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="support-admin-h">
      <h2 id="support-admin-h" className="section-title">پشتیبانی: پاداش دستی و دسترسی</h2>
      <Input label="شناسه کاربر" dir="ltr" className="input--ltr" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <Input label="علت (الزامی، ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="row" style={{ alignItems: 'end' }}>
        <div style={{ minInlineSize: 120 }}><Input label="XP" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <Button variant="secondary" disabled={!userId || reason.trim().length < 5} onClick={() => call('/admin/rewards', 'POST', { userId, amount: Number(amount), reason }, 'پاداش ثبت شد.')}>ثبت پاداش</Button>
        <div style={{ minInlineSize: 120 }}><Input label="روز پریمیوم" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <Button variant="secondary" disabled={!userId || reason.trim().length < 5} onClick={() => call('/admin/entitlements', 'POST', { userId, days: Number(days), reason }, 'دسترسی داده شد.')}>اعطای پریمیوم</Button>
      </div>
      <SubscriptionsList userId={/^[0-9a-f-]{36}$/i.test(userId) ? userId : ''} />
      {payments.data && payments.data.items.length > 0 && (
        <details><summary>پرداخت‌های اخیر ({faNum(payments.data.items.length)})</summary>
          <ul className="list">{payments.data.items.map((p) => <li key={p.orderId} className="list__item list__item--compact"><bdi dir="ltr">{p.orderId}</bdi><span>{faNum(p.amount)} ریال</span><Badge>{p.status}</Badge>{p.failureReason && <span className="muted">{p.failureReason}</span>}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

/** Subscriptions + manual grants; filtered to the user in the support form once a full id is entered. */
function SubscriptionsList({ userId }: { userId: string }) {
  const subs = useApi<{ items: { kind: 'subscription' | 'manual'; id: string; userId: string; planTitleFa: string | null; status: string; startsAt: string; endsAt: string | null }[] }>(
    `/admin/subscriptions${userId ? `?userId=${userId}` : ''}`);
  const STATUS: Record<string, string> = { active: 'فعال', expired: 'منقضی', cancelled: 'لغو', revoked: 'باطل‌شده' };
  if (!subs.data) return null;
  return (
    <details>
      <summary>{userId ? 'اشتراک‌ها و دسترسی‌های این کاربر' : 'اشتراک‌ها و دسترسی‌های اخیر'} ({faNum(subs.data.items.length)})</summary>
      {subs.data.items.length === 0 ? <p className="muted">موردی ثبت نشده است.</p> : (
        <ul className="list">{subs.data.items.map((s) => (
          <li key={s.id} className="list__item list__item--compact">
            <span style={{ flex: 1 }}>{s.kind === 'manual' ? 'دسترسی دستی' : s.planTitleFa}</span>
            <bdi dir="ltr" className="muted">{s.userId.slice(0, 8)}</bdi>
            <span className="muted">{jalaliDate(s.startsAt)}{s.endsAt ? ` تا ${jalaliDate(s.endsAt)}` : ''}</span>
            <Badge tone={s.status === 'active' ? 'success' : undefined}>{STATUS[s.status] ?? s.status}</Badge>
          </li>))}</ul>
      )}
    </details>
  );
}

export function MissionsAdmin() {
  const missions = useApi<{ items: { id: string; key: string; ruleVersion: number; titleFa: string; descriptionFa: string; active: boolean }[] }>('/admin/missions');
  const call = useCall();
  if (!missions.data) return null;
  return (
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="missions-admin-h">
      <h2 id="missions-admin-h" className="section-title">مأموریت‌ها</h2>
      <p className="muted" style={{ margin: 0 }}>تعریف‌ها نسخه‌دارند؛ تغییر قاعده با نسخه تازه منتشر می‌شود و پاداش‌های قبلی دست نمی‌خورند.</p>
      {missions.data.items.map((m) => (
        <div key={m.id} className="row">
          <span style={{ flex: 1 }}><strong>{m.titleFa}</strong> <span className="muted">v{faNum(m.ruleVersion)} — {m.descriptionFa}</span></span>
          <Badge tone={m.active ? 'success' : undefined}>{m.active ? 'فعال' : 'غیرفعال'}</Badge>
          <Button size="sm" variant="ghost" onClick={async () => { if (await call(`/admin/missions/${m.id}`, 'PATCH', { active: !m.active, reason: 'تغییر از پنل مدیریت' }, 'ذخیره شد.')) missions.reload(); }}>
            {m.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
          </Button>
        </div>
      ))}
    </section>
  );
}
