// Gaia Project state model and the data-driven content API (factions, tech tiles, boosters, scoring tiles,
// federation tokens). Content files under src/content/ only import from this file and ../core.ts.
// See src/content/README.md for how to declare content.
import type { Outcome } from '@bg/game-sdk';
import type { HomePlanet, MapHex, Planet, SectorPlacement } from './map.ts';

export const TRACKS = ['terra', 'nav', 'ai', 'gaia', 'eco', 'sci'] as const;
export type Track = (typeof TRACKS)[number];
export const TRACK_FA: Record<Track, string> = {
  terra: 'زمین‌سازی', nav: 'ناوبری', ai: 'هوش مصنوعی', gaia: 'پروژهٔ گایا', eco: 'اقتصاد', sci: 'دانش'
};

/** Structures on the map. `gf` = gaiaformer, `station` = Ivits space station. */
export type Building = 'mine' | 'ts' | 'lab' | 'pi' | 'ac1' | 'ac2' | 'gf' | 'station';
export const BUILDING_FA: Record<Building, string> = {
  mine: 'معدن', ts: 'ایستگاه تجاری', lab: 'آزمایشگاه پژوهشی', pi: 'مؤسسهٔ سیاره‌ای', ac1: 'آکادمی دانش', ac2: 'آکادمی QIC',
  gf: 'گایاساز', station: 'ایستگاه فضایی'
};
export const LIMIT: Record<'mine' | 'ts' | 'lab' | 'pi' | 'ac', number> = { mine: 8, ts: 4, lab: 3, pi: 1, ac: 2 };

/**
 * Resources: c credits, o ore, k knowledge, q QIC, vp victory points,
 * pw = charge power (bowl I→II→III), t = gain power tokens (into bowl I).
 * As a cost: pw = spend power from bowl III, t = remove tokens from the cycle (lowest bowl first).
 */
export type Res = 'c' | 'o' | 'k' | 'q' | 'vp' | 'pw' | 't';
export type Gain = Partial<Record<Res, number>>;
export const RES_FA: Record<Res, string> = { c: 'اعتبار', o: 'سنگ معدن', k: 'دانش', q: 'QIC', vp: 'امتیاز', pw: 'شارژ قدرت', t: 'ژتون قدرت' };

export interface HexState extends MapHex {
  owner: number | null;
  building: Building | null;
  /** Lantids: a second mine on a planet another player colonized. */
  extra: number | null;
  /** Seats with a satellite on this (empty space) hex. */
  sats: number[];
  /** Seats whose federation contains this hex (building or satellite). */
  feds: number[];
}

/** Power cycle. `brain` = Taklons' brainstone: bowl 1/2/3, 0 = gaia area, null = not in play. */
export interface Power { b1: number; b2: number; b3: number; gaia: number; brain: 1 | 2 | 3 | 0 | null }

export interface PlayerState {
  faction: string | null;
  c: number; o: number; k: number; q: number; vp: number;
  power: Power;
  research: Record<Track, number>;
  /** Gaiaformers unlocked on the Gaia Project track (0–3). */
  gf: number;
  /** Gaiaformers spent into the gaia area (Bal T'aks); they return in the next gaia phase. */
  gfGaia: number;
  booster: string | null;
  techs: { id: string; covered: boolean }[];
  feds: { id: string; green: boolean }[];
  satellites: number;
  passed: boolean;
  /** Special actions used this round (keys from `specialActions`). */
  used: string[];
  /** Free-form per-player storage for content (counters, flags). Must stay JSON. */
  mark: Record<string, number | boolean | string>;
  timeouts: number;
}

export type Decision =
  | { kind: 'leech'; seat: number; amount: number; from: number }
  | { kind: 'tech'; seat: number }
  | { kind: 'cover'; seat: number; adv: string }
  | { kind: 'research'; seat: number; tracks: Track[] | null }
  | { kind: 'lostPlanet'; seat: number }
  | { kind: 'custom'; seat: number; source: string; key: string; options: string[]; labelFa: string; data?: number | string };

export type Phase = 'faction' | 'setup' | 'booster' | 'actions' | 'finished';

export type LogEntry =
  | { t: 'faction'; seat: number; faction: string }
  | { t: 'place'; seat: number; hex: number; building: Building }
  | { t: 'booster'; seat: number; booster: string }
  | { t: 'round'; round: number }
  | { t: 'mine'; seat: number; hex: number; steps: number; extra?: boolean }
  | { t: 'upgrade'; seat: number; hex: number; to: Building }
  | { t: 'gaiaform'; seat: number; hex: number }
  | { t: 'federation'; seat: number; token: string; hexes: number[] }
  | { t: 'research'; seat: number; track: Track; level: number }
  | { t: 'power'; seat: number; action: string }
  | { t: 'special'; seat: number; action: string }
  | { t: 'convert'; seat: number; id: string }
  | { t: 'leech'; seat: number; amount: number; vp: number }
  | { t: 'decline'; seat: number }
  | { t: 'tech'; seat: number; tech: string }
  | { t: 'pass'; seat: number; booster: string | null }
  | { t: 'vp'; seat: number; n: number; why: string }
  | { t: 'final'; seat: number; vp: number }
  | { t: 'timeout'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' };

export interface GaiaState {
  players: number;
  options: { factions: 'choose' | 'random' };
  active: boolean[];
  /** Seats that left the game, in order (placed last, earlier leavers lower). */
  left: number[];
  placements: SectorPlacement[];
  hexes: HexState[];
  phase: Phase;
  round: number;
  /** Turn order this round (round 1: start player first; later rounds: order of passing). */
  order: number[];
  passOrder: number[];
  current: number;
  setupQueue: { seat: number; what: 'mine' | 'pi' }[];
  /** Open decisions, head first. Nobody else acts while one is open. */
  pending: Decision[];
  /** Internal: where decisions created by the step being resolved are inserted. */
  ins: number;
  /** Internal: the current player's main action is done; the turn passes once `pending` is empty. */
  turnDone: boolean;
  /** Standard tech tiles: 0–5 under the tracks (TRACKS order), 6–8 the three free spaces. Advanced: above each track. */
  techBoard: { std: (string | null)[]; adv: (string | null)[] };
  /** Track index (TRACKS order) of each advanced tile in play; kept after the tile is taken. */
  advPos: Record<string, number>;
  boosters: string[];
  roundTiles: string[];
  finalTiles: string[];
  /** Federation token supply (id → copies left). */
  fedSupply: Record<string, number>;
  /** Federation token on terraforming level 5 (taken by the first to reach it). */
  terraFed: string | null;
  /** Power / QIC actions taken this round. */
  powerUsed: string[];
  pl: PlayerState[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

// ---------------- content API ----------------

/** Context handed to every content function: the (mutable) state and the seat that owns the effect. */
export interface X { s: GaiaState; seat: number }

export type GameEvent =
  | { kind: 'mine'; hex: number; planet: Planet; gaia: boolean; newType: boolean; newSector: boolean; extra: boolean }
  | { kind: 'upgrade'; hex: number; to: 'ts' | 'lab' | 'pi' | 'ac1' | 'ac2'; from: Building }
  | { kind: 'terraform'; steps: number }
  | { kind: 'research'; track: Track; level: number }
  | { kind: 'federation'; token: string }
  | { kind: 'gaiaform'; hex: number };
export type EventKind = GameEvent['kind'];
export type Triggers = { [K in EventKind]?: (x: X, e: Extract<GameEvent, { kind: K }>) => void };

/** Once-per-round special action (orange octagon). Key in `PlayerState.used` = source id. */
export interface SpecialAction {
  labelFa: string;
  /** Extra availability check (resources, PI built…). Already-used-this-round is checked by the engine. */
  can?: (x: X) => boolean;
  /** Hex targets when the action needs one (e.g. range +3 then build). The engine offers one action per target. */
  targets?: (x: X) => number[];
  run: (x: X, target: number | undefined) => void;
}

/** Free action (any number per turn, before the main action). */
export interface Conversion {
  id: string;
  labelFa: string;
  can: (x: X) => boolean;
  run: (x: X) => void;
}

export interface Effects {
  /** One-time effect when gained (tile taken, token taken). */
  onGain?: (x: X) => void;
  /** Added in every income phase while held (tech tiles: while not covered). */
  income?: Gain | ((x: X) => Gain);
  /** When the holder passes (boosters, advanced tech tiles). */
  onPass?: (x: X) => void;
  /** Reactions to the holder's own events. */
  on?: Triggers;
  action?: SpecialAction;
  conversions?: Conversion[];
  /** Faction only: ids of the standard free actions (core BASE_CONVERSIONS) the board hides right now (Nevlas PI). */
  hideConversions?: (x: X) => string[];
  /** Passive: adjust the power value of the holder's structure at `hex` (base already computed). */
  powerValue?: (x: X, hex: number, base: number) => number;
  /** Passive: adjust the cost of a mine at `hex` (terraforming ore, gaia/range QIC already included). */
  mineCost?: (x: X, hex: number, cost: Gain) => Gain;
  /** Passive: adjust the power value the holder needs to form a federation (base 7). */
  fedThreshold?: (x: X, base: number) => number;
  /** Faction only: runs in each gaia phase BEFORE the gaia-area tokens return (`power.gaia` still holds them; gaiaformed
   *  planets are already gaia). May push custom decisions; whatever is left in `power.gaia` returns right after. */
  onGaiaPhase?: (x: X) => void;
  /** Faction only: replace the leech decision (e.g. Taklons PI). Return options; resolve applies one. */
  leech?: { options: (x: X, amount: number) => string[]; resolve: (x: X, amount: number, choice: string) => void };
  /** Handlers for custom decisions this source created (`key` → handler). */
  decide?: Record<string, (x: X, choice: string, d: Extract<Decision, { kind: 'custom' }>) => void>;
}

export interface FactionFlags {
  /** Terrans: gaia-area tokens return to bowl II. */
  gaiaToBowl2?: boolean;
  /** Itars: when burning, the removed token goes to the gaia area. */
  burnToGaia?: boolean;
  /** Nevlas after PI: each token in bowl III is worth 2 power when spending. */
  bowl3DoubleAfterPI?: boolean;
  /** Ivits: one growing federation; satellites cost 1 QIC instead of a power token. */
  singleFederation?: boolean;
  satelliteQic?: boolean;
  /** Lantids: may build a mine on a planet another player colonized (no terraforming). */
  sharePlanets?: boolean;
  /** Bal T'aks: cannot advance navigation before the PI is built. */
  noNavigationUntilPI?: boolean;
  /** Gleens: after set-up, gain ore instead of QIC until the QIC academy is built. */
  qicAsOreUntilAc2?: boolean;
}

export interface FactionDef {
  id: string;
  nameFa: string;
  nameEn: string;
  home: HomePlanet;
  /** Starting resources/power/tracks; omitted values use the defaults 15c 4o 3k 1q, bowls 2/4/0. */
  start?: { c?: number; o?: number; k?: number; q?: number; b1?: number; b2?: number; b3?: number; brain?: 1 | 2 | 3; research?: Partial<Record<Track, number>> };
  /** Base income printed on the board (default +1 ore +1 knowledge). */
  income?: Gain;
  /** Faction board overrides. ts/lab: income per built copy (1st, 2nd…); pi/ac1: income; ac2Action: special action gain. */
  buildings?: { ts?: Gain[]; lab?: Gain[]; pi?: Gain; ac1?: Gain; ac2Action?: Gain; piCost?: Gain };
  /** Mines placed during set-up (default 2); `setupPI`: place the PI at the end of set-up instead (Ivits). */
  setupMines?: number;
  setupPI?: boolean;
  flags?: FactionFlags;
  effects?: Effects;
  abilityFa: string;
  piFa: string;
}

export interface TechDef { id: string; kind: 'std' | 'adv'; labelFa: string; effects: Effects }
export interface BoosterDef { id: string; labelFa: string; income: Gain; effects?: Effects }
export interface RoundTileDef { id: string; labelFa: string; on: Triggers }
export interface FinalTileDef { id: string; labelFa: string; neutral: number; value: (s: GaiaState, seat: number) => number }
export interface FedTokenDef { id: string; labelFa: string; gain: Gain; green: boolean; copies: number }

export interface ContentBundle {
  factions?: FactionDef[];
  techs?: TechDef[];
  boosters?: BoosterDef[];
  rounds?: RoundTileDef[];
  finals?: FinalTileDef[];
  feds?: FedTokenDef[];
}
