// Group C (card games): one shared card-table frame, one module per game in ./cards/*.mjs.
// node --experimental-strip-types gc.mjs [names]  -> canvas/project/group-c/<Slug>.dc.html
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { cssFor } from 'file:///E:/AI/Claude/bgv-chess/tools/css.mjs';
import { pbar, clock, fa, esc, ic } from 'file:///E:/AI/Claude/bgv-chess/tools/lib.mjs';
import { chatCol, btn, ibtn } from 'file:///E:/AI/Claude/bgv-chess/tools/parts.mjs';

const OUT = 'E:/AI/Claude/bgv-groupa/canvas/project/group-c';
mkdirSync(OUT, { recursive: true });
const ART = Object.assign({}, ...readdirSync('E:/AI/Claude/bgv-groupa/art').filter((f) => /^blob-map.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`E:/AI/Claude/bgv-groupa/art/${f}`, 'utf8'))));
const img = (name, alt = '', cls = '') => { if (!ART[name]) throw new Error('missing art ' + name); return `<img${cls ? ` class="${cls}"` : ''} src="${ART[name]}" alt="${esc(alt)}">`; };

const ME = { name: 'مینا', av: 'م', rating: 1540, tier: 'gold', tierFa: 'طلا', seat: 1, you: true };

const GC_CSS = `
.gc-opps{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;inline-size:100%;max-inline-size:700px}
.gc-seat{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;column-gap:8px;row-gap:4px;min-inline-size:200px;flex:1 1 200px;max-inline-size:230px;padding:8px 10px;border-radius:var(--radius-md);background:rgba(250,245,236,.07);box-shadow:inset 0 0 0 1px rgba(250,245,236,.14);color:var(--felt-ink)}
.gc-seat.is-turn{box-shadow:inset 0 0 0 2px var(--felt-gold),0 0 0 3px rgba(232,166,66,.18)}
.gc-seat.is-out{opacity:.5}
.gc-seat .bgv-avatar{grid-row:1/3}
.gc-seat__name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-seat__meta{grid-column:2/4;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--felt-muted);min-inline-size:0}
.gc-seat .cx-clock{grid-column:3;grid-row:1;min-inline-size:0;inline-size:auto;block-size:28px;padding-inline:8px;border-radius:8px}
.gc-seat .cx-clock__t{font-size:15px}
.gc-seat .cx-clock__tick{inline-size:6px;block-size:6px}
.gc-backs{display:inline-flex;align-items:center}
.gc-backs img{inline-size:18px;block-size:auto;border-radius:2px;margin-inline-start:-7px;box-shadow:0 1px 2px rgba(0,0,0,.4)}
.gc-backs img:first-child{margin-inline-start:0}
.gc-tag{display:inline-flex;align-items:center;gap:4px;block-size:22px;padding-inline:8px;border-radius:999px;font-size:12px;font-weight:700;background:var(--felt-gold);color:#142B3B}
.gc-tag--soft{background:rgba(250,245,236,.14);color:var(--felt-ink)}
.gc-table{flex:1;min-block-size:0;inline-size:100%;display:flex;align-items:center;justify-content:center;gap:24px;position:relative}
.gc-me{display:grid;gap:6px;inline-size:100%;max-inline-size:700px;justify-items:center}
.gc-me .cx-pbar{inline-size:100%}
.gc-hand{direction:ltr;display:flex;justify-content:center;align-items:flex-end;padding-block-start:14px;min-block-size:calc(var(--cw,88px) * var(--cr,1.4) + 12px)}
.gc-card{position:relative;flex:none;inline-size:var(--cw,88px);margin-inline-start:calc(var(--cw,88px) * -.38);transition:transform .15s}
.gc-card:first-child{margin-inline-start:0}
.gc-card img{display:block;inline-size:100%;block-size:auto;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 8px 14px -8px rgba(0,0,0,.6)}
.gc-card.is-ok{transform:translateY(-10px)}
.gc-card.is-ok img{box-shadow:0 0 0 3px var(--felt-gold),0 10px 16px -8px rgba(0,0,0,.6)}
.gc-card.is-sel{transform:translateY(-22px)}
.gc-card.is-sel img{box-shadow:0 0 0 3px #FAF5EC,0 0 0 6px var(--felt-gold),0 12px 18px -8px rgba(0,0,0,.7)}
.gc-card.is-dim img{filter:saturate(.75) brightness(.86)}
.gc-pile{display:grid;justify-items:center;gap:6px;color:var(--felt-muted);font-size:13px}
.gc-pile img{inline-size:var(--pw,110px);border-radius:7px;box-shadow:0 2px 0 rgba(0,0,0,.3),0 12px 20px -10px rgba(0,0,0,.7)}
.gc-pile b{color:var(--felt-ink);font-size:14px}
.gc-log{display:grid;gap:8px;align-content:start;overflow:hidden;font-size:13.5px;line-height:1.65;color:var(--text)}
.gc-log p{margin:0;display:flex;gap:8px;align-items:flex-start}
.gc-log p i{flex:none;inline-size:10px;block-size:10px;border-radius:50%;margin-block-start:7px}
.gc-log p.is-new{color:var(--heading);font-weight:700}
.ga-rule{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.75;color:var(--text);background:var(--surface-sunken);border-radius:var(--radius-sm);padding:10px 12px}
.ga-rule .bgv-icon{flex:none;margin-block-start:3px;color:var(--link)}
.gc-pills{display:flex;flex-wrap:wrap;gap:8px}
.cx-phone .gc-opps{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;margin-inline:0;padding-inline:12px;scrollbar-width:none;max-inline-size:none;box-sizing:border-box}
/* QA 1405-08-18: 44px minimum touch area on phone for game controls (visual size unchanged) */
.cx-phone button:not(.bgv-btn){position:relative}
.cx-phone button:not(.bgv-btn)::after{content:"";position:absolute;inset-block:min(0px,calc((100% - 44px) / 2));inset-inline:min(0px,calc((100% - 44px) / 2))}
.cx-phone .gc-seat{min-inline-size:150px;flex:none;padding:6px 8px;grid-template-columns:auto minmax(0,1fr)}
.cx-phone .gc-seat .cx-clock{grid-column:2;grid-row:1;justify-self:end}
.cx-phone .gc-seat__meta{grid-column:2}
.cx-phone .gc-table{gap:14px}
.cx-phone .gc-hand{--cw:64px}
.cx-phone .gc-pile img{inline-size:var(--ppw,78px)}
.ga-notes{margin:0;padding:0;list-style:none;display:grid;gap:8px;max-inline-size:1440px}
.ga-notes li{display:flex;gap:10px;font-size:15px;line-height:1.8;color:#3A4F5E}
.ga-notes li b{color:#142B3B}
.ga-head{display:grid;gap:10px;max-inline-size:1440px}
.ga-head h1{margin:0;font-size:40px;font-weight:900;color:#142B3B;display:flex;align-items:baseline;gap:14px}
.ga-head h1 small{font:800 15px var(--font-latin);letter-spacing:.12em;color:#8D581A;text-transform:uppercase}
.ga-doc{display:flex;flex-direction:column;gap:48px;padding:40px;background:#EFEAE2;inline-size:1520px;box-sizing:border-box}
.ga-phones{display:flex;gap:40px;align-items:flex-start}
.cx-felt{justify-content:space-between;padding-block:10px}
.cx-felt,.cx-pfelt{position:relative}
.gd-modal{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(6,14,20,.55);padding:16px;box-sizing:border-box}
.gd-modal__box{display:grid;gap:14px;inline-size:min(560px,100%);max-block-size:100%;overflow:auto;box-sizing:border-box;padding:18px 20px;border-radius:var(--radius-lg,16px);background:var(--surface);color:var(--text);box-shadow:0 24px 48px -16px rgba(0,0,0,.6)}
.gd-modal__box h3{margin:0;font-size:18px;font-weight:800;color:var(--heading)}
.gd-modal__box p{margin:0;font-size:14px;line-height:1.75}
.gd-modal__acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.gd-score{inline-size:100%;border-collapse:collapse;font-size:14px}
.gd-score th,.gd-score td{padding:7px 8px;border-block-end:1px solid var(--border);text-align:start}
.gd-score th{font-size:12.5px;color:var(--text-muted);font-weight:700}
.gd-score tr.is-win td{font-weight:800;color:var(--heading)}
.gd-score td.n,.gd-score th.n{text-align:center}
.gc-me{gap:2px}
`;

const seat = (p, sm) => `<div class="gc-seat${p.turn ? ' is-turn' : ''}${p.out ? ' is-out' : ''}"><span class="bgv-avatar ${sm ? 'bgv-avatar--sm ' : ''}seat-${p.seat}">${p.av}</span><span class="gc-seat__name">${esc(p.name)}</span>${p.clock ? clock(p.clock, p.turn ? 'run' : 'idle', { sm: true, who: p.name }) : ''}<span class="gc-seat__meta">${p.meta ?? ''}</span></div>`;
export const backs = (H, art, n, max = 6) => `<span class="gc-backs" aria-label="${fa(n)} کارت">${Array.from({ length: Math.min(n, max) }, () => img(art)).join('')}</span><b>${fa(n)}</b>`;

function hand(g, isPhone) {
  if (!g.me.cards || !g.me.cards.length) return '';
  const cards = g.me.cards.map((c) => `<span class="gc-card${c.ok ? ' is-ok' : ''}${c.sel ? ' is-sel' : ''}${c.dim ? ' is-dim' : ''}">${c.html ?? img(c.art, c.alt ?? '')}</span>`).join('');
  return `<div class="gc-hand" style="--cr:${g.cardRatio ?? 1.4};${isPhone && g.phoneCardW ? `--cw:${g.phoneCardW}px;` : (!isPhone && g.cardW ? `--cw:${g.cardW}px;` : '')}" aria-label="دست شما">${cards}</div>`;
}

function gamebarG(g, o = {}) {
  return `<header class="bgv-gamebar"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="بازگشت">${ic('back')}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">${g.fa}<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">${esc(g.latin.toUpperCase())}</span></span><span class="bgv-gamebar__meta">${g.meta.map((m, k) => `<span class="bgv-gamebar__mi${k ? '' : ' is-first'}">${m}</span>`).join('')}</span></div>${o.phone ? '' : ibtn('sound', 'صدا')}${ibtn('chat', 'گفت‌وگو', 'secondary')}${ibtn('more', 'گزینه‌های میز')}</header>`;
}

function rail(g) {
  const log = g.log.map(([seatN, t], k) => `<p class="${k === g.log.length - 1 ? 'is-new' : ''}"><i class="seat-${seatN}" style="background:var(--seat-${seatN})"></i><span>${t}</span></p>`).join('');
  const actions = g.actions ?? `<div class="cx-actions" style="grid-template-columns:1fr auto auto">${btn('ترک میز', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات', 'secondary')}</div>`;
  return `<section class="cx-card"><div class="cx-status"><i class="cx-dot-turn"></i><span>${g.status}</span></div></section>${g.railCard ?? ''}<section class="cx-card cx-card--fill" style="grid-template-rows:auto minmax(0,1fr)"><h3>رویدادها<span class="bgv-spacer"></span><span class="cx-note">${g.logNote ?? ''}</span></h3><div class="gc-log">${log}</div></section>${actions}`;
}

function desk(g, theme) {
  const me = { ...ME, clock: g.me.clock ? clock(g.me.clock, g.me.turn ? 'run' : 'idle', { who: 'شما' }) : '', turn: g.me.turn, note: g.me.note ?? '' };
  const felt = `<div class="gc-opps">${g.opps.map((p) => seat(p)).join('')}</div><div class="gc-table">${g.table(false)}</div>${g.overlay ? g.overlay(false) : ''}<div class="gc-me">${g.me.above ? g.me.above(false) : ''}${hand(g, false)}${pbar(me)}</div>`;
  return `<div class="cx-frame bgv" data-theme="${theme}" dir="rtl"><div class="cx-desk">${gamebarG(g)}<aside class="cx-rail" aria-label="وضعیت، رویدادها و دکمه‌ها">${rail(g)}</aside><main class="cx-felt" aria-label="میز ${g.fa}">${felt}</main>${chatCol({ msgs: g.chat ?? [['sys', `بازی شروع شد. ${fa(g.opps.length + 1)} نفر سر میزند`], ['opp', 'سلام، بازی خوبی داشته باشیم'], ['me', 'سلام، همچنین']] })}</div></div>`;
}

function phone(g, theme) {
  const me = { ...ME, clock: g.me.clock ? clock(g.me.clock, g.me.turn ? 'run' : 'idle', { who: 'شما', sm: true }) : '', turn: g.me.turn, note: g.me.note ?? '' };
  const items = g.dockItems ?? [['more', 'گزینه‌ها'], ['chat', 'گفت‌وگو'], ['list', 'رویدادها'], ['flag', 'ترک میز']];
  const dock = `<nav class="cx-pdock" aria-label="دکمه‌های بازی">${items.map(([i, l]) => `<button type="button">${ic(i)}${l}</button>`).join('')}</nav>`;
  return `<div class="cx-phone bgv" data-theme="${theme}" dir="rtl">${gamebarG(g, { phone: true })}<main class="cx-pfelt" aria-label="میز ${g.fa}"><div class="gc-opps">${g.opps.map((p) => seat(p, true)).join('')}</div><div class="gc-table">${g.table(true)}</div>${g.overlay ? g.overlay(true) : ''}<div class="cx-pstat">${ic('info')}<span>${g.pstatus ?? g.status}</span></div>${g.me.above ? g.me.above(true) : ''}${hand(g, true)}${pbar(me, { sm: true })}</main>${dock}</div>`;
}

function artboard(g) {
  const notes = g.diffs.map(([a, b]) => `<li>${ic('info')}<span><b>${a}:</b> ${b}</span></li>`).join('');
  return `<div class="ga-doc">
<header class="ga-head"><h1>${g.fa}<small>${esc(g.latin)}</small></h1><ul class="ga-notes">${notes}</ul></header>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۱</span>${g.shotTitle ?? 'نوبت شما'}<small>${g.turnSub ?? ''}</small></h2></header>${desk(g, 'light')}</section>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۲</span>حالت تیره</h2></header>${desk(g, 'dark')}</section>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۳</span>گوشی ۳۹۰، روشن و تیره</h2></header><div class="ga-phones">${phone(g, 'light')}${phone(g, 'dark')}</div></section>
${(g.phases ?? []).map((p, i) => { const gp = { ...g, ...p, me: { ...g.me, ...(p.me ?? {}) } }; return `<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§${fa(4 + i)}</span>${gp.shotTitle}<small>${gp.turnSub ?? ''}</small></h2></header>${p.phoneOnly ? '' : desk(gp, p.theme ?? 'light')}${p.phone ? `<div class="ga-phones" style="margin-block-start:${p.phoneOnly ? 0 : 48}px">${phone(gp, 'light')}${p.phone === 'both' ? phone(gp, 'dark') : ''}</div>` : ''}</section>`; }).join('')}
</div>`;
}

const dcFile = ({ title, w, h, css, body }) => `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../ds/bgv/tokens.css">
<link rel="stylesheet" href="../ds/bgv/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<style>
${css}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;

const modal = (title, body, acts = '') => `<div class="gd-modal" role="dialog" aria-label="${esc(title)}"><div class="gd-modal__box"><h3>${title}</h3>${body}${acts ? `<div class="gd-modal__acts">${acts}</div>` : ''}</div></div>`;
const H = { img, fa, ic, esc, ART, clock, btn, ibtn, modal, backs: (art, n, max) => backs(H, art, n, max) };
const ORDER_B = ['ludo', 'snakes-ladders', 'amlak', 'risk', 'camel-up', 'yahtzee', 'battleship'];
const ORDER = [...ORDER_B, 'uno', 'coup', 'love-letter', 'skull', 'cockroach-poker', 'the-mind', 'six-nimmt', 'no-thanks', 'lost-cities', 'hanabi', 'the-crew', 'crew-deep-sea', 'high-society', 'for-sale', 'sealed-bids', 'sushi-go', 'point-salad', 'jaipur', 'sea-salt-paper', 'scout', 'bohnanza', 'set'];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const have = readdirSync(new URL('./cards/', import.meta.url));
const CSS0 = cssFor(true) + GC_CSS;
const manifest = [];
for (const name of ORDER) {
  if (!have.includes(`${name}.mjs`) || (only && !only.includes(name))) continue;
  const g = (await import(`./cards/${name}.mjs`)).default(H);
  let h = 40 + 110 + g.diffs.length * 34 + 48 + 2 * (900 + 64 + 48) + 844 + 64 + 40 + 40;
  for (const p of g.phases ?? []) h += (p.phoneOnly ? 64 + 48 : 900 + 64 + 48) + (p.phone ? (p.phoneOnly ? 844 : 844 + 48) : 0);
  h += g.extraH ?? 0;
  const grp = ORDER_B.includes(name) ? 'group-b' : 'group-c';
  mkdirSync(`E:/AI/Claude/bgv-groupa/canvas/project/${grp}`, { recursive: true });
  writeFileSync(`E:/AI/Claude/bgv-groupa/canvas/project/${grp}/${g.slug}.dc.html`, dcFile({ title: `${g.fa}، میز بازی`, w: 1520, h, css: CSS0 + (g.css ?? ''), body: artboard(g) }));
  manifest.push({ key: `${grp}/${g.slug}.dc.html`, title: `${g.fa}: میز، تیره و گوشی`, w: 1520, h });
}
console.log('wrote', manifest.map((m) => m.key).join(', '));
