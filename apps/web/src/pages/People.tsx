import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { PublicProfile, TrophyTier, UserCard } from '@bg/contracts';
import { Avatar, Badge, Button, Input, StateBlock, Tabs, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ReportDialog } from '../social/ReportDialog.tsx';
import { TIER_FA, Trophy } from '../lib/rewards.tsx';

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
    <div className="stack">
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

export function FriendsPage() {
  usePageTitle('دوستان');
  const data = useApi<Friends>('/me/friends');
  const navigate = useNavigate();
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
      <div className="page-head"><div><h1 className="page-title">دوستان</h1><p className="page-sub">پیام خصوصی به‌طور پیش‌فرض فقط بین دوستان ممکن است.</p></div></div>
      <Tabs label="دوستان" tabs={[
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
  const card = useApi<UserCard>(`/users/${id}/card`);
  const ach = useApi<{ level: number; items: { key: string; titleFa: string; tier: TrophyTier }[] }>(`/users/${id}/achievements`);
  usePageTitle(card.data?.displayName ?? 'پروفایل');
  const navigate = useNavigate();
  const toast = useToast();
  const act = useAct(card.reload);
  const [report, setReport] = useState<'user' | 'display_name' | null>(null);
  if (card.error) return <StateBlock kind={card.error.status === 404 ? 'empty' : 'error'} title={card.error.status === 404 ? 'این بازیکن پیدا نشد' : 'پروفایل دریافت نشد'} />;
  if (!card.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const u = card.data;
  const message = async () => {
    try { navigate(`/messages/${(await api<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId: u.id } })).id}`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'گفت‌وگو باز نشد.'); }
  };
  return (
    <div className="stack" style={{ maxInlineSize: 640 }}>
      <section className="panel row" style={{ alignItems: 'center' }}>
        <Avatar avatarKey={u.avatarKey} name={u.displayName} size={72} />
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: 'var(--fs-xl)' }}><bdi>{u.displayName}</bdi></h1>
          <p className="page-sub">عضو از {jalaliDate(u.joinedAt)}{ach.data ? ` · سطح ${ach.data.level.toLocaleString('fa-IR')}` : ''}</p>
          {ach.data && ach.data.items.length > 0 && <div className="row" style={{ gap: 4 }}>{ach.data.items.map((a) => <span key={a.key} className={`trophy-chip tier--${a.tier}`} title={TIER_FA[a.tier]}><Trophy tier={a.tier} />{a.titleFa}</span>)}</div>}
        </div>
        {u.relationship === 'friends' && <Badge tone="success">دوست</Badge>}
      </section>
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
        </section>
      )}
      {report && <ReportDialog targetType={report} targetId={u.id} label={u.displayName} onClose={() => setReport(null)} />}
    </div>
  );
}
