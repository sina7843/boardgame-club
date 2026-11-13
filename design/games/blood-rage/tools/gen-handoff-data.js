// Data for the dev team: data/{content,cards,mock-state,content-id-map}.json and layout.json, from work/ and the
// artboard parts (so every number matches the designs). node gen-handoff-data.js <out design/games/blood-rage>
const fs = require('fs');
const path = require('path');
const { C, M, CARD, ME, statVal, onBoard, figStr, figArt } = require('./bdr-lib');
const P = require('./bdr-parts');
const PH = require('./bdr-phases');
const out = process.argv[2];
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
const W = (f, o) => fs.writeFileSync(path.join(out, f), JSON.stringify(o, null, 1));

// legal-move hints of the main position (sample of ENGINE.md §9; the engine must produce the same set)
function hints(s, seat) {
  const h = [];
  const rage = s.rage[seat];
  const full = onBoard(s, seat) >= statVal(s, seat, 'horn');
  const seen = new Set();
  for (const f of s.figures.filter((x) => x.seat === seat && x.where === 'reserve')) {
    const k = f.kind === 'monster' ? 'm' + f.monster : f.kind;
    if (seen.has(k)) continue;
    seen.add(k);
    const cost = f.kind === 'leader' || [27, 96].includes(f.monster) ? 0 : figStr(s, f);
    if (full) { h.push({ type: 'invade', figure: f.id, disabled: true, reason: 'HORNS_FULL' }); continue; }
    if (cost > rage) { h.push({ type: 'invade', figure: f.id, disabled: true, reason: 'NO_RAGE' }); continue; }
    const targets = f.kind === 'ship' || f.monster === 28
      ? C.fjords.filter((fj) => fj.supports.some((p) => !s.destroyed.includes(p))).map((fj) => 'fjord:' + fj.id)
      : P.invadeTargets(s).flatMap(({ p }) => P.empty(s, p).map((v) => 'village:' + v));
    for (const to of targets) {
      const hint = { type: 'invade', figure: f.id, to, cost: { rage: cost } };
      if (f.monster === 26 && to.startsWith('village:')) {
        const prov = C.slots[Number(to.split(':')[1])].province;
        const victims = s.figures.filter((x) => x.seat !== seat && x.kind === 'warrior' && P.provOfFig(x) === prov).map((x) => x.id);
        if (victims.length) hint.effects = [{ kind: 'destroy', figures: victims }];
      }
      h.push(hint);
    }
  }
  const mine = C.provinces.filter((p) => s.figures.some((f) => f.seat === seat && f.kind !== 'ship' && P.provOfFig(f) === p.id));
  for (const from of mine) for (const to of C.provinces) {
    if (to.id === from.id || s.destroyed.includes(to.id)) continue;
    const figs = s.figures.filter((f) => f.seat === seat && f.kind !== 'ship' && P.provOfFig(f) === from.id).map((f) => f.id);
    const room = to.id === 0 ? figs.length : P.empty(s, to.id).length;
    if (room) h.push({ type: 'march', from: from.id, to: to.id, figures: figs.slice(0, room), maxFigures: room, cost: { rage: 1 } });
  }
  for (const n of s.hands[seat]) {
    const c = CARD[n];
    if (['leader', 'warrior', 'ship', 'monster', 'clan'].includes(c.type)) {
      const cost = [27, 96].includes(n) ? 0 : Math.max(0, c.value - (s.upgrades[seat].clan.includes(31) ? 1 : 0));
      h.push(cost > rage ? { type: 'upgrade', card: n, slot: c.type, disabled: true, reason: 'NO_RAGE' } : { type: 'upgrade', card: n, slot: c.type, cost: { rage: cost } });
    }
    if (c.type === 'quest') h.push({ type: 'quest', card: n, cost: { rage: 0 } });
  }
  if (!s.hands[seat].some((n) => CARD[n].type === 'quest')) h.push({ type: 'quest', disabled: true, reason: 'NOT_QUEST_CARD' });
  for (const p of C.provinces) {
    if (s.destroyed.includes(p.id) || s.pillage[p.id].pillaged) continue;
    const present = s.figures.some((f) => f.seat === seat && (P.provOfFig(f) === p.id || (f.where.startsWith('fjord:') && C.fjords[Number(f.where.split(':')[1])].supports.includes(p.id))));
    if (present) h.push({ type: 'pillage', province: p.id, cost: { rage: 0 } });
  }
  h.push({ type: 'pass' });
  return h;
}
const states = { main: M, afterTroll: PH.afterTroll(), battle: PH.battleState(), afterBattle: PH.afterBattle() };
const mock = {
 note: 'State shape = ENGINE.md §2. main = BR-Desktop table (Age 2, action phase, seat 0 Mina/Raven to act). afterTroll = after the confirmed invade. battle = Mina pillages Angerboda, Arash brought his leader (§21). afterBattle = result applied (§22). main.hints = legalActions sample for seat 0 (ENGINE.md §9).',
 seats: ['Mina', 'Niloufar', 'Arash', 'Sara'],
 ...Object.fromEntries(Object.entries(states).map(([k, s]) => [k, s])),
 mainHints: hints(M, ME)
};
W('data/mock-state.json', mock);
W('data/content.json', C);
W('data/cards.json', C.cards.map((c) => ({ num: c.num, age: c.age, minPlayers: c.minPlayers, type: c.type, ruleId: c.ruleId, value: c.value, afterReveal: c.afterReveal, titleEn: c.titleEn, titleFa: c.titleFa, rulesEn: c.rulesEn, extraEn: c.extraEn, rulesFa: c.rulesFa, art: `cards/${c.art}.webp`, back: `card-backs/${c.back}.webp` })));

// engine ids -> art (figure tokens by clan and upgrade card, slots, tokens)
const clanSlug = Object.fromEntries(C.clans.map((c) => [c.id, c.slug]));
const idmap = { clanIcon: {}, figureTokens: {}, clanSheet: {}, pillageReward: {}, map: {}, ui: {} };
for (const c of C.clans) {
  const cl = c.slug;
  idmap.clanIcon[c.id] = `tokens/icon-clan-${c.id}.webp`;
  idmap.figureTokens[cl] = { leader: `units/${cl}-leader-token.webp`, warrior: `units/${cl}-warrior-token.webp`, ship: `units/${cl}-ship-token.webp` };
  for (const card of C.cards.filter((x) => ['leader', 'warrior', 'ship', 'monster'].includes(x.type) && x.minPlayers < 5)) idmap.figureTokens[cl]['card-' + card.num] = `units/${cl}-${card.art}-token.webp`;
  idmap.clanSheet[cl] = { clanCard: `clan-reference/${cl}-icon-reference.webp`, leader: `clan-reference/${cl}-leader-reference.webp`, warrior: `clan-reference/${cl}-warrior-reference.webp`, ship: `clan-reference/${cl}-ship-reference.webp`, monsterSlot: 'clan-slots-complete/slot-monster.webp', clanSlot: 'clan-slots-complete/slot-clan.webp' };
}
idmap.figureTokens.fifthPlayerCopies = { 108: 23, 109: 24, 110: 25, 116: 57, 117: 58, 118: 59, 124: 91, 125: 92, 126: 93 };
for (const r of ['yggdrasil', 'rage', 'axe', 'horn', 'glory']) idmap.pillageReward[r] = `tokens/icon-${r}.webp`;
Object.assign(idmap.map, { board: 'boards/main-board.webp', sea: 'backgrounds/sea-background.webp', logo: 'branding/blood-rage-logo.webp', destroyed: 'tokens/ragnarok.webp', doom: 'tokens/icon-destiny.webp', pillagedIcon: 'tokens/icon-pillage.webp (BGA uses the reward icon on a dark plate)', statsBoard: 'boards/clan-statistics.webp' });
Object.assign(idmap.ui, { spotTarget: 'ui-icons/spot-target.webp', hoverInvade: 'ui-icons/hover-invade.webp', remove: 'ui-icons/remove.webp', battle: 'tokens/battle.webp', firstPlayer: 'tokens/firstplayer.webp', handCount: 'ui-icons/board-card.webp', rage: 'tokens/icon-rage.webp', statMini: { rage: 'tokens/icon-rage-mini.webp', axe: 'tokens/icon-axe-mini.webp', horn: 'tokens/icon-horn-mini.webp' }, cardBacks: ['card-backs/age-1-back.webp', 'card-backs/age-2-back.webp', 'card-backs/age-3-back.webp'] });
W('data/content-id-map.json', idmap);

// layout.json: every position and size the renderer needs
W('layout.json', {
 note: 'Map units 0..1600 (BGA board). On screen: left = x/16 %, top = y/16 %, translate(-50%,-50%); sizes are % of the map width. COMPONENTS.md §6-§12.',
 mapSize: 1600,
 provinces: C.provinces.map((p) => ({ id: p.id, nameEn: p.nameEn, nameFa: p.nameFa, region: p.region, x: p.x, y: p.y, doomX: p.doomX, doomY: p.doomY, villages: p.villages, adjacent: p.adjacent, fjords: p.fjords })),
 villages: C.slots.filter((s) => s.id > 0).map((s) => ({ id: s.id, province: s.province, x: s.x, y: s.y })),
 fjords: C.fjords,
 yggdrasil: { x: C.provinces[0].x, y: C.provinces[0].y, ring: { radius: 130, startDeg: -120, minSlots: 6 } },
 fjordShips: { spacing: 95 },
 sizes: { figureToken: '11%', pillageToken: '4.4%', destroyedDisc: '10.6%', doomToken: '4.4%', spotTarget: '4.6%', removeMark: '34% of the token' },
 statsBoard: { width: 800, height: 347, stepX: [229, 328, 427, 527, 626, 725], rowY: { rage: 80, axe: 183, horn: 286 }, token: '11% of the board width, centred on (stepX, rowY - 6)' },
 clanSheetOrder: { cols5: ['clanCard', 'leader', 'warrior', 'monster', 'monster2', 'blank', 'ship', 'clan0', 'clan1', 'clan2'], cols9: 'same without blank', cols3: 'same without blank', direction: 'always left-to-right, also in Persian' },
 breakpoints: { sheet9cols: '>=1720px', sheet5cols: 'default', sheet3cols: '<=1100px', railOnTop: '<=1100px', squareMap: '<=760px' },
 desktop: { railWidth: 300, mapBoxHeight: 720, cardWidth: 150 },
 clanColors: Object.fromEntries(C.clans.map((c) => [c.slug, { color: c.color, color2: c.color2 }]))
});
console.log('data ok; hints', mock.mainHints.length);
