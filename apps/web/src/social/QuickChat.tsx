import { useId, useState } from 'react';
import { cosmetic, QUICK_CHAT } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Button, QuickChat } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { ItemArt } from '../lib/cosmeticItems.tsx';

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
  const shown = QUICK_CHAT.filter((q) => !only || only.includes(q.id));
  // ponytail: no busy lock on the DS tray; the server's clientId/rate limit absorbs a double tap.
  return <QuickChat className="quickchat" label="پیام‌های آماده" items={shown.map((q) => q.text)}
    onPick={(t) => { const q = shown.find((x) => x.text === t); if (q && !busy) void send(q.id); }} />;
}

/** Game-bar button: the presets open in a native popover over the board, so nothing has to be typed mid-game. */
export function QuickChatButton({ post, only }: { post: string; only?: readonly string[] }) {
  const id = useId();
  const toast = useToast();
  const mine = useApi<{ loadout: { emotes: string[] } }>('/me/cosmetics');
  const close = () => (document.getElementById(id) as HTMLElement & { hidePopover?: () => void } | null)?.hidePopover?.();
  const emotes = (mine.data?.loadout?.emotes ?? []).map((k) => cosmetic(k)).filter((c) => !!c);
  const sendEmote = async (key: string) => {
    try { await api(post, { method: 'POST', body: { emote: key, clientId: crypto.randomUUID() } }); close(); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'ایموت فرستاده نشد.'); }
  };
  return (
    <>
      <Button variant="ghost" iconOnly icon="smile" popoverTarget={id}>پیام آماده</Button>
      <div id={id} popover="auto" className="chat-pop chat-pop--quick" aria-label="پیام‌های آماده">
        {emotes.length > 0 && <div className="chat-emotes" role="group" aria-label="ایموت‌های من">
          {emotes.map((c) => <button key={c.key} type="button" className="chat-emotebtn" aria-label={`ایموت ${c.nameFa}`} onClick={() => void sendEmote(c.key)}><ItemArt item={c} me={{ avatarKey: 'meeple' }} /></button>)}
        </div>}
        <QuickChatChips post={post} onSent={close} {...(only ? { only } : {})} />
      </div>
    </>
  );
}
