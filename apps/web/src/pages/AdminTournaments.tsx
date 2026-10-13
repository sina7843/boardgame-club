import { useState } from 'react';
import { Link } from 'react-router';
import type { TournamentSummary } from '@bg/contracts';
import { Badge, Button, Input, Segmented, Select, Textarea, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDateTime, tomanFa } from '../lib/format.ts';
import { entryFa } from './Tournaments.tsx';

type Prize = { place: number; coins: number; premiumDays: number };

/** Local `datetime-local` value one day ahead (the admin's own clock; sent as UTC). */
const tomorrow = () => { const d = new Date(Date.now() + 86400_000); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

export function TournamentsAdmin() {
  const toast = useToast();
  const games = useApi<{ items: { id: string; nameFa: string; minPlayers: number; maxPlayers: number; paces: ('live' | 'turn')[] }[] }>('/games');
  const list = useApi<{ items: TournamentSummary[] }>('/tournaments');
  const [f, setF] = useState({
    gameId: 'line-three', titleFa: '', descriptionFa: '', format: 'swiss' as 'swiss' | 'knockout', pace: 'live' as 'live' | 'turn', turnSeconds: '60',
    tableSize: '2', rounds: '3', advance: '1', minEntrants: '4', maxEntrants: '32', startsAt: tomorrow(), arrivalSeconds: '180',
    entryKind: 'free' as 'free' | 'coins' | 'toman', amount: '0'
  });
  const [prizes, setPrizes] = useState<Prize[]>([{ place: 1, coins: 300, premiumDays: 7 }, { place: 2, coins: 150, premiumDays: 0 }, { place: 3, coins: 75, premiumDays: 0 }]);
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const game = games.data?.items.find((g) => g.id === f.gameId);

  const submit = async () => {
    setBusy(true);
    try {
      // Toman is entered by the admin; the API stores Rial.
      const entryAmount = f.entryKind === 'free' ? 0 : f.entryKind === 'toman' ? Number(f.amount) * 10 : Number(f.amount);
      await api('/admin/tournaments', { method: 'POST', body: {
        gameId: f.gameId, titleFa: f.titleFa, descriptionFa: f.descriptionFa, format: f.format, pace: f.pace, turnSeconds: Number(f.turnSeconds),
        tableSize: Number(f.tableSize), ...(f.format === 'swiss' ? { rounds: Number(f.rounds) } : { advance: Number(f.advance) }),
        minEntrants: Number(f.minEntrants), maxEntrants: Number(f.maxEntrants), startsAt: new Date(f.startsAt).toISOString(), arrivalSeconds: Number(f.arrivalSeconds),
        entryKind: f.entryKind, entryAmount, prizes: prizes.filter((p) => p.coins > 0 || p.premiumDays > 0)
      } });
      toast('success', 'تورنمنت ساخته شد و ثبت‌نام باز است.');
      setF({ ...f, titleFa: '', descriptionFa: '' });
      list.reload();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ساخته نشد.'); }
    setBusy(false);
  };
  const cancel = async (id: string) => {
    try { await api(`/admin/tournaments/${id}/cancel`, { method: 'POST', body: { reason: cancelReason[id] ?? '' } }); toast('success', 'لغو شد؛ ورودی‌ها برمی‌گردد.'); list.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'لغو نشد.'); }
  };

  return (
    <>
      <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="t-new-h">
        <h2 id="t-new-h" className="section-title">تورنمنت تازه</h2>
        <p className="muted" style={{ margin: 0 }}>جایزه را سکو می‌دهد و هرگز از ورودی‌ها جمع نمی‌شود. تنظیمات با محدودهٔ خود بازی سنجیده می‌شود.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="بازی" value={f.gameId} onChange={set('gameId')} options={(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))} />
          <Input label="عنوان" value={f.titleFa} onChange={set('titleFa')} placeholder="جام جمعه" />
        </div>
        <Textarea label="توضیح (اختیاری)" value={f.descriptionFa} onChange={set('descriptionFa')} rows={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented legend="فرمت" name="t-format" value={f.format} onChange={(v) => setF({ ...f, format: v })} options={[{ value: 'swiss', label: 'امتیازی (سوئیسی)' }, { value: 'knockout', label: 'حذفی' }]} />
          <Segmented legend="سرعت" name="t-pace" value={f.pace} onChange={(v) => setF({ ...f, pace: v })}
            options={(game?.paces ?? ['live', 'turn']).map((p) => ({ value: p, label: p === 'live' ? 'زنده' : 'نوبتی' }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="زمان هر حرکت (ثانیه)" inputMode="numeric" value={f.turnSeconds} onChange={set('turnSeconds')} />
          <Input label={`نفر هر میز${game ? ` (${faNum(game.minPlayers)}–${faNum(game.maxPlayers)})` : ''}`} inputMode="numeric" value={f.tableSize} onChange={set('tableSize')} />
          {f.format === 'swiss'
            ? <Input label="تعداد دور" inputMode="numeric" value={f.rounds} onChange={set('rounds')} />
            : <Input label="صعودی از هر میز" inputMode="numeric" value={f.advance} onChange={set('advance')} />}
          <Input label="مهلت آمدن سر میز (ثانیه)" inputMode="numeric" value={f.arrivalSeconds} onChange={set('arrivalSeconds')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="شروع" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} />
          <Input label="حداقل ثبت‌نام" inputMode="numeric" value={f.minEntrants} onChange={set('minEntrants')} />
          <Input label="ظرفیت" inputMode="numeric" value={f.maxEntrants} onChange={set('maxEntrants')} />
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <Segmented legend="ورودی" name="t-entry" value={f.entryKind} onChange={(v) => setF({ ...f, entryKind: v, amount: v === 'free' ? '0' : f.amount })}
            options={[{ value: 'free', label: 'رایگان' }, { value: 'coins', label: 'سکه' }, { value: 'toman', label: 'تومان' }]} />
          {f.entryKind !== 'free' && <Input label={f.entryKind === 'coins' ? 'ورودی (سکه)' : 'ورودی (تومان)'} inputMode="numeric" value={f.amount} onChange={set('amount')} />}
        </div>
        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">جایزه‌ها</legend>
          {prizes.map((p, i) => (
            <div key={i} className="row" style={{ alignItems: 'end' }}>
              <strong style={{ minInlineSize: 70 }}>رتبهٔ {faNum(p.place)}</strong>
              <div style={{ minInlineSize: 120 }}><Input label="سکه" inputMode="numeric" value={String(p.coins)} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, coins: Number(e.target.value) || 0 } : x)))} /></div>
              <div style={{ minInlineSize: 120 }}><Input label="روز پریمیوم" inputMode="numeric" value={String(p.premiumDays)} onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, premiumDays: Number(e.target.value) || 0 } : x)))} /></div>
            </div>
          ))}
          <div className="row">
            <Button size="sm" variant="ghost" onClick={() => setPrizes([...prizes, { place: prizes.length + 1, coins: 0, premiumDays: 0 }])}>رتبهٔ دیگر</Button>
            {prizes.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPrizes(prizes.slice(0, -1))}>حذف آخری</Button>}
          </div>
        </fieldset>
        <div><Button busy={busy} disabled={f.titleFa.trim().length < 3} onClick={() => void submit()}>ساخت و باز کردن ثبت‌نام</Button></div>
      </section>

      <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="t-list-h">
        <h2 id="t-list-h" className="section-title">تورنمنت‌ها</h2>
        {list.data?.items.length === 0 && <p className="muted" style={{ margin: 0 }}>هنوز تورنمنتی ساخته نشده است.</p>}
        <ul className="list">{list.data?.items.map((t) => (
          <li key={t.id} className="list__item list__item--compact" style={{ flexWrap: 'wrap' }}>
            <Link to={`/tournaments/${t.id}`} style={{ flex: 1, minInlineSize: 160 }}>{t.titleFa}</Link>
            <span className="muted">{jalaliDateTime(t.startsAt)}</span>
            <span className="muted">{faNum(t.entrants)}/{faNum(t.maxEntrants)} · {entryFa(t)}</span>
            <Badge tone={t.status === 'cancelled' ? 'danger' : t.status === 'running' ? 'success' : undefined}>{t.status}</Badge>
            {(t.status === 'open' || t.status === 'running') && (
              <span className="row" style={{ alignItems: 'end' }}>
                <Input label="علت لغو" value={cancelReason[t.id] ?? ''} onChange={(e) => setCancelReason({ ...cancelReason, [t.id]: e.target.value })} />
                <Button size="sm" variant="danger" disabled={(cancelReason[t.id] ?? '').trim().length < 3} onClick={() => void cancel(t.id)}>لغو</Button>
              </span>
            )}
          </li>))}</ul>
      </section>
      <RefundsAdmin />
    </>
  );
}

/** Toman entries to give back. Gateways here have no refund API: pay by card transfer, then record it. */
function RefundsAdmin() {
  const toast = useToast();
  const q = useApi<{ items: { id: string; tournamentTitleFa: string; displayName: string; mobile: string; orderId: string; providerRef: string | null; amount: number; reason: string; status: 'pending' | 'paid'; createdAt: string; note: string | null }[] }>('/admin/tournament-refunds?status=pending');
  const [note, setNote] = useState<Record<string, string>>({});
  const paid = async (id: string) => {
    try { await api(`/admin/tournament-refunds/${id}/paid`, { method: 'POST', body: { note: note[id] ?? '' } }); toast('success', 'بازپرداخت ثبت شد.'); q.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  return (
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="t-ref-h">
      <h2 id="t-ref-h" className="section-title">صف بازپرداخت ورودی تومانی</h2>
      <p className="muted" style={{ margin: 0 }}>درگاه بازپرداخت خودکار ندارد: مبلغ را واریز کنید و شمارهٔ پیگیری را ثبت کنید.</p>
      {q.data?.items.length === 0 && <p className="muted" style={{ margin: 0 }}>موردی در صف نیست.</p>}
      <ul className="list">{q.data?.items.map((r) => (
        <li key={r.id} className="list__item" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
          <span className="grid" style={{ flex: 1, minInlineSize: 200 }}>
            <strong><bdi>{r.displayName}</bdi> · <bdi dir="ltr">{r.mobile}</bdi></strong>
            <span className="muted">{r.tournamentTitleFa} · {r.reason}</span>
            <span className="muted">سفارش <bdi dir="ltr">{r.orderId}</bdi>{r.providerRef && <> · مرجع <bdi dir="ltr">{r.providerRef}</bdi></>}</span>
          </span>
          <strong>{tomanFa(r.amount)}</strong>
          <Input label="شمارهٔ پیگیری واریز" value={note[r.id] ?? ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
          <Button size="sm" disabled={(note[r.id] ?? '').trim().length < 3} onClick={() => void paid(r.id)}>پرداخت شد</Button>
        </li>))}</ul>
    </section>
  );
}
