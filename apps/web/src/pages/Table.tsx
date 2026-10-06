import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { TableSnapshot } from '@bg/contracts';
import { Badge, Button, Dialog, Drawer, Icon, PlayerSeat, StateBlock, Timer, TurnIndicator, useToast } from '@bg/ui';
import { RENDERERS } from '../games/renderers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { useTableSession } from '../lib/useTableSession.ts';
import { ChatPanel } from '../social/ChatPanel.tsx';
import { InvitePanel } from '../social/InvitePanel.tsx';
import { ReportDialog } from '../social/ReportDialog.tsx';

function ReadyCountdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return <strong className="num" role="timer">{faNum(Math.floor(left / 60))}:{(left % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}</strong>;
}

type Lobby = TableSnapshot['table'];
const REASON_FA: Record<string, string> = { win: 'برد با چیدن سه نشان', draw: 'مساوی', score: 'پایان دورها و شمارش امتیاز', timeout: 'اتمام زمان', resign: 'انصراف' };

const seatNameOf = (t: Lobby) => (seat: number) => {
  const s = t.seats.find((x) => x.seat === seat);
  return s?.kind === 'script' ? 'حریف آموزشی' : s?.user?.displayName ?? `جایگاه ${faNum(seat + 1)}`;
};

function Policies({ table }: { table: Lobby }) {
  return (
    <section className="panel stack" aria-labelledby="pol-h" style={{ gap: 'var(--sp-2)' }}>
      <h2 id="pol-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}><Icon name="shield" />قوانین زمان و ترک میز</h2>
      <p className="policy"><strong>اتمام زمان: </strong>{table.policies.timeoutFa}</p>
      <p className="policy"><strong>انصراف: </strong>{table.policies.resignFa}</p>
      <p className="policy"><strong>قطع اتصال: </strong>{table.policies.disconnectFa}</p>
      {table.variants.map((v) => <p key={v.labelFa} className="policy"><strong>{v.labelFa}: </strong>{v.valueFa}</p>)}
    </section>
  );
}

function LobbyView({ snap, invite, onChange }: { snap: TableSnapshot; invite: string | null; onChange: (s: TableSnapshot) => void }) {
  const t = snap.table;
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const me = t.seats.find((s) => s.seat === t.mySeat);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(undefined);
    try { await fn(); } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); } finally { setBusy(false); }
  };
  const inviteLink = t.inviteCode ? `${location.origin}/tables/${t.id}?invite=${t.inviteCode}` : null;
  const empty = t.capacity - t.seats.length;

  return (
    <div className="lobby">
      <div className="stack">
        {t.isMatchmade && me && (
          <section className="panel stack cta-panel" aria-live="polite">
            <TurnIndicator tone="mine">حریف پیدا شد</TurnIndicator>
            <p style={{ margin: 0 }}>همه بازیکنان باید آمادگی را تأیید کنند.{t.readyDeadline && <> زمان باقی‌مانده: <ReadyCountdown until={t.readyDeadline} /></>}</p>
            <p className="muted" style={{ margin: 0 }}>اگر کسی تأیید نکند، کسانی که آماده بودند دوباره به صف برمی‌گردند.</p>
          </section>
        )}
        <section className="panel stack" aria-labelledby="seats-h">
          <h2 id="seats-h" className="section-title">بازیکنان ({faNum(t.seats.length)} از {faNum(t.capacity)})</h2>
          <div className="seats">
            {t.seats.map((s) => (
              <PlayerSeat key={s.seat} name={s.user?.displayName ?? '—'} avatarKey={s.user?.avatarKey ?? 'meeple'} me={s.seat === t.mySeat}
                label={s.ready ? 'آماده' : 'هنوز آماده نیست'} done={s.ready} />
            ))}
            {Array.from({ length: empty }, (_, i) => <div key={i} className="seat seat--empty">جایگاه خالی</div>)}
          </div>
          {empty > 0 && <p className="muted" style={{ margin: 0 }}>بازی وقتی شروع می‌شود که همه جایگاه‌ها پر و همه آماده باشند.</p>}
        </section>
        {inviteLink && (
          <section className="panel stack" aria-labelledby="inv-h" style={{ gap: 'var(--sp-2)' }}>
            <h2 id="inv-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>لینک دعوت</h2>
            <div className="row">
              <input className="input input--ltr" readOnly value={inviteLink} aria-label="لینک دعوت" onFocus={(e) => e.target.select()} style={{ flex: 1, minInlineSize: 0 }} />
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(inviteLink).then(() => toast('success', 'لینک دعوت کپی شد.'), () => toast('error', 'کپی ممکن نشد؛ لینک را دستی انتخاب کنید.'))}>کپی</Button>
            </div>
          </section>
        )}
      </div>
      <div className="stack">
        <Policies table={t} />
        <section className="panel stack">
          {error && <div className="banner banner--warn" role="alert" style={{ margin: 0 }}>{error}</div>}
          {!me ? (
            <Button busy={busy} onClick={() => run(async () => onChange(await api<TableSnapshot>(`/tables/${t.id}/join`, { method: 'POST', body: invite ? { inviteCode: invite } : {} })))}>
              پیوستن به میز
            </Button>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>با اعلام آمادگی، قوانین زمان و انصراف بالا را می‌پذیرید.</p>
              <Button busy={busy} variant={me.ready ? 'secondary' : 'primary'}
                onClick={() => run(async () => onChange(await api<TableSnapshot>(`/tables/${t.id}/ready`, { method: 'POST', body: { ready: !me.ready } })))}>
                {me.ready ? 'لغو آمادگی' : 'آماده‌ام'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run(async () => { await api(`/tables/${t.id}/leave`, { method: 'POST' }); navigate(t.isMatchmade ? '/play' : '/'); })}>{t.isMatchmade ? 'رد کردن' : 'ترک میز'}</Button>
            </>
          )}
        </section>
        {me && !t.isMatchmade && !t.isTutorial && <InvitePanel tableId={t.id} />}
        {me && !t.isTutorial && <section className="panel"><h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>گفت‌وگوی میز</h2><ChatPanel load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" compact /></section>}
      </div>
    </div>
  );
}

function RewardsSummary({ tableId, isTutorial }: { tableId: string; isTutorial: boolean }) {
  const r = useApi<{ rating: { before: number; after: number; provisional: boolean } | null; rewards: { ruleId: string; amount: number; reason: string }[]; processed: boolean }>(`/me/rewards?tableId=${tableId}`);
  const [tries, setTries] = useState(0);
  const reload = r.reload;
  // Rewards are computed by the worker shortly after the result; poll briefly, then stop.
  useEffect(() => {
    if (r.data?.processed || tries >= 10) return;
    const t = setTimeout(() => { setTries((n) => n + 1); reload(); }, 1500);
    return () => clearTimeout(t);
  }, [r.data, tries, reload]);
  if (!r.data) return null;
  if (!r.data.processed) return <p className="muted" style={{ margin: 0 }} role="status">{tries >= 10 ? 'پاداش‌ها بعداً در «پیشرفت» نمایش داده می‌شوند.' : 'در حال محاسبه پاداش…'}</p>;
  return (
    <div className="stack" style={{ gap: 'var(--sp-1)' }} aria-label="پاداش این بازی">
      {r.data.rating && <p style={{ margin: 0 }}>امتیاز رتبه‌دار: <strong className="num">{faNum(r.data.rating.before)} → {faNum(r.data.rating.after)}</strong>{r.data.rating.provisional ? ' (موقت)' : ''}</p>}
      {r.data.rewards.map((x, i) => <p key={i} style={{ margin: 0 }}>{x.amount > 0 ? `+${faNum(x.amount)} XP — ` : ''}{x.reason}</p>)}
      <Link to="/progress">{isTutorial ? 'پیشرفت من' : 'جزئیات پیشرفت و مأموریت‌ها'}</Link>
    </div>
  );
}

function ResultPanel({ snap }: { snap: TableSnapshot }) {
  const t = snap.table;
  const r = snap.game!.result!;
  const name = seatNameOf(t);
  const mine = r.placements.find((p) => p.seat === t.mySeat);
  const headline = t.isTutorial ? 'آموزش کامل شد' : !mine ? 'بازی تمام شد' : mine.place === 1 ? (r.placements.filter((p) => p.place === 1).length > 1 ? 'مساوی شد' : 'شما بردید') : 'این دست را باختید';
  return (
    <section className="panel stack result" aria-labelledby="res-h">
      <h2 id="res-h" className="page-title" style={{ fontSize: 'var(--fs-xl)' }}>{headline}</h2>
      <p className="muted" style={{ margin: 0 }}>علت پایان: {REASON_FA[r.reason] ?? r.reason}</p>
      {snap.game?.tutorial && <p style={{ margin: 0 }}>{snap.game.tutorial.instructionFa}</p>}
      <ol className="placements">
        {[...r.placements].sort((a, b) => a.place - b.place).map((p) => (
          <li key={p.seat}><span className="num">{faNum(p.place)}.</span> <bdi>{name(p.seat)}</bdi>{p.seat === t.mySeat ? ' (شما)' : ''}{p.score !== undefined ? ` — ${faNum(p.score)} امتیاز` : ''}</li>
        ))}
      </ol>
      {t.mySeat !== null && <RewardsSummary tableId={t.id} isTutorial={t.isTutorial} />}
      {t.competition === 'friendly' && !t.isTutorial && <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>میز دوستانه روی رتبه اثری ندارد.</p>}
      <div className="row">
        <Link className="btn btn--primary" to={`/games/${t.gameId}/new`}>{t.isTutorial ? 'ساخت میز واقعی' : 'میز تازه'}</Link>
        <Link className="btn btn--secondary" to="/">بازگشت به داشبورد</Link>
      </div>
    </section>
  );
}

function GameView({ s }: { s: ReturnType<typeof useTableSession> }) {
  const snap = s.snapshot!;
  const t = snap.table;
  const g = snap.game!;
  const navigate = useNavigate();
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [chat, setChat] = useState(false);
  const [reporting, setReporting] = useState(false);
  const Renderer = RENDERERS[t.clientBundleRef];
  const name = seatNameOf(t);
  const finished = t.status === 'finished';
  const canResign = !finished && g.legalActions.some((a) => a.type === 'resign');
  const myTurn = t.mySeat !== null && g.pendingSeats.includes(t.mySeat);
  const busy = !!s.pending || t.status !== 'active' || !!snap.incident;

  const tutorial = async (path: 'start' | 'skip') => {
    setTutorialBusy(true);
    try {
      if (path === 'skip') { await api(`/tutorials/${t.gameId}/skip`, { method: 'POST' }); navigate(`/games/${t.gameId}`); }
      else navigate(`/tables/${(await api<{ tableId: string }>(`/tutorials/${t.gameId}/start`, { method: 'POST', body: { restart: true } })).tableId}`);
    } finally { setTutorialBusy(false); }
  };

  const side = (
    <div className="stack">
      <section className="stack" aria-label="بازیکنان" style={{ gap: 'var(--sp-2)' }}>
        {t.seats.map((x) => (
          <PlayerSeat key={x.seat} name={name(x.seat)} avatarKey={x.user?.avatarKey ?? 'dice'} me={x.seat === t.mySeat}
            active={g.pendingSeats.includes(x.seat)} label={g.pendingSeats.includes(x.seat) ? 'در انتظار حرکت' : undefined} />
        ))}
      </section>
      <Policies table={t} />
      {canResign && <Button variant="danger" onClick={() => { setDrawer(false); setConfirmResign(true); }}>انصراف از بازی</Button>}
      {t.mySeat !== null && !t.isTutorial && <Button variant="ghost" onClick={() => { setDrawer(false); setReporting(true); }}>گزارش این میز</Button>}
    </div>
  );

  return (
    <div className="game">
      <div className="game__main stack">
        <div className="game__status row">
          {finished ? <TurnIndicator tone="done">بازی تمام شد</TurnIndicator>
            : t.mySeat === null ? <Badge>تماشاگر</Badge>
              : myTurn ? null : <TurnIndicator tone="wait">منتظر حرکت دیگران</TurnIndicator>}
          {g.deadline && !finished && (g.deadline.frozen
            ? <Badge tone="danger" icon="clock">زمان منجمد (توقف سراسری)</Badge>
            : <Timer deadline={new Date(new Date(g.deadline.dueAt).getTime() - s.clockOffset)} label="مهلت نوبت" lowSeconds={t.pace === 'live' ? 10 : 3600} />)}
          <span className={`conn ${s.live ? 'conn--on' : 'conn--off'}`} role="status">
            <Icon name={s.live ? 'turn' : 'offline'} size={16} />{s.live ? 'متصل' : 'اتصال زنده برقرار نیست؛ با هر اقدام به‌روز می‌شود'}
          </span>
          <Button className="game__drawer-btn" variant="secondary" size="sm" icon="players" onClick={() => setDrawer(true)}>بازیکنان و قوانین</Button>
          {t.mySeat !== null && !t.isTutorial && <Button variant="secondary" size="sm" icon="card" onClick={() => setChat(true)}>گفت‌وگوی میز</Button>}
        </div>

        {snap.incident && <div className="banner banner--warn" role="status" style={{ margin: 0 }}><Icon name="alert" />توقف سراسری: {snap.incident.reasonFa}. موعدها پس از رفع مشکل جبران می‌شوند.</div>}
        {s.notice && <div className="banner banner--warn" role="alert" style={{ margin: 0 }}>{s.notice} <Button variant="ghost" size="sm" onClick={() => s.setNotice(null)}>باشه</Button></div>}
        {s.pending && (
          <div className="banner banner--info" role="status" style={{ margin: 0 }}>
            {s.pending.status === 'sending' ? <><span className="spinner" aria-hidden /> در حال ارسال حرکت…</> : (
              <>
                <Icon name="clock" /> در انتظار تأیید: پاسخ سرور نرسید. وضعیت حرکت پیگیری می‌شود.
                <Button size="sm" variant="secondary" onClick={s.resendPending}>ارسال دوباره همین حرکت</Button>
                <Button size="sm" variant="ghost" onClick={s.dropPending}>نمایش آخرین وضعیت</Button>
              </>
            )}
          </div>
        )}

        {g.tutorial && !finished && (
          <section className="panel tutorial" aria-labelledby="tut-h">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="tut-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}><Icon name="book" />آموزش — مرحله {faNum(Math.min(g.tutorial.step + 1, g.tutorial.total))} از {faNum(g.tutorial.total)}</h2>
              <div className="row">
                <Button size="sm" variant="ghost" disabled={tutorialBusy} onClick={() => tutorial('start')}>از اول</Button>
                <Button size="sm" variant="ghost" disabled={tutorialBusy} onClick={() => tutorial('skip')}>رد کردن آموزش</Button>
              </div>
            </div>
            {g.tutorial.step === 0 && <p className="muted" style={{ margin: 0 }}>{g.tutorial.introFa}</p>}
            <p style={{ margin: 0, fontWeight: 700 }}>{g.tutorial.instructionFa}</p>
          </section>
        )}

        {finished && g.result && <ResultPanel snap={snap} />}

        <div className="game__board">
          {Renderer
            ? <Renderer view={g.view as never} legalActions={g.legalActions} mySeat={t.mySeat} seatName={name} busy={busy} onAction={s.act} expected={g.tutorial?.expected ?? null} />
            : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست">این میز با نسخه <bdi dir="ltr">{t.clientBundleRef}</bdi> شروع شده است که در این نسخه از برنامه وجود ندارد.</StateBlock>}
        </div>
      </div>
      <aside className="game__side" aria-label="بازیکنان و قوانین">{side}</aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="بازیکنان و قوانین">{side}</Drawer>
      {/* Chat never interrupts the board: it lives in a drawer on every screen size. */}
      <Drawer open={chat} onClose={() => setChat(false)} title="گفت‌وگوی میز">{chat && <ChatPanel load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" compact />}</Drawer>
      {reporting && <ReportDialog targetType="table" targetId={t.id} label="میز" onClose={() => setReporting(false)} />}
      <Dialog open={confirmResign} onClose={() => setConfirmResign(false)} title="انصراف از بازی؟"
        footer={<><Button variant="ghost" onClick={() => setConfirmResign(false)}>ادامه بازی</Button>
          <Button variant="danger" onClick={() => { setConfirmResign(false); s.act({ type: 'resign' }); }}>انصراف قطعی</Button></>}>
        {t.policies.resignFa} این کار قابل بازگشت نیست.
      </Dialog>
    </div>
  );
}

export function TablePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const invite = params.get('invite');
  const { me, status } = useSession();
  const s = useTableSession(id, invite);
  const snap = s.snapshot;
  usePageTitle(snap ? `${snap.table.isTutorial ? 'آموزش' : 'میز'} ${snap.table.gameNameFa}` : 'میز');

  if (status !== 'loading' && !me) {
    return <StateBlock kind="denied" title="برای دیدن میز وارد شوید" action={<Link className="btn btn--primary" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>ورود</Link>} />;
  }
  if (s.loadError?.status === 403) return <StateBlock kind="denied" title="به این میز دسترسی ندارید">این میز خصوصی است. برای پیوستن، از میزبان لینک دعوت بگیرید.</StateBlock>;
  if (s.loadError?.status === 404) return <StateBlock kind="empty" title="این میز پیدا نشد" action={<Link className="btn btn--secondary" to="/tables">میزهای باز</Link>} />;
  if (s.loadError && !snap) return <StateBlock kind="error" title="میز بارگذاری نشد" action={<Button onClick={() => void s.reload()}>تلاش دوباره</Button>}>{s.loadError.messageFa}</StateBlock>;
  if (!snap) return <StateBlock kind="loading" title="در حال بارگذاری میز…" />;

  const t = snap.table;
  return (
    <>
      <div className="page-head" style={{ marginBlockEnd: 'var(--sp-4)' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--fs-xl)' }}>{t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa}</h1>
          <p className="page-sub">
            {t.isTutorial ? 'میز آموزشی بدون زمان و بدون اثر بر رتبه' : `${PACE_FA[t.pace]} · ${t.visibility === 'private' ? 'خصوصی' : 'عمومی'} · دوستانه · ${durationFa(t.settings.turnSeconds)} برای هر نوبت`}
          </p>
        </div>
      </div>
      {t.status === 'cancelled' ? <StateBlock kind="empty" title="این میز لغو شده است" action={<Link className="btn btn--secondary" to="/">بازگشت</Link>} />
        : t.status === 'open' ? <LobbyView snap={snap} invite={invite} onChange={s.accept} />
          : snap.game ? <GameView s={s} /> : <StateBlock kind="loading" title="در حال آماده‌سازی بازی…" />}
    </>
  );
}
