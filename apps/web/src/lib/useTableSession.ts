import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_ERRORS_FA, type CommandResult, type TableSnapshot } from '@bg/contracts';
import type { GameAction } from '@bg/ui';
import { api, ApiFailure } from './api.ts';
import { useTableFeed } from './realtime.tsx';

export interface PendingCommand {
  commandId: string;
  expectedRevision: number;
  action: GameAction;
  /** sending = request in flight; unknown = no response (network) → «در انتظار تأیید» until the receipt is found. */
  status: 'sending' | 'unknown';
}

/**
 * Client side of the command protocol (docs/ENGINE_PROTOCOL.md):
 * - one command in flight; renderers are told `busy`;
 * - lost responses are resolved through the receipt endpoint, never by guessing;
 * - STALE_REVISION shows the fresh state and is NOT resubmitted automatically;
 * - the only resend is the user's explicit "send again" with the SAME commandId (idempotent).
 */
export function useTableSession(tableId: string, invite: string | null) {
  const [snapshot, setSnapshot] = useState<TableSnapshot>();
  const [loadError, setLoadError] = useState<ApiFailure>();
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const latest = useRef(0);

  const accept = useCallback((s: TableSnapshot) => {
    const rev = s.game?.revision ?? 0;
    // Pushes can arrive out of order; never go back in time (lobby-only changes keep revision 0).
    if (rev < latest.current) return;
    latest.current = rev;
    setClockOffset(new Date(s.serverTime).getTime() - Date.now());
    setSnapshot(s);
  }, []);

  const reload = useCallback(async () => {
    try {
      accept(await api<TableSnapshot>(`/tables/${tableId}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`));
      setLoadError(undefined);
    } catch (e) {
      if (e instanceof ApiFailure) setLoadError(e);
    }
  }, [tableId, invite, accept]);

  useEffect(() => { latest.current = 0; void reload(); }, [reload]);
  const live = useTableFeed(tableId, invite, accept);

  const send = useCallback(async (cmd: PendingCommand) => {
    setPending({ ...cmd, status: 'sending' });
    setNotice(null);
    try {
      const r = await api<CommandResult>(`/tables/${tableId}/commands`, { method: 'POST', body: { commandId: cmd.commandId, expectedRevision: cmd.expectedRevision, action: cmd.action } });
      accept(r.snapshot);
      setPending(null);
      if (r.status === 'rejected') setNotice(GAME_ERRORS_FA[r.errorCode ?? ''] ?? 'حرکت پذیرفته نشد.');
    } catch (e) {
      if (e instanceof ApiFailure && e.status !== 0) {
        setPending(null);
        setNotice(e.messageFa);
      } else {
        setPending({ ...cmd, status: 'unknown' });
      }
    }
  }, [tableId, accept]);

  // Undo window: a move waits UNDO_MS before it is sent, so renderers act on a single tap without a confirm step.
  const [queued, setQueued] = useState<{ cmd: PendingCommand; ms: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** `now` skips the undo window (the action was already confirmed elsewhere, e.g. the resign dialog). */
  const act = useCallback((action: GameAction, now = false) => {
    if (pending || queued || !snapshot?.game) return;
    const cmd: PendingCommand = { commandId: crypto.randomUUID(), expectedRevision: snapshot.game.revision, action, status: 'sending' };
    const ms = now ? 0 : undoMs();
    if (ms <= 0) { void send(cmd); return; }
    setQueued({ cmd, ms });
    timer.current = setTimeout(() => { setQueued(null); void send(cmd); }, ms);
  }, [pending, queued, snapshot, send]);
  const cancelQueued = useCallback(() => { clearTimeout(timer.current); setQueued(null); }, []);

  // Unconfirmed command: poll the receipt until the server tells us what happened.
  useEffect(() => {
    if (pending?.status !== 'unknown') return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ found: boolean; status?: string; errorCode?: string | null }>(`/tables/${tableId}/commands/${pending.commandId}`);
        if (r.found) {
          setPending(null);
          if (r.status === 'rejected') setNotice(GAME_ERRORS_FA[r.errorCode ?? ''] ?? 'حرکت پذیرفته نشد.');
          void reload();
        }
      } catch { /* still offline; keep waiting */ }
    }, 2500);
    return () => clearInterval(t);
  }, [pending, tableId, reload]);

  const resendPending = useCallback(() => { if (pending) void send(pending); }, [pending, send]);
  const dropPending = useCallback(() => { setPending(null); void reload(); }, [reload]);

  return { snapshot, accept, loadError, reload, pending, queued, cancelQueued, notice, setNotice, act, resendPending, dropPending, live, clockOffset };
}

/** Undo window in ms (default 2 s). `bg.undoMs` in localStorage overrides it; E2E runs set 0. */
function undoMs(): number {
  try { const v = Number(localStorage.getItem('bg.undoMs') ?? NaN); return Number.isFinite(v) ? v : 2000; } catch { return 2000; }
}
