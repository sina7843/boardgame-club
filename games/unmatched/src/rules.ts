// Unmatched core rules (Restoration Games core rulebook, 2023) with the Battle of Legends Vol. 1 heroes.
// Duel (2 players) and free-for-all (3–4). Everything multi-step (boosts, movement, defence cards, effect choices) is
// a server-side prompt: the state holds a stack of frames and at most one open prompt for exactly one seat.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { unmatched } from './definition.ts';
import { BOARDS, BOARD_IDS, type Board } from './boards.ts';
import { HEROES, HERO_IDS, isVoyage, type CardDef } from './heroes.ts';

export const START_HAND = 5;
export const HAND_LIMIT = 7;
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 40;

// ---------- state ----------

export interface Fighter { id: string; seat: number; hero: boolean; idx: number; hp: number; maxHp: number; ranged: boolean; space: number | null }

export type PromptKind = 'pickHero' | 'size' | 'action' | 'boost' | 'move' | 'place' | 'fighter' | 'space' | 'cards' | 'option' | 'defend' | 'fog';
/** `why` is a stable reason code the renderer turns into Persian text. */
export interface Prompt {
  kind: PromptKind; seat: number; why: string;
  may?: boolean; fighter?: string; fighters?: string[]; spaces?: number[];
  /** Candidate cards (from a hand or the deck top): projected only to the prompted seat. */
  cards?: string[]; secret?: boolean; min?: number; max?: number; options?: string[];
  /** Fog moves: per token, the spaces it may move to. */
  fogs?: { token: number; to: number[] }[];
}

export type Answer =
  | { type: 'move'; fighter: string; to: number }
  | { type: 'done' }
  | { type: 'choose'; ids: string[] }
  | { type: 'defend'; card: string | null; predict?: number }
  | { type: 'pickHero'; hero: string }
  | { type: 'size'; size: 'big' | 'small' };

export interface Frame {
  kind: string; seat: number; step: number;
  ans?: Answer | null;
  card?: string; fighter?: string; side?: 'a' | 'd';
  fighters?: string[]; moved?: string[]; max?: number; through?: boolean; single?: boolean;
  where?: 'any' | 'anyOther' | 'zone' | 'deploy' | 'adjacent' | 'fog'; ref?: string; may?: boolean;
  n?: number; why?: string; space?: number; picks?: string[]; boost?: number; i?: number;
  /** pickDamage: draw a card if damage was dealt (Dracula). */
  drawAfter?: boolean;
  /** fogMove: tokens allowed, token to skip, destination rule. */
  tokens?: number[]; exclude?: number; dest?: 'steps' | 'anyOther' | 'noFighter';
  opp?: number; value?: number;
}

export interface Combat {
  attacker: string; defender: string; aSeat: number; dSeat: number; ranged: boolean;
  aCard: string; dCard: string | null; boost: string | null; defended: boolean; revealed: boolean;
  cancelA: boolean; cancelD: boolean; boostVoid: boolean; shield: string | null;
  aBase: number; dBase: number; aAdd: number; dAdd: number;
  aVal: number | null; dVal: number | null; damage: number | null; won: 'a' | 'd' | null;
  /** Elementary: played face up with a predicted attack value. */
  dFaceUp: boolean; predict: number | null;
  /** Value is 0 and cannot be changed (Impossible to See, Elementary). */
  aZero: boolean; dZero: boolean;
}

export type LogEntry =
  | { t: 'pick'; seat: number; hero: string }
  | { t: 'turn'; seat: number; n: number }
  | { t: 'maneuver'; seat: number; boost: string | null }
  | { t: 'move'; fighter: string; from: number; to: number }
  | { t: 'place'; fighter: string; to: number }
  | { t: 'scheme'; fighter: string; card: string }
  | { t: 'attack'; fighter: string; target: string; ranged: boolean }
  | { t: 'reveal'; aCard: string; dCard: string | null; boost: string | null; aVal: number; dVal: number; damage: number; cancelA: boolean; cancelD: boolean }
  | { t: 'damage'; fighter: string; n: number }
  | { t: 'heal'; fighter: string; n: number; to: number }
  | { t: 'defeated'; fighter: string }
  | { t: 'draw'; seat: number; n: number }
  | { t: 'exhausted'; seat: number; n: number }
  | { t: 'discard'; seat: number; card: string; why: string }
  | { t: 'fetch'; seat: number; card: string }
  | { t: 'size'; seat: number; size: 'big' | 'small' }
  | { t: 'sawHand'; seat: number; of: number }
  | { t: 'eliminated'; seat: number; reason: 'defeated' | 'resign' | 'timeout' }
  | { t: 'timeout'; seat: number }
  | { t: 'form'; seat: number; form: 'jekyll' | 'hyde' }
  | { t: 'fog'; token: number; to: number }
  | { t: 'vanish'; seat: number }
  | { t: 'revealTop'; seat: number; card: string }
  | { t: 'swap'; a: string; b: string }
  | { t: 'extraAction'; seat: number }
  | { t: 'named'; seat: number; of: number; value: number }
  | { t: 'shownHand'; seat: number; to: number }
  | { t: 'bidding'; seat: number; card: string };

export interface UnmatchedState {
  players: number;
  mapId: string;
  /** Turn order (seats); order[0] starts on space 1 and takes the first turn. */
  order: number[];
  heroes: (string | null)[];
  fighters: Fighter[];
  decks: string[][]; hands: string[][]; discards: string[][];
  size: ('big' | 'small' | null)[];
  alive: boolean[];
  tookTurn: boolean[];
  current: number;
  actionsLeft: number;
  turnNo: number;
  turnStart: Record<string, number | null>;
  stack: Frame[];
  prompt: Prompt | null;
  combat: Combat | null;
  /** Private reveal of a hand (Valley of the Giant Snakes): only `to` sees it. */
  reveal: { to: number; seat: number; cards: string[]; seq: number } | null;
  elimination: number[][];
  timeouts: number[];
  ffa: boolean;
  /** Jekyll & Hyde current form per seat. */
  form: ('jekyll' | 'hyde' | null)[];
  /** Invisible Man's fog tokens (spaces; several may share a space during play) and their owner. */
  fog: number[];
  fogSeat: number | null;
  turnStartFog: number[];
  /** Invisible Man removed by Vanish; returns at the start of that player's next turn. */
  vanished: boolean[];
  /** Number of the action being taken this turn (1-based); Vanish ends the turn when played as the first. */
  actionNo: number;
  /** Fog token moved by the last fog move (Slip Away, Covert Preparation). */
  lastFog: number | null;
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

// ---------- actions ----------

const id = z.string().min(1).max(80);
export const unmatchedAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pickHero'), hero: z.string().max(20) }),
  z.strictObject({ type: z.literal('size'), size: z.enum(['big', 'small']) }),
  z.strictObject({ type: z.literal('maneuver') }),
  z.strictObject({ type: z.literal('scheme'), card: id, fighter: id }),
  z.strictObject({ type: z.literal('attack'), fighter: id, target: id, card: id, boost: id.optional() }),
  z.strictObject({ type: z.literal('defend'), card: id.nullable(), predict: z.number().int().min(0).max(30).optional() }),
  z.strictObject({ type: z.literal('move'), fighter: id, to: z.number().int().min(0).max(200) }),
  z.strictObject({ type: z.literal('done') }),
  z.strictObject({ type: z.literal('choose'), ids: z.array(id).max(30) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type UnmatchedAction = z.infer<typeof unmatchedAction>;

// ---------- view ----------

export interface CardRef { id: string; seat: number; slug: string }
export interface UnmatchedView {
  players: number; mapId: string; order: number[];
  heroes: (string | null)[];
  fighters: Fighter[];
  size: ('big' | 'small' | null)[];
  alive: boolean[];
  current: number; actionsLeft: number; turnNo: number;
  handCounts: number[]; deckCounts: number[];
  discards: CardRef[][];
  myHand: CardRef[] | null;
  prompt: Prompt | null;
  combat: (Omit<Combat, 'aCard' | 'dCard' | 'boost'> & { aCard: CardRef | null; dCard: CardRef | null; boost: CardRef | null; hasBoost: boolean }) | null;
  reveal: { seat: number; cards: CardRef[]; seq: number } | null;
  turnStart: Record<string, number | null>;
  form: ('jekyll' | 'hyde' | null)[];
  fog: number[];
  fogSeat: number | null;
  vanished: boolean[];
  log: (LogEntry & { seq: number })[];
  outcome: Outcome | null;
}

// ---------- lookups ----------

export const cardSeat = (cardId: string) => Number(cardId.split('.')[0]);
export const cardSlug = (cardId: string) => cardId.split('.')[1] ?? '';
export const ref = (cardId: string): CardRef => ({ id: cardId, seat: cardSeat(cardId), slug: cardSlug(cardId) });

/** Card definition for a card instance (decks differ in BOOST values for shared cards, so look up by owner). */
export function cardDef(s: Pick<UnmatchedState, 'heroes'>, cardId: string): CardDef {
  const hero = s.heroes[cardSeat(cardId)];
  const d = hero ? HEROES[hero]?.cards.find((c) => c.slug === cardSlug(cardId)) : undefined;
  if (!d) throw new Error(`unknown card ${cardId}`);
  return d;
}

const adjCache = new Map<string, number[][]>();
export function adjacency(board: Board): number[][] {
  let a = adjCache.get(board.id);
  if (!a) {
    a = board.spaces.map(() => []);
    for (const [x, y] of board.edges) { a[x]!.push(y); a[y]!.push(x); }
    adjCache.set(board.id, a);
  }
  return a;
}
const boardOf = (s: UnmatchedState) => BOARDS[s.mapId]!;
const fighter = (s: UnmatchedState, fid: string | undefined) => s.fighters.find((f) => f.id === fid);
const onBoard = (f: Fighter | undefined): f is Fighter & { space: number } => !!f && f.space !== null && f.hp > 0;
const occupant = (s: UnmatchedState, space: number) => s.fighters.find((f) => f.space === space && f.hp > 0);
export const isAdjacent = (board: Board, a: number, b: number) => adjacency(board)[a]!.includes(b);
export const shareZone = (board: Board, a: number, b: number) => board.spaces[a]!.zones.some((z) => board.spaces[b]!.zones.includes(z));
const heroOf = (s: UnmatchedState, seat: number) => s.fighters.find((f) => f.seat === seat && f.hero);
const ownFighters = (s: UnmatchedState, seat: number) => s.fighters.filter((f) => f.seat === seat && onBoard(f));
const emptySpaces = (s: UnmatchedState) => boardOf(s).spaces.map((_, i) => i).filter((i) => !occupant(s, i));

export function fighterNameFa(s: Pick<UnmatchedState, 'heroes' | 'fighters'>, fid: string): string {
  const f = s.fighters.find((x) => x.id === fid);
  const h = f ? HEROES[s.heroes[f.seat] ?? ''] : undefined;
  if (!f || !h) return fid;
  if (f.hero) return h.hero.nameFa;
  return h.sidekick.count > 1 ? `${h.sidekick.nameFa} ${(f.idx + 1).toLocaleString('fa-IR')}` : h.sidekick.nameFa;
}

/** May this fighter use the card (banner, Jekyll/Hyde form, on the board and undefeated)? */
export function canUse(f: Fighter, d: CardDef, form: 'jekyll' | 'hyde' | null = null): boolean {
  if (d.form && d.form !== form) return false;
  return f.hp > 0 && f.space !== null && (d.banner === 'any' || (d.banner === 'hero') === f.hero);
}
const usable = (s: UnmatchedState, f: Fighter, card: string) => canUse(f, cardDef(s, card), s.form[f.seat] ?? null);

/** Holmes: effects on HOLMES and DR. WATSON cards cannot be cancelled by an opponent. */
const cancellable = (s: UnmatchedState, card: string) => !(s.heroes[cardSeat(card)] === 'holmes' && cardDef(s, card).banner !== 'any');

/** Movement neighbours: printed lines, secret passages, and (for the Invisible Man) links between fog spaces. */
function moveNeighbours(s: UnmatchedState, f: Fighter, space: number): number[] {
  const board = boardOf(s);
  const out = [...adjacency(board)[space]!];
  if (board.passages.includes(space)) out.push(...board.passages.filter((p) => p !== space));
  if (f.hero && s.heroes[f.seat] === 'invisible' && s.fog.includes(space)) out.push(...s.fog.filter((p) => p !== space));
  return out;
}

/** Empty spaces a fighter can end on, moving up to `max` steps (BFS). Friendly fighters can be passed through. */
export function reachable(s: UnmatchedState, fid: string, max: number, through = false): number[] {
  const f = fighter(s, fid);
  if (!onBoard(f) || max <= 0) return [];
  const dist = new Map<number, number>([[f.space, 0]]);
  const queue = [f.space];
  const out: number[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    if (d === max) continue;
    for (const nb of moveNeighbours(s, f, cur)) {
      if (dist.has(nb)) continue;
      const o = occupant(s, nb);
      if (o && o.seat !== f.seat && !through) continue;
      dist.set(nb, d + 1);
      queue.push(nb);
      if (!o) out.push(nb);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Spaces a fog token can move to: up to n steps along printed lines, ignoring fighters and other tokens. */
export function fogReach(s: UnmatchedState, from: number, n: number): number[] {
  const adj = adjacency(boardOf(s));
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (dist.get(cur)! === n) continue;
    for (const nb of adj[cur]!) if (!dist.has(nb)) { dist.set(nb, dist.get(cur)! + 1); queue.push(nb); }
  }
  return [...dist.keys()].filter((x) => x !== from).sort((a, b) => a - b);
}
const onFog = (s: UnmatchedState, f: Fighter | undefined) => !!f && f.space !== null && s.fog.includes(f.space);

// ---------- mutation helpers ----------

type Events = Transition<UnmatchedState>['internalEvents'];

function log(s: UnmatchedState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Draw n. With an empty deck the fighters are exhausted: each takes 2 damage per card not drawn (no reshuffle). */
function draw(s: UnmatchedState, seat: number, n: number) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    const c = s.decks[seat]!.pop();
    if (c) { s.hands[seat]!.push(c); got++; continue; }
    log(s, { t: 'exhausted', seat, n: 2 });
    for (const f of ownFighters(s, seat)) damage(s, f.id, 2);
  }
  if (got) log(s, { t: 'draw', seat, n: got });
}

function damage(s: UnmatchedState, fid: string, n: number) {
  const f = fighter(s, fid);
  if (!onBoard(f) || n <= 0) return;
  if (s.combat?.shield === fid) return; // Bewilderment: all damage prevented during this combat
  const dealt = Math.min(n, f.hp);
  f.hp -= dealt;
  log(s, { t: 'damage', fighter: fid, n: dealt });
  if (f.hp === 0) { (f as Fighter).space = null; log(s, { t: 'defeated', fighter: fid }); }
}

function heal(s: UnmatchedState, fid: string, n: number, setTo?: number) {
  const f = fighter(s, fid);
  if (!onBoard(f)) return; // a defeated fighter cannot recover
  const to = setTo ?? Math.min(f.maxHp, f.hp + n);
  if (to === f.hp) return;
  log(s, { t: 'heal', fighter: fid, n: to - f.hp, to });
  f.hp = to;
}

function discardCard(s: UnmatchedState, seat: number, cardId: string, why: string) {
  const i = s.hands[seat]!.indexOf(cardId);
  if (i < 0) return;
  s.hands[seat]!.splice(i, 1);
  s.discards[seat]!.push(cardId);
  log(s, { t: 'discard', seat, card: cardSlug(cardId), why });
}

function moveFighter(s: UnmatchedState, fid: string, to: number, placed = false) {
  const f = fighter(s, fid)!;
  const from = f.space;
  f.space = to;
  if (placed || from === null) log(s, { t: 'place', fighter: fid, to });
  else log(s, { t: 'move', fighter: fid, from, to });
}

function setForm(s: UnmatchedState, seat: number, form: 'jekyll' | 'hyde') {
  if (s.heroes[seat] !== 'jekyll' || s.form[seat] === form || heroOf(s, seat)!.hp === 0) return;
  s.form[seat] = form;
  log(s, { t: 'form', seat, form });
}

/** "Your opponent" outside combat (free-for-all: the next player in turn order). */
const opponentOf = (s: UnmatchedState, f: Frame) => (s.combat && f.side ? (f.side === 'a' ? s.combat.dSeat : s.combat.aSeat) : nextSeat(s, f.seat));

function toggleSize(s: UnmatchedState, seat: number) {
  if (s.heroes[seat] !== 'alice' || !onBoard(heroOf(s, seat))) return;
  s.size[seat] = s.size[seat] === 'big' ? 'small' : 'big';
  log(s, { t: 'size', seat, size: s.size[seat]! });
}

const nextSeat = (s: UnmatchedState, seat: number) => {
  const i = s.order.indexOf(seat);
  for (let k = 1; k <= s.order.length; k++) {
    const o = s.order[(i + k) % s.order.length]!;
    if (s.alive[o]) return o;
  }
  return seat;
};

// ---------- the frame machine ----------

type Res = 'done' | 'cont' | 'wait';
type Handler = (s: UnmatchedState, f: Frame, rng: EngineRng) => Res;

const push = (s: UnmatchedState, f: Omit<Frame, 'step'> & { step?: number }) => { s.stack.push({ step: 0, ...f }); };
const ask = (s: UnmatchedState, p: Prompt): Res => { s.prompt = p; return 'wait'; };
const takeAns = (f: Frame) => { const a = f.ans ?? null; f.ans = null; return a; };

function run(s: UnmatchedState, rng: EngineRng) {
  for (let guard = 0; !s.prompt && !s.outcome && s.stack.length; guard++) {
    if (guard > 10_000) throw new Error('unmatched: frame loop did not settle');
    const f = s.stack[s.stack.length - 1]!;
    const handler = HANDLERS[f.kind] ?? DURING[f.kind] ?? EFFECTS[f.kind];
    if (!handler) throw new Error(`unmatched: no handler for ${f.kind}`);
    if (handler(s, f, rng) === 'done') {
      const i = s.stack.lastIndexOf(f);
      if (i >= 0) s.stack.splice(i, 1);
    }
  }
}

/** Win check "at the start or end of any action". Eliminates players whose hero is defeated. */
function endCheck(s: UnmatchedState, reason: 'defeated' | 'resign' | 'timeout' = 'defeated'): boolean {
  // Defeated = zero health (a vanished Invisible Man is off the board but not defeated).
  const fallen = s.order.filter((seat) => s.alive[seat] && heroOf(s, seat)?.hp === 0);
  if (!fallen.length) return false;
  for (const seat of fallen) {
    s.alive[seat] = false;
    for (const f of s.fighters) if (f.seat === seat) f.space = null; // sidekicks leave with their hero
    log(s, { t: 'eliminated', seat, reason });
  }
  s.elimination.push(fallen);
  const alive = s.order.filter((seat) => s.alive[seat]);
  if (alive.length <= 1) {
    // Both heroes defeated at once: the player whose turn it is wins.
    const winner = alive[0] ?? (fallen.includes(s.current) ? s.current : fallen[0]!);
    const placements: Outcome['placements'] = [{ seat: winner, place: 1 }];
    let place = 2;
    for (const group of [...s.elimination].reverse()) {
      const rest = group.filter((seat) => seat !== winner);
      for (const seat of rest) placements.push({ seat, place });
      if (rest.length) place += rest.length;
    }
    s.outcome = { reason: reason === 'defeated' ? 'win' : 'resign', placements };
    s.prompt = null;
    return true;
  }
  if (!s.alive[s.current]) {
    // The active player is out (free-for-all): their turn ends now.
    s.stack = [];
    s.prompt = null;
    s.combat = null;
    beginTurn(s, nextSeat(s, s.current));
    return true;
  }
  return false;
}

function beginTurn(s: UnmatchedState, seat: number) {
  s.current = seat;
  s.actionsLeft = 2;
  s.actionNo = 0;
  s.turnNo += 1;
  log(s, { t: 'turn', seat, n: s.turnNo });
  push(s, { kind: 'turn', seat });
}

const HANDLERS: Record<string, Handler> = {
  /** Heroes are chosen in turn order; no duplicates. */
  pick(s, f, rng) {
    const a = takeAns(f);
    if (a?.type === 'pickHero') {
      const seat = s.order[f.i ?? 0]!;
      assignHero(s, seat, a.hero, rng);
      log(s, { t: 'pick', seat, hero: a.hero });
      f.i = (f.i ?? 0) + 1;
    }
    if ((f.i ?? 0) < s.order.length) return ask(s, { kind: 'pickHero', seat: s.order[f.i ?? 0]!, why: 'pickHero' });
    return 'done';
  },
  /** Setup step 5–6: hero on its numbered start space, sidekicks in the same zone, Alice picks a size. */
  deploy(s, f) {
    const seat = f.seat;
    const a = takeAns(f);
    if (f.step === 0) {
      const start = boardOf(s).starts[s.order.indexOf(seat)]!;
      moveFighter(s, heroOf(s, seat)!.id, start, true);
      f.step = 1;
      const sidekicks = s.fighters.filter((x) => x.seat === seat && !x.hero);
      for (const k of sidekicks.reverse()) push(s, { kind: 'place', seat, fighter: k.id, where: 'deploy', ref: heroOf(s, seat)!.id, why: 'deploy' });
      return 'cont';
    }
    if (f.step === 1) {
      if (s.heroes[seat] === 'invisible') {
        // Three fog tokens in separate empty spaces of his zone (like sidekicks).
        if (a?.type === 'choose') { s.fog.push(Number(a.ids[0])); log(s, { t: 'fog', token: s.fog.length - 1, to: Number(a.ids[0]) }); }
        if (s.fog.length < 3) {
          const board = boardOf(s);
          const im = heroOf(s, seat)!;
          const reserved = s.order.map((x, i) => (onBoard(heroOf(s, x)) ? -1 : board.starts[i]!));
          const free = emptySpaces(s).filter((i) => !s.fog.includes(i) && !reserved.includes(i));
          const inZone = free.filter((i) => shareZone(board, i, im.space!));
          const spaces = inZone.length ? inZone : free;
          if (spaces.length) return ask(s, { kind: 'space', seat, why: 'fogDeploy', spaces });
        }
        return 'done';
      }
      if (s.heroes[seat] !== 'alice') return 'done';
      if (a?.type === 'size') {
        s.size[seat] = a.size;
        log(s, { t: 'size', seat, size: a.size });
        return 'done';
      }
      return ask(s, { kind: 'size', seat, why: 'size' });
    }
    return 'done';
  },
  turn(s, f) {
    const seat = f.seat;
    if (f.step === 0) {
      f.step = 1;
      // Start-of-turn abilities (pushed in reverse: a vanished Invisible Man returns first).
      const hero = heroOf(s, seat);
      const h = s.heroes[seat];
      if (h === 'jekyll' && onBoard(hero)) push(s, { kind: 'serum', seat });
      if (h === 'dracula' && onBoard(hero)) {
        const targets = s.fighters.filter((x) => onBoard(x) && isAdjacent(boardOf(s), x.space!, hero.space)).map((x) => x.id);
        if (targets.length) push(s, { kind: 'pickDamage', seat, fighters: targets, n: 1, may: true, drawAfter: true, why: 'bloodthirsty' });
      }
      // Medusa: at the start of your turn you may deal 1 damage to an opposing fighter in Medusa's zone.
      if (h === 'medusa' && onBoard(hero)) {
        const targets = s.fighters.filter((x) => x.seat !== seat && onBoard(x) && shareZone(boardOf(s), x.space!, hero.space)).map((x) => x.id);
        if (targets.length) push(s, { kind: 'pickDamage', seat, fighters: targets, n: 1, may: true, why: 'medusaGaze' });
      }
      if (s.vanished[seat] && hero && hero.hp > 0) {
        s.vanished[seat] = false;
        push(s, { kind: 'place', seat, fighter: hero.id, where: 'any', why: 'vanishReturn' });
      }
      return 'cont';
    }
    if (f.step === 1) {
      // "Started this turn in a space" is measured after start-of-turn effects (a returning Invisible Man).
      if (s.actionNo === 0) {
        s.turnStart = Object.fromEntries(s.fighters.map((x) => [x.id, x.space]));
        s.turnStartFog = s.fog.slice();
      }
      // Each chosen action runs as a child frame; we come back here after it to check the end and ask again.
      if (endCheck(s)) return 'cont';
      if (s.actionsLeft > 0) return ask(s, { kind: 'action', seat, why: 'action' });
      f.step = 2;
      return 'cont';
    }
    if (f.step === 2) {
      f.step = 3;
      const over = s.hands[seat]!.length - HAND_LIMIT;
      if (over > 0) push(s, { kind: 'discard', seat, n: over, why: 'handLimit' });
      return 'cont';
    }
    s.tookTurn[seat] = true;
    s.stack.splice(s.stack.indexOf(f), 1);
    beginTurn(s, nextSeat(s, seat));
    return 'cont';
  },
  /** The first real turn starts after picks and deployment. */
  firstTurn(s, f) {
    s.stack.splice(s.stack.indexOf(f), 1);
    beginTurn(s, f.seat);
    return 'cont';
  },
  maneuver(s, f) {
    const seat = f.seat;
    const a = takeAns(f);
    if (f.step === 0) {
      draw(s, seat, 1);
      f.step = 1;
      f.boost = 0;
      if (!s.hands[seat]!.length) { log(s, { t: 'maneuver', seat, boost: null }); f.step = 2; return 'cont'; }
      return ask(s, { kind: 'boost', seat, why: 'boostMove', may: true, cards: s.hands[seat]!.slice(), min: 0, max: 1 });
    }
    if (f.step === 1) {
      const card = a?.type === 'choose' ? a.ids[0] : undefined;
      if (card) { f.boost = cardDef(s, card).boost; discardCard(s, seat, card, 'boost'); }
      log(s, { t: 'maneuver', seat, boost: card ? cardSlug(card) : null });
      f.step = 2;
    }
    if (f.step === 2) {
      f.step = 3;
      // Sinbad: +1 movement for each VOYAGE card in the discard pile.
      const voyages = s.heroes[seat] === 'sinbad' ? s.discards[seat]!.filter((c) => isVoyage(cardSlug(c))).length : 0;
      const max = HEROES[s.heroes[seat]!]!.move + (f.boost ?? 0) + voyages;
      push(s, { kind: 'move', seat, fighters: ownFighters(s, seat).map((x) => x.id), max, why: 'maneuver' });
      return 'cont';
    }
    // The Serum: while Mr. Hyde, take 1 damage after you maneuver.
    if (s.heroes[seat] === 'jekyll' && s.form[seat] === 'hyde') damage(s, heroId(s, seat), 1);
    return 'done';
  },
  /** Jekyll & Hyde: at the start of your turn you may transform. */
  serum(s, f) {
    const a = takeAns(f);
    if (a?.type === 'choose') {
      if (a.ids[0] === 'switch') setForm(s, f.seat, s.form[f.seat] === 'hyde' ? 'jekyll' : 'hyde');
      return 'done';
    }
    return ask(s, { kind: 'option', seat: f.seat, why: 'serum', options: ['stay', 'switch'], min: 1, max: 1 });
  },
  scheme(s, f) {
    if (f.step === 0) {
      f.step = 1;
      push(s, { kind: cardSlug(f.card!), seat: f.seat, card: f.card, fighter: f.fighter });
      return 'cont';
    }
    s.discards[f.seat]!.push(f.card!);
    return 'done';
  },
  combat(s, f) {
    const c = s.combat!;
    const a = takeAns(f);
    if (f.step === 0) {
      if (a?.type === 'defend') {
        c.defended = true;
        if (a.card) {
          c.dCard = a.card;
          s.hands[c.dSeat]!.splice(s.hands[c.dSeat]!.indexOf(a.card), 1);
          if (cardSlug(a.card) === 'elementary') { c.dFaceUp = true; c.predict = a.predict ?? null; log(s, { t: 'named', seat: c.dSeat, of: c.aSeat, value: c.predict ?? 0 }); }
        }
        f.step = 1;
      } else if (!s.hands[c.dSeat]!.length || !s.alive[c.dSeat]) {
        // Only an empty hand (public) skips the choice, so the attacker never learns the defender had no usable card.
        c.defended = true;
        f.step = 1;
      } else {
        return ask(s, { kind: 'defend', seat: c.dSeat, why: 'defend', fighter: c.defender });
      }
    }
    if (f.step === 1) {
      // Reveal, then IMMEDIATELY effects — the defender's resolve first.
      c.revealed = true;
      const d = c.dCard && !c.cancelD ? cardSlug(c.dCard) : null;
      if (d === 'do-my-bidding') {
        // Return the attack card; the defender looks at the attacker's hand and chooses the card to play.
        if (a?.type === 'choose') {
          const hand = s.hands[c.aSeat]!;
          hand.splice(hand.indexOf(a.ids[0]!), 1);
          c.aCard = a.ids[0]!;
          log(s, { t: 'bidding', seat: c.dSeat, card: cardSlug(c.aCard) });
        } else {
          s.hands[c.aSeat]!.push(c.aCard);
          const att = fighter(s, c.attacker)!;
          const cards = s.hands[c.aSeat]!.filter((x) => ['attack', 'versatile'].includes(cardDef(s, x).type) && usable(s, att, x));
          return ask(s, { kind: 'cards', seat: c.dSeat, why: 'bidding', cards, secret: true, min: 1, max: 1 });
        }
      }
      if ((d === 'feint') && cancellable(s, c.aCard)) c.cancelA = true;
      if (d === 'impossible-to-see') c.aZero = true;
      // Then the attacker's IMMEDIATELY effects (unless cancelled).
      const at = !c.cancelA ? cardSlug(c.aCard) : null;
      if ((at === 'feint' || at === 'surprise-attack') && c.dCard && cancellable(s, c.dCard)) c.cancelD = true;
      if (at === 'impossible-to-see') c.dZero = true;
      c.aBase = cardDef(s, c.aCard).value ?? 0;
      c.dBase = c.dCard ? cardDef(s, c.dCard).value ?? 0 : 0;
      f.step = 2;
    }
    if (f.step === 2) {
      f.step = 3;
      if (c.dCard && !c.cancelD) duringEffect(s, 'd');
      return 'cont';
    }
    if (f.step === 3) {
      f.step = 4;
      if (!c.cancelA) duringEffect(s, 'a');
      return 'cont';
    }
    if (f.step === 4) {
      const att = fighter(s, c.attacker)!;
      const def = fighter(s, c.defender)!;
      // Arthur's boost is lost only if an effect on the attack card was actually cancelled.
      c.boostVoid = !!c.boost && c.cancelA && cardDef(s, c.aCard).textFa !== '';
      let aVal = c.aBase + c.aAdd + (c.boost && !c.boostVoid ? cardDef(s, c.boost).boost : 0);
      if (att.hero && s.heroes[c.aSeat] === 'alice' && s.size[c.aSeat] === 'big') aVal += 2;
      let dVal = c.dCard ? c.dBase + c.dAdd : 0;
      if (c.dCard && def.hero && s.heroes[c.dSeat] === 'alice' && s.size[c.dSeat] === 'small') dVal += 1;
      if (c.dCard && def.hero && s.heroes[c.dSeat] === 'invisible' && onFog(s, def)) dVal += 1;
      if (c.aZero) aVal = 0;
      if (c.dZero) dVal = 0;
      c.aVal = aVal;
      c.dVal = dVal;
      const dmg = c.shield === c.defender ? 0 : Math.max(0, aVal - dVal);
      c.damage = dmg;
      c.won = dmg >= 1 ? 'a' : 'd';
      log(s, { t: 'reveal', aCard: cardSlug(c.aCard), dCard: c.dCard ? cardSlug(c.dCard) : null, boost: c.boost ? cardSlug(c.boost) : null, aVal, dVal, damage: dmg, cancelA: c.cancelA, cancelD: c.cancelD });
      damage(s, c.defender, dmg);
      f.step = 5;
      // AFTER COMBAT: the defender's effect resolves first (pushed last).
      if (!c.cancelA && AFTER.has(cardSlug(c.aCard))) push(s, { kind: cardSlug(c.aCard), seat: c.aSeat, card: c.aCard, fighter: c.attacker, side: 'a' });
      if (c.dCard && !c.cancelD && AFTER.has(cardSlug(c.dCard))) push(s, { kind: cardSlug(c.dCard), seat: c.dSeat, card: c.dCard, fighter: c.defender, side: 'd' });
      return 'cont';
    }
    // Cleanup: played cards go to their discard piles.
    s.discards[c.aSeat]!.push(c.aCard);
    if (c.boost) s.discards[c.aSeat]!.push(c.boost);
    if (c.dCard) s.discards[c.dSeat]!.push(c.dCard);
    s.combat = null;
    return 'done';
  },
  /** "You may BOOST this attack" (Second Shot, Noble Sacrifice). */
  boostAttack(s, f) {
    const a = takeAns(f);
    if (a) {
      const card = a.type === 'choose' ? a.ids[0] : undefined;
      if (card && s.combat) { s.combat.aAdd += cardDef(s, card).boost; discardCard(s, f.seat, card, 'boost'); }
      return 'done';
    }
    if (!s.hands[f.seat]!.length) return 'done';
    return ask(s, { kind: 'boost', seat: f.seat, why: 'boostAttack', may: true, cards: s.hands[f.seat]!.slice(), min: 0, max: 1 });
  },
  /** Move fighters (each listed fighter once, or just one of them when `single`). Moving is always "up to". */
  move(s, f) {
    const a = takeAns(f);
    f.moved ??= [];
    if (a?.type === 'done') return 'done';
    if (a?.type === 'move') {
      moveFighter(s, a.fighter, a.to);
      f.moved.push(a.fighter);
      if (f.single) return 'done';
    }
    const left = moveOptions(s, f);
    if (!left.length) return 'done';
    return ask(s, { kind: 'move', seat: f.seat, why: f.why ?? 'move', fighters: left.map((o) => o.fighter), may: true });
  },
  place(s, f) {
    const a = takeAns(f);
    const fi = fighter(s, f.fighter);
    if (!fi) return 'done';
    if (a?.type === 'done') return 'done';
    if (a?.type === 'choose') {
      if (fi.hp === 0) fi.hp = fi.maxHp; // a defeated sidekick returns (Winged Frenzy, Baptism of Blood)
      moveFighter(s, fi.id, Number(a.ids[0]), true);
      return 'done';
    }
    const spaces = placeOptions(s, f);
    if (!spaces.length) return 'done';
    return ask(s, { kind: 'place', seat: f.seat, why: f.why ?? 'place', fighter: fi.id, spaces, may: !!f.may });
  },
  /** Choose one fighter among candidates and deal n damage. */
  pickDamage(s, f) {
    const a = takeAns(f);
    if (a?.type === 'done') return 'done';
    if (a?.type === 'choose') {
      const t = fighter(s, a.ids[0]);
      const before = t?.hp ?? 0;
      damage(s, a.ids[0]!, f.n ?? 0);
      if (f.drawAfter && t && t.hp < before) draw(s, f.seat, 1);
      return 'done';
    }
    const cands = (f.fighters ?? []).filter((x) => onBoard(fighter(s, x)));
    if (!cands.length) return 'done';
    return ask(s, { kind: 'fighter', seat: f.seat, why: f.why ?? 'damage', fighters: cands, may: !!f.may });
  },
  /** The seat discards n cards of its choice (hand limit, "your opponent discards 1 card"). */
  discard(s, f) {
    const a = takeAns(f);
    const hand = s.hands[f.seat]!;
    const n = Math.min(f.n ?? 1, hand.length);
    if (n === 0) return 'done';
    if (a?.type === 'choose') { for (const c of a.ids) discardCard(s, f.seat, c, f.why ?? 'effect'); return 'done'; }
    if (hand.length === n) { for (const c of hand.slice()) discardCard(s, f.seat, c, f.why ?? 'effect'); return 'done'; }
    return ask(s, { kind: 'cards', seat: f.seat, why: f.why ?? 'discard', cards: hand.slice(), min: n, max: n });
  }
};

/** During-combat value effects for one side (cards whose effects were not cancelled). */
function duringEffect(s: UnmatchedState, side: 'a' | 'd') {
  const c = s.combat!;
  const card = side === 'a' ? c.aCard : c.dCard!;
  const seat = side === 'a' ? c.aSeat : c.dSeat;
  const own = fighter(s, side === 'a' ? c.attacker : c.defender)!;
  const opp = fighter(s, side === 'a' ? c.defender : c.attacker)!;
  const slug = cardSlug(card);
  const set = (v: number) => { if (side === 'a') c.aBase = v; else c.dBase = v; };
  const add = (v: number) => { if (side === 'a') c.aAdd += v; else c.dAdd += v; };
  if (slug === 'momentous-shift' && s.turnStart[own.id] !== own.space) set(5);
  else if (slug === 'claws-that-catch' && opp.hero) set(5);
  else if (isVoyage(slug)) add(s.discards[seat]!.filter((x) => isVoyage(cardSlug(x))).length);
  else if (slug === 'bewilderment') c.shield = own.id;
  else if (slug === 'manxome-foe') {
    const top = s.decks[seat]!.pop();
    if (top) { s.discards[seat]!.push(top); log(s, { t: 'discard', seat, card: cardSlug(top), why: 'deckTop' }); add(cardDef(s, top).boost); }
  } else if ((slug === 'second-shot' || slug === 'noble-sacrifice') && side === 'a') push(s, { kind: 'boostAttack', seat });
  // Cobble & Fog
  else if (slug === 'elementary' && side === 'd') {
    const oppCard = c.aCard;
    if (c.predict !== null && c.predict === (cardDef(s, oppCard).value ?? 0)) {
      if (cancellable(s, oppCard)) c.cancelA = true;
      c.aZero = true; // the attack value is ignored either way
    }
  } else if (slug === 'deduce-strategy') push(s, { kind: 'deduce', seat, side });
  else if (slug === 'look-into-my-eyes' && side === 'd') add(cardDef(s, c.aCard).boost);
  else if (slug === 'feeding-frenzy') {
    const board = boardOf(s);
    add(s.fighters.filter((x) => x.seat === seat && !x.hero && onBoard(x) && onBoard(opp) && shareZone(board, x.space!, opp.space)).length);
  } else if (slug === 'ambush') push(s, { kind: 'ambush', seat, side });
  else if (slug === 'beastform') push(s, { kind: 'pumpDiscard', seat, side, why: 'beastform', n: 1 });
  else if (slug === 'forever-hyde') push(s, { kind: 'pumpDiscard', seat, side, why: 'foreverHyde', n: 2 });
  else if (slug === 'duality-of-man') {
    if ((side === 'd' && s.form[seat] === 'jekyll') || (side === 'a' && s.form[seat] === 'hyde')) set(6);
  } else if (slug === 'emerge-from-mist') {
    if (s.turnStart[own.id] !== null && s.turnStart[own.id] !== undefined && s.turnStartFog.includes(s.turnStart[own.id]!)) set(5);
  }
}

const sideAdd = (c: Combat, side: 'a' | 'd', v: number) => { if (side === 'a') c.aAdd += v; else c.dAdd += v; };

/** During-combat effects that need a decision. */
const DURING: Record<string, Handler> = {
  /** Deduce Strategy: you may set the printed value of the opponent's card to its BOOST value. */
  deduce(s, f) {
    const c = s.combat!;
    const a = takeAns(f);
    const oppCard = f.side === 'a' ? c.dCard : c.aCard;
    if (!oppCard) return 'done';
    if (a?.type === 'choose') {
      if (a.ids[0] === 'apply') { const v = cardDef(s, oppCard).boost; if (f.side === 'a') c.dBase = v; else c.aBase = v; }
      return 'done';
    }
    return ask(s, { kind: 'option', seat: f.seat, why: 'deduce', options: ['apply', 'skip'], min: 1, max: 1 });
  },
  /** Ambush: the opponent discards a random card; add its BOOST value. */
  ambush(s, f, rng) {
    const c = s.combat!;
    const of = f.side === 'a' ? c.dSeat : c.aSeat;
    const hand = s.hands[of]!;
    if (hand.length) {
      const card = hand[rng.nextInt(hand.length)]!;
      discardCard(s, of, card, 'random');
      sideAdd(c, f.side!, cardDef(s, card).boost);
    }
    return 'done';
  },
  /** Beastform (+1 per card) / Forever Hyde (+2 per Dr. Jekyll card): discard any number of cards. */
  pumpDiscard(s, f) {
    const c = s.combat!;
    const a = takeAns(f);
    if (a?.type === 'choose') {
      for (const card of a.ids) discardCard(s, f.seat, card, 'effect');
      sideAdd(c, f.side!, a.ids.length * (f.n ?? 1));
      return 'done';
    }
    const cards = s.hands[f.seat]!.filter((x) => f.why !== 'foreverHyde' || cardDef(s, x).form === 'jekyll');
    if (!cards.length) return 'done';
    return ask(s, { kind: 'cards', seat: f.seat, why: f.why!, cards, min: 0, max: cards.length });
  }
};

/** Cards with an AFTER COMBAT effect (resolved through EFFECTS). */
const AFTER = new Set([
  'skirmish', 'the-aid-of-morgana', 'divine-intervention', 'the-holy-grail', 'bewilderment', 'aid-the-chosen-one', 'swift-strike', 'regroup',
  'dash', 'gaze-of-stone', 'hiss-and-slither', 'the-hounds-of-mighty-zeus', 'clutching-claws', 'snipe',
  'exploit', 'toil-and-danger', 'voyage-home', 'by-fortune-and-fate', 'voyage-to-the-island-that-was-a-whale', 'voyage-to-the-valley-of-the-giant-snakes',
  'voyage-to-the-creature-with-eyes-like-coals-of-fire', 'voyage-to-the-cannibals-with-the-root-of-madness', 'voyage-to-the-city-of-the-man-eating-apes',
  'voyage-to-the-city-of-the-king-of-serendib', 'commanding-impact', 'leap-away',
  'mad-as-a-hatter', 'looking-glass', 'snicker-snack', 'o-frabjous-day', 'the-other-side-of-the-mushroom', 'i-m-late-i-m-late', 'jaws-that-bite',
  'education-never-ends', 'study-methods', 'counterpunch', 'fixed-point-in-a-changing-age', 'the-game-is-afoot', 'thirst-for-sustenance',
  'distracted-triage', 'succumb-to-compulsion', 'madness-relents', 'recoiling-blow', 'with-haste', 'scientific-method',
  'covert-preparation', 'dreaming-of-revenge', 'confound', 'surprise-attack', 'slip-away', 'lurking', 'into-thin-air', 'coded-notes'
]);

// ---------- card effects (after-combat and schemes) ----------

const won = (s: UnmatchedState, f: Frame) => !!s.combat && s.combat.won === f.side;
const oppSeat = (s: UnmatchedState, f: Frame) => (f.side === 'a' ? s.combat!.dSeat : s.combat!.aSeat);
const oppFighter = (s: UnmatchedState, f: Frame) => (f.side === 'a' ? s.combat!.defender : s.combat!.attacker);
const heroId = (s: UnmatchedState, seat: number) => heroOf(s, seat)!.id;

/** Build a simple effect from a list of steps; each step may push frames and runs after the previous ones finish. */
const seq = (...steps: ((s: UnmatchedState, f: Frame, rng: EngineRng) => void)[]): Handler => (s, f, rng) => {
  if (f.step >= steps.length) return 'done';
  steps[f.step]!(s, f, rng);
  f.step += 1;
  return 'cont';
};
const drawN = (n: number) => seq((s, f) => draw(s, f.seat, n));
const moveOwn = (n: number, who: 'self' | 'hero' = 'self', why = 'effectMove') => (s: UnmatchedState, f: Frame) =>
  push(s, { kind: 'move', seat: f.seat, fighters: [who === 'hero' ? heroId(s, f.seat) : f.fighter!], max: n, why });
const moveEach = (n: number, filter: 'all' | 'sidekicks' = 'all', through = false) => (s: UnmatchedState, f: Frame) =>
  push(s, { kind: 'move', seat: f.seat, fighters: ownFighters(s, f.seat).filter((x) => filter === 'all' || !x.hero).map((x) => x.id), max: n, through, why: 'effectMove' });
const moveCombatant = (n: number) => (s: UnmatchedState, f: Frame) => {
  if (won(s, f)) push(s, { kind: 'move', seat: f.seat, fighters: [s.combat!.attacker, s.combat!.defender], max: n, single: true, why: 'combatantMove' });
};
const oppDiscards = (s: UnmatchedState, f: Frame) => push(s, { kind: 'discard', seat: oppSeat(s, f), n: 1, why: 'effect' });
const size = (s: UnmatchedState, f: Frame) => toggleSize(s, f.seat);

const EFFECTS: Record<string, Handler> = {
  // shared
  regroup: seq((s, f) => draw(s, f.seat, won(s, f) ? 2 : 1)),
  snipe: drawN(1),
  exploit: drawN(1),
  'commanding-impact': drawN(1),
  'voyage-to-the-city-of-the-king-of-serendib': drawN(1),
  'by-fortune-and-fate': drawN(2),
  'the-aid-of-morgana': drawN(2),
  'aid-the-chosen-one': seq((s, f) => { if (won(s, f)) draw(s, f.seat, 2); }),
  skirmish: seq(moveCombatant(2)),
  'leap-away': seq(moveCombatant(4)),
  dash: seq(moveOwn(3)),
  'swift-strike': seq(moveOwn(4)),
  // King Arthur
  'divine-intervention': seq(moveOwn(5, 'hero')),
  'the-holy-grail': seq((s, f) => {
    const arthur = heroOf(s, f.seat)!;
    if (onBoard(arthur) && arthur.hp <= 4) heal(s, arthur.id, 0, 8);
  }),
  bewilderment: seq((s, f) => push(s, { kind: 'place', seat: f.seat, fighter: f.fighter, where: 'any', may: true, why: 'bewilderment' })),
  'the-lady-of-the-lake': seq((s, f, rng) => {
    const seat = f.seat;
    const inDiscard = s.discards[seat]!.find((c) => cardSlug(c) === 'excalibur');
    if (inDiscard) {
      s.discards[seat]!.splice(s.discards[seat]!.indexOf(inDiscard), 1);
      s.hands[seat]!.push(inDiscard);
      log(s, { t: 'fetch', seat, card: 'excalibur' });
      return;
    }
    const inDeck = s.decks[seat]!.find((c) => cardSlug(c) === 'excalibur');
    if (inDeck) {
      s.decks[seat]!.splice(s.decks[seat]!.indexOf(inDeck), 1);
      s.hands[seat]!.push(inDeck);
      log(s, { t: 'fetch', seat, card: 'excalibur' });
    }
    s.decks[seat] = shuffle(s.decks[seat]!, rng); // the deck was searched
  }),
  prophecy(s, f) {
    const seat = f.seat;
    const a = takeAns(f);
    const deck = s.decks[seat]!;
    const top = deck.slice(-4).reverse(); // top card first
    if (!top.length) return 'done';
    if (a?.type === 'choose') {
      const keep = a.ids.slice(0, Math.min(2, top.length));
      const rest = [...a.ids.slice(keep.length).filter((x) => top.includes(x) && !keep.includes(x)), ...top.filter((x) => !a.ids.includes(x))];
      s.decks[seat] = [...deck.slice(0, deck.length - top.length), ...rest.reverse()];
      s.hands[seat]!.push(...keep);
      log(s, { t: 'draw', seat, n: keep.length });
      return 'done';
    }
    return ask(s, { kind: 'cards', seat, why: 'prophecy', cards: top, secret: true, min: Math.min(2, top.length), max: top.length });
  },
  'restless-spirits'(s, f) {
    const seat = f.seat;
    const a = takeAns(f);
    const merlin = fighter(s, f.fighter);
    const board = boardOf(s);
    if (f.step === 0) {
      if (a?.type === 'choose') { f.space = Number(a.ids[0]); f.step = 1; }
      else {
        if (!onBoard(merlin)) return 'done';
        const spaces = board.spaces.map((_, i) => i).filter((i) => shareZone(board, i, merlin.space));
        return ask(s, { kind: 'space', seat, why: 'spiritsFirst', spaces });
      }
    }
    if (f.step === 1) {
      if (a?.type === 'choose') {
        let defeated = 0;
        for (const sp of [f.space!, Number(a.ids[0])]) {
          const o = occupant(s, sp);
          if (o && o.seat !== seat) { damage(s, o.id, 2); if (o.hp === 0) defeated++; }
        }
        if (defeated) draw(s, seat, 1);
        return 'done';
      }
      return ask(s, { kind: 'space', seat, why: 'spiritsSecond', spaces: adjacency(board)[f.space!]!.slice() });
    }
    return 'done';
  },
  'command-the-storms': seq((s, f) => push(s, { kind: 'move', seat: f.seat, fighters: s.fighters.filter((x) => onBoard(x)).map((x) => x.id), max: 3, why: 'storms' })),
  // Medusa
  'gaze-of-stone': seq((s, f) => { if (won(s, f)) damage(s, oppFighter(s, f), 8); }),
  'a-momentary-glance': seq((s, f) => {
    const medusa = fighter(s, f.fighter);
    if (!onBoard(medusa)) return;
    const cands = s.fighters.filter((x) => onBoard(x) && shareZone(boardOf(s), x.space!, medusa.space)).map((x) => x.id);
    push(s, { kind: 'pickDamage', seat: f.seat, fighters: cands, n: 2, why: 'glance' });
  }),
  'hiss-and-slither': seq(oppDiscards),
  'clutching-claws': seq(oppDiscards),
  'the-hounds-of-mighty-zeus': seq(moveEach(3, 'sidekicks')),
  'winged-frenzy': seq(moveEach(3, 'all', true), (s, f) => {
    const harpy = s.fighters.find((x) => x.seat === f.seat && !x.hero && x.hp === 0);
    if (harpy && onBoard(heroOf(s, f.seat))) push(s, { kind: 'place', seat: f.seat, fighter: harpy.id, where: 'zone', ref: heroId(s, f.seat), why: 'harpyReturn' });
  }),
  // Sinbad
  'toil-and-danger': seq(moveOwn(3, 'hero')),
  'riches-beyond-compare': drawN(3),
  'voyage-home': seq((s, f) => {
    const seat = f.seat;
    const back = s.discards[seat]!.filter((c) => isVoyage(cardSlug(c)));
    s.discards[seat] = s.discards[seat]!.filter((c) => !back.includes(c));
    s.hands[seat]!.push(...back);
    for (const c of back) log(s, { t: 'fetch', seat, card: cardSlug(c) });
  }),
  'voyage-to-the-island-that-was-a-whale': seq((s, f) => heal(s, heroId(s, f.seat), 2)),
  'voyage-to-the-valley-of-the-giant-snakes': seq((s, f) => {
    const of = oppSeat(s, f);
    s.reveal = { to: f.seat, seat: of, cards: s.hands[of]!.slice(), seq: s.seq + 1 };
    log(s, { t: 'sawHand', seat: f.seat, of });
  }),
  'voyage-to-the-creature-with-eyes-like-coals-of-fire': seq((s, f, rng) => {
    const of = oppSeat(s, f);
    const hand = s.hands[of]!;
    if (hand.length) discardCard(s, of, hand[rng.nextInt(hand.length)]!, 'random');
  }),
  'voyage-to-the-cannibals-with-the-root-of-madness': seq(moveOwn(2, 'hero')),
  'voyage-to-the-city-of-the-man-eating-apes': seq((s, f) => damage(s, oppFighter(s, f), 2)),
  // Alice
  'mad-as-a-hatter': seq(moveEach(2), size),
  'o-frabjous-day': seq(size),
  'the-other-side-of-the-mushroom': seq(moveOwn(3, 'hero'), size),
  'i-m-late-i-m-late': seq(moveOwn(5, 'hero'), size),
  'eat-me': seq(moveOwn(3, 'hero'), size),
  'drink-me': seq((s, f) => draw(s, f.seat, 2), size),
  'jaws-that-bite': seq((s, f) => {
    const jw = fighter(s, f.fighter);
    if (!onBoard(jw)) return;
    const cands = s.fighters.filter((x) => onBoard(x) && isAdjacent(boardOf(s), x.space!, jw.space)).map((x) => x.id);
    push(s, { kind: 'pickDamage', seat: f.seat, fighters: cands, n: 2, why: 'jaws' });
  }),
  'snicker-snack'(s, f) {
    const a = takeAns(f);
    if (!won(s, f)) return 'done';
    const of = oppSeat(s, f);
    if (a?.type === 'choose') { discardCard(s, of, a.ids[0]!, 'effect'); log(s, { t: 'sawHand', seat: f.seat, of }); return 'done'; }
    if (!s.hands[of]!.length) return 'done';
    return ask(s, { kind: 'cards', seat: f.seat, why: 'snicker', cards: s.hands[of]!.slice(), secret: true, min: 1, max: 1 });
  },
  'looking-glass'(s, f) {
    const a = takeAns(f);
    const alice = heroId(s, f.seat);
    if (f.step === 0) {
      if (a?.type === 'choose') {
        f.picks = a.ids;
        f.step = 1;
        // Resolve in the order chosen; pushed in reverse so the first choice runs first.
        for (const p of [...a.ids].reverse()) {
          if (p === 'draw') push(s, { kind: 'lgDraw', seat: f.seat });
          if (p === 'heal') push(s, { kind: 'lgHeal', seat: f.seat });
          if (p === 'place') push(s, { kind: 'place', seat: f.seat, fighter: alice, where: 'anyOther', why: 'lookingGlass' });
        }
        return 'cont';
      }
      return ask(s, { kind: 'option', seat: f.seat, why: 'lookingGlass', options: ['draw', 'heal', 'place'], min: 2, max: 2 });
    }
    return 'done';
  },
  lgDraw: drawN(2),
  lgHeal: seq((s, f) => heal(s, heroId(s, f.seat), 3)),

  // ---------- Cobble & Fog: Sherlock Holmes ----------
  'education-never-ends': seq((s, f) => { if (won(s, f)) draw(s, oppSeat(s, f), 1); else draw(s, f.seat, 2); }),
  'study-methods': seq((s, f) => { if (won(s, f)) showHand(s, oppSeat(s, f), f.seat); }),
  counterpunch: seq((s, f) => {
    const holmes = fighter(s, f.fighter);
    const opp = fighter(s, oppFighter(s, f));
    if (onBoard(holmes) && onBoard(opp) && isAdjacent(boardOf(s), holmes.space, opp.space)) damage(s, opp.id, 2);
  }),
  'fixed-point-in-a-changing-age': seq((s, f) => {
    const watson = fighter(s, f.fighter);
    const holmes = heroOf(s, f.seat);
    if (onBoard(watson) && onBoard(holmes) && isAdjacent(boardOf(s), watson.space, holmes.space)) { heal(s, holmes.id, 1); heal(s, watson.id, 1); }
  }),
  'the-game-is-afoot': seq(moveOwn(3, 'hero')),
  'confirm-suspicion'(s, f) {
    const a = takeAns(f);
    if (f.step === 0) return chooseOpponent(s, f, a);
    if (f.step === 1) {
      if (a?.type === 'choose') { f.value = Number(a.ids[0]); f.step = 2; log(s, { t: 'named', seat: f.seat, of: f.opp!, value: f.value }); return 'cont'; }
      return ask(s, { kind: 'option', seat: f.seat, why: 'nameValue', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], min: 1, max: 1 });
    }
    if (f.step === 2) {
      const of = f.opp!;
      const matching = s.hands[of]!.filter((x) => { const d = cardDef(s, x); return d.type !== 'scheme' && d.value === f.value; });
      if (a?.type === 'choose') {
        const card = a.ids[0]!;
        discardCard(s, of, card, 'effect');
        damage(s, heroId(s, of), cardDef(s, card).boost);
        return 'done';
      }
      if (!matching.length) { showHand(s, of, f.seat); return 'done'; }
      return ask(s, { kind: 'cards', seat: of, why: 'confirm', cards: matching, min: 1, max: 1 });
    }
    return 'done';
  },
  'eliminate-the-impossible'(s, f) {
    const a = takeAns(f);
    if (f.step === 0) return chooseOpponent(s, f, a);
    const of = f.opp!;
    if (a?.type === 'choose') { discardCard(s, of, a.ids[0]!, 'effect'); log(s, { t: 'sawHand', seat: f.seat, of }); return 'done'; }
    if (!s.hands[of]!.length) return 'done';
    return ask(s, { kind: 'cards', seat: f.seat, why: 'eliminate', cards: s.hands[of]!.slice(), secret: true, min: 1, max: 1 });
  },
  'master-of-disguise'(s, f) {
    const a = takeAns(f);
    if (f.step === 0) return chooseOpponent(s, f, a);
    const holmes = heroOf(s, f.seat);
    const other = heroOf(s, f.opp!);
    if (onBoard(holmes) && onBoard(other)) {
      const [x, y] = [holmes.space, other.space];
      holmes.space = y;
      other.space = x;
      log(s, { t: 'swap', a: holmes.id, b: other.id });
      damage(s, other.id, 1);
    }
    return 'done';
  },
  'administer-aid': seq(
    (s, f) => push(s, { kind: 'place', seat: f.seat, fighter: f.fighter, where: 'adjacent', ref: heroId(s, f.seat), why: 'administerAid' }),
    (s, f) => { heal(s, heroId(s, f.seat), 1); draw(s, f.seat, 1); }
  ),

  // ---------- Dracula ----------
  mistform: seq((s, f) => {
    push(s, { kind: 'place', seat: f.seat, fighter: heroId(s, f.seat), where: 'anyOther', why: 'mistform' });
    s.actionsLeft += 1;
    log(s, { t: 'extraAction', seat: f.seat });
  }),
  'prey-upon': seq((s, f) => {
    const drac = heroOf(s, f.seat);
    if (!onBoard(drac)) return;
    let dealt = 0;
    for (const x of s.fighters.filter((o) => o.seat !== f.seat && onBoard(o) && isAdjacent(boardOf(s), o.space!, drac.space))) {
      const before = x.hp;
      damage(s, x.id, 1);
      dealt += before - x.hp;
    }
    heal(s, drac.id, dealt);
  }),
  'baptism-of-blood': seq((s, f) => {
    heal(s, heroId(s, f.seat), 2);
    const sister = s.fighters.find((x) => x.seat === f.seat && !x.hero && x.hp === 0);
    if (sister && onBoard(heroOf(s, f.seat))) push(s, { kind: 'place', seat: f.seat, fighter: sister.id, where: 'zone', ref: heroId(s, f.seat), why: 'sisterReturn' });
  }),
  'thirst-for-sustenance': seq((s, f) => {
    if (won(s, f) && onBoard(heroOf(s, f.seat))) push(s, { kind: 'place', seat: f.seat, fighter: heroId(s, f.seat), where: 'adjacent', ref: oppFighter(s, f), why: 'thirst' });
  }),
  'ravening-seduction'(s, f) {
    const a = takeAns(f);
    if (f.step === 0) {
      if (a?.type === 'choose') {
        f.ref = a.ids[0]!;
        f.step = 1;
        push(s, { kind: 'move', seat: f.seat, fighters: [f.ref], max: 2, single: true, why: 'seduction' });
        return 'cont';
      }
      const cands = s.fighters.filter((x) => onBoard(x)).map((x) => x.id);
      return ask(s, { kind: 'fighter', seat: f.seat, why: 'seduction', fighters: cands, may: false });
    }
    const target = fighter(s, f.ref);
    if (onBoard(target)) {
      const sisters = s.fighters.filter((x) => x.seat === f.seat && !x.hero && x.id !== target.id && onBoard(x) && isAdjacent(boardOf(s), x.space!, target.space)).length;
      damage(s, target.id, sisters);
    }
    return 'done';
  },

  // ---------- Jekyll & Hyde ----------
  'distracted-triage': seq((s, f) => { if (won(s, f)) heal(s, heroId(s, f.seat), 2); }),
  'succumb-to-compulsion': seq(moveOwn(2, 'hero'), (s, f) => setForm(s, f.seat, 'hyde')),
  'madness-relents': seq((s, f) => setForm(s, f.seat, 'jekyll')),
  'recoiling-blow': seq(
    (s, f) => push(s, { kind: 'place', seat: f.seat, fighter: heroId(s, f.seat), where: 'zone', ref: heroId(s, f.seat), may: true, why: 'hydeZone' }),
    (s, f) => setForm(s, f.seat, 'jekyll')
  ),
  'with-haste': seq(moveOwn(4, 'hero')),
  'scientific-method': seq((s, f) => { const n = s.combat?.damage ?? 0; if (n > 0) draw(s, f.seat, n); }),
  'calming-research'(s, f) {
    const seat = f.seat;
    const a = takeAns(f);
    if (f.step === 0) { heal(s, heroId(s, seat), 2); f.step = 1; }
    const deck = s.decks[seat]!;
    const top = deck.slice(-3).reverse();
    if (!top.length) return 'done';
    if (a?.type === 'choose') {
      // First pick is kept; the others go to the bottom in the order picked (unpicked ones after them).
      const keep = a.ids[0]!;
      const rest = [...a.ids.slice(1), ...top.filter((x) => !a.ids.includes(x))];
      s.decks[seat] = [...rest.reverse(), ...deck.slice(0, deck.length - top.length)];
      s.hands[seat]!.push(keep);
      log(s, { t: 'draw', seat, n: 1 });
      return 'done';
    }
    return ask(s, { kind: 'cards', seat, why: 'calming', cards: top, secret: true, min: 1, max: top.length });
  },
  'pure-evil': seq(
    (s, f) => push(s, { kind: 'place', seat: f.seat, fighter: heroId(s, f.seat), where: 'zone', ref: heroId(s, f.seat), may: true, why: 'hydeZone' }),
    (s, f) => {
      const hyde = heroOf(s, f.seat);
      if (!onBoard(hyde)) return;
      for (const x of s.fighters.filter((o) => o.id !== hyde.id && onBoard(o) && isAdjacent(boardOf(s), o.space!, hyde.space))) damage(s, x.id, 2);
    }
  ),
  'strange-case'(s, f) {
    const a = takeAns(f);
    const hyde = heroOf(s, f.seat);
    if (f.step === 0) {
      const top = s.decks[f.seat]!.pop();
      if (!top) return 'done';
      log(s, { t: 'revealTop', seat: f.seat, card: cardSlug(top) });
      s.hands[f.seat]!.push(top);
      f.n = cardDef(s, top).boost;
      f.step = 1;
    }
    if (a?.type === 'choose') { damage(s, a.ids[0]!, f.n ?? 0); return 'done'; }
    if (!onBoard(hyde) || !f.n) return 'done';
    const cands = s.fighters.filter((x) => x.id !== hyde.id && onBoard(x) && isAdjacent(boardOf(s), x.space!, hyde.space)).map((x) => x.id);
    if (!cands.length) return 'done';
    return ask(s, { kind: 'fighter', seat: f.seat, why: 'strangeCase', fighters: cands, may: false });
  },

  // ---------- Invisible Man ----------
  'covert-preparation': seq(
    (s, f) => { draw(s, f.seat, 1); push(s, { kind: 'fogMove', seat: f.seat, n: 2, dest: 'steps', may: true, why: 'fogMove' }); },
    (s, f) => push(s, { kind: 'fogMove', seat: opponentOf(s, f), n: 2, dest: 'steps', may: true, exclude: s.lastFog ?? -1, why: 'fogMoveOpp' })
  ),
  'dreaming-of-revenge': seq((s, f) => {
    if (!onFog(s, heroOf(s, f.seat))) return;
    for (const x of s.fighters.filter((o) => o.seat !== f.seat && onBoard(o) && s.fog.includes(o.space!))) damage(s, x.id, 1);
  }),
  confound(s, f) {
    const a = takeAns(f);
    const of = oppSeat(s, f);
    if (f.step === 0) {
      if (a?.type === 'choose') {
        f.step = 1;
        if (a.ids.length) { discardCard(s, of, a.ids[0]!, 'effect'); return 'done'; }
        // Not discarded: you may move each fog token to any other space.
        for (const t of [2, 1, 0]) if (t < s.fog.length) push(s, { kind: 'fogMove', seat: f.seat, tokens: [t], dest: 'anyOther', may: true, why: 'confound' });
        return 'cont';
      }
      if (!s.hands[of]!.length) { f.ans = { type: 'choose', ids: [] }; return 'cont'; }
      return ask(s, { kind: 'cards', seat: of, why: 'confound', cards: s.hands[of]!.slice(), min: 0, max: 1 });
    }
    return 'done';
  },
  'surprise-attack': seq((s, f) => {
    const im = heroOf(s, f.seat);
    if (onFog(s, im)) push(s, { kind: 'fogMove', seat: f.seat, tokens: [s.fog.indexOf(im!.space!)], dest: 'anyOther', why: 'surpriseFog' });
  }),
  'slip-away': seq(
    (s, f) => { if (onBoard(heroOf(s, f.seat)) && s.fog.length) push(s, { kind: 'fogMove', seat: f.seat, dest: 'noFighter', why: 'slipAway' }); },
    (s, f) => {
      const im = heroOf(s, f.seat);
      if (s.lastFog !== null && onBoard(im) && !occupant(s, s.fog[s.lastFog]!)) moveFighter(s, im.id, s.fog[s.lastFog]!, true);
    }
  ),
  lurking(s, f) {
    const a = takeAns(f);
    if (f.step === 0) { draw(s, f.seat, 1); f.step = 1; }
    if (f.step === 1) {
      const im = heroOf(s, f.seat);
      if (a?.type === 'choose') {
        f.step = 2;
        if (a.ids[0] === 'toFog') push(s, { kind: 'place', seat: f.seat, fighter: im!.id, where: 'fog', why: 'lurking' });
        else push(s, { kind: 'fogMove', seat: f.seat, n: 3, dest: 'steps', may: true, why: 'fogMove' });
        return 'cont';
      }
      const options = [...(onBoard(im) && s.fog.some((x) => !occupant(s, x)) ? ['toFog'] : []), ...(s.fog.length ? ['fogMove'] : [])];
      if (!options.length) return 'done';
      return ask(s, { kind: 'option', seat: f.seat, why: 'lurking', options, min: 1, max: 1 });
    }
    return 'done';
  },
  'into-thin-air': seq(moveOwn(1, 'hero'), (s, f) => push(s, { kind: 'fogMove', seat: opponentOf(s, f), n: 3, dest: 'steps', may: true, why: 'fogMoveOpp' })),
  'coded-notes'(s, f) {
    const a = takeAns(f);
    if (f.step === 0) { draw(s, f.seat, 3); f.step = 1; }
    const hand = s.hands[f.seat]!;
    if (a?.type === 'choose') {
      // First pick ends on top.
      for (const c of a.ids) hand.splice(hand.indexOf(c), 1);
      s.decks[f.seat]!.push(...[...a.ids].reverse());
      return 'done';
    }
    const n = Math.min(2, hand.length);
    if (!n) return 'done';
    return ask(s, { kind: 'cards', seat: f.seat, why: 'codedNotes', cards: hand.slice(), min: n, max: n });
  },
  'reign-of-terror': seq((s, f) => {
    if (!onFog(s, heroOf(s, f.seat))) return;
    const cands = s.fighters.filter((x) => x.seat !== f.seat && onBoard(x)).map((x) => x.id);
    push(s, { kind: 'pickDamage', seat: f.seat, fighters: cands, n: 2, why: 'reign' });
  }),
  vanish: seq((s, f) => {
    const im = heroOf(s, f.seat)!;
    heal(s, im.id, 1);
    if (!onBoard(im)) return;
    (im as Fighter).space = null;
    s.vanished[f.seat] = true;
    log(s, { t: 'vanish', seat: f.seat });
    if (s.actionNo === 1) s.actionsLeft = 0; // played as the first action: the turn ends
  }),
  'step-lightly': seq(
    (s, f) => {
      const im = heroOf(s, f.seat);
      if (!onBoard(im)) return;
      const cands = s.fighters.filter((x) => x.id !== im.id && onBoard(x) && isAdjacent(boardOf(s), x.space!, im.space)).map((x) => x.id);
      push(s, { kind: 'pickDamage', seat: f.seat, fighters: cands, n: onFog(s, im) ? 3 : 1, why: 'stepLightly' });
    },
    (s, f) => push(s, { kind: 'fogMove', seat: opponentOf(s, f), n: 2, dest: 'steps', may: true, why: 'fogMoveOpp' })
  ),
  'rolling-fog': seq((s, f) => {
    push(s, { kind: 'fogMove', seat: f.seat, dest: 'anyOther', why: 'rollingFog' });
    s.actionsLeft += 1;
    log(s, { t: 'extraAction', seat: f.seat });
  })
};

/** Holmes: "Choose an opponent" (asked only when there is more than one). Sets f.opp and moves to step 1. */
function chooseOpponent(s: UnmatchedState, f: Frame, a: Answer | null): Res {
  const opps = s.order.filter((x) => x !== f.seat && s.alive[x]);
  if (a?.type === 'choose') f.opp = Number(a.ids[0]);
  else if (opps.length === 1) f.opp = opps[0];
  else return ask(s, { kind: 'option', seat: f.seat, why: 'chooseOpponent', options: opps.map(String), min: 1, max: 1 });
  f.step = 1;
  return 'cont';
}

function showHand(s: UnmatchedState, of: number, to: number) {
  s.reveal = { to, seat: of, cards: s.hands[of]!.slice(), seq: s.seq + 1 };
  log(s, { t: 'sawHand', seat: to, of });
}

/** Move one fog token (Invisible Man effects). Answer: choose [`${token}@${space}`]. */
function fogOptions(s: UnmatchedState, f: Frame): { token: number; to: number[] }[] {
  const tokens = (f.tokens ?? s.fog.map((_, i) => i)).filter((t) => t !== f.exclude && t < s.fog.length);
  const all = boardOf(s).spaces.map((_, i) => i);
  return tokens.map((t) => {
    const from = s.fog[t]!;
    const to = f.dest === 'steps' ? fogReach(s, from, f.n ?? 0)
      : f.dest === 'noFighter' ? all.filter((x) => x !== from && !occupant(s, x))
        : all.filter((x) => x !== from);
    return { token: t, to };
  }).filter((o) => o.to.length);
}
HANDLERS.fogMove = (s, f) => {
  const a = takeAns(f);
  if (a?.type === 'done') { s.lastFog = null; return 'done'; }
  if (a?.type === 'choose') {
    const [t, sp] = a.ids[0]!.split('@').map(Number);
    s.fog[t!] = sp!;
    s.lastFog = t!;
    log(s, { t: 'fog', token: t!, to: sp! });
    return 'done';
  }
  s.lastFog = null;
  const fogs = fogOptions(s, f);
  if (!fogs.length) return 'done';
  return ask(s, { kind: 'fog', seat: f.seat, why: f.why ?? 'fogMove', fogs, may: !!f.may });
};

// ---------- option computations (shared by prompts, validation and legal-action hints) ----------

function moveOptions(s: UnmatchedState, f: Frame): { fighter: string; to: number[] }[] {
  return (f.fighters ?? [])
    .filter((x) => !(f.moved ?? []).includes(x))
    .map((x) => ({ fighter: x, to: reachable(s, x, f.max ?? 0, f.through) }))
    .filter((o) => o.to.length > 0);
}

function placeOptions(s: UnmatchedState, f: Frame): number[] {
  const empty = emptySpaces(s);
  const board = boardOf(s);
  const r = fighter(s, f.ref);
  if (f.where === 'anyOther' || f.where === 'any') return empty;
  if (f.where === 'adjacent') return onBoard(r) ? empty.filter((i) => isAdjacent(board, i, r.space)) : [];
  if (f.where === 'fog') return empty.filter((i) => s.fog.includes(i));
  if (f.where === 'zone') return onBoard(r) ? empty.filter((i) => shareZone(board, i, r.space)) : [];
  if (f.where === 'deploy') {
    // Keep the start spaces of players who have not deployed yet free.
    const reserved = s.order.map((seat, i) => (onBoard(heroOf(s, seat)) ? -1 : board.starts[i]!));
    const free = empty.filter((i) => !reserved.includes(i));
    if (!onBoard(r)) return free;
    const inZone = free.filter((i) => shareZone(board, i, r.space));
    return inZone.length ? inZone : free;
  }
  return empty;
}
function defenseOptions(s: UnmatchedState): string[] {
  const c = s.combat!;
  const def = fighter(s, c.defender);
  if (!def) return [];
  return s.hands[c.dSeat]!.filter((card) => {
    const d = cardDef(s, card);
    return (d.type === 'defense' || d.type === 'versatile') && canUse(def, d, s.form[def.seat] ?? null);
  });
}

/** Targets a fighter may attack: adjacent (melee), or anywhere in a shared zone for ranged fighters. */
export function attackTargets(s: UnmatchedState, fid: string): string[] {
  const att = fighter(s, fid);
  if (!onBoard(att)) return [];
  const board = boardOf(s);
  const seat = att.seat;
  return s.fighters
    .filter((t) => t.seat !== seat && onBoard(t) && s.alive[t.seat])
    .filter((t) => isAdjacent(board, att.space, t.space!) || (att.ranged && shareZone(board, att.space, t.space!)))
    // Free-for-all: on your first turn you may only attack the next player or someone who has already played.
    .filter((t) => !s.ffa || s.tookTurn[seat] || s.tookTurn[t.seat] || t.seat === nextSeat(s, seat))
    .map((t) => t.id);
}

function attackOptions(s: UnmatchedState, seat: number): { fighter: string; target: string; card: string; boostable: boolean }[] {
  const out: { fighter: string; target: string; card: string; boostable: boolean }[] = [];
  for (const f of ownFighters(s, seat)) {
    const targets = attackTargets(s, f.id);
    if (!targets.length) continue;
    for (const card of new Set(s.hands[seat]!)) {
      const d = cardDef(s, card);
      if ((d.type === 'attack' || d.type === 'versatile') && canUse(f, d, s.form[seat] ?? null)) {
        for (const target of targets) out.push({ fighter: f.id, target, card, boostable: f.hero && s.heroes[seat] === 'arthur' });
      }
    }
  }
  return out;
}

function schemeOptions(s: UnmatchedState, seat: number): { card: string; fighter: string }[] {
  const out: { card: string; fighter: string }[] = [];
  for (const card of s.hands[seat]!) {
    const d = cardDef(s, card);
    if (d.type !== 'scheme') continue;
    for (const f of ownFighters(s, seat)) if (canUse(f, d, s.form[seat] ?? null)) out.push({ card, fighter: f.id });
  }
  return out;
}

// ---------- setup ----------

function assignHero(s: UnmatchedState, seat: number, hero: string, rng?: EngineRng, deckOrder?: string[]) {
  const h = HEROES[hero]!;
  s.heroes[seat] = hero;
  s.fighters.push({ id: `${seat}h`, seat, hero: true, idx: 0, hp: h.hero.hp, maxHp: h.hero.hp, ranged: h.hero.ranged, space: null });
  for (let i = 0; i < h.sidekick.count; i++) {
    s.fighters.push({ id: `${seat}s${i}`, seat, hero: false, idx: i, hp: h.sidekick.hp, maxHp: h.sidekick.hp, ranged: h.sidekick.ranged, space: null });
  }
  if (hero === 'jekyll') s.form[seat] = 'jekyll';
  if (hero === 'invisible') s.fogSeat = seat;
  const cards = h.cards.flatMap((c) => Array.from({ length: c.count }, (_, k) => `${seat}.${c.slug}.${k + 1}`));
  s.decks[seat] = deckOrder ?? (rng ? shuffle(cards, rng) : cards);
  s.hands[seat] = [];
  draw(s, seat, START_HAND);
}

/** Fixed teaching scenario (tutorial tables only): Arthur vs a wounded Medusa on Marmoreal. */
export const TUTORIAL = {
  hand: ['0.excalibur.1', '0.regroup.1', '0.feint.1', '0.skirmish.1', '0.swift-strike.1'],
  drawn: '0.momentous-shift.1'
};

function tutorialSetup(s: UnmatchedState, rng: EngineRng) {
  const all = (seat: number, hero: string) => HEROES[hero]!.cards.flatMap((c) => Array.from({ length: c.count }, (_, k) => `${seat}.${c.slug}.${k + 1}`));
  const arthur = all(0, 'arthur');
  const rest = shuffle(arthur.filter((c) => !TUTORIAL.hand.includes(c) && c !== TUTORIAL.drawn), rng);
  // Deck: the last element is drawn first.
  assignHero(s, 0, 'arthur', undefined, [...rest, TUTORIAL.drawn, ...[...TUTORIAL.hand].reverse()]);
  assignHero(s, 1, 'medusa', rng);
  const place = (fid: string, space: number) => { fighter(s, fid)!.space = space; };
  place('0h', 15); place('0s0', 20);
  place('1h', 17); place('1s0', 18); place('1s1', 21); place('1s2', 28);
  fighter(s, '1h')!.hp = 5;
  s.seq = 0;
  s.log = [];
}

// ---------- module ----------

function finish(s: UnmatchedState, events: Events, changed: boolean): Transition<UnmatchedState> {
  const scheduleChanges: Transition<UnmatchedState>['scheduleChanges'] =
    s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : changed ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges };
}

/** Default answer for an open prompt (timeouts, players who left): the most passive legal choice. */
export function defaultAnswer(s: UnmatchedState): UnmatchedAction {
  const p = s.prompt!;
  switch (p.kind) {
    case 'pickHero': return { type: 'pickHero', hero: HERO_IDS.find((h) => !s.heroes.includes(h))! };
    case 'size': return { type: 'size', size: 'big' };
    case 'action': return { type: 'maneuver' };
    case 'defend': return { type: 'defend', card: null };
    case 'move': return { type: 'done' };
    case 'boost': return { type: 'choose', ids: [] };
    case 'place': return p.may ? { type: 'done' } : { type: 'choose', ids: [String(p.spaces![0])] };
    case 'fighter': return p.may ? { type: 'done' } : { type: 'choose', ids: [p.fighters![0]!] };
    case 'space': return { type: 'choose', ids: [String(p.spaces![0])] };
    case 'cards': return { type: 'choose', ids: p.cards!.slice(0, p.min ?? 0) };
    case 'option': return { type: 'choose', ids: p.options!.slice(0, p.min ?? 1) };
    case 'fog': return p.may ? { type: 'done' } : { type: 'choose', ids: [`${p.fogs![0]!.token}@${p.fogs![0]!.to[0]}`] };
  }
}

function validateAnswer(s: UnmatchedState, seat: number, a: UnmatchedAction): string | null {
  if (a.type === 'resign') return null;
  const p = s.prompt;
  if (!p) return 'NO_DECISION_PENDING';
  if (p.seat !== seat) return 'NOT_YOUR_TURN';
  const top = s.stack[s.stack.length - 1]!;
  const distinct = (ids: string[]) => new Set(ids).size === ids.length;
  switch (a.type) {
    case 'pickHero': return p.kind !== 'pickHero' ? 'WRONG_PHASE' : !HEROES[a.hero] ? 'UNKNOWN_HERO' : s.heroes.includes(a.hero) ? 'HERO_TAKEN' : null;
    case 'size': return p.kind === 'size' ? null : 'WRONG_PHASE';
    case 'maneuver': return p.kind === 'action' ? null : 'WRONG_PHASE';
    case 'scheme':
      if (p.kind !== 'action') return 'WRONG_PHASE';
      return schemeOptions(s, seat).some((o) => o.card === a.card && o.fighter === a.fighter) ? null : 'ILLEGAL_SCHEME';
    case 'attack': {
      if (p.kind !== 'action') return 'WRONG_PHASE';
      const opt = attackOptions(s, seat).find((o) => o.fighter === a.fighter && o.target === a.target && o.card === a.card);
      if (!opt) return 'ILLEGAL_ATTACK';
      if (a.boost !== undefined && (!opt.boostable || a.boost === a.card || !s.hands[seat]!.includes(a.boost))) return 'ILLEGAL_BOOST';
      return null;
    }
    case 'defend':
      if (p.kind !== 'defend') return 'WRONG_PHASE';
      if (a.card === null) return a.predict === undefined ? null : 'INVALID_ACTION';
      if (!defenseOptions(s).includes(a.card)) return 'ILLEGAL_DEFENSE';
      return (cardSlug(a.card) === 'elementary') === (a.predict !== undefined) ? null : 'PREDICTION_REQUIRED';
    case 'move': {
      if (p.kind !== 'move') return 'WRONG_PHASE';
      const o = moveOptions(s, top).find((x) => x.fighter === a.fighter);
      return o && o.to.includes(a.to) ? null : 'ILLEGAL_MOVE';
    }
    case 'done':
      return p.kind === 'move' || ((p.kind === 'place' || p.kind === 'fighter' || p.kind === 'fog') && p.may) ? null : 'DECISION_REQUIRED';
    case 'choose': {
      const ids = a.ids;
      if (!distinct(ids)) return 'INVALID_CHOICE';
      switch (p.kind) {
        case 'boost': return ids.length <= 1 && ids.every((x) => p.cards!.includes(x)) ? null : 'INVALID_CHOICE';
        case 'place': return ids.length === 1 && p.spaces!.includes(Number(ids[0])) ? null : 'INVALID_CHOICE';
        case 'space': return ids.length === 1 && p.spaces!.includes(Number(ids[0])) ? null : 'INVALID_CHOICE';
        case 'fighter': return ids.length === 1 && p.fighters!.includes(ids[0]!) ? null : 'INVALID_CHOICE';
        case 'cards':
          return ids.length >= (p.min ?? 0) && ids.length <= (p.max ?? 0) && ids.every((x) => p.cards!.includes(x)) ? null : 'INVALID_CHOICE';
        case 'fog': {
          const [t, sp] = (ids[0] ?? '').split('@').map(Number);
          return ids.length === 1 && p.fogs!.some((o) => o.token === t && o.to.includes(sp!)) ? null : 'INVALID_CHOICE';
        }
        case 'option':
          return ids.length >= (p.min ?? 1) && ids.length <= (p.max ?? 1) && ids.every((x) => p.options!.includes(x)) ? null : 'INVALID_CHOICE';
        default: return 'WRONG_PHASE';
      }
    }
  }
}

/** Apply an answer to the open prompt (the frame on top of the stack owns it). */
function answer(s: UnmatchedState, seat: number, a: UnmatchedAction) {
  const top = s.stack[s.stack.length - 1]!;
  s.prompt = null;
  if (a.type === 'maneuver' || a.type === 'scheme' || a.type === 'attack') {
    s.actionsLeft -= 1; // the turn frame asks for the next action once this one has resolved
    s.actionNo += 1;
    if (a.type === 'maneuver') push(s, { kind: 'maneuver', seat });
    if (a.type === 'scheme') {
      s.hands[seat]!.splice(s.hands[seat]!.indexOf(a.card), 1);
      log(s, { t: 'scheme', fighter: a.fighter, card: cardSlug(a.card) });
      push(s, { kind: 'scheme', seat, card: a.card, fighter: a.fighter });
    }
    if (a.type === 'attack') {
      const att = fighter(s, a.fighter)!;
      const def = fighter(s, a.target)!;
      const hand = s.hands[seat]!;
      hand.splice(hand.indexOf(a.card), 1);
      if (a.boost) hand.splice(hand.indexOf(a.boost), 1);
      const ranged = !isAdjacent(boardOf(s), att.space!, def.space!);
      s.combat = {
        attacker: att.id, defender: def.id, aSeat: seat, dSeat: def.seat, ranged,
        aCard: a.card, dCard: null, boost: a.boost ?? null, defended: false, revealed: false,
        cancelA: false, cancelD: false, boostVoid: false, shield: null,
        aBase: 0, dBase: 0, aAdd: 0, dAdd: 0, aVal: null, dVal: null, damage: null, won: null,
        dFaceUp: false, predict: null, aZero: false, dZero: false
      };
      log(s, { t: 'attack', fighter: att.id, target: def.id, ranged });
      push(s, { kind: 'combat', seat });
    }
    return;
  }
  top.ans = a as Answer;
}

/** A player leaves (resign / repeated timeouts): their fighters are removed and the game goes on without them. */
function leave(s: UnmatchedState, seat: number, reason: 'resign' | 'timeout', rng: EngineRng) {
  for (const f of s.fighters) if (f.seat === seat) { f.hp = f.hero ? 0 : f.hp; f.space = null; }
  if (!s.heroes[seat]) {
    // Still picking heroes: the remaining players continue without this seat.
    s.alive[seat] = false;
    log(s, { t: 'eliminated', seat, reason });
    s.elimination.push([seat]);
    s.order = s.order.filter((x) => x !== seat);
    if (s.order.length <= 1) {
      s.outcome = { reason: 'resign', placements: [...s.order.map((x) => ({ seat: x, place: 1 })), ...s.elimination.flat().map((x) => ({ seat: x, place: 2 }))] };
      s.prompt = null;
    } else if (s.prompt?.seat === seat) {
      s.prompt = null;
    }
    return;
  }
  const wasCurrent = s.current === seat;
  if (wasCurrent) { s.stack = []; s.prompt = null; s.combat = null; }
  endCheck(s, reason);
  if (s.outcome) return;
  if (wasCurrent && !s.stack.length) beginTurn(s, nextSeat(s, seat));
  run(s, rng);
  // Someone else's decision pending on the leaver: resolve it passively.
  for (let guard = 0; s.prompt && s.prompt.seat === seat && guard < 50; guard++) {
    answer(s, seat, defaultAnswer(s));
    run(s, rng);
  }
}

export const unmatchedModule: GameModule<UnmatchedState, UnmatchedAction, UnmatchedView> = {
  manifest: unmatched.manifest,
  actionSchema: unmatchedAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('unmatched needs 2–4 players');
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    const map = tutorial ? 'marmoreal' : typeof options.map === 'string' && BOARDS[options.map] ? options.map : BOARD_IDS[rng.nextInt(BOARD_IDS.length)]!;
    // Rulebook: the younger player takes start space 1 and goes first; the engine draws the first player instead.
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const s: UnmatchedState = {
      players: playerCount, mapId: map,
      order: Array.from({ length: playerCount }, (_, i) => (first + i) % playerCount),
      heroes: Array<string | null>(playerCount).fill(null),
      fighters: [],
      decks: Array.from({ length: playerCount }, () => []), hands: Array.from({ length: playerCount }, () => []), discards: Array.from({ length: playerCount }, () => []),
      size: Array<'big' | 'small' | null>(playerCount).fill(null),
      alive: Array<boolean>(playerCount).fill(true),
      tookTurn: Array<boolean>(playerCount).fill(false),
      current: first, actionsLeft: 2, turnNo: 0, turnStart: {},
      stack: [], prompt: null, combat: null, reveal: null, elimination: [],
      timeouts: Array<number>(playerCount).fill(0),
      ffa: playerCount > 2,
      form: Array<'jekyll' | 'hyde' | null>(playerCount).fill(null),
      fog: [], fogSeat: null, turnStartFog: [],
      vanished: Array<boolean>(playerCount).fill(false),
      actionNo: 0, lastFog: null,
      log: [], seq: 0, outcome: null
    };
    if (tutorial) {
      tutorialSetup(s, rng);
      beginTurn(s, 0);
    } else {
      // Run order (stack is LIFO): picks → deployment in turn order → first turn.
      s.turnNo = 0;
      s.stack.push({ kind: 'firstTurn', seat: first, step: 0 });
      for (const seat of [...s.order].reverse()) s.stack.push({ kind: 'deploy', seat, step: 0 });
      s.stack.push({ kind: 'pick', seat: first, step: 0, i: 0 });
    }
    run(s, rng);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.alive[actor.seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    const err = validateAnswer(s, actor.seat, a);
    return err ? { ok: false, errorCode: err } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const events: Events = [];
    if (a.type === 'resign') {
      leave(s, seat, 'resign', ctx.rng);
      events.push({ type: 'resigned', seat });
    } else {
      s.timeouts[seat] = 0;
      if (s.reveal?.to === seat && a.type !== 'choose') s.reveal = null;
      answer(s, seat, a);
      run(s, ctx.rng);
      events.push({ type: a.type, seat });
    }
    // Every decision gets a fresh deadline (a turn is a chain of short decisions).
    return finish(s, events, true);
  },

  project(s, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    const c = s.combat;
    const showA = !!c && (c.revealed || own === c.aSeat);
    const showD = !!c && (c.revealed || c.dFaceUp || own === c.dSeat);
    const p = s.prompt;
    return {
      players: s.players, mapId: s.mapId, order: s.order.slice(),
      heroes: s.heroes.slice(),
      fighters: s.fighters.map((f) => ({ ...f })),
      size: s.size.slice(),
      alive: s.alive.slice(),
      current: s.current, actionsLeft: s.actionsLeft, turnNo: s.turnNo,
      handCounts: s.hands.map((h) => h.length),
      deckCounts: s.decks.map((d) => d.length),
      discards: s.discards.map((d) => d.map(ref)),
      myHand: own === null ? null : s.hands[own]!.map(ref),
      // Prompt cards come from a hand or the deck top: only the prompted seat sees them.
      prompt: p ? { ...p, cards: p.seat === own ? p.cards?.slice() : undefined } : null,
      combat: c ? {
        ...c,
        aCard: showA ? ref(c.aCard) : null,
        dCard: showD && c.dCard ? ref(c.dCard) : null,
        boost: c.boost && (c.revealed || own === c.aSeat) ? ref(c.boost) : null,
        hasBoost: !!c.boost
      } : null,
      reveal: s.reveal && own === s.reveal.to ? { seat: s.reveal.seat, cards: s.reveal.cards.map(ref), seq: s.reveal.seq } : null,
      turnStart: { ...s.turnStart },
      form: s.form.slice(),
      fog: s.fog.slice(),
      fogSeat: s.fogSeat,
      vanished: s.vanished.slice(),
      log: s.log.slice(),
      outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.alive[viewer.seat]) return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    const p = s.prompt;
    if (p && p.seat === seat) {
      const top = s.stack[s.stack.length - 1]!;
      switch (p.kind) {
        case 'pickHero': for (const h of HERO_IDS) if (!s.heroes.includes(h)) out.push({ type: 'pickHero', hero: h }); break;
        case 'size': out.push({ type: 'size', size: 'big' }, { type: 'size', size: 'small' }); break;
        case 'action':
          out.push({ type: 'maneuver' });
          for (const o of schemeOptions(s, seat)) out.push({ type: 'scheme', ...o });
          for (const o of attackOptions(s, seat)) out.push({ type: 'attack', ...o });
          break;
        case 'defend':
          out.push({ type: 'defend', card: null });
          for (const card of defenseOptions(s)) {
            if (cardSlug(card) === 'elementary') for (let v = 0; v <= 8; v++) out.push({ type: 'defend', card, predict: v });
            else out.push({ type: 'defend', card });
          }
          break;
        case 'move':
          for (const o of moveOptions(s, top)) out.push({ type: 'move', fighter: o.fighter, to: o.to });
          out.push({ type: 'done' });
          break;
        case 'place': case 'fighter': case 'space':
          for (const x of p.kind === 'fighter' ? p.fighters! : p.spaces!.map(String)) out.push({ type: 'choose', ids: [x] });
          if (p.may) out.push({ type: 'done' });
          break;
        case 'fog':
          for (const o of p.fogs!) for (const t of o.to) out.push({ type: 'choose', ids: [`${o.token}@${t}`] });
          if (p.may) out.push({ type: 'done' });
          break;
        case 'boost': case 'cards': case 'option':
          out.push({ type: 'choose', from: p.kind === 'option' ? p.options : p.cards, min: p.min ?? 0, max: p.max ?? 1 });
          break;
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _event, ctx) {
    if (s.outcome || !s.prompt) return finish(s, [], false);
    const seat = s.prompt.seat;
    const events: Events = [{ type: 'timed-out', seat }];
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      leave(s, seat, 'timeout', ctx.rng);
      return finish(s, events, true);
    }
    // Answer passively until the game waits on someone else (e.g. the rest of an idle turn: maneuver, no move).
    const turn = s.turnNo;
    for (let guard = 0; s.prompt && s.prompt.seat === seat && s.turnNo === turn && !s.outcome && guard < 50; guard++) {
      answer(s, seat, defaultAnswer(s));
      run(s, ctx.rng);
    }
    return finish(s, events, true);
  },

  pendingSeats: (s) => (s.outcome || !s.prompt ? [] : [s.prompt.seat]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'شما شاه آرتور هستید و مدوسای زخمی (۵ سلامتی) روبه‌روی شماست. هر نوبت دو اقدام دارید: مانور، نقشه یا حمله. هدف: شکست دادن قهرمان حریف.',
    steps: [
      { instructionFa: 'اقدام اول: «مانور». یک کارت می‌کشید و بعد می‌توانید مبارزانتان را جابه‌جا کنید.', expected: { type: 'maneuver' }, reply: null },
      { instructionFa: 'حرکت آرتور ۲ است و تا مدوسا ۳ خانه راه است. حرکت را با دور ریختن «تجدید قوا» (تقویت ۱) تقویت کنید.', expected: { type: 'choose', ids: ['0.regroup.1'] }, reply: null },
      { instructionFa: 'حالا آرتور می‌تواند ۳ خانه برود؛ او را به خانه کنار مدوسا (خانه چشمک‌زن) ببرید. از روی مرلین خودی می‌شود رد شد.', expected: { type: 'move', fighter: '0h', to: 14 }, reply: null },
      { instructionFa: 'مرلین را جابه‌جا نمی‌کنیم: «پایان حرکت» را بزنید.', expected: { type: 'done' }, reply: null },
      { instructionFa: 'اقدام دوم: «حمله». آرتور کنار مدوساست؛ با «اکسکالیبور» (ارزش ۶) به مدوسا حمله کنید.', expected: { type: 'attack', fighter: '0h', target: '1h', card: '0.excalibur.1' }, reply: { type: 'defend', card: null } }
    ],
    completedFa: 'آفرین! مدوسا دفاعی نداشت، ۶ آسیب خورد و شکست خورد. در بازی واقعی هر دو قهرمان با سلامتی کامل شروع می‌کنند، مدافع کارت دفاع رو به پایین می‌گذارد و کارت‌ها اثرهای فوری، حین نبرد و پس از نبرد دارند.'
  }
};

