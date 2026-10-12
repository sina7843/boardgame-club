// Camel Up bot. Hidden information (other players' overall bets), so it decides from its own projection only.
// It samples how the rest of the leg (and the race) can go with the dice still in the pyramid, then values each
// action by expected coins: leg tiles, the +1 roll, a desert tile where camels are likely to land, overall bets.
import { pickByLevel, type BotLevel, type BotStyle, type EngineRng, type GameBot, type Scored } from '@bg/game-sdk';
import { camelModule, CAMELS, TRACK, desertOk, ranking, type Camel, type CamelAction, type CamelState, type CamelView } from './rules.ts';

const SAMPLES: Record<BotLevel, number> = { easy: 60, medium: 250, hard: 900 };
const OVERALL = [8, 5, 3, 2, 1];
/** aggressive values bets more, cautious prefers the sure coin of a roll. */
const STYLE: Record<BotStyle, { bet: number; roll: number }> = {
  aggressive: { bet: 1.2, roll: 0 },
  balanced: { bet: 1, roll: 0 },
  cautious: { bet: 0.9, roll: 0.3 }
};

type Spaces = Record<number, Camel[]>;
type Desert = CamelView['desert'];

/** Move camel `c` (carrying the camels on top of it) by `by`, honouring desert tiles. Returns the landing space. */
function moveCamel(spaces: Spaces, desert: Desert, c: Camel, by: number): number {
  const from = Number(Object.keys(spaces).find((k) => spaces[Number(k)]!.includes(c)));
  const stack = spaces[from]!;
  const moving = stack.splice(stack.indexOf(c));
  if (!stack.length) delete spaces[from];
  let to = from + by;
  const landed = to;
  let under = false;
  const t = desert.find((d) => d?.space === to);
  if (t) { if (t.oasis) to += 1; else { to -= 1; under = true; } }
  const dest = spaces[to] ?? [];
  spaces[to] = under ? [...moving, ...dest] : [...dest, ...moving];
  return landed;
}

const clone = (sp: Spaces): Spaces => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, v.slice()]));
const crossed = (sp: Spaces) => Object.keys(sp).some((k) => Number(k) > TRACK);

interface Forecast { legFirst: Record<Camel, number>; legSecond: Record<Camel, number>; win: Record<Camel, number>; lose: Record<Camel, number>; landings: Record<number, number> }

function forecast(v: CamelView, samples: number, rng: EngineRng): Forecast {
  const zero = () => Object.fromEntries(CAMELS.map((c) => [c, 0])) as Record<Camel, number>;
  const f: Forecast = { legFirst: zero(), legSecond: zero(), win: zero(), lose: zero(), landings: {} };
  const left = CAMELS.filter((c) => !v.rolled.some((r) => r.camel === c));
  for (let n = 0; n < samples; n++) {
    const sp = clone(v.spaces);
    let dice = left.slice();
    let firstLeg = true;
    for (let guard = 0; guard < 60 && !crossed(sp); guard++) {
      if (!dice.length) {
        if (firstLeg) { const r = ranking({ spaces: sp }); f.legFirst[r[0]!]++; f.legSecond[r[1]!]++; firstLeg = false; }
        dice = CAMELS.slice();
      }
      const c = dice.splice(rng.nextInt(dice.length), 1)[0]!;
      const landed = moveCamel(sp, firstLeg ? v.desert : [], c, 1 + rng.nextInt(3));
      if (firstLeg) f.landings[landed] = (f.landings[landed] ?? 0) + 1;
    }
    const r = ranking({ spaces: sp });
    if (firstLeg) { f.legFirst[r[0]!]++; f.legSecond[r[1]!]++; }
    f.win[r[0]!]++;
    f.lose[r[r.length - 1]!]++;
  }
  for (const k of ['legFirst', 'legSecond', 'win', 'lose'] as const) for (const c of CAMELS) f[k][c] /= samples;
  for (const k of Object.keys(f.landings)) f.landings[Number(k)]! /= samples;
  return f;
}

export const camelBot: GameBot<CamelState, CamelAction> = {
  decide(state, seat, level, rng, style) {
    const v = camelModule.project(state, { kind: 'player', seat });
    const w = STYLE[style];
    const f = forecast(v, SAMPLES[level], rng);
    const scored: Scored<CamelAction>[] = [{ move: { type: 'roll' }, score: 1 + w.roll }];
    for (const c of CAMELS) {
      const tile = v.legTiles[c][0];
      if (tile === undefined) continue;
      const p1 = f.legFirst[c], p2 = f.legSecond[c];
      scored.push({ move: { type: 'leg', camel: c }, score: w.bet * (tile * p1 + p2 - (1 - p1 - p2)) });
    }
    if (!v.desert[seat]) {
      let best = { space: 0, ev: -1 };
      for (let sp = 2; sp <= TRACK; sp++) if (desertOk(state, seat, sp) && (f.landings[sp] ?? 0) > best.ev) best = { space: sp, ev: f.landings[sp] ?? 0 };
      // Each camel landing on our tile pays 1 coin, oasis or mirage; the bot always lays an oasis.
      if (best.space) scored.push({ move: { type: 'desert', space: best.space, oasis: true }, score: best.ev });
    }
    for (const c of CAMELS.filter((x) => !v.usedCards.includes(x))) {
      const payWin = OVERALL[v.winnerCount] ?? 1, payLose = OVERALL[v.loserCount] ?? 1;
      scored.push({ move: { type: 'overall', camel: c, which: 'win' }, score: w.bet * (f.win[c] * payWin - (1 - f.win[c])) });
      scored.push({ move: { type: 'overall', camel: c, which: 'lose' }, score: w.bet * (f.lose[c] * payLose - (1 - f.lose[c])) });
    }
    return pickByLevel(scored, level, rng);
  }
};
