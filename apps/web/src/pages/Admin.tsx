import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { GameDetail, GameSummary } from '@bg/contracts';
import { Badge, Button, Dialog, Input, Segmented, StateBlock, Switch, Tabs, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { GameCover } from '../games/covers.tsx';
import { faNum } from '../lib/format.ts';
import { GameAccess, MissionsAdmin, PlansAdmin, SeasonsAdmin, SupportAdmin } from './AdminCommerce.tsx';
import { GameSettingsAdmin } from './AdminGameSettings.tsx';

const STATUS_FA: Record<GameSummary['status'], string> = { draft: 'پیش‌نویس', active: 'فعال', suspended: 'متوقف' };

export function Admin() {
  usePageTitle('مدیریت');
  const { me, status } = useSession();
  const isAdmin = !!me?.roles.includes('admin');
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me) return <StateBlock kind="denied" title="ابتدا وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/admin">ورود</Link>} />;
  if (!isAdmin) return <StateBlock kind="denied" title="دسترسی ندارید">این بخش فقط برای مدیر محصول است.</StateBlock>;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">مدیریت</h1>
        <p className="page-sub">هر تغییر با علت در گزارش عملیات ثبت می‌شود.</p></div></div>
      <Tabs label="بخش‌های مدیریت" tabs={[
        { id: 'games', title: 'بازی‌ها', content: <GamesAdmin /> },
        { id: 'progress', title: 'مأموریت و فصل', content: <><MissionsAdmin /><SeasonsAdmin /></> },
        { id: 'plans', title: 'اشتراک', content: <PlansAdmin /> },
        { id: 'support', title: 'پشتیبانی', content: <SupportAdmin /> },
        { id: 'incident', title: 'توقف سراسری', content: <IncidentPanel /> }
      ]} />
    </>
  );
}

type StatusFilter = 'all' | GameSummary['status'];
const norm = (x: string) => x.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/** Pick a game on one side, manage everything about it on the other: status, tutorial, access, play settings, versions. */
function GamesAdmin() {
  const games = useApi<{ items: GameSummary[] }>('/admin/games');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  if (games.error) return <StateBlock kind="error" title="فهرست بارگذاری نشد" action={<Button onClick={games.reload}>تلاش دوباره</Button>}>{games.error.messageFa}</StateBlock>;
  if (!games.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const all = games.data.items;
  const selected = all.find((g) => g.id === params.get('game'));
  const select = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('game', id); else n.delete('game'); return n; });
  const shown = all.filter((g) => (filter === 'all' || g.status === filter) && (!q.trim() || norm(`${g.nameFa} ${g.nameOriginal} ${g.id}`).includes(norm(q.trim()))));
  const count = (st: StatusFilter) => (st === 'all' ? all.length : all.filter((g) => g.status === st).length);
  return (
    <div className={`admin-games${selected ? ' has-selection' : ''}`}>
      <section className="panel stack admin-games__list" aria-labelledby="admin-games-h">
        <h2 id="admin-games-h" className="section-title">بازی‌ها <span className="muted num">({faNum(all.length)})</span></h2>
        <Input label="جست‌وجو" value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام فارسی یا اصلی" />
        <Segmented legend="وضعیت" name="admin-status" value={filter} onChange={setFilter}
          options={(['all', 'active', 'suspended', 'draft'] as const).map((st) => ({ value: st, label: `${st === 'all' ? 'همه' : STATUS_FA[st]} (${faNum(count(st))})` }))} />
        {shown.length === 0 ? <p className="muted" style={{ margin: 0 }}>بازی‌ای پیدا نشد.</p> : (
          <ul className="admin-games__items">{shown.map((g) => (
            <li key={g.id}>
              <button type="button" className={`admin-game${selected?.id === g.id ? ' is-on' : ''}`} aria-current={selected?.id === g.id || undefined} onClick={() => select(g.id)}>
                <span className="admin-game__cover"><GameCover gameId={g.id} title="" /></span>
                <span className="admin-game__name"><strong>{g.nameFa}</strong><span className="muted"><bdi>{g.nameOriginal}</bdi></span></span>
                <span className="admin-game__badges">
                  {g.status !== 'active' && <Badge tone="danger">{STATUS_FA[g.status]}</Badge>}
                  {g.access === 'premium' && <Badge tone="premium">پریمیوم</Badge>}
                </span>
              </button>
            </li>))}</ul>
        )}
      </section>
      <div className="admin-games__detail">
        {selected ? <GameDetailAdmin key={selected.id} game={selected} onBack={() => select(null)} onChanged={games.reload} />
          : <div className="panel"><StateBlock kind="empty" title="یک بازی انتخاب کنید">وضعیت، آموزش، دسترسی، تنظیمات بازی و نسخه‌های قوانین آن اینجا نمایش داده می‌شود.</StateBlock></div>}
      </div>
    </div>
  );
}

function GameDetailAdmin({ game, onBack, onChanged }: { game: GameSummary; onBack: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const nextStatus = game.status === 'active' ? 'suspended' : 'active';
  const submit = async () => {
    setBusy(true); setError(undefined);
    try {
      await api<GameDetail>(`/admin/games/${game.id}`, { method: 'PATCH', body: { status: nextStatus, reason } });
      toast('success', nextStatus === 'suspended' ? `پذیرش میز جدید برای «${game.nameFa}» متوقف شد.` : `«${game.nameFa}» دوباره فعال شد.`);
      setOpen(false); setReason(''); onChanged();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.messageFa : 'تغییر انجام نشد.');
    } finally { setBusy(false); }
  };
  const toggleTutorial = async (enabled: boolean) => {
    try {
      await api(`/admin/games/${game.id}/tutorial`, { method: 'PATCH', body: { enabled, reason: 'admin panel' } });
      toast('success', enabled ? 'آموزش فعال شد.' : 'آموزش غیرفعال شد.');
      onChanged();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  return (
    <div className="stack">
      <div className="admin-games__back"><Button variant="ghost" size="sm" onClick={onBack}>بازگشت به فهرست بازی‌ها</Button></div>
      <section className="panel admin-head" aria-labelledby="admin-game-h">
        <span className="admin-head__cover"><GameCover gameId={game.id} title="" /></span>
        <div className="stack" style={{ gap: 'var(--sp-1)', flex: 1, minInlineSize: 0 }}>
          <h2 id="admin-game-h" className="section-title" style={{ margin: 0 }}>{game.nameFa}</h2>
          <span className="muted"><bdi>{game.nameOriginal}</bdi></span>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone={game.status === 'active' ? 'success' : 'danger'}>{STATUS_FA[game.status]}</Badge>
            <Link to={`/games/${game.id}`}>صفحهٔ بازی</Link>
          </div>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="admin-quick-h">
        <h2 id="admin-quick-h" className="section-title">وضعیت و دسترسی</h2>
        <div className="admin-quick">
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <strong>پذیرش میز جدید</strong>
            <span className="muted">توقف فقط میز جدید را می‌بندد؛ سابقه و میزهای جاری می‌مانند.</span>
            <div><Button size="sm" variant={game.status === 'active' ? 'danger' : 'primary'} onClick={() => { setOpen(true); setError(undefined); }}>
              {game.status === 'active' ? 'توقف میز جدید' : 'فعال‌سازی'}</Button></div>
          </div>
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <strong>آموزش تعاملی</strong>
            <Switch label={game.tutorialEnabled ? 'فعال' : 'غیرفعال'} checked={game.tutorialEnabled} onChange={(v) => void toggleTutorial(v)} />
          </div>
          <GameAccess game={game} onDone={onChanged} />
        </div>
      </section>

      <GameSettingsAdmin gameId={game.id} />

      <section className="panel stack" aria-labelledby="admin-versions-h">
        <h2 id="admin-versions-h" className="section-title">نسخه‌های قوانین</h2>
        <p className="muted" style={{ margin: 0 }}>فقط میزهای تازه از نسخه فعال استفاده می‌کنند؛ میزهای جاری روی نسخه شروع خود می‌مانند.</p>
        <Versions gameId={game.id} />
      </section>

      <Dialog open={open} onClose={() => setOpen(false)} title={nextStatus === 'suspended' ? 'توقف پذیرش میز جدید' : 'فعال‌سازی دوباره'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
          <Button variant={nextStatus === 'suspended' ? 'danger' : 'primary'} busy={busy} disabled={reason.trim().length < 3} onClick={submit}>
            {nextStatus === 'suspended' ? 'توقف میز جدید' : 'فعال‌سازی'}
          </Button>
        </>}>
        <div className="stack">
          <p style={{ margin: 0 }}>«{game.nameFa}»</p>
          <Input label="علت (در گزارش عملیات ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} error={error} />
        </div>
      </Dialog>
    </div>
  );
}

interface Version { id: string; rulesVersion: string; status: 'active' | 'retired' | 'disabled'; inRegistry: boolean; publishedAt: string }
const VERSION_FA = { active: 'فعال برای میز تازه', retired: 'بازنشسته', disabled: 'غیرفعال' } as const;

function Versions({ gameId }: { gameId: string }) {
  const v = useApi<{ items: Version[] }>(`/admin/game-versions?gameId=${gameId}`);
  const toast = useToast();
  const set = async (id: string, status: Version['status']) => {
    try { await api(`/admin/game-versions/${id}`, { method: 'PATCH', body: { status, reason: 'admin panel' } }); toast('success', 'وضعیت نسخه ذخیره شد.'); v.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  if (!v.data) return null;
  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <ul className="list">{v.data.items.map((x) => (
        <li key={x.id} className="list__item list__item--compact">
          <bdi dir="ltr" style={{ fontWeight: 700 }}>{x.rulesVersion}</bdi>
          <Badge tone={x.status === 'active' ? 'success' : undefined}>{VERSION_FA[x.status]}</Badge>
          {!x.inRegistry && <Badge tone="danger">در این نسخه برنامه موجود نیست</Badge>}
          <span style={{ flex: 1 }} />
          {x.status !== 'active' && x.inRegistry && <Button size="sm" variant="secondary" onClick={() => set(x.id, 'active')}>فعال‌سازی</Button>}
          {x.status === 'active' && <Button size="sm" variant="ghost" onClick={() => set(x.id, 'retired')}>بازنشسته</Button>}
        </li>))}</ul>
    </div>
  );
}

function IncidentPanel() {
  const status = useApi<{ incident: { reasonFa: string; startedAt: string } | null }>('/status');
  const toast = useToast();
  const [reason, setReason] = useState('');
  const call = async (path: string, body?: object) => {
    try { await api(path, { method: 'POST', ...(body ? { body } : {}) }); status.reload(); setReason(''); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  if (!status.data) return null;
  return (
    <section className="panel stack" aria-labelledby="incident-h">
      <h2 id="incident-h" className="section-title">توقف سراسری</h2>
      <p className="muted" style={{ margin: 0 }}>در توقف سراسری موعد نوبت‌ها منجمد و پس از رفع، به اندازه مدت توقف تمدید می‌شود. قطع اینترنت یک بازیکن توقف سراسری نیست.</p>
      {status.data.incident ? (
        <div className="row"><Badge tone="danger">فعال: {status.data.incident.reasonFa}</Badge><Button onClick={() => call('/admin/incidents/close')}>پایان توقف و جبران زمان</Button></div>
      ) : (
        <div className="row" style={{ alignItems: 'end' }}>
          <div style={{ flex: 1, minInlineSize: 200 }}><Input label="علت" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button variant="danger" disabled={reason.trim().length < 3} onClick={() => call('/admin/incidents', { reasonFa: reason })}>شروع توقف سراسری</Button>
        </div>
      )}
    </section>
  );
}
