import { useEffect, useRef } from 'react';
import { ServerEvents, turnThresholds, type AlertPrefs, type TurnAutoMovedEvent, type TurnStartedEvent } from '@bg/contracts';
import { getAlertPrefs, loadAlertPrefs, readPrefs } from './prefs.tsx';
import { useRealtime } from './realtime.tsx';

type Kind = 'turn' | 'warning' | 'critical' | 'timeout' | 'tick';
type Tone = AlertPrefs['warningSound'] | 'tick';
// [frequency Hz, start s, length s] steps per tone, synthesized with WebAudio (no audio files).
const TONES: Record<Tone, [number, number, number][]> = {
  chime: [[880, 0, 0.14], [1319, 0.16, 0.22]],
  bell: [[660, 0, 0.5]],
  pulse: [[990, 0, 0.1], [990, 0.18, 0.1], [990, 0.36, 0.1]],
  soft: [[523, 0, 0.3]],
  tick: [[1200, 0, 0.05]]
};
const VIBRATE: Record<Kind, number[]> = { turn: [80], warning: [], critical: [200, 100, 200, 100, 200], timeout: [400], tick: [] };

/** Quiet hours are Tehran time (UTC+3:30, no DST). A window like 23-07 wraps midnight. */
export function inQuietHours(q: AlertPrefs['quietHours'], now = new Date()): boolean {
  if (!q.enabled || q.startHour === q.endHour) return false;
  const h = new Date(now.getTime() + 3.5 * 3600_000).getUTCHours();
  return q.startHour < q.endHour ? h >= q.startHour && h < q.endHour : h >= q.startHour || h < q.endHour;
}

let audio: AudioContext | undefined;
function beep(tone: Tone, volume: number): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const now = audio.currentTime;
    for (const [freq, at, len] of TONES[tone]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, (volume / 100) * 0.4), now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at); osc.stop(now + at + len + 0.05);
    }
  } catch { /* audio unavailable or blocked until a user gesture */ }
}

/** Play one alert honoring account prefs, quiet hours and the device «بی‌صدا» switch. */
export function playAlert(kind: Kind, prefs: AlertPrefs = getAlertPrefs()): void {
  // The half-time warning is visual only (the clock turns amber); design: «بدون صدا».
  if (kind === 'warning' || inQuietHours(prefs.quietHours)) return;
  if (kind === 'tick' && !prefs.criticalTick) return;
  let deviceMuted = false;
  try { deviceMuted = readPrefs(localStorage.getItem('bg.prefs')).muted; } catch { /* storage unavailable */ }
  const audible = prefs.sound && !deviceMuted && prefs.volume > 0 && (kind !== 'turn' || prefs.turnSound);
  if (audible) beep(kind === 'critical' || kind === 'timeout' ? prefs.criticalSound : kind === 'tick' ? 'tick' : 'soft', prefs.volume);
  if (prefs.vibration && VIBRATE[kind].length && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATE[kind]);
}

/**
 * Turn alerts for one table. `turn.started` (it is my seat) → soft tone and local timers for warning (50% left) and
 * critical (last 10 s live / last hour turn-based) computed from dueAt; `turn.autoMoved` for my seat → timeout alert.
 * Call from the table page: `useTurnAlerts(table.id, table.mySeat)`.
 */
export function useTurnAlerts(tableId: string, mySeat: number | null): void {
  const { socket } = useRealtime();
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!socket || mySeat === null) return;
    void loadAlertPrefs();
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const onStarted = (e: TurnStartedEvent) => {
      clear();
      if (e.tableId !== tableId || !e.seats.includes(mySeat)) return;
      playAlert('turn');
      const { warningLeft, criticalLeft } = turnThresholds(e.pace, e.turnSeconds);
      // Server time offset keeps timers right when the device clock is off.
      const due = Date.parse(e.dueAt) - (Date.parse(e.serverTime) - Date.now());
      for (const [kind, left] of [['warning', warningLeft], ['critical', criticalLeft]] as const) {
        const wait = due - left * 1000 - Date.now();
        // Skip a threshold already passed, and a warning that would come at or after the critical one.
        if (wait > 0 && !(kind === 'warning' && criticalLeft >= warningLeft)) timers.current.push(window.setTimeout(() => playAlert(kind), wait));
      }
      // Live games: a short tick each second through the last 10 s (after the critical tone).
      if (e.pace === 'live') {
        for (let left = criticalLeft - 1; left >= 1; left--) {
          const wait = due - left * 1000 - Date.now();
          if (wait > 0) timers.current.push(window.setTimeout(() => playAlert('tick'), wait));
        }
      }
    };
    const onAuto = (e: TurnAutoMovedEvent) => { if (e.tableId === tableId && e.seats.includes(mySeat)) { clear(); playAlert('timeout'); } };
    socket.on(ServerEvents.turnStarted, onStarted);
    socket.on(ServerEvents.turnAutoMoved, onAuto);
    return () => { socket.off(ServerEvents.turnStarted, onStarted); socket.off(ServerEvents.turnAutoMoved, onAuto); clear(); };
  }, [socket, tableId, mySeat]);
}
