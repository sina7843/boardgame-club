// Writes layout.json: every measured position of the TM table, in source-image pixels (same numbers as the artboards).
// Convention: x/y are the piece CENTRE on the board image; left = x/W, top = y/H, translate(-50%,-50%); widths are % of
// the board width. node gen-layout.js <out.json>
const fs = require('fs');
const G = require('./tm-lib');
const r1 = (v) => +v.toFixed(1);
const pt = ([x, y]) => [r1(x), r1(y)];
const layout = {
  version: '2.0 (2026-10-29)',
  units: 'source image pixels; widths in % of the board image width',
  marsBoard: {
    image: 'art/boards/board-tharsis.webp', w: G.BW, h: G.BH,
    crop: { ...G.CROP, note: 'shown WITHOUT the printed TR frame (like BGA): frame aspect-ratio 920/774, overflow hidden; image width 111.304%, left -5.652%, top -6.202%. Overlays: left = (x-52)/920, top = (y-48)/774; widths below are % of the 1024 image, on screen use the windowWidthPct values' },
    windowWidthPct: { tile: 7.35, ownerCube: 2, trackCube: 2.9, plaqueCube: 2.56, standardProjectButton: [15.9, 3.93], plaqueButton: [9.13, 6.97], hexButton: [7.26, 9.97] },
    cornerPlates: 'draw/discard top-left, generation top-right, 8 px inset, outside the printed art',
    hexes: {
      orientation: 'pointy-top', radius: 38.6, pitchX: 66.8, pitchY: 58,
      formula: 'x = 246 + 33.4*|row-4| + 66.8*col; y = 201 + 58*row (row/col from board.ts SPACES)',
      centres: Object.fromEntries(G.M.spaces.map((s) => [s.id, pt(G.hex(s.id))])),
      offMap: { '01': 'Ganymede Colony', '02': 'Phobos Space Haven' }
    },
    tile: { widthPct: 6.6, files: 'art/tiles/{greenery|ocean|city}.webp; special tiles art/tiles/special/<name>.webp (data/content-id-map.json -> specialTiles)', ownerCube: { widthPct: 1.8, at: 'tile centre (the white square printed on the tile)' } },
    trTrack: { notShown: 'the TR track is cropped away; TR is in the player panels', cubeWidthPct: 2.6, sameCellOffsetPx: 6, generation: 'white cube on the same track', cells: Object.fromEntries([...Array(101).keys()].map((v) => [v, pt(G.trPos(v))])) },
    oxygen: { cubeWidthPct: 2.6, centre: [514, 448], radius: 340, angleDeg: '-42.7 + 6*v from vertical, clockwise', cells: Object.fromEntries([...Array(15).keys()].map((v) => [v, pt(G.oxyPos(v))])) },
    temperature: { cubeWidthPct: 2.6, formula: 'x = 905; y = 612 - (t+28)/2*25; -30 on the bulb (905, 660)', cells: Object.fromEntries([...Array(20).keys()].map((i) => -30 + 2 * i).map((t) => [t, pt(G.tempPos(t))])) },
    milestones: { ids: ['terraformer', 'mayor', 'gardener', 'builder', 'planner'], iconCentres: G.MILESTONE_XY, button: { centreDy: 8, wPct: 8.2, hPct: 6.2 }, cubeWidthPct: 2.3 },
    awards: { ids: ['landlord', 'banker', 'scientist', 'thermalist', 'miner'], iconCentres: G.AWARD_XY, button: { centreDy: 10, wPct: 8.2, hPct: 6.2 }, cubeWidthPct: 2.3 },
    standardProjects: { ids: ['sellPatents', 'powerPlant', 'asteroid', 'aquifer', 'greenery', 'city'], centres: G.SP_Y.map((y) => [148, y]), button: { wPct: 14.3, hPct: 3.5 } }
  },
  playerBoard: {
    notShown: 'like BGA the player board is not shown on the table; amounts and production are in the player dashboard header. Kept for reference only.',
    image: 'art/boards/player-board.webp', w: G.PW, h: G.PH,
    productionCube: { widthPct: 3.4, file: 'art/markers/player/<colour>-cube.webp' },
    production: Object.fromEntries(G.RES.map((r) => [r, Object.fromEntries((r === 'mc' ? [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((v) => [v, pt(G.PROD[r](v))]))])),
    countBadge: { centres: G.COUNT_XY, minWidthPct: 13, note: 'resource amount, white on a dark plate, over the lower corner of the printed resource icon' }
  },
  cards: {
    project: { native: [320, 450], aspect: 1.406 }, corporation: { native: [450, 321] },
    tableauStack: { visibleBandOfHeight: { blue: 0.46, green: 0.19, red: 0.13 }, marginTop: 'calc(var(--cw) * -1.406 * (1 - band))', cardWidthPx: { section: 150, headquarters: 218 } },
    sections: ['hq (corporation, grid)', 'automated (stack)', 'effects (blue without action, stack)', 'actions (blue with action, stack)', 'events (stack, closed by default)'],
    hand: { cardWidthPx: { desktop: 134, setup: 128, research: 150 }, note: 'no cost line under the card and no fading of unplayable cards (BGA); playable cards get the dashed --pick ring' },
    resourceBadge: { at: 'top 30%, inline-end 6% of the card', icon: 'art/icons/<microbe|animal|science|fighter>.webp' },
    usedActionCube: { at: 'top 4%, inline-start 4%', widthPct: 15 }
  },
  playerColours: { order: ['red', 'blue', 'green', 'yellow', 'black'], hex: G.COLORS, note: 'seat k uses order[k], same as today renderer.css .tm-seat-k' }
};
fs.writeFileSync(process.argv[2], JSON.stringify(layout, null, 1));
console.log('ok', Object.keys(layout.marsBoard.hexes.centres).length, 'hexes');
