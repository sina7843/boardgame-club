import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClientEvents, MESSAGE_EDIT_WINDOW_SECONDS, SLOW_MODE_OPTIONS, type MessageItem, type ReadEvent, type TypingEvent } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button, Chat, Icon, Menu, Message, MentionSuggest, ReactionBar, Select, StateBlock, SystemMessage, Typing, UnreadDivider, type MenuItem, type SeatNo } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { AvatarArt } from '../lib/bgv.tsx';
import { useRealtime } from '../lib/realtime.tsx';
import { useSession } from '../lib/session.tsx';
import { QuickChatChips } from './QuickChat.tsx';
import { ReportDialog } from './ReportDialog.tsx';

interface Page {
  items: MessageItem[]; nextBefore: string | null; canPost: boolean; canModerate: boolean; conversationId?: string;
  kind: 'direct' | 'table' | 'group' | 'club'; slowModeSeconds: number; readUpTo: string | null; myReadUpTo?: string | null; muted: boolean;
}
/** A message on its way (optimistic): shown at once, replaced by the server copy, or kept with a retry button. */
interface Pending { clientId: string; body: string; quick?: string; replyTo: MessageItem | null; failed: boolean }

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });
const EDIT_MS = MESSAGE_EDIT_WINDOW_SECONDS * 1000;
const SLOW_FA: Record<number, string> = { 0: 'خاموش', 10: '۱۰ ثانیه', 30: '۳۰ ثانیه', 60: '۱ دقیقه', 300: '۵ دقیقه' };

function readDraft(key: string): string { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } }
function writeDraft(key: string, text: string) { try { if (text) localStorage.setItem(key, text); else localStorage.removeItem(key); } catch { /* storage unavailable */ } }

/** «⋮» on a message: a native popover with the DS Menu (reply, edit, report, delete). */
/** «⋮» button opening a DS Menu in a native popover (message options, profile «بیشتر»). */
export function MessageMenu({ items, label = 'گزینه‌های پیام', className = 'chat-msg__more', open, onClosed }: {
  items: MenuItem[]; label?: string; className?: string;
  /** Open from outside (long-press on the message); `onClosed` fires when the popover hides. */
  open?: boolean; onClosed?: () => void;
}) {
  const id = useId();
  useEffect(() => {
    const el = document.getElementById(id) as (HTMLElement & { showPopover?: () => void }) | null;
    if (!el) return;
    if (open) el.showPopover?.();
    const onToggle = (e: Event) => { if ((e as ToggleEvent).newState === 'closed') onClosed?.(); };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, [id, open, onClosed]);
  if (!items.length) return null;
  const close = () => (document.getElementById(id) as HTMLElement & { hidePopover?: () => void } | null)?.hidePopover?.();
  return (
    <>
      <Button variant="ghost" size="sm" iconOnly icon="more-vertical" className={className} popoverTarget={id}>{label}</Button>
      <div id={id} popover="auto" className="chat-pop">
        <Menu label={label} items={items.map((it) => ({ ...it, onClick: (e) => { close(); it.onClick?.(e); } }))} />
      </div>
    </>
  );
}

/**
 * Conversation view used for DMs, group/club chat and table chat (DS Chat + Message). Text is rendered as plain text only.
 * New messages arrive through the user's own socket room (server-side authorization), then are de-duplicated here.
 */
/** Table invitations the server drops into private chats (social routes, POST /tables/:id/invites). */
const INVITE_RE = /^دعوت به میز «(.+)»: \/tables\/([0-9a-f-]{36})$/;

/** A game event shown in the table chat (never stored as a message). */
export interface ChatEvent { id: string; at: string; text: string; seat?: number }

export function ChatPanel({ load, post, conversationId: fixedId, title, quick, onClose, sheet, icon, className, readOnly, people, head, clubSlug, events }: {
  load: string; post: string; conversationId?: string; title?: string; compact?: boolean; quick?: boolean;
  onClose?: () => void; sheet?: boolean; icon?: string; className?: string;
  /** Extra controls in the chat header (DM: back, invite, more). */
  head?: ReactNode;
  /** Club chats: lets moderators remove a member from the message menu. */
  clubSlug?: string;
  /** Table chats: game events merged into the timeline as system lines. */
  events?: ChatEvent[];
  /** Spectators: no composer (the server also refuses posting); reactions and mute still work. */
  readOnly?: boolean;
  /** Extra @-mention candidates (e.g. the table's players); people who already wrote here are always offered. */
  people?: string[];
}) {
  const { me } = useSession();
  const { socket } = useRealtime();
  const toast = useToast();
  const draftKey = `bg.draft.${load}`;
  const [items, setItems] = useState<MessageItem[]>([]);
  const [meta, setMeta] = useState<Omit<Page, 'items'>>();
  const [error, setError] = useState<ApiFailure>();
  const [text, setText] = useState(() => readDraft(draftKey));
  const [pending, setPending] = useState<Pending[]>([]);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editing, setEditing] = useState<MessageItem | null>(null);
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  const [reporting, setReporting] = useState<MessageItem | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typedAt = useRef(0);
  const conversationId = fixedId ?? meta?.conversationId;
  const composeId = `compose-${conversationId ?? load}`;

  const fetchPage = useCallback(async (before?: string) => {
    try {
      const p = await api<Page>(`${load}${before ? `${load.includes('?') ? '&' : '?'}before=${encodeURIComponent(before)}` : ''}`);
      setItems((old) => (before ? [...p.items, ...old] : p.items));
      const { items: _, ...rest } = p;
      setMeta(rest);
      setError(undefined);
    } catch (e) { if (e instanceof ApiFailure) setError(e); }
  }, [load]);

  /** Opening the conversation marks it read on the server; messages that arrive while it is open are marked here. */
  const markRead = useCallback(() => {
    if (!conversationId) return;
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => { void api(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => { /* next open marks it */ }); }, 600);
  }, [conversationId]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);
  useEffect(() => () => clearTimeout(readTimer.current), []);
  useEffect(() => {
    const onMessage = (e: Event) => {
      const m = (e as CustomEvent<MessageItem>).detail;
      if (m.conversationId !== conversationId) return;
      setItems((old) => (old.some((x) => x.id === m.id) ? old.map((x) => (x.id === m.id ? m : x)) : [...old, m]));
      if (m.clientId) setPending((old) => old.filter((p) => p.clientId !== m.clientId));
      if (m.sender.id !== me?.id) {
        setTypers(({ [m.sender.id]: _, ...rest }) => rest);
        if (document.visibilityState === 'visible') markRead();
      }
    };
    const onRead = (e: Event) => {
      const r = (e as CustomEvent<ReadEvent>).detail;
      if (r.conversationId !== conversationId || r.userId === me?.id) return;
      setMeta((old) => old && (!old.readUpTo || r.readAt > old.readUpTo) ? { ...old, readUpTo: r.readAt } : old);
    };
    const onTyping = (e: Event) => {
      const t = (e as CustomEvent<TypingEvent>).detail;
      if (t.conversationId === conversationId) setTypers((old) => ({ ...old, [t.userId]: { name: t.displayName, until: Date.now() + 5000 } }));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') markRead(); };
    window.addEventListener('bg:message', onMessage);
    window.addEventListener('bg:read', onRead);
    window.addEventListener('bg:typing', onTyping);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('bg:message', onMessage);
      window.removeEventListener('bg:read', onRead);
      window.removeEventListener('bg:typing', onTyping);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [conversationId, me?.id, markRead]);
  // "Typing…" lines expire on their own.
  const typing = Object.values(typers);
  useEffect(() => {
    if (!typing.length) return;
    const t = setInterval(() => setTypers((old) => Object.fromEntries(Object.entries(old).filter(([, v]) => v.until > Date.now()))), 1000);
    return () => clearInterval(t);
  }, [typing.length]);
  // First open: jump to the «پیام تازه» divider when there is one; afterwards follow new messages.
  const jumped = useRef(false);
  useEffect(() => {
    const el = list.current?.closest('.bgv-chat')?.querySelector('.bgv-chat__list');
    const divider = !jumped.current ? el?.querySelector('.bgv-unread') : null;
    if (items.length) jumped.current = true;
    if (divider) divider.scrollIntoView({ block: 'center' });
    else el?.scrollTo({ top: el.scrollHeight });
  }, [items.length, pending.length]);

  // Slow mode (members): count down to the next allowed message instead of letting the server refuse it.
  const [nextAt, setNextAt] = useState(0);
  const [mentionAt, setMentionAt] = useState(0);
  const [declined, setDeclined] = useState<string[]>([]);
  // Long-press lifts a message: its reaction bar and menu open together over a scrim.
  const [lifted, setLifted] = useState<string | null>(null);
  const press = useRef<number>(undefined);
  const unlift = useCallback(() => { setLifted(null); setReacting(null); }, []);
  const [, tick] = useState(0);
  useEffect(() => {
    if (nextAt <= Date.now()) return;
    const t = setInterval(() => { tick((n) => n + 1); if (Date.now() >= nextAt) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, [nextAt]);
  const deliver = async (p: Pending) => {
    setPending((old) => old.map((x) => (x.clientId === p.clientId ? { ...x, failed: false } : x)));
    try {
      const m = await api<MessageItem>(post, { method: 'POST', body: { ...(p.quick ? { quick: p.quick } : { body: p.body }), replyToId: p.replyTo?.id, clientId: p.clientId } });
      setPending((old) => old.filter((x) => x.clientId !== p.clientId));
      setItems((old) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
      if (meta && !meta.canModerate && meta.slowModeSeconds > 0) setNextAt(Date.now() + meta.slowModeSeconds * 1000);
    } catch (err) {
      setPending((old) => old.map((x) => (x.clientId === p.clientId ? { ...x, failed: true } : x)));
      toast('error', err instanceof ApiFailure ? err.messageFa : 'پیام ارسال نشد؛ اتصال را بررسی کنید.');
    }
  };

  const onType = (value: string) => {
    setText(value);
    writeDraft(draftKey, value);
    if (value && socket && conversationId && Date.now() - typedAt.current > 3000) {
      typedAt.current = Date.now();
      socket.emit(ClientEvents.conversationTyping, { conversationId });
    }
  };

  const cancelCompose = () => { setReplyTo(null); if (editing) { setEditing(null); onType(''); } };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || (!editing && nextAt > Date.now())) return;
    if (editing) {
      try {
        const m = await api<MessageItem>(`/messages/${editing.id}`, { method: 'PATCH', body: { body: text } });
        setItems((old) => old.map((x) => (x.id === m.id ? m : x)));
        setEditing(null);
        onType('');
      } catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'ویرایش انجام نشد.'); }
      return;
    }
    const p: Pending = { clientId: crypto.randomUUID(), body: text.trim(), replyTo, failed: false };
    setPending((old) => [...old, p]);
    setReplyTo(null);
    onType('');
    await deliver(p);
  };

  const react = async (m: MessageItem, emoji: string) => {
    setReacting(null);
    try { const u = await api<MessageItem>(`/messages/${m.id}/reactions`, { method: 'POST', body: { emoji } }); setItems((old) => old.map((x) => (x.id === u.id ? u : x))); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'واکنش ثبت نشد.'); }
  };

  const setMuted = async (muted: boolean) => {
    try { await api(`/conversations/${conversationId}/mute`, { method: 'PUT', body: { muted } }); setMeta((old) => old && { ...old, muted }); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'تغییر انجام نشد.'); }
  };

  const remove = async (m: MessageItem) => {
    try { await api(`/messages/${m.id}`, { method: 'DELETE' }); setItems((old) => old.map((x) => (x.id === m.id ? { ...x, deleted: true, body: '' } : x))); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'حذف نشد.'); }
  };

  const setSlowMode = async (seconds: number) => {
    try { await api(`/conversations/${conversationId}/slow-mode`, { method: 'PUT', body: { seconds } }); setMeta((old) => old && { ...old, slowModeSeconds: seconds }); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'تغییر انجام نشد.'); }
  };

  const frame = (body: ReactNode, composer?: ReactNode, headExtra?: ReactNode) => (
    <Chat title={title ?? 'گفت‌وگو'} icon={icon ?? 'message-circle'} className={className} sheet={sheet} bottom
      {...(onClose ? { onClose } : {})} {...(headExtra || head ? { headExtra: <>{head}{headExtra}</> } : {})} composer={readOnly ? undefined : composer}
      {...(readOnly ? { readOnly: true } : {})}
      {...(meta && conversationId ? { mutedToggle: { muted: meta.muted, onToggle: (v: boolean) => void setMuted(v) } } : {})}>
      {body}
    </Chat>
  );

  if (error) return frame(<StateBlock kind={error.status === 403 ? 'denied' : 'error'} title={error.status === 403 ? 'به این گفت‌وگو دسترسی ندارید' : 'گفت‌وگو بارگذاری نشد'} text={error.messageFa} />);
  if (!meta) return frame(<StateBlock kind="loading" title="در حال بارگذاری پیام‌ها…" />);

  const now = Date.now();
  const scoped = meta.kind === 'group' || meta.kind === 'club';
  const reply = (r: MessageItem['replyTo']) => r ? { reply: { author: <bdi>{r.senderName}</bdi>, text: r.deleted ? 'پیام حذف‌شده' : r.body } } : {};

  const slow = scoped && (meta.canModerate || meta.slowModeSeconds > 0) ? (
    meta.canModerate
      ? <Select className="chat-slow" aria-label="حالت آهسته" value={String(meta.slowModeSeconds)} onChange={(e) => void setSlowMode(Number(e.target.value))}
          options={SLOW_MODE_OPTIONS.map((n) => ({ value: String(n), label: `آهسته: ${SLOW_FA[n]}` }))} />
      : <span className="t-caption bgv-muted">آهسته: هر {SLOW_FA[meta.slowModeSeconds] ?? `${faNum(meta.slowModeSeconds)} ثانیه`} یک پیام</span>
  ) : undefined;

  // @-mention suggestions: the token being typed at the end of the text, matched against known people.
  const token = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1];
  const names = [...new Set([...(people ?? []), ...items.map((m) => m.sender.displayName)])].filter((n) => n !== me?.displayName);
  const suggestions = token === undefined ? [] : names.filter((n) => n.startsWith(token)).slice(0, 5);
  const pickMention = (name: string) => { onType(text.replace(/@[^\s@]*$/, `@${name} `)); input.current?.focus(); };
  const pickAt = Math.min(mentionAt, Math.max(0, suggestions.length - 1));

  const waitSec = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
  const composer = meta.canPost ? (
    <form className="bgv-composer" onSubmit={submit}>
      {(replyTo || editing) && (
        <div className="bgv-composer__reply">
          <Icon name={editing ? 'pencil' : 'reply'} size="sm" />
          <span>{editing ? 'ویرایش پیام' : <>پاسخ به <b><bdi>{replyTo!.sender.displayName}</bdi></b>: {replyTo!.body.slice(0, 60)}</>}</span>
          <Button variant="ghost" size="sm" iconOnly icon="x" onClick={cancelCompose}>لغو</Button>
        </div>
      )}
      {quick && <QuickChatChips post={post} />}
      {suggestions.length > 0 && (() => {
        const item = (name: string) => ({ name, initials: name.charAt(0), focus: suggestions.indexOf(name) === pickAt });
        // Table chat: players first, then the spectators who have written here.
        if (!people) return <MentionSuggest items={suggestions.map(item)} onPick={pickMention} />;
        const seated = suggestions.filter((n) => people.includes(n));
        const watching = suggestions.filter((n) => !people.includes(n));
        return <MentionSuggest onPick={pickMention} groups={[
          ...(seated.length ? [{ title: 'بازیکن‌های این میز', items: seated.map(item) }] : []),
          ...(watching.length ? [{ title: 'تماشاگرها', items: watching.map(item) }] : [])
        ]} />;
      })()}
      {typing.length > 0 && <Typing names={typing.map((t) => t.name)} />}
      <div className="bgv-composer__row">
        <label className="bgv-sr" htmlFor={composeId}>متن پیام</label>
        <textarea id={composeId} ref={input} className="bgv-composer__input" rows={1} maxLength={1000} value={text} onChange={(e) => onType(e.target.value)}
          placeholder={meta.kind === 'table' ? 'پیام به میز…' : 'پیام…'} onKeyDown={(e) => {
            if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault(); setMentionAt((pickAt + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); return;
            }
            if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) { e.preventDefault(); pickMention(suggestions[pickAt]!); setMentionAt(0); return; }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
            if (e.key === 'Escape' && (replyTo || editing)) { e.preventDefault(); e.stopPropagation(); cancelCompose(); }
          }} />
        <Button type="submit" variant="primary" iconOnly icon={<Icon name="send" mirror />} disabled={!text.trim() || (!editing && waitSec > 0)}>{editing ? 'ذخیره' : 'ارسال'}</Button>
      </div>
      {waitSec > 0 && <p className="t-caption bgv-muted" role="status" style={{ margin: 0 }}>حالت آهسته: پیام بعدی تا {faNum(waitSec)} ثانیه‌ی دیگر</p>}
    </form>
  ) : (
    <div className="bgv-composer">
      {quick && <QuickChatChips post={post} />}
      <p className="t-caption bgv-muted" role="status" style={{ margin: 0 }}>نوشتن پیام برای حساب شما موقتاً محدود است{quick ? '؛ پیام‌های آماده در دسترس‌اند' : ''}.</p>
    </div>
  );

  const editLeft = (at: string) => {
    const sec = Math.max(0, Math.round((EDIT_MS - (now - new Date(at).getTime())) / 1000));
    return `${faNum(Math.floor(sec / 60))}:${faNum(sec % 60).padStart(2, '۰')}`;
  };
  const kick = async (m: MessageItem) => {
    try { await api(`/clubs/${clubSlug}/members/${m.sender.id}`, { method: 'DELETE' }); toast('success', `${m.sender.displayName} از باشگاه اخراج شد.`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  const muteSender = async (m: MessageItem) => {
    try { await api('/mutes', { method: 'POST', body: { userId: m.sender.id } }); toast('success', `پیام‌های ${m.sender.displayName} دیگر برای شما نمایش داده نمی‌شود.`); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  // Messages from others after my read point when the panel opened (fixed for this visit).
  const fresh = meta.myReadUpTo ? items.filter((m) => m.sender.id !== me?.id && m.createdAt > meta.myReadUpTo!) : [];
  const firstUnread = fresh[0]?.id;
  const unreadCount = fresh.length;
  const body = (
    <>
      <div ref={list} hidden />
      {meta.nextBefore && <Button variant="ghost" size="sm" icon="history" onClick={() => fetchPage(items[0]?.createdAt)}>پیام‌های قدیمی‌تر</Button>}
      {items.length === 0 && pending.length === 0 && <p className="t-caption bgv-muted chat-empty">هنوز پیامی نیست. اولین پیام را بفرستید.</p>}
      {events?.filter((e) => !items.length || e.at < items[0]!.createdAt).map((e) => <SystemMessage key={e.id} game text={e.text} {...(e.seat !== undefined ? { seat: ((e.seat % 10) + 1) as SeatNo } : {})} />)}
      {items.map((m, idx) => {
        const mine = m.sender.id === me?.id;
        const divider = m.id === firstUnread ? <UnreadDivider count={unreadCount} /> : null;
        const im = INVITE_RE.exec(m.body);
        const invite = im ? { game: im[1]!, tableId: im[2]! } : null;
        const seen = meta.kind === 'direct' && mine && !!meta.readUpTo && meta.readUpTo >= m.createdAt;
        const actions: MenuItem[] = m.deleted ? [] : [
          ...(meta.canPost ? [{ icon: 'reply', label: 'پاسخ', onClick: () => { setEditing(null); setReplyTo(m); input.current?.focus(); } }] : []),
          ...(mine && meta.canPost && now - new Date(m.createdAt).getTime() < EDIT_MS ? [{ icon: 'pencil', label: `ویرایش (${editLeft(m.createdAt)} مانده)`, onClick: () => { setReplyTo(null); setEditing(m); onType(m.body); input.current?.focus(); } }] : []),
          { icon: 'copy', label: 'کپی', onClick: () => void navigator.clipboard.writeText(m.body).then(() => toast('success', 'متن پیام کپی شد.'), () => toast('error', 'کپی ممکن نشد.')) },
          { icon: 'smile', label: 'واکنش', onClick: () => setReacting(m.id) },
          ...(!mine ? [{ icon: 'bell-off', label: `بی‌صدا کردن ${m.sender.displayName}`, onClick: () => void muteSender(m) }] : []),
          ...(!mine && meta.canModerate && meta.kind === 'club' && clubSlug ? [{ icon: 'user-minus', label: `اخراج ${m.sender.displayName} از باشگاه`, danger: true, onClick: () => void kick(m) }] : []),
          ...(!mine ? [{ icon: 'flag', label: 'گزارش', danger: true, onClick: () => setReporting(m) }] : []),
          ...(mine || meta.canModerate ? [{ icon: 'trash-2', label: 'حذف', danger: true, onClick: () => void remove(m) }] : [])
        ];
        return (
          <Fragment key={m.id}>{divider}
          <article className={`${mine ? 'chat-msg chat-msg--mine' : 'chat-msg'}${lifted === m.id ? ' is-lifted' : ''}`}
            onPointerDown={() => { if (m.deleted) return; press.current = window.setTimeout(() => { setLifted(m.id); setReacting(m.id); }, 450); }}
            onPointerUp={() => clearTimeout(press.current)} onPointerLeave={() => clearTimeout(press.current)}
            onContextMenu={(e) => { if (lifted === m.id) e.preventDefault(); }}>
            {invite && !m.deleted ? (
              <div className={`bgv-invitecard chat-invite${mine ? ' chat-invite--mine' : ''}`}>
                <div className="bgv-row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                  <span className="ac-tile"><Icon name="armchair" /></span>
                  <span style={{ display: 'grid', lineHeight: 1.45 }}><b>دعوت به میز {invite.game}</b>
                    <span className="t-caption bgv-muted"><bdi>{m.sender.displayName}</bdi><span className="bgv-sep" /><time dateTime={m.createdAt}>{time.format(new Date(m.createdAt))}</time></span></span>
                </div>
                {!mine && !declined.includes(m.id) && <div className="bgv-row" style={{ gap: 8 }}>
                  <Button variant="primary" size="sm" href={`/tables/${invite.tableId}`} style={{ flex: 1 }}>بنشین</Button>
                  <Button variant="secondary" size="sm" onClick={() => setDeclined((d) => [...d, m.id])}>رد</Button>
                </div>}
                {!mine && declined.includes(m.id) && <span className="t-caption bgv-muted">رد کردید.</span>}
              </div>
            ) : <Message mine={mine} author={<bdi>{m.sender.displayName}</bdi>} text={m.body} viewer={me?.displayName}
              time={<time dateTime={m.createdAt}>{time.format(new Date(m.createdAt))}</time>}
              avatar={{ children: <AvatarArt avatarKey={m.sender.avatarKey} />, name: m.sender.displayName }} initials={m.sender.displayName.charAt(0)}
              state={m.deleted ? 'deleted' : 'sent'} reactions={m.reactions} onReact={(emoji) => void react(m, emoji)}
              mentioned={!!me && m.mentions.includes(me.id)} edited={!!m.editedAt} seen={seen} {...(m.deleted ? {} : reply(m.replyTo))} />}
            <MessageMenu items={actions} open={lifted === m.id} onClosed={unlift} />
            {reacting === m.id && <ReactionBar onPick={(emoji) => void react(m, emoji)} selected={m.reactions.find((r) => r.mine)?.emoji} />}
          </article>
          {events?.filter((e) => e.at >= m.createdAt && (idx === items.length - 1 || e.at < items[idx + 1]!.createdAt)).map((e) =>
            <SystemMessage key={e.id} game text={e.text} {...(e.seat !== undefined ? { seat: ((e.seat % 10) + 1) as SeatNo } : {})} />)}
          </Fragment>
        );
      })}
      {pending.map((p) => (
        <article key={p.clientId} className="chat-msg chat-msg--mine">
          <Message mine text={p.body} state={p.failed ? 'failed' : 'pending'} onRetry={() => void deliver(p)}
            {...(p.replyTo ? { reply: { author: <bdi>{p.replyTo.sender.displayName}</bdi>, text: p.replyTo.body } } : {})} />
          {p.failed && <MessageMenu items={[{ icon: 'trash-2', label: 'حذف', danger: true, onClick: () => setPending((old) => old.filter((x) => x.clientId !== p.clientId)) }]} />}
        </article>
      ))}
    </>
  );

  return (
    <>
      {frame(body, composer, slow)}
      {reporting && <ReportDialog targetType="message" targetId={reporting.id} label={`پیام ${reporting.sender.displayName}`}
        quote={{ author: reporting.sender.displayName, text: reporting.body }} mute={{ userId: reporting.sender.id, name: reporting.sender.displayName }} onClose={() => setReporting(null)} />}
    </>
  );
}
