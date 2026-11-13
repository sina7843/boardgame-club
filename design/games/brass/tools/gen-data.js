// Writes the developer data of the Brass package: layout.json (all measured positions), data/content-id-map.json
// (engine content ids -> art files), data/cards.json (the draw deck of the code), data/mock-state.json.
// node gen-data.js <design/games/brass dir>
const fs = require('fs'), path = require('path');
const G = require('./geo');
const { M, COLORS, INDUSTRIES, cardArt } = require('./br-lib');
const out = process.argv[2];
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
const w = (f, o) => fs.writeFileSync(path.join(out, f), JSON.stringify(o, null, 1));

const slots = {};
for (const l of M.locations) if (l.slots) slots[l.id] = l.slots.map((acc, i) => ({ slot: i, accepts: acc, x: G.SLOTS[l.id][i][0], y: G.SLOTS[l.id][i][1] }));
w('layout.json', {
  note: 'Brass: Birmingham geometry. Board = art/boards/board-night.webp (square). Units 0..1000 of the image width; on screen left = x/10 %, top = y/10 %, transform translate(-50%,-50%); widths are % of the board. Mat units: 0..1000 of the mat width and 0..matHeight of its height (top = y/matHeight %). Measured with tools/find-slots2.py, find-frames.py, strip.py; checked with tools/overlay.py.',
  board: {
    image: 'art/boards/board-night.webp', frame: 1000,
    slot: { side: G.SLOT, tileWidthPct: 4.45, targetWidthPct: 4.7, cubesOffsetY: 6, cubeWidthPct: 1.25 },
    slots,
    links: Object.fromEntries(Object.entries(G.LINKS).map(([id, [x, y, a]]) => [id, { x, y, angle: a }])),
    linkTile: { widthPct: 5.2, aspect: '220/93', targetWidthPct: 5.6, targetHeightPct: 2.6 },
    merchants: G.MERCHANTS, merchantTileWidthPct: 4.6, beerWidthPct: 1.35,
    markets: { rowY: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((p) => [p, +G.ROW_Y(p).toFixed(2)])), coalX: G.COAL_X, ironX: G.IRON_X, cubeWidthPct: 1.5, fill: 'cubes occupy the most expensive spaces first (price 7 → 1 for coal, 5 → 1 for iron); buy price = rules.ts buyPrice()' },
    track: G.TRACK, trackMarkers: { vpWidthPct: 2.2, incomeWidthPct: 1.5, stackOffset: 7, note: 'several markers on one space are offset by 7 units inward (side edges) or downward/upward (top/bottom edges)' },
    turnOrder: G.ORDER, characterWidthPct: 4.6,
    cardFrames: G.FRAMES, cardFrameSize: G.FRAME_WH, pileCardWidthPct: 7.4
  },
  mat: { image: 'art/boards/player-mat-night.webp', aspect: '1800/1456', matHeight: +G.MAT_H.toFixed(2), frames: G.MAT, frameSide: G.MAT_FRAME, tileWidthPct: 7.75, countBadgeOffset: [30, 30] },
  seatColors: { order: COLORS, cardboard: { red: '#A14A2F', yellow: '#C3A243', purple: '#967BAC', grey: '#A5AFBE' }, note: 'code seat 0..3 = red, yellow, purple, grey (user choice 2026-10-29); the publisher set has no blue' }
});

// engine content -> art
const tiles = {};
for (const t of M.tiles) for (const c of COLORS) for (const side of ['front', 'back']) tiles[`${t.industry}-${t.level}-${c}-${side}`] = `art/industry-tiles/tile-${t.industry}-${t.level}-${c}-${side}.webp`;
const merch = Object.fromEntries(M.merchantTiles.map((t) => [t.id, `art/merchants/${!t.goods.length ? 'merchant-blank' : t.goods.length === 3 ? 'merchant-all' : 'merchant-' + t.goods[0]}.webp`]));
const folder = (name) => (name.startsWith('card-wild') ? 'cards-wild' : name === 'card-back' ? 'card-backs' : /^card-(cotton-manufacturer|coal|iron|brewery|pottery)(-[0-9])?$/.test(name) ? 'cards-industry' : 'cards-location');
const cards = M.cards.map((c) => ({ id: c.id, kind: c.kind, loc: c.loc, industries: c.industries, minPlayers: c.minPlayers, art: `art/${folder(cardArt(c.id))}/${cardArt(c.id)}.webp` }));
cards.push({ id: 900, kind: 'wild-location', art: 'art/cards-wild/card-wild-location.webp' }, { id: 901, kind: 'wild-industry', art: 'art/cards-wild/card-wild-industry.webp' });
w('data/cards.json', { note: 'The 64-card draw deck of rules.ts CARDS (minPlayers = from which player count a copy is used) + the two wilds (900, 901). Industry cards have several printed variants with the same rule; the variant is chosen by copy index.', cards, back: 'art/card-backs/card-back.webp' });
w('data/content-id-map.json', {
  note: 'Every engine id -> its art file. Seat colour = layout.json seatColors.order[seat].',
  tiles, merchantTiles: merch,
  links: Object.fromEntries(COLORS.flatMap((c) => ['canal', 'rail'].map((e) => [`${c}-${e}`, `art/links/link-${c}-${e}.webp`]))),
  markers: Object.fromEntries(COLORS.flatMap((c) => [[`vp-${c}`, `art/markers/vp-${c}.webp`], [`income-${c}`, `art/markers/income-${c}.webp`], [`character-${c}`, `art/characters/character-${c}-front.webp`]])),
  resources: { coal: 'art/resources/coal-cube.webp', iron: 'art/resources/iron-cube.webp', beer: 'art/resources/beer-barrel.webp' },
  industryIcons: Object.fromEntries(INDUSTRIES.map((i) => [i, `art/artwork/${{ cotton: 'art-cotton-mill', manufacturer: 'art-manufactured-goods', pottery: 'art-pottery', coal: 'art-coal-mine', iron: 'art-iron-works', brewery: 'art-brewery' }[i]}.webp`])),
  coins: { 1: 'art/money/coin-1.webp', 5: 'art/money/coin-5.webp', 15: 'art/money/coin-15.webp' },
  boards: { map: 'art/boards/board-night.webp', mat: 'art/boards/player-mat-night.webp', mapDay: 'art/boards/board-day.webp', matDay: 'art/boards/player-mat-day.webp', dayNote: 'day sides are low-res (1200 px, 639 px) and not used' }
});
const mock = JSON.parse(JSON.stringify(M));
for (const k of ['cards', 'tiles', 'stack', 'market', 'merchantTiles', 'locations', 'links']) delete mock[k];
w('data/mock-state.json', { note: `Reference positions of the artboards from one seeded 4-player game (seed ${M.seed}) played by engine/sim.mjs with the repo rules.ts unchanged: main = Rail Era round 6, viewer seat 0 to play (2 actions); start = first Canal round; eraEnd/final = before and after scoring with the breakdown; tutorial = step 2. hints[].cost = dry run of each legal action (money, market cubes, sources of coal/iron/beer, income, VP).`, ...mock });
console.log('data ok');
