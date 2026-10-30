import { useEffect, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { GuestState } from '../shell/GuestState.tsx';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { cosmetic, type Presence, type ProfileCard, type PublicProfile, type TrophyTier, type UserCard } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, Badge, Banner, Breadcrumbs, Button, Card, ChipGroup, Icon, Identity, League, PageHead, ProfileHead, StateBlock, Tabs, TextField, Trophy } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { presenceLine, usePresence } from '../lib/presence.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ReportDialog } from '../social/ReportDialog.tsx';
import { CopyProfileLink } from './MyProfile.tsx';
import { MessageMenu } from '../social/ChatPanel.tsx';
import { referralUrl, rewardFa, useCopy, type Referral } from '../social/InviteCard.tsx';
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

/** A player's profile. `/me/profile` renders the same page for oneself with `own` (Profile-Own-Desktop): completeness card and shortcuts in `extra`. */
export function ProfilePage({ userId, own, extra }: { userId?: string; own?: boolean; extra?: ReactNode } = {}) {
  const phone = usePhone();
  const params = useParams();
  const id = userId ?? params.id ?? '';
  const card = useApi<ProfileCard>(`/users/${id}/card`);
  const ach = useApi<{ level: number; items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${id}/achievements`);
  const gameList = useApi<{ items: { id: string; nameFa: string }[] }>(card.data?.favoriteGames.length ? '/games' : null);
  usePageTitle(own ? 'پروفایل من' : card.data?.displayName ?? 'پروفایل');
  const navigate = useNavigate();
  const toast = useToast();
  const act = useAct(card.reload);
  const [report, setReport] = useState<'user' | 'display_name' | 'bio' | null>(null);
  const [ptab, setPtab] = useState<'overview' | 'games' | 'trophies'>('overview');
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
  const actions = <>
          {self && <>
            <Button variant="secondary" icon="pencil" href={own ? '#profile-edit' : '/me/profile'}>ویرایش پروفایل</Button>
            {own && <Button variant="secondary" icon="eye" href={`/users/${u.id}`}>نمای عمومی</Button>}
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
        </>;
  const presenceText = presenceLine(presence[u.id]);
  const best = u.ratings?.length ? [...u.ratings].sort((a, b) => b.rating - a.rating)[0] : undefined;
  // Profile-Public-Mobile: the sections sit behind three tabs.
  const show = (t: typeof ptab) => !phone || ptab === t;
  return (
    <>
      {!phone && (own ? <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: 'پروفایل من' }]} />
        : !self && <Breadcrumbs items={[{ label: 'پیام‌ها و دوستان', href: '/messages' }, { label: 'دوستان', href: '/friends' }, { label: u.displayName }]} />)}
      {phone ? (
        <section className="pf-mhead" aria-label={u.displayName}>
          <span className="pf-mhead__bn">{bannerCss ? <div className="pf-bn" style={{ '--bn': bannerCss } as React.CSSProperties} /> : null}</span>
          <div className="pf-mhead__id">
            <Avatar {...id0.avatar} initials={id0.initials} size="xl" {...(presence[u.id] ? { status: presence[u.id]!.online ? 'online' as const : 'offline' as const } : {})} />
            <div className="bgv-row pf-mhead__name"><h1 className="t-page-sm"><bdi>{u.displayName}</bdi></h1>{u.premium && <Badge size="sm" tone="premium" icon="crown">پریمیوم</Badge>}</div>
            <span className="pf-mhead__meta">{[id0.title ? <span key="t">{id0.title}</span> : null, u.bestLeague ? <League key="l" tier={u.bestLeague} /> : null, u.level !== null ? <span key="v">سطح {faNum(u.level)}</span> : null]
              .filter((x) => x !== null).flatMap((x, i) => (i ? [<span key={`s${i}`} className="bgv-sep" />, x] : [x]))}</span>
            <span className="t-caption bgv-muted">{presenceText ?? `عضو از ${jalaliDate(u.joinedAt)}`}</span>
          </div>
          <div className="pf-mhead__actions">{actions}</div>
          {u.bio && <p dir="auto" className="t-body-sm pf-mhead__bio">{u.bio}</p>}
          {u.stats && (
            <div className="bgv-card pf-mstats">
              <div><b className="t-num-md bgv-num">{faNum(u.stats.gamesPlayed)}</b><span>بازی</span></div>
              <div><b className="t-num-md bgv-num">{faNum(u.stats.wins)}</b><span>برد</span></div>
              <div><b className="t-num-md bgv-num">{faNum(u.stats.winRate)}٪</b><span>نرخ برد</span></div>
              {best && <div><b className="t-num-md bgv-num">{faNum(best.rating)}</b><span>امتیاز رتبه</span></div>}
            </div>
          )}
          <Tabs label="بخش‌های پروفایل" value={ptab} onChange={(v) => setPtab(v as typeof ptab)}
            items={[{ value: 'overview', label: 'نمای کلی' }, { value: 'games', label: 'بازی‌ها' }, { value: 'trophies', label: 'جام‌ها' }]} />
        </section>
      ) : <ProfileHead
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
        actions={actions}>
        {u.bio && <p dir="auto" className="t-body">{u.bio}</p>}
      </ProfileHead>}
      {extra}
      {u.relationship !== 'blocked' && u.stats === null && u.recent === null && u.ratings === null && !self && (
        <p className="t-body-sm bgv-muted" role="status">این بازیکن آمار و سابقهٔ بازی خود را نمایش نمی‌دهد.</p>
      )}
      {phone && ((ptab === 'overview' && !trophies.length && !favourites.length && !u.clubs.length && !u.mutualFriends.length)
        || (ptab === 'games' && !u.recent?.length && !u.mastery?.length && !u.ratings?.length) || (ptab === 'trophies' && !trophies.length))
        && <p className="t-body-sm bgv-muted" role="status">{ptab === 'trophies' ? 'هنوز جامی نگرفته است.' : ptab === 'games' ? 'هنوز بازی عمومی تمام‌شده‌ای نیست.' : 'هنوز چیزی برای نمایش نیست.'}</p>}
      {/* Profile-Public-Desktop: trophies, recent games and mastery in the main column; favourites, clubs and mutual friends beside. */}
      <div className="bgv-cols pf-profcols">
        <div className="pf-profmain">
          {trophies.length > 0 && (show('overview') || show('trophies')) && (
            <section className="bgv-card pf-pcard" aria-labelledby="tro-h">
              <div className="bgv-row"><h2 id="tro-h" className="pf-h2">ویترین جام‌ها</h2>
                <span className="t-caption bgv-muted">{faNum(trophies.length)} جام</span></div>
              <div className="pf-trophies">
                {trophies.slice(0, phone && ptab === 'trophies' ? undefined : phone ? 4 : 5).map((a) => <Trophy key={a.key} tier={a.tier} name={a.titleFa} />)}
              </div>
            </section>
          )}
          {u.recent && show('games') && (
            <section className="bgv-card pf-pcard" aria-labelledby="recent-h">
              <div className="bgv-row"><h2 id="recent-h" className="pf-h2">بازی‌های اخیر</h2></div>
              {u.recent.length === 0 ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>هنوز بازی عمومی تمام‌شده‌ای نیست.</p> : (
                <ul className="pf-ul pf-rows">
                  {u.recent.map((g, i) => (
                    <li key={`${g.gameId}${g.finishedAt}${i}`} className="pf-mrow">
                      <img src={`/covers/${g.gameId}.webp`} alt="" loading="lazy" />
                      <div className="pf-mrow__text"><a href={`/games/${g.gameId}`}><b>{g.gameNameFa}</b></a>
                        <span className="t-caption bgv-muted">{faNum(g.fieldSize)} نفر<span className="bgv-sep" />{jalaliDate(g.finishedAt)}</span></div>
                      <Badge tone={g.place === 1 ? 'success' : 'neutral'} icon={g.place === 1 ? 'crown' : undefined}>{g.place === 1 ? 'اول' : `${faNum(g.place)} از ${faNum(g.fieldSize)}`}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {u.mastery && u.mastery.length > 0 && show('games') && (
            <section className="bgv-card pf-pcard" aria-labelledby="mast-h">
              <div className="bgv-row"><h2 id="mast-h" className="pf-h2">تسلط بر بازی‌ها</h2>
                <span className="t-caption bgv-muted">{faNum(u.mastery.length)} بازی تجربه‌شده</span></div>
              <div className="pf-mastery">
                {u.mastery.map((m) => (
                  <a key={m.gameId} href={`/games/${m.gameId}`} className="pf-mcard">
                    <span className="pf-mcard__head"><img src={`/covers/${m.gameId}.webp`} alt="" loading="lazy" /><b>{m.gameNameFa}</b></span>
                    <Badge tone={m.tier === 'master' ? 'premium' : m.tier === 'seasoned' ? 'success' : 'neutral'} icon={m.tier === 'master' ? 'star' : undefined}>{m.tierFa}</Badge>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="pf-profside">
          {favourites.length > 0 && show('overview') && (
            <section className="bgv-card pf-pcard" aria-labelledby="fav-h">
              <div className="bgv-row"><h2 id="fav-h" className="pf-h2">بازی‌های محبوب</h2></div>
              <ul className="pf-ul pf-favs">
                {favourites.map((g) => {
                  const r = u.ratings?.find((x) => x.gameId === g.id);
                  return (
                    <li key={g.id}><a href={`/games/${g.id}`} className="pf-fav">
                      <img src={`/covers/${g.id}.webp`} alt="" loading="lazy" />
                      <span className="pf-mrow__text"><b>{g.nameFa}</b>
                        {r && <span className="t-caption bgv-muted bgv-row">{r.league && <League tier={r.league} />}<span className="bgv-num">{faNum(r.rating)}</span></span>}</span>
                    </a></li>
                  );
                })}
              </ul>
            </section>
          )}
          {u.ratings && u.ratings.length > 0 && show('games') && (
            <section className="bgv-card pf-pcard" aria-labelledby="rat-h">
              <div className="bgv-row"><h2 id="rat-h" className="pf-h2">امتیاز رتبه‌بندی</h2></div>
              <ul className="pf-ul pf-rows">
                {u.ratings.map((r) => (
                  <li key={`${r.gameId}${r.mode}`} className="pf-lrow">
                    <span className="pf-mrow__text"><b>{r.gameNameFa}</b><span className="t-caption bgv-muted">{r.mode === 'turn' ? 'نوبتی' : 'زنده'}</span></span>
                    <span className="bgv-row">{r.league && <League tier={r.league} />}<b className="bgv-num">{faNum(r.rating)}</b></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {u.clubs.length > 0 && show('overview') && (
            <section className="bgv-card pf-pcard" aria-labelledby="clubs-h">
              <div className="bgv-row"><h2 id="clubs-h" className="pf-h2">باشگاه‌ها</h2><span className="t-caption bgv-muted">{faNum(u.clubs.length)} باشگاه</span></div>
              <ul className="pf-ul pf-rows">{u.clubs.map((c) => (
                <li key={c.slug} className="pf-lrow"><span className="ac-tile"><Icon name="shield" /></span><a href={`/clubs/${c.slug}`} className="pf-mrow__text"><b>{c.name}</b></a></li>
              ))}</ul>
            </section>
          )}
          {u.mutualFriends.length > 0 && show('overview') && (
            <section className="bgv-card pf-mutual" aria-label="دوستان مشترک">
              <span className="bgv-avatars" aria-hidden="true">{u.mutualFriends.slice(0, 3).map((f) => <span key={f.id} className="bgv-avatar bgv-avatar--sm">{[...f.displayName][0]}</span>)}</span>
              <span className="t-body-sm">{u.mutualFriends.slice(0, 2).map((f) => f.displayName).join('، ')}{u.mutualFriends.length > 2 ? ` و ${faNum(u.mutualFriends.length - 2)} دوست مشترک دیگر` : u.mutualFriends.length === 1 ? '، دوست مشترک' : '، دوستان مشترک'}</span>
            </section>
          )}
        </aside>
      </div>
      {report && <ReportDialog targetType={report} targetId={u.id} label={u.displayName} onClose={() => setReport(null)} />}
    </>
  );
}
