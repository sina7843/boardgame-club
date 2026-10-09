// Gaia Project base game (2–4 players, no Automa): faction selection, set-up placement and boosters, six rounds of
// income → gaia → actions → clean-up, all standard actions (mine, upgrades, federation, research, power/QIC actions,
// special actions, free conversions, pass with booster), leech, round/final scoring. Content (factions, tiles) is
// data in src/content/*; the engine helpers live in core.ts.
import { z } from 'zod';
import type { Actor, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { gaiaProject } from './definition.ts';
import { SMALL_CENTERS, SMALL_SECTORS, buildMap, randomMap } from './map.ts';
import {
  CONTENT, RESEARCH_COST, RESEARCH_INCOME, activeSeats, addGains, advance, buildMine, burn, canBurn, canPay,
  conversions, countBuilding, decisionOptions, factionOf, fedPlan, fedTokensAvailable, formFederation, gaiaform,
  gaiaformPlan, gain, hasPI, log, minePlan, pay, planetTypes, queueTech, researchBlock, resolveDecision, sources,
  spendable, specialActions, suggestFederations, techOptions, upgrade, upgradeCost, UPGRADES, vp
} from './core.ts';
import './content/index.ts';
import { TRACKS, type Decision, type Gain, type GaiaState, type PlayerState } from './types.ts';

export * from './types.ts';
export * from './map.ts';
export * from './core.ts';

const MAX_TIMEOUTS = 3;
export const ROUNDS = 6;

// ---------------- power & QIC actions (research board) ----------------

export interface PowerAction { id: string; labelFa: string; cost: Gain; steps?: number }
export const POWER_ACTIONS: PowerAction[] = [
  { id: 'pw1', labelFa: '۳ دانش', cost: { pw: 7 } },
  { id: 'pw2', labelFa: '۲ گام زمین‌سازی و ساخت معدن', cost: { pw: 5 }, steps: 2 },
  { id: 'pw3', labelFa: '۲ سنگ معدن', cost: { pw: 4 } },
  { id: 'pw4', labelFa: '۷ اعتبار', cost: { pw: 4 } },
  { id: 'pw5', labelFa: '۲ دانش', cost: { pw: 4 } },
  { id: 'pw6', labelFa: '۱ گام زمین‌سازی و ساخت معدن', cost: { pw: 3 }, steps: 1 },
  { id: 'pw7', labelFa: '۲ ژتون قدرت', cost: { pw: 3 } },
  { id: 'qic1', labelFa: 'یک کاشی فناوری', cost: { q: 4 } },
  { id: 'qic2', labelFa: 'پاداش دوبارهٔ یکی از توکن‌های فدراسیون شما', cost: { q: 3 } },
  { id: 'qic3', labelFa: '۳ امتیاز + ۱ امتیاز برای هر نوع سیاره', cost: { q: 2 } }
];
const POWER_GAIN: Record<string, Gain> = { pw1: { k: 3 }, pw3: { o: 2 }, pw4: { c: 7 }, pw5: { k: 2 }, pw7: { t: 2 } };

// ---------------- actions ----------------

const hex = z.number().int().min(0).max(400);
const id = z.string().min(1).max(40);
export const gaiaAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('faction'), faction: id }),
  z.strictObject({ type: z.literal('place'), hex }),
  z.strictObject({ type: z.literal('booster'), booster: id }),
  z.strictObject({ type: z.literal('mine'), hex }),
  z.strictObject({ type: z.literal('upgrade'), hex, to: z.enum(['ts', 'lab', 'pi', 'ac1', 'ac2']) }),
  z.strictObject({ type: z.literal('gaiaform'), hex }),
  z.strictObject({ type: z.literal('federation'), hexes: z.array(hex).min(1).max(60), token: id }),
  z.strictObject({ type: z.literal('research'), track: z.enum(TRACKS) }),
  z.strictObject({ type: z.literal('power'), id, hex: hex.optional(), pick: id.optional() }),
  z.strictObject({ type: z.literal('special'), id: z.string().min(1).max(60), hex: hex.optional() }),
  z.strictObject({ type: z.literal('pass'), booster: id.optional() }),
  z.strictObject({ type: z.literal('convert'), id }),
  z.strictObject({ type: z.literal('burn') }),
  z.strictObject({ type: z.literal('decide'), choice: id }),
  z.strictObject({ type: z.literal('resign') })
]);
export type GaiaAction = z.infer<typeof gaiaAction>;

export type GaiaView = Omit<GaiaState, 'ins' | 'turnDone'> & {
  /** Open decision at the head of the queue with its options (public: who decides and between what). */
  decision: (Decision & { options: string[] }) | null;
  income: Gain[];
};

// ---------------- helpers ----------------

type Events = Transition<GaiaState>['internalEvents'];

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

const newPlayer = (): PlayerState => ({
  faction: null, c: 0, o: 0, k: 0, q: 0, vp: 10,
  power: { b1: 0, b2: 0, b3: 0, gaia: 0, brain: null },
  research: { terra: 0, nav: 0, ai: 0, gaia: 0, eco: 0, sci: 0 },
  gf: 0, gfGaia: 0, booster: null, techs: [], feds: [], satellites: 0, passed: false, used: [], mark: {}, timeouts: 0
});

function chooseFaction(s: GaiaState, seat: number, fid: string) {
  const f = CONTENT.factions[fid]!;
  const p = s.pl[seat]!;
  p.faction = fid;
  const st = f.start ?? {};
  Object.assign(p, { c: st.c ?? 15, o: st.o ?? 4, k: st.k ?? 3, q: st.q ?? 1 });
  p.power = { b1: st.b1 ?? 2, b2: st.b2 ?? 4, b3: st.b3 ?? 0, gaia: 0, brain: st.brain ?? null };
  for (const t of TRACKS) for (let i = 0; i < (st.research?.[t] ?? 0); i++) advance(s, seat, t, true);
  log(s, { t: 'faction', seat, faction: fid });
}

const homeTaken = (s: GaiaState, fid: string) =>
  s.pl.some((p) => p.faction && (p.faction === fid || CONTENT.factions[p.faction]!.home === CONTENT.factions[fid]!.home));
export const availableFactions = (s: GaiaState) => Object.keys(CONTENT.factions).filter((f) => !homeTaken(s, f));

function buildSetupQueue(s: GaiaState) {
  const q: GaiaState['setupQueue'] = [];
  const mines = (seat: number) => (s.active[seat] ? factionOf(s, seat).setupMines ?? 2 : 0);
  for (const seat of s.order) if (mines(seat) >= 1) q.push({ seat, what: 'mine' });
  for (const seat of [...s.order].reverse()) if (mines(seat) >= 2) q.push({ seat, what: 'mine' });
  for (let k = 3; k <= 4; k++) for (const seat of s.order) if (mines(seat) >= k) q.push({ seat, what: 'mine' });
  for (const seat of s.order) if (s.active[seat] && factionOf(s, seat).setupPI) q.push({ seat, what: 'pi' });
  s.setupQueue = q;
}

/** Income of one player for the income phase. */
export function incomeOf(s: GaiaState, seat: number): Gain {
  const f = factionOf(s, seat);
  const p = s.pl[seat]!;
  let g: Gain = { ...(f.income ?? { o: 1, k: 1 }) };
  const mines = countBuilding(s, seat, 'mine');
  g = addGains(g, { o: [0, 1, 2, 2, 3, 4, 5, 6, 7][mines] ?? 7 });
  const ts = f.buildings?.ts ?? [{ c: 3 }, { c: 4 }, { c: 4 }, { c: 5 }];
  for (let i = 0; i < countBuilding(s, seat, 'ts'); i++) g = addGains(g, ts[i] ?? {});
  const lab = f.buildings?.lab ?? [{ k: 1 }, { k: 1 }, { k: 1 }];
  for (let i = 0; i < countBuilding(s, seat, 'lab'); i++) g = addGains(g, lab[i] ?? {});
  if (hasPI(s, seat)) g = addGains(g, f.buildings?.pi ?? { pw: 4, t: 1 });
  if (countBuilding(s, seat, 'ac1')) g = addGains(g, f.buildings?.ac1 ?? { k: 2 });
  g = addGains(g, RESEARCH_INCOME.eco[p.research.eco]!);
  g = addGains(g, RESEARCH_INCOME.sci[p.research.sci]!);
  if (p.booster) g = addGains(g, CONTENT.boosters[p.booster]!.income);
  for (const src of sources(s, seat)) {
    const inc = src.effects.income;
    if (inc) g = addGains(g, typeof inc === 'function' ? inc({ s, seat }) : inc);
  }
  return g;
}

function startRound(s: GaiaState) {
  s.round += 1;
  s.phase = 'actions';
  log(s, { t: 'round', round: s.round });
  s.powerUsed = [];
  s.passOrder = [];
  for (const seat of s.order) {
    const p = s.pl[seat]!;
    p.used = [];
    p.passed = !s.active[seat];
    if (p.passed) s.passOrder.push(seat);
  }
  // Income phase
  for (const seat of s.order) if (s.active[seat]) gain(s, seat, incomeOf(s, seat));
  // Gaia phase
  for (const seat of s.order) {
    if (!s.active[seat]) continue;
    const p = s.pl[seat]!;
    for (const h of s.hexes) if (h.owner === seat && h.building === 'gf' && h.planet === 'm') h.planet = 'g';
    p.gfGaia = 0;
    // Faction hook runs while the tokens are still in the gaia area (Itars may set some aside, Terrans read the count).
    factionOf(s, seat).effects?.onGaiaPhase?.({ s, seat });
    const n = p.power.gaia;
    p.power.gaia = 0;
    if (factionOf(s, seat).flags?.gaiaToBowl2) p.power.b2 += n; else p.power.b1 += n;
    if (p.power.brain === 0) p.power.brain = 1;
  }
  s.current = s.order.find((seat) => !s.pl[seat]!.passed) ?? s.order[0]!;
  s.turnDone = false;
}

function nextTurn(s: GaiaState) {
  const n = s.order.length;
  const at = s.order.indexOf(s.current);
  for (let k = 1; k <= n; k++) {
    const seat = s.order[(at + k) % n]!;
    if (!s.pl[seat]!.passed) { s.current = seat; return; }
  }
  // Everyone passed: clean-up, then the next round in passing order (or the end of the game).
  s.powerUsed = [];
  if (s.round >= ROUNDS) { finalScoring(s); return; }
  s.order = s.passOrder.slice();
  startRound(s);
}

/** 18/12/6 split among tied ranks (rounded down); the neutral player takes part in 2-player games. */
export function rankPoints(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const out = values.map(() => 0);
  const prize = [18, 12, 6];
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j < order.length && order[j]!.v === order[i]!.v) j++;
    const pts = Math.floor(prize.slice(i, j).reduce((a, b) => a + b, 0) / (j - i));
    for (let k = i; k < j; k++) out[order[k]!.i] = pts;
    i = j;
  }
  return out;
}

function finalScoring(s: GaiaState) {
  const seats = activeSeats(s);
  for (const tid of s.finalTiles) {
    const tile = CONTENT.finals[tid]!;
    const vals = seats.map((seat) => tile.value(s, seat));
    if (s.players === 2) vals.push(tile.neutral);
    rankPoints(vals).forEach((pts, i) => { if (i < seats.length) vp(s, seats[i]!, pts, `final:${tid}`); });
  }
  for (const seat of seats) {
    const p = s.pl[seat]!;
    for (const t of TRACKS) if (p.research[t] >= 3) vp(s, seat, 4 * (p.research[t] - 2), `research:${t}`);
    // Burn every burnable power first (official end-of-game conversion), then spend bowl III as credits.
    while (canBurn(p.power)) burn(s, seat);
    vp(s, seat, Math.floor((p.c + p.o + p.k + p.q + spendable(s, seat)) / 3), 'resources');
    log(s, { t: 'final', seat, vp: p.vp });
  }
  finish(s, 'score');
}

function finish(s: GaiaState, reason: Outcome['reason']) {
  const seats = activeSeats(s);
  const placements: Outcome['placements'] = seats.map((seat) => ({
    seat, score: s.pl[seat]!.vp, place: 1 + seats.filter((o) => s.pl[o]!.vp > s.pl[seat]!.vp).length
  }));
  [...s.left].reverse().forEach((seat, i) => placements.push({ seat, score: s.pl[seat]!.vp, place: seats.length + i + 1 }));
  s.outcome = { placements: placements.sort((a, b) => a.place - b.place || a.seat - b.seat), reason };
  s.phase = 'finished';
  s.pending = [];
}

function removeSeat(s: GaiaState, seat: number, reason: 'resign' | 'timeout') {
  s.active[seat] = false;
  s.left.push(seat);
  log(s, { t: 'left', seat, reason });
  s.pending = s.pending.filter((d) => d.seat !== seat);
  s.setupQueue = s.setupQueue.filter((q) => q.seat !== seat);
  const p = s.pl[seat]!;
  if (p.booster) { s.boosters.push(p.booster); p.booster = null; }
  if (s.phase === 'actions' && !p.passed) { p.passed = true; s.passOrder.push(seat); if (s.current === seat) s.turnDone = true; }
  if (activeSeats(s).length <= 1) finish(s, reason);
}

/** Drive the game forward until someone must act. */
function flow(s: GaiaState) {
  for (let guard = 0; guard < 200 && !s.outcome; guard++) {
    // Drop decisions that lost all their options (e.g. the only tile was taken meanwhile).
    while (s.pending.length && (!s.active[s.pending[0]!.seat] || decisionOptions(s, s.pending[0]!).length === 0)) s.pending.shift();
    if (s.pending.length) return;
    if (s.phase === 'faction') {
      const next = s.order.find((seat) => s.active[seat] && !s.pl[seat]!.faction);
      if (next !== undefined) { s.current = next; return; }
      buildSetupQueue(s);
      s.phase = 'setup';
      continue;
    }
    if (s.phase === 'setup') {
      if (s.setupQueue.length) { s.current = s.setupQueue[0]!.seat; return; }
      s.phase = 'booster';
      continue;
    }
    if (s.phase === 'booster') {
      const next = [...s.order].reverse().find((seat) => s.active[seat] && !s.pl[seat]!.booster);
      if (next !== undefined) { s.current = next; return; }
      startRound(s);
      continue;
    }
    if (s.phase === 'actions') {
      if (s.turnDone || s.pl[s.current]!.passed) { s.turnDone = false; nextTurn(s); continue; }
      return;
    }
    return;
  }
}

// ---------------- validation ----------------

const ownsFed = (s: GaiaState, seat: number, fid: string) => s.pl[seat]!.feds.some((f) => f.id === fid);

function check(s: GaiaState, seat: number, a: GaiaAction): string | null {
  const p = s.pl[seat]!;
  const x = { s, seat };
  if (s.pending.length) {
    if (a.type !== 'decide' || s.pending[0]!.seat !== seat) return s.pending[0]!.seat === seat ? 'WRONG_PHASE' : 'NOT_YOUR_TURN';
    return decisionOptions(s, s.pending[0]!).includes(a.choice) ? null : 'ILLEGAL_CHOICE';
  }
  if (a.type === 'decide') return 'WRONG_PHASE';
  if (seat !== s.current) return 'NOT_YOUR_TURN';
  switch (s.phase) {
    case 'faction':
      if (a.type !== 'faction') return 'WRONG_PHASE';
      return CONTENT.factions[a.faction] && !homeTaken(s, a.faction) ? null : 'FACTION_UNAVAILABLE';
    case 'setup': {
      if (a.type !== 'place') return 'WRONG_PHASE';
      const h = s.hexes[a.hex];
      return h && h.owner === null && h.planet === factionOf(s, seat).home ? null : 'ILLEGAL_PLACEMENT';
    }
    case 'booster':
      if (a.type !== 'booster') return 'WRONG_PHASE';
      return s.boosters.includes(a.booster) ? null : 'BOOSTER_UNAVAILABLE';
    case 'actions': break;
    default: return 'WRONG_PHASE';
  }
  const err = (r: unknown) => (typeof r === 'string' ? r : null);
  switch (a.type) {
    case 'mine': return err(minePlan(s, seat, a.hex));
    case 'upgrade': return err(upgradeCost(s, seat, a.hex, a.to));
    case 'gaiaform': return err(gaiaformPlan(s, seat, a.hex));
    case 'federation':
      if (!fedTokensAvailable(s).includes(a.token)) return 'TOKEN_UNAVAILABLE';
      return err(fedPlan(s, seat, a.hexes));
    case 'research':
      if (p.k < RESEARCH_COST) return 'NOT_ENOUGH_RESOURCES';
      return researchBlock(s, seat, a.track);
    case 'power': {
      const pa = POWER_ACTIONS.find((x) => x.id === a.id);
      if (!pa) return 'ILLEGAL_CHOICE';
      if (s.powerUsed.includes(a.id)) return 'ACTION_TAKEN';
      if (!canPay(s, seat, pa.cost)) return 'NOT_ENOUGH_RESOURCES';
      if (pa.steps) {
        if (a.hex === undefined) return 'ILLEGAL_PLACEMENT';
        return err(minePlan(s, seat, a.hex, { freeSteps: pa.steps, extraCost: pa.cost }));
      }
      if (a.id === 'qic1' && !techOptions(s, seat).length) return 'ILLEGAL_CHOICE';
      if (a.id === 'qic2' && (!a.pick || !ownsFed(s, seat, a.pick))) return 'ILLEGAL_CHOICE';
      return null;
    }
    case 'special': {
      const sa = specialActions(s, seat).find((e) => e.key === a.id);
      if (!sa) return 'ILLEGAL_CHOICE';
      if (p.used.includes(a.id)) return 'ACTION_TAKEN';
      if (sa.action.can && !sa.action.can(x)) return 'NOT_ENOUGH_RESOURCES';
      if (sa.action.targets) return a.hex !== undefined && sa.action.targets(x).includes(a.hex) ? null : 'ILLEGAL_PLACEMENT';
      return a.hex === undefined ? null : 'ILLEGAL_PLACEMENT';
    }
    case 'pass':
      if (s.round >= ROUNDS) return a.booster === undefined ? null : 'BOOSTER_UNAVAILABLE';
      return a.booster !== undefined && s.boosters.includes(a.booster) ? null : 'BOOSTER_UNAVAILABLE';
    case 'convert': {
      const c = conversions(s, seat).find((e) => e.id === a.id);
      return c && c.can(x) ? null : 'NOT_ENOUGH_RESOURCES';
    }
    case 'burn': return canBurn(p.power) ? null : 'NOT_ENOUGH_RESOURCES';
    default: return 'WRONG_PHASE';
  }
}

// ---------------- apply ----------------

function act(s: GaiaState, seat: number, a: GaiaAction, events: Events) {
  const p = s.pl[seat]!;
  const x = { s, seat };
  s.ins = 0;
  if (a.type === 'decide') {
    const d = s.pending.shift()!;
    resolveDecision(s, d, a.choice);
    events.push({ type: 'decided', seat, kind: d.kind, choice: a.choice });
    return;
  }
  switch (a.type) {
    case 'faction': chooseFaction(s, seat, a.faction); return;
    case 'place': {
      const q = s.setupQueue.shift()!;
      const h = s.hexes[a.hex]!;
      h.owner = seat; h.building = q.what;
      log(s, { t: 'place', seat, hex: a.hex, building: q.what });
      return;
    }
    case 'booster':
      s.boosters.splice(s.boosters.indexOf(a.booster), 1);
      p.booster = a.booster;
      log(s, { t: 'booster', seat, booster: a.booster });
      return;
    case 'convert':
      conversions(s, seat).find((e) => e.id === a.id)!.run(x);
      log(s, { t: 'convert', seat, id: a.id });
      return;
    case 'burn': burn(s, seat); log(s, { t: 'convert', seat, id: 'burn' }); return;
    case 'mine': buildMine(s, seat, a.hex); break;
    case 'upgrade': upgrade(s, seat, a.hex, a.to); break;
    case 'gaiaform': gaiaform(s, seat, a.hex); break;
    case 'federation': formFederation(s, seat, a.hexes, a.token); break;
    case 'research': p.k -= RESEARCH_COST; advance(s, seat, a.track); break;
    case 'power': {
      const pa = POWER_ACTIONS.find((e) => e.id === a.id)!;
      pay(s, seat, pa.cost);
      s.powerUsed.push(pa.id);
      log(s, { t: 'power', seat, action: pa.id });
      if (pa.steps) buildMine(s, seat, a.hex!, { freeSteps: pa.steps });
      else if (pa.id === 'qic1') queueTech(s, seat);
      else if (pa.id === 'qic2') gain(s, seat, CONTENT.feds[a.pick!]!.gain);
      else if (pa.id === 'qic3') vp(s, seat, 3 + planetTypes(s, seat), 'qic3');
      else gain(s, seat, POWER_GAIN[pa.id]!);
      break;
    }
    case 'special': {
      const sa = specialActions(s, seat).find((e) => e.key === a.id)!;
      p.used.push(a.id);
      log(s, { t: 'special', seat, action: a.id });
      sa.action.run(x, a.hex);
      break;
    }
    case 'pass': {
      for (const src of sources(s, seat)) src.effects.onPass?.(x);
      const old = p.booster;
      if (a.booster) { s.boosters.splice(s.boosters.indexOf(a.booster), 1); p.booster = a.booster; } else p.booster = null;
      if (old) s.boosters.push(old);
      p.passed = true;
      s.passOrder.push(seat);
      log(s, { t: 'pass', seat, booster: a.booster ?? null });
      break;
    }
    default: return;
  }
  s.turnDone = true;
}

const FREE = new Set(['convert', 'burn']);

function result(s: GaiaState, events: Events, resetDeadline: boolean): Transition<GaiaState> {
  return {
    nextState: s,
    internalEvents: events,
    scheduleChanges: s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : resetDeadline ? [{ kind: 'set', deadlineKey: 'turn' }] : []
  };
}

// ---------------- legal actions ----------------

function legalFor(s: GaiaState, seat: number): { type: string; [k: string]: unknown }[] {
  const out: { type: string; [k: string]: unknown }[] = [];
  const ok = (a: GaiaAction) => { if (!check(s, seat, a)) out.push(a); };
  if (s.pending.length) {
    const d = s.pending[0]!;
    if (d.seat === seat) for (const choice of decisionOptions(s, d)) out.push({ type: 'decide', choice });
    return out;
  }
  if (seat !== s.current) return out;
  if (s.phase === 'faction') { for (const f of availableFactions(s)) out.push({ type: 'faction', faction: f }); return out; }
  if (s.phase === 'setup') { s.hexes.forEach((_, i) => ok({ type: 'place', hex: i })); return out; }
  if (s.phase === 'booster') { for (const b of s.boosters) out.push({ type: 'booster', booster: b }); return out; }
  if (s.phase !== 'actions') return out;
  const p = s.pl[seat]!;
  s.hexes.forEach((h, i) => {
    if (h.planet !== 'e') ok({ type: 'mine', hex: i });
    if (h.owner === seat && h.building) for (const to of UPGRADES[h.building] ?? []) ok({ type: 'upgrade', hex: i, to });
    if (h.planet === 'm' && h.owner === null) ok({ type: 'gaiaform', hex: i });
  });
  const tokens = fedTokensAvailable(s);
  for (const hexes of suggestFederations(s, seat)) for (const token of tokens) out.push({ type: 'federation', hexes, token });
  for (const track of TRACKS) ok({ type: 'research', track });
  for (const pa of POWER_ACTIONS) {
    if (pa.steps) { if (!s.powerUsed.includes(pa.id) && canPay(s, seat, pa.cost)) s.hexes.forEach((h, i) => { if (h.planet !== 'e') ok({ type: 'power', id: pa.id, hex: i }); }); }
    else if (pa.id === 'qic2') for (const f of new Set(p.feds.map((e) => e.id))) ok({ type: 'power', id: pa.id, pick: f });
    else ok({ type: 'power', id: pa.id });
  }
  for (const sa of specialActions(s, seat)) {
    if (p.used.includes(sa.key) || (sa.action.can && !sa.action.can({ s, seat }))) continue;
    if (sa.action.targets) for (const t of sa.action.targets({ s, seat })) out.push({ type: 'special', id: sa.key, hex: t });
    else out.push({ type: 'special', id: sa.key });
  }
  if (s.round >= ROUNDS) out.push({ type: 'pass' });
  else for (const b of s.boosters) out.push({ type: 'pass', booster: b });
  for (const c of conversions(s, seat)) if (c.can({ s, seat })) out.push({ type: 'convert', id: c.id });
  if (canBurn(p.power)) out.push({ type: 'burn' });
  return out;
}

/** First legal default for timeouts: decline leech / first option / pass with the first booster. */
function defaultAction(s: GaiaState, seat: number): GaiaAction | null {
  if (s.pending.length) {
    const opts = decisionOptions(s, s.pending[0]!);
    return { type: 'decide', choice: opts.includes('decline') ? 'decline' : opts[0]! };
  }
  if (s.phase === 'faction') return { type: 'faction', faction: availableFactions(s)[0]! };
  if (s.phase === 'setup') {
    const i = s.hexes.findIndex((h) => h.owner === null && h.planet === factionOf(s, seat).home);
    return i >= 0 ? { type: 'place', hex: i } : null;
  }
  if (s.phase === 'booster') return { type: 'booster', booster: s.boosters[0]! };
  if (s.phase === 'actions') return s.round >= ROUNDS ? { type: 'pass' } : { type: 'pass', booster: s.boosters[0]! };
  return null;
}

// ---------------- tutorial position ----------------

/** Hex ids of the fixed tutorial map (2-player sectors in printed order, unrotated). */
export const TUTORIAL_HEX = { pi: 6, lab: 13, mine: 5, sat: 14 } as const;

/**
 * Round 6 of a two-player game: the learner (seat 0, Hadsch Hallas) has a planetary institute and a lab one empty
 * hex apart, the opponent (Geodens) builds far away and passes. Teaches mine + terraforming, trading station,
 * federation with a satellite, research and a power action, then the final scoring.
 */
function tutorialSetup(s: GaiaState) {
  s.placements = SMALL_SECTORS.map((sector, i) => ({ sector, rotation: 0, center: SMALL_CENTERS[i]! }));
  s.hexes = buildMap(s.placements).map((h) => ({ ...h, owner: null, building: null, extra: null, sats: [], feds: [] }));
  chooseFaction(s, 0, 'hadsch-hallas');
  chooseFaction(s, 1, 'geodens');
  const put = (seat: number, hex: number, b: 'mine' | 'ts' | 'lab' | 'pi') => Object.assign(s.hexes[hex]!, { owner: seat, building: b });
  put(0, TUTORIAL_HEX.pi, 'pi'); put(0, TUTORIAL_HEX.lab, 'lab'); put(0, 45, 'mine'); put(0, 22, 'mine');
  put(1, 73, 'pi'); put(1, 66, 'ts'); put(1, 83, 'mine'); put(1, 110, 'mine'); put(1, 57, 'mine');
  Object.assign(s.pl[0]!, { c: 9, o: 6, k: 5, q: 1, vp: 66, booster: 'b7', research: { terra: 0, nav: 1, ai: 1, gaia: 0, eco: 2, sci: 1 } });
  s.pl[0]!.power = { b1: 1, b2: 4, b3: 1, gaia: 0, brain: null };
  Object.assign(s.pl[1]!, { c: 4, o: 2, k: 2, q: 0, vp: 74, booster: 'b6', research: { terra: 3, nav: 2, ai: 1, gaia: 0, eco: 1, sci: 2 } });
  s.pl[1]!.power = { b1: 3, b2: 3, b3: 0, gaia: 0, brain: null };
  s.boosters = ['b1', 'b3', 'b9'];
  s.roundTiles = ['r1', 'r2', 'r5', 'r7', 'r4', 'r3'];
  s.finalTiles = ['f1', 'f3'];
  s.terraFed = 'fed6';
  s.fedSupply = { fed1: 3, fed2: 3, fed3: 3, fed4: 3, fed5: 3, fed6: 2 };
  s.order = [0, 1];
  s.current = 0;
  s.phase = 'actions';
  s.round = 6;
  log(s, { t: 'round', round: 6 });
}

export const pendingSeats = (s: GaiaState): number[] =>
  s.outcome ? [] : s.pending.length ? [s.pending[0]!.seat] : s.phase === 'finished' ? [] : [s.current];

// ---------------- module ----------------

export const gaiaProjectModule: GameModule<GaiaState, GaiaAction, GaiaView> = {
  manifest: gaiaProject.manifest,
  actionSchema: gaiaAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('gaia-project needs 2–4 players');
    const map = randomMap(playerCount, rng);
    const std = shuffle(Object.values(CONTENT.techs).filter((t) => t.kind === 'std').map((t) => t.id), rng);
    const adv = shuffle(Object.values(CONTENT.techs).filter((t) => t.kind === 'adv').map((t) => t.id), rng).slice(0, 6);
    const fedSupply = Object.fromEntries(Object.values(CONTENT.feds).filter((f) => f.copies > 0).map((f) => [f.id, f.copies]));
    const fedIds = Object.keys(fedSupply);
    const terraFed = fedIds.length ? fedIds[rng.nextInt(fedIds.length)]! : null;
    if (terraFed) fedSupply[terraFed]! -= 1;
    const first = rng.nextInt(playerCount);
    const s: GaiaState = {
      players: playerCount,
      options: { factions: options.factions === 'random' ? 'random' : 'choose' },
      active: Array<boolean>(playerCount).fill(true),
      left: [],
      placements: map.placements,
      hexes: map.hexes.map((h) => ({ ...h, owner: null, building: null, extra: null, sats: [], feds: [] })),
      phase: 'faction',
      round: 0,
      order: Array.from({ length: playerCount }, (_, i) => (first + i) % playerCount),
      passOrder: [],
      current: first,
      setupQueue: [],
      pending: [],
      ins: 0,
      turnDone: false,
      techBoard: { std: Array.from({ length: 9 }, (_, i) => std[i] ?? null), adv: Array.from({ length: 6 }, (_, i) => adv[i] ?? null) },
      advPos: Object.fromEntries(adv.map((t, i) => [t, i])),
      boosters: shuffle(Object.keys(CONTENT.boosters), rng).slice(0, playerCount + 3),
      roundTiles: shuffle(Object.keys(CONTENT.rounds), rng).slice(0, ROUNDS),
      finalTiles: shuffle(Object.keys(CONTENT.finals), rng).slice(0, 2),
      fedSupply,
      terraFed,
      powerUsed: [],
      pl: Array.from({ length: playerCount }, newPlayer),
      log: [],
      seq: 0,
      outcome: null
    };
    if (options.setup === 'tutorial') { tutorialSetup(s); return s; }
    if (s.options.factions === 'random') {
      for (const seat of s.order) {
        const pool = availableFactions(s);
        if (!pool.length) throw new Error('not enough factions with distinct home planets');
        chooseFaction(s, seat, pool[rng.nextInt(pool.length)]!);
      }
    }
    flow(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.active[actor.seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    if (a.type === 'resign') return { ok: true };
    const e = check(s, actor.seat, a);
    return e ? { ok: false, errorCode: e } : { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const events: Events = [];
    if (a.type === 'resign') {
      removeSeat(s, seat, 'resign');
      events.push({ type: 'resigned', seat });
      flow(s);
      return result(s, events, true);
    }
    s.pl[seat]!.timeouts = 0;
    act(s, seat, a, events);
    flow(s);
    return result(s, events, !FREE.has(a.type));
  },

  project(s, viewer) {
    void viewer; // All Gaia Project information is public; the RNG never leaves the engine snapshot.
    const { ins, turnDone, ...rest } = structuredClone(s);
    void ins; void turnDone;
    const d = s.pending[0];
    return {
      ...rest,
      decision: d ? { ...structuredClone(d), options: decisionOptions(s, d) } : null,
      income: s.pl.map((p, seat) => (p.faction && s.active[seat] ? incomeOf(s, seat) : {}))
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    return [...legalFor(s, viewer.seat), { type: 'resign' }];
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    const events: Events = [];
    if (s.outcome) return result(s, events, false);
    const seat = pendingSeats(s)[0];
    if (seat === undefined) return result(s, events, true);
    const p = s.pl[seat]!;
    p.timeouts += 1;
    log(s, { t: 'timeout', seat });
    events.push({ type: 'timed-out', seat });
    if (p.timeouts >= MAX_TIMEOUTS) removeSeat(s, seat, 'timeout');
    else {
      const a = defaultAction(s, seat);
      if (a && !check(s, seat, a)) act(s, seat, a, events);
      else removeSeat(s, seat, 'timeout');
    }
    flow(s);
    return result(s, events, true);
  },

  pendingSeats,

  tutorial: {
    seed: 11,
    options: { setup: 'tutorial' },
    introFa: 'دور ششم و آخرِ یک بازی دونفره است. شما هادش هالا هستید (سیارهٔ خانه: اکسیدیِ قرمز) با ۶۶ امتیاز و حریف (ژئودن‌ها) ۷۴ امتیاز دارد. مؤسسهٔ سیاره‌ای و آزمایشگاه پژوهشی شما در بخش ۱ نقشه‌اند و یک خانهٔ خالی میانشان فاصله است. در هر نوبت یک اقدام اصلی انجام می‌دهید (به‌علاوهٔ هر تعداد تبدیل آزاد)؛ وقتی همه پاس بدهند دور تمام می‌شود و پس از دور ششم امتیاز پایانی شمرده می‌شود.',
    steps: [
      {
        instructionFa: 'روی سیارهٔ آتشفشانیِ نارنجی کنار مؤسسهٔ سیاره‌ای خود معدن بسازید (خانهٔ مشخص‌شده را بزنید). آتشفشانی روی چرخهٔ زمین‌سازی یک گام با اکسید فاصله دارد و در سطح ۰ زمین‌سازی هر گام ۳ سنگ معدن می‌خواهد؛ پس هزینه ۲ اعتبار و ۱ + ۳ = ۴ سنگ معدن است. کاشی امتیاز این دور برای هر معدن ۲ امتیاز می‌دهد.',
        expected: { type: 'mine', hex: TUTORIAL_HEX.mine },
        reply: { type: 'pass' }
      },
      {
        instructionFa: 'حریف پاس داد؛ تا پایان دور فقط شما بازی می‌کنید. معدن تازه را به ایستگاه تجاری ارتقا دهید. چون هیچ سازهٔ حریف در فاصلهٔ ۲ خانه‌ای نیست، هزینه ۶ اعتبار و ۲ سنگ معدن است (با همسایه فقط ۳ اعتبار می‌شد).',
        expected: { type: 'upgrade', hex: TUTORIAL_HEX.mine, to: 'ts' },
        reply: null
      },
      {
        instructionFa: 'فدراسیون بسازید: مؤسسهٔ سیاره‌ای (ارزش قدرت ۳)، ایستگاه تجاری (۲) و آزمایشگاه (۲) روی هم ۷ می‌شوند که حداقلِ لازم است. خانهٔ خالیِ میان ایستگاه و آزمایشگاه با یک ماهواره پر می‌شود که ۱ ژتون قدرت هزینه دارد. توکن «۱۲ امتیاز» را انتخاب کنید.',
        expected: { type: 'federation', hexes: [TUTORIAL_HEX.mine, TUTORIAL_HEX.pi, TUTORIAL_HEX.lab, TUTORIAL_HEX.sat], token: 'fed1' },
        reply: null
      },
      {
        instructionFa: 'با ۴ دانش در مسیر اقتصاد از سطح ۲ به ۳ بروید. رسیدن به سطح ۳ هر مسیر ۳ قدرت شارژ می‌کند و در پایان بازی هر سطحِ بالاتر از ۲ در هر مسیر ۴ امتیاز می‌دهد.',
        expected: { type: 'research', track: 'eco' },
        reply: null
      },
      {
        instructionFa: 'شارژ قدرت ۳ ژتون را از کاسهٔ II به کاسهٔ III برد و حالا ۴ ژتون در کاسهٔ III دارید. اقدام قدرت «۴ قدرت ← ۷ اعتبار» را بزنید؛ ژتون‌های خرج‌شده به کاسهٔ I برمی‌گردند. هر اقدام قدرت در هر دور فقط یک بار (برای همهٔ بازیکنان روی هم) انجام می‌شود.',
        expected: { type: 'power', id: 'pw4' },
        reply: null
      },
      {
        instructionFa: 'پاس بدهید. تقویت‌کنندهٔ شما هنگام پاس برای هر ایستگاه تجاری ۲ امتیاز می‌دهد. این دور ششم است، پس با پاسِ همه بازی تمام می‌شود و امتیاز پایانی شمرده می‌شود.',
        expected: { type: 'pass' },
        reply: null
      }
    ],
    completedFa: 'بردید: ۱۰۷ در برابر ۱۰۲! معدن روی کاشی دور ۲ امتیاز داد، فدراسیون ۱۲ امتیاز و پاس با تقویت‌کننده ۲ امتیاز. در امتیاز پایانی هر دو نفر ۵ سازه و ۴ نوع سیاره داشتید و بازیکن خنثی (۱۱ سازه، ۵ نوع سیاره) اول شد؛ پس جایزه‌های ۱۲ و ۶ تقسیم شد و هر کدام در هر کاشی ۹ امتیاز گرفتید. سطح ۳ اقتصاد ۴ امتیاز داد و ۱۰ منبع باقی‌مانده (۸ اعتبار، ۱ دانش، ۱ QIC) ۳ امتیاز.'
  }
};
