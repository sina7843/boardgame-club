import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ClubDetail, PublicProfile } from '@bg/contracts';
import { Avatar, Badge, Button, Input, Segmented, Select, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ChatPanel } from '../social/ChatPanel.tsx';

const ROLE_FA = { owner: 'مالک', manager: 'مدیر', member: 'عضو' } as const;
const STATUS_FA = { active: 'عضو', requested: 'درخواست عضویت', invited: 'دعوت‌شده' } as const;
const POLICY_FA = { open: 'عضویت آزاد', request: 'عضویت با درخواست', invite: 'فقط با دعوت' } as const;

type Member = { user: PublicProfile; role: keyof typeof ROLE_FA; status: keyof typeof STATUS_FA };

function useRun() {
  const toast = useToast();
  return async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const r = await fn(); if (ok) toast('success', ok); return r; }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); return undefined; }
  };
}

function MemberRow({ m, children }: { m: Member; children?: React.ReactNode }) {
  return (
    <li className="list__item list__item--compact">
      <Avatar avatarKey={m.user.avatarKey} name={m.user.displayName} size={32} />
      <Link to={`/users/${m.user.id}`} style={{ flex: 1, minInlineSize: 0 }}><bdi>{m.user.displayName}</bdi></Link>
      <Badge tone={m.role === 'owner' ? 'premium' : undefined}>{m.status === 'active' ? ROLE_FA[m.role] : STATUS_FA[m.status]}</Badge>
      {children}
    </li>
  );
}

/** Friend picker used for group and club invitations. */
function FriendInvite({ onInvite, exclude }: { onInvite: (userId: string) => void; exclude: Set<string> }) {
  const friends = useApi<{ friends: PublicProfile[] }>('/me/friends');
  const options = (friends.data?.friends ?? []).filter((f) => !exclude.has(f.id));
  const [pick, setPick] = useState('');
  if (!options.length) return <p className="muted" style={{ margin: 0 }}>دوستی برای دعوت باقی نمانده است.</p>;
  return (
    <div className="row" style={{ alignItems: 'end' }}>
      <div style={{ flex: 1, minInlineSize: 180 }}>
        <Select label="دعوت دوست" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: 'انتخاب کنید' }, ...options.map((f) => ({ value: f.id, label: f.displayName }))]} />
      </div>
      <Button variant="secondary" disabled={!pick} onClick={() => { onInvite(pick); setPick(''); }}>دعوت</Button>
    </div>
  );
}

// ===================== Groups =====================

export function GroupsPage() {
  usePageTitle('گروه‌ها');
  const list = useApi<{ items: { id: string; name: string; myStatus: string; myRole: string; memberCount: number }[] }>('/me/groups');
  const navigate = useNavigate();
  const run = useRun();
  const [name, setName] = useState('');
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const g = await run(() => api<{ id: string }>('/groups', { method: 'POST', body: { name } }));
    if (g) navigate(`/groups/${g.id}`);
  };
  if (list.error) return <StateBlock kind={list.error.status === 401 ? 'denied' : 'error'} title={list.error.status === 401 ? 'برای دیدن گروه‌ها وارد شوید' : 'گروه‌ها دریافت نشد'} action={<Button onClick={list.reload}>تلاش دوباره</Button>} />;
  if (!list.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">گروه‌ها</h1><p className="page-sub">گروه خصوصی برای جمع دوستانه و دعوت سریع همه به یک میز.</p></div></div>
      <div className="stack" style={{ maxInlineSize: 720 }}>
        <form className="panel row" onSubmit={create} style={{ alignItems: 'end' }}>
          <div style={{ flex: 1, minInlineSize: 200 }}><Input label="نام گروه تازه" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
          <Button type="submit" disabled={name.trim().length < 2}>ساخت گروه</Button>
        </form>
        {list.data.items.length === 0 ? <StateBlock kind="empty" title="عضو گروهی نیستید">یک گروه بسازید و دوستانتان را دعوت کنید.</StateBlock> : (
          <ul className="list">
            {list.data.items.map((g) => (
              <li key={g.id} className="panel list__item">
                <div style={{ flex: 1 }}>
                  <strong>{g.name}</strong>
                  <div className="muted">{faNum(g.memberCount)} عضو · {g.myStatus === 'invited' ? 'دعوت شده‌اید' : ROLE_FA[g.myRole as 'owner']}</div>
                </div>
                <Link className={`btn btn--sm ${g.myStatus === 'invited' ? 'btn--primary' : 'btn--secondary'}`} to={`/groups/${g.id}`}>{g.myStatus === 'invited' ? 'دیدن دعوت' : 'باز کردن'}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function GroupPage() {
  const { id = '' } = useParams();
  const g = useApi<{ id: string; name: string; ownerId: string; conversationId: string | null; myRole: string; myStatus: string; members: Member[] }>(`/groups/${id}`);
  usePageTitle(g.data ? `گروه ${g.data.name}` : 'گروه');
  const myId = useSession().me?.id ?? '';
  const navigate = useNavigate();
  const run = useRun();
  if (g.error) return <StateBlock kind={g.error.status === 403 ? 'denied' : 'error'} title={g.error.status === 403 ? 'این گروه خصوصی است' : 'گروه دریافت نشد'}>{g.error.messageFa}</StateBlock>;
  if (!g.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = g.data;
  const manager = d.myStatus === 'active' && (d.myRole === 'owner' || d.myRole === 'manager');
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">گروه {d.name}</h1><p className="page-sub">{faNum(d.members.filter((m) => m.status === 'active').length)} عضو</p></div></div>
      {d.myStatus === 'invited' ? (
        <section className="panel row">
          <p style={{ margin: 0, flex: 1 }}>به این گروه دعوت شده‌اید.</p>
          <Button onClick={async () => { await run(() => api(`/groups/${d.id}/accept`, { method: 'POST' }), 'به گروه پیوستید.'); g.reload(); }}>پذیرش</Button>
          <Button variant="ghost" onClick={async () => { await run(() => api(`/groups/${d.id}/members/${myId}`, { method: 'DELETE' })); navigate('/groups'); }}>رد</Button>
        </section>
      ) : (
        <div className="community">
          <div className="stack">
            {d.conversationId && <section className="panel"><h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>گفت‌وگوی گروه</h2>
              <ChatPanel load={`/conversations/${d.conversationId}/messages`} post={`/conversations/${d.conversationId}/messages`} conversationId={d.conversationId} title="گفت‌وگوی گروه" /></section>}
          </div>
          <div className="stack">
            <section className="panel stack" aria-labelledby="gm-h">
              <h2 id="gm-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>اعضا</h2>
              <ul className="list">
                {d.members.map((m) => (
                  <MemberRow key={m.user.id} m={m}>
                    {manager && m.role !== 'owner' && <Button size="sm" variant="ghost" onClick={async () => { await run(() => api(`/groups/${d.id}/members/${m.user.id}`, { method: 'DELETE' })); g.reload(); }}>حذف</Button>}
                  </MemberRow>
                ))}
              </ul>
              {manager && <FriendInvite exclude={new Set(d.members.map((m) => m.user.id))} onInvite={async (userId) => { await run(() => api(`/groups/${d.id}/invites`, { method: 'POST', body: { userId } }), 'دعوت فرستاده شد.'); g.reload(); }} />}
              <p className="muted" style={{ margin: 0 }}>برای بازی گروهی، میز بسازید و در لابی «دعوت همه» را بزنید.</p>
              {d.myRole !== 'owner' && <Button variant="ghost" onClick={async () => { await run(() => api(`/groups/${d.id}/members/${myId}`, { method: 'DELETE' })); navigate('/groups'); }}>ترک گروه</Button>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== Clubs =====================

export function ClubsPage() {
  usePageTitle('باشگاه‌ها');
  const [q, setQ] = useState('');
  const list = useApi<{ items: { id: string; slug: string; name: string; description: string; joinPolicy: keyof typeof POLICY_FA; memberCount: number }[] }>(`/clubs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  const navigate = useNavigate();
  const run = useRun();
  const [form, setForm] = useState({ slug: '', name: '', description: '', joinPolicy: 'open' as keyof typeof POLICY_FA });
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const c = await run(() => api<ClubDetail>('/clubs', { method: 'POST', body: form }), 'باشگاه ساخته شد.');
    if (c) navigate(`/clubs/${c.slug}`);
  };
  if (list.error?.status === 401) return <StateBlock kind="denied" title="برای دیدن باشگاه‌ها وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/clubs">ورود</Link>} />;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">باشگاه‌ها</h1><p className="page-sub">باشگاه‌ها صفحه عمومی، مالک، مدیران و اعضا دارند.</p></div></div>
      <div className="community">
        <div className="stack">
          <Input label="جست‌وجوی باشگاه" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.error && <StateBlock kind="error" title="فهرست باشگاه‌ها دریافت نشد" action={<Button onClick={list.reload}>تلاش دوباره</Button>} />}
          {!list.data && !list.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
          {list.data && (list.data.items.length === 0 ? <StateBlock kind="empty" title="باشگاهی پیدا نشد">اولین باشگاه را بسازید.</StateBlock> : (
            <ul className="list">
              {list.data.items.map((c) => (
                <li key={c.id} className="panel list__item">
                  <div style={{ flex: 1, minInlineSize: 0 }}>
                    <Link to={`/clubs/${c.slug}`}><strong>{c.name}</strong></Link>
                    <div className="muted">{faNum(c.memberCount)} عضو · {POLICY_FA[c.joinPolicy]}</div>
                    {c.description && <p className="muted" style={{ margin: 0 }}>{c.description.slice(0, 140)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <form className="panel stack" onSubmit={create} aria-labelledby="new-club-h">
          <h2 id="new-club-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>ساخت باشگاه</h2>
          <Input label="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />
          <Input label="نشانی (لاتین)" dir="ltr" className="input--ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="مثلاً tehran-meeples" />
          <Input label="معرفی" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          <Segmented legend="عضویت" name="policy" value={form.joinPolicy} onChange={(joinPolicy) => setForm({ ...form, joinPolicy })}
            options={(Object.keys(POLICY_FA) as (keyof typeof POLICY_FA)[]).map((k) => ({ value: k, label: POLICY_FA[k] }))} />
          <Button type="submit" disabled={form.name.trim().length < 2 || form.slug.length < 3}>ساخت باشگاه</Button>
        </form>
      </div>
    </>
  );
}

export function ClubPage() {
  const { slug = '' } = useParams();
  const c = useApi<ClubDetail>(`/clubs/${encodeURIComponent(slug)}`);
  usePageTitle(c.data?.name ?? 'باشگاه');
  const myId = useSession().me?.id ?? '';
  const run = useRun();
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState('');
  if (c.error) return <StateBlock kind={c.error.status === 404 ? 'empty' : c.error.status === 401 ? 'denied' : 'error'} title={c.error.status === 404 ? 'این باشگاه پیدا نشد' : 'باشگاه دریافت نشد'}>{c.error.messageFa}</StateBlock>;
  if (!c.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = c.data;
  const mine = d.myMembership;
  const manager = mine?.status === 'active' && (mine.role === 'owner' || mine.role === 'manager');
  const owner = mine?.status === 'active' && mine.role === 'owner';
  const act = async (fn: () => Promise<unknown>, ok?: string) => { await run(fn, ok); c.reload(); };
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{d.name}</h1>
          <p className="page-sub">{faNum(d.memberCount)} عضو · {POLICY_FA[d.joinPolicy]} · مالک <bdi>{d.owner.displayName}</bdi></p>
        </div>
        {!mine && d.joinPolicy !== 'invite' && <Button onClick={() => act(() => api(`/clubs/${d.slug}/join`, { method: 'POST' }), d.joinPolicy === 'open' ? 'به باشگاه پیوستید.' : 'درخواست عضویت ثبت شد.')}>{d.joinPolicy === 'open' ? 'پیوستن' : 'درخواست عضویت'}</Button>}
        {mine?.status === 'invited' && <Button onClick={() => act(() => api(`/clubs/${d.slug}/join`, { method: 'POST' }), 'به باشگاه پیوستید.')}>پذیرش دعوت</Button>}
        {mine?.status === 'requested' && <Badge>درخواست شما در انتظار بررسی است</Badge>}
        {!mine && d.joinPolicy === 'invite' && <Badge>عضویت فقط با دعوت</Badge>}
      </div>
      <div className="community">
        <div className="stack">
          <section className="panel stack">
            <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>معرفی</h2>
            {editing ? (
              <>
                <Input label="معرفی باشگاه" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} />
                <div className="row"><Button onClick={async () => { await act(() => api(`/clubs/${d.slug}`, { method: 'PATCH', body: { description: desc } }), 'ذخیره شد.'); setEditing(false); }}>ذخیره</Button><Button variant="ghost" onClick={() => setEditing(false)}>انصراف</Button></div>
              </>
            ) : <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.description || <span className="muted">معرفی‌ای ثبت نشده است.</span>}</p>}
            {manager && !editing && (
              <div className="row">
                <Button size="sm" variant="secondary" onClick={() => { setDesc(d.description); setEditing(true); }}>ویرایش معرفی</Button>
                <Select label="سیاست عضویت" value={d.joinPolicy} onChange={(e) => act(() => api(`/clubs/${d.slug}`, { method: 'PATCH', body: { joinPolicy: e.target.value } }), 'ذخیره شد.')}
                  options={(Object.keys(POLICY_FA) as (keyof typeof POLICY_FA)[]).map((k) => ({ value: k, label: POLICY_FA[k] }))} />
              </div>
            )}
          </section>
          {d.conversationId && <section className="panel"><h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>گفت‌وگوی باشگاه</h2>
            <ChatPanel load={`/conversations/${d.conversationId}/messages`} post={`/conversations/${d.conversationId}/messages`} conversationId={d.conversationId} title="گفت‌وگوی باشگاه" /></section>}
        </div>
        <div className="stack">
          {manager && d.pending.length > 0 && (
            <section className="panel stack" aria-labelledby="pending-h">
              <h2 id="pending-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>در انتظار</h2>
              <ul className="list">{d.pending.map((m) => (
                <MemberRow key={m.user.id} m={m}>
                  {m.status === 'requested' && <>
                    <Button size="sm" onClick={() => act(() => api(`/clubs/${d.slug}/requests/${m.user.id}/approve`, { method: 'POST' }), 'پذیرفته شد.')}>پذیرش</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => api(`/clubs/${d.slug}/requests/${m.user.id}/reject`, { method: 'POST' }))}>رد</Button>
                  </>}
                </MemberRow>))}</ul>
            </section>
          )}
          <section className="panel stack" aria-labelledby="members-h">
            <h2 id="members-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>اعضا</h2>
            <ul className="list">{d.members.map((m) => (
              <MemberRow key={m.user.id} m={m}>
                {owner && m.role !== 'owner' && (
                  <Button size="sm" variant="ghost" onClick={() => act(() => api(`/clubs/${d.slug}/members/${m.user.id}`, { method: 'PATCH', body: { role: m.role === 'manager' ? 'member' : 'manager' } }), 'نقش تغییر کرد.')}>
                    {m.role === 'manager' ? 'برداشتن مدیریت' : 'مدیر کردن'}
                  </Button>
                )}
                {manager && m.role !== 'owner' && (owner || m.role === 'member') && (
                  <Button size="sm" variant="ghost" onClick={() => act(() => api(`/clubs/${d.slug}/members/${m.user.id}`, { method: 'DELETE' }), 'عضو حذف شد.')}>حذف</Button>
                )}
              </MemberRow>))}</ul>
            {manager && <FriendInvite exclude={new Set([...d.members, ...d.pending].map((m) => m.user.id))} onInvite={(userId) => act(() => api(`/clubs/${d.slug}/invites`, { method: 'POST', body: { userId } }), 'دعوت فرستاده شد.')} />}
            {mine?.status === 'active' && mine.role !== 'owner' && (
              <Button variant="ghost" onClick={() => act(() => api(`/clubs/${d.slug}/members/${myId}`, { method: 'DELETE' }), 'از باشگاه خارج شدید.')}>ترک باشگاه</Button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
