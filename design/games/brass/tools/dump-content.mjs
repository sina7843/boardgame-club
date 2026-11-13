// node --experimental-strip-types --no-warnings dump-content.mjs <repo>/games/brass/src  -> ../work/content.json
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const src = process.argv[2];
const m = await import(pathToFileURL(src + '/content/index.ts'));
const out = { LOCATIONS: m.LOCATIONS, LINKS: m.LINKS, TILES: m.TILES, MERCHANT_TILES: m.MERCHANT_TILES, INDUSTRY_CARDS: m.INDUSTRY_CARDS };
fs.writeFileSync(new URL('../work/content.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
