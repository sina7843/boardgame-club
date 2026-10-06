// Per-game play settings: the reviewed module declares what is POSSIBLE (manifest), the admin chooses what is
// OFFERED (games row + play_settings), and every table stores what was CHOSEN at creation/start. Stored choices
// are always clamped to the module, so a new rules version that drops a capability can never be requested.
import { AppError, TIME_OPTIONS, type AdminGameSettingsBody, type GameOptionView } from '@bg/contracts';
import type { schema } from '@bg/db';
import type { GameManifest, OptionValue } from '@bg/game-sdk';

type GameRow = typeof schema.games.$inferSelect;
type Pace = 'live' | 'turn';

export interface EffectiveOption extends GameOptionView { allowed: OptionValue[] }
export interface EffectiveSettings {
  paces: Pace[];
  competitions: ('friendly' | 'ranked')[];
  minPlayers: number;
  maxPlayers: number;
  liveSeconds: number[];
  turnSeconds: number[];
  options: EffectiveOption[];
}

const keep = <T>(chosen: readonly T[] | undefined, supported: readonly T[]): T[] => {
  const v = (chosen ?? supported).filter((x) => supported.includes(x));
  return v.length ? v : [...supported];
};

/** What this game offers now. `manifest` is the active version's (null → no variants, columns as stored). */
export function effectiveSettings(game: GameRow, manifest: GameManifest | null): EffectiveSettings {
  const s = game.playSettings ?? {};
  const bounds = manifest ?? { supportedModes: { pace: game.paces, competition: game.competitions }, playerCounts: { min: game.minPlayers, max: game.maxPlayers }, options: [] };
  let minPlayers = Math.max(game.minPlayers, bounds.playerCounts.min);
  let maxPlayers = Math.min(game.maxPlayers, bounds.playerCounts.max);
  if (minPlayers > maxPlayers) [minPlayers, maxPlayers] = [bounds.playerCounts.min, bounds.playerCounts.max];
  return {
    paces: keep(game.paces as Pace[], bounds.supportedModes.pace),
    competitions: keep(game.competitions as ('friendly' | 'ranked')[], bounds.supportedModes.competition),
    minPlayers, maxPlayers,
    liveSeconds: keep(s.liveSeconds, TIME_OPTIONS.live),
    turnSeconds: keep(s.turnSeconds, TIME_OPTIONS.turn),
    options: bounds.options.map((o) => {
      const stored = s.options?.[o.key];
      const values = o.choices.map((c) => c.value);
      const allowed = keep(stored?.allowed, values);
      const def = stored && allowed.includes(stored.default) ? stored.default : allowed.includes(o.default) ? o.default : allowed[0]!;
      return {
        key: o.key, labelFa: o.labelFa, descriptionFa: o.descriptionFa ?? null,
        choices: o.choices.filter((c) => allowed.includes(c.value)), allowed, default: def, hostChooses: stored?.hostChooses ?? true
      };
    })
  };
}

export function assertTimeAllowed(eff: EffectiveSettings, pace: Pace, seconds: number): void {
  if (!(pace === 'live' ? eff.liveSeconds : eff.turnSeconds).includes(seconds)) throw new AppError('INVALID_TIME_SETTING');
}

/** Validate the host's variant choices; unspecified keys get the default. Fixed options must keep the default. */
export function resolveOptions(eff: EffectiveSettings, requested: Record<string, OptionValue> = {}): Record<string, OptionValue> {
  for (const key of Object.keys(requested)) if (!eff.options.some((o) => o.key === key)) throw new AppError('OPTION_NOT_ALLOWED');
  return Object.fromEntries(eff.options.map((o) => {
    const v = requested[o.key];
    if (v === undefined) return [o.key, o.default];
    if (!o.allowed.includes(v) || (!o.hostChooses && v !== o.default)) throw new AppError('OPTION_NOT_ALLOWED');
    return [o.key, v];
  }));
}

/** Validate an admin change against the module's bounds and return the column values to store. */
export function validateAdminSettings(body: AdminGameSettingsBody, manifest: GameManifest) {
  const subset = <T>(xs: readonly T[], of: readonly T[]) => xs.length > 0 && xs.every((x) => of.includes(x));
  const ok = subset(body.paces, manifest.supportedModes.pace) && subset(body.competitions, manifest.supportedModes.competition)
    && body.minPlayers >= manifest.playerCounts.min && body.maxPlayers <= manifest.playerCounts.max && body.minPlayers <= body.maxPlayers
    && subset(body.liveSeconds, TIME_OPTIONS.live) && subset(body.turnSeconds, TIME_OPTIONS.turn)
    && Object.keys(body.options).every((k) => manifest.options.some((o) => o.key === k))
    && manifest.options.every((o) => {
      const st = body.options[o.key];
      if (!st) return true; // untouched variant keeps module defaults
      const values = o.choices.map((c) => c.value);
      return subset(st.allowed, values) && st.allowed.includes(st.default);
    });
  if (!ok) throw new AppError('GAME_SETTINGS_INVALID');
  const unique = <T>(xs: T[]) => [...new Set(xs)];
  return {
    paces: unique(body.paces), competitions: unique(body.competitions), minPlayers: body.minPlayers, maxPlayers: body.maxPlayers,
    playSettings: {
      liveSeconds: unique(body.liveSeconds).sort((a, b) => a - b),
      turnSeconds: unique(body.turnSeconds).sort((a, b) => a - b),
      options: Object.fromEntries(Object.entries(body.options).map(([k, v]) => [k, { allowed: unique(v.allowed), default: v.default, hostChooses: v.hostChooses }]))
    }
  };
}
