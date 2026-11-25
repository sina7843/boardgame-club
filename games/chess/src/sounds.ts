// Chess sounds (livefix spec section B). Twelve synthesized files (design/games/chess/sounds/chesslike), played through
// preloaded HTMLAudioElements. Browser only: the server never imports this file.
// One sound per move, by priority: move-check > promote > castle > capture > move-self / move-opponent.
const URLS = import.meta.glob('./sounds/*.mp3', { eager: true, query: '?url', import: 'default' });

export const SOUND_NAMES = ['move-self', 'move-opponent', 'capture', 'castle', 'move-check', 'promote', 'game-start', 'game-end', 'low-time', 'illegal', 'premove', 'notify'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

const PREFS_KEY = 'bg.chess';
const SITE_PREFS_KEY = 'bg.prefs';
export const DEFAULT_VOLUME = 70;

const pool = new Map<SoundName, HTMLAudioElement>();
let unlocked = false;

/** 0..1: the table's volume slider (default 70 %), 0 when the site mute switch is on. */
export function soundLevel(): number {
  try {
    if ((JSON.parse(localStorage.getItem(SITE_PREFS_KEY) ?? '{}') as { muted?: boolean }).muted === true) return 0;
    const v = (JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { volume?: number }).volume;
    return Math.min(100, Math.max(0, typeof v === 'number' ? v : DEFAULT_VOLUME)) / 100;
  } catch { return DEFAULT_VOLUME / 100; }
}

function el(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  let a = pool.get(name);
  if (!a) {
    const src = URLS[`./sounds/${name}.mp3`];
    if (!src) return null;
    a = new Audio(src);
    a.preload = 'auto';
    a.dataset.sound = name; // lets tests see which sound played
    pool.set(name, a);
  }
  return a;
}

/** Load every file now (table start) and unlock audio on the first touch (iOS only plays after a user gesture). */
export function preloadSounds(): void {
  for (const n of SOUND_NAMES) el(n)?.load();
  if (unlocked || typeof window === 'undefined') return;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    for (const n of SOUND_NAMES) {
      const a = el(n);
      if (!a) continue;
      // A silent start/stop inside the gesture marks the element as user-approved.
      const v = a.volume; a.volume = 0;
      void a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = v; }, () => { a.volume = v; });
    }
    for (const t of ['pointerdown', 'touchend', 'keydown'] as const) window.removeEventListener(t, unlock, true);
  };
  for (const t of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(t, unlock, { capture: true, passive: true });
}

/** Play one sound (from the start; cuts itself off if it is still playing). */
export function playChessSound(name: SoundName): void {
  const level = soundLevel();
  const a = el(name);
  if (!a || level === 0) return;
  try { a.pause(); a.currentTime = 0; } catch { /* not loaded yet */ }
  a.volume = level;
  void a.play().catch(() => { /* autoplay blocked before the first touch */ });
}

/** The sound of a move from its SAN (+ check, # mate, = promotion, O-O castling, x capture) and who made it. */
export function moveSound(san: string, mine: boolean): SoundName {
  if (/[+#]/.test(san)) return 'move-check';
  if (san.includes('=')) return 'promote';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return mine ? 'move-self' : 'move-opponent';
}
