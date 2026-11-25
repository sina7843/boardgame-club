// Admin: time-limited events. The server validates the window, game ids and the reward cosmetic; every change is audited.
import { useState } from 'react';
import { COSMETICS, MISSION_TYPE_FA, MISSION_TYPES, SLOT_FA, type EventGoal, type MissionType } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Badge, Button, Select, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { jalaliDateTime } from '../lib/format.ts';
import { AdminSection } from './AdminCommerce.tsx';

interface AdminEvent { id: string; slug: string; titleFa: string; descriptionFa: string; startsAt: string; endsAt: string; gameIds: string[] | null;
  goals: EventGoal[]; rewardCosmetic: string | null; active: boolean; status: 'upcoming' | 'live' | 'ended' }

/** ISO → `datetime-local` value in the admin's own clock (sent back as UTC). */
const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const blank = () => ({ id: '', slug: '', titleFa: '', descriptionFa: '', startsAt: local(new Date(Date.now() + 3600_000).toISOString()),
  endsAt: local(new Date(Date.now() + 7 * 86400_000).toISOString()), gameIds: '', goals: [] as { type: MissionType; count: string }[], rewardCosmetic: '', active: false });
const STATUS_FA = { live: 'در جریان', upcoming: 'به‌زودی', ended: 'پایان‌یافته' } as const;
const REWARDS = [{ value: '', label: 'بدون جایزه' }, ...COSMETICS.map((c) => ({ value: c.key, label: `${SLOT_FA[c.slot]}: ${c.nameFa}` }))];

export function EventsAdmin() {
  const list = useApi<{ items: AdminEvent[] }>('/admin/events');
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: 'slug' | 'titleFa' | 'descriptionFa' | 'startsAt' | 'endsAt' | 'gameIds' | 'rewardCosmetic') => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const fail = (e: unknown) => toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.');

  const save = async () => {
    const ids = f.gameIds.split(/[\s,،]+/).map((x) => x.trim()).filter(Boolean);
    const body = { slug: f.slug.trim(), titleFa: f.titleFa.trim(), descriptionFa: f.descriptionFa.trim(), startsAt: new Date(f.startsAt).toISOString(),
      endsAt: new Date(f.endsAt).toISOString(), gameIds: ids.length ? ids : null, goals: f.goals.map((g) => ({ type: g.type, count: Number(g.count) })),
      rewardCosmetic: f.rewardCosmetic || null, active: f.active };
    if (new Date(f.endsAt) <= new Date(f.startsAt)) { toast('error', 'پایان باید بعد از شروع باشد.'); return; }
    setBusy(true);
    try {
      await api(f.id ? `/admin/events/${f.id}` : '/admin/events', { method: f.id ? 'PUT' : 'POST', body });
      toast('success', f.id ? 'رویداد ذخیره شد.' : 'رویداد ساخته شد.');
      setF(blank()); list.reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const toggle = async (e: AdminEvent, active: boolean) => {
    try { await api(`/admin/events/${e.id}`, { method: 'PATCH', body: { active } }); list.reload(); } catch (err) { fail(err); }
  };
  const edit = (e: AdminEvent) => setF({ id: e.id, slug: e.slug, titleFa: e.titleFa, descriptionFa: e.descriptionFa, startsAt: local(e.startsAt), endsAt: local(e.endsAt),
    gameIds: (e.gameIds ?? []).join(', '), goals: e.goals.map((g) => ({ type: g.type, count: String(g.count) })), rewardCosmetic: e.rewardCosmetic ?? '', active: e.active });

  return (
    <>
      <AdminSection id="events-form-h" icon="zap" title={f.id ? `ویرایش رویداد «${f.titleFa}»` : 'رویداد تازه'}>
        <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>امتیاز: هر بازی کامل با بازیکنان واقعی در بازه یک امتیاز، رتبهٔ اول یک امتیاز بیشتر (ربات و حریف تکراری حساب نمی‌شوند). کسی که همهٔ هدف‌ها را کامل کند جایزه را یک بار می‌گیرد. فقط آیتم‌های موجود فروشگاه جایزه می‌شوند.</p>
        <div className="ac-grid2">
          <TextField label="عنوان" value={f.titleFa} onChange={set('titleFa')} />
          <TextField label="نشانی (حروف لاتین کوچک و خط تیره)" dir="ltr" value={f.slug} onChange={set('slug')} placeholder="yalda-week" />
        </div>
        <TextField label="توضیح" value={f.descriptionFa} onChange={set('descriptionFa')} />
        <div className="ac-grid2">
          <TextField label="شروع" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} />
          <TextField label="پایان" type="datetime-local" value={f.endsAt} onChange={set('endsAt')} />
        </div>
        <div className="ac-grid2">
          <TextField label="شناسهٔ بازی‌ها (خالی = همه)" dir="ltr" value={f.gameIds} onChange={set('gameIds')} placeholder="chess, azul" />
          <Select label="جایزه" value={f.rewardCosmetic} onChange={set('rewardCosmetic')} options={REWARDS} />
        </div>
        {f.goals.map((g, i) => (
          <div key={i} className="ac-inline">
            <Select label={`هدف ${i + 1}`} value={g.type} onChange={(e) => setF({ ...f, goals: f.goals.map((x, j) => (j === i ? { ...x, type: e.target.value as MissionType } : x)) })}
              options={MISSION_TYPES.map((t) => ({ value: t, label: MISSION_TYPE_FA[t] }))} />
            <TextField label="تعداد" inputMode="numeric" dir="ltr" value={g.count} onChange={(e) => setF({ ...f, goals: f.goals.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)) })} />
            <Button variant="ghost" size="sm" icon="x" onClick={() => setF({ ...f, goals: f.goals.filter((_, j) => j !== i) })}>حذف هدف</Button>
          </div>
        ))}
        <div className="ac-inline">
          {f.goals.length < 5 && <Button size="sm" icon="plus" onClick={() => setF({ ...f, goals: [...f.goals, { type: 'complete_tables', count: '3' }] })}>افزودن هدف</Button>}
          <Switch label="فعال (نمایش عمومی)" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
          {f.id && <Button variant="ghost" onClick={() => setF(blank())}>انصراف از ویرایش</Button>}
          <Button variant="primary" loading={busy} disabled={!f.titleFa.trim() || !f.slug.trim()} onClick={() => void save()}>{f.id ? 'ذخیرهٔ رویداد' : 'ساخت رویداد'}</Button>
        </div>
      </AdminSection>
      <AdminSection id="events-list-h" icon="calendar" title="رویدادها" body={false}>
        {!list.data ? <StateBlock kind="loading" title="در حال بارگذاری…" /> : list.data.items.length === 0 ? <StateBlock kind="empty" title="هنوز رویدادی ساخته نشده است." /> : (
          list.data.items.map((e) => (
            <div key={e.id} className="ac-row">
              <span style={{ flex: 1 }}><b>{e.titleFa}</b> <a href={`/events/${e.slug}`} dir="ltr">/events/{e.slug}</a></span>
              <span className="ac-cap">{jalaliDateTime(e.startsAt)} تا {jalaliDateTime(e.endsAt)}</span>
              <Badge>{STATUS_FA[e.status]}</Badge>
              <Switch label="فعال" checked={e.active} onChange={(v) => void toggle(e, v)} />
              <Button size="sm" icon="pencil" onClick={() => edit(e)}>ویرایش</Button>
            </div>))
        )}
      </AdminSection>
    </>
  );
}
