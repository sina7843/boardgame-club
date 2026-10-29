import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BOT_LEVEL_FA, BOT_STYLE_FA, cosmetic, EMOTE_BODY, QUICK_CHAT, parseAvatar, type MessageItem, type TableSnapshot, type UserCard } from '@bg/contracts';
import { DockSlotHost, useOnline, useToast } from '@bg/ui';
import {
  ActionDock, CritBar, Badge, League, MoveLog, Spectators, Banner, Breadcrumbs, Button, Card, Connection, Dialog, Felt, FeltPlate, GameBar, Hud, Icon, ListItem, LobbySeat, PageHead,
  ReadyCheck, Rematch, Result, Sheet, StateBlock, TableScreen, TextField, TurnPill,
  type AvatarProps, type ClockState, type PlayerCardProps, type RewardProps, type SeatNo
} from '@bg/ui/bgv';
import { usePresence } from '../lib/presence.ts';
import { NotifyPrompt } from '../social/NotifyPrompt.tsx';
import { CONFIRMS_IN_RENDERER, RENDERERS, SEAT_CARDS } from '../games/renderers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { AvatarArt, frameProps } from '../lib/bgv.tsx';
import { durationFa, faNum, PACE_FA, COMPETITION_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { browserNotificationsEnabled } from '../lib/realtime.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { useTableSession } from '../lib/useTableSession.ts';
import { useTurnAlerts } from '../lib/alerts.ts';
import { ChatPanel, type ChatEvent } from '../social/ChatPanel.tsx';
import { QuickChatButton, QuickChatChips } from '../social/QuickChat.tsx';
import { InvitePanel } from '../social/InvitePanel.tsx';
import { ReportDialog } from '../social/ReportDialog.tsx';

type Lobby = TableSnapshot['table'];
type Seat = Lobby['seats'][number];
const REASON_FA: Record<string, string> = { win: 'پیروزی', draw: 'مساوی', score: 'پایان دورها و شمارش امتیاز', timeout: 'اتمام زمان', resign: 'انصراف' };

/** DS seats are 1–10 (colour + glyph); server seats are 0-based. */
const seatNo = (seat: number) => (Math.min(seat, 9) + 1) as SeatNo;

const seatNameOf = (t: Lobby) => (seat: number) => {
  const s = t.seats.find((x) => x.seat === seat);
  if (s?.bot) return s.bot.nameFa;
  return s?.kind === 'script' ? 'حریف آموزشی' : s?.user?.displayName ?? `جایگاه ${faNum(seat + 1)}`;
};

/** Equipped cosmetic art colours of a seat (player-chosen art data, like game art — not UI tokens). */
const seatArt = (s: Seat | undefined, kind: 'seatRing' | 'chatBubble') => {
  const key = s?.cosmetics?.[kind];
  return key ? cosmetic(key)?.art?.colors : undefined;
};

/** Avatar props for a seat: the built avatar art when there is one, else the first letter; equipped seat ring. */
function seatAvatar(s: Seat | undefined, name: string): AvatarProps {
  const key = s?.user?.avatarKey;
  const ring = seatArt(s, 'seatRing');
  const fr = frameProps(key);
  return {
    name, initials: name.charAt(0), ...(key && parseAvatar(key) ? { children: <AvatarArt avatarKey={key} /> } : {}),
    className: [ring ? 'tbl-ring' : '', fr.className ?? ''].join(' ').trim() || undefined,
    style: { ...(ring ? { '--tbl-ring': ring[0] } : {}), ...fr.style } as React.CSSProperties
  };
}

/** Re-renders every `ms` (clocks). */
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

function tableMeta(t: Lobby): string[] {
  if (t.isTutorial) return ['میز آموزشی', 'بدون زمان', 'بدون اثر بر رتبه'];
  return [PACE_FA[t.pace], `${durationFa(t.settings.turnSeconds)} هر نوبت`, COMPETITION_FA[t.competition], t.visibility === 'private' ? 'خصوصی' : 'عمومی'];
}

/** Time / timeout / disconnect / resign rules of the table, plus its rule variants. */
function Policies({ table }: { table: Lobby }) {
  return (
    <Card title={<span className="bgv-row"><Icon name="shield" />قوانین زمان و ترک میز</span>}>
      <div className="tbl-rules">
        {!table.isTutorial && <ListItem icon="timer" title={`${PACE_FA[table.pace]}، ${durationFa(table.settings.turnSeconds)} هر نوبت`} />}
        <ListItem icon="alarm-clock" title="اتمام زمان" sub={table.policies.timeoutFa} />
        <ListItem icon="wifi-off" title="قطع اتصال" sub={table.policies.disconnectFa} />
        <ListItem icon="flag" title="انصراف" sub={table.policies.resignFa} />
        {table.variants.map((v) => <ListItem key={v.labelFa} icon="sliders-horizontal" title={v.labelFa} sub={v.valueFa} />)}
      </div>
    </Card>
  );
}

function ReadyCountdown({ until }: { until: string }) {
  const now = useNow();
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return <strong className="bgv-num" role="timer">{faNum(Math.floor(left / 60))}:{(left % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}</strong>;
}

function LobbyView({ snap, invite, onChange }: { snap: TableSnapshot; invite: string | null; onChange: (s: TableSnapshot) => void }) {
  const t = snap.table;
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const me = t.seats.find((s) => s.seat === t.mySeat);
  const name = seatNameOf(t);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(undefined);
    try { await fn(); } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); } finally { setBusy(false); }
  };
  const inviteLink = t.inviteCode ? `${location.origin}/tables/${t.id}?invite=${t.inviteCode}` : null;
  const empty = t.capacity - t.seats.length;
  const readyCount = t.seats.filter((s) => s.ready).length;
  const host = t.seats.find((s) => s.user?.id === t.hostId);
  const copy = (link: string) => navigator.clipboard.writeText(link).then(() => toast('success', 'لینک دعوت کپی شد.'), () => toast('error', 'کپی ممکن نشد؛ لینک را دستی انتخاب کنید.'));
  const toInvite = () => document.getElementById('table-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const actions = !me && t.settings.tournament ? (
    <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>میز تورنمنت؛ شما تماشاگرید و بازی با آمادگی بازیکنان شروع می‌شود.</p>
  ) : !me ? (
    <Button variant="primary" block icon="armchair" loading={busy}
      onClick={() => run(async () => onChange(await api<TableSnapshot>(`/tables/${t.id}/join`, { method: 'POST', body: invite ? { inviteCode: invite } : {} })))}>
      پیوستن به میز
    </Button>
  ) : (
    <>
      <Button variant={me.ready ? 'secondary' : 'primary'} block icon={me.ready ? 'x' : 'check'} loading={busy}
        onClick={() => run(async () => onChange(await api<TableSnapshot>(`/tables/${t.id}/ready`, { method: 'POST', body: { ready: !me.ready } })))}>
        {me.ready ? 'لغو آمادگی' : 'آماده‌ام'}
      </Button>
      <Button variant={t.isMatchmade ? 'secondary' : 'leave'} block disabled={busy}
        onClick={() => run(async () => { await api(`/tables/${t.id}/leave`, { method: 'POST' }); navigate(t.isMatchmade ? '/play' : '/'); })}>
        {t.isMatchmade ? 'رد کردن' : 'ترک میز'}
      </Button>
    </>
  );

  return (
    <>
      {me && t.pace === 'turn' && !t.isTutorial && <NotifyPrompt />}
      <Breadcrumbs items={[{ label: 'میزها', href: '/tables' }, { label: t.gameNameFa, href: `/games/${t.gameId}` }, { label: t.isTutorial ? 'آموزش' : host?.user ? `میز ${host.user.displayName}` : 'میز' }]} />
      <PageHead title={<span className="tbl-head">
        <img className="tbl-head__cover" src={`/covers/${t.gameId}.webp?v=2`} alt="" />
        <span>{t.isTutorial ? `آموزش ${t.gameNameFa}` : host?.user ? <>{t.gameNameFa}، میز <bdi>{host.user.displayName}</bdi></> : t.gameNameFa}
          {' '}<bdi className="tbl-head__latin" lang="en">{t.gameNameOriginal}</bdi></span>
      </span>} sub={<span className="bgv-row">{tableMeta(t).map((m, i) => <span key={m} className="bgv-row">{i > 0 && <span className="bgv-sep" />}{m}</span>)}</span>} />
      <div className="bgv-cols">
        <div className="bgv-stack">
          <Card title={<span className="bgv-row"><Icon name="users" />بازیکنان ({faNum(t.seats.length)} از {faNum(t.capacity)})</span>}>
            <div className="tbl-seats">
              {t.seats.map((s) => (
                <LobbySeat key={s.seat} name={<bdi>{name(s.seat)}</bdi>} seat={seatNo(s.seat)} you={s.seat === t.mySeat} bot={!!s.bot}
                  avatar={seatAvatar(s, name(s.seat))} host={!!s.user && s.user.id === t.hostId} ready={s.ready}
                  {...(s.bot ? { sub: `ربات ${BOT_LEVEL_FA[s.bot.level]}، ${BOT_STYLE_FA[s.bot.style]}` } : {})} />
              ))}
              {Array.from({ length: empty }, (_, i) => (
                <LobbySeat key={`e${i}`} empty inviteLabel="دعوت دوست" {...(inviteLink || (me && !t.isMatchmade) ? { onInvite: toInvite } : {})} />
              ))}
            </div>
            {empty > 0 && <p className="t-caption bgv-muted" style={{ margin: 'var(--space-3) 0 0' }}>بازی وقتی شروع می‌شود که همه جایگاه‌ها پر و همه آماده باشند.</p>}
          </Card>
          {me && !t.isTutorial && <ChatPanel className="tbl-lobbychat" load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" />}
        </div>
        <div className="bgv-stack">
          {t.isMatchmade && me ? (
            <ReadyCheck title="حریف پیدا شد" players={t.seats.map((s) => ({ name: <bdi>{name(s.seat)}</bdi>, seat: seatNo(s.seat), initials: name(s.seat).charAt(0), you: s.seat === t.mySeat, bot: !!s.bot, ready: s.ready }))}
              text={<>همه بازیکنان باید آمادگی را تأیید کنند.{t.readyDeadline && <> زمان باقی‌مانده: <ReadyCountdown until={t.readyDeadline} /></>}</>}
              actions={actions}>
              <p className="t-caption bgv-muted" style={{ margin: 0 }}>اگر کسی تأیید نکند، کسانی که آماده بودند دوباره به صف برمی‌گردند.</p>
            </ReadyCheck>
          ) : (
            <Card title={<span className="bgv-row"><Icon name="hourglass" />در انتظار آمادگی، {faNum(readyCount)} از {faNum(t.capacity)} آماده</span>}>
              <div className="bgv-stack" style={{ gap: 'var(--space-3)' }}>
                {me && <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>با اعلام آمادگی، قوانین زمان و انصراف این میز را می‌پذیرید.</p>}
                {error && <Banner tone="danger" text={error} />}
                <div className="tbl-lobbyacts">{actions}</div>
              </div>
            </Card>
          )}
          {!t.isMatchmade && <div className="tbl-lobbybar" role="group" aria-label="آمادگی">{actions}</div>}
          {inviteLink && (
            <div id="table-invite"><Card title={<span className="bgv-row"><Icon name="link" />دعوت به میز</span>}>
              <TextField label="لینک دعوت" readOnly value={inviteLink} dir="ltr" onFocus={(e) => e.target.select()}
                end={<Button variant="secondary" size="sm" icon="copy" onClick={() => void copy(inviteLink)}>کپی</Button>} />
            </Card></div>
          )}
          {me && !t.isMatchmade && !t.isTutorial && <div id={inviteLink ? undefined : 'table-invite'}><InvitePanel tableId={t.id} /></div>}
          <Policies table={t} />
        </div>
      </div>
    </>
  );
}

interface Rewards { rating: { before: number; after: number; provisional: boolean } | null; rewards: { ruleId: string; amount: number; reason: string }[]; coins: number; processed: boolean }

/** Rating, XP and coin rewards of this table (computed by the worker shortly after the result: polled briefly). */
function useRewards(tableId: string, enabled: boolean) {
  const r = useApi<Rewards>(enabled ? `/me/rewards?tableId=${tableId}` : null);
  const [tries, setTries] = useState(0);
  const reload = r.reload;
  useEffect(() => {
    if (!enabled || r.data?.processed || tries >= 10) return;
    const t = setTimeout(() => { setTries((n) => n + 1); reload(); }, 1500);
    return () => clearTimeout(t);
  }, [enabled, r.data, tries, reload]);
  return { data: r.data, gaveUp: tries >= 10 };
}

/** «یه دست دیگه؟»: every human seat votes within 30 s; all yes → the server opens the same table again. */
function RematchBlock({ snap, onSnap }: { snap: TableSnapshot; onSnap: (s: TableSnapshot) => void }) {
  const t = snap.table;
  const r = t.rematch;
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r?.newTableId) navigate(`/tables/${r.newTableId}`); }, [r?.newTableId, navigate]);
  if (!r || t.mySeat === null) return null;
  const name = seatNameOf(t);
  const left = r.deadline ? Math.max(0, Math.ceil((new Date(r.deadline).getTime() - now) / 1000)) : null;
  const closed = r.closed || left === 0;
  const myVote = r.votes.find((v) => v.seat === t.mySeat)?.vote;
  const vote = async (v: 'yes' | 'no') => {
    setBusy(true);
    try { onSnap(await api<TableSnapshot>(`/tables/${t.id}/rematch`, { method: 'POST', body: { vote: v } })); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'رأی ثبت نشد.'); } finally { setBusy(false); }
  };
  return (
    <Rematch title={closed ? 'دست دیگری بازی نمی‌شود' : 'یه دست دیگه با همین جمع؟'}
      votes={t.seats.filter((s) => s.kind !== 'script').map((s) => {
        const v = s.bot ? 'yes' : r.votes.find((x) => x.seat === s.seat)?.vote;
        return { name: <bdi>{name(s.seat)}</bdi>, seat: seatNo(s.seat), initials: name(s.seat).charAt(0), you: s.seat === t.mySeat, vote: v ?? 'wait' };
      })}
      {...(left !== null && !closed ? { countdown: { time: left, p: left / 30, size: 'chip' as const, label: 'مهلت رأی' } } : {})}
      actions={!closed && !myVote ? <>
        <Button variant="primary" icon="refresh-cw" loading={busy} onClick={() => void vote('yes')}>یه دست دیگه</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void vote('no')}>نه</Button>
      </> : undefined} />
  );
}

function ResultCard({ snap, onHide, onSnap }: { snap: TableSnapshot; onHide: () => void; onSnap: (s: TableSnapshot) => void }) {
  const t = snap.table;
  const r = snap.game!.result!;
  const name = seatNameOf(t);
  const mine = r.placements.find((p) => p.seat === t.mySeat);
  // A shared first place under reason 'win' is a shared victory (a cooperative team, or everyone but a single loser);
  // otherwise a shared first place is a draw.
  const sharedWin = r.reason === 'win';
  const headline = t.isTutorial ? 'آموزش کامل شد' : !mine ? 'بازی تمام شد' : mine.place === 1 ? (r.placements.filter((p) => p.place === 1).length > 1 && !sharedWin ? 'مساوی شد' : 'شما بردید') : 'این دست را باختید';
  const rewards = useRewards(t.id, t.mySeat !== null);
  const sorted = [...r.placements].sort((a, b) => a.place - b.place);
  const podium = sorted.slice(0, 3).map((p) => ({
    name: name(p.seat), seat: seatNo(p.seat), initials: name(p.seat).charAt(0), you: p.seat === t.mySeat,
    bot: !!t.seats.find((s) => s.seat === p.seat)?.bot, ...(p.score !== undefined ? { meta: `${faNum(p.score)} امتیاز` } : {})
  }));
  const rest = sorted.slice(3);
  const items: RewardProps[] = [];
  const d = rewards.data;
  if (d?.processed) {
    if (d.rating) items.push({ icon: 'arrow-up-right', label: `امتیاز رتبه‌دار${d.rating.provisional ? ' (موقت)' : ''}: ${faNum(d.rating.before)} → ${faNum(d.rating.after)}`, value: d.rating.after - d.rating.before, dir: d.rating.after >= d.rating.before ? 'up' : 'down' });
    for (const x of d.rewards) items.push({ icon: 'sparkles', label: x.reason, ...(x.amount > 0 ? { value: x.amount, unit: 'XP' } : {}) });
    if (d.coins > 0) items.push({ coin: true, label: 'سکه', value: d.coins, unit: 'سکه' });
  }
  const toast = useToast();
  // Share the public outcome only (names and places), never hidden game information.
  const share = async () => {
    const text = `${t.gameNameFa}: ${sorted.map((p) => `${faNum(p.place)}. ${name(p.seat)}`).join('، ')}`;
    const url = `${location.origin}/tables/${t.id}`;
    try {
      if (navigator.share) await navigator.share({ title: headline, text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('success', 'نتیجه کپی شد.'); }
    } catch { /* share sheet dismissed */ }
  };
  return (
    <Result className="tbl-result" title={headline} badge={!t.isTutorial && mine?.place === 1 ? `${REASON_FA[r.reason] ?? r.reason}، ${COMPETITION_FA[t.competition]}` : undefined}
      sub={<>علت پایان: {REASON_FA[r.reason] ?? r.reason}</>} podium={podium} rewards={items}
      actions={<>
        <Button variant="primary" icon="plus" href={`/games/${t.gameId}/new`}>{t.isTutorial ? 'ساخت میز واقعی' : 'میز تازه'}</Button>
        <Button variant="secondary" icon="house" href="/">بازگشت به خانه</Button>
        <Button variant="ghost" icon="share-2" onClick={() => void share()}>اشتراک نتیجه</Button>
        <Button variant="ghost" icon="history" onClick={onHide}>تاریخچهٔ حرکت‌ها و صفحهٔ بازی</Button>
      </>}>
      {snap.game?.tutorial && <p className="t-body-sm" style={{ margin: 0, textAlign: 'center' }}>{snap.game.tutorial.instructionFa}</p>}
      <RematchBlock snap={snap} onSnap={onSnap} />
      {rest.length > 0 && <p className="t-caption bgv-muted" style={{ margin: 0, textAlign: 'center' }}>
        {rest.map((p) => `${faNum(p.place)}. ${name(p.seat)}${p.score !== undefined ? `، ${faNum(p.score)} امتیاز` : ''}`).join('  ')}</p>}
      {t.mySeat !== null && d && !d.processed && <p className="t-caption bgv-muted" style={{ margin: 0, textAlign: 'center' }} role="status">{rewards.gaveUp ? 'پاداش‌ها بعداً در «پیشرفت» نمایش داده می‌شوند.' : 'در حال محاسبه پاداش…'}</p>}
      {t.competition === 'friendly' && !t.isTutorial && <p className="t-caption bgv-muted" style={{ margin: 0, textAlign: 'center' }}>میز دوستانه روی رتبه اثری ندارد.</p>}
    </Result>
  );
}

/**
 * After the game: one-tap «good game» to the table chat (which stays open after the result), a friend request to
 * each human opponent who is not a friend yet, and reporting the table.
 */
function PostGame({ snap, onReport }: { snap: TableSnapshot; onReport: () => void }) {
  const t = snap.table;
  const toast = useToast();
  const others = t.seats.filter((x) => x.seat !== t.mySeat && x.user).map((x) => x.user!);
  const [rel, setRel] = useState<Record<string, string>>({});
  const ids = others.map((u) => u.id).join(',');
  useEffect(() => {
    for (const id of ids ? ids.split(',') : []) {
      api<UserCard>(`/users/${id}/card`).then((c) => setRel((old) => ({ ...old, [id]: c.relationship })), () => { /* card unavailable: no button */ });
    }
  }, [ids]);
  const befriend = async (id: string) => {
    try {
      const c = await api<UserCard>('/friends/requests', { method: 'POST', body: { userId: id } });
      setRel((old) => ({ ...old, [id]: c.relationship }));
      toast('success', c.relationship === 'friends' ? 'اکنون با هم دوست هستید.' : 'درخواست دوستی فرستاده شد.');
    } catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'درخواست فرستاده نشد.'); }
  };
  const addable = others.filter((u) => rel[u.id] === 'none' || rel[u.id] === 'incoming');
  return (
    <Card title="بعد از بازی" className="tbl-post">
      <div className="bgv-stack" style={{ gap: 'var(--space-2)' }}>
        <QuickChatChips post={`/tables/${t.id}/chat`} only={['gg', 'rematch']} onSent={() => toast('success', 'به گفت‌وگوی میز فرستاده شد.')} />
        {addable.map((u) => (
          <Button key={u.id} size="sm" variant="secondary" icon="user-plus" onClick={() => void befriend(u.id)}>
            {rel[u.id] === 'incoming' ? 'پذیرش دوستی' : 'افزودن دوست'}: <bdi>{u.displayName}</bdi>
          </Button>
        ))}
        {t.settings.tournament && others.map((u) => (
          <Button key={`fp-${u.id}`} size="sm" variant="ghost" icon="shield-alert" onClick={() => {
            api(`/tables/${t.id}/report`, { method: 'POST', body: { accusedId: u.id } })
              .then(() => toast('success', 'گزارش برای داور ثبت شد.'), (err: unknown) => toast('error', err instanceof ApiFailure ? err.messageFa : 'گزارش ثبت نشد.'));
          }}>گزارش مشکوک بودن بازی: <bdi>{u.displayName}</bdi></Button>
        ))}
        <Button size="sm" variant="ghost" icon="flag" onClick={onReport}>گزارش این میز</Button>
      </div>
    </Card>
  );
}

/** While a game is on the table the shell steps aside (no sidebar, top bar or dock): the table is the whole screen. */
function useImmersive() {
  useEffect(() => {
    document.documentElement.dataset.immersive = 'true';
    return () => { delete document.documentElement.dataset.immersive; };
  }, []);
}

/**
 * Table chat alerts. Every message shows for a few seconds as a speech bubble on its sender's player card; while the
 * chat is closed it also counts as unread, shows a short toast with the sender and text, and (if enabled in settings)
 * a browser notification when the tab is hidden.
 */
function useTableChatAlerts(tableId: string | null, open: boolean): { unread: number; said: Record<string, string>; last: { name: string; text: string } | null } {
  const { me } = useSession();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [said, setSaid] = useState<Record<string, string>>({});
  const [last, setLast] = useState<{ name: string; text: string } | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!tableId) return;
    api<{ conversationId: string }>(`/tables/${tableId}/chat`).then((r) => setConversationId(r.conversationId), () => { /* chat unavailable */ });
  }, [tableId]);
  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  useEffect(() => {
    if (!conversationId) return;
    const on = (e: Event) => {
      const m = (e as CustomEvent<MessageItem>).detail;
      if (m.conversationId !== conversationId || m.deleted || m.editedAt) return;
      const em = EMOTE_BODY.exec(m.body)?.[1];
      const body = em ? `«${cosmetic(em)?.nameFa ?? 'ایموت'}»` : m.body;
      const short = body.length > 60 ? `${body.slice(0, 60)}…` : body;
      setSaid((old) => ({ ...old, [m.sender.id]: short }));
      setLast({ name: m.sender.displayName, text: short });
      clearTimeout(timers.current.get(m.sender.id));
      timers.current.set(m.sender.id, setTimeout(() => setSaid(({ [m.sender.id]: _, ...rest }) => rest), 6000));
      if (m.sender.id === me?.id || open) return;
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
  return { unread, said, last };
}

/**
 * Full screen for the game container. Uses the Fullscreen API where it exists; where it does not (iPhone Safari) or the
 * browser refuses, the game is laid over the whole window instead (`.tbl--max`), so the button always does something.
 */
function useFullscreen(target: RefObject<HTMLElement | null>) {
  const api = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const [native, setNative] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  const [max, setMax] = useState(false);
  useEffect(() => {
    const sync = () => setNative(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* already left */ });
    };
  }, []);
  useEffect(() => {
    if (!max) return;
    const root = document.documentElement;
    root.classList.add('is-game-max');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMax(false); };
    window.addEventListener('keydown', onKey);
    return () => { root.classList.remove('is-game-max'); window.removeEventListener('keydown', onKey); };
  }, [max]);
  const toggle = useCallback(async () => {
    if (max) { setMax(false); return; }
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => { /* already left */ }); return; }
    if (!api) { setMax(true); return; }
    try { await (target.current ?? document.documentElement).requestFullscreen({ navigationUI: 'hide' }); }
    catch { setMax(true); }
  }, [api, max, target]);
  return { on: native || max, max, toggle };
}

/** Turn clock from the server deadline: calm → warn (half) → critical (live: last 10 s, turn-based: last hour); stale while offline. */
function useTurnClock(s: ReturnType<typeof useTableSession>): { time: number; p: number; state: ClockState } | null {
  const now = useNow();
  const held = useRef<{ key: string; left: number } | null>(null);
  const snap = s.snapshot!;
  const d = snap.game?.deadline;
  if (!d || snap.table.status !== 'active') return null;
  const live = Math.max(0, Math.ceil((new Date(d.dueAt).getTime() - s.clockOffset - now) / 1000));
  // Offline or a platform incident: hold the last confirmed time instead of counting down on a guess.
  const hold = d.frozen || !s.live;
  if (!hold || held.current?.key !== d.dueAt) held.current = { key: d.dueAt, left: live };
  const left = hold ? held.current.left : live;
  const clocks = snap.game?.clocks;
  const total = Math.max(1, clocks ? clocks.initialMs / 1000 : snap.table.settings.turnSeconds);
  const p = Math.min(1, left / total);
  const state: ClockState = d.frozen ? 'frozen' : !s.live ? 'stale' : left <= (snap.table.pace === 'live' ? 10 : 3600) ? 'critical' : p <= 0.5 ? 'warn' : 'calm';
  return { time: left, p, state };
}

function GameView({ s }: { s: ReturnType<typeof useTableSession> }) {
  useImmersive();
  const snap = s.snapshot!;
  const t = snap.table;
  const g = snap.game!;
  const navigate = useNavigate();
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheetSeat, setSheetSeat] = useState<number | null>(null);
  // Game turn controls (renderers wrap them in <DockSlot>) render into the action dock through this portal.
  const [dockNode, setDockNode] = useState<HTMLSpanElement | null>(null);
  const toDock = useCallback((node: ReactNode) => (dockNode ? createPortal(node, dockNode) : node), [dockNode]);
  // Game events for the table chat (DS SystemMessage lines), built from what this table view already receives:
  // public moves (games that publish them), the end of the game. Kept for this visit only.
  const [gameEvents, setGameEvents] = useState<ChatEvent[]>([]);
  const seenMoves = useRef<number | null>(null);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [chat, setChat] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [hideResult, setHideResult] = useState(false);
  const Renderer = RENDERERS[t.clientBundleRef];
  const name = seatNameOf(t);
  const finished = t.status === 'finished';
  const canResign = !finished && g.legalActions.some((a) => a.type === 'resign');
  const myTurn = t.mySeat !== null && g.pendingSeats.includes(t.mySeat);
  const netOnline = useOnline();
  const busy = !!s.pending || !!s.queued || t.status !== 'active' || !!snap.incident || !netOnline;
  const waitingFor = g.pendingSeats.filter((x) => x !== t.mySeat).map(name);
  // Spectators read the table chat (read-only); only seated players post or use quick chat.
  const hasChat = !t.isTutorial;
  const isPlayer = t.mySeat !== null;
  const wide = useWide();
  const notPhone = useWide(900);
  const { unread, said, last } = useTableChatAlerts(hasChat ? t.id : null, chat || wide);
  const gameRef = useRef<HTMLDivElement>(null);
  const full = useFullscreen(gameRef);
  const clock = useTurnClock(s);
  useTurnAlerts(t.id, t.mySeat);
  // Tournament players: the page being hidden/shown is recorded for fair-play review (stated in the tournament rules).
  const inTournament = !!t.settings.tournament;
  useEffect(() => {
    if (!inTournament || t.mySeat === null || t.status !== 'active') return;
    const send = () => { api(`/tables/${t.id}/focus`, { method: 'POST', body: { hidden: document.hidden } }).catch(() => undefined); };
    document.addEventListener('visibilitychange', send);
    return () => document.removeEventListener('visibilitychange', send);
  }, [t.id, inTournament, t.mySeat, t.status]);

  // Escape cancels a move that is still inside its undo window.
  const { queued, cancelQueued } = s;
  useEffect(() => {
    if (!queued) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelQueued(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queued, cancelQueued]);

  // Escape closes the chat sheet / players drawer.
  useEffect(() => {
    if (!chat && !drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setChat(false); setDrawer(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chat, drawer]);

  const tutorial = async (path: 'start' | 'skip') => {
    setTutorialBusy(true);
    try {
      if (path === 'skip') { await api(`/tutorials/${t.gameId}/skip`, { method: 'POST' }); navigate(`/games/${t.gameId}`); }
      else navigate(`/tables/${(await api<{ tableId: string }>(`/tutorials/${t.gameId}/start`, { method: 'POST', body: { restart: true } })).tableId}`);
    } finally { setTutorialBusy(false); }
  };

  const statusText = finished ? 'بازی تمام شد'
    : myTurn ? 'حرکت با شماست'
      : waitingFor.length ? `منتظر حرکت ${waitingFor.join('، ')}` : 'منتظر حرکت دیگران';
  const clockProps = clock ? { time: clock.time, p: clock.p, state: clock.state, label: 'مهلت نوبت', ...(clock.state === 'stale' ? { sub: 'در حال اتصال دوباره' } : {}) } : undefined;

  const placeOf = (seat: number) => g.result?.placements.find((p) => p.seat === seat);
  const sum = g.summary;
  const STATUS_FA = { out: 'حذف شد', passed: 'پاس داد', done: 'آماده', winner: 'برنده', playing: undefined } as const;
  const online = usePresence(finished ? [] : t.seats.map((x) => (x.seat === t.mySeat ? null : x.user?.id)));
  // Chess clock: every seat shows its own bank; only the running one counts down (and holds while offline).
  const bank = (seat: number) => {
    const c = g.clocks;
    if (!c) return null;
    const runningMs = c.running === seat ? (clock?.time ?? 0) * 1000 : c.left[seat] ?? 0;
    const sec = Math.max(0, Math.ceil(runningMs / 1000));
    const running = c.running === seat;
    return { time: sec, p: Math.min(1, (sec * 1000) / c.initialMs), size: 'chip' as const,
      state: (running ? (clock?.state ?? 'calm') : 'paused') as ClockState };
  };
  const moveCount = sum?.moves?.length ?? 0;
  useEffect(() => {
    const moves = sum?.moves ?? [];
    if (seenMoves.current === null) { seenMoves.current = moves.length; return; } // history before opening is not replayed
    const fresh = moves.slice(seenMoves.current);
    seenMoves.current = moves.length;
    if (fresh.length) setGameEvents((e) => [...e, ...fresh.map((m, i) => ({ id: `m${g.revision}-${i}`, at: new Date().toISOString(), seat: m.seat, text: `${name(m.seat)}: ${m.text}` }))]);
  }, [moveCount, g.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!finished || !g.result) return;
    const winners = g.result.placements.filter((p) => p.place === 1).map((p) => name(p.seat));
    setGameEvents((e) => (e.some((x) => x.id === 'end') ? e : [...e, { id: 'end', at: new Date().toISOString(), text: `بازی تمام شد؛ نفر اول: ${winners.join('، ')}` }]));
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
  // Turn order hint for a single mover: «بعدی» / «بعدی شمایید» / «۳ نوبت بعد» (seat order, wrapping).
  // Context-aware presets (design 3-chat): «نوبت توئه!» only on someone else's turn, «بازی خوبی بود» / rematch only after.
  const quickFor = QUICK_CHAT.map((q) => q.id).filter((id) => (id === 'your_turn' ? !myTurn && !finished : id === 'gg' || id === 'rematch' ? finished : id === 'thinking' ? myTurn : true));
  const queueText = (seat: number) => {
    if (g.pendingSeats.length !== 1) return 'منتظر';
    const n = t.seats.length;
    const d = (seat - g.pendingSeats[0]! + n) % n;
    return d === 1 ? (seat === t.mySeat ? 'بعدی شمایید' : 'بعدی') : `${faNum(d)} نوبت بعد`;
  };
  const players: PlayerCardProps[] = t.seats.map((x) => {
    const n = name(x.seat);
    const active = g.pendingSeats.includes(x.seat) && t.status === 'active';
    const words = x.user ? said[x.user.id] : undefined;
    const place = placeOf(x.seat);
    const ss = sum?.seats.find((y) => y.seat === x.seat);
    const live = ss ? {
      ...(ss.primary ? { score: ss.primary.target !== undefined ? `${faNum(ss.primary.value)}/${faNum(ss.primary.target)}` : ss.primary.value, scoreLabel: ss.primary.label } : {}),
      ...(ss.stats?.length ? { stats: ss.stats.map((st) => ({ value: typeof st.value === 'number' ? st.value : st.value, label: st.label, ...(st.icon ? { icon: st.icon } : {}), ...(st.resource ? { resource: st.resource } : {}), ...(st.delta !== undefined ? { delta: st.delta } : {}) })) } : {}),
      ...(ss.strikes !== undefined && sum?.strikesMax ? { strikes: ss.strikes, strikesOf: sum.strikesMax } : {}),
      ...(ss.status === 'out' ? { out: true } : ss.status === 'done' ? { done: true } : ss.status === 'passed' ? { done: STATUS_FA.passed } : {}),
      ...(sum?.leaderSeat === x.seat ? { leader: true } : {}),
      ...(ss.badges?.length && !words ? { badge: <span className="bgv-row tbl-badges">{ss.badges.map((b) => <Badge key={b.key} size="sm" tone={b.tone ?? 'neutral'}>{b.label}</Badge>)}</span> } : {}),
      ...SEAT_CARDS[t.clientBundleRef]?.(ss, active)
    } : {};
    return {
      name: n, seat: seatNo(x.seat), avatar: seatAvatar(x, n), you: x.seat === t.mySeat, bot: !!x.bot, turn: active,
      onClick: () => setSheetSeat(x.seat),
      ...(x.bot ? { botLevel: BOT_LEVEL_FA[x.bot.level] } : {}),
      ...(x.kind === 'script' ? { sub: 'حریف آموزشی' } : {}),
      ...(x.league ? { league: x.league } : {}),
      ...(x.titleKey && cosmetic(x.titleKey) ? { title: cosmetic(x.titleKey)!.nameFa } : {}),
      ...(x.user && online[x.user.id] && !online[x.user.id]!.online ? { offline: 'آفلاین' } : {}),
      ...(g.clocks ? { clock: bank(x.seat)! } : active && clockProps ? { clock: { ...clockProps, size: 'chip' as const } } : {}),
      ...live,
      ...(words ? { badge: (() => {
        const b = seatArt(x, "chatBubble");
        const atMe = t.mySeat !== null && words.includes(`@${name(t.mySeat)}`);
        // Floating speech bubble over the card (DS bubble-float); the game's own badges stay visible beside it.
        return <>{live.badge}<span className={`bgv-bubble-float tbl-said${atMe ? ' is-mention' : ''}`} aria-hidden
          style={b ? { "--tbl-bubble": b[0], "--tbl-bubble-ink": b[1] ?? "inherit" } as React.CSSProperties : undefined}><b>{n}:</b> {words}</span></>;
      })() } : {}),
      ...(place ? { score: place.score ?? place.place, scoreLabel: place.score !== undefined ? 'امتیاز' : 'رتبه', leader: place.place === 1 } : {}),
      ...(!place && !active && !finished && !ss?.status ? { waiting: queueText(x.seat) } : {}),
      ...(active ? { waiting: 'در حال بازی' } : {})
    };
  });
  const shared = sum?.shared ?? [];

  const pops = (
    <div className="tbl-pops">
      {snap.incident && <Banner tone="warning" icon="lock" title="توقف سراسری" text={`${snap.incident.reasonFa}. موعدها پس از رفع مشکل جبران می‌شوند.`} />}
      {s.notice && <Banner tone="danger" text={s.notice} action={<Button variant="secondary" size="sm" onClick={() => s.setNotice(null)}>باشه</Button>} />}
      {s.queued && (
        <div className="tbl-undo" style={{ ['--undo-ms' as string]: `${s.queued.ms}ms` }}>
          <Banner tone="info" icon="clock" text="حرکت شما تا لحظه‌ای دیگر ثبت می‌شود." action={<Button size="sm" variant="secondary" onClick={s.cancelQueued}>انصراف</Button>} />
          <span className="tbl-undo__bar" aria-hidden />
        </div>
      )}
      {s.pending && (s.pending.status === 'sending'
        ? <Banner tone="info" icon="send" text="در حال ارسال حرکت…" />
        : <Banner tone="warning" icon="clock" text="در انتظار تأیید: پاسخ سرور نرسید. وضعیت حرکت پیگیری می‌شود."
            action={<span className="bgv-row"><Button size="sm" variant="secondary" onClick={s.resendPending}>ارسال دوباره همین حرکت</Button><Button size="sm" variant="ghost" onClick={s.dropPending}>نمایش آخرین وضعیت</Button></span>} />)}
    </div>
  );

  const chatPanel = (props: { sheet?: boolean; onClose?: () => void; className: string }): ReactNode =>
    <ChatPanel {...props} load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" quick={isPlayer} readOnly={!isPlayer}
      people={t.seats.filter((x) => x.user).map((x) => x.user!.displayName)} events={gameEvents} quickOnly={quickFor}
      sub={isPlayer ? `${faNum(t.seats.length)} بازیکن${t.spectators ? `، ${faNum(t.spectators)} تماشاگر` : ''}` : 'شما تماشاگرید'} />;

  const turnWho = g.pendingSeats.length === 1 ? g.pendingSeats[0]! : null;
  const turnSeat = turnWho !== null ? t.seats.find((x) => x.seat === turnWho) : undefined;

  return (
    <div ref={gameRef} className={full.max ? 'tbl tbl--max' : 'tbl'}>
      <TableScreen desk className={hasChat ? 'tbl-screen' : 'tbl-screen tbl-screen--nochat'}>
        <GameBar title={t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa} latin={t.gameNameOriginal} onBack={() => navigate('/')} backLabel="بازگشت به خانه"
          meta={[...(finished ? [<Badge key="end" size="sm" icon="flag">بازی تمام شد</Badge>] : []), ...(!isPlayer && !finished ? [<Badge key="w" size="sm" icon="eye">تماشا</Badge>] : []), ...tableMeta(t),
            ...(t.spectators > 0 ? [<Spectators key="sp" count={t.spectators} showLabel />] : []),
            <Connection key="c" state={s.live ? 'ok' : 'lost'} label={s.live ? 'متصل' : 'قطع'} />]}
          actions={<>
            {!isPlayer && !finished && <Button variant="secondary" size="sm" icon="log-out" iconOnly={!notPhone} onClick={() => navigate('/tables')}>ترک تماشا</Button>}
            {hasChat && isPlayer && <QuickChatButton post={`/tables/${t.id}/chat`} only={quickFor} />}
            <Button variant="ghost" iconOnly icon={full.on ? 'minimize' : 'maximize'} pressed={full.on} onClick={() => void full.toggle()}>{full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</Button>
            {hasChat && <Button className="tbl-chatbtn" variant="ghost" iconOnly icon="message-circle" count={unread} onClick={() => setChat(true)}
              aria-label={`گفت‌وگوی میز${isPlayer ? '' : ' (فقط خواندنی)'}${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}>گفت‌وگوی میز</Button>}
            <Button variant="ghost" iconOnly icon="more-vertical" onClick={() => setDrawer(true)}>بازیکنان و قوانین</Button>
          </>} />

        <Hud layout={notPhone ? 'rail' : players.length === 2 && finished ? 'duel' : players.length <= 5 ? 'strip' : 'grid3'} className="tbl-rail" label="بازیکنان" players={players}>
          {sum?.moves && sum.moves.length > 0 && <MoveLog className="tbl-moves" label="حرکت‌ها"
            items={sum.moves.map((m, i) => ({ seat: seatNo(m.seat), name: <bdi>{name(m.seat)}</bdi>, text: <bdi>{m.text}</bdi>, isNew: i === sum.moves!.length - 1 }))} />}
          {finished && t.mySeat !== null && !t.isTutorial && <PostGame snap={snap} onReport={() => setReporting(true)} />}
        </Hud>

        <Felt as="main" className="tbl-felt" label={`صفحهٔ بازی ${t.gameNameFa}`}
          top={!finished ? <>
            <TurnPill mine={myTurn} {...(turnSeat ? { seat: seatNo(turnSeat.seat), who: name(turnSeat.seat), avatar: seatAvatar(turnSeat, name(turnSeat.seat)) }
              : { simul: g.pendingSeats.length > 1 ? `${faNum(t.seats.length - g.pendingSeats.length)} از ${faNum(t.seats.length)} آماده` : statusText })}
              {...(t.mySeat === null ? { text: statusText } : {})}
              {...(clockProps ? { clock: clockProps } : {})} />
            {g.deadline?.frozen && <FeltPlate icon="lock" label="زمان منجمد (توقف سراسری)" />}
            {shared.length > 0 && <span className="bgv-row tbl-shared">{shared.map((p) => (
              <FeltPlate key={p.key} label={p.label} value={p.max !== undefined ? `${faNum(Number(p.value))}/${faNum(p.max)}` : p.value} />
            ))}</span>}
          </> : undefined}
          stage={<div data-theme="dark" data-game={t.gameId} data-hud={g.summary ? 'on' : undefined} className={myTurn ? 'table-night tbl-stage tbl-stage--mine' : 'table-night tbl-stage'}>
            {Renderer
              ? <DockSlotHost value={g.tutorial ? null : toDock}><Renderer view={g.view as never} legalActions={g.legalActions} mySeat={t.mySeat} seatName={name} busy={busy} onAction={CONFIRMS_IN_RENDERER.has(t.clientBundleRef) ? (a) => s.act(a, true) : s.act} expected={g.tutorial?.expected ?? null} queued={s.queued?.cmd.action ?? s.pending?.action ?? null} sending={s.pending?.action ?? null} /></DockSlotHost>
              : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست" text={<>این میز با نسخه <bdi dir="ltr">{t.clientBundleRef}</bdi> شروع شده است که در این نسخه از برنامه وجود ندارد.</>} />}
          </div>}>
          {finished && g.result && !hideResult && <div className="tbl-result-wrap"><ResultCard snap={snap} onHide={() => setHideResult(true)} onSnap={s.accept} /></div>}
        </Felt>

        {!netOnline && !finished && <Banner className="tbl-offline" tone="danger" icon="wifi-off" title="اتصال شما قطع شد"
          text="کنش‌ها تا اتصال دوباره قفل است؛ ساعت آخرین زمان تأییدشده را نشان می‌دهد."
          action={<Button size="sm" icon="refresh-cw" onClick={() => window.location.reload()}>تلاش دوباره</Button>} />}
        {myTurn && t.pace === 'live' && clock?.state === 'critical' && <CritBar seconds={clock.time} total={10} />}
        {(() => {
          const n = sum?.seats.find((x) => x.seat === t.mySeat)?.strikes ?? 0;
          return !finished && n > 0 && sum?.strikesMax ? <Banner className="tbl-strikes" tone="danger" icon="alarm-clock"
            text={`اخطار زمان ${faNum(n)} از ${faNum(sum.strikesMax)}`} /> : null;
        })()}
        <ActionDock className="tbl-dock" waiting={!myTurn && !finished}
          prompt={<span className="tbl-prompt" role="status" aria-live="polite">
            <Icon name={finished ? 'flag' : myTurn ? 'play' : 'hourglass'} />
            <strong>{statusText}</strong>
          </span>}
          {...(clockProps && myTurn ? { clock: { ...clockProps, sub: clockProps.state === 'critical' ? 'عجله کنید' : clockProps.state === 'warn' ? 'نیمی گذشت'
            : clockProps.state === 'stale' ? 'در حال اتصال' : g.pendingSeats.length > 1 ? 'مهلت مشترک' : 'زمان شما' } } : {})}
          actions={<>
            <span ref={setDockNode} className="tbl-dockslot" />
            {g.tutorial && !finished && <>
              <Button size="sm" variant="ghost" icon="rotate-ccw" disabled={tutorialBusy} onClick={() => tutorial('start')}>از اول</Button>
              <Button size="sm" variant="ghost" icon="chevron-left" disabled={tutorialBusy} onClick={() => tutorial('skip')}>رد کردن آموزش</Button>
            </>}
            {finished && hideResult && g.result && <Button size="sm" variant="secondary" icon="trophy" onClick={() => setHideResult(false)}>نتیجهٔ بازی</Button>}
          </>}>
          {!isPlayer && !finished && hasChat && !wide && (
            <button type="button" className="tbl-chatpeek" onClick={() => setChat(true)} aria-label={`گفت‌وگوی میز${unread ? `، ${faNum(unread)} پیام تازه` : ''}`}>
              <Icon name="message-circle" size="sm" />
              <span className="tbl-chatpeek__text">{last ? <><b><bdi>{last.name}</bdi>:</b> {last.text}</> : 'گفت‌وگوی میز؛ تماشاگرها فقط می‌خوانند'}</span>
              {unread > 0 && <Badge tone="count" size="sm">{faNum(unread)}</Badge>}
            </button>
          )}
          {g.tutorial && !finished && (
            <div className="tbl-tutorial" aria-labelledby="tut-h">
              <b id="tut-h" className="t-label">آموزش: مرحله {faNum(Math.min(g.tutorial.step + 1, g.tutorial.total))} از {faNum(g.tutorial.total)}</b>
              {g.tutorial.step === 0 && <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>{g.tutorial.introFa}</p>}
              <p className="t-body-sm" style={{ margin: 0, fontWeight: 700 }}>{g.tutorial.instructionFa}</p>
            </div>
          )}
        </ActionDock>

        {hasChat && wide && chatPanel({ className: 'tbl-chat' })}
      </TableScreen>

      {createPortal(pops, (full.on && document.fullscreenElement) || document.body)}

      {chat && !wide && hasChat && (
        <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChat(false); }}>
          {chatPanel({ sheet: true, onClose: () => setChat(false), className: 'tbl-chatsheet' })}
        </div>
      )}
      {drawer && (
        <div className="tbl-overlay tbl-overlay--side" onClick={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <Sheet side title="بازیکنان و قوانین" icon="users" onClose={() => setDrawer(false)} aria-modal="true" aria-label="بازیکنان و قوانین">
            <div className="bgv-stack">
              <Hud layout="rail" players={players} label="بازیکنان" />
              <Policies table={t} />
              {canResign && <Button variant="leave" icon="flag" block onClick={() => { setDrawer(false); setConfirmResign(true); }}>انصراف از بازی</Button>}
              {t.mySeat !== null && !t.isTutorial && <Button variant="ghost" icon="flag" block onClick={() => { setDrawer(false); setReporting(true); }}>گزارش این میز</Button>}
            </div>
          </Sheet>
        </div>
      )}
      {isPlayer && t.pace === 'turn' && !finished && !t.isTutorial && <NotifyPrompt />}
      {sheetSeat !== null && (() => {
        const x = t.seats.find((y) => y.seat === sheetSeat);
        const ss = sum?.seats.find((y) => y.seat === sheetSeat);
        if (!x) return null;
        const n = name(x.seat);
        return (
          <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSheetSeat(null); }}>
            <Sheet className="tbl-playersheet" title={<bdi>{n}</bdi>} onClose={() => setSheetSeat(null)} closeLabel="بستن"
              footer={x.user && x.seat !== t.mySeat ? <>
                <Button size="sm" icon="user" href={`/users/${x.user.id}`}>پروفایل</Button>
                <Button size="sm" variant="ghost" icon="flag" onClick={() => { setSheetSeat(null); setReporting(true); }}>گزارش</Button>
              </> : undefined}>
              <div className="bgv-stack" style={{ gap: 'var(--space-3)' }}>
                <div className="bgv-row" style={{ gap: 8 }}>
                  {x.league && <League tier={x.league} />}
                  {x.titleKey && cosmetic(x.titleKey) && <Badge size="sm">{cosmetic(x.titleKey)!.nameFa}</Badge>}
                  {x.bot && <Badge size="sm" icon="cpu">ربات {BOT_LEVEL_FA[x.bot.level]}</Badge>}
                  {x.seat === t.mySeat && <Badge tone="you" size="sm">شما</Badge>}
                </div>
                {ss?.primary && <div className="tbl-sheetrow"><span>{ss.primary.label}</span><b className="bgv-num">{faNum(ss.primary.value)}{ss.primary.target !== undefined ? ` از ${faNum(ss.primary.target)}` : ''}</b></div>}
                {ss?.stats?.map((st) => <div key={st.key} className="tbl-sheetrow"><span>{st.label}</span><b className="bgv-num">{typeof st.value === 'number' ? faNum(st.value) : st.value}</b></div>)}
                {ss?.strikes !== undefined && sum?.strikesMax ? <div className="tbl-sheetrow"><span>اخطار زمان</span><b>{faNum(ss.strikes)} از {faNum(sum.strikesMax)}</b></div> : null}
                {ss?.badges?.length ? <div className="bgv-row">{ss.badges.map((b) => <Badge key={b.key} size="sm" tone={b.tone ?? 'neutral'}>{b.label}</Badge>)}</div> : null}
                {!ss && <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>این بازی خلاصهٔ عمومی بازیکن ندارد.</p>}
              </div>
            </Sheet>
          </div>
        );
      })()}
      {reporting && <ReportDialog targetType="table" targetId={t.id} label="میز" onClose={() => setReporting(false)} />}
      {confirmResign && (
        <Dialog modal danger icon="flag" title="انصراف از بازی؟" onClose={() => setConfirmResign(false)}
          footer={<><Button variant="secondary" onClick={() => setConfirmResign(false)}>ادامه بازی</Button>
            <Button variant="leave" onClick={() => { setConfirmResign(false); s.act({ type: 'resign' }, true); }}>انصراف قطعی</Button></>}>
          {t.policies.resignFa} این کار قابل بازگشت نیست.
        </Dialog>
      )}
    </div>
  );
}

/** ≥1200px: the chat is docked beside the felt; below it opens as a sheet (never resizes the table). */
function useWide(minPx = 1200) {
  const q = `(min-width: ${minPx}px)`;
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return wide;
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
    return <StateBlock kind="denied" title="برای دیدن میز وارد شوید" action={<Button variant="primary" href={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>ورود</Button>} />;
  }
  if (s.loadError?.status === 403) return <StateBlock kind="denied" title="به این میز دسترسی ندارید" text="این میز خصوصی است. برای پیوستن، از میزبان لینک دعوت بگیرید." />;
  if (s.loadError?.status === 404) return <StateBlock kind="empty" title="این میز پیدا نشد" action={<Button variant="secondary" href="/tables">میزهای باز</Button>} />;
  if (s.loadError && !snap) return <StateBlock kind="error" title="میز بارگذاری نشد" text={s.loadError.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={() => void s.reload()}>تلاش دوباره</Button>} />;
  if (!snap) return <StateBlock kind="loading" title="در حال بارگذاری میز…" />;

  const t = snap.table;
  if (t.status !== 'cancelled' && t.status !== 'open' && snap.game) return <GameView s={s} />;
  if (t.status === 'cancelled') return <StateBlock kind="empty" title="این میز لغو شده است" action={<Button variant="secondary" href="/">بازگشت</Button>} />;
  if (t.status === 'open') return <LobbyView snap={snap} invite={invite} onChange={s.accept} />;
  return <StateBlock kind="loading" title="در حال آماده‌سازی بازی…" />;
}
