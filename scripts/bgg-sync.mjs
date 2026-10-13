// Snapshot BoardGameGeek facts for the catalog into apps/web/src/data/bgg.json.
// Run: node scripts/bgg-sync.mjs [--descriptions <out.json>]  (English descriptions are only dumped for translation into bgg-fa.json)
// Then: python scripts/bgg-box-images.py  (box photos → apps/web/public/covers/box/<gameId>.webp)
// Uses BGG's public geekdo JSON endpoints; the XML API2 needs a registered token.
import { writeFileSync } from 'node:fs';

const IDS = {
  abalone: 526, amlak: 1406, 'ark-nova': 342942, azul: 230802, backgammon: 2397, battleship: 2425, bohnanza: 11,
  brass: 224517, 'camel-up': 153938, carcassonne: 822, catan: 13, century: 209685, checkers: 2083, chess: 171,
  citadels: 478, 'cockroach-poker': 11971, coup: 131357, 'crew-deep-sea': 324856, cryptid: 246784, 'dice-throne': 216734,
  dominion: 36218, 'el-dorado': 217372, 'for-sale': 172, 'gaia-project': 220308, go: 188, hanabi: 98778, heat: 366013,
  'high-society': 220, hive: 2655, jaipur: 54043, 'king-of-tokyo': 70323, kingdomino: 204583, 'lost-cities': 50,
  'love-letter': 129622, ludo: 2136, 'machi-koro': 143884, 'no-thanks': 12942, onitama: 160477, othello: 2389,
  patchwork: 163412, 'point-salad': 274960, quoridor: 624, 'race-galaxy': 28143, 'res-arcana': 262712, risk: 181,
  santorini: 194655, scout: 291453, 'sea-salt-paper': 367220, set: 1198, 'six-nimmt': 432, skull: 92415,
  'snakes-ladders': 5432, 'space-base': 242302, splendor: 148228, 'star-realms': 147020, 'sushi-go': 133473, tak: 197405,
  'terraforming-mars': 167791, 'the-crew': 284083, 'the-mind': 244992, 'ticket-to-ride': 9209, unmatched: 274637,
  uno: 2223, 'wonders-duel': 173346, yahtzee: 2243
};

const get = async (url) => {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'user-agent': 'persian-boardgame-webapp bgg-sync' } });
    if (r.ok) return (await r.json()).item;
    if (i === 3) throw new Error(`${r.status} ${url}`);
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
};
const num = (v) => (v == null || v === '' || Number(v) === 0 ? null : Number(v));
const links = (l, n = 99) => (l ?? []).slice(0, n).map((x) => ({ id: Number(x.objectid), name: x.name }));
const text = (html) => html.replace(/<\/p>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&#?\w+;/g, (e) =>
  ({ '&amp;': '&', '&quot;': '"', '&#039;': "'", '&ndash;': '–', '&mdash;': '—', '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…' })[e] ?? e)
  .split('\n').map((s) => s.trim()).filter(Boolean);

const out = {}, desc = {};
for (const [gameId, bggId] of Object.entries(IDS)) {
  const t = await get(`https://api.geekdo.com/api/geekitems?objectid=${bggId}&objecttype=thing&subtype=boardgame`);
  const d = await get(`https://api.geekdo.com/api/dynamicinfo?objectid=${bggId}&objecttype=thing`);
  const best = d.polls?.userplayers?.best?.[0];
  out[gameId] = {
    bggId, name: t.name, year: num(t.yearpublished),
    players: [num(t.minplayers), num(t.maxplayers)], best: best ? [best.min, best.max] : null,
    minutes: [num(t.minplaytime), num(t.maxplaytime)], minAge: num(t.minage),
    weight: d.stats.avgweight ? Math.round(Number(d.stats.avgweight) * 100) / 100 : null,
    rating: d.stats.average ? Math.round(Number(d.stats.average) * 100) / 100 : null,
    ratings: Number(d.stats.usersrated), owned: Number(d.stats.numowned),
    rank: num(d.rankinfo?.find((r) => r.rankobjectid === 1)?.rank),
    designers: links(t.links.boardgamedesigner).filter((x) => x.name !== '(Uncredited)'),
    artists: links(t.links.boardgameartist, 5).filter((x) => x.name !== '(Uncredited)'),
    publishers: links(t.links.boardgamepublisher, 3).filter((x) => x.name !== '(Unknown)'),
    categories: links(t.links.boardgamecategory), mechanics: links(t.links.boardgamemechanic),
    honors: (t.links.boardgamehonor ?? []).length,
    image: t.images?.original ?? null
  };
  desc[gameId] = { name: t.name, short: t.short_description, description: text(t.description) };
  console.log(gameId.padEnd(18), bggId, t.name, t.yearpublished);
}
writeFileSync(new URL('../apps/web/src/data/bgg.json', import.meta.url), JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), games: out }, null, 1) + '\n');
const i = process.argv.indexOf('--descriptions');
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(desc, null, 1));
