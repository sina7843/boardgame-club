import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { cosmetic, type ProfileCard, type PublicProfile, type TrophyTier, type UserCard } from '@bg/contracts';
import { Avatar, Badge, Button, Input, StateBlock, Tabs, buttonClass, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ReportDialog } from '../social/ReportDialog.tsx';
import { CopyProfileLink } from './MyProfile.tsx';
import { TIER_FA, Trophy } from '../lib/rewards.tsx';
import { InviteCard, referralUrl, rewardFa, useCopy, type Referral } from '../social/InviteCard.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

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

function PersonRow({ p, children }: { p: PublicProfile; children?: React.ReactNode }) {
  return (
    <li className="list__item list__item--compact">
      <Avatar avatarKey={p.avatarKey} name={p.displayName} size={36} />
      <Link to={`/users/${p.id}`} style={{ flex: 1, minInlineSize: 0, fontWeight: 600 }}><bdi>{p.displayName}</bdi></Link>
      {children}
    </li>
  );
}

function Search({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const res = useApi<{ items: UserCard[] }>(debounced.length >= 2 ? `/users?q=${encodeURIComponent(debounced)}` : null);
  const act = useAct(() => { res.reload(); onChange(); });
  return (
    <div className="stack" data-tour="friends-search">
      <Input label="جست‌وجوی بازیکن" type="search" value={q} onChange={(e) => setQ(e.target.value)} hint="حداقل دو حرف از نام نمایشی" />
      {res.loading && debounced.length >= 2 && <p className="muted" role="status">در حال جست‌وجو…</p>}
      {res.data && (res.data.items.length === 0 ? <p className="muted">بازیکنی پیدا نشد.</p> : (
        <ul className="list">
          {res.data.items.map((u) => (
            <PersonRow key={u.id} p={u}>
              {u.relationship === 'none' && <Button size="sm" onClick={() => act('/friends/requests', 'POST', { userId: u.id }, 'درخواست دوستی فرستاده شد.')}>افزودن دوست</Button>}
              {u.relationship === 'outgoing' && <Badge>درخواست فرستاده شد</Badge>}
              {u.relationship === 'incoming' && <Button size="sm" onClick={() => act(`/friends/requests/${u.id}/accept`, 'POST')}>پذیرش</Button>}
              {u.relationship === 'friends' && <Badge tone="success">دوست</Badge>}
              {u.relationship === 'blocked' && <Badge tone="danger">مسدود</Badge>}
            </PersonRow>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Invite link + code; whoever signs up through it becomes a friend automatically. */
function Invite() {
  const data = useApi<Referral>('/me/referral');
  const copy = useCopy();
  if (data.error) return <StateBlock kind="error" title="لینک دعوت دریافت نشد" action={<Button onClick={data.reload}>تلاش دوباره</Button>} />;
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
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>هر کس با لینک یا کد شما عضو شود، خودکار دوست شما می‌شود.</p>
      {(inviter || invitee) && (
        <p className="panel" style={{ margin: 0 }}>
          {inviter && <>به ازای هر دوستی که عضو شود <strong>{inviter}</strong> هدیه می‌گیرید. </>}
          {invitee && <>دوست شما هم <strong>{invitee}</strong> هدیه می‌گیرد.</>}
        </p>
      )}
      <Input label="لینک دعوت" readOnly dir="ltr" className="input--ltr" value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        <Button onClick={() => copy(url, 'لینک دعوت کپی شد.')}>کپی لینک</Button>
        <Button variant="secondary" onClick={() => copy(code, 'کد دعوت کپی شد.')}>کپی کد <bdi dir="ltr">{code}</bdi></Button>
        {'share' in navigator && <Button variant="ghost" onClick={share}>اشتراک‌گذاری</Button>}
      </div>
      <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>دعوت‌شده‌ها ({faNum(invited.length)})</h2>
      {invited.length ? <ul className="list">{invited.map((i) => (
        <PersonRow key={i.user.id} p={i.user}>
          {i.reward && rewardFa(i.reward.coins, i.reward.days) && <Badge tone="success">{rewardFa(i.reward.coins, i.reward.days)}</Badge>}
          <span className="muted">{jalaliDate(i.createdAt)}</span>
        </PersonRow>))}</ul> : <p className="muted" style={{ margin: 0 }}>هنوز کسی با لینک شما عضو نشده است.</p>}
    </div>
  );
}

export function FriendsPage() {
  usePageTitle('دوستان');
  const data = useApi<Friends>('/me/friends');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const act = useAct(data.reload);
  const message = async (userId: string) => {
    try { navigate(`/messages/${(await api<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId } })).id}`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'گفت‌وگو باز نشد.'); }
  };
  if (data.error) return <StateBlock kind={data.error.status === 401 ? 'denied' : 'error'} title={data.error.status === 401 ? 'برای دیدن دوستان وارد شوید' : 'فهرست دوستان دریافت نشد'} action={<Button onClick={data.reload}>تلاش دوباره</Button>} />;
  if (!data.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = data.data;
  const empty = (t: string) => <p className="muted" style={{ margin: 0 }}>{t}</p>;
  return (
    <>
      <PageTabs group="social" />
      <div className="page-head"><div><h1 className="page-title">دوستان</h1><p className="page-sub">پیام خصوصی به‌طور پیش‌فرض فقط بین دوستان ممکن است.</p></div></div>
      <Tabs label="دوستان" initial={params.get('tab') ?? undefined} tabs={[
        { id: 'friends', title: `دوستان (${d.friends.length.toLocaleString('fa-IR')})`, content: d.friends.length ? (
          <ul className="list">{d.friends.map((f) => (
            <PersonRow key={f.id} p={f}>
              <Button size="sm" variant="secondary" onClick={() => message(f.id)}>پیام</Button>
              <Button size="sm" variant="ghost" onClick={() => act(`/friends/${f.id}`, 'DELETE', undefined, 'از دوستان حذف شد.')}>حذف</Button>
            </PersonRow>))}</ul>) : empty('هنوز دوستی ندارید؛ از زبانه «یافتن» بازیکن‌ها را پیدا کنید.') },
        { id: 'requests', title: `درخواست‌ها (${(d.incoming.length).toLocaleString('fa-IR')})`, content: (
          <div className="stack">
            <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>دریافتی</h2>
            {d.incoming.length ? <ul className="list">{d.incoming.map((f) => (
              <PersonRow key={f.id} p={f}>
                <Button size="sm" onClick={() => act(`/friends/requests/${f.id}/accept`, 'POST', undefined, 'دوستی پذیرفته شد.')}>پذیرش</Button>
                <Button size="sm" variant="ghost" onClick={() => act(`/friends/${f.id}`, 'DELETE')}>رد</Button>
              </PersonRow>))}</ul> : empty('درخواستی ندارید.')}
            <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>فرستاده‌شده</h2>
            {d.outgoing.length ? <ul className="list">{d.outgoing.map((f) => (
              <PersonRow key={f.id} p={f}><Button size="sm" variant="ghost" onClick={() => act(`/friends/${f.id}`, 'DELETE')}>لغو</Button></PersonRow>))}</ul> : empty('درخواستی نفرستاده‌اید.')}
          </div>) },
        { id: 'find', title: 'یافتن', content: <Search onChange={data.reload} /> },
        { id: 'invite', title: 'دعوت دوستان', content: <Invite /> },
        { id: 'blocked', title: 'مسدود و بی‌صدا', content: (
          <div className="stack">
            {d.blocked.length ? <ul className="list">{d.blocked.map((f) => (
              <PersonRow key={f.id} p={f}><Badge tone="danger">مسدود</Badge><Button size="sm" variant="ghost" onClick={() => act(`/blocks/${f.id}`, 'DELETE', undefined, 'رفع مسدودی انجام شد.')}>رفع مسدودی</Button></PersonRow>))}</ul> : empty('کسی را مسدود نکرده‌اید.')}
            {d.muted.length > 0 && <ul className="list">{d.muted.map((f) => (
              <PersonRow key={f.id} p={f}><Badge>بی‌صدا</Badge><Button size="sm" variant="ghost" onClick={() => act(`/mutes/${f.id}`, 'DELETE')}>لغو بی‌صدا</Button></PersonRow>))}</ul>}
          </div>) }
      ]} />
    </>
  );
}

export function ProfilePage() {
  const { id = '' } = useParams();
  const card = useApi<ProfileCard>(`/users/${id}/card`);
  const ach = useApi<{ level: number; items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${id}/achievements`);
  const gameList = useApi<{ items: { id: string; nameFa: string }[] }>(card.data?.favoriteGames.length ? '/games' : null);
  usePageTitle(card.data?.displayName ?? 'پروفایل');
  const navigate = useNavigate();
  const toast = useToast();
  const act = useAct(card.reload);
  const [report, setReport] = useState<'user' | 'display_name' | 'bio' | null>(null);
  if (card.error) return <StateBlock kind={card.error.status === 404 ? 'empty' : 'error'} title={card.error.status === 404 ? 'این بازیکن پیدا نشد' : 'پروفایل دریافت نشد'} />;
  if (!card.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const u = card.data;
  const title = u.titleKey ? cosmetic(u.titleKey)?.nameFa : undefined;
  const favourites = u.favoriteGames.map((g) => gameList.data?.items.find((x) => x.id === g)).filter((g) => !!g);
  // Showcase first, in the player's order; then the rest by tier (the server already sorts them).
  const trophies = [...(ach.data?.items ?? [])].sort((a, b) => rank(u.showcase, a.key) - rank(u.showcase, b.key));
  const message = async () => {
    try { navigate(`/messages/${(await api<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId: u.id } })).id}`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'گفت‌وگو باز نشد.'); }
  };
  return (
    <div className="stack" style={{ maxInlineSize: 640 }}>
      <section className="profile-hero">
        <div className="profile-hero__banner" style={{ background: cosmetic(u.bannerKey ?? 'bn.0')?.css }} />
        <div className="profile-hero__body">
          <Avatar avatarKey={u.avatarKey} name={u.displayName} size={112} />
          <div style={{ flex: 1, minInlineSize: 180 }}>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-xl)' }}><bdi>{u.displayName}</bdi></h1>
            {title && <span className="profile-title">{title}</span>}
            <p className="page-sub">عضو از {jalaliDate(u.joinedAt)}{ach.data ? ` · سطح ${ach.data.level.toLocaleString('fa-IR')}` : ''}</p>
          </div>
          {u.relationship === 'friends' && <Badge tone="success">دوست</Badge>}
          {u.relationship === 'self' && <span className="row" style={{ gap: 6 }}><Link className={buttonClass('primary', 'sm')} to="/me/avatar">ساخت آواتار</Link><Link className={buttonClass('secondary', 'sm')} to="/me/profile">ویرایش پروفایل</Link></span>}
          <CopyProfileLink userId={u.id} size="sm" />
        </div>
      </section>
      {(u.bio || favourites.length > 0 || trophies.length > 0) && (
        <section className="panel stack">
          {u.bio && <p className="profile-bio" dir="auto">{u.bio}</p>}
          {favourites.length > 0 && (
            <div className="row" style={{ gap: 6 }} aria-label="بازی‌های محبوب">
              <span className="muted">بازی‌های محبوب:</span>
              {favourites.map((g) => <Link key={g.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} to={`/games/${g.id}`}>{g.nameFa}</Link>)}
            </div>
          )}
          {trophies.length > 0 && (
            <div className="row" style={{ gap: 4 }} aria-label="جام‌ها">
              {trophies.map((a) => <span key={a.key} className={`trophy-chip tier--${a.tier}`} title={TIER_FA[a.tier]}><Trophy tier={a.tier} />{a.titleFa}</span>)}
            </div>
          )}
        </section>
      )}
      {u.relationship === 'self' && <InviteCard />}
      {u.relationship !== 'self' && (
        <section className="panel row" aria-label="اقدام‌ها">
          {u.relationship === 'none' && <Button onClick={() => act('/friends/requests', 'POST', { userId: u.id }, 'درخواست دوستی فرستاده شد.')}>افزودن دوست</Button>}
          {u.relationship === 'incoming' && <Button onClick={() => act(`/friends/requests/${u.id}/accept`, 'POST')}>پذیرش دوستی</Button>}
          {u.relationship === 'outgoing' && <Badge>درخواست دوستی فرستاده شد</Badge>}
          {u.relationship === 'friends' && <Button variant="secondary" onClick={message}>پیام خصوصی</Button>}
          {u.relationship === 'blocked'
            ? <Button variant="secondary" onClick={() => act(`/blocks/${u.id}`, 'DELETE', undefined, 'رفع مسدودی انجام شد.')}>رفع مسدودی</Button>
            : <Button variant="danger" onClick={() => act('/blocks', 'POST', { userId: u.id }, 'کاربر مسدود شد.')}>مسدود کردن</Button>}
          {u.muted ? <Button variant="ghost" onClick={() => act(`/mutes/${u.id}`, 'DELETE')}>لغو بی‌صدا</Button>
            : <Button variant="ghost" onClick={() => act('/mutes', 'POST', { userId: u.id }, 'بی‌صدا شد.')}>بی‌صدا</Button>}
          <Button variant="ghost" onClick={() => setReport('user')}>گزارش رفتار</Button>
          <Button variant="ghost" onClick={() => setReport('display_name')}>گزارش نام</Button>
          {u.bio && <Button variant="ghost" onClick={() => setReport('bio')}>گزارش معرفی</Button>}
        </section>
      )}
      {report && <ReportDialog targetType={report} targetId={u.id} label={u.displayName} onClose={() => setReport(null)} />}
    </div>
  );
}
