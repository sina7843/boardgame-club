// Post-build SEO pass: one static HTML file per public route (own title, description, Open Graph, canonical,
// JSON-LD and readable text inside #root, which React replaces on mount), plus robots.txt and sitemap.xml.
// Private and per-user routes are not prerendered; they keep the generic shell (dist/spa.html).
// Run after `vite build`: node scripts/seo.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameRegistry } from '../../../packages/db/src/registry.ts';

const SITE = 'https://boardgameverse.ir';
const BRAND = 'بردگیم‌ورس';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (f: string) => JSON.parse(readFileSync(join(root, 'src/data', f), 'utf8'));
const faText: Record<string, { taglineFa?: string; aboutFa?: string[] }> = readJson('bgg-fa.json');
type Range = [number | null, number | null];
const bgg: Record<string, { players?: Range; minutes?: Range; minAge?: number | null }> = readJson('bgg.json').games;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fa = (n: number) => n.toLocaleString('fa-IR');
/** "۲ تا ۴"; BGG data sometimes leaves one or both ends null. */
const span = (r?: Range) => {
  const [a, b] = r ?? [null, null];
  if (!a || !b) return a || b ? fa((a || b)!) : undefined;
  return a === b ? fa(a) : `${fa(a)} تا ${fa(b)}`;
};
/** Search snippets show about 155 characters; cut at a word boundary. */
const clip = (s: string, max = 155) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max - 1))}…`);

interface Page { path: string; title: string; description: string; body: string; image?: string; jsonLd?: object }

const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const ogImage = `${SITE}/brand/BGV-og-image-1200x630.png`;

function render(p: Page): string {
  const url = SITE + p.path;
  const title = p.path === '/' ? p.title : `${p.title} | ${BRAND}`;
  const desc = esc(p.description);
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    p.jsonLd && `<script type="application/ld+json">${JSON.stringify(p.jsonLd).replace(/</g, '\\u003c')}</script>`
  ].filter(Boolean).join('\n    ');
  const out = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${desc}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${desc}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${p.image ?? ogImage}`)
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"><main style="max-inline-size:48rem;margin-inline:auto;padding:1rem">${p.body}</main></div>`);
  if (out === shell || !out.includes('rel="canonical"') || !out.includes(p.body)) throw new Error(`SEO template did not apply to ${p.path}`);
  return out;
}

const games = gameRegistry.map((g) => g.catalog && { id: g.manifest.gameId, players: g.manifest.playerCounts, ...g.catalog })
  .filter((g) => g !== undefined)
  .sort((a, b) => a.nameFa.localeCompare(b.nameFa, 'fa'));
const gameLinks = `<ul>${games.map((g) => `<li><a href="/games/${g.id}">${esc(g.nameFa)}</a> <bdi>${esc(g.nameOriginal)}</bdi></li>`).join('')}</ul>`;
const famous = games.filter((g) => ['chess', 'catan', 'backgammon', 'uno'].includes(g.id)).map((g) => g.nameFa).join('، ');

const pages: Page[] = [
  {
    path: '/', title: `بردگیم آنلاین به فارسی | ${BRAND}`,
    description: `بردگیم آنلاین به فارسی: ${fa(games.length)} بازی رومیزی محبوب مثل ${famous} را با دوستانتان یا حریفان تازه بازی کنید.`,
    body: `<h1>بردگیم آنلاین به فارسی</h1><p>${BRAND} جای بازی بردگیم آنلاین به زبان فارسی است: ${fa(games.length)} بازی رومیزی محبوب، میز زنده یا نوبتی، بازی با دوستان یا حریفان تازه، رتبه‌بندی و تورنمنت.</p><h2>بردگیم‌های آنلاین</h2>${gameLinks}`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, alternateName: ['دنیای بردگیم', 'BoardGameVerse'], url: `${SITE}/`, inLanguage: 'fa' }
  },
  {
    path: '/games', title: 'همه بردگیم‌های آنلاین',
    description: `فهرست ${fa(games.length)} بردگیم آنلاین ${BRAND}، از ${famous} تا بازی‌های استراتژی و کارتی؛ قوانین فارسی و بازی با دوستان.`,
    body: `<h1>بردگیم‌های آنلاین</h1>${gameLinks}`
  },
  ...games.map((g): Page => {
    const t = faText[g.id] ?? {};
    const b = bgg[g.id] ?? {};
    // Player range is what this site supports (manifest), not the box (BGG).
    const players: Range = [g.players.min, g.players.max];
    const minutes = span(b.minutes);
    const facts = [`${span(players)} نفر`, minutes && `${minutes} دقیقه`, b.minAge && `از ${fa(b.minAge)} سال`].filter(Boolean).join(' · ');
    const rules = g.rulesFa.map((l) => (l.startsWith('## ') ? `<h3>${esc(l.slice(3))}</h3>` : `<p>${esc(l)}</p>`)).join('');
    const image = `${SITE}/covers/${g.id}.webp`;
    return {
      path: `/games/${g.id}`, title: `${g.nameFa} آنلاین`, image,
      description: clip(`بازی آنلاین ${g.nameFa} به فارسی: ${t.taglineFa ?? g.summaryFa}`),
      body: `<h1>${esc(g.nameFa)}</h1><p><bdi>${esc(g.nameOriginal)}</bdi> · ${facts}</p><p>${esc(t.taglineFa ?? g.summaryFa)}</p>`
        + (t.aboutFa ?? [g.summaryFa]).map((x) => `<p>${esc(x)}</p>`).join('')
        + `<h2>قوانین ${esc(g.nameFa)}</h2>${rules}<p><a href="/games">همه بازی‌ها</a></p>`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'BoardGame', name: g.nameFa, alternateName: g.nameOriginal, url: `${SITE}/games/${g.id}`,
        description: t.taglineFa ?? g.summaryFa, image, inLanguage: 'fa',
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: players[0], maxValue: players[1] }
      }
    };
  }),
  { path: '/wiki', title: 'دانشنامه', description: `دانشنامه بردگیم ${BRAND}: اصطلاحات، سازوکارها و شناسنامه بازی‌های رومیزی به فارسی.`, body: '<h1>دانشنامه</h1>' + gameLinks },
  { path: '/guides', title: 'راهنما', description: `راهنمای ${BRAND}: ساخت میز، حریف‌یابی، بازی زنده و نوبتی، رتبه‌بندی و تورنمنت.`, body: '<h1>راهنما</h1>' },
  { path: '/ranking', title: 'رتبه‌بندی', description: `جدول رتبه‌بندی بازیکنان ${BRAND} در هر بازی.`, body: '<h1>رتبه‌بندی</h1>' },
  { path: '/tournaments', title: 'تورنمنت‌ها', description: `تورنمنت‌های آنلاین بردگیم در ${BRAND}.`, body: '<h1>تورنمنت‌ها</h1>' },
  // Same slugs as SITE_LINKS in src/pages/SitePage.tsx. Admin-written text lives in the database: head tags here, body at runtime.
  ...([['about', 'درباره ما'], ['contact', 'تماس با ما'], ['terms', 'قوانین و مقررات'], ['privacy', 'حریم خصوصی'], ['refund', 'قوانین خرید و بازگشت وجه']] as const)
    .map(([slug, title]): Page => ({ path: `/${slug}`, title, description: `${title} — ${BRAND}، بازی آنلاین بردگیم به فارسی.`, body: `<h1>${title}</h1>` }))
];

// Unknown and private routes fall back to the untouched shell; index.html becomes the home page.
writeFileSync(join(dist, 'spa.html'), shell);
for (const p of pages) {
  const file = p.path === '/' ? join(dist, 'index.html') : join(dist, p.path.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(p));
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);

writeFileSync(join(dist, 'robots.txt'), `User-agent: *
Disallow: /api/
Disallow: /admin
Disallow: /mod
Disallow: /design
Disallow: /dev-gateway
Disallow: /payments/
Disallow: /me/
Disallow: /messages
Disallow: /notifications
Disallow: /settings
Disallow: /tables/
Disallow: /games/*/new
Disallow: /spa.html

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`seo: ${pages.length} pages, sitemap.xml, robots.txt`);
