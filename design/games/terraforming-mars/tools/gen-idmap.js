// data/content-id-map.json (engine ids -> art) and data/cards.json (every card from content/*.ts with its art file).
// node gen-idmap.js <art dir> <mock.json> <out dir>
const fs = require('fs'), path = require('path');
const { CORP_FILE, COLORS } = require('./tm-lib');
const [art, mockPath, out] = process.argv.slice(2);
const M = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
const proj = fs.readdirSync(path.join(art, 'cards', 'projects'));
const cardArt = (id) => (id.startsWith('R') ? `art/cards/corporations/${CORP_FILE[id]}.webp` : `art/cards/projects/${proj.find((f) => f.startsWith(id + '-'))}`);
const special = { '008': 'capital', '085': 'commercial-district', '128': 'ecological-zone', '123': 'industrial-center', '140': 'lava-flows', '064': 'mining-area', '067': 'mining-rights', '142': 'mohole-area', '044': 'natural-preserve', '097': 'nuclear-zone', '199': 'restricted-area' };
const map = {
  note: 'Card ids are the official card numbers used by the engine (content/*.ts); every one has its own art file. Checked: 208 projects + 13 corporations, no gaps.',
  cards: Object.fromEntries(Object.keys(M.cards).filter((id) => !id.startsWith('R')).sort().map((id) => [id, cardArt(id)])),
  corporations: Object.fromEntries(Object.keys(M.cards).filter((id) => id.startsWith('R')).sort().map((id) => [id, cardArt(id)])),
  cardBack: 'art/cards/backs/project-card-back.webp',
  tiles: { greenery: 'art/tiles/greenery.webp', ocean: 'art/tiles/ocean.webp', city: 'art/tiles/city.webp' },
  specialTiles: Object.fromEntries(Object.entries(special).map(([id, f]) => [id, `art/tiles/special/${f}.webp`])),
  specialTilesNote: 'a placed tile with card = <id> uses this art (Capital 008 is a city tile with its own art)',
  cubes: Object.fromEntries([...Object.keys(COLORS).map((c) => [c, `art/markers/player/${c}-cube.webp`]), ['white', 'art/markers/white-cube.webp']]),
  firstPlayer: 'art/markers/first-player-marker.webp',
  corpLogos: Object.fromEntries(Object.entries(CORP_FILE).map(([id, f]) => [id, `art/markers/corp-logos/logo-${f}.webp`])),
  resources: { mc: 'art/icons/mc.webp', steel: 'art/icons/steel.webp', titanium: 'art/icons/titanium.webp', plants: 'art/icons/plant.webp', energy: 'art/icons/energy.webp', heat: 'art/icons/heat.webp' },
  cardResources: { microbe: 'art/icons/microbe.webp', animal: 'art/icons/animal.webp', science: 'art/icons/science.webp', fighter: 'art/icons/fighter.webp' },
  other: { score: 'no icon: the score is the brown circle (COMPONENTS.md 2.1)', tr: 'art/icons/tr.webp', firstPlayerBga: 'art/icons/first-player-bga.webp', card: 'art/icons/card.webp', cardSmall: 'art/icons/card-sm.webp', temperature: 'art/icons/temperature-sm.webp', oxygen: 'art/icons/oxygen-sm.webp', ocean: 'art/icons/ocean-tile.webp', city: 'art/icons/city.webp', greenery: 'art/icons/greenery.webp', generation: 'art/icons/generation.webp' },
  tags: Object.fromEntries(['building', 'space', 'science', 'power', 'earth', 'jovian', 'city', 'plant', 'microbe', 'animal', 'event', 'wild'].map((t) => [t, `art/markers/tags/tag-${t}.webp`])),
  tagsNote: 'cut at native 115 px from the BGA badges.png (ready to use - flat/sources); wild is used only on cards',
};
fs.writeFileSync(path.join(out, 'content-id-map.json'), JSON.stringify(map, null, 1));
const cards = Object.fromEntries(Object.entries(M.cards).map(([id, c]) => [id, { ...c, art: cardArt(id), ...(special[id] ? { tile: `art/tiles/special/${special[id]}.webp` } : {}) }]));
fs.writeFileSync(path.join(out, 'cards.json'), JSON.stringify(cards, null, 1));
for (const p of [...Object.values(map.cards), ...Object.values(map.corporations), ...Object.values(map.specialTiles)]) if (!fs.existsSync(path.join(art, '..', p))) throw new Error('missing ' + p);
console.log('cards', Object.keys(map.cards).length, 'corps', Object.keys(map.corporations).length);
