import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { MessageItem, TableSnapshot } from '@bg/contracts';
import { ArrowRight, ChevronLeft, Dices, Flag, Hand, Hourglass, Maximize2, Medal, Minimize2, Trophy } from 'lucide-react';
import { Avatar, Badge, Button, Confetti, Dialog, Drawer, Icon, PlayerSeat, StateBlock, Timer, TurnIndicator, cn, useToast } from '@bg/ui';
import { RENDERERS } from '../games/renderers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { browserNotificationsEnabled } from '../lib/realtime.tsx';
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
const REASON_FA: Record<string, string> = { win: 'پیروزی', draw: 'مساوی', score: 'پایان دورها و شمارش امتیاز', timeout: 'اتمام زمان', resign: 'انصراف' };

const seatNameOf = (t: Lobby) => (seat: number) => {
  const s = t.seats.find((x) => x.seat === seat);
  return s?.kind === 'script' ? 'حریف آموزشی' : s?.user?.displayName ?? `جایگاه ${faNum(seat + 1)}`;
};

function Policies({ table, collapsible }: { table: Lobby; collapsible?: boolean }) {
  const rules = <>
      <p className="policy"><strong>اتمام زمان: </strong>{table.policies.timeoutFa}</p>
      <p className="policy"><strong>انصراف: </strong>{table.policies.resignFa}</p>
      <p className="policy"><strong>قطع اتصال: </strong>{table.policies.disconnectFa}</p>
      {table.variants.map((v) => <p key={v.labelFa} className="policy"><strong>{v.labelFa}: </strong>{v.valueFa}</p>)}
  </>;
  if (collapsible) {
    return (
      <details className="panel rules-box">
        <summary className="section-title" style={{ fontSize: 'var(--fs-md)' }}><Icon name="shield" />قوانین زمان و ترک میز</summary>
        <div className="stack" style={{ gap: 'var(--sp-2)', marginBlockStart: 'var(--sp-3)' }}>{rules}</div>
      </details>
    );
  }
  return (
    <section className="panel stack" aria-labelledby="pol-h" style={{ gap: 'var(--sp-2)' }}>
      <h2 id="pol-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}><Icon name="shield" />قوانین زمان و ترک میز</h2>
      {rules}
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
              <PlayerSeat key={s.seat} name={s.user?.displayName ?? '-'} avatarKey={s.user?.avatarKey ?? 'meeple'} me={s.seat === t.mySeat}
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
      {r.data.rewards.map((x, i) => <p key={i} style={{ margin: 0 }}>{x.amount > 0 ? `+${faNum(x.amount)} XP: ` : ''}{x.reason}</p>)}
      <Link to="/progress">{isTutorial ? 'پیشرفت من' : 'جزئیات پیشرفت و مأموریت‌ها'}</Link>
    </div>
  );
}

function ResultPanel({ snap }: { snap: TableSnapshot }) {
  const t = snap.table;
  const r = snap.game!.result!;
  const name = seatNameOf(t);
  const mine = r.placements.find((p) => p.seat === t.mySeat);
  // A shared first place under reason 'win' is a shared victory (a cooperative team, or everyone but a single loser);
  // otherwise a shared first place is a draw.
  const sharedWin = r.reason === 'win';
  const headline = t.isTutorial ? 'آموزش کامل شد' : !mine ? 'بازی تمام شد' : mine.place === 1 ? (r.placements.filter((p) => p.place === 1).length > 1 && !sharedWin ? 'مساوی شد' : 'شما بردید') : 'این دست را باختید';
  const won = !t.isTutorial && headline === 'شما بردید';
  return (
    <section className={cn('panel stack result relative isolate overflow-hidden animate-fade-up', won && 'ring-2 ring-brand')} aria-labelledby="res-h">
      {won && <Confetti count={80} colors={['var(--brand)', 'var(--primary)', '#e9c46a', '#d1495b', '#3d8bd4']} />}
      <div className="flex items-center gap-3">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-field shadow-control animate-pop', won ? 'bg-brand text-brand-foreground' : 'bg-secondary text-muted-foreground')}>
          {won ? <Trophy className="size-6" aria-hidden /> : <Medal className="size-6" aria-hidden />}
        </span>
        <h2 id="res-h" className="page-title" style={{ fontSize: 'var(--fs-xl)' }}>{headline}</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>علت پایان: {REASON_FA[r.reason] ?? r.reason}</p>
      {snap.game?.tutorial && <p style={{ margin: 0 }}>{snap.game.tutorial.instructionFa}</p>}
      <ol className="placements">
        {[...r.placements].sort((a, b) => a.place - b.place).map((p) => (
          <li key={p.seat} className={cn(p.seat === t.mySeat && 'font-bold')}><span className={cn('num inline-flex size-7 items-center justify-center rounded-full text-xs', p.place === 1 ? 'bg-brand text-brand-foreground' : 'bg-secondary')}>{faNum(p.place)}</span><span><bdi>{name(p.seat)}</bdi>{p.seat === t.mySeat ? ' (شما)' : ''}{p.score !== undefined ? `، ${faNum(p.score)} امتیاز` : ''}</span></li>
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

/** Seat colours (BGA-style player colours). Used for stripes and rings only, never for text, so contrast holds in both themes. */
const SEAT_COLORS = ['#d1495b', '#2f80c8', '#e0a030', '#3c9d61', '#8e5cc2', '#d36aa0', '#1f9ca6', '#7f8c8d', '#c46a2d', '#5b6bd6'];

/** While a game is on the table the shell steps aside (no sidebar or dock): the table is the whole screen. */
function useImmersive() {
  useEffect(() => {
    document.documentElement.dataset.immersive = 'true';
    return () => { delete document.documentElement.dataset.immersive; };
  }, []);
}

function PlayerBoards({ snap, strip }: { snap: TableSnapshot; strip?: boolean }) {
  const t = snap.table;
  const g = snap.game!;
  const name = seatNameOf(t);
  return (
    <ol className={cn('pboards', strip && 'pboards--strip')} aria-label="بازیکنان">
      {t.seats.map((x) => {
        const active = g.pendingSeats.includes(x.seat) && t.status === 'active';
        const me = x.seat === t.mySeat;
        return (
          <li key={x.seat} className={cn('pboard', active && 'pboard--active', me && 'pboard--me')} aria-current={active ? 'true' : undefined}
            style={{ '--seat': SEAT_COLORS[x.seat % SEAT_COLORS.length] } as React.CSSProperties}>
            <span className="pboard__ring"><Avatar avatarKey={x.user?.avatarKey ?? 'dice'} name={name(x.seat)} size={strip ? 34 : 42} /></span>
            <span className="pboard__who">
              <span className="pboard__name"><bdi>{name(x.seat)}</bdi>{me && <span className="pboard__you"> (شما)</span>}</span>
              <span className="pboard__state">{active ? 'در انتظار حرکت' : x.kind === 'script' ? 'حریف آموزشی' : me ? 'پشت میز' : 'آماده'}</span>
            </span>
            {active && <ChevronLeft className="pboard__turn" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Table chat alerts while the chat drawer is closed: unread count for the chat button, a short toast with the sender
 * and text, and (if enabled in settings) a browser notification when the tab is hidden. Returns the unread count.
 */
function useTableChatAlerts(tableId: string | null, open: boolean): number {
  const { me } = useSession();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [conversationId, setConversationId] = useState<string>();
  useEffect(() => {
    if (!tableId) return;
    api<{ conversationId: string }>(`/tables/${tableId}/chat`).then((r) => setConversationId(r.conversationId), () => { /* chat unavailable */ });
  }, [tableId]);
  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => {
    if (!conversationId) return;
    const on = (e: Event) => {
      const m = (e as CustomEvent<MessageItem>).detail;
      if (m.conversationId !== conversationId || m.sender.id === me?.id || m.deleted || open) return;
      setUnread((n) => n + 1);
      const text = `${m.sender.displayName}: ${m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body}`;
      toast('info', `پیام در میز — ${text}`);
      if (document.hidden && browserNotificationsEnabled()) {
        try { new Notification('گفت‌وگوی میز', { body: text, tag: m.id, lang: 'fa', dir: 'rtl' }); } catch { /* unsupported */ }
      }
    };
    window.addEventListener('bg:message', on);
    return () => window.removeEventListener('bg:message', on);
  }, [conversationId, me?.id, open, toast]);
  return unread;
}

/**
 * Fullscreen for the game screen. The game container itself goes fullscreen and scrolls on its own: browsers may
 * force `overflow: hidden` on a fullscreen <html>, which hid the board below the fold. Dialogs and drawers are
 * native modal <dialog>s in the top layer, so they still show above it. `supported` is false where the API is
 * missing (e.g. iPhone Safari); leaving the table exits fullscreen.
 */
/**
 * Full screen for the game container. Uses the Fullscreen API where it exists; where it does not (iPhone Safari) or the
 * browser refuses, the game is laid over the whole window instead (`.game--max`), so the button always does something.
 */
function useFullscreen(target: RefObject<HTMLElement | null>) {
  const api = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const [native, setNative] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const [max, setMax] = useState(false);
  // On entering, bring the board to the top of the screen: on phones the status strip and panels would push it below.
  const reveal = useCallback(() => requestAnimationFrame(() => target.current?.querySelector('.game__board')?.scrollIntoView({ block: 'start' })), [target]);
  useEffect(() => {
    const sync = () => { setNative(!!document.fullscreenElement); if (document.fullscreenElement) reveal(); };
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* already left */ });
    };
  }, [reveal]);
  // The window overlay keeps the page behind it from scrolling and leaves with Escape like real full screen.
  useEffect(() => {
    if (!max) return;
    const root = document.documentElement;
    root.classList.add('is-game-max');
    reveal();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMax(false); };
    window.addEventListener('keydown', onKey);
    return () => { root.classList.remove('is-game-max'); window.removeEventListener('keydown', onKey); };
  }, [max, reveal]);
  const toggle = useCallback(async () => {
    if (max) { setMax(false); return; }
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => { /* already left */ }); return; }
    if (!api) { setMax(true); return; }
    try { await (target.current ?? document.documentElement).requestFullscreen({ navigationUI: 'hide' }); }
    catch { setMax(true); }
  }, [api, max, target]);
  return { on: native || max, max, toggle };
}

function tableMeta(t: Lobby) {
  return t.isTutorial ? 'میز آموزشی بدون زمان و بدون اثر بر رتبه' : `${PACE_FA[t.pace]} · ${t.visibility === 'private' ? 'خصوصی' : 'عمومی'} · دوستانه · ${durationFa(t.settings.turnSeconds)} برای هر نوبت`;
}

function GameView({ s }: { s: ReturnType<typeof useTableSession> }) {
  useImmersive();
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
  const busy = !!s.pending || !!s.queued || t.status !== 'active' || !!snap.incident;
  const waitingFor = g.pendingSeats.filter((x) => x !== t.mySeat).map(name);
  const hasChat = t.mySeat !== null && !t.isTutorial;
  const unread = useTableChatAlerts(hasChat ? t.id : null, chat);
  const gameRef = useRef<HTMLDivElement>(null);
  const full = useFullscreen(gameRef);

  // Escape cancels a move that is still inside its undo window.
  const { queued, cancelQueued } = s;
  useEffect(() => {
    if (!queued) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelQueued(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queued, cancelQueued]);

  const tutorial = async (path: 'start' | 'skip') => {
    setTutorialBusy(true);
    try {
      if (path === 'skip') { await api(`/tutorials/${t.gameId}/skip`, { method: 'POST' }); navigate(`/games/${t.gameId}`); }
      else navigate(`/tables/${(await api<{ tableId: string }>(`/tutorials/${t.gameId}/start`, { method: 'POST', body: { restart: true } })).tableId}`);
    } finally { setTutorialBusy(false); }
  };

  // Status strip, as on Board Game Arena: one line that always says whose move it is.
  const tone = finished ? 'done' : myTurn ? 'mine' : 'wait';
  const statusText = finished ? 'بازی تمام شد'
    : myTurn ? 'حرکت با شماست'
      : waitingFor.length ? `منتظر حرکت ${waitingFor.join('، ')}` : 'منتظر حرکت دیگران';

  const side = (
    <div className="stack">
      <PlayerBoards snap={snap} />
      <Policies table={t} collapsible />
      {canResign && <Button variant="danger" onClick={() => { setDrawer(false); setConfirmResign(true); }}>انصراف از بازی</Button>}
      {t.mySeat !== null && !t.isTutorial && <Button variant="ghost" onClick={() => { setDrawer(false); setReporting(true); }}>گزارش این میز</Button>}
    </div>
  );

  return (
    <div className={full.max ? 'game game--max' : 'game'} ref={gameRef}>
      <header className="gamebar">
        <Link to="/" className="gamebar__icon" aria-label="بازگشت به داشبورد"><ArrowRight aria-hidden /></Link>
        <div className="gamebar__title">
          <h1><span className="gamebar__mark" aria-hidden><Dices /></span>{t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa}</h1>
          <p>{tableMeta(t)}</p>
        </div>
        <span className={cn('gamebar__conn', s.live ? 'is-on' : 'is-off')} role="status" title={s.live ? 'متصل' : 'اتصال زنده برقرار نیست؛ با هر اقدام به‌روز می‌شود'}>
          <span className="gamebar__dot" aria-hidden /><span className="gamebar__conn-text">{s.live ? 'متصل' : 'اتصال زنده برقرار نیست؛ با هر اقدام به‌روز می‌شود'}</span>
        </span>
        {(
          <button type="button" className="gamebar__icon gamebar__full" onClick={() => void full.toggle()} aria-pressed={full.on}
            aria-label={full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'} title={full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}>
            {full.on ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </button>
        )}
        {hasChat && (
          <Button className={cn('gamebar__chat', unread > 0 && 'gamebar__chat--unread')} variant="secondary" size="sm" icon="card" onClick={() => setChat(true)}
            aria-label={unread > 0 ? `گفت‌وگوی میز، ${faNum(unread)} پیام تازه` : undefined}>
            گفت‌وگوی میز{unread > 0 && <span className="chatbadge" aria-hidden>{faNum(unread)}</span>}
          </Button>
        )}
        <Button className="game__drawer-btn" variant="secondary" size="sm" icon="players" onClick={() => setDrawer(true)}>بازیکنان و قوانین</Button>
      </header>

      <div className={cn('statusbar', `statusbar--${tone}`)} role="status" aria-live="polite">
        <span className="statusbar__icon" aria-hidden>{finished ? <Flag /> : myTurn ? <Hand /> : <Hourglass />}</span>
        <strong className="statusbar__text">{t.mySeat === null && !finished ? `تماشاگر · ${statusText}` : statusText}</strong>
        {g.tutorial && !finished && <span className="statusbar__hint">{g.tutorial.instructionFa}</span>}
        {g.deadline && !finished && (g.deadline.frozen
          ? <Badge tone="danger" icon="clock">زمان منجمد (توقف سراسری)</Badge>
          : <Timer deadline={new Date(new Date(g.deadline.dueAt).getTime() - s.clockOffset)} label="مهلت نوبت" lowSeconds={t.pace === 'live' ? 10 : 3600} />)}
      </div>

      <div className="game__main stack">
        <PlayerBoards snap={snap} strip />

        {snap.incident && <div className="banner banner--warn" role="status" style={{ margin: 0 }}><Icon name="alert" />توقف سراسری: {snap.incident.reasonFa}. موعدها پس از رفع مشکل جبران می‌شوند.</div>}
        {s.notice && <div className="banner banner--warn" role="alert" style={{ margin: 0 }}>{s.notice} <Button variant="ghost" size="sm" onClick={() => s.setNotice(null)}>باشه</Button></div>}
        {s.queued && (
          <div className="banner banner--info undo" role="status" style={{ margin: 0, ['--undo-ms' as string]: `${s.queued.ms}ms` }}>
            <span className="undo__bar" aria-hidden />
            <Icon name="clock" /> حرکت شما تا لحظه‌ای دیگر ثبت می‌شود.
            <Button size="sm" variant="secondary" onClick={s.cancelQueued}>انصراف</Button>
          </div>
        )}
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
              <h2 id="tut-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}><Icon name="book" />آموزش: مرحله {faNum(Math.min(g.tutorial.step + 1, g.tutorial.total))} از {faNum(g.tutorial.total)}</h2>
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

        {/* The stage: a graphite panel; renderers sit on it in the night palette. */}
        <div className={cn('game__board table-night', myTurn && 'game__board--mine')}>
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
          <Button variant="danger" onClick={() => { setConfirmResign(false); s.act({ type: 'resign' }, true); }}>انصراف قطعی</Button></>}>
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
  if (t.status !== 'cancelled' && t.status !== 'open' && snap.game) return <GameView s={s} />;
  return (
    <>
      <div className="page-head" style={{ marginBlockEnd: 'var(--sp-4)' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--fs-xl)' }}>{t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa}</h1>
          <p className="page-sub">
            {tableMeta(t)}
          </p>
        </div>
      </div>
      {t.status === 'cancelled' ? <StateBlock kind="empty" title="این میز لغو شده است" action={<Link className="btn btn--secondary" to="/">بازگشت</Link>} />
        : t.status === 'open' ? <LobbyView snap={snap} invite={invite} onChange={s.accept} />
          : snap.game ? <GameView s={s} /> : <StateBlock kind="loading" title="در حال آماده‌سازی بازی…" />}
    </>
  );
}
