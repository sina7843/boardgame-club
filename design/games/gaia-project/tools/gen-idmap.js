// content-id-map.json: repo content ids (src/content) -> handoff art paths. node gen-idmap.js <factions.json> <out.json>
const fs = require('fs');
const [facPath, out] = process.argv.slice(2);
const factions = JSON.parse(fs.readFileSync(facPath, 'utf8'));
const pairs = (dir, list) => Object.fromEntries(list.map(([file, id]) => [id, `art/${dir}/${file}.webp`]));
const boardName = { 'hadsch-hallas': 'Hadsch-Hallas', 'bal-taks': 'Bal-Taks' };
const portraitName = { 'hadsch-hallas': 'HadschHallas', 'bal-taks': 'BalTaks' };
const cap = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const color = { r: 'blue', o: 'red', v: 'orange', d: 'yellow', s: 'brown', t: 'grey', i: 'white' };
const markerColor = (c) => (c === 'grey' ? 'gray' : c); // satellites and gaiaformers spell it "gray"

const map = {
  note: 'Tech/booster/round/final/federation ids were matched from labelFa text and tile icons. Confirm each one against the tile once (QA step G1).',
  techStandard: pairs('technology', [['TECqic', 'std1'], ['TECvps', 'std2'], ['TECpia', 'std3'], ['TECtyp', 'std4'], ['TECore', 'std5'], ['TECknw', 'std6'], ['TECgai', 'std7'], ['TECcre', 'std8'], ['TECpow', 'std9']]),
  techAdvanced: pairs('technology', [['ADVfedP', 'adv1'], ['ADVlab', 'adv2'], ['ADVtyp', 'adv3'], ['ADVminV', 'adv4'], ['ADVtrsV', 'adv5'], ['ADVfedV', 'adv6'], ['ADVsecV', 'adv7'], ['ADVsecO', 'adv8'], ['ADVgai', 'adv9'], ['ADVqic', 'adv10'], ['ADVore', 'adv11'], ['ADVknw', 'adv12'], ['ADVtrsB', 'adv13'], ['ADVminB', 'adv14'], ['ADVstp', 'adv15']]),
  boosters: pairs('round-boosters', [['BOOknw', 'b1'], ['BOOpwt', 'b2'], ['BOOqic', 'b3'], ['BOOter', 'b4'], ['BOOnav', 'b5'], ['BOOmin', 'b6'], ['BOOtrs', 'b7'], ['BOOlab', 'b8'], ['BOOpia', 'b9'], ['BOOgai', 'b10']]),
  roundScoring: { ...pairs('round-scoring', [['RNDter', 'r1'], ['RNDstp', 'r2'], ['RNDmin', 'r3'], ['RNDfed', 'r4'], ['RNDtrs4', 'r5'], ['RNDgai4', 'r6'], ['RNDpia', 'r7'], ['RNDtrs3', 'r8'], ['RNDgai3', 'r9'], ['RNDpia', 'r10']]), back: 'art/round-scoring/round-scoring-back.webp' },
  finalScoring: pairs('final-scoring', [['FINbld', 'f1'], ['FINfed', 'f2'], ['FINtyp', 'f3'], ['FINgai', 'f4'], ['FINsec', 'f5'], ['FINsat', 'f6']]),
  federations: { ...pairs('federation-tokens', [['FEDvps', 'fed1'], ['FEDqic', 'fed2'], ['FEDpwt', 'fed3'], ['FEDore', 'fed4'], ['FEDcre', 'fed5'], ['FEDknw', 'fed6']]), gleens: 'art/federation-tokens/FEDgle.webp' },
  resources: { c: 'art/tokens-markers/Credits.webp', o: 'art/tokens-markers/Ores.webp', k: 'art/tokens-markers/Knowledge.webp', q: 'art/tokens-markers/Qic.webp', pw: 'art/tokens-markers/Power.webp', powerToken: 'art/tokens-markers/power-token-physical.webp', vp: 'art/reference-only/source-symbols/VP.webp (score badge in the player panel)', recordToken: 'art/tokens-markers/RecordToken.webp' },
  pieces: {
    structure: 'art/structures/{MI|TS|RL|PI|AC}-{color}.webp  (color: blue red orange yellow brown grey white)',
    gaiaformer: 'art/tokens-markers/player-token-{markerColor}.webp  (octagon; NOT the player marker; markerColor uses "gray")',
    playerMarker: 'art/tokens-markers/satellite-{markerColor}.webp  (research tracks, final tracks, planet counters, federation satellites)',
    spaceStation: 'art/tokens-markers/SpaceStation.webp', lostPlanet: 'art/tokens-markers/LostPlanet.webp', brainstone: 'art/tokens-markers/brainstone-physical.webp',
    gaiaPlanetToken: 'art/tokens-markers/gaia-planet-token.webp', firstPlayer: 'art/tokens-markers/first-player-marker.webp', actionToken: 'art/tokens-markers/ActionToken.webp'
  },
  planets: { r: 'art/planet-art/planet-blue.webp', o: 'art/planet-art/planet-red.webp', v: 'art/planet-art/planet-orange.webp', d: 'art/planet-art/planet-yellow.webp', s: 'art/planet-art/planet-brown.webp', t: 'art/planet-art/planet-grey.webp', i: 'art/planet-art/planet-white.webp', g: 'art/planet-art/planet-gaia.webp', m: 'art/planet-art/planet-transdim.webp' },
  boards: { research: 'art/boards/research-board.webp', scoring: 'art/boards/scoring-board.webp', sector: 'art/space-sectors/sector-{1..10}.webp (5/6/7 also have *outlined for the 2-player back sides)' },
  factions: Object.fromEntries(factions.map((f) => {
    const c = color[f.home];
    return [f.id, {
      nameFa: f.nameFa, nameEn: f.nameEn, home: f.home, color: c,
      board: `art/boards/faction-${boardName[f.id] || cap(f.id)}.webp`,
      portrait: `art/artwork/faction-portraits/portrait-${portraitName[f.id] || cap(f.id)}.webp`,
      structures: `art/structures/{MI|TS|RL|PI|AC}-${c}.webp`,
      satellite: `art/tokens-markers/satellite-${markerColor(c)}.webp`,
      gaiaformer: `art/tokens-markers/player-token-${markerColor(c)}.webp`
    }];
  }))
};
fs.writeFileSync(out, JSON.stringify(map, null, 1));
console.log('factions', factions.length);
