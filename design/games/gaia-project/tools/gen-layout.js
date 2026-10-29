// Writes layout.json: every measured position for the Gaia renderer, in source-image pixels.
// Same numbers as build-gaia.js (the canvas artboards); node gen-layout.js <out.json>
// Convention: x/y are the piece CENTRE on the board image; place with left = x/W, top = y/H,
// transform: translate(-50%, -50%); width is a percentage of the board width.
const fs = require('fs');
const range = (n) => [...Array(n).keys()];

const hexCols = [[210, 350, 490], [140, 280, 420, 560], [70, 210, 350, 490, 630], [140, 280, 420, 560], [210, 350, 490]];
const layout = {
  version: '2026-10-28 (review 7)',
  units: 'source image pixels; widths in % of the board image width',
  colors: { r: 'blue', o: 'red', v: 'orange', d: 'yellow', s: 'brown', t: 'grey', i: 'white' },
  ownStroke: { note: 'second drop-shadow stroke only on the viewer\'s own buildings, in the home-planet colour', hadschHallas: '#F0624F' },

  map: {
    frame: { w: 2450, h: 1895, note: '4-player 3-4-3 layout used on the canvas' },
    sector: { image: 'art/space-sectors/sector-{n}.webp', w: 650, h: 705, hex: { orientation: 'flat-top', w: 160, h: 140, colPitch: 120 } },
    hexCentresInSector: hexCols.flatMap((ys, c) => ys.map((y) => [80 + 120 * c, y])),
    sectorOrigins4p: [[240, 140], [840, 70], [1440, 0], [0, 700], [600, 630], [1200, 560], [1800, 490], [360, 1190], [960, 1120], [1560, 1050]],
    sectorVectors: { A: [600, -70], B: [360, 490], note: 'origin = i*A + j*B; rows (i=0..2,j=0) (i=-1..2,j=1) (i=-1..1,j=2)' },
    outline: { stroke: 'rgba(132,164,214,.85)', width: 5, note: 'only the outer edge of each sector; the art draws the inner lines' },
    pieceWidthPct: { MI: 8.2, TS: 6.5, RL: 6.2, AC: 5.6, PI: 5.2, GF: 6.5 },
    pieceFiles: 'art/structures/{MI|TS|RL|AC|PI|GF}-{color}.webp',
    rotation: 'sector rotation (60° steps) only rotates the image; hex centres stay on the same grid'
  },

  researchBoard: {
    image: 'art/boards/research-board.webp', w: 1838, h: 1972,
    tracks: ['terraforming', 'navigation', 'ai', 'gaia', 'economy', 'science'],
    advancedTech: { centres: range(6).map((t) => [185 + 300 * t, 245]), widthPct: 13.3 },
    standardTech: { centres: range(6).map((t) => [160 + 298 * t, 1288]), widthPct: 16.3 },
    standardTechBottom: { centres: [[280, 1565], [865, 1565], [1450, 1565]], widthPct: 16.3 },
    playerMarker: {
      file: 'art/tokens-markers/satellite-{color}.webp', widthPct: 3.2,
      cellCentreX: 'x = 15 + 298*track + 80', levelMidY: { 0: 1040, 1: 900, 2: 765, 3: 542, 4: 395, 5: 75 },
      cluster: { pitchX: 60, pitchY: 52, offsets: { 1: [[0, 0]], 2: [[-0.5, 0], [0.5, 0]], 3: [[-0.5, -0.45], [0.5, -0.45], [0, 0.45]], 4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] } }
    },
    powerActions: { ids: ['pw1', 'pw2', 'pw3', 'pw4', 'pw5', 'pw6', 'pw7'], centres: range(7).map((i) => [115 + 161 * i, 1870]), buttonPct: { w: 8.16, h: 7.61 }, usedTokenWidthPct: 12.4 },
    qicActions: { ids: ['qic1', 'qic2', 'qic3'], centres: [[1260, 1858], [1475, 1858], [1695, 1858]], buttonPct: { w: 9.52, h: 8.11 }, usedTokenWidthPct: 13.6 },
    usedToken: 'art/tokens-markers/ActionToken.webp (covers the whole action)',
    federationSupply: 'row of 6 token types with counts, under this board (not on the map)'
  },

  scoringBoard: {
    image: 'art/boards/scoring-board.webp', w: 1737, h: 1718,
    roundTiles: {
      centre: [863, 834], radius: 410, widthPct: 17.7,
      formula: 'round i (0..5): angle = 165 - 30i deg; x = cx + r cos(angle); y = cy - r sin(angle); rotate(90 - angle)',
      centres: range(6).map((i) => { const d = (165 - 30 * i) * Math.PI / 180; return [+(863 + 410 * Math.cos(d)).toFixed(1), +(834 - 410 * Math.sin(d)).toFixed(1), 90 - (165 - 30 * i)]; }),
      played: 'art/round-scoring/round-scoring-back.webp; no current-round marker'
    },
    finalTiles: { centres: [[1209, 955], [1209, 1273]], widthPct: 14.4 },
    finalTrackMarkers: { x: '342 + 61.6*value (0..10)', yRow1: '878 + 52*playerIndex', yRow2: '1190 + 52*playerIndex', widthPct: 3.1 },
    planetCounters: { widthPct: 5.4, centres: { blue: [867, 133], white: [289, 400], red: [1444, 400], grey: [122, 1044], orange: [1589, 1033], brown: [556, 1551], yellow: [1178, 1551], gaia: [863, 790] }, note: 'satellite of the player colour with the count on top; several players side by side' }
  },

  factionBoard: {
    image: 'art/boards/faction-{Name}.webp', w: 1753, h: 999, note: 'same frame for all 14 factions; remaining buildings sit on their slots, built ones are removed from the left',
    slots: {
      PI: { centres: [[300, 487]], widthPct: 9.6 },
      AC: { centres: [[922, 483], [1113, 483]], widthPct: 8.6 },
      RL: { centres: [[892, 705], [1017, 705], [1150, 705]], widthPct: 6.6 },
      TS: { centres: [[253, 708], [345, 708], [433, 708], [522, 708]], widthPct: 6.6 },
      MI: { centres: [[250, 912], [342, 912], [433, 912], [517, 912], [612, 912], [700, 912], [792, 912], [883, 912]], widthPct: 6.6 }
    },
    hoverFade: 0.18,
    powerBowls: { gaia: [100, 183], I: [467, 258], II: [467, 83], III: [783, 167], token: 'art/tokens-markers/power-token-physical.webp', tokenWidthPct: 4.8, scatterExampleBowlI: [[420, 223], [520, 218], [470, 273], [565, 283]], scatterExampleBowlII: [[430, 63], [520, 93]] },
    conversions: { leftPct: 88.14, widthPct: 11.12, heightPct: 7.01, topPct: [47.35, 56.36, 63.86, 72.87, 78.88, 87.89], ids: ['pw-q', 'pw-o', 'pw-k', 'pw-c', 'k-c', 'o-t'] },
    booster: { gridColumnPct: 11.6, note: 'beside the board, bottom-aligned, as tall as the lower section' },
    ownedRow: { tileHeightPx: { desktop: 128, mobile: 72 }, note: 'tech tiles, federation tokens; a used action is covered by ActionToken' }
  }
};
fs.writeFileSync(process.argv[2], JSON.stringify(layout, null, 1));
console.log('ok');
