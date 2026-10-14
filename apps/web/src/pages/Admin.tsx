import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { GameDetail, GameSummary } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Badge, Banner, Button, Card, ChipGroup, Dialog, Icon, PageHead, PageTabs, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { faNum } from '../lib/format.ts';
import { GameAccess, MissionsAdmin, PlansAdmin, ReferralAdmin, SeasonsAdmin, SupportAdmin, WelcomePremiumAdmin } from './AdminCommerce.tsx';
import { GameSettingsAdmin } from './AdminGameSettings.tsx';
import { PlayersAdmin } from './AdminPlayers.tsx';
import { SiteAdmin } from './AdminSite.tsx';
import { TournamentsAdmin } from './AdminTournaments.tsx';

const STATUS_FA: Record<GameSummary['status'], string> = { draft: 'پیش‌نویس', active: 'فعال', suspended: 'متوقف' };
const TABS = [
  { value: 'games', label: 'بازی‌ها' }, { value: 'players', label: 'بازیکنان' }, { value: 'progress', label: 'مأموریت و فصل' }, { value: 'tournaments', label: 'تورنمنت‌ها' }, { value: 'plans', label: 'اشتراک و سکه' },
  { value: 'referral', label: 'دعوت دوستان' }, { value: 'support', label: 'پشتیبانی' }, { value: 'site', label: 'صفحه‌های سایت' }, { value: 'incident', label: 'توقف سراسری' }
];

export function Admin() {
  usePageTitle('مدیریت');
  const { me, status } = useSession();
  const [tab, setTab] = useState('games');
  const isAdmin = !!me?.roles.includes('admin');
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me) return <StateBlock kind="denied" title="ابتدا وارد شوید" action={<Button variant="primary" href="/login?next=/admin">ورود</Button>} />;
  if (!isAdmin) return <StateBlock kind="denied" title="دسترسی ندارید" text="این بخش فقط برای مدیر محصول است." />;
  return (
    <>
      <PageTabs label="بخش‌های مدیریت" items={TABS} value={tab} onChange={setTab} />
      <PageHead title="مدیریت" sub="هر تغییر با علت در گزارش عملیات ثبت می‌شود." />
      {tab === 'games' && <GamesAdmin />}
      {tab === 'players' && <PlayersAdmin />}
      {tab === 'progress' && <><MissionsAdmin /><SeasonsAdmin /></>}
      {tab === 'tournaments' && <TournamentsAdmin />}
      {tab === 'plans' && <><WelcomePremiumAdmin /><PlansAdmin /><PlansAdmin path="/admin/coin-packs" title="بسته‌های سکه و قیمت" /></>}
      {tab === 'referral' && <ReferralAdmin />}
      {tab === 'support' && <SupportAdmin />}
      {tab === 'site' && <SiteAdmin />}
      {tab === 'incident' && <IncidentPanel />}
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
  if (games.error) return <StateBlock kind="error" title="فهرست بارگذاری نشد" text={games.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={games.reload}>تلاش دوباره</Button>} />;
  if (!games.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const all = games.data.items;
  const selected = all.find((g) => g.id === params.get('game'));
  const select = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('game', id); else n.delete('game'); return n; });
  const shown = all.filter((g) => (filter === 'all' || g.status === filter) && (!q.trim() || norm(`${g.nameFa} ${g.nameOriginal} ${g.id}`).includes(norm(q.trim()))));
  const count = (st: StatusFilter) => (st === 'all' ? all.length : all.filter((g) => g.status === st).length);
  return (
    <div className={`ac-adm${selected ? ' has-selection' : ''}`}>
      <Card flush className="ac-adm__list" aria-labelledby="admin-games-h">
        <div className="ac-adm__pick">
          <h2 id="admin-games-h" className="ac-h3">بازی‌ها <span className="ac-cap" style={{ display: 'inline' }}>({faNum(all.length)})</span></h2>
          <TextField icon="search" type="search" aria-label="جست‌وجوی بازی" value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام فارسی یا اصلی" />
          <ChipGroup size="sm" label="وضعیت" value={filter} onChange={(v) => setFilter(v as StatusFilter)}
            options={(['all', 'active', 'suspended', 'draft'] as const).map((st) => ({ value: st, label: `${st === 'all' ? 'همه' : STATUS_FA[st]} (${faNum(count(st))})` }))} />
        </div>
        {shown.length === 0 ? <StateBlock kind="empty" title="بازی‌ای پیدا نشد" /> : shown.map((g) => (
          <button key={g.id} type="button" className={`ac-adminrow${selected?.id === g.id ? ' is-selected' : ''}`} aria-current={selected?.id === g.id || undefined} onClick={() => select(g.id)}>
            <span className="ac-adminrow__cover"><img src={`/covers/${g.id}.webp?v=2`} alt="" loading="lazy" /></span>
            <span className="ac-adminrow__name"><b>{g.nameFa}</b><bdi className="bgv-latin ac-cap">{g.nameOriginal}</bdi></span>
            {g.status !== 'active' && <Badge tone={g.status === 'draft' ? 'test' : 'danger'} size="sm" icon={g.status === 'draft' ? undefined : 'ban'}>{STATUS_FA[g.status]}</Badge>}
            {g.access === 'premium' && <Badge tone="premium" size="sm">پریمیوم</Badge>}
          </button>
        ))}
      </Card>
      <div className="ac-adm__detail">
        {selected ? <GameDetailAdmin key={selected.id} game={selected} onBack={() => select(null)} onChanged={games.reload} />
          : <Card><StateBlock kind="empty" title="یک بازی انتخاب کنید" text="وضعیت، آموزش، دسترسی، تنظیمات بازی و نسخه‌های قوانین آن اینجا نمایش داده می‌شود." /></Card>}
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
    <>
      <div className="ac-adm__back"><Button variant="ghost" size="sm" icon="arrow-right" onClick={onBack}>بازگشت به فهرست بازی‌ها</Button></div>
      <Card className="ac-head" aria-labelledby="admin-game-h">
        <span className="ac-head__cover"><img src={`/covers/${game.id}.webp?v=2`} alt="" /></span>
        <div className="ac-head__text">
          <div className="bgv-row" style={{ gap: 10 }}>
            <h2 id="admin-game-h" className="t-page-sm" style={{ color: 'var(--heading)', margin: 0 }}>{game.nameFa}</h2>
            <bdi className="bgv-latin ac-cap" dir="ltr">{game.nameOriginal}</bdi>
            <Badge tone={game.status === 'active' ? 'success' : 'danger'} icon={game.status === 'active' ? 'circle-check' : 'ban'}>{STATUS_FA[game.status]}</Badge>
          </div>
        </div>
        <Button size="sm" icon="arrow-up-right" href={`/games/${game.id}`}>صفحهٔ بازی</Button>
      </Card>

      <Card className="ac-sec" aria-labelledby="admin-quick-h">
        <div className="ac-sec__head"><span className="ac-tile"><Icon name="shield" /></span><h2 id="admin-quick-h" className="ac-h3">وضعیت و دسترسی</h2></div>
        <div className="ac-row">
          <div className="ac-row__text"><b>پذیرش میز جدید</b><span>توقف فقط میز جدید را می‌بندد؛ سابقه و میزهای جاری می‌مانند.</span></div>
          <Button size="sm" variant={game.status === 'active' ? 'danger' : 'primary'} onClick={() => { setOpen(true); setError(undefined); }}>
            {game.status === 'active' ? 'توقف میز جدید' : 'فعال‌سازی'}</Button>
        </div>
        <div className="ac-row">
          <div className="ac-row__text"><b>آموزش تعاملی</b></div>
          <Switch aria-label="آموزش تعاملی" checked={game.tutorialEnabled} onChange={(v) => void toggleTutorial(v)} />
        </div>
        <GameAccess game={game} onDone={onChanged} />
      </Card>

      <GameSettingsAdmin gameId={game.id} />

      <Card className="ac-sec" aria-labelledby="admin-versions-h">
        <div className="ac-sec__head"><span className="ac-tile"><Icon name="layers" /></span><h2 id="admin-versions-h" className="ac-h3">نسخه‌های قوانین</h2></div>
        <p className="ac-cap ac-pad">فقط میزهای تازه از نسخه فعال استفاده می‌کنند؛ میزهای جاری روی نسخه شروع خود می‌مانند.</p>
        <Versions gameId={game.id} />
      </Card>

      {open && (
        <Dialog modal danger={nextStatus === 'suspended'} title={nextStatus === 'suspended' ? 'توقف پذیرش میز جدید' : 'فعال‌سازی دوباره'} onClose={() => setOpen(false)}
          footer={<>
            <Button onClick={() => setOpen(false)}>انصراف</Button>
            <Button variant={nextStatus === 'suspended' ? 'danger' : 'primary'} loading={busy} disabled={reason.trim().length < 3} onClick={submit}>
              {nextStatus === 'suspended' ? 'توقف میز جدید' : 'فعال‌سازی'}
            </Button>
          </>}>
          <div className="ac-stack">
            <p style={{ margin: 0 }}>«{game.nameFa}»</p>
            <TextField label="علت (در گزارش عملیات ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} error={error} autoFocus />
          </div>
        </Dialog>
      )}
    </>
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
    <div>{v.data.items.map((x) => (
      <div key={x.id} className="ac-row">
        <bdi dir="ltr" className="bgv-latin" style={{ fontWeight: 700 }}>{x.rulesVersion}</bdi>
        <Badge tone={x.status === 'active' ? 'success' : undefined}>{VERSION_FA[x.status]}</Badge>
        {!x.inRegistry && <Badge tone="danger">در این نسخه برنامه موجود نیست</Badge>}
        <span className="bgv-spacer" />
        {x.status !== 'active' && x.inRegistry && <Button size="sm" onClick={() => set(x.id, 'active')}>فعال‌سازی</Button>}
        {x.status === 'active' && <Button size="sm" variant="ghost" onClick={() => set(x.id, 'retired')}>بازنشسته</Button>}
      </div>))}</div>
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
    <Card className="ac-sec" aria-labelledby="incident-h">
      <div className="ac-sec__head"><span className="ac-tile"><Icon name="triangle-alert" /></span><h2 id="incident-h" className="ac-h3">توقف سراسری</h2></div>
      <div className="ac-sec__body">
        <p className="t-body-sm" style={{ margin: 0 }}>در توقف سراسری موعد نوبت‌ها منجمد و پس از رفع، به اندازه مدت توقف تمدید می‌شود. قطع اینترنت یک بازیکن توقف سراسری نیست.</p>
        {status.data.incident ? (
          <div className="ac-stack"><Banner tone="danger" text={`فعال: ${status.data.incident.reasonFa}`} /><div><Button variant="primary" onClick={() => call('/admin/incidents/close')}>پایان توقف و جبران زمان</Button></div></div>
        ) : (
          <div className="ac-inline">
            <TextField label="علت" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" disabled={reason.trim().length < 3} onClick={() => call('/admin/incidents', { reasonFa: reason })}>شروع توقف سراسری</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
