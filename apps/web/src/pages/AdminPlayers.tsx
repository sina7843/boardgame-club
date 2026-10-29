import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useToast } from '@bg/ui';
import { RATING_MODE_FA, RATING_MODES, type RatingMode } from '@bg/contracts';
import { Avatar, Badge, Button, Card, ChipGroup, Dialog, Icon, Select, StateBlock, TextField } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { AvatarArt } from '../lib/bgv.tsx';
import { faNum, jalaliDate, jalaliDateTime } from '../lib/format.ts';
import { SANCTION_FA } from './Support.tsx';

type Status = 'active' | 'suspended' | 'deleted';
interface Player { id: string; displayName: string; avatarKey: string; mobileMasked: string | null; status: Status; roles: string[]; joinedAt: string; lastSeenAt: string | null }
interface PlayerDetail extends Player {
  coins: number; tablesPlayed: number; activeSessions: number;
  sanctions: { id: string; kind: keyof typeof SANCTION_FA; reason: string; startsAt: string; endsAt: string | null; active: boolean }[];
}
const STATUS_FA: Record<Status, string> = { active: 'فعال', suspended: 'تعلیق', deleted: 'بسته‌شده' };
const ROLE_FA: Record<string, string> = { admin: 'مدیر', moderator: 'ناظر' };
const DURATIONS = [{ value: '24', label: '۱ روز' }, { value: '72', label: '۳ روز' }, { value: '168', label: '۱ هفته' }, { value: '720', label: '۳۰ روز' }, { value: '', label: 'نامحدود' }];

const statusBadge = (s: Status) => s !== 'active' && <Badge tone="danger" size="sm" icon={s === 'deleted' ? 'trash-2' : 'ban'}>{STATUS_FA[s]}</Badge>;
const PlayerAvatar = ({ p, size = 'sm' }: { p: Pick<Player, 'displayName' | 'avatarKey'>; size?: 'sm' | 'lg' }) =>
  <Avatar size={size} initials={p.displayName.trim().charAt(0)}><AvatarArt avatarKey={p.avatarKey} /></Avatar>;

/** Every player account: search, status filter, and per-player suspend / lift / sign-out / close. */
export function PlayersAdmin() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [offset, setOffset] = useState(0);
  const list = useApi<{ items: Player[]; total: number; hasMore: boolean }>(`/admin/users?status=${status}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const selected = params.get('player');
  const select = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('player', id); else n.delete('player'); return n; });
  return (
    <div className={`ac-adm${selected ? ' has-selection' : ''}`}>
      <Card flush className="ac-adm__list" aria-labelledby="admin-players-h">
        <form className="ac-adm__pick" onSubmit={(e) => { e.preventDefault(); setOffset(0); setQ(draft.trim()); }}>
          <h2 id="admin-players-h" className="ac-h3">بازیکنان {list.data && <span className="ac-cap" style={{ display: 'inline' }}>({faNum(list.data.total)})</span>}</h2>
          <TextField icon="search" type="search" aria-label="جست‌وجوی بازیکن" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="نام یا شماره موبایل، سپس Enter" />
          <ChipGroup size="sm" label="وضعیت" value={status} onChange={(v) => { setOffset(0); setStatus(v as typeof status); }}
            options={[{ value: 'all', label: 'همه' }, ...(['active', 'suspended', 'deleted'] as const).map((s) => ({ value: s, label: STATUS_FA[s] }))]} />
        </form>
        {list.error ? <StateBlock kind="error" title="فهرست بارگذاری نشد" text={list.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={list.reload}>تلاش دوباره</Button>} />
          : !list.data ? <StateBlock kind="loading" title="در حال بارگذاری…" />
          : list.data.items.length === 0 ? <StateBlock kind="empty" title="بازیکنی پیدا نشد" />
          : <>
            {list.data.items.map((p) => (
              <button key={p.id} type="button" className={`ac-adminrow${selected === p.id ? ' is-selected' : ''}`} aria-current={selected === p.id || undefined} onClick={() => select(p.id)}>
                <PlayerAvatar p={p} />
                <span className="ac-adminrow__name"><b><bdi>{p.displayName}</bdi></b><bdi dir="ltr" className="bgv-latin ac-cap">{p.mobileMasked ?? '—'}</bdi></span>
                {p.roles.map((r) => <Badge key={r} icon="shield" size="sm">{ROLE_FA[r] ?? r}</Badge>)}
                {statusBadge(p.status)}
              </button>
            ))}
            {(offset > 0 || list.data.hasMore) && (
              <div className="ac-row">
                <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>قبلی</Button>
                <span className="bgv-spacer" />
                <Button size="sm" variant="ghost" disabled={!list.data.hasMore} onClick={() => setOffset(offset + 50)}>بعدی</Button>
              </div>
            )}
          </>}
      </Card>
      <div className="ac-adm__detail">
        {selected ? <PlayerDetailAdmin key={selected} id={selected} onBack={() => select(null)} onChanged={list.reload} />
          : <Card><StateBlock kind="empty" title="یک بازیکن انتخاب کنید" text="وضعیت حساب، سکه، نشست‌ها و سابقه محدودیت‌ها اینجا نمایش داده می‌شود." /></Card>}
      </div>
    </div>
  );
}

type Action = 'suspend' | 'unsuspend' | 'logout' | 'close';
const ACTION_FA: Record<Action, { title: string; button: string; done: string; danger: boolean }> = {
  suspend: { title: 'تعلیق حساب', button: 'تعلیق', done: 'حساب تعلیق شد.', danger: true },
  unsuspend: { title: 'رفع تعلیق', button: 'رفع تعلیق', done: 'تعلیق برداشته شد.', danger: false },
  logout: { title: 'خروج از همه دستگاه‌ها', button: 'خروج اجباری', done: 'همه نشست‌های بازیکن بسته شد.', danger: true },
  close: { title: 'بستن حساب', button: 'بستن حساب', done: 'حساب بسته شد.', danger: true }
};

/** Ratings per game and pace; an admin can set one for any game, also one the player never played (audited with the reason). */
function RatingsCard({ id }: { id: string }) {
  const toast = useToast();
  const games = useApi<{ items: { id: string; nameFa: string }[] }>('/games');
  const rows = useApi<{ items: { gameId: string; gameNameFa: string; mode: RatingMode; rating: number; sigma: number; gamesPlayed: number }[] }>(`/admin/users/${id}/ratings`);
  const [gameId, setGameId] = useState('');
  const [mode, setMode] = useState<RatingMode>('live');
  const [rating, setRating] = useState('1500');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = (g: string, m: RatingMode) => {
    setGameId(g); setMode(m);
    const cur = rows.data?.items.find((r) => r.gameId === g && r.mode === m);
    if (cur) setRating(String(cur.rating));
  };
  const save = async () => {
    setBusy(true);
    try {
      await api('/admin/ratings', { method: 'POST', body: { userId: id, gameId, mode, rating: Number(rating), reason } });
      toast('success', 'امتیاز ثبت شد.'); setReason(''); rows.reload();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
    setBusy(false);
  };
  const valid = gameId !== '' && Number.isInteger(Number(rating)) && Number(rating) >= 0 && Number(rating) <= 3000 && reason.trim().length >= 3;
  return (
    <Card className="ac-sec" aria-labelledby="admin-player-ratings-h">
      <div className="ac-sec__head"><span className="ac-tile"><Icon name="trophy" /></span><h2 id="admin-player-ratings-h" className="ac-h3">امتیاز بازی‌ها</h2></div>
      {rows.data?.items.length === 0 && <p className="ac-cap ac-pad">این بازیکن هنوز امتیازی ندارد؛ می‌توانید برای هر بازی امتیاز اولیه بدهید.</p>}
      {rows.data?.items.map((r) => (
        <div key={`${r.gameId}:${r.mode}`} className="ac-row">
          <div className="ac-row__text"><b>{r.gameNameFa}</b><span>{RATING_MODE_FA[r.mode]} · {faNum(r.gamesPlayed)} بازی</span></div>
          <strong>{faNum(r.rating)}</strong>
          <Button size="sm" variant="ghost" onClick={() => pick(r.gameId, r.mode)}>ویرایش</Button>
        </div>
      ))}
      <div className="ac-pad ac-stack">
        <div className="ac-grid2">
          <Select label="بازی" value={gameId} onChange={(e) => pick(e.target.value, mode)}
            options={[{ value: '', label: 'انتخاب بازی' }, ...(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))]} />
          <Select label="سرعت" value={mode} onChange={(e) => pick(gameId, e.target.value as RatingMode)} options={RATING_MODES.map((m) => ({ value: m, label: RATING_MODE_FA[m] }))} />
          <TextField label="امتیاز (۰ تا ۳۰۰۰؛ تازه‌وارد ۱۵۰۰)" inputMode="numeric" value={rating} onChange={(e) => setRating(e.target.value)} />
          <TextField label="علت (ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div><Button variant="primary" loading={busy} disabled={!valid} onClick={() => void save()}>ثبت امتیاز</Button></div>
      </div>
    </Card>
  );
}

function PlayerDetailAdmin({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const p = useApi<PlayerDetail>(`/admin/users/${id}`);
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (p.error) return <Card><StateBlock kind="error" title="بازیکن بارگذاری نشد" text={p.error.messageFa} action={<Button onClick={onBack}>بازگشت</Button>} /></Card>;
  if (!p.data) return <Card><StateBlock kind="loading" title="در حال بارگذاری…" /></Card>;
  const d = p.data;
  const staff = d.roles.length > 0;
  const open = (a: Action) => { setAction(a); setReason(''); setConfirm(''); setError(undefined); };
  const submit = async () => {
    if (!action) return;
    setBusy(true); setError(undefined);
    try {
      const body = { reason, ...(action === 'suspend' && hours ? { durationHours: Number(hours) } : {}), ...(action === 'close' ? { confirm } : {}) };
      await api(`/admin/users/${id}/${action}`, { method: 'POST', body });
      toast('success', ACTION_FA[action].done);
      setAction(null); p.reload(); onChanged();
    } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
    finally { setBusy(false); }
  };
  const row = (label: string, text: string, a: Action, variant: 'danger' | 'primary' | 'secondary' = 'danger') => (
    <div className="ac-row">
      <div className="ac-row__text"><b>{label}</b><span>{text}</span></div>
      <Button size="sm" variant={variant} onClick={() => open(a)}>{ACTION_FA[a].button}</Button>
    </div>
  );
  return (
    <>
      <div className="ac-adm__back"><Button variant="ghost" size="sm" icon="arrow-right" onClick={onBack}>بازگشت به فهرست بازیکنان</Button></div>
      <Card className="ac-head" aria-labelledby="admin-player-h">
        <PlayerAvatar p={d} size="lg" />
        <div className="ac-head__text">
          <div className="bgv-row" style={{ gap: 10 }}>
            <h2 id="admin-player-h" className="t-page-sm" style={{ color: 'var(--heading)', margin: 0 }}><bdi>{d.displayName}</bdi></h2>
            <Badge tone={d.status === 'active' ? 'success' : 'danger'}>{STATUS_FA[d.status]}</Badge>
            {d.roles.map((r) => <Badge key={r} icon="shield">{ROLE_FA[r] ?? r}</Badge>)}
          </div>
          <span className="ac-cap"><bdi dir="ltr" className="bgv-latin">{d.mobileMasked ?? '—'}</bdi> · عضویت {jalaliDate(d.joinedAt)}{d.lastSeenAt && ` · آخرین بازدید ${jalaliDateTime(d.lastSeenAt)}`}</span>
        </div>
        {d.status !== 'deleted' && <Button size="sm" icon="arrow-up-right" href={`/users/${d.id}`}>پروفایل</Button>}
      </Card>

      <Card className="ac-sec" aria-labelledby="admin-player-stats-h">
        <div className="ac-sec__head"><span className="ac-tile"><Icon name="chart-bar" /></span><h2 id="admin-player-stats-h" className="ac-h3">خلاصه</h2></div>
        <div className="ac-row"><div className="ac-row__text"><b>سکه</b></div><span>{faNum(d.coins)}</span></div>
        <div className="ac-row"><div className="ac-row__text"><b>میزهای بازی‌شده</b></div><span>{faNum(d.tablesPlayed)}</span></div>
        <div className="ac-row"><div className="ac-row__text"><b>نشست‌های فعال</b></div><span>{faNum(d.activeSessions)}</span></div>
      </Card>

      {d.status !== 'deleted' && (
        <Card className="ac-sec" aria-labelledby="admin-player-actions-h">
          <div className="ac-sec__head"><span className="ac-tile"><Icon name="shield" /></span><h2 id="admin-player-actions-h" className="ac-h3">مدیریت حساب</h2></div>
          {staff ? <p className="ac-cap ac-pad">حساب مدیر یا ناظر از این بخش قابل تغییر نیست؛ ابتدا نقش آن برداشته شود.</p> : <>
            {d.status === 'suspended'
              ? row('رفع تعلیق', 'بازیکن دوباره می‌تواند بازی کند و پیام بدهد.', 'unsuspend', 'primary')
              : row('تعلیق حساب', 'بازیکن فقط می‌تواند محدودیت را ببیند و اعتراض کند.', 'suspend')}
            {row('خروج از همه دستگاه‌ها', 'همه نشست‌ها بسته می‌شود؛ بازیکن باید دوباره وارد شود.', 'logout', 'secondary')}
            {row('بستن حساب', 'پروفایل ناشناس، موبایل آزاد و نشست‌ها بسته می‌شود؛ سابقه بازی‌ها بدون نام می‌ماند. برگشت‌پذیر نیست.', 'close')}
          </>}
        </Card>
      )}

      {d.status !== 'deleted' && <RatingsCard id={id} />}

      <Card className="ac-sec" aria-labelledby="admin-player-sanctions-h">
        <div className="ac-sec__head"><span className="ac-tile"><Icon name="ban" /></span><h2 id="admin-player-sanctions-h" className="ac-h3">سابقه محدودیت‌ها</h2></div>
        {d.sanctions.length === 0 ? <p className="ac-cap ac-pad">محدودیتی ثبت نشده است.</p> : d.sanctions.map((s) => (
          <div key={s.id} className="ac-row">
            <Badge tone={s.active ? 'danger' : undefined}>{SANCTION_FA[s.kind] ?? s.kind}</Badge>
            <div className="ac-row__text"><span>{s.reason}</span><span className="ac-cap">{jalaliDate(s.startsAt)}{s.endsAt ? ` تا ${jalaliDate(s.endsAt)}` : ' · نامحدود'}</span></div>
          </div>
        ))}
      </Card>

      {action && (
        <Dialog modal danger={ACTION_FA[action].danger} title={ACTION_FA[action].title} onClose={() => setAction(null)}
          footer={<>
            <Button onClick={() => setAction(null)}>انصراف</Button>
            <Button variant={ACTION_FA[action].danger ? 'danger' : 'primary'} loading={busy}
              disabled={reason.trim().length < 3 || (action === 'close' && confirm !== 'بستن')} onClick={submit}>{ACTION_FA[action].button}</Button>
          </>}>
          <div className="ac-stack">
            <p style={{ margin: 0 }}>«<bdi>{d.displayName}</bdi>»</p>
            {action === 'suspend' && <Select label="مدت" value={hours} onChange={(e) => setHours(e.target.value)} options={DURATIONS} />}
            <TextField label="علت (در گزارش عملیات ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} error={error} autoFocus />
            {action === 'close' && <TextField label="برای تأیید «بستن» را بنویسید" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </div>
        </Dialog>
      )}
    </>
  );
}
