// Ark Nova («آرک نوا») shared types: card data rows, state, steps (prompts) and the content definition API.
// The content API is documented in content/README.md.
import type { EngineRng, Outcome } from '@bg/game-sdk';

export const ACTION_KEYS = ['animals', 'build', 'cards', 'association', 'sponsors'] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];
export const CONTINENTS = ['africa', 'americas', 'asia', 'australia', 'europe'] as const;
export type Continent = (typeof CONTINENTS)[number];
/** The 7 animal categories (bear and petting-zoo animal included, as the rules say). */
export const CATEGORIES = ['bird', 'herbivore', 'predator', 'primate', 'reptile', 'bear', 'pet'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Icon = Category | Continent | 'science' | 'rock' | 'water';
export const ICONS: Icon[] = [...CATEGORIES, ...CONTINENTS, 'science', 'rock', 'water'];
/** Card conditions (left edge). `appeal25`: playable only while your appeal is at most 25. `rep`: minimum reputation. */
export type ReqKey = Icon | 'partner' | 'animals2' | 'sponsors2' | 'appeal25' | 'rep';
export type Req = Partial<Record<ReqKey, number>>;
export type AbilityKey =
  | 'sprint' | 'pack' | 'hunter' | 'clever' | 'boost' | 'action' | 'inventive' | 'fullThroated' | 'jumping' | 'multiplier'
  | 'iconic' | 'sunbathing' | 'pouch' | 'resistance' | 'assertion' | 'flock' | 'digging' | 'sponsorMagnet' | 'venom'
  | 'dominance' | 'pilfering' | 'snapping' | 'constriction' | 'hypnosis' | 'scavenging' | 'posturing' | 'perception'
  | 'determination' | 'peacocking' | 'pettingZoo';
export type SpecialKind = 'pz' | 'rh' | 'ba';
export type AbilityValue = number | string | null;

export interface AnimalData {
  id: number; name: string; cost: number;
  /** Printed standard-enclosure size (0 for petting-zoo animals). */
  size: number; rock: number; water: number;
  /** false: Petting Zoo animal (cannot use a standard enclosure). */
  std: boolean;
  /** Alternative special enclosure and the spaces it uses there. */
  sp?: { k: SpecialKind; n: number };
  icons: Icon[]; req: Req; appeal: number; cp: number; rep: number;
  /** Ability keywords with their printed value (number, action key, continent or null). */
  ab: [AbilityKey, AbilityValue][];
}
export interface SponsorData { id: number; name: string; level: number; rock: number; water: number; icons: Icon[]; req: Req; appeal: number; cp: number; rep: number }
/** One project level: reward and condition (`need` icons, or `size` bracket 4 = 4–5 / 3 / 2 = 1–2 for release). */
export interface ProjectSlotData { cp: number; rep: number; need?: number; size?: number }
export interface ProjectData {
  id: number; name: string; base: boolean; kind: 'icons' | 'release' | 'breed';
  /** icons: an Icon, 'categories' / 'continents' (different ones), 'small' / 'large' (animals). release/breed: the icon of the animal. */
  icon: string; slots: ProjectSlotData[]; played?: { rep: number };
}
export interface ScoringData { id: number; name: string; table: Record<number, number> }

/** Universities: 'science' = 2 research icons; 'rep' = 1 research + 2 reputation; 'hand' = 1 reputation + hand limit 5. */
export type UniKey = 'science' | 'rep' | 'hand';
export const UNIS: UniKey[] = ['science', 'rep', 'hand'];
export type AssocTask = 'rep' | 'zoo' | 'uni' | 'project';

/** A placed building. Kinds: e1..e5 (standard), kiosk, pavilion, pz/rh/ba (special), u<card id> (unique). */
export interface Building {
  id: number; kind: string; cells: string[];
  /** Standard enclosure on its occupied side. */
  full?: boolean;
  /** Special enclosure: spaces marked with player tokens. */
  used?: number;
}

export type BonusKey =
  | 'money' | 'x' | 'rep' | 'cp' | 'appeal' | 'card' | 'snap' | 'worker' | 'upgrade' | 'partner' | 'uni' | 'enclosure'
  | 'kiosk' | 'pavilion' | 'clever' | 'multiplier' | 'sponsor' | 'fx';
/**
 * A printed bonus. `n` = amount (money/x/rep/cp/appeal/card count; `enclosure`: the size of the free standard enclosure).
 * `fx` names a registered content continuation (bespoke bonuses, e.g. a map's own icon); it runs with data = `data`.
 */
export interface Bonus { k: BonusKey; n?: number; fx?: string; data?: unknown; /** Persian label (required for `fx` bonuses). */ labelFa?: string }

export interface ActionTokens { mult: number; venom: number; con: number }

export interface Player {
  map: string;
  money: number; appeal: number; cp: number; rep: number; x: number;
  /** Action cards by slot: index 0 = slot 1 (strength 1). */
  slots: ActionKey[];
  up: Record<ActionKey, boolean>;
  tok: Record<ActionKey, ActionTokens>;
  /** Active association workers on the notepad. */
  workers: number;
  /** Extra workers hired so far (0..3). */
  hired: number;
  hand: number[];
  /** Final Scoring cards (hidden from others). */
  finals: number[];
  /** Animal and Sponsor cards played into the zoo, in order. */
  zoo: number[];
  /** Free per-card / per-map state for content (key = card id or 'map'). PUBLIC: never store hidden card ids here. */
  data: Record<string, unknown>;
  /** Cards tucked under a card (Pouch, Expert on Australia). Hidden: others only see the counts. */
  under: Record<string, number[]>;
  partners: Continent[];
  unis: UniKey[];
  buildings: Building[];
  nextId: number;
  /** The 7 left-edge bonus spaces: true while the player token is still there. */
  left: boolean[];
  /** Number of conservation-project supports (tie-break; Conservation Zoo; Medical Breakthrough). */
  supported: number;
  /** Milestones already taken ('r5', 'c2', 'full', ...). Content may add its own keys. */
  marks: string[];
  /** Spaces whose printed placement bonus has been taken. */
  taken: string[];
  timeouts: number;
}

export interface Draft { cards: number[]; maps: string[] }

/** One action being executed. `owner` is whose Action card it is (Hypnosis uses another player's card). */
export interface ActTurn {
  seat: number; card: ActionKey; owner: number;
  /** Strength of the current repetition. `base` = strength without X-tokens (for a Multiplier repetition). */
  strength: number; base: number; up: boolean;
  /** Sub-moves done in the current repetition (animals played, buildings built, tasks done, sponsors played, cards drawn). */
  count: number;
  /** Build: kinds built. Association: tasks done. Sponsors: levels used. */
  kinds: string[]; tasks: AssocTask[]; donated: boolean; levels: number;
  /** Engineer: the one extra copy has been built. */
  extraUsed: boolean;
  /** Only small animals were played so far (WAZA Small Animal Program). */
  small: boolean;
  /** Further repetitions of the same action (Multiplier tokens). */
  mult: number;
  /** "After finishing" steps queued by effects during the action. */
  after: Step[];
}

interface StepBase { seat: number; fx: string; data?: unknown; card?: number }
export type Step =
  | (StepBase & { k: 'sys' })
  | (StepBase & { k: 'pick'; ids: number[]; min: number; max: number; label: string; optional?: boolean; /** ids are public (display) cards */ open?: boolean })
  | (StepBase & { k: 'option'; options: { value: string; label: string }[]; label: string; optional?: boolean })
  | (StepBase & { k: 'place'; kinds: string[]; free: boolean; optional: boolean; label: string; /** may cover spaces that need Build II */ upgraded?: boolean });
export type Prompt = Exclude<Step, { k: 'sys' }>;

/** Public log line (never put hidden card ids here). */
export interface LogEntry { seat: number; t: string; [k: string]: unknown }

export interface State {
  n: number;
  players: Player[];
  stage: 'draft' | 'play' | 'over';
  current: number;
  first: number;
  drafts: (Draft | null)[];
  deck: number[];
  discard: number[];
  /** Display folders 1..6 (index 0 = folder 1); null = taken this turn (refilled at the end of the turn). */
  display: (number | null)[];
  finalsDeck: number[];
  brk: number;
  brkMax: number;
  /** Seat whose turn triggered the break (the break runs at the end of that turn). */
  breakDue: number | null;
  zoosAvail: Continent[];
  unisAvail: UniKey[];
  /** Association workers placed on each task (one seat entry per worker). */
  assoc: Record<AssocTask, number[]>;
  /** Donation spaces already covered. */
  donations: number;
  baseProjects: number[];
  /** Face-down pile of unused base projects (Assertion / Dominance search it). */
  baseDeck: number[];
  /** Conservation projects above the Association board, index 0 = leftmost. */
  projects: number[];
  /** Project id → slot owners (seat, -1 blocked, null free). */
  ptoks: Record<string, (number | null)[]>;
  /** Extra supports of release projects (Migration Recording). */
  extraSupports: { project: number; seat: number }[];
  /** Bonus tiles still lying beside conservation spaces 5 and 8. */
  bonusTiles: { 5: string[]; 8: string[] };
  cp10: boolean;
  /** The game ends once `turnsDone` reaches this value (set when the end is triggered). */
  endAt: number | null;
  turnsDone: number;
  /** A turn is in progress (its action was chosen). */
  inTurn: boolean;
  act: ActTurn | null;
  queue: Step[];
  /** A Venom token was removed this turn. */
  venomCleared: boolean;
  /** Once-per-turn abilities already used this turn. */
  turnUsed: string[];
  seq: number;
  log: LogEntry[];
  /** Final scoring breakdown (filled at game end). */
  final: { seat: number; vp: number; appeal: number; cp: number; target: number }[] | null;
  outcome: Outcome | null;
  options: { map: string };
}

/** Context handed to every content function. `seat` = whose effect it is; `card` = the card whose effect runs (if any). */
export interface Ctx { s: State; seat: number; rng: EngineRng; card?: number }
export type Fx = (c: Ctx) => void;
export interface Answer { ids?: number[]; value?: string; skip?: boolean; kind?: string; cells?: string[] }
/** Continuation of a prompt or sys step: `data` is what was stored with the step, `ans` the player's answer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cont = (c: Ctx, data: any, ans: Answer) => void;

export type GameEvent =
  /** Icons played into a zoo (a card, a partner zoo or a university). Double icons count twice. */
  | { t: 'icons'; seat: number; card: number | null; icons: Partial<Record<Icon, number>>; source: 'animal' | 'sponsor' | 'partner' | 'uni' }
  | { t: 'animal'; seat: number; card: number; building: number | null }
  | { t: 'sponsor'; seat: number; card: number }
  | { t: 'built'; seat: number; building: Building; free: boolean }
  /** A standard enclosure was flipped to its occupied side. */
  | { t: 'occupied'; seat: number; building: Building }
  | { t: 'project'; seat: number; project: number; slot: number; released?: number }
  | { t: 'release'; seat: number; card: number }
  | { t: 'action'; seat: number; card: ActionKey; strength: number }
  | { t: 'placementBonus'; seat: number; cell: string; border: boolean; bonus: Bonus }
  | { t: 'covered'; seat: number; cells: string[] };

/**
 * Passive modifiers ("queries"). Every applicable source of ONE player (cards in their zoo, abilities of their animals,
 * their zoo map) is asked; numeric answers are summed, booleans are OR-ed. Animal-subject queries also ask the abilities
 * of the animal being played (so Flock can describe itself).
 */
export interface Queries {
  /** Money delta when playing this animal (negative = cheaper). */
  animalCost?: (c: Ctx, a: AnimalData) => number;
  /** How many conditions (left-edge icons) of this card may be missing (never rock/water). */
  ignoreConditions?: (c: Ctx, card: AnimalData | SponsorData) => number;
  /** true forbids playing this animal (WAZA Special Assignment). */
  forbidAnimal?: (c: Ctx, a: AnimalData) => boolean;
  /** The animal may be played without any enclosure (Flock Animal). */
  noEnclosure?: (c: Ctx, a: AnimalData) => boolean;
  /** Extra capacity of a standard enclosure (map 2 Outdoor Areas: +2). */
  enclosureSize?: (c: Ctx, b: Building) => number;
  /** Sponsor level delta when played (map 8: -1). */
  sponsorLevel?: (c: Ctx, sp: SponsorData) => number;
  /** Hand limit delta at the break. */
  handLimit?: (c: Ctx) => number;
  /** Strength reduction for the support-a-project association task (Veterinarian: 1). */
  projectStrength?: (c: Ctx) => number;
  /** May cover rock and water spaces; ignores rock/water requirements (Diversity Researcher). */
  coverTerrain?: (c: Ctx) => boolean;
  /** Immune to Venom, Constriction, Hypnosis and Pilfering (Quarantine Lab). Content checks it with `query`. */
  immune?: (c: Ctx) => boolean;
  /** May build one more copy of a building built in the Build action (Engineer). */
  extraBuild?: (c: Ctx) => boolean;
  /** May support the same Release project again (Migration Recording). */
  repeatRelease?: (c: Ctx) => boolean;
}

export type EventHandlers = { [E in GameEvent['t']]?: (c: Ctx, e: Extract<GameEvent, { t: E }>) => void };

/** A once-per-turn ability the player may use at the start of their own turn (map 4 Commercial Harbor). */
export interface TurnAbility { key: string; labelFa: string; can: (c: Ctx) => boolean; run: Fx }

/** Effects of one Animal or Sponsor card. Stats come from data.ts; the def adds behaviour and Persian text. */
export interface CardDef {
  id: number;
  nameFa?: string;
  /** Persian rules text shown on the card. */
  textFa?: string;
  /** Extra play check for a Sponsor (return an error code, or null). Unique buildings are checked by the engine. */
  canPlay?: (c: Ctx) => string | null;
  /** Immediately when played (after printed appeal/conservation/reputation and the icons event). */
  onPlay?: Fx;
  /** In every break's income step. */
  income?: Fx;
  /** Final scoring (may gain appeal/conservation directly). */
  endgame?: Fx;
  on?: EventHandlers;
  q?: Queries;
  /** Sponsor unique building placed when played (axial shape). */
  building?: UniqueBuilding;
  /** Player tokens placed on the card that each count as one wild icon for a BASE project (215, 218). */
  wild?: number;
}
/** `border`: minimum border spaces covered. `anywhere`: need not touch existing buildings (Side Entrance). */
export interface UniqueBuilding { nameFa: string; shape: [number, number][]; rock?: number; water?: number; border?: number; anywhere?: boolean }

/** Animal ability keyword implementation. `v` = printed value. */
export interface AbilityImpl {
  nameFa: string;
  /** Rules text; `card` = the animal it is printed on (Inventive differs per card). */
  textFa: (v: AbilityValue, card?: number) => string;
  /** Immediately when the animal is played (before its printed appeal is added; see README). */
  now?: (c: Ctx, v: AbilityValue) => void;
  /** After finishing the Animals action. */
  after?: (c: Ctx, v: AbilityValue) => void;
  /** Ongoing while the animal is in the zoo (`c.card` = the animal). */
  on?: EventHandlers;
  q?: Queries;
}

export interface MapDef {
  id: string;
  nameFa: string;
  textFa?: string;
  water: string[];
  rock: string[];
  /** Printed features (tower, harbour, restaurant, ...) that are neither buildable nor rock/water. */
  blocked?: string[];
  /** Spaces that need the upgraded Build action. */
  upgrade: string[];
  bonuses: Record<string, Bonus>;
  /** Seven left-edge bonus spaces (top to bottom); `income` ones repeat in every break once uncovered. */
  left: { b: Bonus; income: boolean }[];
  /** Partner zoo / university / hired worker space bonuses, keyed by the count reached (1-based). */
  partner: Record<number, Bonus>;
  uni: Record<number, Bonus>;
  worker: Record<number, Bonus>;
  /** Buildings printed on / placed at setup (map A: a kiosk and an empty 3-space enclosure). */
  preset?: { kind: string; cells: string[] }[];
  on?: EventHandlers;
  q?: Queries;
  income?: Fx;
  endgame?: Fx;
  turn?: TurnAbility;
  /** Renderer labels for printed features, keyed by cell. */
  marks?: Record<string, string>;
}

/** Final Scoring card: `score` returns the conservation points earned (the engine caps it at 4). */
export interface ScoringDef { id: number; nameFa: string; textFa: string; score: (c: Ctx) => number }
export interface BonusTileDef { id: string; nameFa: string; can?: (c: Ctx) => boolean; gain: Fx }

/** What a content chunk exports. */
export interface ContentChunk {
  abilities?: Partial<Record<AbilityKey, AbilityImpl>>;
  cards?: CardDef[];
  maps?: MapDef[];
  scoring?: ScoringDef[];
  /** Projects: Persian names/texts only (rules are generic in the engine). */
  projects?: { id: number; nameFa: string; textFa?: string }[];
  /** Continuations for prompts, sys steps and `fx` bonuses, keyed "<owner>:<name>" (e.g. "s253:play"). */
  fx?: Record<string, Cont>;
}
