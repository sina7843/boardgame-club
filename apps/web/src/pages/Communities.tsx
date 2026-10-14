import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ClubDetail, PublicProfile } from '@bg/contracts';
import { Avatar, Badge, BannerArt, Breadcrumbs, Button, Card, Icon, PageHead, Segmented, Select, StateBlock, Textarea, TextField, type BannerArtProps } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ChatPanel } from '../social/ChatPanel.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

const ROLE_FA = { owner: 'مالک', manager: 'مدیر', member: 'عضو' } as const;
const STATUS_FA = { active: 'عضو', requested: 'درخواست عضویت', invited: 'دعوت‌شده' } as const;
const POLICY_FA = { open: 'عضویت آزاد', request: 'عضویت با درخواست', invite: 'فقط با دعوت' } as const;
const POLICY_ICON = { open: 'door-open', request: 'hourglass', invite: 'lock' } as const;
const POLICIES = (Object.keys(POLICY_FA) as (keyof typeof POLICY_FA)[]).map((k) => ({ value: k, label: POLICY_FA[k] }));
const BANNERS: NonNullable<BannerArtProps['variant']>[] = ['felt', 'night', 'coral', 'gold', 'cream'];
/** Decorative banner colour, stable per club. */
const bannerOf = (slug: string) => BANNERS[[...slug].reduce((n, ch) => n + ch.charCodeAt(0), 0) % BANNERS.length]!;

type Member = { user: PublicProfile; role: keyof typeof ROLE_FA; status: keyof typeof STATUS_FA };

function useRun() {
  const toast = useToast();
  return async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try { const r = await fn(); if (ok) toast('success', ok); return r; }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); return undefined; }
  };
}

const Sep = () => <span className="bgv-sep" />;
const Loading = () => <StateBlock kind="loading" title="در حال بارگذاری…" />;

function MemberRow({ m, children }: { m: Member; children?: ReactNode }) {
  const { me } = useSession();
  const you = m.user.id === me?.id;
  return (
    <li>
      <Avatar size="sm" {...userIdentity(m.user).avatar} you={you} />
      <div className="sx-rows__main">
        <b><a href={`/users/${m.user.id}`}><bdi>{m.user.displayName}</bdi></a>{you && <Badge tone="you" size="sm">شما</Badge>}</b>
      </div>
      <div className="sx-rows__acts">
        <Badge size="sm" tone={m.role === 'owner' ? 'premium' : 'neutral'} icon={m.role === 'owner' ? 'crown' : m.role === 'manager' ? 'shield' : undefined}>{m.status === 'active' ? ROLE_FA[m.role] : STATUS_FA[m.status]}</Badge>
        {children}
      </div>
    </li>
  );
}

/** Friend picker used for group and club invitations. */
function FriendInvite({ onInvite, exclude }: { onInvite: (userId: string) => void; exclude: Set<string> }) {
  const friends = useApi<{ friends: PublicProfile[] }>('/me/friends');
  const options = (friends.data?.friends ?? []).filter((f) => !exclude.has(f.id));
  const [pick, setPick] = useState('');
  if (!options.length) return <p className="sx-cap">دوستی برای دعوت باقی نمانده است.</p>;
  return (
    <div className="sx-field-row">
      <Select label="دعوت دوست" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: 'انتخاب کنید' }, ...options.map((f) => ({ value: f.id, label: f.displayName }))]} />
      <Button variant="secondary" disabled={!pick} icon="user-plus" onClick={() => { onInvite(pick); setPick(''); }}>دعوت</Button>
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
  if (!list.data) return <Loading />;
  return (
    <>
      <PageTabs group="social" />
      <PageHead title="گروه‌ها" sub="گروه خصوصی برای جمع دوستانه و دعوت سریع همه به یک میز." />
      <div className="bgv-cols">
        {list.data.items.length === 0 ? <StateBlock kind="empty" icon="users" title="عضو گروهی نیستید" text="یک گروه بسازید و دوستانتان را دعوت کنید." /> : (
          <Card>
            <ul className="sx-rows">
              {list.data.items.map((g) => (
                <li key={g.id}>
                  <span className="sx-tile"><Icon name="users" /></span>
                  <div className="sx-rows__main">
                    <b>{g.name}</b>
                    <span>{faNum(g.memberCount)} عضو<Sep />{g.myStatus === 'invited' ? 'دعوت شده‌اید' : ROLE_FA[g.myRole as 'owner']}</span>
                  </div>
                  <div className="sx-rows__acts"><Button size="sm" variant={g.myStatus === 'invited' ? 'primary' : 'secondary'} href={`/groups/${g.id}`}>{g.myStatus === 'invited' ? 'دیدن دعوت' : 'باز کردن'}</Button></div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <form onSubmit={create}>
          <Card title="ساخت گروه" className="sx-stack-sm">
            <TextField label="نام گروه تازه" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <Button type="submit" variant="primary" icon="plus" block disabled={name.trim().length < 2}>ساخت گروه</Button>
          </Card>
        </form>
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
  if (g.error) return <StateBlock kind={g.error.status === 403 ? 'denied' : 'error'} title={g.error.status === 403 ? 'این گروه خصوصی است' : 'گروه دریافت نشد'} text={g.error.messageFa} />;
  if (!g.data) return <Loading />;
  const d = g.data;
  const manager = d.myStatus === 'active' && (d.myRole === 'owner' || d.myRole === 'manager');
  const active = d.members.filter((m) => m.status === 'active');
  const owner = d.members.find((m) => m.user.id === d.ownerId);
  const leave = async () => { await run(() => api(`/groups/${d.id}/members/${myId}`, { method: 'DELETE' })); navigate('/groups'); };
  return (
    <>
      <Breadcrumbs items={[{ label: 'گروه‌ها', href: '/groups' }, { label: d.name }]} />
      <Card className="sx-head">
        <span className="sx-mosaic" aria-hidden="true">
          {active.slice(0, 3).map((m) => <Avatar key={m.user.id} {...userIdentity(m.user).avatar} />)}
          {active.length > 3 && <Avatar initials={`+${faNum(active.length - 3)}`} />}
        </span>
        <div className="sx-head__text">
          <div className="bgv-row"><h1 className="t-page-sm">گروه {d.name}</h1><Badge icon="lock">گروه خصوصی</Badge></div>
          <span className="t-body-sm bgv-muted">{faNum(active.length)} عضو{owner && <><Sep />مالک: <bdi>{owner.user.displayName}</bdi></>}</span>
        </div>
        {d.myStatus === 'active' && d.myRole !== 'owner' && <Button variant="leave" onClick={leave}>ترک گروه</Button>}
      </Card>
      {d.myStatus === 'invited' ? (
        <Card className="bgv-row">
          <p style={{ margin: 0, flex: 1 }}>به این گروه دعوت شده‌اید.</p>
          <Button variant="primary" onClick={async () => { await run(() => api(`/groups/${d.id}/accept`, { method: 'POST' }), 'به گروه پیوستید.'); g.reload(); }}>پذیرش</Button>
          <Button variant="secondary" onClick={leave}>رد</Button>
        </Card>
      ) : (
        <div className="bgv-cols">
          {d.conversationId && <div className="sx-chatcard"><ChatPanel load={`/conversations/${d.conversationId}/messages`} post={`/conversations/${d.conversationId}/messages`} conversationId={d.conversationId} title="گفت‌وگوی گروه" /></div>}
          <div className="sx-stack">
            <Card title="بازی با گروه" className="sx-stack-sm">
              <p className="t-body-sm" style={{ margin: 0 }}>یک بازی انتخاب کنید و میز بسازید؛ در لابی با «دعوت همه»، دعوت برای همهٔ اعضای گروه می‌رود.</p>
              <div><Button variant="primary" icon="plus" href="/games">ساخت میز</Button></div>
            </Card>
            <Card title={`اعضا (${faNum(active.length)})`} className="sx-stack-sm">
              <ul className="sx-rows">
                {d.members.map((m) => (
                  <MemberRow key={m.user.id} m={m}>
                    {manager && m.role !== 'owner' && <Button size="sm" variant="ghost" onClick={async () => { await run(() => api(`/groups/${d.id}/members/${m.user.id}`, { method: 'DELETE' })); g.reload(); }}>حذف</Button>}
                  </MemberRow>
                ))}
              </ul>
              {manager && <FriendInvite exclude={new Set(d.members.map((m) => m.user.id))} onInvite={async (userId) => { await run(() => api(`/groups/${d.id}/invites`, { method: 'POST', body: { userId } }), 'دعوت فرستاده شد.'); g.reload(); }} />}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== Clubs =====================

const Crest = ({ name, size }: { name: string; size: number }) => <span className="sx-crest" style={{ inlineSize: size, blockSize: size, fontSize: size * 0.41 }}>{name.trim().charAt(0)}</span>;

export function ClubsPage() {
  usePageTitle('باشگاه‌ها');
  const [q, setQ] = useState('');
  const list = useApi<{ items: { id: string; slug: string; name: string; description: string; joinPolicy: keyof typeof POLICY_FA; memberCount: number; myStatus?: keyof typeof STATUS_FA | null }[] }>(`/clubs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  const navigate = useNavigate();
  const run = useRun();
  const [form, setForm] = useState({ slug: '', name: '', description: '', joinPolicy: 'open' as keyof typeof POLICY_FA });
  const joinClub = async (slug: string, policy: keyof typeof POLICY_FA) => {
    await run(() => api(`/clubs/${slug}/join`, { method: 'POST' }), policy === 'request' ? 'درخواست عضویت ثبت شد.' : 'به باشگاه پیوستید.');
    list.reload();
  };
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const c = await run(() => api<ClubDetail>('/clubs', { method: 'POST', body: form }), 'باشگاه ساخته شد.');
    if (c) navigate(`/clubs/${c.slug}`);
  };
  if (list.error?.status === 401) return <StateBlock kind="denied" title="برای دیدن باشگاه‌ها وارد شوید" action={<Button variant="primary" href="/login?next=/clubs">ورود</Button>} />;
  return (
    <>
      <PageTabs group="social" />
      <PageHead title="باشگاه‌ها" sub="باشگاه‌ها صفحه عمومی، مالک، مدیران و اعضا دارند. برای جمع خصوصی دوستان، گروه بسازید." />
      <div className="bgv-cols">
        <section className="sx-stack" aria-label="فهرست باشگاه‌ها">
          <TextField icon="search" label="جست‌وجوی باشگاه" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.error && <StateBlock kind="error" title="فهرست باشگاه‌ها دریافت نشد" action={<Button onClick={list.reload}>تلاش دوباره</Button>} />}
          {!list.data && !list.error && <Loading />}
          {list.data && (list.data.items.length === 0 ? <StateBlock kind="empty" title="باشگاهی پیدا نشد" text="اولین باشگاه را بسازید." /> : (
            <>
              <p className="sx-cap" role="status"><b>{faNum(list.data.items.length)} باشگاه</b></p>
              <div className="bgv-grid">
                {list.data.items.map((c) => (
                  <Card key={c.id} flush as="article" className="sx-clubcard">
                    <BannerArt variant={bannerOf(c.slug)} height={72} />
                    <div className="sx-clubcard__body">
                      <div className="sx-clubcard__top"><Crest name={c.name} size={56} /><Badge size="sm" icon={POLICY_ICON[c.joinPolicy]}>{POLICY_FA[c.joinPolicy]}</Badge></div>
                      <div className="bgv-row"><a href={`/clubs/${c.slug}`} className="t-title"><strong>{c.name}</strong></a><span className="sx-cap bgv-latin" dir="ltr">{c.slug}</span></div>
                      {c.description && <p className="sx-desc">{c.description}</p>}
                      <div className="sx-clubcard__foot">
                        <span className="sx-cap bgv-row"><Icon name="users" size="sm" />{faNum(c.memberCount)} عضو</span>
                        {c.myStatus === 'active' ? <Button size="sm" variant="ghost" href={`/clubs/${c.slug}`}>دیدن باشگاه</Button>
                          : c.myStatus === 'requested' ? <Badge size="sm" tone="warning" icon="hourglass">درخواست در انتظار بررسی</Badge>
                          : c.joinPolicy === 'invite' && c.myStatus !== 'invited' ? <Badge size="sm" icon="lock">فقط با دعوت</Badge>
                          : <Button size="sm" variant={c.joinPolicy === 'open' || c.myStatus === 'invited' ? 'primary' : 'secondary'} onClick={() => void joinClub(c.slug, c.joinPolicy)}>
                              {c.myStatus === 'invited' ? 'پذیرش دعوت' : c.joinPolicy === 'open' ? 'پیوستن' : 'درخواست عضویت'}</Button>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ))}
        </section>
        <form style={{ minInlineSize: 0 }} onSubmit={create} aria-labelledby="new-club-h">
          <Card title={<span id="new-club-h">ساخت باشگاه</span>} className="sx-stack-sm">
            <TextField label="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />
            <TextField label="نشانی (لاتین)" dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="مثلاً tehran-meeples" />
            <Textarea label="معرفی" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            <div className="bgv-field" style={{ minInlineSize: 0, overflowX: 'auto' }}><span className="bgv-label">عضویت</span>
              <Segmented block label="عضویت" value={form.joinPolicy} onChange={(joinPolicy) => setForm({ ...form, joinPolicy: joinPolicy as keyof typeof POLICY_FA })} options={POLICIES} />
            </div>
            <Button type="submit" variant="primary" block disabled={form.name.trim().length < 2 || form.slug.length < 3}>ساخت باشگاه</Button>
            <p className="sx-cap">سازنده مالک باشگاه می‌شود و می‌تواند مدیر تعیین کند.</p>
          </Card>
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
  if (c.error) return <StateBlock kind={c.error.status === 404 ? 'empty' : c.error.status === 401 ? 'denied' : 'error'} title={c.error.status === 404 ? 'این باشگاه پیدا نشد' : 'باشگاه دریافت نشد'} text={c.error.messageFa} />;
  if (!c.data) return <Loading />;
  const d = c.data;
  const mine = d.myMembership;
  const manager = mine?.status === 'active' && (mine.role === 'owner' || mine.role === 'manager');
  const owner = mine?.status === 'active' && mine.role === 'owner';
  const act = async (fn: () => Promise<unknown>, ok?: string) => { await run(fn, ok); c.reload(); };
  const join = (ok: string) => act(() => api(`/clubs/${d.slug}/join`, { method: 'POST' }), ok);
  return (
    <>
      <Breadcrumbs items={[{ label: 'باشگاه‌ها', href: '/clubs' }, { label: d.name }]} />
      <Card flush>
        <BannerArt variant={bannerOf(d.slug)} height={112} />
        <div className="sx-head sx-clubhead">
          <span className="sx-clubhead__crest"><Crest name={d.name} size={88} /></span>
          <div className="sx-head__text" style={{ paddingBlockStart: 'var(--space-3)' }}>
            <div className="bgv-row"><h1 className="t-page-sm">{d.name}</h1><span className="sx-cap bgv-latin" dir="ltr">{d.slug}</span></div>
            <div className="bgv-row">
              <Badge icon={POLICY_ICON[d.joinPolicy]}>{POLICY_FA[d.joinPolicy]}</Badge>
              {mine?.status === 'active' && <Badge icon="shield">نقش شما: {ROLE_FA[mine.role]}</Badge>}
              <span className="sx-cap bgv-row">{faNum(d.memberCount)} عضو<Sep />مالک: <bdi>{d.owner.displayName}</bdi></span>
            </div>
          </div>
          <div className="bgv-row">
            {!mine && d.joinPolicy !== 'invite' && <Button variant="primary" onClick={() => join(d.joinPolicy === 'open' ? 'به باشگاه پیوستید.' : 'درخواست عضویت ثبت شد.')}>{d.joinPolicy === 'open' ? 'پیوستن' : 'درخواست عضویت'}</Button>}
            {mine?.status === 'invited' && <Button variant="primary" onClick={() => join('به باشگاه پیوستید.')}>پذیرش دعوت</Button>}
            {mine?.status === 'requested' && <Badge tone="warning" icon="hourglass">درخواست شما در انتظار بررسی است</Badge>}
            {!mine && d.joinPolicy === 'invite' && <Badge icon="lock">عضویت فقط با دعوت</Badge>}
            {mine?.status === 'active' && mine.role !== 'owner' && <Button variant="leave" onClick={() => act(() => api(`/clubs/${d.slug}/members/${myId}`, { method: 'DELETE' }), 'از باشگاه خارج شدید.')}>ترک باشگاه</Button>}
          </div>
        </div>
      </Card>
      <div className="bgv-cols">
        <div className="sx-stack">
          <Card title="معرفی" className="sx-stack-sm" actions={manager && !editing ? <Button size="sm" variant="secondary" icon="pencil" onClick={() => { setDesc(d.description); setEditing(true); }}>ویرایش معرفی</Button> : undefined}>
            {editing ? (
              <>
                <Textarea label="معرفی باشگاه" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} />
                <div className="bgv-row"><Button variant="primary" onClick={async () => { await act(() => api(`/clubs/${d.slug}`, { method: 'PATCH', body: { description: desc } }), 'ذخیره شد.'); setEditing(false); }}>ذخیره</Button><Button variant="secondary" onClick={() => setEditing(false)}>انصراف</Button></div>
              </>
            ) : <p className="t-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.description || <span className="bgv-muted">معرفی‌ای ثبت نشده است.</span>}</p>}
            {manager && !editing && (
              <div style={{ maxInlineSize: 280 }}>
                <Select label="سیاست عضویت" hint="مالک و مدیرها تغییرش می‌دهند." value={d.joinPolicy} onChange={(e) => act(() => api(`/clubs/${d.slug}`, { method: 'PATCH', body: { joinPolicy: e.target.value } }), 'ذخیره شد.')} options={POLICIES} />
              </div>
            )}
          </Card>
          {d.conversationId && <div className="sx-chatcard"><ChatPanel load={`/conversations/${d.conversationId}/messages`} post={`/conversations/${d.conversationId}/messages`} conversationId={d.conversationId} title="گفت‌وگوی باشگاه" /></div>}
        </div>
        <div className="sx-stack">
          {manager && d.pending.length > 0 && (
            <Card title={<>در انتظار <Badge tone="count">{d.pending.length}</Badge></>}>
              <ul className="sx-rows">{d.pending.map((m) => (
                <MemberRow key={m.user.id} m={m}>
                  {m.status === 'requested' && <>
                    <Button size="sm" variant="primary" onClick={() => act(() => api(`/clubs/${d.slug}/requests/${m.user.id}/approve`, { method: 'POST' }), 'پذیرفته شد.')}>پذیرش</Button>
                    <Button size="sm" variant="secondary" onClick={() => act(() => api(`/clubs/${d.slug}/requests/${m.user.id}/reject`, { method: 'POST' }))}>رد</Button>
                  </>}
                </MemberRow>))}</ul>
            </Card>
          )}
          <Card title={`اعضا (${faNum(d.members.length)})`} className="sx-stack-sm">
            <ul className="sx-rows">{d.members.map((m) => (
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
          </Card>
        </div>
      </div>
    </>
  );
}
