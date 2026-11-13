// Mock 4-player TM position for the artboards, checked with the repo engine (core.ts): every enabled/disabled action,
// cost and reason on the canvas comes from here. node --experimental-strip-types --no-warnings mock-state.mjs <repo tm src> <out.json>
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const core = await import(pathToFileURL(src + '/core.ts'));
const board = await import(pathToFileURL(src + '/board.ts'));
const { CARD } = await import(pathToFileURL(src + '/content/index.ts'));

const R = (mc, steel, titanium, plants, energy, heat) => ({ mc, steel, titanium, plants, energy, heat });
const P = (o) => ({
  corp: null, tr: 20, res: R(0, 0, 0, 0, 0, 0), prod: R(0, 0, 0, 0, 0, 0), hand: [], played: [], cardRes: {}, used: [], passed: false,
  trRaised: false, firstActionDone: true, nextDiscount: 0, nextReqBonus: 0, corpOffer: [], offer: [], pick: null, pack: [], drafted: [], draftPick: null, ...o
});
const s = {
  playerCount: 4, corporateEra: true, draft: false, generation: 5, phase: 'action', firstPlayer: 3, current: 0, actionsTaken: 0,
  temperature: -14, oxygen: 5, oceans: 4,
  tiles: {
    '32': { kind: 'ocean', owner: null }, '33': { kind: 'ocean', owner: null }, '44': { kind: 'ocean', owner: null }, '13': { kind: 'ocean', owner: null },
    '39': { kind: 'city', owner: 0 }, '38': { kind: 'greenery', owner: 0 }, '30': { kind: 'greenery', owner: 0 }, '47': { kind: 'greenery', owner: 0 },
    '22': { kind: 'city', owner: 1 }, '23': { kind: 'greenery', owner: 1 }, '15': { kind: 'greenery', owner: 1 },
    '26': { kind: 'city', owner: 2 }, '35': { kind: 'greenery', owner: 2 },
    '54': { kind: 'city', owner: 3 }, '53': { kind: 'special', owner: 3, card: '064' }, '60': { kind: 'greenery', owner: 3 }
  },
  claims: {},
  players: [
    P({ corp: 'R17', tr: 31, res: R(34, 2, 1, 6, 3, 9), prod: R(3, 1, 0, 4, 2, 1), played: ['087', '093', '141', '045', '049', '172', '033', '078', '009'], cardRes: { '049': 3, '172': 2, '033': 2 }, used: ['049'],
      hand: ['060', '088', '118', '016', '064', '116', '135'] }),
    P({ corp: 'R18', tr: 28, res: R(21, 0, 3, 2, 1, 14), prod: R(2, 0, 1, 1, 3, 4), played: ['046', '113', '168', '076', '036'], hand: Array(6).fill('x') }),
    P({ corp: 'R13', tr: 26, res: R(12, 4, 0, 1, 0, 3), prod: R(5, 2, 0, 0, 4, 0), played: ['117', '132', '102', '108'], passed: true, hand: Array(3).fill('x') }),
    P({ corp: 'R24', tr: 29, res: R(18, 9, 2, 3, 1, 4), prod: R(4, 4, 1, 1, 1, 1), played: ['064', '056', '062', '138', '101'], used: ['101'], hand: Array(9).fill('x') })
  ],
  deck: Array(118).fill('x'), discard: Array(41).fill('x'),
  milestones: [{ id: 'gardener', seat: 0 }], awards: [{ id: 'banker', seat: 3 }],
  queue: [], revealed: null, log: [], seq: 0, timeouts: [0, 0, 0, 0], outcome: null
};
const me = 0;
const hand = s.players[me].hand.map((id) => ({ id, cost: core.cardCost(s, me, CARD[id]), printed: CARD[id].cost, error: core.playError(s, me, id) }));
const projects = Object.keys(core.PROJECTS).map((p) => ({ id: p, cost: core.projectCost(s, me, p), error: p === 'sellPatents' ? null : core.projectError(s, me, p) }));
const milestones = core.MILESTONES.map((m) => ({ id: m.id, value: s.players.map((_, k) => m.value(s, k)), need: m.need, error: core.milestoneError(s, me, m.id) }));
const awards = core.AWARDS.map((a) => ({ id: a.id, value: s.players.map((_, k) => a.value(s, k)), error: core.awardError(s, me, a.id) }));
const tableauActions = core.tableau(s, me).filter((id) => CARD[id].action).map((id) => {
  const a = CARD[id].action;
  let err = null;
  if (s.players[me].used.includes(id)) err = 'ACTION_USED';
  else if (a.can && !a.can(core.ctxOf(s, me, id))) err = 'CANNOT_USE';
  else if ((a.cost ?? 0) > core.maxPay(s, me, a.payWith ?? {})) err = 'CANNOT_AFFORD';
  return { id, cost: a.cost ?? 0, error: err };
});
const greenerySpaces = core.legalSpaces(s, me, 'greenery');
const citySpaces = core.legalSpaces(s, me, 'city');
const oceanSpaces = core.legalSpaces(s, me, 'ocean');
const scores = s.players.map((_, k) => core.score(s, k));
const tags = s.players.map((_, k) => Object.fromEntries(['building', 'space', 'science', 'power', 'earth', 'jovian', 'plant', 'microbe', 'animal', 'city'].map((t) => [t, core.tagsOf(s, k, t)])));
const events = s.players.map((p) => p.played.filter((id) => CARD[id].kind === 'event').length);
const res = {
  state: s, hand, projects, milestones, awards, tableauActions, greenerySpaces, citySpaces, oceanSpaces, scores, tags, events,
  convertPlants: core.canConvertPlants(s, me), greeneryPlants: core.greeneryPlants(s, me), convertHeat: core.canConvertHeat(s, me),
  values: core.values(s, me), maxPay: core.maxPay(s, me, {}),
  spaces: board.SPACES, names: board.NAME_FA,
  cards: Object.fromEntries(Object.values(CARD).map((c) => [c.id, { name: c.name, nameFa: c.nameFa, kind: c.kind, cost: c.cost, tags: c.tags, textFa: c.textFa, resource: c.resource ?? null, action: !!c.action, actionCost: c.action?.cost ?? null }]))
};
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log('hand', hand.map((h) => `${h.id}:${h.cost}:${h.error}`).join(' '));
console.log('projects', projects.map((h) => `${h.id}:${h.cost}:${h.error}`).join(' '));
console.log('milestones', milestones.map((h) => `${h.id}:${h.value}:${h.error}`).join(' '));
console.log('awards', awards.map((h) => `${h.id}:${h.value}:${h.error}`).join(' '));
console.log('cardActions', tableauActions.map((h) => `${h.id}:${h.cost}:${h.error}`).join(' '));
console.log('greenery', greenerySpaces.join(','), '| city', citySpaces.length, '| ocean', oceanSpaces.join(','));
console.log('plants', res.convertPlants, res.greeneryPlants, 'heat', res.convertHeat, 'values', JSON.stringify(res.values), 'maxPay', res.maxPay);
console.log('scores', scores.map((x) => x.total).join(' '), 'tags0', JSON.stringify(tags[0]));
