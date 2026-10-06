import { useState } from 'react';
import { Link } from 'react-router';
import type { GameDetail, GameSummary } from '@bg/contracts';
import { Badge, Button, DataTable, Dialog, Input, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { GameAccessAdmin, MissionsAdmin, PlansAdmin, SeasonsAdmin, SupportAdmin } from './AdminCommerce.tsx';
import { GameSettingsAdmin } from './AdminGameSettings.tsx';

const STATUS_FA: Record<GameSummary['status'], string> = { draft: 'پیش‌نویس', active: 'فعال', suspended: 'متوقف' };

export function Admin() {
  usePageTitle('مدیریت');
  const { me, status } = useSession();
  const isAdmin = !!me?.roles.includes('admin');
  const games = useApi<{ items: GameSummary[] }>(isAdmin ? '/admin/games' : null);
  const toast = useToast();
  const [target, setTarget] = useState<GameSummary | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me) return <StateBlock kind="denied" title="ابتدا وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/admin">ورود</Link>} />;
  if (!isAdmin) return <StateBlock kind="denied" title="دسترسی ندارید">این بخش فقط برای مدیر محصول است.</StateBlock>;

  const nextStatus = target?.status === 'active' ? 'suspended' : 'active';
  const submit = async () => {
    if (!target) return;
    setBusy(true); setError(undefined);
    try {
      await api<GameDetail>(`/admin/games/${target.id}`, { method: 'PATCH', body: { status: nextStatus, reason } });
      toast('success', nextStatus === 'suspended' ? `پذیرش میز جدید برای «${target.nameFa}» متوقف شد.` : `«${target.nameFa}» دوباره فعال شد.`);
      setTarget(null); setReason(''); games.reload();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.messageFa : 'تغییر انجام نشد.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">مدیریت بازی‌ها</h1>
          <p className="page-sub">توقف بازی فقط پذیرش میز جدید را می‌بندد؛ سابقه و میزهای جاری حذف نمی‌شوند. هر تغییر با علت ثبت می‌شود.</p>
        </div>
      </div>
      {games.loading && !games.data && <StateBlock kind="loading" title="در حال بارگذاری…" />}
      {games.error && <StateBlock kind="error" title="فهرست بارگذاری نشد" action={<Button onClick={games.reload}>تلاش دوباره</Button>}>{games.error.messageFa}</StateBlock>}
      {games.data && (
        <DataTable caption="بازی‌ها و وضعیت انتشار" rowKey={(g) => g.id} rows={games.data.items} columns={[
          { key: 'name', title: 'بازی', render: (g) => <><strong>{g.nameFa}</strong> <bdi className="muted">{g.nameOriginal}</bdi></> },
          { key: 'status', title: 'وضعیت', render: (g) => <Badge tone={g.status === 'active' ? 'success' : 'danger'}>{STATUS_FA[g.status]}</Badge> },
          { key: 'tutorial', title: 'آموزش', render: (g) => <TutorialToggle game={g} onDone={games.reload} /> },
          { key: 'action', title: 'اقدام', render: (g) => (
            <Button size="sm" variant={g.status === 'active' ? 'danger' : 'secondary'} onClick={() => { setTarget(g); setError(undefined); }}>
              {g.status === 'active' ? 'توقف میز جدید' : 'فعال‌سازی'}
            </Button>
          ) }
        ]} />
      )}
      {games.data && <section className="section" style={{ marginBlockStart: 'var(--sp-6)' }}>
        <h2 className="section-title">نسخه‌های قوانین</h2>
        <p className="muted" style={{ margin: 0 }}>فقط میزهای تازه از نسخه فعال استفاده می‌کنند؛ میزهای جاری روی نسخه شروع خود می‌مانند.</p>
        {games.data.items.map((g) => <Versions key={g.id} gameId={g.id} name={g.nameFa} />)}
      </section>}
      {games.data && games.data.items.length > 0 && <GameSettingsAdmin games={games.data.items} />}
      {games.data && <GameAccessAdmin games={games.data.items} onDone={games.reload} />}
      <PlansAdmin />
      <SeasonsAdmin />
      <MissionsAdmin />
      <SupportAdmin />
      <IncidentPanel />
      <Dialog open={!!target} onClose={() => setTarget(null)} title={nextStatus === 'suspended' ? 'توقف پذیرش میز جدید' : 'فعال‌سازی دوباره'}
        footer={<>
          <Button variant="ghost" onClick={() => setTarget(null)}>انصراف</Button>
          <Button variant={nextStatus === 'suspended' ? 'danger' : 'primary'} busy={busy} disabled={reason.trim().length < 3} onClick={submit}>
            {nextStatus === 'suspended' ? 'توقف میز جدید' : 'فعال‌سازی'}
          </Button>
        </>}>
        <div className="stack">
          <p style={{ margin: 0 }}>«{target?.nameFa}»</p>
          <Input label="علت (در گزارش عملیات ثبت می‌شود)" value={reason} onChange={(e) => setReason(e.target.value)} error={error} />
        </div>
      </Dialog>
    </>
  );
}

function TutorialToggle({ game, onDone }: { game: GameSummary; onDone: () => void }) {
  const toast = useToast();
  const toggle = async () => {
    try {
      await api(`/admin/games/${game.id}/tutorial`, { method: 'PATCH', body: { enabled: !game.tutorialEnabled, reason: 'admin panel' } });
      toast('success', game.tutorialEnabled ? 'آموزش غیرفعال شد.' : 'آموزش فعال شد.');
      onDone();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  return <Button size="sm" variant="ghost" onClick={toggle}>{game.tutorialEnabled ? 'فعال — غیرفعال کن' : 'غیرفعال — فعال کن'}</Button>;
}

interface Version { id: string; rulesVersion: string; status: 'active' | 'retired' | 'disabled'; inRegistry: boolean; publishedAt: string }
const VERSION_FA = { active: 'فعال برای میز تازه', retired: 'بازنشسته', disabled: 'غیرفعال' } as const;

function Versions({ gameId, name }: { gameId: string; name: string }) {
  const v = useApi<{ items: Version[] }>(`/admin/game-versions?gameId=${gameId}`);
  const toast = useToast();
  const set = async (id: string, status: Version['status']) => {
    try { await api(`/admin/game-versions/${id}`, { method: 'PATCH', body: { status, reason: 'admin panel' } }); toast('success', 'وضعیت نسخه ذخیره شد.'); v.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  if (!v.data) return null;
  return (
    <div className="panel stack" style={{ gap: 'var(--sp-2)' }}>
      <strong>{name}</strong>
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
    <section className="panel stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="incident-h">
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
