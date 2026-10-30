import { useEffect, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { GuestState } from '../shell/GuestState.tsx';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { cosmetic, type Presence, type ProfileCard, type PublicProfile, type TrophyTier, type UserCard } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Badge, Banner, Breadcrumbs, Button, Card, Chip, ChipGroup, Icon, Identity, League, PageHead, ProfileHead, StateBlock, Tabs, TextField, Trophy } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { presenceLine, usePresence } from '../lib/presence.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ReportDialog } from '../social/ReportDialog.tsx';
import { CopyProfileLink } from './MyProfile.tsx';
import { MessageMenu } from '../social/ChatPanel.tsx';
import { InviteCard, referralUrl, rewardFa, useCopy, type Referral } from '../social/InviteCard.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

const phoneMq = '(max-width: 899px)';
const usePhone = () => useSyncExternalStore((cb) => { const m = matchMedia(phoneMq); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); }, () => matchMedia(phoneMq).matches, () => false);

/** Position in the showcase; achievements not in it sort after, keeping their order (stable sort). */
const rank = (showcase: string[], key: string) => { const i = showcase.indexOf(key); return i < 0 ? showcase.length : i; };

interface Friends { friends: PublicProfile[]; incoming: PublicProfile[]; outgoing: PublicProfile[]; blocked: PublicProfile[]; muted: PublicProfile[] }

function useAct(onDone: () => void) {
  const toast = useToast();
  return async (path: string, method: 'POST' | 'DELETE', body?: object, ok?: string) => {
    try { await api(path, { method, ...(body ? { body } : {}) }); if (ok) toast('success', ok); onDone(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
}

/** One person: identity (name links to the profile) with row actions at the end. */
function PersonRow({ p, presence, children }: { p: PublicProfile; presence?: Presence; children?: ReactNode }) {
  const line = presenceLine(presence);
  return (
    <li>
      <Identity {...userIdentity(p, { size: 'lg', name: <a href={`/users/${p.id}`}><bdi>{p.displayName}</bdi></a>,
        ...(presence ? { status: presence.online ? 'online' : 'offline' } : {}), ...(line ? { sub: line } : {}) })} />
      {children && <div className="pf-actions">{children}</div>}
    </li>
  );
}

const People = ({ items, presence, children }: { items: PublicProfile[]; presence?: Record<string, Presence>; children: (p: PublicProfile) => ReactNode }) => (
  <Card flush><ul className="pf-list">{items.map((p) => <PersonRow key={p.id} p={p} presence={presence?.[p.id]}>{children(p)}</PersonRow>)}</ul></Card>
);

function Search({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const res = useApi<{ items: UserCard[] }>(debounced.length >= 2 ? `/users?q=${encodeURIComponent(debounced)}` : null);
  const act = useAct(() => { res.reload(); onChange(); });
  return (
    <div className="bgv-stack" data-tour="friends-search">
      <TextField label="جست‌وجوی بازیکن" type="search" icon="search" value={q} onChange={(e) => setQ(e.target.value)} hint="حداقل دو حرف از نام نمایشی" />
      {res.loading && debounced.length >= 2 && <p className="bgv-muted" role="status">در حال جست‌وجو…</p>}
      {res.data && (res.data.items.length === 0 ? <StateBlock kind="empty" title="بازیکنی پیدا نشد" /> : (
        <People items={res.data.items}>{(p) => {
          const u = p as UserCard;
          return (<>
            {u.relationship === 'none' && <Button size="sm" variant="primary" icon="user-plus" onClick={() => act('/friends/requests', 'POST', { userId: u.id }, 'درخواست دوستی فرستاده شد.')}>افزودن دوست</Button>}
            {u.relationship === 'outgoing' && <Badge icon="check">درخواست فرستاده شد</Badge>}
            {u.relationship === 'incoming' && <Button size="sm" variant="primary" onClick={() => act(`/friends/requests/${u.id}/accept`, 'POST')}>پذیرش</Button>}
            {u.relationship === 'friends' && <Badge tone="success">دوست</Badge>}
            {u.relationship === 'blocked' && <Badge tone="danger">مسدود</Badge>}
          </>);
        }}</People>
      ))}
    </div>
  );
}

/** Invite link + code; whoever signs up through it becomes a friend automatically. */
function Invite() {
  const data = useApi<Referral>('/me/referral');
  const copy = useCopy();
  if (data.error) return <StateBlock kind="error" title="لینک دعوت دریافت نشد" action={<Button variant="primary" onClick={data.reload}>تلاش دوباره</Button>} />;
  if (!data.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const { code, reward, invited } = data.data;
  const url = referralUrl(code);
  const share = async () => {
    try { await navigator.share({ title: 'دعوت به بازی', text: 'بیا با هم بازی کنیم! با این لینک عضو شو:', url }); }
    catch { /* cancelled */ }
  };
  const inviter = reward && rewardFa(reward.inviterCoins, reward.inviterDays);
  const invitee = reward && rewardFa(reward.inviteeCoins, reward.inviteeDays);
  return (
    <div className="bgv-stack">
      <Card title="دعوت دوستان">
        <div className="bgv-stack">
          <p className="t-body-sm bgv-muted">هر کس با لینک یا کد شما عضو شود، خودکار دوست شما می‌شود.</p>
          {(inviter || invitee) && (
            <Banner tone="info" icon="gift">
              {inviter && <>به ازای هر دوستی که عضو شود <strong>{inviter}</strong> هدیه می‌گیرید. </>}
              {invitee && <>دوست شما هم <strong>{invitee}</strong> هدیه می‌گیرد.</>}
            </Banner>
          )}
          <TextField label="لینک دعوت" readOnly dir="ltr" value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="bgv-row">
            <Button variant="primary" icon="copy" onClick={() => copy(url, 'لینک دعوت کپی شد.')}>کپی لینک</Button>
            <Button variant="secondary" onClick={() => copy(code, 'کد دعوت کپی شد.')}>کپی کد <bdi dir="ltr">{code}</bdi></Button>
            {'share' in navigator && <Button variant="ghost" icon="share-2" onClick={share}>اشتراک‌گذاری</Button>}
          </div>
        </div>
      </Card>
      <h2 className="t-h3">دعوت‌شده‌ها ({faNum(invited.length)})</h2>
      {invited.length ? (
        <Card flush><ul className="pf-list">{invited.map((i) => (
          <PersonRow key={i.user.id} p={i.user}>
            {i.reward && rewardFa(i.reward.coins, i.reward.days) && <Badge tone="success">{rewardFa(i.reward.coins, i.reward.days)}</Badge>}
            <span className="t-caption bgv-muted">{jalaliDate(i.createdAt)}</span>
          </PersonRow>))}</ul></Card>
      ) : <StateBlock kind="empty" title="هنوز کسی با لینک شما عضو نشده است" />}
    </div>
  );
}

type FriendsTab = 'friends' | 'requests' | 'find' | 'blocked';

export function FriendsPage() {
  usePageTitle('دوستان');
  const data = useApi<Friends>('/me/friends');
  const presence = usePresence(data.data?.friends.map((f) => f.id) ?? []);
  const [fq, setFq] = useState('');
  const [ff, setFf] = useState<'all' | 'online' | 'playing'>('all');
  const [invited, setInvited] = useState<string[]>([]);
  const navigate = useNavigate();
  const { me } = useSession();
  const mine = useApi<{ items: { id: string; status: string; mySeat: number }[] }>(me ? '/me/tables' : null);
  const [params] = useSearchParams();
  // Friends-Desktop has four tabs; the referral invite lives under «یافتن» (old ?tab=invite links land there).
  const [tab, setTab] = useState<FriendsTab>(params.get('tab') === 'invite' ? 'find' : (params.get('tab') as FriendsTab | null) ?? 'friends');
  const toast = useToast();
  const copy = useCopy();
  const act = useAct(data.reload);
  // «دعوت به میز»: invite to my newest open table; with none open, start one first.
  const inviteToTable = async (userId: string) => {
    const open = mine.data?.items.find((t) => t.status === 'open');
    if (!open) { toast('info', 'اول یک میز بسازید؛ در لابی می‌توانید دوستان را دعوت کنید.'); navigate('/games'); return; }
    try { await api(`/tables/${open.id}/invites`, { method: 'POST', body: { userId } }); setInvited((x) => [...x, userId]); toast('success', 'دعوت به میز فرستاده شد.'); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'دعوت فرستاده نشد.'); }
  };
  const message = async (userId: string) => {
    try { navigate(`/messages/${(await api<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId } })).id}`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'گفت‌وگو باز نشد.'); }
  };
  // The DS tabs are plain buttons; arrow keys move between them (RTL: ArrowLeft = next).
  const arrows = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = tabs[(at + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length]!;
    next.focus(); next.click();
  };
  if (data.error?.status === 401) return <GuestState title="برای دیدن پیام‌ها و دوستان وارد شوید" text="گفت‌وگوها، دوستان و باشگاه‌ها بعد از ورود باز می‌شوند." next="/messages" />;
  if (data.error) return <StateBlock kind="error" title="فهرست دوستان دریافت نشد" action={<Button variant="primary" onClick={data.reload}>تلاش دوباره</Button>} />;
  if (!data.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = data.data;
  return (
    <>
      <PageTabs group="social" />
      <PageHead className="app-hide-phone" title="دوستان" sub={`${faNum(d.friends.length)} دوست، ${faNum(d.friends.filter((f) => presence[f.id]?.online).length)} نفر آنلاین. پیام خصوصی به‌طور پیش‌فرض فقط بین دوستان ممکن است.`}
        actions={<>{me && <CopyProfileLink userId={me.id} />}<Button variant="primary" icon="user-plus" onClick={() => setTab('find')}>افزودن دوست</Button></>} />
      <div onKeyDown={arrows}>
        <Tabs label="دوستان" value={tab} onChange={(v) => setTab(v as FriendsTab)} items={[
          { value: 'friends', label: `دوستان (${faNum(d.friends.length)})` },
          { value: 'requests', label: 'درخواست‌ها', count: d.incoming.length },
          { value: 'find', label: 'یافتن' },
          { value: 'blocked', label: 'مسدود و بی‌صدا' }
        ]} />
      </div>
      {tab === 'friends' && d.incoming.length > 0 && (
        <button type="button" className="bgv-card pf-reqstrip" onClick={() => setTab('requests')}>
          <span className="bgv-avatars" aria-hidden="true">{d.incoming.slice(0, 3).map((f) => <span key={f.id} className="bgv-avatar bgv-avatar--sm">{[...f.displayName][0]}</span>)}</span>
          <span className="pf-reqstrip__text"><b>{faNum(d.incoming.length)} درخواست دوستی</b>
            <span className="t-caption bgv-muted">{d.incoming.slice(0, 3).map((f) => f.displayName).join('، ')}</span></span>
          <Icon name="chevron-left" />
        </button>
      )}
      {tab === 'friends' && (
        <div className="bgv-cols pf-friends">
          <div className="bgv-stack">
            <div className="pf-toolbar">
              <TextField icon="search" type="search" aria-label="جست‌وجو در دوستان" placeholder="جست‌وجو در دوستان" value={fq} onChange={(e) => setFq(e.target.value)} />
              <ChipGroup size="sm" label="نمایش" value={ff} onChange={(v) => setFf(v as typeof ff)}
                options={[{ value: 'all', label: `همه ${faNum(d.friends.length)}` }, { value: 'online', label: `آنلاین ${faNum(d.friends.filter((f) => presence[f.id]?.online).length)}` },
                  { value: 'playing', label: `در حال بازی ${faNum(d.friends.filter((f) => presence[f.id]?.playing).length)}` }]} />
            </div>
            {d.friends.length === 0 ? <StateBlock kind="empty" title="هنوز دوستی ندارید" text="از زبانه «یافتن» بازیکن‌ها را پیدا کنید." action={<Button variant="primary" icon="search" onClick={() => setTab('find')}>یافتن بازیکن</Button>} />
              : ([['online', 'آنلاین'], ['offline', 'آفلاین']] as const).map(([k, label]) => {
                const group = d.friends.filter((f) => !!presence[f.id]?.online === (k === 'online')
                  && (!fq.trim() || f.displayName.includes(fq.trim()))
                  && (ff === 'all' || (ff === 'online' ? !!presence[f.id]?.online : !!presence[f.id]?.playing)));
                return group.length > 0 && (
                  <section key={k} className="bgv-stack" aria-label={label}>
                    <h2 className="t-label bgv-muted" style={{ margin: 0 }}>{label}، {faNum(group.length)}</h2>
                    <People items={group} presence={presence}>{(f) => (<>
                      {presence[f.id]?.playing
                        ? <Button size="sm" variant="secondary" icon="eye" href={`/tables/${presence[f.id]!.playing!.tableId}`}>تماشا</Button>
                        : invited.includes(f.id) ? <Badge icon="check">دعوت فرستاده شد</Badge>
                        : <Button size="sm" variant="secondary" icon="armchair" onClick={() => void inviteToTable(f.id)}>{presence[f.id]?.online ? 'دعوت به میز' : 'دعوت به میز نوبتی'}</Button>}
                      <MessageMenu label="بیشتر" className="" items={[
                        { icon: 'message-circle', label: 'پیام', onClick: () => void message(f.id) },
                        { icon: 'user', label: 'پروفایل', onClick: () => navigate(`/users/${f.id}`) },
                        { icon: 'user-minus', label: 'حذف از دوستان', danger: true, onClick: () => act(`/friends/${f.id}`, 'DELETE', undefined, 'از دوستان حذف شد.') }
                      ]} />
                    </>)}</People>
                  </section>
                );
              })}
          </div>
          <aside className="bgv-stack app-hide-phone" aria-label="درخواست‌ها">
            {d.outgoing.length > 0 && (
              <Card title={`فرستاده‌شده (${faNum(d.outgoing.length)})`}>
                <ul className="pf-list pf-list--compact">{d.outgoing.map((f) => (
                  <PersonRow key={f.id} p={f}><Button size="sm" variant="ghost" onClick={() => act(`/friends/${f.id}`, 'DELETE')}>لغو</Button></PersonRow>))}</ul>
              </Card>
            )}
            {me && <Card title="لینک پروفایل شما">
              <p className="t-body-sm bgv-muted" style={{ marginBlockStart: 0 }}>لینک را بفرستید تا دوستانتان پروفایل شما را ببینند و درخواست دوستی بدهند.</p>
              <div className="pf-linkrow">
                <TextField aria-label="لینک پروفایل" readOnly dir="ltr" value={`${location.origin}/users/${me.id}`} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" icon="copy" onClick={() => copy(`${location.origin}/users/${me.id}`, 'لینک پروفایل کپی شد.')}>کپی</Button>
              </div>
            </Card>}
          </aside>
        </div>
      )}
      {tab === 'requests' && (
        <div className="bgv-stack">
          <h2 className="t-h3">دریافتی</h2>
          {d.incoming.length ? (
            <People items={d.incoming}>{(f) => (<>
              <Button size="sm" variant="primary" onClick={() => act(`/friends/requests/${f.id}/accept`, 'POST', undefined, 'دوستی پذیرفته شد.')}>پذیرش</Button>
              <Button size="sm" variant="secondary" onClick={() => act(`/friends/${f.id}`, 'DELETE')}>رد</Button>
            </>)}</People>
          ) : <StateBlock kind="empty" title="درخواستی ندارید" />}
          <h2 className="t-h3">فرستاده‌شده</h2>
          {d.outgoing.length ? (
            <People items={d.outgoing}>{(f) => <Button size="sm" variant="secondary" onClick={() => act(`/friends/${f.id}`, 'DELETE')}>لغو</Button>}</People>
          ) : <StateBlock kind="empty" title="درخواستی نفرستاده‌اید" />}
        </div>
      )}
      {tab === 'find' && <><Search onChange={data.reload} /><Invite /></>}
      {tab === 'blocked' && (
        <div className="bgv-stack">
          {d.blocked.length ? (
            <People items={d.blocked}>{(f) => (<>
              <Badge tone="danger">مسدود</Badge>
              <Button size="sm" variant="secondary" onClick={() => act(`/blocks/${f.id}`, 'DELETE', undefined, 'رفع مسدودی انجام شد.')}>رفع مسدودی</Button>
            </>)}</People>
          ) : <StateBlock kind="empty" title="کسی را مسدود نکرده‌اید" />}
          {d.muted.length > 0 && (
            <People items={d.muted}>{(f) => (<>
              <Badge>بی‌صدا</Badge>
              <Button size="sm" variant="secondary" onClick={() => act(`/mutes/${f.id}`, 'DELETE')}>لغو بی‌صدا</Button>
            </>)}</People>
          )}
        </div>
      )}
    </>
  );
}

export function ProfilePage() {
  const phone = usePhone();
  const { id = '' } = useParams();
  const card = useApi<ProfileCard>(`/users/${id}/card`);
  const ach = useApi<{ level: number; items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${id}/achievements`);
  const gameList = useApi<{ items: { id: string; nameFa: string }[] }>(card.data?.favoriteGames.length ? '/games' : null);
  usePageTitle(card.data?.displayName ?? 'پروفایل');
  const navigate = useNavigate();
  const toast = useToast();
  const act = useAct(card.reload);
  const [report, setReport] = useState<'user' | 'display_name' | 'bio' | null>(null);
  const presence = usePresence(card.data ? [card.data.id] : []);
  if (card.error) return <StateBlock kind={card.error.status === 404 ? 'empty' : 'error'} title={card.error.status === 404 ? 'این بازیکن پیدا نشد' : 'پروفایل دریافت نشد'} />;
  if (!card.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const u = card.data;
  const id0 = userIdentity(u);
  const favourites = u.favoriteGames.map((g) => gameList.data?.items.find((x) => x.id === g)).filter((g) => !!g);
  // Showcase first, in the player's order; then the rest by tier (the server already sorts them).
  const trophies = [...(ach.data?.items ?? [])].sort((a, b) => rank(u.showcase, a.key) - rank(u.showcase, b.key));
  const bannerCss = u.bannerKey && u.bannerKey !== 'bn.0' ? cosmetic(u.bannerKey)?.css : undefined;
  const message = async () => {
    try { navigate(`/messages/${(await api<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId: u.id } })).id}`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'گفت‌وگو باز نشد.'); }
  };
  const self = u.relationship === 'self';
  return (
    <>
      {!phone && !self && <Breadcrumbs items={[{ label: 'دوستان', href: '/friends' }, { label: u.displayName }]} />}
      <ProfileHead compact={phone}
        name={<bdi>{u.displayName}</bdi>}
        initials={id0.initials}
        avatar={{ ...id0.avatar, name: `آواتار ${u.displayName}` }}
        title={id0.title}
        level={u.level ?? undefined}
        league={u.bestLeague ?? undefined}
        stats={u.stats ? [{ value: faNum(u.stats.gamesPlayed), label: 'بازی‌ها' }, { value: faNum(u.stats.wins), label: 'برد (رتبهٔ اول)' }, { value: `${faNum(u.stats.winRate)}٪`, label: 'نرخ برد' }] : undefined}
        bannerArt={bannerCss ? <div className="pf-bn" style={{ '--bn': bannerCss } as React.CSSProperties} /> : undefined}
        badges={<>{u.premium && <Badge tone="premium" icon="crown">پریمیوم</Badge>}{u.relationship === 'friends' && <Badge tone="success">دوست</Badge>}</>}
        {...(presence[u.id] ? { status: presence[u.id]!.online ? 'online' as const : 'offline' as const } : {})}
        meta={[...(presenceLine(presence[u.id]) ? [presenceLine(presence[u.id])!] : []), `عضو از ${jalaliDate(u.joinedAt)}`]}
        actions={<>
          {self && <>
            <Button variant="primary" icon="palette" href="/me/avatar">ساخت آواتار</Button>
            <Button variant="secondary" icon="pencil" href="/me/profile">ویرایش پروفایل</Button>
            <Button variant="secondary" icon="palette" href="/me/studio">استودیو و کمد</Button>
          </>}
          {u.relationship === 'none' && <Button variant="primary" icon="user-plus" onClick={() => act('/friends/requests', 'POST', { userId: u.id }, 'درخواست دوستی فرستاده شد.')}>افزودن دوست</Button>}
          {u.relationship === 'incoming' && <Button variant="primary" onClick={() => act(`/friends/requests/${u.id}/accept`, 'POST')}>پذیرش دوستی</Button>}
          {u.relationship === 'outgoing' && <Badge icon="check">درخواست دوستی فرستاده شد</Badge>}
          {u.relationship === 'friends' && <Button variant="secondary" icon="message-circle" onClick={message}>پیام خصوصی</Button>}
          <CopyProfileLink userId={u.id} />
          {!self && <MessageMenu label="بیشتر" className="" items={[
            u.muted ? { icon: 'volume-2', label: 'لغو بی‌صدا', onClick: () => act(`/mutes/${u.id}`, 'DELETE') }
              : { icon: 'volume-x', label: 'بی‌صدا', onClick: () => act('/mutes', 'POST', { userId: u.id }, 'بی‌صدا شد.') },
            u.relationship === 'blocked' ? { icon: 'ban', label: 'رفع مسدودی', onClick: () => act(`/blocks/${u.id}`, 'DELETE', undefined, 'رفع مسدودی انجام شد.') }
              : { icon: 'ban', label: 'مسدود کردن', danger: true, onClick: () => act('/blocks', 'POST', { userId: u.id }, 'کاربر مسدود شد.') },
            { icon: 'flag', label: 'گزارش رفتار', danger: true, onClick: () => setReport('user') },
            { icon: 'flag', label: 'گزارش نام', onClick: () => setReport('display_name') },
            ...(u.bio ? [{ icon: 'flag', label: 'گزارش معرفی', onClick: () => setReport('bio') }] : [])
          ]} />}
        </>}>
        {u.bio && <p dir="auto" className="t-body">{u.bio}</p>}
      </ProfileHead>
      {(favourites.length > 0 || trophies.length > 0) && (
        <div className="bgv-cols">
          {trophies.length > 0 && (
            <Card title="ویترین جام‌ها" aria-label="جام‌ها">
              <div className="pf-trophies">
                {trophies.map((a) => <Trophy key={a.key} tier={a.tier} name={a.titleFa} />)}
              </div>
            </Card>
          )}
          {favourites.length > 0 && (
            <Card title="بازی‌های محبوب" aria-label="بازی‌های محبوب">
              <div className="bgv-row">
                {favourites.map((g) => <Chip key={g.id} href={`/games/${g.id}`}>{g.nameFa}</Chip>)}
              </div>
            </Card>
          )}
        </div>
      )}
      {(u.clubs.length > 0 || u.mutualFriends.length > 0) && (
        <div className="bgv-cols">
          {u.clubs.length > 0 && (
            <Card title="باشگاه‌ها" aria-label="باشگاه‌ها">
              <div className="bgv-row">{u.clubs.map((c) => <Chip key={c.slug} icon="shield" href={`/clubs/${c.slug}`}>{c.name}</Chip>)}</div>
            </Card>
          )}
          {u.mutualFriends.length > 0 && (
            <Card title={`دوستان مشترک (${faNum(u.mutualFriends.length)})`} aria-label="دوستان مشترک">
              <ul className="pf-list pf-list--compact">{u.mutualFriends.map((f) => <PersonRow key={f.id} p={f} />)}</ul>
            </Card>
          )}
        </div>
      )}
      {u.relationship !== 'blocked' && u.stats === null && u.recent === null && u.ratings === null && !self && (
        <p className="t-body-sm bgv-muted" role="status">این بازیکن آمار و سابقهٔ بازی خود را نمایش نمی‌دهد.</p>
      )}
      {(u.recent || u.ratings?.length || u.mastery?.length) ? (
        <div className="bgv-cols">
          <div className="bgv-stack">
            {u.recent && (
              <Card title="بازی‌های اخیر" aria-label="بازی‌های اخیر">
                {u.recent.length === 0 ? <p className="t-body-sm bgv-muted">هنوز بازی عمومی تمام‌شده‌ای نیست.</p> : (
                  <ul className="pf-record">
                    {u.recent.map((g, i) => (
                      <li key={`${g.gameId}${g.finishedAt}${i}`}>
                        <span><a href={`/games/${g.gameId}`} className="t-label">{g.gameNameFa}</a><span className="bgv-sep" /><span className="t-caption bgv-muted">{faNum(g.fieldSize)} نفر<span className="bgv-sep" />{jalaliDate(g.finishedAt)}</span></span>
                        <Badge tone={g.place === 1 ? 'success' : 'neutral'} icon={g.place === 1 ? 'crown' : undefined}>{g.place === 1 ? 'اول' : `رتبهٔ ${faNum(g.place)}`}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {u.mastery && u.mastery.length > 0 && (
              <Card title="تسلط بر بازی‌ها" aria-label="تسلط بر بازی‌ها">
                <div className="pf-mastery">
                  {u.mastery.map((m) => <div key={m.gameId}><a href={`/games/${m.gameId}`} className="t-label">{m.gameNameFa}</a><Badge tone="neutral">{m.tierFa}</Badge></div>)}
                </div>
              </Card>
            )}
          </div>
          {u.ratings && u.ratings.length > 0 && (
            <Card title="امتیاز رتبه‌بندی" aria-label="امتیاز رتبه‌بندی">
              <ul className="pf-record">
                {u.ratings.map((r) => (
                  <li key={`${r.gameId}${r.mode}`}>
                    <span><span className="t-label">{r.gameNameFa}</span><span className="bgv-sep" /><span className="t-caption bgv-muted">{r.mode === 'turn' ? 'نوبتی' : 'زنده'}</span></span>
                    <span className="bgv-row">{r.league && <League tier={r.league} />}<span className="t-num-md">{faNum(r.rating)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}
      {self && <InviteCard />}
      {report && <ReportDialog targetType={report} targetId={u.id} label={u.displayName} onClose={() => setReport(null)} />}
    </>
  );
}
