import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import type { ConversationItem } from '@bg/contracts';
import { Avatar, Button, Icon, StateBlock } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ChatPanel } from '../social/ChatPanel.tsx';

function ConversationList({ activeId }: { activeId?: string }) {
  const list = useApi<{ items: ConversationItem[] }>('/me/conversations');
  const reload = list.reload;
  useEffect(() => {
    window.addEventListener('bg:message', reload);
    return () => window.removeEventListener('bg:message', reload);
  }, [reload]);
  if (list.error) return <StateBlock kind="error" title="گفت‌وگوها دریافت نشد" action={<Button onClick={reload}>تلاش دوباره</Button>} />;
  if (!list.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!list.data.items.length) return <StateBlock kind="empty" title="هنوز گفت‌وگویی ندارید" action={<Link className="btn btn--secondary" to="/friends">رفتن به دوستان</Link>}>با دوستان خود گفت‌وگو کنید یا به یک باشگاه بپیوندید.</StateBlock>;
  return (
    <ul className="list" aria-label="گفت‌وگوها">
      {list.data.items.map((c) => (
        <li key={c.id}>
          <Link to={`/messages/${c.id}`} className={`convo ${c.id === activeId ? 'convo--active' : ''}`} aria-current={c.id === activeId ? 'page' : undefined}>
            {c.other ? <Avatar avatarKey={c.other.avatarKey} name={c.other.displayName} size={36} /> : <span className="avatar" style={{ inlineSize: 36, blockSize: 36 }}><Icon name="players" size={18} /></span>}
            <span className="convo__body">
              <span className="convo__title"><bdi>{c.title}</bdi>{c.unread && <span className="dot" aria-label="خوانده‌نشده" />}</span>
              <span className="convo__last muted">{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.body}` : 'بدون پیام'}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MessagesPage() {
  usePageTitle('پیام‌ها');
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">پیام‌ها</h1><p className="page-sub">گفت‌وگوهای خصوصی، گروه‌ها و باشگاه‌ها.</p></div></div>
      <div style={{ maxInlineSize: 720 }}><ConversationList /></div>
    </>
  );
}

export function ConversationPage() {
  const { id = '' } = useParams();
  usePageTitle('گفت‌وگو');
  return (
    <div className="messages">
      <aside className="messages__list" aria-label="گفت‌وگوها"><ConversationList activeId={id} /></aside>
      <div className="messages__thread">
        <Link to="/messages" className="breadcrumb messages__back"><Icon name="chevron" size={18} />همه گفت‌وگوها</Link>
        <ChatPanel key={id} load={`/conversations/${id}/messages`} post={`/conversations/${id}/messages`} conversationId={id} />
      </div>
    </div>
  );
}
