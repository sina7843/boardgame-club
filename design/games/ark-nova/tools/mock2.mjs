// Curated mid-game Ark Nova position for the artboards, built ONLY through the repo engine's own helpers
// (setup, build/placements, animalOptions/playAnimal, playSponsor, takePartner/takeUni, projectOptions/supportProject,
// prompts auto-answered by autoAnswer). The engine then computes the current turn prompt, every legal option, label and
// sub-prompt. node --experimental-strip-types --no-warnings mock2.mjs <seed> <out.json>
import fs from 'node:fs';
const R = await import('./src/rules.ts');
const { core, flow } = R;
const seed = Number(process.argv[2] || 3), out = process.argv[3] || 'mock2.json';
function rngOf(a) { return { nextInt(n) { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) % n); } }; }
const rng = rngOf(seed), pick = rngOf(seed * 7 + 1);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = pick.nextInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const M = R.arkNovaModule;
let s = M.setup({ playerCount: 4, options: { map: 'advanced' }, rng });
for (let k = 0; k < 4; k++) { const d = s.drafts[k]; s = M.apply(s, { kind: 'player', seat: k }, { type: 'draft', keep: d.cards.slice(0, 4), map: d.maps[0] }, { rng }).nextState; }
s.queue = []; s.act = null; s.inTurn = false;
const settleQ = () => { flow.settle(s, rng); for (let g = 0; g < 400 && s.queue.length; g++) { const h = s.queue[0]; if (h.k === 'sys') { flow.settle(s, rng); continue; } flow.answer(s, rng, R.autoAnswer(s, h, rng)); } s.queue = []; };
const take = (id) => { s.deck = s.deck.filter((x) => x !== id); s.discard = s.discard.filter((x) => x !== id); s.display = s.display.map((x) => (x === id ? s.deck.pop() : x)); for (const p of s.players) p.hand = p.hand.filter((x) => x !== id); };
// per seat plan: buildings to try, animals, sponsors, partner zoos, universities, project supports, x tokens, money, upgraded cards
const PLAN = [
  { kinds: ['e4', 'e3', 'e2', 'kiosk', 'e2', 'pavilion', 'e1', 'e3'], animals: 5, sponsors: 2, partners: ['africa'], unis: ['science'], projects: 1, x: 2, money: 23, up: ['animals', 'build'] },
  { kinds: ['e5', 'e3', 'e2', 'kiosk', 'e1', 'e2', 'e4'], animals: 6, sponsors: 1, partners: ['asia', 'europe'], unis: [], projects: 2, x: 1, money: 17, up: ['association'] },
  { kinds: ['e3', 'e2', 'pz', 'kiosk', 'e1', 'e2'], animals: 4, sponsors: 2, partners: ['americas'], unis: ['rep'], projects: 1, x: 3, money: 31, up: ['cards'] },
  { kinds: ['e4', 'e2', 'e3', 'kiosk', 'pavilion', 'e1'], animals: 4, sponsors: 1, partners: [], unis: ['hand'], projects: 0, x: 0, money: 12, up: ['sponsors'] }
];
for (let k = 0; k < 4; k++) {
  const c = core.ctx(s, k, rng), p = s.players[k], plan = PLAN[k];
  p.money = 999; p.rep = 6;
  for (const kind of plan.kinds) {
    const ps = core.placements(c, kind, true).filter((cells) => !core.placeError(c, kind, cells, true));
    if (!ps.length) continue;
    // prefer spots touching water or rock (animals need them)
    const sc = (cells) => core.adjacentTerrain(p, cells, 'water') + core.adjacentTerrain(p, cells, 'rock') + pick.nextInt(3);
    const best = ps.sort((a, b) => sc(b) - sc(a))[0];
    core.build(c, kind, best, true); settleQ();
  }
  for (const z of plan.partners) { if (core.partnerOptions(c).includes(z)) { core.takePartner(c, z); settleQ(); } }
  for (const u of plan.unis) { if (core.uniOptions(c).includes(u)) { core.takeUni(c, u); settleQ(); } }
  let played = 0;
  for (const id of shuffle(Object.keys(R.ANIMAL).map(Number))) {
    if (played >= plan.animals) break;
    if (![...s.deck, ...s.display].includes(id)) continue;
    take(id); p.hand.push(id);
    const o = core.animalOptions(c, true, false).find((x) => x.card === id);
    if (!o) { p.hand = p.hand.filter((x) => x !== id); s.deck.unshift(id); continue; }
    core.playAnimal(c, o); settleQ(); played++;
  }
  let sp = 0;
  for (const id of shuffle(Object.keys(R.SPONSOR).map(Number))) {
    if (sp >= plan.sponsors) break;
    if (![...s.deck, ...s.display].includes(id) || R.SPONSOR[id].level > 4) continue;
    if (core.missing(c, R.SPONSOR[id], true) > 0) continue;
    const d = core.def(id); if (d?.building) continue; // unique buildings: skipped in the mock
    take(id); p.hand.push(id);
    try { core.playSponsor(c, id, 0); settleQ(); sp++; } catch { p.hand = p.hand.filter((x) => x !== id); }
  }
  for (let i = 0; i < plan.projects; i++) {
    const os = core.projectOptions(c, false).filter((o) => o.from === 'board');
    if (!os.length) break;
    core.supportProject(c, os[0]); settleQ();
  }
  for (const a of plan.up) p.up[a] = true;
  p.money = plan.money; p.x = plan.x; p.rep = Math.max(p.rep, [5, 7, 3, 4][k]);
}
// hand for me (seat 0): animals + a sponsor + a project from the deck; others: counts only
// 2 animals the engine says are playable now, 1 that is not (shows the disabled reason), 1 sponsor, 1 project
const meHand = [];
const c0 = core.ctx(s, 0, rng), p0 = s.players[0];
const playable = (id) => { p0.hand = [id]; const ok = core.animalOptions(c0, p0.up.animals, false).some((o) => o.card === id); p0.hand = []; return ok; };
let good = 0, bad = 0;
for (const id of shuffle(s.deck)) {
  if (meHand.length >= 5) break;
  const isA = !!R.ANIMAL[id], isS = !!R.SPONSOR[id], isP = !!R.PROJECT[id];
  if (isA) { const ok = playable(id); if (ok && good < 2) { meHand.push(id); good++; } else if (!ok && bad < 1) { meHand.push(id); bad++; } continue; }
  if ((isS && !meHand.some((x) => R.SPONSOR[x])) || (isP && !meHand.some((x) => R.PROJECT[x]))) meHand.push(id);
}
for (const id of meHand) take(id);
s.players[0].hand = meHand;
for (const [k, n] of [[1, 4], [2, 6], [3, 3]]) s.players[k].hand = s.deck.splice(-n, n);
s.display = s.display.map((x) => x ?? s.deck.pop());
s.players[0].slots = ['cards', 'sponsors', 'build', 'animals', 'association'];
s.brk = 6; s.first = 3; s.turnsDone = 37; s.log = [];
R.restartTurn(s, 0, rng);
const view = R.projectState(s, { kind: 'player', seat: 0 });
const sub = {};
for (const o of view.prompt.options) {
  if (!o.value.startsWith('a:') && o.value !== 'ability') continue;
  const cl = M.apply(structuredClone(s), { kind: 'player', seat: 0 }, { type: 'answer', value: o.value }, { rng: rngOf(1) }).nextState;
  sub[o.value] = R.projectState(cl, { kind: 'player', seat: 0 }).prompt;
}
// hand playability straight from the engine (error codes; the renderer only translates them)
const cc = core.ctx(s, 0, rng), me0 = s.players[0];
const handInfo = me0.hand.map((id) => {
  if (R.ANIMAL[id]) return { id, kind: 'animal', cost: core.animalCost(cc, R.ANIMAL[id]), error: core.animalError(cc, R.ANIMAL[id], me0.up.animals) };
  if (R.SPONSOR[id]) { const lvl = R.SPONSOR[id].level, max = R.strengthOf(me0, 'sponsors') + me0.x + (me0.up.sponsors ? 1 : 0); return { id, kind: 'sponsor', level: lvl, error: core.sponsorError(cc, id, me0.up.sponsors) ?? (lvl > max ? 'LEVEL' : null) }; }
  return { id, kind: 'project', error: Object.values(sub).some((q) => (q?.options ?? []).some((o) => o.value.startsWith(`pr:${id}:`))) ? null : 'NO_SUPPORT' };
});
// extra prompts for the action / phase boards, each run on a clone by the engine itself
const clone = () => structuredClone(s);
const promptAfter = (st, ...answers) => { for (const a of answers) st = M.apply(st, { kind: 'player', seat: 0 }, { type: 'answer', ...a }, { rng: rngOf(1) }).nextState; return { st, q: R.projectState(st, { kind: 'player', seat: 0 }).prompt }; };
const flows = {};
flows.sponsors4 = promptAfter(clone(), { value: 'a:sponsors:2' }).q;
flows.cards3 = promptAfter(clone(), { value: 'a:cards:2' }).q;
flows.animals = sub['a:animals:0'];
{ const r = promptAfter(clone(), { value: 'a:animals:0' }, { value: sub['a:animals:0'].options[0].value }); flows.animals2 = r.q; }
flows.assoc = sub['a:association:0'];
flows.build = sub['a:build:0'];
{ const r = promptAfter(clone(), { value: 'a:association:0' }, { value: 'pr:101:0:0:board:0:0' }); flows.assocAfter = r.q; flows.assocAfterView = { cp: R.projectState(r.st, { kind: 'player', seat: 0 }).players[0].cp }; }
// conservation milestones 2 / 5 (engine prompt)
for (const m of [2, 5]) { const st = clone(); st.queue = []; const c = core.ctx(st, 0, rng); flow.runFx(c, 'core:cpMilestone', m, {}); flow.settle(st, rng); flows['cp' + m] = R.projectState(st, { kind: 'player', seat: 0 }).prompt; }
// break: hand limit discard + income per player (engine formulas)
{ const st = clone(); st.players[0].hand.push(...st.deck.splice(-2, 2)); st.queue = []; const c = core.ctx(st, 0, rng); flow.runFx(c, 'core:break', null, {}); flow.settle(st, rng);
  flows.breakDiscard = R.projectState(st, { kind: 'player', seat: 0 }).prompt; flows.breakHand = st.players[0].hand;
  flows.income = s.players.map((p) => ({ appeal: R.appealIncome(p.appeal), kiosk: flow.kioskIncome(p), left: R.REG.maps.get(p.map).left.filter((x, i) => x.income && !p.left[i]).map((x) => R.bonusFa(x.b)) })); }
// final scoring: discard 1 of 2 + the kept card's points (engine ScoringDef.score, capped at 4)
{ const st = clone(); st.queue = []; const c = core.ctx(st, 0, rng); flow.runFx(c, 'core:finalDiscard', null, {}); flow.settle(st, rng); flows.finalDiscard = R.projectState(st, { kind: 'player', seat: 0 }).prompt;
  flows.finalPoints = s.players.map((p, k) => ({ cards: p.finals, pts: p.finals.map((id) => Math.min(4, R.REG.scoring.get(id)?.score(core.ctx(s, k, rng)) ?? 0)) })); }
// draft: a fresh 4-player advanced setup, seat 0's offer (8 cards, 2 maps)
{ const d0 = M.setup({ playerCount: 4, options: { map: 'advanced' }, rng: rngOf(seed + 100) }); flows.draft = R.projectState(d0, { kind: 'player', seat: 0 }).me.draft; flows.draftPlayers = d0.players.map((p) => p.appeal); }
flows.scoringNames = Object.fromEntries([...R.REG.scoring.entries()].map(([id, d]) => [id, { nameFa: d.nameFa, textFa: d.textFa }]));
const names = {};
for (const id of [...Object.keys(R.ANIMAL), ...Object.keys(R.SPONSOR), ...Object.keys(R.PROJECT)]) names[id] = R.nameOf(Number(id));
const extra = {
  ANIMAL: R.ANIMAL, SPONSOR: R.SPONSOR, PROJECT: R.PROJECT, names,
  maps: Object.fromEntries([...R.REG.maps.keys()].map((id) => { const m = R.REG.maps.get(id); return [id, { id, nameFa: m.nameFa, textFa: m.textFa, water: m.water, rock: m.rock, upgrade: m.upgrade, bonuses: m.bonuses, left: m.left, blocked: m.blocked ?? [], marks: m.marks ?? {}, preset: m.preset ?? [] }]; })),
  cardFa: Object.fromEntries([...R.REG.cards.entries()].map(([id, d]) => [id, { nameFa: d.nameFa, textFa: d.textFa }])),
  tiles: Object.fromEntries(Object.entries(R.TILES).map(([k, t]) => [k, t.nameFa])),
  KIND_FA: R.KIND_FA, ICON_FA: R.ICON_FA, ACTION_FA: R.ACTION_FA, UNI_FA: R.UNI_FA,
  appealIncome: view.players.map((p) => R.appealIncome(p.appeal))
};
fs.writeFileSync(out, JSON.stringify({ seed, state: s, view, legal: R.legal(s, { kind: 'player', seat: 0 }), sub, handInfo, flows, ...extra }, null, 1));
console.log('maps', view.players.map((p) => p.map).join(','), 'brk', s.brk, '/', s.brkMax, 'display', s.display.map((id) => names[id]).join(' | '));
console.log(view.players.map((p) => `s${p.seat} $${p.money} ap${p.appeal} cp${p.cp} rep${p.rep} x${p.x} zoo${p.zoo.length} bld${p.buildings.length} partners${p.partners} unis${p.unis} vp${p.vp} icons ${JSON.stringify(p.icons)}`).join('\n'));
console.log('hand', view.me.hand.map((id) => names[id]).join(' | '));
console.log('projects', view.baseProjects.map((id) => names[id] + JSON.stringify(view.ptoks[id])).join(' | '), view.projects);
console.log('opts', view.prompt.options.map((o) => o.label).join(' | '));
