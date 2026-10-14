import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { avatarSvg, parseAvatar, type ConversationItem } from '@bg/contracts';
import { Button, Card, ChipGroup, Conversation, PageHead, StateBlock, Tag, TextField } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ChatPanel } from '../social/ChatPanel.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

const hm = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });
const day = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', timeZone: 'Asia/Tehran' });
const KIND_TAG = { group: 'گروه', club: 'باشگاه' } as const;
const FILTERS = [{ value: 'all', label: 'همه' }, { value: 'direct', label: 'خصوصی' }, { value: 'group', label: 'گروه' }, { value: 'club', label: 'باشگاه' }];

/** The built avatar as an image URL (Conversation takes `src`); catalogue SVG only, so the markup is trusted. */
function avatarSrc(avatarKey: string): string | undefined {
  const p = parseAvatar(avatarKey);
  return p ? `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${avatarSvg(p)}</svg>`)}` : undefined;
}
const stamp = (iso: string) => (Date.now() - new Date(iso).getTime() < 864e5 ? hm.format(new Date(iso)) : day.format(new Date(iso)));

function Inbox({ activeId }: { activeId?: string }) {
  const list = useApi<{ items: ConversationItem[] }>('/me/conversations');
  const reload = list.reload;
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  useEffect(() => {
    window.addEventListener('bg:message', reload);
    window.addEventListener('bg:read', reload);
    return () => { window.removeEventListener('bg:message', reload); window.removeEventListener('bg:read', reload); };
  }, [reload]);
  const shown = useMemo(() => {
    const needle = q.trim();
    return (list.data?.items ?? []).filter((c) => (kind === 'all' || c.kind === kind) && (!needle || c.title.includes(needle) || c.lastMessage?.body.includes(needle)));
  }, [list.data, kind, q]);

  if (list.error) return <StateBlock kind="error" title="گفت‌وگوها دریافت نشد" action={<Button onClick={reload}>تلاش دوباره</Button>} />;
  if (!list.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!list.data.items.length && !activeId) return <StateBlock kind="empty" title="هنوز گفت‌وگویی ندارید" text="با دوستان خود گفت‌وگو کنید یا به یک باشگاه بپیوندید." action={<Button variant="secondary" href="/friends">رفتن به دوستان</Button>} />;

  const active = list.data.items.find((c) => c.id === activeId);
  return (
    <Card flush className="sx-dm" data-open={!!activeId}>
      <aside className="sx-dm__list" aria-label="گفت‌وگوها">
        <div className="sx-dm__filters">
          <TextField icon="search" type="search" label="جست‌وجوی گفت‌وگو" placeholder="جست‌وجوی نام یا پیام" value={q} onChange={(e) => setQ(e.target.value)} />
          <ChipGroup size="sm" label="نوع گفت‌وگو" options={FILTERS} value={kind} onChange={(v) => setKind(v as string)} />
        </div>
        <nav className="sx-dm__nav" aria-label="گفت‌وگوها">
          {shown.length === 0 && <p className="sx-cap" role="status">گفت‌وگویی پیدا نشد.</p>}
          {shown.map((c) => (
            <Conversation key={c.id} href={`/messages/${c.id}`} active={c.id === activeId}
              name={<><bdi>{c.title}</bdi>{c.kind in KIND_TAG && <Tag>{KIND_TAG[c.kind as keyof typeof KIND_TAG]}</Tag>}</>}
              {...(c.other ? { initials: c.other.displayName.trim().charAt(0), src: avatarSrc(c.other.avatarKey) } : { icon: c.kind === 'club' ? 'shield' : 'users' })}
              preview={c.lastMessage ? <><bdi>{c.lastMessage.senderName}</bdi>: {c.lastMessage.body}</> : 'بدون پیام'}
              time={c.lastMessage ? stamp(c.lastMessage.createdAt) : undefined} unread={c.unreadCount} />
          ))}
        </nav>
      </aside>
      <div className="sx-dm__thread">
        {activeId ? (
          <>
            <ChatPanel key={activeId} load={`/conversations/${activeId}/messages`} post={`/conversations/${activeId}/messages`} conversationId={activeId}
              title={active?.other?.displayName ?? active?.title} icon={active?.other ? 'user' : active?.kind === 'club' ? 'shield' : 'users'}
              head={<>
                <Button iconOnly variant="ghost" icon="arrow-right" href="/messages" className="sx-dm__back">همه گفت‌وگوها</Button>
                {active?.other && <>
                  <Button size="sm" variant="secondary" icon="armchair" href="/games">دعوت به میز</Button>
                  <Button size="sm" variant="ghost" iconOnly icon="user" href={`/users/${active.other.id}`}>پروفایل</Button>
                </>}
              </>} />
          </>
        ) : <div className="sx-dm__empty"><StateBlock kind="empty" icon="message-circle" title="یک گفت‌وگو را انتخاب کنید" /></div>}
      </div>
    </Card>
  );
}

export function MessagesPage() {
  usePageTitle('پیام‌ها');
  return (
    <>
      <PageTabs group="social" />
      <PageHead title="پیام‌ها" sub="گفت‌وگوهای خصوصی، گروه‌ها و باشگاه‌ها." />
      <Inbox />
    </>
  );
}

export function ConversationPage() {
  const { id = '' } = useParams();
  usePageTitle('گفت‌وگو');
  return <Inbox activeId={id} />;
}
