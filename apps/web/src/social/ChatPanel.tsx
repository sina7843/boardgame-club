import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ClientEvents, MESSAGE_EDIT_WINDOW_SECONDS, SLOW_MODE_OPTIONS, type MessageItem, type ReadEvent, type TypingEvent } from '@bg/contracts';
import { Avatar, Button, cn, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useRealtime } from '../lib/realtime.tsx';
import { useSession } from '../lib/session.tsx';
import { QuickChatChips } from './QuickChat.tsx';
import { ReportDialog } from './ReportDialog.tsx';

interface Page {
  items: MessageItem[]; nextBefore: string | null; canPost: boolean; canModerate: boolean; conversationId?: string;
  kind: 'direct' | 'table' | 'group' | 'club'; slowModeSeconds: number; readUpTo: string | null;
}
/** A message on its way (optimistic): shown at once, replaced by the server copy, or kept with a retry button. */
interface Pending { clientId: string; body: string; quick?: string; replyTo: MessageItem | null; failed: boolean }

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });
const EDIT_MS = MESSAGE_EDIT_WINDOW_SECONDS * 1000;
const SLOW_FA: Record<number, string> = { 0: 'خاموش', 10: '۱۰ ثانیه', 30: '۳۰ ثانیه', 60: '۱ دقیقه', 300: '۵ دقیقه' };

function readDraft(key: string): string { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } }
function writeDraft(key: string, text: string) { try { if (text) localStorage.setItem(key, text); else localStorage.removeItem(key); } catch { /* storage unavailable */ } }

/**
 * Conversation view used for DMs, group/club chat and table chat. Text is rendered as plain text only.
 * New messages arrive through the user's own socket room (server-side authorization), then are de-duplicated here.
 */
export function ChatPanel({ load, post, conversationId: fixedId, title, compact, quick }: {
  load: string; post: string; conversationId?: string; title?: string; compact?: boolean; quick?: boolean;
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
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typedAt = useRef(0);
  const conversationId = fixedId ?? meta?.conversationId;

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
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [items.length, pending.length]);

  const deliver = async (p: Pending) => {
    setPending((old) => old.map((x) => (x.clientId === p.clientId ? { ...x, failed: false } : x)));
    try {
      const m = await api<MessageItem>(post, { method: 'POST', body: { ...(p.quick ? { quick: p.quick } : { body: p.body }), replyToId: p.replyTo?.id, clientId: p.clientId } });
      setPending((old) => old.filter((x) => x.clientId !== p.clientId));
      setItems((old) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
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

  const remove = async (m: MessageItem) => {
    try { await api(`/messages/${m.id}`, { method: 'DELETE' }); setItems((old) => old.map((x) => (x.id === m.id ? { ...x, deleted: true, body: '' } : x))); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'حذف نشد.'); }
  };

  const setSlowMode = async (seconds: number) => {
    try { await api(`/conversations/${conversationId}/slow-mode`, { method: 'PUT', body: { seconds } }); setMeta((old) => old && { ...old, slowModeSeconds: seconds }); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'تغییر انجام نشد.'); }
  };

  if (error) return <StateBlock kind={error.status === 403 ? 'denied' : 'error'} title={error.status === 403 ? 'به این گفت‌وگو دسترسی ندارید' : 'گفت‌وگو بارگذاری نشد'}>{error.messageFa}</StateBlock>;
  if (!meta) return <StateBlock kind="loading" title="در حال بارگذاری پیام‌ها…" />;

  const now = Date.now();
  const quote = (r: MessageItem['replyTo']) => r && (
    <blockquote className="msg__quote"><bdi>{r.senderName}</bdi>: {r.deleted ? <em>پیام حذف‌شده</em> : r.body}</blockquote>
  );
  const scoped = meta.kind === 'group' || meta.kind === 'club';

  return (
    <section className={cn('chat', compact && 'chat--compact')} aria-label={title ?? 'گفت‌وگو'}>
      {scoped && (meta.canModerate || meta.slowModeSeconds > 0) && (
        <div className="chat__tools">
          {meta.canModerate ? (
            <label className="row" style={{ gap: '0.5rem' }}>حالت آهسته
              <select className="input" style={{ inlineSize: 'auto' }} value={meta.slowModeSeconds} onChange={(e) => void setSlowMode(Number(e.target.value))}>
                {SLOW_MODE_OPTIONS.map((n) => <option key={n} value={n}>{SLOW_FA[n]}</option>)}
              </select>
            </label>
          ) : <span>حالت آهسته: هر {SLOW_FA[meta.slowModeSeconds] ?? `${faNum(meta.slowModeSeconds)} ثانیه`} یک پیام</span>}
        </div>
      )}
      <div className="chat__list" ref={list} role="log" aria-live="polite" aria-relevant="additions">
        {meta.nextBefore && <Button variant="ghost" size="sm" onClick={() => fetchPage(items[0]?.createdAt)}>پیام‌های قدیمی‌تر</Button>}
        {items.length === 0 && pending.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>هنوز پیامی نیست. اولین پیام را بفرستید.</p>}
        {items.map((m) => {
          const mine = m.sender.id === me?.id;
          const seen = meta.kind === 'direct' && mine && !!meta.readUpTo && meta.readUpTo >= m.createdAt;
          return (
            <article key={m.id} className={cn('msg', mine && 'msg--mine')}>
              {!mine && <Avatar avatarKey={m.sender.avatarKey} name={m.sender.displayName} size={28} />}
              <div className="msg__bubble">
                <div className="msg__meta">
                  <bdi>{m.sender.displayName}</bdi> · <time dateTime={m.createdAt}>{time.format(new Date(m.createdAt))}</time>
                  {m.editedAt && !m.deleted && ' · ویرایش‌شده'}
                  {meta.kind === 'direct' && mine && <span className={cn('msg__ticks', seen && 'msg__ticks--seen')} aria-label={seen ? 'دیده شد' : 'ارسال شد'}> {seen ? '✓✓' : '✓'}</span>}
                </div>
                {!m.deleted && quote(m.replyTo)}
                {m.deleted ? <em className="muted">این پیام حذف شد.</em> : <p className="msg__body">{m.body}</p>}
                {!m.deleted && (
                  <div className="msg__actions">
                    {meta.canPost && <button type="button" className="linkbtn" onClick={() => { setEditing(null); setReplyTo(m); input.current?.focus(); }}>پاسخ</button>}
                    {mine && meta.canPost && now - new Date(m.createdAt).getTime() < EDIT_MS && (
                      <button type="button" className="linkbtn" onClick={() => { setReplyTo(null); setEditing(m); onType(m.body); input.current?.focus(); }}>ویرایش</button>
                    )}
                    {!mine && <button type="button" className="linkbtn" onClick={() => setReporting(m)}>گزارش</button>}
                    {(mine || meta.canModerate) && <button type="button" className="linkbtn" onClick={() => remove(m)}>حذف</button>}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {pending.map((p) => (
          <article key={p.clientId} className={cn('msg msg--mine msg--pending', p.failed && 'msg--failed')}>
            <div className="msg__bubble">
              <div className="msg__meta">{p.failed ? 'ارسال نشد' : 'در حال ارسال…'}</div>
              {quote(p.replyTo && { id: p.replyTo.id, senderName: p.replyTo.sender.displayName, body: p.replyTo.body, deleted: p.replyTo.deleted })}
              <p className="msg__body">{p.body}</p>
              {p.failed && (
                <div className="msg__actions">
                  <button type="button" className="linkbtn" onClick={() => void deliver(p)}>تلاش دوباره</button>
                  <button type="button" className="linkbtn" onClick={() => setPending((old) => old.filter((x) => x.clientId !== p.clientId))}>حذف</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="chat__bottom">
        {typing.length > 0 && <p className="chat__typing" role="status"><bdi>{typing.map((t) => t.name).join('، ')}</bdi> در حال نوشتن…</p>}
        {quick && <QuickChatChips post={post} />}
        {meta.canPost ? (
          <>
            {(replyTo || editing) && (
              <div className="chat__context">
                <span>{editing ? 'ویرایش پیام' : <>پاسخ به <bdi>{replyTo!.sender.displayName}</bdi>: {replyTo!.body.slice(0, 60)}</>}</span>
                <button type="button" className="linkbtn" onClick={cancelCompose}>لغو</button>
              </div>
            )}
            <form className="chat__composer" onSubmit={submit}>
              <label className="visually-hidden" htmlFor={`compose-${conversationId ?? load}`}>متن پیام</label>
              <textarea id={`compose-${conversationId ?? load}`} ref={input} className="input" rows={2} maxLength={1000} value={text} onChange={(e) => onType(e.target.value)}
                placeholder="پیام…" onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(e); }
                  if (e.key === 'Escape' && (replyTo || editing)) { e.preventDefault(); e.stopPropagation(); cancelCompose(); }
                }} />
              <Button type="submit" disabled={!text.trim()}>{editing ? 'ذخیره' : 'ارسال'}</Button>
            </form>
          </>
        ) : <p className="banner banner--warn" role="status" style={{ margin: 0 }}>نوشتن پیام برای حساب شما موقتاً محدود است{quick ? '؛ پیام‌های آماده در دسترس‌اند' : ''}.</p>}
      </div>
      {reporting && <ReportDialog targetType="message" targetId={reporting.id} label={`پیام ${reporting.sender.displayName}`} onClose={() => setReporting(null)} />}
    </section>
  );
}
