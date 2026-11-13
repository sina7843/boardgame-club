// Builds the Ark Nova handoff folder (repo/design/games/ark-nova + .claude) except the hand-written docs and the
// reference images (render-ref.py). node make-package.js <out dir> <canvas build dir>
const fs = require('fs');
const path = require('path');
const X = require('./an-lib');
const [out, build] = process.argv.slice(2);
const G = path.join(out, 'repo', 'design', 'games', 'ark-nova');
const ROOT = path.join(__dirname, '..');
const FLAT = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/ark-nova/ready to use - flat';
const REAL = 'X:/Work/01_Clients/دراگون/boardgameverse/Games Redesign/ark-nova/real components/sources';
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const cpDir = (a, b) => { mk(b); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d); } };
const J = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 1));
mk(G);

// art (publisher flat set as web webp + BGA strips/board + cut BGA icons)
cpDir(path.join(ROOT, 'art'), path.join(G, 'art'));

// data
const D = path.join(G, 'data'); mk(D);
const M = X.M;
J(path.join(D, 'mock-state.json'), { note: 'Mid-game 4-player position of every reference screen, built only through the repo engine (work/engine/mock2.mjs); view = projectState(seat 0); sub/flows = engine prompts captured on clones.', seed: M.seed, state: M.state, view: M.view, legal: M.legal, sub: M.sub, flows: M.flows, handInfo: M.handInfo });
const cards = [];
for (const [id, a] of Object.entries(M.ANIMAL)) cards.push({ id: +id, kind: 'animal', name: M.names[id], nameFa: M.cardFa[id]?.nameFa ?? M.names[id], textFa: M.cardFa[id]?.textFa ?? '', art: 'art/' + X.cardFile(+id) + '.webp', ...a });
for (const [id, s] of Object.entries(M.SPONSOR)) cards.push({ id: +id, kind: 'sponsor', name: M.names[id], nameFa: M.cardFa[id]?.nameFa ?? M.names[id], textFa: M.cardFa[id]?.textFa ?? '', art: 'art/' + X.cardFile(+id) + '.webp', ...s });
for (const [id, p] of Object.entries(M.PROJECT)) cards.push({ id: +id, kind: p.base ? 'base-project' : 'project', name: M.names[id], nameFa: M.names[id], art: 'art/' + X.cardFile(+id) + '.webp', ...p });
for (const [id, s] of Object.entries(M.flows.scoringNames)) cards.push({ id: +id, kind: 'final-scoring', nameFa: s.nameFa, textFa: s.textFa, art: 'art/' + X.cardFile(+id) + '.webp' });
for (const c of cards) if (!fs.existsSync(path.join(G, c.art))) throw new Error('missing art ' + c.art);
J(path.join(D, 'cards.json'), cards);
const UNIQUE = { 245: 'unique-aquarium', 246: 'unique-cable-car', 247: 'unique-baboon-rock', 248: 'unique-rhesus-monkey-park', 249: 'unique-barred-owl-hut', 250: 'unique-sea-turtle-tank', 251: 'unique-polar-bear-exhibit', 252: 'unique-spotted-hyena-compound', 253: 'unique-okapi-stable', 254: 'unique-zoo-school', 255: 'unique-adventure-playground', 256: 'unique-water-playground', 257: 'unique-side-entrance', 243: 'unique-meerkat-den', 244: 'unique-penguin-pool' };
J(path.join(D, 'content-id-map.json'), {
  note: 'engine id -> art (paths relative to design/games/ark-nova). Cards: 128 animals 401-528, 64 sponsors 201-264, 12 base projects 101-112, 20 conservation projects 113-132, 11 final scoring 1-11.',
  cards: Object.fromEntries(cards.map((c) => [c.id, c.art])),
  buildings: { e1: 'art/enclosures/enclosure-1-{empty|occupied}.webp', e2: 'art/enclosures/enclosure-2-{empty|occupied}.webp', e3: 'art/enclosures/enclosure-3-{empty|occupied}.webp', e4: 'art/enclosures/enclosure-4-{empty|occupied}.webp', e5: 'art/enclosures/enclosure-5-{empty|occupied}.webp', kiosk: 'art/special-buildings/kiosk.webp', pavilion: 'art/special-buildings/pavilion.webp', pz: 'art/special-buildings/petting-zoo.webp', rh: 'art/special-buildings/reptile-house.webp', ba: 'art/special-buildings/large-bird-aviary.webp', ...Object.fromEntries(Object.entries(UNIQUE).map(([id, f]) => ['u' + id, `art/unique-buildings/${f}.webp`])) },
  actionCards: Object.fromEntries(X.ACTIONS.flatMap((k) => [[k + ':I', `art/${X.actFile(k, false)}.webp`], [k + ':II', `art/${X.actFile(k, true)}.webp`]])),
  maps: Object.fromEntries(['A', '0', '1', '2', '3', '4', '5', '6', '7', '8'].map((m) => [m, `art/boards/map-${m}.webp`])),
  icons: Object.fromEntries(X.ICON_ORDER.map((i) => [i, `art/icons/${X.ICON_FILE[i]}.webp`])),
  partnerZoos: Object.fromEntries(['africa', 'americas', 'asia', 'australia', 'europe'].map((z) => [z, `art/partner-zoos/partner-${z}.webp`])),
  universities: Object.fromEntries(Object.entries(X.UNI_FILE).map(([k, f]) => [k, `art/universities/${f}.webp`])),
  bonusTiles: Object.fromEntries(Object.entries(X.BONUS_FILE).map(([k, f]) => [k, `art/bonus-tiles/${f}.webp`])),
  pieces: { counter: 'art/pieces/counter-{red|blue|yellow|black}.webp (appeal / conservation / reputation markers)', cube: 'art/pieces/cube-{color}.webp (map edge tokens, project supports)', worker: 'art/pieces/worker-{color}.webp (association workers)', breakToken: 'art/wooden-pieces/break-token.webp' },
  tokens: { venom: 'art/tokens/venom.webp', multiplier: 'art/tokens/multiplier.webp', constriction: 'art/tokens/constriction.webp', x: 'art/tokens/x-token.webp' },
  ui: 'art/ui/*.webp (BGA icon sprite cuts: money, appeal, conservation, reputation, xtoken, break, act-<action>, ...)',
  bga: { associationBoard: 'art/bga/association-board.webp', reputationTrack: 'art/bga/reputation-track.webp', conservationTrack: 'art/bga/conservation-track.webp', scoreBoard: 'art/bga/score-board.webp' }
});
J(path.join(D, 'building-cells.json'), X.CELLS);
const idx = [];
const walk = (d, rel) => { for (const f of fs.readdirSync(d)) { const s = path.join(d, f); if (fs.statSync(s).isDirectory()) walk(s, rel + f + '/'); else if (f.endsWith('.webp')) idx.push({ path: 'art/' + rel + f, bytes: fs.statSync(s).size }); } };
walk(path.join(G, 'art'), '');
J(path.join(D, 'art-index.json'), idx);
fs.rmSync(path.join(G, 'art', 'art-index.json'), { force: true });
for (const f of ['asset-manifest.json', 'component-coverage.json', 'approved-file-mapping.json', 'coordinate-review.json', 'package-info.json']) fs.copyFileSync(path.join(FLAT, 'data', f), path.join(D, 'publisher-' + f));

// layout.json
const L = {
  note: 'Centres in source-image pixels unless marked as fractions. Place pieces with left = x/W·100%, top = y/H·100%, translate(-50%,-50%). Boards are dir=ltr. Measured with tools/gridcrop.py; BGA layout measured on a live BGA table DOM (2026-10-30).',
  zooMap: { image: 'art/boards/map-<id>.webp', size: [X.MAP_W, X.MAP_H], shownWindow: { x: 0, y: 0, w: X.MAPC.w, h: X.MAPC.h, note: 'BGA: notebook + bonus column | hexes | partner/university column; the rules text and building legend are cropped away (image width 142.349% of the window)' }, clipStrip: { y: X.STRIP.y, h: X.STRIP.h, note: 'bottom paper strip with clips 1-5 = the action-card band; image top -665.44% of the band' },
    hexCentre: 'x = 327 + 100.6·col, y = 132.3 + 57.75·row for cell "col_row" (hex.ts ids); R = 66.9; same grid on all 10 maps (tools/check-maps.py)', hexR: X.HEX.r,
    leftEdgeTokens: X.LEFT_XY, unhiredWorkers: X.WORKER_XY, partnerSlots: X.PARTNER_XY, universitySlots: X.UNI_XY, actionClipsX: X.CLIP_X, playerNote: { box: 'top 10.5%, left 1.1%, width 13.6% of the window', content: 'player name in seat ink + available workers' } },
  buildings: { rule: 'publisher image fitted onto the engine cells: rotation k·30° (+ mirror) of the image hex cells (data/building-cells.json, R = 135 px in the art); scale = 66.9/135', algorithm: 'tools/an-lib.js fitBuilding()' },
  display: { folders: 6, layout: 'BGA card pool: 6 equal columns, folder tab (city + number) above a full card', cities: X.FOLDER_CITY, range: 'folders 1..range(rep) ringed for the viewer' },
  reputationTrack: { image: 'art/bga/reputation-track.webp', size: [2752, 95], slotCentreX: 'r<=1: 0.081, 2: 0.2025, 3: 0.2835, r>=4: 0.351 + 0.054·(r−4) (fraction of width); y 0.5', bonuses: X.REP_BONUS },
  conservationTrack: { image: 'art/bga/conservation-track.webp', size: [3188, 330], slotCentreX: 'cp 0..10: 0.0461 + 0.09077·cp; counters at y 0.2253; cp > 10 stays on slot 10 with the number badge', bonusTiles: X.CP_TILE },
  associationBoard: { image: 'art/bga/association-board.webp', size: [X.BAB_W, X.BAB_H], partnerZoos: X.BAB_ZOO, universities: X.BAB_UNI, workerZones: X.BAB_TASK, hotAreas: X.BAB_HOT, donationSpaces: X.BAB_DONATE },
  projects: { shownBand: 'bottom 44% of the card (aspect 400/176)', levelCentres: X.LEVEL_XY.map(([x]) => [x, 0.68]), played: 'band above the association board', base: 'band below it' },
  mainBoard: { image: 'art/boards/main-board.webp', size: [X.MB_W, X.MB_H], use: 'score-board sheet only (appeal track); not on the table, like BGA', appeal: 'v 0-51: (180 + 53v, 735); 52-60: (2915, 610 − 52.5(v−52)); 61-113: (2883 − 53(v−61), 75)', conservation: 'green tab of its target number (target = 114 − 2c up to 10, then − 3 each): average of the covered appeal boxes, y 118 (top row) / 672 (bottom) / x 2858 (right column); cp 0 at (55, 100)', reputation: { x: [430, 610, 845, 985, 1180, 1270, 1365, 1555, 1650, 1740, 1950, 2040, 2128, 2312, 2400, 2490], note: 'marker at x − 42 (rep ≥ 1), y 300' }, breakToken: 'x = 1760 + (max − brk)·58.7, y 200', folders: { x: X.FOLDER_X, y: X.FOLDER.y }, bonusTiles: X.BONUS_XY },
  seats: X.SEATS.map((s) => s.color), colors: X.COLORS
};
J(path.join(G, 'layout.json'), L);

// reference: canvas sources and offline pages
const R = path.join(G, 'reference'); mk(path.join(R, 'dc')); mk(path.join(R, 'html', 'an')); mk(path.join(R, 'img')); mk(path.join(R, 'rules'));
const ids = fs.readdirSync(path.join(build, 'project', 'ark-nova')).filter((f) => f.endsWith('.dc.html')).map((f) => f.replace('.dc.html', ''));
for (const id of ids) {
  fs.copyFileSync(path.join(build, 'project', 'ark-nova', id + '.dc.html'), path.join(R, 'dc', id + '.dc.html'));
  fs.copyFileSync(path.join(build, 'project', 'ark-nova', '_qa-' + id + '.html'), path.join(R, 'html', 'an', id + '.html'));
}
cpDir(path.join(build, 'project', 'assets', 'games', 'ark-nova'), path.join(R, 'html', 'assets', 'games', 'ark-nova'));
cpDir(path.join(build, 'project', 'ds'), path.join(R, 'html', 'ds'));
for (const f of ['official-rulebook.pdf', 'official-glossary.pdf', 'official-icon-overview.pdf']) fs.copyFileSync(path.join(REAL, f), path.join(R, 'rules', f));

// tools (to rebuild the artboards; not for the site)
const T = path.join(G, 'tools'); mk(T);
for (const f of fs.readdirSync(__dirname)) if (/\.(js|py)$/.test(f)) fs.copyFileSync(path.join(__dirname, f), path.join(T, f));
fs.copyFileSync(path.join(ROOT, 'work', 'engine', 'mock2.mjs'), path.join(T, 'mock2.mjs'));
console.log('ok', ids.length, 'screens,', idx.length, 'art files,', cards.length, 'cards');
