// Terraforming Mars content API: the types every card / corporation is declared with, the effect context (`Ctx`)
// that card functions receive, and small helpers. Content files (src/content/*.ts) import ONLY from this file.
// See src/content/README.md for the full guide with examples.
import type { Outcome } from '@bg/game-sdk';

export const RES = ['mc', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;
export type Res = (typeof RES)[number];
export const TAGS = ['building', 'space', 'science', 'power', 'earth', 'jovian', 'plant', 'microbe', 'animal', 'city'] as const;
export type Tag = (typeof TAGS)[number];
export type CardRes = 'microbe' | 'animal' | 'science' | 'fighter';
export type Param = 'temperature' | 'oxygen';
export type Amounts = Partial<Record<Res, number>>;

/** Global parameter limits (temperature in °C, steps of 2; oxygen in %; oceans count). */
export const TEMP_MIN = -30, TEMP_MAX = 8, OXY_MAX = 14, OCEANS_MAX = 9;

// ---------------- Board / tiles ----------------
export type TileKind = 'greenery' | 'ocean' | 'city' | 'special';
/**
 * Where a tile may go. The engine implements every rule:
 * ocean        empty ocean-reserved area                     greenery  land; next to an own tile if possible
 * city         land, not next to any city                    land      any empty land area (special tiles)
 * isolated     land with no adjacent tile                    isolatedCity  city that is next to no other tile (Research Outpost)
 * volcanic     Tharsis Tholus / Ascraeus / Pavonis / Arsia   noctis    the reserved Noctis City area
 * oceanArea    an empty ocean-reserved area for a NON-ocean tile (Mangrove, Protected Valley, Mohole Area)
 * landOcean    an ocean tile on a land area (Artificial Lake) nextToCity  land next to a city tile (Industrial Center)
 * twoCities    city next to at least 2 city tiles (Urbanized Area; ignores the city spacing rule)
 * nextToGreenery land next to a greenery tile (Ecological Zone)
 * steelTi      land with a steel or titanium placement bonus (Mining Rights)
 * steelTiOwnAdj  steelTi AND next to an own tile (Mining Area)
 * phobos / ganymede  the off-map city areas (Phobos Space Haven / Ganymede Colony)
 * "land" never includes ocean-reserved areas or Noctis City; Land Claim markers keep an area for their owner.
 */
export type TileRule = 'ocean' | 'greenery' | 'city' | 'land' | 'isolated' | 'isolatedCity' | 'volcanic' | 'noctis' | 'oceanArea'
  | 'landOcean' | 'nextToCity' | 'twoCities' | 'nextToGreenery' | 'steelTi' | 'steelTiOwnAdj' | 'phobos' | 'ganymede';
export interface TileSpec { kind: TileKind; rule?: TileRule }
/** A placed tile. `card` names the card a special tile / special city belongs to (e.g. Capital '008'). */
export interface Tile { kind: TileKind; owner: number | null; card?: string }
export interface Space { id: string; row: number; col: number; ocean: boolean; bonus: ('steel' | 'titanium' | 'plants' | 'card')[]; name?: string; offMap?: boolean }

// ---------------- Requirements ----------------
export interface Range { min?: number; max?: number }
export interface Req {
  /** Global requirements (Adaptation Technology / Inventrix / Special Design widen them by 2 steps). */
  temperature?: Range; oxygen?: Range; oceans?: Range;
  /** Own tags in play (corporation + non-event cards). */
  tags?: Partial<Record<Tag, number>>;
  /** Own production at least this much (e.g. {titanium: 1} = "requires that you have titanium production"). */
  prod?: Amounts;
  /** City tiles in play, all players, on and off Mars. */
  cities?: number;
  /** Own greenery tiles. */
  greeneries?: number;
}

// ---------------- Prompts (decisions taken in the middle of an effect) ----------------
/** Continuation: `card` null = engine builtin, otherwise CARDS[card].resolve[key](g, answer, data). */
export interface Then { card: string | null; key: string }
export interface Answer { space?: string; seat?: number; card?: string; index?: number; cards?: string[]; amount?: number; skip?: true }
/** onSkip: an optional prompt that is skipped still calls its continuation with `{skip: true}` (chained prompts). */
type Base = { seat: number; then?: Then; data?: Record<string, unknown>; labelFa?: string; optional?: boolean; onSkip?: boolean };
export type Prompt =
  | Base & { kind: 'space'; tile: TileKind; rule: TileRule; card?: string; claim?: boolean }
  | Base & { kind: 'player'; options: number[] }
  | Base & { kind: 'card'; options: string[] }
  | Base & { kind: 'choice'; options: string[] }
  | Base & { kind: 'cards'; cards: string[]; min: number; max: number }
  | Base & { kind: 'amount'; min: number; max: number };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type PromptInput = DistributiveOmit<Prompt, 'seat'> & { seat?: number };

// ---------------- Card definition ----------------
export type CardKind = 'automated' | 'active' | 'event' | 'corporation';
export interface ActionDef {
  /** M€ cost of the action (paid by the engine; Helion may use heat). */
  cost?: number;
  /** Resources that may pay the cost (Water Import From Europa: titanium, Aquifer Pumping: steel). */
  payWith?: { steel?: boolean; titanium?: boolean };
  /** Extra availability check (e.g. "has 1 energy"). Default: always usable. */
  can?: (g: Ctx) => boolean;
  run: (g: Ctx) => void;
}
export interface TileEvent { seat: number; kind: TileKind; space: string; card?: string; onMars: boolean; bonus: Amounts }
export interface CardEvent { seat: number; card: CardDef }
export interface ProjectEvent { seat: number; project: string; cost: number }

export interface CardDef {
  /** Official card number, 3 digits ('035'); corporations 'R08' etc. Used as the id in state and actions. */
  id: string;
  name: string;
  nameFa: string;
  kind: CardKind;
  /** Printed cost (0 for corporations). */
  cost: number;
  tags: Tag[];
  /** Corporate Era card / corporation (only in games with the Corporate Era option). */
  ce?: boolean;
  /** Short Persian effect text shown on the card. */
  textFa: string;
  /** Resource type this card can hold. */
  resource?: CardRes;
  req?: Req;

  // ---- immediate effects as data, applied in this order when played ----
  /** Gain resources; a negative value is a mandatory loss (Moss: {plants: -1}) checked for legality. */
  gain?: Amounts;
  /** Own production change; the engine refuses the card if a decrease is impossible (M€ min −5, others 0). */
  prod?: Amounts;
  tr?: number;
  raise?: Partial<Record<Param, number>>;
  oceans?: number;
  tiles?: TileSpec[];
  draw?: number;
  /** Resources added to this card. */
  addSelf?: number;
  /** "Decrease any X production N steps" (mandatory; card unplayable when nobody can). */
  anyProd?: { res: Res; n: number };
  /** "Remove up to N X from any player" (optional target). steal: you gain what is removed. */
  removeAny?: { res: Res; n: number; steal?: boolean };
  /** "Add N resources to (ANOTHER) card" of yours holding `type`. */
  addCard?: { type: CardRes; n: number; other?: boolean };
  /** Any other immediate effect. Runs after the data effects. */
  play?: (g: Ctx) => void;
  /** Extra play condition (e.g. a choice that needs a target). Return false to refuse. */
  canPlay?: (g: Ctx) => boolean;
  /** Dynamic production box (Power Grid, Medical Lab…), run on play after `prod`. Robotic Workforce re-runs prod + prodBox. */
  prodBox?: (g: Ctx) => void;

  // ---- blue card / corporation action (once per generation) ----
  action?: ActionDef;

  // ---- ongoing effects (on this card's owner while it is in play) ----
  /** M€ discount on cards the owner plays. */
  discount?: (card: CardDef, g: Ctx) => number;
  /** M€ discount on a standard project (Thorgate: powerPlant). */
  spDiscount?: (project: string, g: Ctx) => number;
  /** Requirement tolerance in steps (Adaptation Technology, Inventrix: 2). */
  reqTolerance?: number;
  steelBonus?: number;
  titaniumBonus?: number;
  /** Plants per greenery conversion (Ecoline: 7). */
  greeneryPlants?: number;
  /** Heat may be spent as M€ (Helion). */
  heatAsMc?: boolean;
  /** Opponents may not remove your plants, animals or microbes (Protected Habitats). */
  protects?: boolean;
  /** Resources may not be removed from this card (Pets). */
  keepsResources?: boolean;
  /** Any player played a card (after it resolved). Check `e.seat === g.seat` for "when you play". */
  onCardPlayed?: (g: Ctx, e: CardEvent) => void;
  /** Any player placed a tile. */
  onTilePlaced?: (g: Ctx, e: TileEvent) => void;
  /** Any player paid for a standard project. */
  onStandardProject?: (g: Ctx, e: ProjectEvent) => void;
  /** Continuations of this card's prompts. */
  resolve?: Record<string, (g: Ctx, a: Answer, data: Record<string, unknown>) => void>;

  /** End-game victory points (number, or computed). */
  vp?: number | ((g: Ctx) => number);

  // ---- corporations ----
  startMc?: number;
  /** Applied at game start after `startMc` (gain/prod fields above also apply to corporations). */
  start?: (g: Ctx) => void;
  /** Mandatory first action of the game (Tharsis Republic city, Inventrix draws 3). */
  firstAction?: (g: Ctx) => void;
  /** Beginner Corporation: initial cards are free. */
  freeStartCards?: boolean;
}

// ---------------- State seen by effects ----------------
export interface PlayerState {
  corp: string | null;
  tr: number;
  res: Record<Res, number>;
  prod: Record<Res, number>;
  hand: string[];
  /** Played project cards in order (automated, active and events). */
  played: string[];
  /** Resources on cards (card id → count). */
  cardRes: Record<string, number>;
  /** Card / corporation actions used this generation. */
  used: string[];
  passed: boolean;
  /** TR was raised this generation (United Nations Mars Initiative). */
  trRaised: boolean;
  firstActionDone: boolean;
  /** Next card played this generation: M€ discount (Indentured Workers) and requirement tolerance (Special Design). */
  nextDiscount: number;
  nextReqBonus: number;
  /** Generation-1 / research offers (hidden). */
  corpOffer: string[];
  offer: string[];
  pick: { corp?: string; cards: string[] } | null;
  pack: string[];
  drafted: string[];
  draftPick: string | null;
}

export interface TmState {
  playerCount: number;
  corporateEra: boolean;
  draft: boolean;
  generation: number;
  phase: 'corp' | 'draft' | 'research' | 'action' | 'final' | 'end';
  firstPlayer: number;
  current: number;
  actionsTaken: number;
  temperature: number;
  oxygen: number;
  oceans: number;
  tiles: Record<string, Tile>;
  claims: Record<string, number>;
  players: PlayerState[];
  deck: string[];
  discard: string[];
  milestones: { id: string; seat: number }[];
  awards: { id: string; seat: number }[];
  queue: Prompt[];
  /** Last revealed card (Search For Life) - public. */
  revealed: string | null;
  log: { seat: number; kind: string; card?: string; detail?: string }[];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}

/** Effect context. `seat` is the owner of the effect, `self` the card whose effect is running. */
export interface Ctx {
  readonly s: TmState;
  readonly seat: number;
  readonly p: PlayerState;
  readonly self: string;
  card(id: string): CardDef;
  /** Gain (or lose, clamped at 0) a resource. */
  gain(res: Res, n: number): void;
  /** Can the owner pay n M€ in the middle of an effect (M€, plus heat for Helion)? */
  canPay(n: number): boolean;
  /** Pay n M€ in the middle of an effect: M€ first, then heat (Helion). Call only after canPay(n). */
  pay(n: number): void;
  /** Change own production (M€ min −5, others min 0). */
  prod(res: Res, n: number): void;
  /** Change another player's production (clamped). */
  prodOf(seat: number, res: Res, n: number): void;
  tr(n: number): void;
  /** Raise a global parameter; TR and parameter bonuses are applied. Returns the steps actually raised. */
  raise(param: Param, steps: number): number;
  /** Queue the placement of one tile for this player. */
  tile(kind: TileKind, rule?: TileRule, then?: Then): void;
  ocean(n?: number): void;
  draw(n: number): string[];
  /** Take n cards off the deck WITHOUT putting them in hand (Business Contacts, Invention Contest…): pass them to a 'cards' prompt. */
  look(n: number): string[];
  /** Put cards on the discard pile. */
  discardCards(ids: string[]): void;
  /** Reveal (and discard) the top card of the deck. */
  reveal(): string | null;
  /** Map helpers: the space holding this card's tile, neighbours of a space, the tile on a space. */
  tileOf(card?: string): string | null;
  adjacent(space: string): string[];
  tileAt(space: string): Tile | null;
  space(id: string): Space;
  /** Land Claim: prompt for a non-reserved land area that only this player may use later. */
  claim(): void;
  /** Robotic Workforce: re-run another card's production box (prod data + prodBox) for this player. */
  copyProduction(card: string): void;
  /** Add (or remove with negative n) resources on a card (default: this card). */
  addRes(n: number, card?: string): void;
  resOn(card?: string): number;
  /** Own tags in play (corporation + non-event cards). With `seat`, someone else's. */
  tags(tag: Tag, seat?: number): number;
  /** City tiles: all players (seat undefined) or one player; onMars excludes Phobos/Ganymede. */
  cities(opts?: { seat?: number; onMars?: boolean }): number;
  greeneries(seat?: number): number;
  /** Owner's tableau (corporation + played cards, events included only with events=true). */
  tableau(seat?: number, events?: boolean): string[];
  /** Number of events played by everyone. */
  eventsPlayed(): number;
  /** Is this player protected from losing plants/animals/microbes to this ctx's player? */
  isProtected(seat: number): boolean;
  /** Queue a prompt for the owner (or `seat`). */
  prompt(p: PromptInput): void;
  /** "Remove up to n res from any player" prompt (optional; steal = owner gains it). */
  removeAny(res: Res, n: number, steal?: boolean): void;
  /** Mandatory "decrease any res production n steps" prompt. */
  reduceAnyProd(res: Res, n: number): void;
  canReduceAnyProd(res: Res, n: number): boolean;
  /** "Add n resources to a card of yours holding type" (other = not this card). Skipped when no target. */
  addToCard(type: CardRes, n: number, other?: boolean): void;
  /** Own cards in play that hold `type`. */
  cardsWith(type: CardRes, opts?: { other?: boolean; min?: number; seat?: number }): string[];
  /** Choice among Persian labels; answered into this card's resolve[key](g, {index}). */
  choose(labelsFa: string[], key: string, data?: Record<string, unknown>): void;
}

// ---------------- Helpers for content ----------------
/** VP = floor(resources on this card / per) * each. */
export const vpPerRes = (per = 1, each = 1) => (g: Ctx) => Math.floor(g.resOn() / per) * each;
/** VP = own tags of `tag` / per. */
export const vpPerTag = (tag: Tag, per = 1) => (g: Ctx) => Math.floor(g.tags(tag) / per);
/** The card carries this tag (events too: discounts and "when you play an X tag" see event tags). */
export const hasTag = (c: CardDef, t: Tag) => c.tags.includes(t);
/** Count tags on a card (events included: used by "when you play an X tag"). */
export const tagCount = (c: CardDef, ...t: Tag[]) => c.tags.filter((x) => t.includes(x)).length;
