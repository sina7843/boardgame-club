import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { MessageItem } from '@bg/contracts';
import { Avatar, Button, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { ReportDialog } from './ReportDialog.tsx';

interface Page { items: MessageItem[]; nextBefore: string | null; canPost: boolean; canModerate: boolean; conversationId?: string }

const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });

/**
 * Conversation view used for DMs, group/club chat and table chat. Text is rendered as plain text only.
 * New messages arrive through the user's own socket room (server-side authorization), then are de-duplicated here.
 */
export function ChatPanel({ load, post, conversationId: fixedId, title, compact }: {
  load: string; post: string; conversationId?: string; title?: string; compact?: boolean;
}) {
  const { me } = useSession();
  const toast = useToast();
  const [items, setItems] = useState<MessageItem[]>([]);
  const [meta, setMeta] = useState<Omit<Page, 'items'>>();
  const [error, setError] = useState<ApiFailure>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<MessageItem | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const conversationId = fixedId ?? meta?.conversationId;

  const fetchPage = useCallback(async (before?: string) => {
    try {
      const p = await api<Page>(`${load}${before ? `${load.includes('?') ? '&' : '?'}before=${encodeURIComponent(before)}` : ''}`);
      setItems((old) => (before ? [...p.items, ...old] : p.items));
      setMeta({ nextBefore: p.nextBefore, canPost: p.canPost, canModerate: p.canModerate, conversationId: p.conversationId });
      setError(undefined);
    } catch (e) { if (e instanceof ApiFailure) setError(e); }
  }, [load]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);
  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<MessageItem>).detail;
      if (m.conversationId !== conversationId) return;
      setItems((old) => (old.some((x) => x.id === m.id) ? old.map((x) => (x.id === m.id ? m : x)) : [...old, m]));
    };
    window.addEventListener('bg:message', on);
    return () => window.removeEventListener('bg:message', on);
  }, [conversationId]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [items.length]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const m = await api<MessageItem>(post, { method: 'POST', body: { body: text } });
      setItems((old) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
      setText('');
    } catch (err) {
      toast('error', err instanceof ApiFailure ? err.messageFa : 'پیام ارسال نشد.');
    } finally { setBusy(false); }
  };

  const remove = async (m: MessageItem) => {
    try { await api(`/messages/${m.id}`, { method: 'DELETE' }); setItems((old) => old.map((x) => (x.id === m.id ? { ...x, deleted: true, body: '' } : x))); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'حذف نشد.'); }
  };

  if (error) return <StateBlock kind={error.status === 403 ? 'denied' : 'error'} title={error.status === 403 ? 'به این گفت‌وگو دسترسی ندارید' : 'گفت‌وگو بارگذاری نشد'}>{error.messageFa}</StateBlock>;
  if (!meta) return <StateBlock kind="loading" title="در حال بارگذاری پیام‌ها…" />;

  return (
    <section className={`chat ${compact ? 'chat--compact' : ''}`} aria-label={title ?? 'گفت‌وگو'}>
      <div className="chat__list" ref={list} role="log" aria-live="polite" aria-relevant="additions">
        {meta.nextBefore && <Button variant="ghost" size="sm" onClick={() => fetchPage(items[0]?.createdAt)}>پیام‌های قدیمی‌تر</Button>}
        {items.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>هنوز پیامی نیست. اولین پیام را بفرستید.</p>}
        {items.map((m) => {
          const mine = m.sender.id === me?.id;
          return (
            <article key={m.id} className={`msg ${mine ? 'msg--mine' : ''}`}>
              {!mine && <Avatar avatarKey={m.sender.avatarKey} name={m.sender.displayName} size={28} />}
              <div className="msg__bubble">
                <div className="msg__meta"><bdi>{m.sender.displayName}</bdi> · <time dateTime={m.createdAt}>{time.format(new Date(m.createdAt))}</time></div>
                {m.deleted ? <em className="muted">این پیام حذف شد.</em> : <p className="msg__body">{m.body}</p>}
                {!m.deleted && (
                  <div className="msg__actions">
                    {!mine && <button type="button" className="linkbtn" onClick={() => setReporting(m)}>گزارش</button>}
                    {(mine || meta.canModerate) && <button type="button" className="linkbtn" onClick={() => remove(m)}>حذف</button>}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {meta.canPost ? (
        <form className="chat__composer" onSubmit={submit}>
          <label className="visually-hidden" htmlFor={`compose-${conversationId ?? load}`}>متن پیام</label>
          <textarea id={`compose-${conversationId ?? load}`} className="input" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="پیام…" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(e); } }} />
          <Button type="submit" busy={busy} disabled={!text.trim()}>ارسال</Button>
        </form>
      ) : <p className="banner banner--warn" role="status" style={{ margin: 0 }}>ارسال پیام برای حساب شما موقتاً محدود است.</p>}
      {reporting && <ReportDialog targetType="message" targetId={reporting.id} label={`پیام ${reporting.sender.displayName}`} onClose={() => setReporting(null)} />}
    </section>
  );
}
