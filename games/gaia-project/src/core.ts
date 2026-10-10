// Gaia Project engine core: resources, power cycle, research, building, leech, gaiaforming, federations, tech
// tiles, decisions and event dispatch. Pure functions over a mutable GaiaState draft (rules.ts clones per step).
// Content files (src/content/*) import these helpers; this file never imports content (the registry is filled
// by src/content/index.ts at load time).
import { hexDistance, hexIndex, neighbors, wheelDistance } from './map.ts';
import {
  LIMIT, TRACKS,
  type BoosterDef, type Building, type ContentBundle, type Decision, type Effects, type FactionDef, type FactionFlags,
  type FedTokenDef, type FinalTileDef, type Gain, type GaiaState, type GameEvent, type HexState, type LogEntry,
  type Power, type RoundTileDef, type SpecialAction, type TechDef, type Track, type X
} from './types.ts';

// ---------------- content registry ----------------

export const CONTENT = {
  factions: {} as Record<string, FactionDef>,
  techs: {} as Record<string, TechDef>,
  boosters: {} as Record<string, BoosterDef>,
  rounds: {} as Record<string, RoundTileDef>,
  finals: {} as Record<string, FinalTileDef>,
  feds: {} as Record<string, FedTokenDef>
};

export function registerContent(...bundles: ContentBundle[]) {
  for (const b of bundles) {
    for (const [kind, list] of Object.entries(b) as [keyof typeof CONTENT, { id: string }[]][]) {
      const reg = CONTENT[kind] as Record<string, { id: string }>;
      for (const item of list) {
        if (reg[item.id]) throw new Error(`gaia-project: duplicate ${kind} id ${item.id}`);
        reg[item.id] = item;
      }
    }
  }
}

// ---------------- log ----------------

const LOG_SIZE = 80;
export function log(s: GaiaState, e: LogEntry) {
  s.seq += 1;
  s.log.push({ ...e, seq: s.seq });
  if (s.log.length > LOG_SIZE) s.log.splice(0, s.log.length - LOG_SIZE);
}

// ---------------- factions / structures ----------------

export function factionOf(s: GaiaState, seat: number): FactionDef {
  const id = s.pl[seat]!.faction;
  const f = id ? CONTENT.factions[id] : undefined;
  if (!f) throw new Error(`seat ${seat} has no faction`);
  return f;
}
export const flag = (s: GaiaState, seat: number, k: keyof FactionFlags) => {
  const id = s.pl[seat]!.faction;
  return !!(id && CONTENT.factions[id]?.flags?.[k]);
};

const STRUCTURE = new Set<Building>(['mine', 'ts', 'lab', 'pi', 'ac1', 'ac2']);
/** The seat has a structure here (gaiaformers and space stations do not count). */
export const colonized = (h: HexState, seat: number) =>
  (h.owner === seat && h.building !== null && STRUCTURE.has(h.building)) || h.extra === seat;
/** Hex ids colonized by the seat (incl. Lantids' extra mines and the Lost Planet). */
export const structuresOf = (s: GaiaState, seat: number) => s.hexes.flatMap((h, i) => (colonized(h, seat) ? [i] : []));
/** Building the seat has on this hex (Lantids' extra mine counts as a mine). */
export function buildingAt(s: GaiaState, seat: number, hex: number): Building | null {
  const h = s.hexes[hex]!;
  if (h.extra === seat) return 'mine';
  return h.owner === seat ? h.building : null;
}

/** Count of a building type for the seat. Mines exclude the Lost Planet (not from the mine supply). */
export function countBuilding(s: GaiaState, seat: number, b: Building | 'ac'): number {
  let n = 0;
  for (const h of s.hexes) {
    if (b === 'mine') { if ((h.owner === seat && h.building === 'mine' && h.planet !== 'l') || h.extra === seat) n++; }
    else if (h.owner === seat && (h.building === b || (b === 'ac' && (h.building === 'ac1' || h.building === 'ac2')))) n++;
  }
  return n;
}
export const hasPI = (s: GaiaState, seat: number) => s.hexes.some((h) => h.owner === seat && h.building === 'pi');
export const planetTypes = (s: GaiaState, seat: number) => new Set(structuresOf(s, seat).map((i) => s.hexes[i]!.planet)).size;
export const sectorsOf = (s: GaiaState, seat: number) => new Set(structuresOf(s, seat).map((i) => s.hexes[i]!.sector)).size;
export const gaiaPlanets = (s: GaiaState, seat: number) => structuresOf(s, seat).filter((i) => s.hexes[i]!.planet === 'g').length;
export const activeSeats = (s: GaiaState) => s.active.flatMap((a, i) => (a ? [i] : []));

const BASE_VALUE: Record<Building, number> = { mine: 1, ts: 2, lab: 2, pi: 3, ac1: 3, ac2: 3, gf: 0, station: 0 };
/** Power value of the seat's structure on a hex (federations count a space station as 1). */
export function powerValue(s: GaiaState, seat: number, hex: number, forFederation = false): number {
  const b = buildingAt(s, seat, hex);
  if (!b) return 0;
  if (b === 'station') return forFederation ? 1 : 0;
  let v = BASE_VALUE[b];
  if (v === 0) return 0;
  for (const src of sources(s, seat)) if (src.effects.powerValue) v = src.effects.powerValue({ s, seat }, hex, v);
  return v;
}

// ---------------- effect sources & events ----------------

export interface Source { id: string; effects: Effects }
/** Every effect currently active for the seat: faction, held booster, uncovered tech tiles. */
export function sources(s: GaiaState, seat: number): Source[] {
  const p = s.pl[seat]!;
  const out: Source[] = [];
  const f = p.faction ? CONTENT.factions[p.faction] : undefined;
  if (f?.effects) out.push({ id: `faction:${f.id}`, effects: f.effects });
  const b = p.booster ? CONTENT.boosters[p.booster] : undefined;
  if (b?.effects) out.push({ id: `booster:${b.id}`, effects: b.effects });
  for (const t of p.techs) {
    const def = CONTENT.techs[t.id];
    if (def && !t.covered) out.push({ id: `tech:${t.id}`, effects: def.effects });
  }
  return out;
}
export function sourceEffects(id: string): Effects | undefined {
  const [kind, key] = id.split(':') as [string, string];
  if (kind === 'faction') return CONTENT.factions[key]?.effects;
  if (kind === 'booster') return CONTENT.boosters[key]?.effects;
  if (kind === 'tech') return CONTENT.techs[key]?.effects;
  return undefined;
}

/** Dispatch an event of the seat to its effects and to the current round scoring tile. */
export function fire(s: GaiaState, seat: number, e: GameEvent) {
  const x = { s, seat };
  for (const src of sources(s, seat)) (src.effects.on?.[e.kind] as ((x: X, e: GameEvent) => void) | undefined)?.(x, e);
  if (s.phase === 'actions' && s.round >= 1) {
    const tile = CONTENT.rounds[s.roundTiles[s.round - 1] ?? ''];
    (tile?.on[e.kind] as ((x: X, e: GameEvent) => void) | undefined)?.(x, e);
  }
}

// ---------------- resources ----------------

/** Resource track maxima printed on the faction board. */
export const CAP = { c: 30, o: 15, k: 15 } as const;
export function vp(s: GaiaState, seat: number, n: number, why: string) {
  if (!n) return;
  s.pl[seat]!.vp += n;
  log(s, { t: 'vp', seat, n, why });
}

/** Gain resources (tokens are added before power is charged). */
export function gain(s: GaiaState, seat: number, g: Gain) {
  const p = s.pl[seat]!;
  for (const k of ['c', 'o', 'k'] as const) if (g[k]) p[k] = Math.max(0, Math.min(CAP[k], p[k] + g[k]));
  if (g.q) {
    if (flag(s, seat, 'qicAsOreUntilAc2') && s.phase !== 'faction' && countBuilding(s, seat, 'ac2') === 0) p.o = Math.min(CAP.o, p.o + g.q);
    else p.q += g.q;
  }
  if (g.vp) p.vp += g.vp;
  if (g.t) addTokens(s, seat, g.t);
  if (g.pw) charge(s, seat, g.pw);
}
export const addGains = (a: Gain, b: Gain): Gain => {
  const out: Gain = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Gain, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
};

export function canPay(s: GaiaState, seat: number, cost: Gain): boolean {
  const p = s.pl[seat]!;
  return (cost.c ?? 0) <= p.c && (cost.o ?? 0) <= p.o && (cost.k ?? 0) <= p.k && (cost.q ?? 0) <= p.q
    && (cost.vp ?? 0) <= p.vp && (cost.pw ?? 0) <= spendable(s, seat) && (cost.t ?? 0) <= tokens(s.pl[seat]!.power);
}
export function pay(s: GaiaState, seat: number, cost: Gain) {
  const p = s.pl[seat]!;
  p.c -= cost.c ?? 0; p.o -= cost.o ?? 0; p.k -= cost.k ?? 0; p.q -= cost.q ?? 0; p.vp -= cost.vp ?? 0;
  if (cost.pw) spendPower(s, seat, cost.pw);
  if (cost.t) removeTokens(s, seat, cost.t);
}

// ---------------- power cycle ----------------

/** Tokens in bowls I–III (the brainstone is not a removable token). */
export const tokens = (pw: Power) => pw.b1 + pw.b2 + pw.b3;
const bowl3Value = (s: GaiaState, seat: number) => (flag(s, seat, 'bowl3DoubleAfterPI') && hasPI(s, seat) ? 2 : 1);
/** Power that can be spent from bowl III (brainstone = 3). */
export function spendable(s: GaiaState, seat: number): number {
  const pw = s.pl[seat]!.power;
  return pw.b3 * bowl3Value(s, seat) + (pw.brain === 3 ? 3 : 0);
}
/** Spend power: bowl III → bowl I. The brainstone is used when it is needed or the cost is at least 3. */
export function spendPower(s: GaiaState, seat: number, n: number) {
  const pw = s.pl[seat]!.power;
  const mult = bowl3Value(s, seat);
  let need = n;
  // ponytail: fixed brainstone heuristic instead of asking the Taklons player; add a choice if players need it.
  if (pw.brain === 3 && (need >= 3 || pw.b3 * mult < need)) { pw.brain = 1; need -= 3; }
  if (need > 0) {
    const t = Math.ceil(need / mult);
    if (t > pw.b3) throw new Error('not enough power');
    pw.b3 -= t; pw.b1 += t;
  }
}
function chargeInto(pw: Power, n: number): number {
  let left = n, done = 0;
  if (left > 0 && pw.brain === 1) { pw.brain = 2; left--; done++; }
  const a = Math.min(pw.b1, left); pw.b1 -= a; pw.b2 += a; left -= a; done += a;
  if (left > 0 && pw.brain === 2) { pw.brain = 3; left--; done++; }
  const b = Math.min(pw.b2, left); pw.b2 -= b; pw.b3 += b; done += b;
  return done;
}
/** Charge power: bowl I → II first, then II → III. Returns the power actually charged. */
export const charge = (s: GaiaState, seat: number, n: number) => chargeInto(s.pl[seat]!.power, n);
export const chargeable = (s: GaiaState, seat: number, n: number) => chargeInto({ ...s.pl[seat]!.power }, n);
export function addTokens(s: GaiaState, seat: number, n: number) { s.pl[seat]!.power.b1 += n; }
/** Remove tokens from the cycle, lowest bowl first. Returns how many were removed. */
export function removeTokens(s: GaiaState, seat: number, n: number): number {
  const pw = s.pl[seat]!.power;
  let left = n;
  for (const b of ['b1', 'b2', 'b3'] as const) { const k = Math.min(pw[b], left); pw[b] -= k; left -= k; }
  return n - left;
}
export function moveToGaia(s: GaiaState, seat: number, n: number) { s.pl[seat]!.power.gaia += removeTokens(s, seat, n); }
export const canBurn = (pw: Power) => pw.b2 >= 2 || (pw.brain === 2 && pw.b2 >= 1);
/** Burn: one token of bowl II leaves the cycle (Itars: to the gaia area), another (or the brainstone) goes to III. */
export function burn(s: GaiaState, seat: number) {
  const pw = s.pl[seat]!.power;
  if (pw.brain === 2) { pw.brain = 3; pw.b2 -= 1; }
  else { pw.b2 -= 2; pw.b3 += 1; }
  if (flag(s, seat, 'burnToGaia')) pw.gaia += 1;
}

// ---------------- research ----------------

export const RANGE = [1, 1, 2, 2, 3, 4];
export const TERRAFORM_ORE = [3, 3, 2, 1, 1, 1];
export const GAIA_TOKENS = (level: number) => (level >= 4 ? 3 : level >= 3 ? 4 : 6);
export const RESEARCH_INCOME: Record<'eco' | 'sci', Gain[]> = {
  eco: [{}, { c: 2, pw: 1 }, { c: 2, o: 1, pw: 2 }, { c: 3, o: 1, pw: 3 }, { c: 4, o: 2, pw: 4 }, {}],
  sci: [{}, { k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, {}]
};
export const RESEARCH_COST = 4;

export const hasGreenFed = (s: GaiaState, seat: number) => s.pl[seat]!.feds.some((f) => f.green);
/** Why the seat cannot advance on the track, or null. */
export function researchBlock(s: GaiaState, seat: number, track: Track): string | null {
  const lvl = s.pl[seat]!.research[track];
  if (lvl >= 5) return 'RESEARCH_BLOCKED';
  if (track === 'nav' && flag(s, seat, 'noNavigationUntilPI') && !hasPI(s, seat)) return 'RESEARCH_BLOCKED';
  if (lvl === 4 && (!hasGreenFed(s, seat) || s.pl.some((p) => p.research[track] === 5))) return 'RESEARCH_BLOCKED';
  return null;
}

/** Advance one level and take that level's reward (caller checked `researchBlock`). */
export function advance(s: GaiaState, seat: number, track: Track, quiet = false) {
  const p = s.pl[seat]!;
  const lvl = ++p.research[track];
  if (lvl === 5 && !quiet) { const f = p.feds.find((x) => x.green); if (f) f.green = false; }
  if (lvl === 3) charge(s, seat, 3);
  switch (track) {
    case 'terra':
      if (lvl === 1 || lvl === 4) gain(s, seat, { o: 2 });
      if (lvl === 5 && s.terraFed) { const id = s.terraFed; s.terraFed = null; gainFedToken(s, seat, id); }
      break;
    case 'nav':
      if (lvl === 1 || lvl === 3) gain(s, seat, { q: 1 });
      if (lvl === 5 && lostPlanetHexes(s, seat).length) pushDecision(s, { kind: 'lostPlanet', seat });
      break;
    case 'ai': gain(s, seat, { q: [0, 1, 1, 2, 2, 4][lvl]! }); break;
    case 'gaia':
      if (lvl === 1 || lvl === 3 || lvl === 4) p.gf += 1;
      if (lvl === 2) addTokens(s, seat, 3);
      if (lvl === 5) gain(s, seat, { vp: 4 + gaiaPlanets(s, seat) });
      break;
    case 'eco': if (lvl === 5) gain(s, seat, { c: 6, o: 3, pw: 6 }); break;
    case 'sci': if (lvl === 5) gain(s, seat, { k: 9 }); break;
  }
  if (!quiet) {
    log(s, { t: 'research', seat, track, level: lvl });
    fire(s, seat, { kind: 'research', track, level: lvl });
  }
}

/** Queue a free advance on one of `tracks` (null = any). Skipped when no track can advance. */
export function queueResearch(s: GaiaState, seat: number, tracks: Track[] | null = null) {
  if ((tracks ?? TRACKS).some((t) => !researchBlock(s, seat, t))) pushDecision(s, { kind: 'research', seat, tracks });
}

// ---------------- decisions ----------------

/** Insert a decision for the step being resolved (before later-queued leeches). */
export function pushDecision(s: GaiaState, d: Decision) { s.pending.splice(s.ins++, 0, d); }

export function decisionOptions(s: GaiaState, d: Decision): string[] {
  const x = { s, seat: d.seat };
  switch (d.kind) {
    case 'leech': {
      const custom = sources(s, d.seat).find((src) => src.effects.leech)?.effects.leech;
      return custom ? custom.options(x, d.amount) : ['accept', 'decline'];
    }
    case 'tech': return techOptions(s, d.seat);
    case 'cover': return s.pl[d.seat]!.techs.filter((t) => !t.covered && CONTENT.techs[t.id]?.kind === 'std').map((t) => t.id);
    case 'research': return (d.tracks ?? [...TRACKS]).filter((t) => !researchBlock(s, d.seat, t));
    case 'lostPlanet': return lostPlanetHexes(s, d.seat).map(String);
    case 'custom': return d.options;
  }
}

/** Leech amount the seat can actually take now: limited by chargeable power and VP (cost = amount − 1). */
export const leechAmount = (s: GaiaState, seat: number, offered: number) =>
  Math.min(offered, chargeable(s, seat, offered), s.pl[seat]!.vp + 1);
/** Accept a leech: charge and pay VP. Exposed for faction overrides (Taklons). */
export function takeLeech(s: GaiaState, seat: number, offered: number) {
  const n = charge(s, seat, leechAmount(s, seat, offered));
  const cost = Math.max(0, n - 1);
  s.pl[seat]!.vp -= cost;
  log(s, { t: 'leech', seat, amount: n, vp: cost });
}

export function resolveDecision(s: GaiaState, d: Decision, choice: string) {
  const x = { s, seat: d.seat };
  switch (d.kind) {
    case 'leech': {
      const custom = sources(s, d.seat).find((src) => src.effects.leech)?.effects.leech;
      if (custom) custom.resolve(x, d.amount, choice);
      else if (choice === 'accept') takeLeech(s, d.seat, d.amount);
      else log(s, { t: 'decline', seat: d.seat });
      break;
    }
    case 'tech': takeTech(s, d.seat, choice); break;
    case 'cover': {
      s.pl[d.seat]!.techs.find((t) => t.id === choice && !t.covered)!.covered = true;
      const track = TRACKS[s.advPos[d.adv] ?? 0]!;
      if (!researchBlock(s, d.seat, track)) advance(s, d.seat, track);
      break;
    }
    case 'research': advance(s, d.seat, choice as Track); break;
    case 'lostPlanet': placeLostPlanet(s, d.seat, Number(choice)); break;
    case 'custom': {
      const h = sourceEffects(d.source)?.decide?.[d.key];
      if (!h) throw new Error(`no handler for ${d.source}/${d.key}`);
      h(x, choice, d);
      break;
    }
  }
}

// ---------------- map helpers ----------------

export const dist = (s: GaiaState, a: number, b: number) => hexDistance(s.hexes[a]!, s.hexes[b]!);
/** Hex ids within `d` of `hex` (including itself). */
export const within = (s: GaiaState, hex: number, d: number) => s.hexes.flatMap((_, i) => (dist(s, hex, i) <= d ? [i] : []));
export function adjacent(s: GaiaState, hex: number): number[] { return neighbors(s.hexes, hexIndex(s.hexes), hex); }

/** Navigation range of the seat. */
export const range = (s: GaiaState, seat: number) => RANGE[s.pl[seat]!.research.nav]!;
/** Distance from the seat's nearest structure or space station. */
export function distanceFrom(s: GaiaState, seat: number, hex: number): number {
  let best = Infinity;
  s.hexes.forEach((h, i) => {
    if (colonized(h, seat) || (h.owner === seat && h.building === 'station')) best = Math.min(best, dist(s, hex, i));
  });
  return best;
}
/** QIC needed to reach a hex (each QIC adds 2 range). */
export function qicFor(s: GaiaState, seat: number, hex: number, extraRange = 0): number {
  const over = distanceFrom(s, seat, hex) - range(s, seat) - extraRange;
  return over <= 0 ? 0 : Math.ceil(over / 2);
}
/** No other player's structure within distance 2 (trading station costs 6 instead of 3 credits). */
export function isolated(s: GaiaState, seat: number, hex: number): boolean {
  return !within(s, hex, 2).some((i) => {
    const h = s.hexes[i]!;
    return (h.owner !== null && h.owner !== seat && colonized(h, h.owner)) || (h.extra !== null && h.extra !== seat);
  });
}

// ---------------- building ----------------

export interface MineOpts { freeSteps?: number; extraRange?: number; /** Paid together with the mine (power actions). */ extraCost?: Gain }
export interface MinePlan { cost: Gain; steps: number; extra: boolean }

/** Cost of building a mine, or an error code. */
export function minePlan(s: GaiaState, seat: number, hex: number, opts: MineOpts = {}): MinePlan | string {
  const h = s.hexes[hex];
  if (!h || h.planet === 'e' || h.planet === 'l') return 'ILLEGAL_PLACEMENT';
  if (countBuilding(s, seat, 'mine') >= LIMIT.mine) return 'NO_PIECES';
  const f = factionOf(s, seat);
  let steps = 0, gaiaQic = 0, extra = false, reached = false;
  if (h.owner === null) {
    if (h.planet === 'm') return 'ILLEGAL_PLACEMENT';
    if (h.planet === 'g') gaiaQic = 1;
    else steps = wheelDistance(f.home, h.planet);
  } else if (h.owner === seat && h.building === 'gf') {
    if (h.planet !== 'g') return 'GAIA_NOT_READY';
    reached = true; // your gaiaformer is already there: no range needed
  } else if (h.owner !== seat && flag(s, seat, 'sharePlanets') && colonized(h, h.owner) && h.extra === null) {
    extra = true;
  } else return 'CELL_OCCUPIED';
  // Free terraforming steps (power actions, booster) must terraform: not on gaia, home-type or shared planets.
  if (opts.freeSteps && steps === 0) return 'ILLEGAL_PLACEMENT';
  const paid = Math.max(0, steps - (opts.freeSteps ?? 0));
  const ore = BUILD_COST.mine.o + paid * TERRAFORM_ORE[s.pl[seat]!.research.terra]!;
  const q = gaiaQic + (reached ? 0 : qicFor(s, seat, hex, opts.extraRange ?? 0));
  let cost: Gain = { c: BUILD_COST.mine.c, o: ore };
  if (q) cost.q = q;
  for (const src of sources(s, seat)) if (src.effects.mineCost) cost = src.effects.mineCost({ s, seat }, hex, cost);
  return canPay(s, seat, opts.extraCost ? addGains(cost, opts.extraCost) : cost) ? { cost, steps, extra } : 'NOT_ENOUGH_RESOURCES';
}

export function buildMine(s: GaiaState, seat: number, hex: number, opts: MineOpts = {}) {
  const plan = minePlan(s, seat, hex, opts);
  if (typeof plan === 'string') throw new Error(plan);
  pay(s, seat, plan.cost);
  const h = s.hexes[hex]!;
  const before = structuresOf(s, seat);
  const newType = !before.some((i) => s.hexes[i]!.planet === h.planet);
  const newSector = !before.some((i) => s.hexes[i]!.sector === h.sector);
  if (plan.extra) h.extra = seat;
  else { h.owner = seat; h.building = 'mine'; }
  log(s, { t: 'mine', seat, hex, steps: plan.steps, ...(plan.extra ? { extra: true } : {}) });
  if (plan.steps) fire(s, seat, { kind: 'terraform', steps: plan.steps });
  fire(s, seat, { kind: 'mine', hex, planet: h.planet, gaia: !plan.extra && h.planet === 'g', newType, newSector, extra: plan.extra });
  joinFederation(s, seat, hex);
  queueLeech(s, seat, hex);
}

/** Printed structure costs (mine: plus terraforming ore and range QIC; trading station: 6 credits with no neighbour). */
export const BUILD_COST = {
  mine: { c: 2, o: 1 }, ts: { c: 3, o: 2 }, tsAlone: { c: 6, o: 2 }, lab: { c: 5, o: 3 }, pi: { c: 6, o: 4 }, ac: { c: 6, o: 6 }
} as const satisfies Record<string, Gain>;
export const UPGRADES: Partial<Record<Building, ('ts' | 'lab' | 'pi' | 'ac1' | 'ac2')[]>> = { mine: ['ts'], ts: ['lab', 'pi'], lab: ['ac1', 'ac2'] };

export function upgradeCost(s: GaiaState, seat: number, hex: number, to: 'ts' | 'lab' | 'pi' | 'ac1' | 'ac2'): Gain | string {
  const h = s.hexes[hex];
  if (!h || h.owner !== seat || !h.building || h.planet === 'l' || !UPGRADES[h.building]?.includes(to)) return 'ILLEGAL_PLACEMENT';
  const f = factionOf(s, seat);
  const full = to === 'ts' ? countBuilding(s, seat, 'ts') >= LIMIT.ts
    : to === 'lab' ? countBuilding(s, seat, 'lab') >= LIMIT.lab
      : to === 'pi' ? hasPI(s, seat)
        : countBuilding(s, seat, to) >= 1;
  if (full) return 'NO_PIECES';
  const cost: Gain = to === 'ts' ? (isolated(s, seat, hex) ? BUILD_COST.tsAlone : BUILD_COST.ts)
    : to === 'lab' ? BUILD_COST.lab
      : to === 'pi' ? (f.buildings?.piCost ?? BUILD_COST.pi)
        : BUILD_COST.ac;
  return canPay(s, seat, cost) ? cost : 'NOT_ENOUGH_RESOURCES';
}

export function upgrade(s: GaiaState, seat: number, hex: number, to: 'ts' | 'lab' | 'pi' | 'ac1' | 'ac2') {
  const cost = upgradeCost(s, seat, hex, to);
  if (typeof cost === 'string') throw new Error(cost);
  pay(s, seat, cost);
  const h = s.hexes[hex]!;
  const from = h.building!;
  h.building = to;
  log(s, { t: 'upgrade', seat, hex, to });
  if (to === 'lab' || to === 'ac1' || to === 'ac2') queueTech(s, seat);
  fire(s, seat, { kind: 'upgrade', hex, to, from });
  queueLeech(s, seat, hex);
}

/** Offer power to every other player with a structure within distance 2 (highest single power value). */
export function queueLeech(s: GaiaState, from: number, hex: number) {
  const near = within(s, hex, 2);
  for (let k = 1; k < s.players; k++) {
    const seat = (from + k) % s.players;
    if (!s.active[seat]) continue;
    const offered = Math.max(0, ...near.map((i) => powerValue(s, seat, i)));
    if (offered <= 0) continue;
    const custom = sources(s, seat).some((src) => src.effects.leech);
    if (!custom && leechAmount(s, seat, offered) <= 0) continue;
    s.pending.push({ kind: 'leech', seat, amount: offered, from });
  }
}

// ---------------- gaiaforming ----------------

export const gaiaformersFree = (s: GaiaState, seat: number) =>
  s.pl[seat]!.gf - s.pl[seat]!.gfGaia - s.hexes.filter((h) => h.owner === seat && h.building === 'gf').length;

/** QIC + tokens needed to start a Gaia Project on a transdim planet, or an error code. */
export function gaiaformPlan(s: GaiaState, seat: number, hex: number, extraRange = 0): { q: number; tokens: number } | string {
  const h = s.hexes[hex];
  if (!h || h.planet !== 'm' || h.owner !== null) return 'ILLEGAL_PLACEMENT';
  if (gaiaformersFree(s, seat) < 1) return 'NO_PIECES';
  const t = GAIA_TOKENS(s.pl[seat]!.research.gaia);
  const q = qicFor(s, seat, hex, extraRange);
  if (tokens(s.pl[seat]!.power) < t || s.pl[seat]!.q < q) return 'NOT_ENOUGH_RESOURCES';
  return { q, tokens: t };
}
export function gaiaform(s: GaiaState, seat: number, hex: number, extraRange = 0) {
  const plan = gaiaformPlan(s, seat, hex, extraRange);
  if (typeof plan === 'string') throw new Error(plan);
  s.pl[seat]!.q -= plan.q;
  moveToGaia(s, seat, plan.tokens);
  const h = s.hexes[hex]!;
  h.owner = seat; h.building = 'gf';
  log(s, { t: 'gaiaform', seat, hex });
  fire(s, seat, { kind: 'gaiaform', hex });
}

// ---------------- lost planet (navigation level 5) ----------------

export const lostPlanetHexes = (s: GaiaState, seat: number) =>
  s.hexes.flatMap((h, i) => (h.planet === 'e' && h.owner === null && h.sats.length === 0 && qicFor(s, seat, i) <= s.pl[seat]!.q ? [i] : []));

export function placeLostPlanet(s: GaiaState, seat: number, hex: number) {
  s.pl[seat]!.q -= qicFor(s, seat, hex);
  const h = s.hexes[hex]!;
  const before = structuresOf(s, seat);
  const newSector = !before.some((i) => s.hexes[i]!.sector === h.sector);
  h.planet = 'l'; h.owner = seat; h.building = 'mine';
  log(s, { t: 'mine', seat, hex, steps: 0 });
  fire(s, seat, { kind: 'mine', hex, planet: 'l', gaia: false, newType: true, newSector, extra: false });
  joinFederation(s, seat, hex);
  queueLeech(s, seat, hex);
}

// ---------------- tech tiles ----------------


/** Tech tiles the seat may take now (standard not yet owned; advanced with level ≥4, a green token and a tile to cover). */
export function techOptions(s: GaiaState, seat: number): string[] {
  const p = s.pl[seat]!;
  const out = s.techBoard.std.filter((id): id is string => !!id && !p.techs.some((t) => t.id === id));
  const canAdv = hasGreenFed(s, seat) && p.techs.some((t) => !t.covered && CONTENT.techs[t.id]?.kind === 'std');
  if (canAdv) s.techBoard.adv.forEach((id, i) => { if (id && p.research[TRACKS[i]!] >= 4) out.push(id); });
  return out;
}
export function queueTech(s: GaiaState, seat: number) {
  if (techOptions(s, seat).length) pushDecision(s, { kind: 'tech', seat });
}

export function takeTech(s: GaiaState, seat: number, id: string) {
  const p = s.pl[seat]!;
  const def = CONTENT.techs[id]!;
  log(s, { t: 'tech', seat, tech: id });
  if (def.kind === 'adv') {
    s.techBoard.adv[s.advPos[id]!] = null;
    p.feds.find((f) => f.green)!.green = false;
    p.techs.push({ id, covered: false });
    def.effects.onGain?.({ s, seat });
    // Cover a standard tile, then advance on the tile's track (resolveDecision 'cover').
    pushDecision(s, { kind: 'cover', seat, adv: id });
    return;
  }
  p.techs.push({ id, covered: false });
  def.effects.onGain?.({ s, seat });
  const pos = s.techBoard.std.indexOf(id);
  if (pos < 6) { const t = TRACKS[pos]!; if (!researchBlock(s, seat, t)) advance(s, seat, t); }
  else queueResearch(s, seat);
}

// ---------------- federations ----------------

export function fedThreshold(s: GaiaState, seat: number): number {
  let v = 7;
  for (const src of sources(s, seat)) if (src.effects.fedThreshold) v = src.effects.fedThreshold({ s, seat }, v);
  return v;
}
const inOwnFed = (h: HexState, seat: number) => h.feds.includes(seat);
const ownNode = (h: HexState, seat: number) => colonized(h, seat) || (h.owner === seat && h.building === 'station');
/** The seat's unfederated structures connected to `start` through adjacent own structures (incl. `start`). */
function buildingGroup(s: GaiaState, seat: number, start: number, idx = hexIndex(s.hexes)): number[] {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbors(s.hexes, idx, i)) {
      const h = s.hexes[j]!;
      if (!seen.has(j) && ownNode(h, seat) && !inOwnFed(h, seat)) { seen.add(j); stack.push(j); }
    }
  }
  return [...seen];
}

function connected(s: GaiaState, set: Set<number>): boolean {
  if (set.size === 0) return false;
  const idx = hexIndex(s.hexes);
  const start = set.values().next().value as number;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbors(s.hexes, idx, i)) if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === set.size;
}

export interface FedPlan { buildings: number[]; sats: number[]; value: number }
/**
 * Check a federation: `hexes` = the new buildings + satellite hexes. Buildings must be the seat's, not in a federation
 * and (except single-federation factions) not next to one; satellites go on empty space; the whole group must be
 * connected, reach the threshold and use no unneeded satellite.
 */
export function fedPlan(s: GaiaState, seat: number, hexes: number[]): FedPlan | string {
  const set = new Set(hexes);
  if (set.size !== hexes.length || set.size === 0) return 'FEDERATION_INVALID';
  const single = flag(s, seat, 'singleFederation');
  const idx = hexIndex(s.hexes);
  const buildings: number[] = [], sats: number[] = [];
  const hasFed = s.hexes.some((h) => inOwnFed(h, seat));
  for (const i of set) {
    const h = s.hexes[i];
    if (!h) return 'FEDERATION_INVALID';
    // Single-federation factions (Ivits) may name hexes of their growing federation; they only anchor the group.
    if (inOwnFed(h, seat)) { if (single) continue; return 'FEDERATION_INVALID'; }
    if (ownNode(h, seat)) buildings.push(i);
    else if (h.planet === 'e' && h.owner === null && !h.sats.includes(seat)) sats.push(i);
    else return 'FEDERATION_INVALID';
  }
  // Every own structure connected to a chosen one by adjacency is part of the federation (official rule).
  for (const b of [...buildings]) for (const j of buildingGroup(s, seat, b, idx)) if (!set.has(j)) { set.add(j); buildings.push(j); }
  if (!single) for (const i of set) if (neighbors(s.hexes, idx, i).some((j) => inOwnFed(s.hexes[j]!, seat))) return 'FEDERATION_INVALID';
  if (!buildings.length && !(single && hasFed)) return 'FEDERATION_INVALID';
  const group = new Set(set);
  if (single) s.hexes.forEach((h, i) => { if (inOwnFed(h, seat)) group.add(i); });
  if (!connected(s, group)) return 'FEDERATION_INVALID';
  const value = [...group].reduce((a, i) => a + powerValue(s, seat, i, true), 0);
  if (value < fedThreshold(s, seat)) return 'FEDERATION_INVALID';
  // ponytail: local minimality (no single satellite can be dropped), not a global minimum-satellite search.
  for (const sat of sats) { const g = new Set(group); g.delete(sat); if (connected(s, g)) return 'FEDERATION_INVALID'; }
  const payQic = flag(s, seat, 'satelliteQic');
  if (payQic ? s.pl[seat]!.q < sats.length : tokens(s.pl[seat]!.power) < sats.length) return 'NOT_ENOUGH_RESOURCES';
  return { buildings, sats, value };
}

export const fedTokensAvailable = (s: GaiaState) => Object.entries(s.fedSupply).filter(([, n]) => n > 0).map(([id]) => id);

export function formFederation(s: GaiaState, seat: number, hexes: number[], token: string) {
  const plan = fedPlan(s, seat, hexes);
  if (typeof plan === 'string') throw new Error(plan);
  if (flag(s, seat, 'satelliteQic')) s.pl[seat]!.q -= plan.sats.length;
  else removeTokens(s, seat, plan.sats.length);
  for (const i of plan.sats) s.hexes[i]!.sats.push(seat);
  s.pl[seat]!.satellites += plan.sats.length;
  const marked = [...plan.buildings, ...plan.sats].sort((a, b) => a - b);
  for (const i of marked) s.hexes[i]!.feds.push(seat);
  s.fedSupply[token] = (s.fedSupply[token] ?? 0) - 1;
  log(s, { t: 'federation', seat, token, hexes: marked });
  gainFedToken(s, seat, token);
}

/** Take a federation token (already removed from supply by the caller): its reward + federation event. */
export function gainFedToken(s: GaiaState, seat: number, id: string) {
  const def = CONTENT.feds[id]!;
  s.pl[seat]!.feds.push({ id, green: def.green });
  gain(s, seat, def.gain);
  fire(s, seat, { kind: 'federation', token: id });
}

/** A structure built next to one of the seat's federations joins it. */
export function joinFederation(s: GaiaState, seat: number, hex: number) {
  const h = s.hexes[hex]!;
  if (inOwnFed(h, seat)) return;
  // The new structure and every unfederated own structure connected to it join (official rule).
  if (adjacent(s, hex).some((j) => inOwnFed(s.hexes[j]!, seat))) for (const i of buildingGroup(s, seat, hex)) s.hexes[i]!.feds.push(seat);
}

/**
 * Up to `max` federation proposals for the seat (greedy: grow from each unfederated building group to the nearest
 * other buildings through empty space until the threshold). Used for action hints and timeouts.
 */
export function suggestFederations(s: GaiaState, seat: number, max = 3): number[][] {
  const single = flag(s, seat, 'singleFederation');
  const idx = hexIndex(s.hexes);
  const need = fedThreshold(s, seat);
  const blocked = (i: number) => !single && neighbors(s.hexes, idx, i).some((j) => inOwnFed(s.hexes[j]!, seat));
  const free = (i: number) => { const h = s.hexes[i]!; return !inOwnFed(h, seat) && ownNode(h, seat) && !blocked(i); };
  const space = (i: number) => { const h = s.hexes[i]!; return h.planet === 'e' && h.owner === null && !h.sats.includes(seat) && !inOwnFed(h, seat) && !blocked(i); };
  const starts = s.hexes.flatMap((_, i) => (free(i) ? [i] : []));
  const out: number[][] = [];
  const seenKeys = new Set<string>();
  const base = single ? s.hexes.flatMap((h, i) => (inOwnFed(h, seat) ? [i] : [])) : [];
  for (const st of single && base.length ? [-1] : starts) {
    const group = new Set<number>(st >= 0 ? [st] : base);
    const added = new Set<number>(st >= 0 ? [st] : []);
    const grow = (from: number) => { // flood own free buildings touching the group
      const stack = [from];
      while (stack.length) {
        const i = stack.pop()!;
        for (const j of neighbors(s.hexes, idx, i)) if (!group.has(j) && free(j)) { group.add(j); added.add(j); stack.push(j); }
      }
    };
    for (const g of [...group]) grow(g);
    const value = () => [...group].reduce((a, i) => a + powerValue(s, seat, i, true), 0);
    for (let guard = 0; guard < 20 && value() < need; guard++) {
      // BFS through empty space to the nearest free building
      const prev = new Map<number, number>();
      const q: number[] = [...group];
      for (const g of group) prev.set(g, -1);
      let hit = -1;
      while (q.length && hit < 0) {
        const i = q.shift()!;
        for (const j of neighbors(s.hexes, idx, i)) {
          if (prev.has(j)) continue;
          if (free(j)) { prev.set(j, i); hit = j; break; }
          if (space(j)) { prev.set(j, i); q.push(j); }
        }
      }
      if (hit < 0) break;
      for (let i = hit; prev.get(i) !== -1 && !group.has(i); i = prev.get(i)!) { group.add(i); added.add(i); }
      grow(hit);
    }
    if (value() < need) continue;
    // Ivits whose growing federation already reaches the next threshold name one of its hexes.
    const hexes = added.size ? [...added].sort((a, b) => a - b) : base.slice(0, 1);
    const key = hexes.join(',');
    if (seenKeys.has(key) || typeof fedPlan(s, seat, hexes) === 'string') continue;
    seenKeys.add(key);
    out.push(hexes);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------- special actions & conversions ----------------

export interface SpecialEntry { key: string; action: SpecialAction }
/** Once-per-round special actions the seat owns (booster, tech tiles, faction, QIC academy). */
export function specialActions(s: GaiaState, seat: number): SpecialEntry[] {
  const out: SpecialEntry[] = [];
  for (const src of sources(s, seat)) if (src.effects.action) out.push({ key: src.id, action: src.effects.action });
  if (countBuilding(s, seat, 'ac2')) {
    const g = factionOf(s, seat).buildings?.ac2Action ?? { q: 1 };
    out.push({ key: 'ac2', action: { labelFa: 'اقدام آکادمی', run: (x) => gain(x.s, x.seat, g) } });
  }
  return out;
}

const conv = (id: string, labelFa: string, cost: Gain, g: Gain) => ({
  id, labelFa, can: (x: X) => canPay(x.s, x.seat, cost), run: (x: X) => { pay(x.s, x.seat, cost); gain(x.s, x.seat, g); }
});
/** Standard free actions printed on every faction board. */
export const BASE_CONVERSIONS = [
  conv('pw-q', '۴ قدرت → ۱ QIC', { pw: 4 }, { q: 1 }),
  conv('pw-o', '۳ قدرت → ۱ سنگ معدن', { pw: 3 }, { o: 1 }),
  conv('pw-k', '۴ قدرت → ۱ دانش', { pw: 4 }, { k: 1 }),
  conv('pw-c', '۱ قدرت → ۱ اعتبار', { pw: 1 }, { c: 1 }),
  conv('q-o', '۱ QIC → ۱ سنگ معدن', { q: 1 }, { o: 1 }),
  conv('o-t', '۱ سنگ معدن → ۱ ژتون قدرت', { o: 1 }, { t: 1 }),
  conv('k-c', '۱ دانش → ۱ اعتبار', { k: 1 }, { c: 1 }),
  conv('o-c', '۱ سنگ معدن → ۱ اعتبار', { o: 1 }, { c: 1 })
];
export { conv as conversion };
export function conversions(s: GaiaState, seat: number) {
  const hidden = new Set(sources(s, seat).flatMap((src) => src.effects.hideConversions?.({ s, seat }) ?? []));
  return [...BASE_CONVERSIONS.filter((c) => !hidden.has(c.id)), ...sources(s, seat).flatMap((src) => src.effects.conversions ?? [])];
}
