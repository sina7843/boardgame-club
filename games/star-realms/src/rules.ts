// Star Realms («نبرد ستاره‌ها»), two players, 50 authority each. Starting deck 8 Scouts + 2 Vipers; the first player
// draws 3, the second 5. Trade row of five from a 65-card generated trade deck in the four factions (names, costs and
// effects are original, modelled on the base game's themes; "or" choices are folded into fixed effects), plus an
// unlimited Explorer pile. A turn: play cards (ships give trade/combat/authority/draw; bases stay and re-apply each of
// your turns), ally abilities trigger automatically when another card of the faction is in play, scrap abilities are
// optional one-shots; spend trade to buy, combat to hit outposts first, then other bases or the opponent; end turn
// (discard, draw 5). Effects "scrap a card from hand/discard" (Machine Cult), "scrap a trade-row card" (Blob) and
// "opponent discards" (Star Empire, resolved at the start of their next turn) give allowances. Hidden: hands, decks,
// trade deck order.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { starRealms } from './definition.ts';

export type Faction = 'fed' | 'blob' | 'cult' | 'emp' | 'none';
export interface Fx { trade?: number; combat?: number; authority?: number; draw?: number; scrap?: number; scrapRow?: number; oppDiscard?: number }
export interface CardType { key: string; name: string; faction: Faction; cost: number; count: number; fx: Fx; ally?: Fx; scrapSelf?: Fx; base?: { defense: number; outpost: boolean } }
const C = (key: string, name: string, faction: Faction, cost: number, count: number, fx: Fx, extra: Partial<CardType> = {}): CardType => ({ key, name, faction, cost, count, fx, ...extra });
export const TYPES: CardType[] = [
  C('scout', 'دیده‌بان', 'none', 0, 0, { trade: 1 }), C('viper', 'افعی', 'none', 0, 0, { combat: 1 }),
  C('explorer', 'کاوشگر', 'none', 2, 0, { trade: 2 }, { scrapSelf: { combat: 2 } }),
  // Trade Federation — authority and trade
  C('shuttle', 'بلم بازرگانی', 'fed', 1, 3, { trade: 2 }, { ally: { authority: 4 } }),
  C('cutter', 'ناو کاروان', 'fed', 2, 3, { trade: 2, authority: 4 }, { ally: { combat: 4 } }),
  C('yacht', 'کشتی سفیر', 'fed', 3, 2, { trade: 2, authority: 3, draw: 1 }),
  C('freighter', 'باربر ستاره‌ای', 'fed', 4, 2, { trade: 4 }, { ally: { authority: 3 } }),
  C('flagship', 'ناو پرچم', 'fed', 6, 1, { combat: 5, draw: 1 }, { ally: { authority: 5 } }),
  C('command', 'ناو فرماندهی', 'fed', 8, 1, { authority: 4, combat: 5, draw: 2 }),
  C('tradepost', 'ایستگاه تجاری', 'fed', 3, 2, { trade: 1, authority: 1 }, { base: { defense: 4, outpost: true }, scrapSelf: { combat: 3 } }),
  C('barter', 'دنیای داد و ستد', 'fed', 4, 2, { trade: 2, authority: 2 }, { base: { defense: 4, outpost: false }, scrapSelf: { combat: 5 } }),
  C('port', 'بندر مرکزی', 'fed', 6, 1, { trade: 3 }, { base: { defense: 6, outpost: true }, scrapSelf: { draw: 1 } }),
  // Blob — combat and trade-row scrapping
  C('bfighter', 'پشه', 'blob', 1, 3, { combat: 3 }, { ally: { draw: 1 } }),
  C('tradepod', 'غلاف تجاری', 'blob', 2, 3, { trade: 3 }, { ally: { combat: 2 } }),
  C('battlepod', 'نیش‌زن', 'blob', 2, 2, { combat: 4, scrapRow: 1 }, { ally: { combat: 2 } }),
  C('ram', 'کوبنده', 'blob', 3, 2, { combat: 5 }, { ally: { combat: 2 }, scrapSelf: { trade: 3 } }),
  C('wheel', 'چرخ هیولا', 'blob', 3, 3, { combat: 1 }, { base: { defense: 5, outpost: false }, scrapSelf: { trade: 3 } }),
  C('destroyer', 'نابودگر', 'blob', 4, 2, { combat: 6 }, { ally: { scrapRow: 1 } }),
  C('mothership', 'ناو مادر', 'blob', 7, 1, { combat: 6, draw: 1 }, { ally: { draw: 1 } }),
  C('blobworld', 'دنیای هیولا', 'blob', 8, 1, { combat: 5 }, { base: { defense: 7, outpost: false } }),
  // Machine Cult — scrapping your weak cards
  C('tradebot', 'ربات تجاری', 'cult', 1, 3, { trade: 1, scrap: 1 }, { ally: { combat: 2 } }),
  C('battlebot', 'رزم‌ربات', 'cult', 2, 3, { combat: 2, scrap: 1 }, { ally: { combat: 2 } }),
  C('supplybot', 'ربات تدارکات', 'cult', 3, 3, { trade: 2, scrap: 1 }, { ally: { combat: 2 } }),
  C('patrol', 'گشت مکانیکی', 'cult', 4, 2, { combat: 5 }, { ally: { scrap: 1 } }),
  C('station', 'ایستگاه نبرد', 'cult', 3, 2, {}, { base: { defense: 5, outpost: true }, scrapSelf: { combat: 5 } }),
  C('machinebase', 'پایگاه ماشین', 'cult', 7, 1, { draw: 1, scrap: 1 }, { base: { defense: 6, outpost: true } }),
  C('missile', 'ماشین موشکی', 'cult', 6, 1, { combat: 6, draw: 1 }, { ally: { draw: 1 } }),
  // Star Empire — draw and opponent discards
  C('ifighter', 'جنگندهٔ امپراتوری', 'emp', 1, 3, { combat: 2, oppDiscard: 1 }, { ally: { combat: 2 } }),
  C('frigate', 'ناوچهٔ امپراتوری', 'emp', 3, 3, { combat: 4, oppDiscard: 1 }, { ally: { combat: 2 }, scrapSelf: { draw: 1 } }),
  C('corvette', 'نیزه', 'emp', 2, 2, { combat: 1, draw: 1 }, { ally: { combat: 2 } }),
  C('survey', 'ناو نقشه‌بردار', 'emp', 3, 3, { trade: 1, draw: 1 }, { scrapSelf: { oppDiscard: 1 } }),
  C('spacestation', 'ایستگاه فضایی', 'emp', 4, 2, { combat: 2 }, { base: { defense: 4, outpost: true }, ally: { combat: 2 }, scrapSelf: { trade: 4 } }),
  C('cruiser', 'رزم‌ناو', 'emp', 6, 1, { combat: 5, draw: 1 }, { ally: { oppDiscard: 1 } }),
  C('redoubt', 'دژ سلطنتی', 'emp', 6, 1, { combat: 3 }, { base: { defense: 6, outpost: true }, ally: { oppDiscard: 1 } }),
  C('dreadnaught', 'ناو هیبت', 'emp', 7, 1, { combat: 7, draw: 1 }, { scrapSelf: { combat: 5 } })
];
export const TYPE: Record<string, CardType> = Object.fromEntries(TYPES.map((t) => [t.key, t]));
/** Instance id of the first card of a type: 20 starter cards, then the trade deck in TYPES order. */
const firstId = (key: string) => 20 + TYPES.slice(0, TYPES.findIndex((t) => t.key === key)).reduce((n, t) => n + t.count, 0);
/** Tutorial ids: the opponent's Trading Post (outpost) and the learner's Battle Station. */
export const TUTORIAL_POST = firstId('tradepost');
export const TUTORIAL_STATION = firstId('station');

export interface Side { deck: number[]; hand: number[]; discard: number[]; bases: number[]; authority: number }
export interface SrState {
  cards: string[];
  tradeDeck: number[];
  row: (number | null)[];
  scrapped: number[];
  sides: Side[];
  current: number;
  inPlay: number[];
  pool: { trade: number; combat: number; scrap: number; scrapRow: number };
  allied: number[];
  mustDiscard: number[];
  last: { seat: number; kind: string; card?: number; amount?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type SrView = Omit<SrState, 'sides' | 'tradeDeck' | 'timeouts'> & {
  hand: number[] | null;
  sides: { deck: number; hand: number; discard: number; bases: number[]; authority: number; top: number | null }[];
  tradeDeckCount: number;
};

export const EXPLORER = 5;
export const srAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), index: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('playAll') }),
  z.strictObject({ type: z.literal('buy'), slot: z.number().int().min(0).max(5) }),
  z.strictObject({ type: z.literal('attack'), base: z.number().int().min(-1).max(999) }),
  z.strictObject({ type: z.literal('scrapSelf'), card: z.number().int().min(0).max(999) }),
  z.strictObject({ type: z.literal('scrapCard'), from: z.enum(['hand', 'discard']), index: z.number().int().min(0).max(200) }),
  z.strictObject({ type: z.literal('scrapRow'), slot: z.number().int().min(0).max(4) }),
  z.strictObject({ type: z.literal('discard'), index: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SrAction = z.infer<typeof srAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const typeOf = (s: { cards: string[] }, id: number) => TYPE[s.cards[id]!]!;
function draw(s: SrState, side: Side, n: number, rng: EngineRng) {
  for (let k = 0; k < n; k++) {
    if (!side.deck.length) { if (!side.discard.length) return; side.deck = shuffle(rng, side.discard); side.discard = []; }
    side.hand.push(side.deck.shift()!);
  }
}
const refill = (s: SrState) => { s.row = s.row.map((x) => (x === null ? s.tradeDeck.shift() ?? null : x)); };

type Events = Transition<SrState>['internalEvents'];
const finish = (s: SrState, events: Events): Transition<SrState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function gain(s: SrState, seat: number, fx: Fx | undefined, rng: EngineRng) {
  if (!fx) return;
  const side = s.sides[seat]!;
  s.pool.trade += fx.trade ?? 0;
  s.pool.combat += fx.combat ?? 0;
  s.pool.scrap += fx.scrap ?? 0;
  s.pool.scrapRow += fx.scrapRow ?? 0;
  side.authority += fx.authority ?? 0;
  if (fx.oppDiscard) s.mustDiscard[1 - seat]! += fx.oppDiscard;
  if (fx.draw) draw(s, side, fx.draw, rng);
}
/** Active cards this turn: played ships and own bases. */
const active = (s: SrState) => [...s.inPlay, ...s.sides[s.current]!.bases];
function checkAllies(s: SrState, rng: EngineRng) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of active(s)) {
      const t = typeOf(s, id);
      if (!t.ally || s.allied.includes(id) || t.faction === 'none') continue;
      if (active(s).filter((x) => x !== id && typeOf(s, x).faction === t.faction).length) { s.allied.push(id); gain(s, s.current, t.ally, rng); changed = true; }
    }
  }
}
const outposts = (s: SrState, seat: number) => s.sides[seat]!.bases.filter((b) => typeOf(s, b).base!.outpost);

function startTurn(s: SrState, seat: number, rng: EngineRng) {
  s.current = seat;
  s.inPlay = []; s.allied = [];
  s.pool = { trade: 0, combat: 0, scrap: 0, scrapRow: 0 };
  for (const b of s.sides[seat]!.bases) gain(s, seat, typeOf(s, b).fx, rng);
  checkAllies(s, rng);
}

export const srModule: GameModule<SrState, SrAction, SrView> = {
  manifest: starRealms.manifest,
  actionSchema: srAction,

  setup({ rng, options }) {
    const cards: string[] = [];
    const mk = (key: string) => { cards.push(key); return cards.length - 1; };
    const starter = () => [...Array.from({ length: 8 }, () => mk('scout')), ...Array.from({ length: 2 }, () => mk('viper'))];
    const decks = [starter(), starter()];
    const trade = TYPES.flatMap((t) => Array.from({ length: t.count }, () => mk(t.key)));
    const first = rng.nextInt(2);
    const s: SrState = {
      cards, tradeDeck: shuffle(rng, trade), row: [null, null, null, null, null], scrapped: [],
      sides: decks.map((d) => ({ deck: shuffle(rng, d), hand: [], discard: [], bases: [], authority: 50 })),
      current: first, inPlay: [], pool: { trade: 0, combat: 0, scrap: 0, scrapRow: 0 }, allied: [], mustDiscard: [0, 0],
      last: null, seq: 0, timeouts: [0, 0], outcome: null
    };
    refill(s);
    draw(s, s.sides[first]!, 3, rng);
    draw(s, s.sides[1 - first]!, 5, rng);
    if (options.deal === 'tutorial') {
      // A mid-game teaching position over two of the learner's turns. Turn 1: 4 Scouts + a Viper buy the Freighter
      // (4 trade) while the opponent's Trading Post (outpost, defense 4) blocks the Viper. The opponent ends its turn
      // (the post gives it +1 authority: 10 → 11). Turn 2 draws Blob Fighter, Battle Pod, Viper, Scout, Battle Station:
      // the two Blobs ally (+2 combat, +1 card), 10 combat breaks the post (−4), scrapping the station adds 5 and the
      // remaining 11 combat takes the opponent from 11 to 0.
      s.tradeDeck.push(...s.row.filter((x): x is number => x !== null));
      const take = (id: number) => s.tradeDeck.splice(s.tradeDeck.indexOf(id), 1)[0]!;
      const pick = (key: string) => take(s.tradeDeck.find((x) => cards[x] === key)!);
      const post = take(TUTORIAL_POST);
      const station = take(TUTORIAL_STATION);
      const [fighter, pod] = [pick('bfighter'), pick('battlepod')];
      s.row = ['freighter', 'cutter', 'wheel', 'ifighter', 'patrol'].map(pick);
      const d = decks[0]!; // ids 0–7 Scouts, 8–9 Vipers
      s.current = 0;
      s.sides[0] = { hand: [d[0]!, d[1]!, d[2]!, d[3]!, d[8]!], deck: [fighter, pod, d[9]!, d[4]!, station, d[5]!, d[6]!, d[7]!], discard: [], bases: [], authority: 50 };
      s.sides[1] = { hand: decks[1]!.slice(0, 5), deck: decks[1]!.slice(5), discard: [], bases: [post], authority: 10 };
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat > 1) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    if (a.type === 'resign') return { ok: true };
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const me = s.sides[seat]!;
    if (s.mustDiscard[seat]) return a.type === 'discard' && a.index < me.hand.length ? { ok: true } : { ok: false, errorCode: 'DISCARD_FIRST' };
    switch (a.type) {
      case 'discard': return { ok: false, errorCode: 'NOTHING_TO_DISCARD' };
      case 'play': return a.index < me.hand.length ? { ok: true } : { ok: false, errorCode: 'NO_SUCH_CARD' };
      case 'playAll': return me.hand.length ? { ok: true } : { ok: false, errorCode: 'EMPTY_HAND' };
      case 'buy': {
        const id = a.slot === EXPLORER ? -1 : s.row[a.slot];
        if (id === null || id === undefined) return { ok: false, errorCode: 'EMPTY_SLOT' };
        return (id < 0 ? 2 : typeOf(s, id).cost) <= s.pool.trade ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      }
      case 'attack': {
        const opp = 1 - seat;
        const posts = outposts(s, opp);
        if (a.base === -1) return posts.length ? { ok: false, errorCode: 'OUTPOST_FIRST' } : s.pool.combat > 0 ? { ok: true } : { ok: false, errorCode: 'NO_COMBAT' };
        if (!s.sides[opp]!.bases.includes(a.base)) return { ok: false, errorCode: 'NO_SUCH_BASE' };
        if (posts.length && !posts.includes(a.base)) return { ok: false, errorCode: 'OUTPOST_FIRST' };
        return s.pool.combat >= typeOf(s, a.base).base!.defense ? { ok: true } : { ok: false, errorCode: 'NOT_ENOUGH_COMBAT' };
      }
      case 'scrapSelf':
        return active(s).includes(a.card) && typeOf(s, a.card).scrapSelf ? { ok: true } : { ok: false, errorCode: 'CANNOT_SCRAP' };
      case 'scrapCard':
        if (!s.pool.scrap) return { ok: false, errorCode: 'NO_SCRAP' };
        return a.index < (a.from === 'hand' ? me.hand : me.discard).length ? { ok: true } : { ok: false, errorCode: 'NO_SUCH_CARD' };
      case 'scrapRow':
        return s.pool.scrapRow && s.row[a.slot] !== null ? { ok: true } : { ok: false, errorCode: 'NO_SCRAP' };
      case 'endTurn': return { ok: true };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const opp = 1 - seat;
    const me = s.sides[seat]!;
    s.seq += 1;
    if (a.type === 'resign') { s.outcome = { placements: [{ seat: opp, place: 1 }, { seat, place: 2 }], reason: 'resign' }; return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    const playOne = (i: number) => {
      const id = me.hand.splice(i, 1)[0]!;
      const t = typeOf(s, id);
      if (t.base) me.bases.push(id); else s.inPlay.push(id);
      gain(s, seat, t.fx, ctx.rng);
      checkAllies(s, ctx.rng);
    };
    switch (a.type) {
      case 'discard': me.discard.push(me.hand.splice(a.index, 1)[0]!); s.mustDiscard[seat]! -= 1; break;
      case 'play': s.last = { seat, kind: 'play', card: me.hand[a.index] }; playOne(a.index); break;
      case 'playAll': while (me.hand.length) playOne(0); s.last = { seat, kind: 'playAll' }; break;
      case 'buy': {
        let id: number;
        if (a.slot === EXPLORER) { s.cards.push('explorer'); id = s.cards.length - 1; s.pool.trade -= 2; }
        else { id = s.row[a.slot]!; s.pool.trade -= typeOf(s, id).cost; s.row[a.slot] = null; refill(s); }
        me.discard.push(id);
        s.last = { seat, kind: 'buy', card: id };
        break;
      }
      case 'attack': {
        if (a.base === -1) {
          const dmg = s.pool.combat;
          s.sides[opp]!.authority -= dmg; s.pool.combat = 0;
          s.last = { seat, kind: 'hit', amount: dmg };
          if (s.sides[opp]!.authority <= 0) s.outcome = { placements: [{ seat, place: 1 }, { seat: opp, place: 2 }], reason: 'win' };
        } else {
          s.pool.combat -= typeOf(s, a.base).base!.defense;
          const ob = s.sides[opp]!;
          ob.bases = ob.bases.filter((b) => b !== a.base); ob.discard.push(a.base);
          s.last = { seat, kind: 'destroy', card: a.base };
        }
        break;
      }
      case 'scrapSelf': {
        const t = typeOf(s, a.card);
        s.inPlay = s.inPlay.filter((x) => x !== a.card);
        me.bases = me.bases.filter((x) => x !== a.card);
        if (t.key !== 'explorer') s.scrapped.push(a.card);
        gain(s, seat, t.scrapSelf, ctx.rng);
        s.last = { seat, kind: 'scrapSelf', card: a.card };
        break;
      }
      case 'scrapCard': {
        const pile = a.from === 'hand' ? me.hand : me.discard;
        s.scrapped.push(pile.splice(a.index, 1)[0]!);
        s.pool.scrap -= 1;
        break;
      }
      case 'scrapRow':
        s.scrapped.push(s.row[a.slot]!); s.row[a.slot] = null; refill(s); s.pool.scrapRow -= 1;
        break;
      case 'endTurn':
        me.discard.push(...s.inPlay, ...me.hand);
        me.hand = [];
        draw(s, me, 5, ctx.rng);
        startTurn(s, opp, ctx.rng);
        s.last = { seat, kind: 'end' };
        break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { sides, tradeDeck, timeouts: _t, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      ...rest,
      hand: sides[me]?.hand ?? null,
      sides: sides.map((x) => ({ deck: x.deck.length, hand: x.hand.length, discard: x.discard.length, bases: x.bases, authority: x.authority, top: x.discard.at(-1) ?? null })),
      tradeDeckCount: tradeDeck.length
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      const me = s.sides[seat]!;
      if (s.mustDiscard[seat]) me.hand.forEach((_, index) => out.push({ type: 'discard', index }));
      else {
        me.hand.forEach((_, index) => out.push({ type: 'play', index }));
        if (me.hand.length) out.push({ type: 'playAll' });
        s.row.forEach((id, slot) => { if (id !== null && typeOf(s, id).cost <= s.pool.trade) out.push({ type: 'buy', slot }); });
        if (s.pool.trade >= 2) out.push({ type: 'buy', slot: EXPLORER });
        const posts = outposts(s, 1 - seat);
        for (const b of s.sides[1 - seat]!.bases) if ((!posts.length || posts.includes(b)) && s.pool.combat >= typeOf(s, b).base!.defense) out.push({ type: 'attack', base: b });
        if (!posts.length && s.pool.combat > 0) out.push({ type: 'attack', base: -1 });
        for (const id of active(s)) if (typeOf(s, id).scrapSelf) out.push({ type: 'scrapSelf', card: id });
        if (s.pool.scrap) { me.hand.forEach((_, index) => out.push({ type: 'scrapCard', from: 'hand', index })); me.discard.forEach((_, index) => out.push({ type: 'scrapCard', from: 'discard', index })); }
        if (s.pool.scrapRow) s.row.forEach((id, slot) => { if (id !== null) out.push({ type: 'scrapRow', slot }); });
        out.push({ type: 'endTurn' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: SrAction) => srModule.apply(s, { kind: 'player', seat }, a, ctx);
    while (s.mustDiscard[seat]) run({ type: 'discard', index: 0 });
    if (s.sides[seat]!.hand.length) run({ type: 'playAll' });
    if (!outposts(s, 1 - seat).length && s.pool.combat > 0) run({ type: 'attack', base: -1 });
    if (!s.outcome) run({ type: 'endTurn' });
    s.timeouts[seat] = missed;
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 13,
    options: { deal: 'tutorial' },
    introFa: 'وسط یک دوئل هستید: شما ۵۰ اقتدار دارید و حریف ۱۰، ولی حریف پشت یک پاسگاه (ایستگاه تجاری، دفاع ۴) پناه گرفته است. هر نوبت کارت‌های دستتان را بازی می‌کنید تا تجارت (برای خرید) و حمله (برای ضربه) جمع شود، بعد نوبت را تمام می‌کنید و ۵ کارت تازه می‌کشید. در این آموزش در دو نوبت کار حریف را تمام می‌کنید.',
    steps: [
      { instructionFa: 'دست شما ۴ دیده‌بان و ۱ افعی است. دکمهٔ «بازی همه» را بزنید: هر دیده‌بان ۱ تجارت و افعی ۱ حمله می‌دهد. این ۱ حمله به جایی نمی‌رسد، چون تا پاسگاه حریف سر پاست نمی‌توانید به خودش ضربه بزنید و برای نابود کردن پاسگاه ۴ حمله لازم است.', expected: { type: 'playAll' }, reply: null },
      { instructionFa: 'با ۴ تجارت «باربر ستاره‌ای» (قیمت ۴) را از ردیف بازار بخرید. کارت خریده به دورریز شما می‌رود و بعداً که دسته را بُر بزنید به دستتان می‌آید؛ جای خالی بازار هم فوراً از دستهٔ بازار پر می‌شود.', expected: { type: 'buy', slot: 0 }, reply: null },
      { instructionFa: 'دکمهٔ «پایان نوبت» را بزنید. کارت‌های بازی‌شده و تجارت و حملهٔ خرج‌نشده از بین می‌روند و ۵ کارت تازه از دسته‌تان می‌کشید. در نوبت حریف، پایگاه او دوباره کار می‌کند و ۱ اقتدار به او می‌دهد (۱۰ به ۱۱).', expected: { type: 'endTurn' }, reply: { type: 'endTurn' } },
      { instructionFa: 'نوبت دوم شماست. اولین کارت دستتان، «پشه» از جناح هیولاها، را بازی کنید: ۳ حمله.', expected: { type: 'play', index: 0 }, reply: null },
      { instructionFa: '«بازی همه» را بزنید. «نیش‌زن» هم هیولاست، پس توانایی متحد هر دو فعال می‌شود: نیش‌زن ۲ حملهٔ اضافه می‌دهد و پشه یک کارت برایتان می‌کشد که آن هم بازی می‌شود. «ایستگاه نبرد» پایگاه است و روی میز می‌ماند. جمع حمله: ۳ + ۴ + ۲ + ۱ = ۱۰.', expected: { type: 'playAll' }, reply: null },
      { instructionFa: 'روی ایستگاه تجاری حریف بزنید تا با ۴ حمله نابود شود (۶ حمله می‌ماند). پاسگاه‌ها همیشه باید اول از همه نابود شوند.', expected: { type: 'attack', base: TUTORIAL_POST }, reply: null },
      { instructionFa: 'زیر ایستگاه نبرد خودتان «♻ اسقاط» را بزنید. اسقاط کارت را برای همیشه از بازی بیرون می‌برد، ولی پاداش یک‌باره‌اش را می‌دهد: ۵ حمله (حالا ۱۱).', expected: { type: 'scrapSelf', card: TUTORIAL_STATION }, reply: null },
      { instructionFa: 'راه باز است: دکمهٔ «حمله (۱۱)» را بزنید. همهٔ حملهٔ باقی‌مانده یک‌جا از اقتدار حریف کم می‌شود.', expected: { type: 'attack', base: -1 }, reply: null }
    ],
    completedFa: 'بردید! در نوبت اول ۴ تجارت را خرج خرید کردید. در نوبت دوم پشه (۳)، نیش‌زن (۴)، پاداش متحد نیش‌زن (۲) و افعی (۱) روی هم ۱۰ حمله شد؛ ۴ تا پاسگاه را نابود کرد، اسقاط ایستگاه نبرد ۵ حمله اضافه کرد و ۱۱ ضربه اقتدار حریف را از ۱۱ به صفر رساند. هر کس اقتدار حریف را به صفر یا کمتر برساند فوراً برنده است.'
  }
};
