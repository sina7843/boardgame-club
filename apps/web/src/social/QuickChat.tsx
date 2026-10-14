import { useId, useState } from 'react';
import { QUICK_CHAT } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';

/** One-tap preset phrases and emoji (DS quick-chat tray). The server stores the fixed text; the message arrives back over the socket. */
export function QuickChatChips({ post, only, onSent }: { post: string; only?: readonly string[]; onSent?: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const send = async (quick: string) => {
    setBusy(true);
    try {
      await api(post, { method: 'POST', body: { quick, clientId: crypto.randomUUID() } });
      onSent?.();
    } catch (err) {
      toast('error', err instanceof ApiFailure ? err.messageFa : 'پیام ارسال نشد.');
    } finally { setBusy(false); }
  };
  return (
    <div className="bgv-quicktray quickchat" role="group" aria-label="پیام‌های آماده">
      {QUICK_CHAT.filter((q) => !only || only.includes(q.id)).map((q) => (
        <button key={q.id} type="button" className="bgv-chip" disabled={busy} onClick={() => void send(q.id)}>{q.text}</button>
      ))}
    </div>
  );
}

/** Game-bar button: the presets open in a native popover over the board, so nothing has to be typed mid-game. */
export function QuickChatButton({ post }: { post: string }) {
  const id = useId();
  const close = () => (document.getElementById(id) as HTMLElement & { hidePopover?: () => void } | null)?.hidePopover?.();
  return (
    <>
      <Button variant="ghost" iconOnly icon="smile" popoverTarget={id}>پیام آماده</Button>
      <div id={id} popover="auto" className="chat-pop chat-pop--quick" aria-label="پیام‌های آماده">
        <QuickChatChips post={post} onSent={close} />
      </div>
    </>
  );
}
