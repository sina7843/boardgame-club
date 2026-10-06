import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ClientEvents, ServerEvents, type NotificationItem, type TableSnapshot } from '@bg/contracts';
import { useToast } from '@bg/ui';
import { useSession } from './session.tsx';

interface RealtimeValue { socket: Socket | null; connected: boolean }
const Ctx = createContext<RealtimeValue>({ socket: null, connected: false });

/** One Socket.IO connection per signed-in tab. Delivery is at-most-once, so every screen also re-syncs over HTTP. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { me } = useSession();
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!me) return;
    const s = io({ path: '/api/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on(ServerEvents.notificationCreated, (n: NotificationItem) => {
      // Never interrupt the page the notification is about (e.g. a live table) with a toast.
      if (!location.pathname.startsWith(n.href)) toast('info', n.textFa);
      // Optional browser notification: only if the user enabled it in settings and granted permission.
      if (document.hidden && browserNotificationsEnabled()) {
        try { new Notification('باشگاه بردگیم', { body: n.textFa, tag: n.id, lang: 'fa', dir: 'rtl' }); } catch { /* unsupported */ }
      }
      window.dispatchEvent(new CustomEvent('bg:notification', { detail: n }));
    });
    s.on(ServerEvents.messageCreated, (m: unknown) => window.dispatchEvent(new CustomEvent('bg:message', { detail: m })));
    setSocket(s);
    return () => { s.close(); setSocket(null); setConnected(false); };
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRealtime = () => useContext(Ctx);

const BROWSER_KEY = 'bg.browserNotifications';
export function browserNotificationsEnabled(): boolean {
  try { return typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem(BROWSER_KEY) === '1'; } catch { return false; }
}
/** Must be called from a user gesture (button click); never prompts on its own. */
export async function setBrowserNotifications(on: boolean): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (on && Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false;
  try { localStorage.setItem(BROWSER_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  return on;
}

/** Subscribe to pushed snapshots of one table; re-subscribes (and re-syncs) after every reconnect. */
export function useTableFeed(tableId: string, invite: string | null, onSnapshot: (s: TableSnapshot) => void) {
  const { socket, connected } = useRealtime();
  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit(ClientEvents.tableSubscribe, invite ? { tableId, inviteCode: invite } : { tableId }, (ack: { ok: boolean; snapshot?: TableSnapshot }) => {
      if (ack?.ok && ack.snapshot) onSnapshot(ack.snapshot);
    });
    const handler = (s: TableSnapshot) => { if (s.table.id === tableId) onSnapshot(s); };
    socket.on(ServerEvents.tableSnapshot, handler);
    return () => {
      socket.off(ServerEvents.tableSnapshot, handler);
      socket.emit('table.unsubscribe', { tableId });
    };
  }, [socket, connected, tableId, invite, onSnapshot]);
  return connected;
}
