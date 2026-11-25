import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { type TournamentDetail, BOT_LEVEL_FA, BOT_STYLE_FA, clockClass, clockThresholds, cosmetic, EMOTE_BODY, QUICK_CHAT, parseAvatar, RATING_MODE_FA, type MessageItem, type PublicSummaryView, type TableSnapshot, type UserCard } from '@bg/contracts';
import { DockSlotHost, FrameKindHost, RailSlotHost, useOnline, useToast, type FrameClockState, type TableFrame } from '@bg/ui';
import {
  ActionDock, Avatar, CritBar, Badge, League, MoveLog, Spectators, Banner, Breadcrumbs, Button, Card, Connection, Dialog, Felt, FeltPlate, GameBar, Hud, Icon, ListItem, LobbySeat, PageHead,
  LoginSheet, ReadyCheck, Rematch, Result, Sheet, StateBlock, TableScreen, TextField, TurnPill, emojify,
  type AvatarProps, type ClockState, type PlayerCardProps, type RewardProps, type SeatNo
} from '@bg/ui/bgv';
import { usePresence } from '../lib/presence.ts';
import { NotifyPrompt } from '../social/NotifyPrompt.tsx';
import { CONFIRMS_IN_RENDERER, GROUP_FRAME, OWN_FRAME, RENDERERS, SEAT_CARDS } from '../games/renderers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { AvatarArt, frameProps } from '../lib/bgv.tsx';
import { durationFa, faNum, PACE_FA, COMPETITION_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { browserNotificationsEnabled } from '../lib/realtime.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { useTableSession } from '../lib/useTableSession.ts';
import { useTurnAlerts } from '../lib/alerts.ts';
import { clockLabelFa } from '../games/chessClock.ts';
import { ChatPanel, preloadChat, type ChatEvent } from '../social/ChatPanel.tsx';
import { QuickChatButton } from '../social/QuickChat.tsx';
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
  return [PACE_FA[t.pace], clockLabelFa(t.settings.options?.clock) ?? `${durationFa(t.settings.turnSeconds)} هر نوبت`, COMPETITION_FA[t.competition], t.visibility === 'private' ? 'خصوصی' : 'عمومی'];
}

/** Time / timeout / disconnect / resign rules of the table, plus its rule variants. */
function Policies({ table }: { table: Lobby }) {
  return (
    <Card title={<span className="bgv-row"><Icon name="shield" />قوانین زمان و ترک میز</span>}>
      <div className="tbl-rules">
        {!table.isTutorial && <ListItem icon="timer" title={clockLabelFa(table.settings.options?.clock) ?? `${PACE_FA[table.pace]}، ${durationFa(table.settings.turnSeconds)} هر نوبت`} />}
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
  // Invite links keep the long URL: /t/<code> never resolves a private table for someone who is not seated yet.
  const inviteLink = t.inviteCode ? `${location.origin}/tables/${t.id}?invite=${t.inviteCode}` : null;
  const empty = t.capacity - t.seats.length;
  const readyCount = t.seats.filter((s) => s.ready).length;
  const host = t.seats.find((s) => s.user?.id === t.hostId);
  const copy = (link: string) => navigator.clipboard.writeText(link).then(() => toast('success', 'لینک دعوت کپی شد.'), () => toast('error', 'کپی ممکن نشد؛ لینک را دستی انتخاب کنید.'));
  const toInvite = () => document.getElementById('table-invite')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Public tables can always be shared by plain URL; private ones need the invite code.
  const shareLink = inviteLink ?? (t.visibility === 'public' ? `${location.origin}/${t.code ? `t/${t.code}` : `tables/${t.id}`}` : null);
  const phone = !useWide(900);
  const hasLobbyChat = !!me && !t.isTutorial;
  const [chatOpen, setChatOpen] = useState(false);
  const { unread } = useTableChatAlerts(hasLobbyChat ? t.id : null, chatOpen || !phone);

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
      <div className="tbl-head">
        <span className="bgv-box-slot" style={{ '--bgv-box-size': '64px' } as React.CSSProperties}><img className="bgv-box bgv-box--sm" src={`/covers/box/${t.gameId}.webp`} alt="" /></span>
        <PageHead title={<>{t.isTutorial ? `آموزش ${t.gameNameFa}` : host?.user ? <>{t.gameNameFa}، میز <bdi>{host.user.displayName}</bdi></> : t.gameNameFa}
          {' '}<bdi className="tbl-head__latin" lang="en">{t.gameNameOriginal}</bdi></>}
          sub={<span className="bgv-row">{tableMeta(t).map((m, i) => <span key={m} className="bgv-row">{i > 0 && <span className="bgv-sep" />}{m}</span>)}</span>} />
      </div>
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
          {hasLobbyChat && !phone && <ChatPanel className="tbl-lobbychat"load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" />}
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
                {me && <p className="t-body-sm bgv-muted tbl-lobbynote" style={{ margin: 0 }}>با اعلام آمادگی، قوانین زمان و انصراف این میز را می‌پذیرید.</p>}
                {error && <Banner tone="danger" text={error} />}
                <div className="tbl-lobbyacts">{actions}</div>
              </div>
            </Card>
          )}
          {me && !t.isMatchmade && !t.isTutorial
            ? <div id="table-invite"><InvitePanel tableId={t.id} link={shareLink} onCopy={copy} /></div>
            : shareLink && (
              <div id="table-invite"><Card title={<span className="bgv-row"><Icon name="link" />دعوت به میز</span>}>
                <TextField label="لینک دعوت" readOnly value={shareLink} dir="ltr" onFocus={(e) => e.target.select()}
                  end={<Button variant="secondary" size="sm" icon="copy" onClick={() => void copy(shareLink)}>کپی</Button>} />
              </Card></div>
            )}
          <Policies table={t} />
        </div>
      </div>
      <div className="tbl-lobbyroot-pad" aria-hidden />
      {!t.isMatchmade && (
        <div className="tbl-lobbybar" role="group" aria-label="آمادگی">
          {me && <p className="t-caption bgv-muted tbl-lobbybar__note">با اعلام آمادگی، قوانین زمان و انصراف این میز را می‌پذیرید.</p>}
          <div className="tbl-lobbybar__row">
            {hasLobbyChat && <Button variant="secondary" iconOnly icon="message-circle" count={unread} onClick={() => setChatOpen(true)}
              aria-label={`گفت‌وگوی میز${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}>گفت‌وگوی میز</Button>}
            {actions}
          </div>
        </div>
      )}
      {chatOpen && phone && hasLobbyChat && (
        <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChatOpen(false); }}>
          <ChatPanel sheet onClose={() => setChatOpen(false)} className="tbl-chatsheet" load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" />
        </div>
      )}
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
    const url = `${location.origin}/${t.code ? `t/${t.code}` : `tables/${t.id}`}`;
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
  const hasMoves = (snap.game?.summary?.moves?.length ?? 0) > 0;
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
        {addable.map((u) => (
          <Button key={u.id} size="sm" variant="secondary" icon="user-plus" onClick={() => void befriend(u.id)}>
            {rel[u.id] === 'incoming' ? 'پذیرش دوستی' : 'افزودن دوست'}: <bdi>{u.displayName}</bdi>
          </Button>
        ))}
        {t.settings.tournament && others.map((u) => (
          <Button key={`fp-${u.id}`} size="sm" variant="ghost" icon="shield" onClick={() => {
            api(`/tables/${t.id}/report`, { method: 'POST', body: { accusedId: u.id } })
              .then(() => toast('success', 'گزارش برای داور ثبت شد.'), (err: unknown) => toast('error', err instanceof ApiFailure ? err.messageFa : 'گزارش ثبت نشد.'));
          }}>گزارش مشکوک بودن بازی: <bdi>{u.displayName}</bdi></Button>
        ))}
        {hasMoves && <Button size="sm" variant="ghost" icon="history" onClick={() => document.querySelector('.tbl-moves')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>تاریخچهٔ حرکت‌ها</Button>}
        <Button size="sm" variant="ghost" icon="flag" onClick={onReport}>گزارش میز</Button>
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

/** Move notices (incident, errors, undo window, unconfirmed move): float at the top, never push the board around. */
function Pops({ s, snap }: { s: ReturnType<typeof useTableSession>; snap: TableSnapshot }) {
  return (
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
}

/** One seat in a sheet: league, title, score and public stats from the game summary. */
function SeatSheet({ t, sum, seat, name, onClose, onReport }: { t: Lobby; sum: PublicSummaryView | null | undefined; seat: number; name: (seat: number) => string; onClose: () => void; onReport: () => void }) {
  const x = t.seats.find((y) => y.seat === seat);
  const ss = sum?.seats.find((y) => y.seat === seat);
  if (!x) return null;
  const n = name(x.seat);
  return (
    <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Sheet className="tbl-playersheet" title={<bdi>{n}</bdi>} onClose={onClose} closeLabel="بستن"
        footer={x.user && x.seat !== t.mySeat ? <>
          <Button size="sm" icon="user" href={`/users/${x.user.id}`}>پروفایل</Button>
          <Button size="sm" variant="ghost" icon="flag" onClick={onReport}>گزارش</Button>
        </> : undefined}>
        <div className="bgv-stack" style={{ gap: 'var(--space-3)' }}>
          <div className="bgv-row" style={{ gap: 8 }}>
            {x.league && <League tier={x.league} />}
            {x.titleKey && cosmetic(x.titleKey) && <Badge size="sm">{cosmetic(x.titleKey)!.nameFa}</Badge>}
            {x.bot && <Badge size="sm" icon="bot">ربات {BOT_LEVEL_FA[x.bot.level]}</Badge>}
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
}

/** Tournament players: the page being hidden/shown is recorded for fair-play review (stated in the tournament rules). */
function useTournamentFocus(t: Lobby) {
  const inTournament = !!t.settings.tournament;
  useEffect(() => {
    if (!inTournament || t.mySeat === null || t.status !== 'active') return;
    const send = () => { api(`/tables/${t.id}/focus`, { method: 'POST', body: { hidden: document.hidden } }).catch(() => undefined); };
    document.addEventListener('visibilitychange', send);
    return () => document.removeEventListener('visibilitychange', send);
  }, [t.id, inTournament, t.mySeat, t.status]);
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
  // One stable callback per table, so memoized renderers (Gaia) do not re-render on every shell update.
  const { act } = s;
  const confirmsInRenderer = CONFIRMS_IN_RENDERER.has(t.clientBundleRef);
  const onAction = useCallback((a: Parameters<typeof act>[0]) => act(a, confirmsInRenderer), [act, confirmsInRenderer]);
  // Game turn controls (renderers wrap them in <DockSlot>) render into the action dock through this portal.
  const [dockNode, setDockNode] = useState<HTMLSpanElement | null>(null);
  const toDock = useCallback((node: ReactNode) => (dockNode ? createPortal(node, dockNode) : node), [dockNode]);
  // Desktop: a renderer's <RailSlot> content (e.g. its log) goes under the player cards in the rail; on phones it stays in place.
  const [railNode, setRailNode] = useState<HTMLDivElement | null>(null);
  const toRail = useCallback((node: ReactNode) => (railNode ? createPortal(node, railNode) : node), [railNode]);
  // BGA tables put the shell's turn pill (with the clock) into their action bar: the renderer exposes `[data-shell-clock]`.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [clockNode, setClockNode] = useState<Element | null>(null);
  useLayoutEffect(() => { const n = confirmsInRenderer ? stageRef.current?.querySelector('[data-shell-clock]') ?? null : null; if (n !== clockNode) setClockNode(n); });
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
  // BGA-style tables (handoffs: Gaia, TM, Brass, Ark Nova, Blood Rage) have no chat column: chat opens as a sheet from the game bar.
  const wide = useWide() && !confirmsInRenderer;
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
    : !netOnline ? 'کنش‌ها تا اتصال دوباره قفل است'
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
      // The game's own panel body only in the desktop rail; the phone strip keeps compact cards.
      ...(notPhone ? SEAT_CARDS[t.clientBundleRef]?.(ss, active) : {})
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
          style={b ? { "--tbl-bubble": b[0], "--tbl-bubble-ink": b[1] ?? "inherit" } as React.CSSProperties : undefined}><b>{n}:</b> {emojify(words)}</span></>;
      })() } : {}),
      ...(place ? { score: place.score ?? place.place, scoreLabel: place.score !== undefined ? 'امتیاز' : 'رتبه', leader: place.place === 1 } : {}),
      ...(!place && !active && !finished && !ss?.status ? { waiting: queueText(x.seat) } : {}),
      ...(active && !confirmsInRenderer ? { waiting: 'در حال بازی' } : {}) // BGA seat cards carry their own status line
    };
  });
  const shared = sum?.shared ?? [];

  const pops = <Pops s={s} snap={snap} />;

  const chatPanel = (props: { sheet?: boolean; onClose?: () => void; className: string }): ReactNode =>
    <ChatPanel {...props} load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" quick={isPlayer} readOnly={!isPlayer}
      people={t.seats.filter((x) => x.user).map((x) => x.user!.displayName)} events={gameEvents} quickOnly={quickFor}
      sub={isPlayer ? `${faNum(t.seats.length)} بازیکن${t.spectators ? `، ${faNum(t.spectators)} تماشاگر` : ''}` : 'شما تماشاگرید'} />;

  const turnWho = g.pendingSeats.length === 1 ? g.pendingSeats[0]! : null;
  const turnSeat = turnWho !== null ? t.seats.find((x) => x.seat === turnWho) : undefined;

  return (
    <div ref={gameRef} className={full.max ? 'tbl tbl--max' : 'tbl'}>
      <TableScreen desk className={`${hasChat ? 'tbl-screen' : 'tbl-screen tbl-screen--nochat'}${confirmsInRenderer ? ` tbl-screen--bga tbl-screen--${t.gameId}` : ''}`}>
        <div className="tbl-top">
        <GameBar title={t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa} latin={t.gameNameOriginal} onBack={() => navigate('/')} backLabel="بازگشت به خانه"
          meta={[...(!s.live && !finished ? [<Connection key="c" state="lost" label="قطع" />] : []),
            ...(finished ? [<Badge key="end" size="sm" icon="flag">بازی تمام شد</Badge>, COMPETITION_FA[t.competition]] : []),
            ...(!isPlayer && !finished ? [<Badge key="w" size="sm" icon="eye">تماشا</Badge>] : []), ...(finished ? [] : tableMeta(t)),
            ...(t.spectators > 0 ? [<Spectators key="sp" count={t.spectators} showLabel />] : []),
            ...(s.live && !finished ? [<Connection key="c" state="ok" label="متصل" />] : [])]}
          actions={<>
            {!isPlayer && !finished && <Button variant="leave" size="sm" icon="log-out" iconOnly={!notPhone} onClick={() => navigate('/tables')}>ترک تماشا</Button>}
            {isPlayer && <Button variant="leave" size="sm" icon="log-out" iconOnly={!notPhone}
              onClick={() => (canResign ? setConfirmResign(true) : navigate(t.isTutorial ? `/games/${t.gameId}` : '/tables'))}>ترک میز</Button>}
            {hasChat && isPlayer && (notPhone || !confirmsInRenderer) && <QuickChatButton post={`/tables/${t.id}/chat`} only={quickFor} />}
            {(notPhone || !confirmsInRenderer) && <Button variant="ghost" iconOnly icon={full.on ? 'minimize' : 'maximize'} pressed={full.on} onClick={() => void full.toggle()}>{full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</Button>}
            {hasChat && <Button className="tbl-chatbtn" variant="ghost" iconOnly icon="message-circle" count={unread} onClick={() => setChat(true)}
              aria-label={`گفت‌وگوی میز${isPlayer ? '' : ' (فقط خواندنی)'}${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}>گفت‌وگوی میز</Button>}
            <Button variant="ghost" iconOnly icon="more-vertical" onClick={() => setDrawer(true)}>بازیکنان و قوانین</Button>
          </>} />
        {!netOnline && !finished && <Banner className="tbl-offline" tone="danger" icon="wifi-off" title="اتصال شما قطع شد"
          text="کنش‌ها تا اتصال دوباره قفل است؛ ساعت آخرین زمان تأییدشده را نشان می‌دهد."
          action={<Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => window.location.reload()}>تلاش دوباره</Button>} />}
        </div>

        <Hud layout={notPhone ? 'rail' : players.length === 2 && finished ? 'duel' : players.length <= 5 ? 'strip' : 'grid3'} className="tbl-rail" label="بازیکنان" players={players}>
          {notPhone && <div ref={setRailNode} className="tbl-railslot" />}
          {sum?.moves && (sum.moves.length > 0 || confirmsInRenderer) && <MoveLog className="tbl-moves" label="حرکت‌ها"
            items={sum.moves.map((m, i) => ({ seat: seatNo(m.seat), name: <bdi>{name(m.seat)}</bdi>, text: <bdi>{m.text}</bdi>, isNew: i === sum.moves!.length - 1 }))} />}
          {finished && t.mySeat !== null && !t.isTutorial && <PostGame snap={snap} onReport={() => setReporting(true)} />}
        </Hud>

        <Felt as="main" className="tbl-felt" label={`صفحهٔ بازی ${t.gameNameFa}`}
          top={!finished && !clockNode ? <>
            <TurnPill mine={myTurn} {...(turnSeat ? { seat: seatNo(turnSeat.seat), who: name(turnSeat.seat), avatar: seatAvatar(turnSeat, name(turnSeat.seat)) }
              : { simul: g.pendingSeats.length > 1 ? `${faNum(t.seats.length - g.pendingSeats.length)} از ${faNum(t.seats.length)} آماده` : statusText })}
              {...(t.mySeat === null ? { text: statusText } : {})}
              {...(clockProps ? { clock: clockProps } : {})} />
            {g.deadline?.frozen && <FeltPlate icon="lock" label="زمان منجمد (توقف سراسری)" />}
            {shared.length > 0 && !confirmsInRenderer && <span className="bgv-row tbl-shared">{shared.map((p) => (
              <FeltPlate key={p.key} label={p.label} value={p.max !== undefined ? `${faNum(Number(p.value))}/${faNum(p.max)}` : p.value} />
            ))}</span>}
          </> : undefined}
          stage={<div ref={stageRef} data-theme="dark" data-game={t.gameId} data-hud={g.summary ? 'on' : undefined} className={myTurn ? 'table-night tbl-stage tbl-stage--mine' : 'table-night tbl-stage'}>
            {Renderer
              ? <RailSlotHost value={notPhone ? toRail : null}><DockSlotHost value={g.tutorial ? null : toDock}><Renderer view={g.view as never} legalActions={g.legalActions} mySeat={t.mySeat} seatName={name} busy={busy} onAction={onAction} expected={g.tutorial?.expected ?? null} queued={s.queued?.cmd.action ?? s.pending?.action ?? null} sending={s.pending?.action ?? null} /></DockSlotHost></RailSlotHost>
              : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست" text={<>این میز با نسخه <bdi dir="ltr">{t.clientBundleRef}</bdi> شروع شده است که در این نسخه از برنامه وجود ندارد.</>} />}
          </div>}>
          {finished && g.result && !hideResult && <div className="tbl-result-wrap"><ResultCard snap={snap} onHide={() => setHideResult(true)} onSnap={s.accept} /></div>}
        </Felt>
        {clockNode && !finished && createPortal(<TurnPill mine={myTurn} {...(turnSeat ? { seat: seatNo(turnSeat.seat), who: name(turnSeat.seat), avatar: seatAvatar(turnSeat, name(turnSeat.seat)) }
              : { simul: g.pendingSeats.length > 1 ? `${faNum(t.seats.length - g.pendingSeats.length)} از ${faNum(t.seats.length)} آماده` : statusText })}
              {...(t.mySeat === null ? { text: statusText } : {})}
              {...(clockProps ? { clock: clockProps } : {})} />, clockNode)}

        {myTurn && t.pace === 'live' && clock?.state === 'critical' && <CritBar seconds={clock.time} total={10} />}
        {(() => {
          const n = sum?.seats.find((x) => x.seat === t.mySeat)?.strikes ?? 0;
          return !finished && n > 0 && sum?.strikesMax ? <Banner className="tbl-strikes" tone="danger" icon="alarm-clock"
            text={`اخطار زمان ${faNum(n)} از ${faNum(sum.strikesMax)}`} /> : null;
        })()}
        <ActionDock className={confirmsInRenderer && !g.tutorial ? 'tbl-dock tbl-dock--bga' : 'tbl-dock'} waiting={(!myTurn && !finished) || !netOnline}
          prompt={<span className="tbl-prompt" role="status" aria-live="polite">
            <Icon name={finished ? 'flag' : !netOnline ? 'wifi-off' : myTurn ? 'play' : 'hourglass'} />
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
      {sheetSeat !== null && <SeatSheet t={t} sum={sum} seat={sheetSeat} name={name} onClose={() => setSheetSeat(null)} onReport={() => { setSheetSeat(null); setReporting(true); }} />}
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

/** Turn-clock state → clock look of the shared frame (chess clock vocabulary). */
const FRAME_CLOCK: Record<ClockState, string> = { calm: 'run', warn: 'warn', critical: 'crit', stale: 'off', frozen: 'idle', paused: 'idle' };
const fmtClock = (sec: number) => {
  const d = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${faNum(h)}:${d(m)}:${d(sec % 60)}` : `${faNum(m)}:${d(sec % 60)}`;
};
function FrameClock({ sec, state, sm }: { sec: number; state: string; sm?: boolean }) {
  return (
    <span className={sm ? 'gf-clock gf-clock--sm' : 'gf-clock'} data-state={state} role="timer" aria-label={state === 'off' ? 'در حال اتصال دوباره' : 'زمان'}>
      {state === 'off' ? <Icon name="wifi-off" size="sm" /> : <span className="gf-clock__tick" aria-hidden />}
      <span className="gf-clock__t">{fmtClock(sec)}</span>
    </span>
  );
}

/**
 * Shared table frame of groups A–D (design/games/group-a…d, 62 games): game bar | rail (status, guide card, events, actions)
 * | felt (player bars or opponent strip around the renderer) | chat. The renderer draws only the game's own area; the
 * platform data (seats, clocks, summary, result, banners) is the shell's. Renderers learn they are inside through
 * `useInFrame()` and fill the rail's guide card through `<RailSlot>` (packages/ui/src/dock.tsx).
 */
function FrameView({ s, kind: wanted }: { s: ReturnType<typeof useTableSession>; kind: 'duel' | 'seats' }) {
  useImmersive();
  const snap = s.snapshot!;
  const t = snap.table;
  const g = snap.game!;
  const navigate = useNavigate();
  const { act } = s;
  const confirmsInRenderer = CONFIRMS_IN_RENDERER.has(t.clientBundleRef);
  const onAction = useCallback((a: Parameters<typeof act>[0]) => act(a, confirmsInRenderer), [act, confirmsInRenderer]);
  const [dockNode, setDockNode] = useState<HTMLSpanElement | null>(null);
  const [railNode, setRailNode] = useState<HTMLDivElement | null>(null);
  const toDock = useCallback((node: ReactNode) => (dockNode ? createPortal(node, dockNode) : node), [dockNode]);
  const toRail = useCallback((node: ReactNode) => (railNode ? createPortal(node, railNode) : null), [railNode]);
  const [chat, setChat] = useState(false);
  const [sheet, setSheet] = useState<'rules' | 'events' | null>(null);
  const [sheetSeat, setSheetSeat] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [hideResult, setHideResult] = useState(false);
  const Renderer = RENDERERS[t.clientBundleRef];
  const name = seatNameOf(t);
  const finished = t.status === 'finished';
  const canResign = !finished && g.legalActions.some((a) => a.type === 'resign');
  const myTurn = t.mySeat !== null && g.pendingSeats.includes(t.mySeat);
  const isPlayer = t.mySeat !== null;
  const netOnline = useOnline();
  const busy = !!s.pending || !!s.queued || t.status !== 'active' || !!snap.incident || !netOnline;
  const waitingFor = g.pendingSeats.filter((x) => x !== t.mySeat).map(name);
  const wide = useWide();
  const notPhone = useWide(900);
  const { unread, said } = useTableChatAlerts(t.id, chat || wide);
  const gameRef = useRef<HTMLDivElement>(null);
  const full = useFullscreen(gameRef);
  const clock = useTurnClock(s);
  useTurnAlerts(t.id, t.mySeat);
  useTournamentFocus(t);
  // Phone: controls scrolled into view stop clear of the sticky game bar and dock area (their height changes with the turn).
  useEffect(() => {
    const top = gameRef.current?.querySelector<HTMLElement>('.bgv-gamebar');
    const dock = gameRef.current?.querySelector<HTMLElement>('.gf-dockwrap');
    if (notPhone || full.max || !top || !dock) return;
    const html = document.documentElement;
    const sync = () => { html.style.setProperty('--gf-scroll-top', `${top.offsetHeight}px`); html.style.setProperty('--gf-scroll-bottom', `${dock.offsetHeight}px`); };
    const seen = new ResizeObserver(sync);
    seen.observe(top); seen.observe(dock); sync();
    return () => { seen.disconnect(); html.style.removeProperty('--gf-scroll-top'); html.style.removeProperty('--gf-scroll-bottom'); };
  }, [notPhone, full.max]);
  const online = usePresence(finished ? [] : t.seats.map((x) => (x.seat === t.mySeat ? null : x.user?.id)));
  const sum = g.summary;
  const kind = wanted === 'duel' && t.seats.length === 2 ? 'duel' : 'seats';

  const { queued, cancelQueued } = s;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (queued) cancelQueued(); setChat(false); setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queued, cancelQueued]);
  // Events log: newest at the bottom, kept in view.
  const logRef = useRef<HTMLDivElement>(null);
  const moveCount = sum?.moves?.length ?? 0;
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [moveCount, notPhone, sheet]);

  const statusText = finished ? 'بازی تمام شد' : !netOnline ? 'کنش‌ها تا اتصال دوباره قفل است'
    : myTurn ? 'حرکت با شماست' : waitingFor.length ? `منتظر حرکت ${waitingFor.join('، ')}` : 'منتظر حرکت دیگران';
  const quickFor = QUICK_CHAT.map((q) => q.id).filter((id) => (id === 'your_turn' ? !myTurn && !finished : id === 'gg' || id === 'rematch' ? finished : id === 'thinking' ? myTurn : true));
  const leave = () => (canResign ? setConfirmResign(true) : navigate('/tables'));
  const offlineOf = (x: Seat) => s.live && netOnline && !finished && x.seat !== t.mySeat && !!x.user && (x.connected === false || (!!online[x.user.id] && !online[x.user.id]!.online));

  /** Clock of a seat: the chess-style bank when the table has one, else the turn timer on the seat(s) to move. */
  const clockOf = (seat: number): { sec: number; state: string } | null => {
    const c = g.clocks;
    const active = g.pendingSeats.includes(seat) && t.status === 'active';
    if (c) {
      const running = c.running === seat && t.status === 'active';
      const sec = Math.max(0, Math.ceil((running ? (clock?.time ?? 0) * 1000 : c.left[seat] ?? 0) / 1000));
      return { sec, state: running ? FRAME_CLOCK[clock?.state ?? 'calm'] : 'idle' };
    }
    if (active && clock) return { sec: clock.time, state: FRAME_CLOCK[clock.state] };
    return t.pace === 'live' && t.status === 'active' ? { sec: t.settings.turnSeconds, state: 'idle' } : null;
  };
  const placeOf = (seat: number) => g.result?.placements.find((p) => p.seat === seat);
  const bubble = (x: Seat) => {
    const words = x.user ? said[x.user.id] : undefined;
    if (!words) return null;
    const b = seatArt(x, 'chatBubble');
    return <span className="bgv-bubble-float tbl-said" aria-hidden style={b ? { '--tbl-bubble': b[0], '--tbl-bubble-ink': b[1] ?? 'inherit' } as React.CSSProperties : undefined}>{emojify(words)}</span>;
  };
  /** Public stats of a seat from the game summary: primary, stats, badges, status, strikes, result. */
  const metaOf = (x: Seat): ReactNode[] => {
    const ss = sum?.seats.find((y) => y.seat === x.seat);
    const place = placeOf(x.seat);
    const out: ReactNode[] = [];
    if (place) out.push(<Badge key="pl" size="sm" tone={place.place === 1 ? 'success' : 'neutral'} {...(place.place === 1 ? { icon: 'trophy' as const } : {})}>{place.place === 1 ? 'برنده' : `رتبه ${faNum(place.place)}`}</Badge>);
    if (ss?.primary) out.push(<span key="p" className="gf-stat"><b>{faNum(ss.primary.value)}{ss.primary.target !== undefined ? `/${faNum(ss.primary.target)}` : ''}</b> {ss.primary.label}</span>);
    for (const st of ss?.stats ?? []) out.push(<span key={st.key} className="gf-stat"><b>{typeof st.value === 'number' ? faNum(st.value) : st.value}</b> {st.label}</span>);
    for (const b of ss?.badges ?? []) out.push(<Badge key={b.key} size="sm" tone={b.tone ?? 'neutral'}>{b.label}</Badge>);
    if (ss?.status === 'out') out.push(<Badge key="out" size="sm">حذف شد</Badge>);
    if (ss?.status === 'passed') out.push(<Badge key="pass" size="sm">پاس داد</Badge>);
    if (ss?.status === 'done') out.push(<Badge key="done" size="sm" tone="success">آماده</Badge>);
    if (sum?.leaderSeat === x.seat && !place) out.push(<Badge key="lead" size="sm" icon="trophy">پیشتاز</Badge>);
    if (ss?.strikes && sum?.strikesMax) out.push(<Badge key="st" size="sm" tone="danger" icon="alarm-clock">{faNum(ss.strikes)}/{faNum(sum.strikesMax)}</Badge>);
    return out;
  };
  const avatarOf = (x: Seat, size: 'sm' | 'md') => (
    <Avatar size={size} {...seatAvatar(x, name(x.seat))} seat={seatNo(x.seat)} onFelt
      turn={g.pendingSeats.includes(x.seat) && t.status === 'active'} />
  );
  /** Player bar (duel, and «you» in seat games): avatar with seat ring, name, rating, league, stats, clock. */
  const bar = (x: Seat) => {
    const c = clockOf(x.seat);
    const turn = g.pendingSeats.includes(x.seat) && t.status === 'active';
    const gone = sum?.seats.find((y) => y.seat === x.seat)?.status === 'out';
    return (
      <div className={`gf-bar${turn ? ' is-turn' : ''}${gone ? ' is-out' : ''}`} data-seat={x.seat} data-turn={turn || undefined}>
        {avatarOf(x, 'md')}
        <div className="gf-bar__id">
          <span className="gf-bar__name">
            <b><bdi>{name(x.seat)}</bdi></b>
            {x.seat === t.mySeat && <Badge tone="you" size="sm">شما</Badge>}
            {x.bot && <Badge size="sm" icon="bot">ربات</Badge>}
            {x.league && <League tier={x.league} />}
            {typeof x.rating === 'number' && <span className="gf-rating">{faNum(x.rating)}</span>}
            {offlineOf(x) && <span className="gf-pill"><Icon name="wifi-off" size="sm" />آفلاین</span>}
          </span>
          <span className="gf-bar__meta">{metaOf(x)}{bubble(x)}</span>
        </div>
        {c && <FrameClock sec={c.sec} state={c.state} />}
      </div>
    );
  };
  const opponents = t.seats.filter((x) => x.seat !== t.mySeat);
  const strip = (
    <ul className="gf-opps" aria-label="بازیکنان دیگر">
      {opponents.map((x) => {
        const c = clockOf(x.seat);
        const turn = g.pendingSeats.includes(x.seat) && t.status === 'active';
        const gone = sum?.seats.find((y) => y.seat === x.seat)?.status === 'out';
        return (
          <li key={x.seat}>
            <button type="button" className={`gf-seat${turn ? ' is-turn' : ''}${gone ? ' is-out' : ''}`} data-seat={x.seat} data-turn={turn || undefined} onClick={() => setSheetSeat(x.seat)}
              aria-label={`${name(x.seat)}${turn ? '، نوبت اوست' : ''}`}>
              {avatarOf(x, 'sm')}
              <span className="gf-seat__name"><bdi>{name(x.seat)}</bdi></span>
              {c && <FrameClock sec={c.sec} state={c.state} sm />}
              <span className="gf-seat__meta">
                {offlineOf(x) && <span className="gf-pill"><Icon name="wifi-off" size="sm" />آفلاین</span>}
                {!notPhone && x.bot && <Badge size="sm" icon="bot">ربات</Badge>}
                {metaOf(x)}{bubble(x)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  const meSeat = t.seats.find((x) => x.seat === t.mySeat);
  const duelOpp = kind === 'duel' ? (t.seats.find((x) => x.seat !== (t.mySeat ?? 0)) ?? t.seats[1]!) : null;
  const duelMe = kind === 'duel' ? (meSeat ?? t.seats[0]!) : meSeat;

  const turnRow = (
    <div className="gf-turnrow tbl-dock">
      <span ref={setDockNode} className="gf-turn" />
      {finished && hideResult && g.result && <Button className="gf-peek" size="sm" variant="secondary" icon="trophy" onClick={() => setHideResult(false)}>نتیجهٔ بازی</Button>}
    </div>
  );
  const rulesBtn = <Button variant="secondary" icon="shield" onClick={() => setSheet('rules')}>قوانین</Button>;
  const leaveBtn = isPlayer
    ? <Button variant="leave" icon="log-out" onClick={leave}>ترک میز</Button>
    : <Button variant="leave" icon="log-out" onClick={() => navigate('/tables')}>ترک تماشا</Button>;
  const events = sum?.moves && (
    <MoveLog className="tbl-moves" label="رویدادها" items={sum.moves.map((m, i) => ({ seat: seatNo(m.seat), name: <bdi>{name(m.seat)}</bdi>, text: <bdi>{m.text}</bdi>, isNew: i === sum.moves!.length - 1 }))} />
  );
  const turnSeat = g.pendingSeats.length === 1 ? g.pendingSeats[0]! : null;
  const statusLine = (
    <span className="gf-status__t"><i className={myTurn ? 'gf-dot is-mine' : 'gf-dot'} aria-hidden />
      {turnSeat !== null && !myTurn && !finished && netOnline ? <>نوبت <b><bdi>{name(turnSeat)}</bdi></b></> : <b>{statusText}</b>}</span>
  );
  const strikesN = sum?.seats.find((x) => x.seat === t.mySeat)?.strikes ?? 0;
  const chatPanel = (props: { sheet?: boolean; onClose?: () => void; className: string }): ReactNode =>
    <ChatPanel {...props} load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" quick={isPlayer} readOnly={!isPlayer}
      people={t.seats.filter((x) => x.user).map((x) => x.user!.displayName)} quickOnly={quickFor}
      sub={isPlayer ? `${faNum(t.seats.length)} بازیکن${t.spectators ? `، ${faNum(t.spectators)} تماشاگر` : ''}` : 'شما تماشاگرید'} />;

  const rail = (
    <aside className="gf-rail" aria-label="وضعیت و رویدادها">
      <section className="gf-card" role="status" aria-live="polite">{statusLine}</section>
      <div ref={setRailNode} className="gf-guide" />
      {events && (
        <section className="gf-card gf-card--fill" aria-label="رویدادها">
          <h3>رویدادها</h3>
          <div ref={logRef} className="gf-log">{sum!.moves!.length ? events : <p className="gf-note">هنوز حرکتی ثبت نشده است.</p>}</div>
        </section>
      )}
      {finished && isPlayer && !t.isTutorial && <PostGame snap={snap} onReport={() => setReporting(true)} />}
      <div className="gf-actions">{leaveBtn}{rulesBtn}
        <Button variant="ghost" iconOnly icon={full.on ? 'minimize' : 'maximize'} pressed={full.on} onClick={() => void full.toggle()}>{full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</Button>
      </div>
    </aside>
  );

  return (
    <div ref={gameRef} className={full.max ? 'tbl tbl-gf tbl--max' : 'tbl tbl-gf'} data-frame={kind}>
      <GameBar title={t.gameNameFa} latin={t.gameNameOriginal} onBack={() => navigate('/')} backLabel="بازگشت به خانه"
        meta={[...(!s.live && !finished ? [<Connection key="c" state="lost" label="قطع" />] : []),
          ...(finished ? [<Badge key="end" size="sm" icon="flag">بازی تمام شد</Badge>, COMPETITION_FA[t.competition]] : []),
          ...(!isPlayer && !finished ? [<Badge key="w" size="sm" icon="eye">تماشا</Badge>] : []), ...(finished ? [] : tableMeta(t)),
          `${faNum(t.seats.length)} بازیکن`, // group QA: the bar names the player count
          ...(t.spectators > 0 ? [<Spectators key="sp" count={t.spectators} showLabel />] : []),
          ...(s.live && !finished ? [<Connection key="c" state="ok" label="متصل" />] : [])]}
        actions={<>
          {isPlayer && <QuickChatButton post={`/tables/${t.id}/chat`} only={quickFor} />}
          {!notPhone && <Button variant="ghost" iconOnly icon={full.on ? 'minimize' : 'maximize'} pressed={full.on} onClick={() => void full.toggle()}>{full.on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</Button>}
          <Button className="tbl-chatbtn gf-chatbtn" variant="ghost" iconOnly icon="message-circle" count={unread} onClick={() => setChat(true)}
            aria-label={`گفت‌وگوی میز${isPlayer ? '' : ' (فقط خواندنی)'}${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}>گفت‌وگوی میز</Button>
        </>} />
      <div className="gf-banners">
        {!netOnline && !finished && <Banner className="tbl-offline" tone="danger" icon="wifi-off" title="اتصال شما قطع شد"
          text="کنش‌ها تا اتصال دوباره قفل است؛ ساعت آخرین زمان تأییدشده را نشان می‌دهد."
          action={<Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => window.location.reload()}>تلاش دوباره</Button>} />}
        {!finished && strikesN > 0 && sum?.strikesMax ? <Banner className="tbl-strikes" tone="danger" icon="alarm-clock" text={`اخطار زمان ${faNum(strikesN)} از ${faNum(sum.strikesMax)}`} /> : null}
      </div>
      <div className={`gf-body${wide ? ' gf-body--chat' : ''}`}>
        {notPhone && rail}
        <main className="gf-felt" aria-label={`صفحهٔ بازی ${t.gameNameFa}`}>
          <div className="gf-top">{kind === 'duel' ? bar(duelOpp!) : strip}</div>
          <div data-theme="dark" data-game={t.gameId} data-frame={kind} data-rev={g.revision} className={myTurn ? 'table-night gf-stage gf-stage--mine' : 'table-night gf-stage'}>
            {Renderer
              ? <FrameKindHost value={kind}><RailSlotHost value={toRail}><DockSlotHost value={toDock}>
                  <Renderer view={g.view as never} legalActions={g.legalActions} mySeat={t.mySeat} seatName={name} busy={busy} onAction={onAction} expected={null}
                    queued={s.queued?.cmd.action ?? s.pending?.action ?? null} sending={s.pending?.action ?? null} />
                </DockSlotHost></RailSlotHost></FrameKindHost>
              : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست" text={<>این میز با نسخه <bdi dir="ltr">{t.clientBundleRef}</bdi> شروع شده است که در این نسخه از برنامه وجود ندارد.</>} />}
          </div>
          {!notPhone && (
            // Phone: one status line; the guide card opens from the (i) toggle.
            <details className="gf-mstatus">
              <summary role="status" aria-live="polite">{statusLine}<Icon name="info" size="sm" /></summary>
              <div ref={setRailNode} className="gf-guide" />
            </details>
          )}
          {notPhone && turnRow}
          {notPhone && duelMe && (kind === 'duel' || isPlayer) && <div className="gf-bottom">{bar(duelMe)}</div>}
          {finished && g.result && !hideResult && <div className="gf-over"><ResultCard snap={snap} onHide={() => setHideResult(true)} onSnap={s.accept} /></div>}
        </main>
        {wide && chatPanel({ className: 'tbl-chat gf-chat' })}
      </div>
      {!notPhone && (
        <div className="gf-dockwrap">
        {turnRow /* phone: the game's actions, then the own bar, then the dock (references) */}
        {duelMe && (kind === 'duel' || isPlayer) && <div className="gf-bottom">{bar(duelMe)}</div>}
        <nav className="gf-dock" aria-label="میز">
          <button type="button" onClick={() => setChat(true)} aria-label={`گفت‌وگوی میز${isPlayer ? '' : ' (فقط خواندنی)'}${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}><Icon name="message-circle" size="md" /><span aria-hidden>گفت‌وگو</span>{unread > 0 && <Badge tone="count" size="sm">{faNum(unread)}</Badge>}</button>
          <button type="button" onClick={() => setSheet('events')}><Icon name="list" size="md" /><span>رویدادها</span></button>
          <button type="button" onClick={() => setSheet('rules')}><Icon name="more-horizontal" size="md" /><span>گزینه‌ها</span></button>
        </nav>
        </div>
      )}

      {createPortal(<Pops s={s} snap={snap} />, (full.on && document.fullscreenElement) || document.body)}
      {myTurn && t.pace === 'live' && clock?.state === 'critical' && <CritBar seconds={clock.time} total={10} />}
      {chat && !wide && (
        <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChat(false); }}>
          {chatPanel({ sheet: true, onClose: () => setChat(false), className: 'tbl-chatsheet' })}
        </div>
      )}
      {sheet && (
        <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <Sheet className="gf-sheet" title={sheet === 'rules' ? 'قوانین و ترک میز' : 'رویدادها'} icon={sheet === 'rules' ? 'shield' : 'list'} onClose={() => setSheet(null)} closeLabel="بستن">
            {sheet === 'rules' ? (
              <div className="bgv-stack">
                <Policies table={t} />
                {finished && isPlayer && !t.isTutorial && <PostGame snap={snap} onReport={() => { setSheet(null); setReporting(true); }} />}
                {canResign && <Button variant="leave" icon="flag" block onClick={() => { setSheet(null); setConfirmResign(true); }}>انصراف از بازی</Button>}
                {isPlayer && !t.isTutorial && <Button variant="ghost" icon="flag" block onClick={() => { setSheet(null); setReporting(true); }}>گزارش این میز</Button>}
                <Button variant="leave" icon="log-out" block onClick={() => { setSheet(null); if (isPlayer) leave(); else navigate('/tables'); }}>{isPlayer ? 'ترک میز' : 'ترک تماشا'}</Button>
              </div>
            ) : <div ref={logRef} className="gf-log gf-log--sheet">{moveCount ? events : <p className="gf-note">هنوز حرکتی ثبت نشده است.</p>}</div>}
          </Sheet>
        </div>
      )}
      {isPlayer && t.pace === 'turn' && !finished && <NotifyPrompt />}
      {sheetSeat !== null && <SeatSheet t={t} sum={sum} seat={sheetSeat} name={name} onClose={() => setSheetSeat(null)} onReport={() => { setSheetSeat(null); setReporting(true); }} />}
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

/** «بلیتس ۵ دقیقه»، «بلیتس ۳ + ۲» from the table's chess clock option. */
function timeLabel(t: Lobby): string | null {
  const v = (t.settings as { options?: { clock?: unknown } }).options?.clock;
  const cls = clockClass(v);
  const m = typeof v === 'string' ? /^(\d+)(?:\/\d+)?\+(\d+)$/.exec(v) : null;
  if (!cls || !m) return null;
  return `${RATING_MODE_FA[cls]} ${m[2] === '0' ? `${faNum(Number(m[1]))} دقیقه` : `${faNum(Number(m[1]))} + ${faNum(Number(m[2]))}`}`;
}

/**
 * Table for games that draw their own frame (chess, design/games/chess): game bar + the renderer (rail and felt with
 * player bars, clocks and the phone dock) + the docked chat (≥1200) or a chat sheet. The shell only passes platform
 * data through `frame`; the server stays the authority for time, result and eligibility.
 */
function OwnFrameView({ s }: { s: ReturnType<typeof useTableSession> }) {
  useImmersive();
  const snap = s.snapshot!;
  const t = snap.table;
  const g = snap.game!;
  const navigate = useNavigate();
  const toast = useToast();
  const { act } = s;
  // Chess has no undo window (chess.com): a move, premove included, is sent the instant it is made, and the renderer shows
  // it from `queued` at once (optimistic); a refusal arrives as `frame.rejected`.
  const onAction = useCallback((a: Parameters<typeof act>[0]) => act(a, true), [act]);
  const Renderer = RENDERERS[t.clientBundleRef];
  const name = seatNameOf(t);
  const finished = t.status === 'finished';
  const aborted = t.status === 'cancelled' && !!g.clocks?.aborted;
  const isPlayer = t.mySeat !== null;
  const netOnline = useOnline();
  const live = s.live && netOnline;
  const busy = !!s.pending || !!s.queued || t.status !== 'active' || !!snap.incident || !netOnline;
  const wide = useWide();
  const [chat, setChat] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const { unread } = useTableChatAlerts(t.id, chat || wide);
  useTurnAlerts(t.id, t.mySeat);
  const myTurn = t.mySeat !== null && g.pendingSeats.includes(t.mySeat);
  const botGame = !!t.settings.bot;
  const notice = useFrameNotice(snap, name);
  // Tournament players: the page being hidden/shown is recorded for fair-play review (stated in the tournament rules).
  const inTournament = !!t.settings.tournament;
  useEffect(() => {
    if (!inTournament || t.mySeat === null || t.status !== 'active') return;
    const send = () => { api(`/tables/${t.id}/focus`, { method: 'POST', body: { hidden: document.hidden } }).catch(() => undefined); };
    document.addEventListener('visibilitychange', send);
    return () => document.removeEventListener('visibilitychange', send);
  }, [t.id, inTournament, t.mySeat, t.status]);
  // Escape cancels a move inside its undo window, and closes the chat sheet.
  const { queued, cancelQueued } = s;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (queued) cancelQueued(); setChat(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queued, cancelQueued]);

  // Clocks (ENGINE.md §2): the server holds the banks; the running one is predicted from its deadline (server time).
  const fast = useRef(false);
  const now = useNow(fast.current ? 100 : 250);
  const c = g.clocks;
  const dueMs = g.deadline ? new Date(g.deadline.dueAt).getTime() - s.clockOffset - now : null;
  const view = g.view as { end?: { kind: string } | null; colors?: string[]; turn?: string } | null;
  const flaggedSeat = view?.end?.kind === 'timeout' && view.colors && view.turn ? view.colors.indexOf(view.turn) : null;
  const warnMs = c ? clockThresholds(c.initialMs / 1000).warningLeft * 1000 : 0;
  const clocks: TableFrame['clocks'] = c ? t.seats.map((x) => {
    const running = c.running === x.seat && t.status === 'active';
    const first = running && !!c.first;
    const ms = flaggedSeat === x.seat ? 0 : running && !first && dueMs !== null ? Math.max(0, dueMs) : c.left[x.seat] ?? 0;
    // Only while my own connection is live: when I am the one offline, the others' status is stale.
    const off = live && !finished && !aborted && x.seat !== t.mySeat && !!x.user && x.connected === false;
    const state: FrameClockState = flaggedSeat === x.seat ? 'flag' : off ? 'off' : aborted || first ? 'pre'
      : !running ? 'idle' : ms <= 10_000 ? 'crit' : ms <= warnMs ? 'warn' : 'run';
    return { ms, state, ...(first ? { first: true, firstMs: Math.max(0, dueMs ?? 0) } : {}) };
  }) : null;
  fast.current = !!clocks?.some((x) => x.state === 'crit');

  const frame: TableFrame = {
    seats: t.seats.map((x) => {
      const n = name(x.seat);
      return { seat: x.seat, name: n, avatar: <Avatar size="md" {...seatAvatar(x, n)} />, rating: x.rating ?? null, league: x.league ?? null, bot: !!x.bot,
        offline: live && !finished && x.seat !== t.mySeat && !!x.user && x.connected === false };
    }),
    clocks, live, finished, aborted,
    timeLabel: timeLabel(t) ?? undefined,
    recordHref: finished ? `/api/tables/${t.id}/record` : undefined,
    result: (finished || aborted) ? <OwnFrameResult snap={snap} onSnap={s.accept} onReport={() => setReporting(true)} toast={toast} /> : undefined,
    openChat: wide && !botGame ? undefined : () => setChat(true),
    unread,
    rejected: s.rejection, notice,
    tournament: t.settings.tournament ? <OwnFrameTournament id={t.settings.tournament.id} round={t.settings.tournament.round} meId={t.seats.find((x) => x.seat === t.mySeat)?.user?.id} /> : undefined
  };

  const chatPanel = (props: { sheet?: boolean; onClose?: () => void; className: string }): ReactNode =>
    <ChatPanel {...props} load={`/tables/${t.id}/chat`} post={`/tables/${t.id}/chat`} title="گفت‌وگوی میز" quick={isPlayer} readOnly={!isPlayer}
      people={t.seats.filter((x) => x.user).map((x) => x.user!.displayName)}
      quickOnly={QUICK_CHAT.map((q) => q.id).filter((id) => (id === 'your_turn' ? !myTurn && !finished : id === 'gg' || id === 'rematch' ? finished : id === 'thinking' ? myTurn : true))}
      sub={isPlayer ? `${faNum(t.seats.length)} بازیکن${t.spectators ? `، ${faNum(t.spectators)} تماشاچی` : ''}` : 'شما تماشاچی هستید'} />;

  return (
    <div className="tbl tbl-own">
      <GameBar title={t.gameNameFa} latin={t.gameNameOriginal} onBack={() => navigate('/')} backLabel="بازگشت به خانه"
        meta={[...(frame.timeLabel ? [frame.timeLabel] : []), COMPETITION_FA[t.competition],
          ...(finished || aborted ? [<Badge key="end" size="sm" icon="flag">بازی تمام شد</Badge>] : []),
          ...(!isPlayer && !finished ? [<Badge key="w" size="sm" icon="eye">تماشا</Badge>] : []),
          ...(t.spectators > 0 ? [<span key="sp" className="bgv-row"><Spectators count={t.spectators} aria-label={`${faNum(t.spectators)} تماشاچی`} />تماشاچی</span>] : []),
          ...(!live && !finished && !aborted ? [<Connection key="c" state="lost" label="در حال اتصال" />] : [])]}
        actions={<>
          {!isPlayer && !finished && <Button variant="leave" size="sm" icon="log-out" onClick={() => navigate('/tables')}>ترک تماشا</Button>}
          {!wide && <Button className="tbl-chatbtn" variant="ghost" iconOnly icon="message-circle" count={unread} onClick={() => setChat(true)}
            aria-label={`گفت‌وگوی میز${isPlayer ? '' : ' (فقط خواندنی)'}${unread > 0 ? `، ${faNum(unread)} پیام تازه` : ''}`}>گفت‌وگوی میز</Button>}
          {isPlayer && !t.isTutorial && <Button variant="ghost" iconOnly icon="flag" onClick={() => setReporting(true)}>گزارش این میز</Button>}
        </>} />
      {(snap.incident || s.notice || s.pending || notice?.kind === 'drawDeclined') && (
        <div className="tbl-pops tbl-pops--own">
          {snap.incident && <Banner tone="warning" icon="lock" title="توقف سراسری" text={`${snap.incident.reasonFa}. موعدها پس از رفع مشکل جبران می‌شوند.`} />}
          {notice?.kind === 'drawDeclined' && <Banner tone="info" icon="handshake" text={notice.text} />}
          {s.notice && <Banner tone="danger" text={s.notice} action={<Button variant="secondary" size="sm" onClick={() => s.setNotice(null)}>باشه</Button>} />}
          {s.pending && s.pending.status !== 'sending' && <Banner tone="warning" icon="clock" text="در انتظار تأیید: پاسخ سرور نرسید."
            action={<span className="bgv-row"><Button size="sm" variant="secondary" onClick={s.resendPending}>ارسال دوباره</Button><Button size="sm" variant="ghost" onClick={s.dropPending}>نمایش آخرین وضعیت</Button></span>} />}
        </div>
      )}
      <div className={wide && !botGame ? 'tbl-own__body tbl-own__body--chat' : 'tbl-own__body'} data-game={t.gameId}>
        {finished && isPlayer && t.settings.tournament && !showBoard
          ? <BetweenRounds tournamentId={t.settings.tournament.id} round={t.settings.tournament.round} tableId={t.id} meId={t.seats.find((x) => x.seat === t.mySeat)?.user?.id} onBoard={() => setShowBoard(true)} />
          : Renderer
          ? <Renderer view={g.view as never} legalActions={g.legalActions} mySeat={t.mySeat} seatName={name} busy={busy} onAction={onAction}
              expected={null} queued={s.queued?.cmd.action ?? s.pending?.action ?? null} sending={s.pending?.action ?? null} frame={frame} />
          : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست" text={<>این میز با نسخه <bdi dir="ltr">{t.clientBundleRef}</bdi> شروع شده است که در این نسخه از برنامه وجود ندارد.</>} />}
        {wide && !botGame && chatPanel({ className: 'tbl-chat tbl-own__chat' })}
      </div>
      {chat && (!wide || botGame) && (
        <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChat(false); }}>
          {chatPanel({ sheet: true, onClose: () => setChat(false), className: 'tbl-chatsheet' })}
        </div>
      )}
      {isPlayer && t.pace === 'turn' && !finished && <NotifyPrompt />}
      {reporting && <ReportDialog targetType="table" targetId={t.id} label="میز" onClose={() => setReporting(false)} />}
    </div>
  );
}

/**
 * Between two rounds (design/games/chess P16): the round's result and my score, the next opponent with board and colour
 * (when the pairing exists), the countdown to the next round, «آماده‌ام», and the standings. The next table opens by itself.
 */
function BetweenRounds({ tournamentId, round, tableId, meId, onBoard }: { tournamentId: string; round: number; tableId: string; meId?: string; onBoard: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const tour = useApi<TournamentDetail>(`/tournaments/${tournamentId}`);
  const now = useNow();
  const { reload } = tour;
  useEffect(() => { const i = setInterval(reload, 5000); return () => clearInterval(i); }, [reload]);
  const d = tour.data;
  const nextId = d?.me?.tableId && d.me.tableId !== tableId ? d.me.tableId : null;
  const next = useApi<TableSnapshot>(nextId ? `/tables/${nextId}` : null);
  const { reload: reloadNext } = next;
  useEffect(() => { if (!nextId) return; const i = setInterval(reloadNext, 3000); return () => clearInterval(i); }, [nextId, reloadNext]);
  useEffect(() => { if (nextId && next.data?.table.status === 'active') navigate(`/tables/${nextId}`); }, [nextId, next.data?.table.status, navigate]);
  const [busy, setBusy] = useState(false);
  if (!d) return <StateBlock kind="loading" title="در حال بارگذاری مسابقه…" />;
  const mine = d.standings.find((s) => s.player.id === meId);
  const played = mine ? mine.results.filter((r) => r.round <= round).length : round;
  const nt = next.data?.table;
  const opp = nt?.seats.find((x) => x.user && x.user.id !== meId);
  const mySeatNext = nt?.seats.find((x) => x.user?.id === meId);
  // Colour is known before the start only when the event seats the first player as White.
  const color = mySeatNext && d.options.firstMove === 'host' ? (mySeatNext.seat === 0 ? 'سفید' : 'سیاه') : null;
  const board = nextId ? (d.roundsPlayed.find((r) => r.round === round + 1)?.tables.findIndex((x) => x.tableId === nextId) ?? -1) + 1 : 0;
  const left = d.nextRoundAt ? Math.max(0, Math.ceil((new Date(d.nextRoundAt).getTime() - now) / 1000)) : null;
  const iAmReady = !!mySeatNext?.ready;
  const ready = async () => {
    if (!nextId) return;
    setBusy(true);
    try { await api(`/tables/${nextId}/ready`, { method: 'POST', body: { ready: true } }); reloadNext(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); } finally { setBusy(false); }
  };
  return (
    <div className="tbl-rounds">
      <section className="tbl-rounds__card" aria-labelledby="tbl-rounds-h">
        <p id="tbl-rounds-h" className="tbl-rounds__head"><Icon name="trophy" size="sm" /><span><b>دور {faNum(round)} تمام شد.</b>{mine ? ` امتیاز شما: ${faNum(mine.points)} از ${faNum(played)}` : ''}</span></p>
        {opp ? (
          <div className="tbl-rounds__next">
            <Avatar size="md" {...seatAvatar(opp, opp.user!.displayName)} />
            <div>
              <b>دور {faNum(round + 1)}: شما و <bdi>{opp.user!.displayName}</bdi>{typeof opp.rating === 'number' ? ` (${faNum(opp.rating)})` : ''}</b>
              <span className="t-caption bgv-muted">{[color ? `شما با ${color}` : null, board > 0 ? `میز ${faNum(board)}` : null].filter(Boolean).join('، ')}</span>
            </div>
          </div>
        ) : d.status === 'finished' ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>مسابقه تمام شد.</p>
          : <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>حریف دور بعد بعد از تمام شدن همهٔ میزها مشخص می‌شود.</p>}
        {left !== null && d.status !== 'finished' && (
          <p className="tbl-rounds__count"><span className="t-caption bgv-muted">شروع دور بعد تا</span> <b dir="ltr">{faNum(Math.floor(left / 60))}:{faNum(left % 60).padStart(2, '۰')}</b></p>
        )}
        {nextId && (iAmReady
          ? <p className="t-body-sm" role="status" style={{ margin: 0, textAlign: 'center' }}>آماده‌اید؛ میز دور بعد خودش باز می‌شود.</p>
          : <Button variant="primary" size="lg" icon="check" block loading={busy} onClick={() => void ready()}>آماده‌ام</Button>)}
      </section>
      <section className="tbl-rounds__card" aria-labelledby="tbl-rounds-t">
        <h3 id="tbl-rounds-t" className="tbl-rounds__title">جدول بعد از دور {faNum(round)}</h3>
        <ol className="tbl-rounds__table">
          {d.standings.map((s, i) => (
            <li key={s.player.id} className={s.player.id === meId ? 'is-you' : undefined}>
              <span>{faNum(i + 1)}</span><bdi>{s.player.displayName}{s.player.id === meId ? ' (شما)' : ''}</bdi><span>{faNum(s.points)}</span><span>{s.startRating !== null ? faNum(s.startRating) : ''}</span>
            </li>
          ))}
        </ol>
        <div className="tbl-rounds__links">
          <Button variant="ghost" size="sm" icon="list" href={`/tournaments/${tournamentId}`}>جدول کامل</Button>
          <Button variant="ghost" size="sm" icon="eye" onClick={onBoard}>دیدن صفحهٔ بازی</Button>
        </div>
      </section>
    </div>
  );
}

/** Tournament card (CX-14): the event, «دور X از Y» and the top of the standings (real data from the tournament). */
function OwnFrameTournament({ id, round, meId }: { id: string; round: number; meId?: string }) {
  const { data } = useApi<TournamentDetail>(`/tournaments/${id}`);
  if (!data) return null;
  const top = data.standings.slice(0, 4);
  return (
    <section className="tbl-ownt" aria-label="مسابقه">
      <a className="tbl-ownt__round" href={`/tournaments/${id}`}><Icon name="trophy" size="sm" /><span><b>{data.titleFa}</b>، دور {faNum(round)}{data.rounds ? ` از ${faNum(data.rounds)}` : ''}</span></a>
      {top.length > 0 && (
        <ol className="tbl-ownt__mini">
          {top.map((s, i) => <li key={s.player.id} className={s.player.id === meId ? 'is-you' : undefined}><span>{faNum(i + 1)}</span><bdi>{s.player.displayName}</bdi><b>{faNum(s.points)}</b></li>)}
        </ol>
      )}
    </section>
  );
}

/**
 * Platform events for the chess frame (`frame.notice`): my draw offer was declined (the offer vanished, the game goes on and
 * no move was played: a move by the opponent also ends an offer, but that is not a «رد»), and the opponent asked for a
 * rematch. The renderer plays `notify` once per `seq`; the shell shows the text in the status area.
 */
function useFrameNotice(snap: TableSnapshot, name: (seat: number) => string): TableFrame['notice'] {
  const t = snap.table;
  const view = snap.game?.view as { drawOffer?: number | null; history?: unknown[] } | null | undefined;
  const mine = t.mySeat;
  const offer = view?.drawOffer ?? null;
  const plies = view?.history?.length ?? 0;
  const asked = t.rematch?.votes.some((v) => v.seat !== mine && v.vote === 'yes') && !t.rematch.votes.some((v) => v.seat === mine) && !t.rematch.closed;
  const prev = useRef<{ offer: number | null; plies: number; asked: boolean } | null>(null);
  const [notice, setNotice] = useState<TableFrame['notice']>(null);
  const seq = useRef(0);
  useEffect(() => {
    const p = prev.current;
    prev.current = { offer, plies, asked: !!asked };
    if (!p || mine === null) return;
    const opp = name(1 - mine);
    if (p.offer === mine && offer === null && plies === p.plies && t.status === 'active') setNotice({ seq: ++seq.current, kind: 'drawDeclined', text: `${opp} پیشنهاد مساوی را رد کرد.` });
    else if (!p.asked && asked) setNotice({ seq: ++seq.current, kind: 'rematchOffer', text: `${opp} بازی دوباره می‌خواهد.` });
  }, [offer, plies, asked, mine, t.status]); // eslint-disable-line react-hooks/exhaustive-deps
  // The banner is a short message, not a state: it goes away after a few seconds (the sound already played).
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice((n) => (n === notice ? null : n)), 6000); return () => clearTimeout(id); }, [notice]);
  return notice;
}

/**
 * «بازی دوباره» (CX-11 / CX-15): either player asks; both votes are live (the server pushes every vote) with one shared
 * 30 s countdown that started at the request. The asker waits; the other side gets «قبول / رد». «قبول» opens the new
 * table (same time control, colours swapped by the server) and both players are taken to it.
 */
function OwnFrameRematch({ snap, onSnap }: { snap: TableSnapshot; onSnap: (s: TableSnapshot) => void }) {
  const t = snap.table;
  const r = t.rematch;
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r?.newTableId) navigate(`/tables/${r.newTableId}`); }, [r?.newTableId, navigate]);
  if (!r || t.mySeat === null) return null;
  const name = seatNameOf(t);
  const secs = r.deadline ? Math.max(0, Math.ceil((new Date(r.deadline).getTime() - now) / 1000)) : null;
  const myVote = r.votes.find((v) => v.seat === t.mySeat)?.vote;
  const asker = r.votes.find((v) => v.seat !== t.mySeat && v.vote === 'yes');
  const declined = r.votes.some((v) => v.seat !== t.mySeat && v.vote === 'no');
  if (declined || myVote === 'no') return <p className="tbl-ownres__rating" role="status">{declined ? 'حریف بازی دوباره را رد کرد.' : 'بازی دوباره را رد کردید.'}</p>;
  if (r.closed || secs === 0) return <p className="tbl-ownres__rating" role="status">مهلت بازی دوباره تمام شد.</p>;
  const vote = async (v: 'yes' | 'no') => {
    setBusy(true);
    try { onSnap(await api<TableSnapshot>(`/tables/${t.id}/rematch`, { method: 'POST', body: { vote: v } })); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'درخواست ثبت نشد.'); } finally { setBusy(false); }
  };
  if (!r.votes.length) return <Button variant="primary" icon="refresh-cw" loading={busy} onClick={() => void vote('yes')}>بازی دوباره</Button>;
  const askerName = asker ? name(asker.seat) : '';
  return (
    <Rematch className="tbl-rematch"
      title={asker && !myVote ? <><bdi>{askerName}</bdi> بازی دوباره می‌خواهد.</> : 'منتظر جواب حریف…'}
      note="همان زمان، رنگ‌ها جابه‌جا."
      votes={t.seats.filter((x) => x.kind !== 'script').map((x) => {
        const v = x.bot ? 'yes' : r.votes.find((y) => y.seat === x.seat)?.vote;
        return { name: <bdi>{name(x.seat)}</bdi>, seat: seatNo(x.seat), initials: name(x.seat).charAt(0), you: x.seat === t.mySeat, vote: v ?? 'wait' };
      })}
      {...(secs !== null ? { countdown: { time: secs, p: secs / 30, size: 'chip' as const, label: 'مهلت' } } : {})}
      actions={asker && !myVote ? <>
        <Button variant="primary" icon="check" loading={busy} onClick={() => void vote('yes')}>قبول</Button>
        <Button variant="secondary" icon="x" disabled={busy} onClick={() => void vote('no')}>رد</Button>
      </> : undefined} />
  );
}

/** The platform half of the chess result (CX-11): my rating change, rematch, new opponent, PGN, share and report. */
function OwnFrameResult({ snap, onSnap, onReport, toast }: { snap: TableSnapshot; onSnap: (s: TableSnapshot) => void; onReport: () => void; toast: ReturnType<typeof useToast> }) {
  const t = snap.table;
  const rewards = useRewards(t.id, t.mySeat !== null && t.status === 'finished');
  const d = rewards.data;
  const delta = d?.processed && d.rating ? d.rating.after - d.rating.before : null;
  // Aborted friendly table: «دوباره با همین دوست» reopens the same kind of table (same settings) and invites the same friend.
  const navigate = useNavigate();
  const [again, setAgain] = useState(false);
  const friend = t.visibility === 'private' && t.competition === 'friendly' && !t.settings.bot && !t.settings.tournament && t.mySeat !== null
    ? t.seats.find((x) => x.seat !== t.mySeat && x.kind === 'human' && x.user)?.user ?? null : null;
  const reopen = async () => {
    if (!friend) return;
    setAgain(true);
    try {
      const { id } = await api<{ id: string }>('/tables', { method: 'POST', body: { gameId: t.gameId, pace: t.pace, visibility: 'private', capacity: t.capacity, turnSeconds: t.settings.turnSeconds, reminders: t.settings.reminders, competition: 'friendly', options: t.settings.options ?? {} } });
      await api(`/tables/${id}/invites`, { method: 'POST', body: { userId: friend.id } }).catch(() => undefined);
      navigate(`/tables/${id}`);
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ساخت میز انجام نشد.'); } finally { setAgain(false); }
  };
  const share = async () => {
    const url = `${location.origin}/${t.code ? `t/${t.code}` : `tables/${t.id}`}`;
    try {
      if (navigator.share) await navigator.share({ title: t.gameNameFa, url });
      else { await navigator.clipboard.writeText(url); toast('success', 'لینک بازی کپی شد.'); }
    } catch { /* share sheet dismissed */ }
  };
  return (
    <div className="tbl-ownres">
      {t.mySeat !== null && t.status === 'finished' && t.competition === 'ranked' && (
        d?.processed && d.rating
          ? <p className="tbl-ownres__rating">رتبهٔ شما: <b>{faNum(d.rating.before)} ← {faNum(d.rating.after)}</b> <span className={delta! >= 0 ? 'tbl-ownres__up' : 'tbl-ownres__down'} dir="ltr">({delta! >= 0 ? '+' : '−'}{faNum(Math.abs(delta!))})</span></p>
          : <p className="tbl-ownres__rating" role="status">{rewards.gaveUp ? 'تغییر رتبه بعداً در «پیشرفت» نمایش داده می‌شود.' : 'در حال محاسبهٔ رتبه…'}</p>
      )}
      {t.competition === 'friendly' && t.status === 'finished' && <p className="tbl-ownres__rating">میز دوستانه روی رتبه اثری ندارد.</p>}
      <div className="tbl-ownres__btns">
        {t.status === 'finished' && <OwnFrameRematch snap={snap} onSnap={onSnap} />}
        {t.status === 'cancelled' && friend && <Button variant="primary" icon="refresh-cw" loading={again} onClick={() => void reopen()}>دوباره با همین دوست</Button>}
        <Button variant="secondary" icon="search" href={`/play?game=${t.gameId}`}>حریف جدید</Button>
      </div>
      {t.status === 'finished' && (
        <div className="tbl-ownres__foot">
          <Button variant="ghost" size="sm" icon="download" href={`/api/tables/${t.id}/record`}>PGN</Button>
          <Button variant="ghost" size="sm" icon="share-2" onClick={() => void share()}>اشتراک</Button>
          {t.mySeat !== null && <Button variant="ghost" size="sm" icon="flag" onClick={onReport}>گزارش</Button>}
        </div>
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

/**
 * Guests: the API only serves table snapshots to signed-in users, so the lobby cannot be shown read-only yet
 * (needs a public lobby snapshot endpoint). The login sheet opens in place; its CTA continues on /login and returns here.
 */
function GuestTable() {
  const navigate = useNavigate();
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <div className="tbl-guest"
      onClick={(e) => { if ((e.target as HTMLElement).closest('.bgv-loginsheet .bgv-btn--primary')) navigate(`/login?next=${next}`); }}>
      <PageHead title="لابی میز" sub="برای نشستن پشت این میز، اول وارد شوید." />
      <LoginSheet scrim title="برای نشستن پشت میز وارد شوید" text="بعد از ورود، مستقیم به همین میز برمی‌گردید."
        onClose={() => navigate('/tables')} cta="ورود / ثبت‌نام" />
    </div>
  );
}

/** `id` is given when the page is opened through /t/<code> (TableCodePage resolves the code); /tables/<id> redirects there. */
export function TablePage({ id: idProp }: { id?: string } = {}) {
  const { id: routeId = '' } = useParams();
  const id = idProp ?? routeId;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invite = params.get('invite');
  const { me, status } = useSession();
  const s = useTableSession(id, invite);
  const snap = s.snapshot;
  const code = snap?.table.code;
  const canonical = !!snap && snap.table.code && (snap.table.visibility === 'public' || snap.table.mySeat !== null);
  // Row 10: /tables/<uuid> → /t/<code>. A private table is reachable by code only for its own players (the API refuses
  // anyone else), so a guest holding an invite link stays on the long URL.
  useEffect(() => { if (!idProp && canonical && code) navigate(`/t/${code}${location.search}`, { replace: true }); }, [idProp, canonical, code, navigate]);
  // Table chat is loaded on entry so the sheet opens with messages at once (no «در حال بارگذاری»).
  const chatId = snap && snap.table.mySeat !== null && !snap.table.isTutorial ? snap.table.id : null;
  useEffect(() => { if (chatId) preloadChat(`/tables/${chatId}/chat`); }, [chatId]);
  // The site's bottom navigation never shows on a table page (phones); see table.css.
  useEffect(() => { document.documentElement.dataset.tablepage = 'true'; return () => { delete document.documentElement.dataset.tablepage; }; }, []);
  usePageTitle(snap ? `${snap.table.isTutorial ? 'آموزش' : 'میز'} ${snap.table.gameNameFa}` : 'میز');

  if (status !== 'loading' && !me) {
    return <GuestTable />;
  }
  if (s.loadError?.status === 403) return <StateBlock kind="denied" title="به این میز دسترسی ندارید" text="این میز خصوصی است. برای پیوستن، از میزبان لینک دعوت بگیرید." />;
  if (s.loadError?.status === 404) return <StateBlock kind="empty" title="این میز پیدا نشد" action={<Button variant="secondary" href="/tables">میزهای باز</Button>} />;
  if (s.loadError && !snap) return <StateBlock kind="error" title="میز بارگذاری نشد" text={s.loadError.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={() => void s.reload()}>تلاش دوباره</Button>} />;
  if (!snap) return <StateBlock kind="loading" title="در حال بارگذاری میز…" />;

  const t = snap.table;
  // Games with their own frame (chess): live and finished games, and a game aborted before the first move (shows why).
  if (snap.game && OWN_FRAME.has(t.clientBundleRef) && !t.isTutorial && (t.status === 'active' || t.status === 'finished' || (t.status === 'cancelled' && snap.game.clocks?.aborted))) return <OwnFrameView s={s} />;
  // Groups A–D share one frame (live and finished games; tutorials keep the generic view).
  const frameKind = GROUP_FRAME[t.gameId];
  if (snap.game && frameKind && !t.isTutorial && (t.status === 'active' || t.status === 'finished')) return <FrameView s={s} kind={frameKind} />;
  if (t.status !== 'cancelled' && t.status !== 'open' && snap.game) return <GameView s={s} />;
  if (t.status === 'cancelled') return <StateBlock kind="empty" title="این میز لغو شده است" action={<Button variant="secondary" href="/">بازگشت</Button>} />;
  if (t.status === 'open') return <LobbyView snap={snap} invite={invite} onChange={s.accept} />;
  return <StateBlock kind="loading" title="در حال آماده‌سازی بازی…" />;
}
