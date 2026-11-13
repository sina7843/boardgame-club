// Group A (2-player board games) on the chess table frame. One artboard per game: desktop light + dark, phone light + dark.
// node ga.mjs  -> E:/AI/Claude/bgv-groupa/canvas/project/group-a/*.dc.html (+ local previews with file:// art)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { cssFor } from 'file:///E:/AI/Claude/bgv-chess/tools/css.mjs';
import { pbar, clock, fa, esc, ic, aic, moveList, navBtns } from 'file:///E:/AI/Claude/bgv-chess/tools/lib.mjs';
import { chatCol, btn, ibtn } from 'file:///E:/AI/Claude/bgv-chess/tools/parts.mjs';
import { CK, OT, playout } from './engines.mjs';

const OUT = 'E:/AI/Claude/bgv-groupa/canvas/project/group-a';
import { readdirSync as _rd } from 'node:fs';
const ART = Object.assign({}, ..._rd('E:/AI/Claude/bgv-groupa/art').filter((f) => /^blob-map.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`E:/AI/Claude/bgv-groupa/art/${f}`, 'utf8')))); // name -> /_blob/id (all blob-map*.json)
mkdirSync(OUT, { recursive: true });

const ME = { name: 'مینا', av: 'م', rating: 1540, tier: 'gold', tierFa: 'طلا', seat: 1, you: true };
const OPP = { name: 'نیلوفر', av: 'ن', rating: 1585, tier: 'diamond', tierFa: 'الماس', seat: 2 };

const GA_CSS = `
.ga-board{position:relative;align-self:center;inline-size:var(--b,572px);block-size:var(--b,572px);background:var(--img) center/100% 100% no-repeat;border-radius:6px;box-shadow:0 4px 0 rgba(0,0,0,.28),0 18px 30px -18px rgba(0,0,0,.6);flex:none}
.ga-grid{position:absolute;inset:var(--inset);direction:ltr;display:grid;grid-template-columns:repeat(var(--n),1fr);grid-template-rows:repeat(var(--n),1fr)}
.ga-cell{position:relative;display:grid;place-items:center;min-inline-size:0;min-block-size:0}
.ga-cell>img{position:relative;z-index:1;inline-size:var(--pc,84%);block-size:var(--pc,84%);object-fit:contain;filter:drop-shadow(0 2px 1px rgba(0,0,0,.35))}
.ga-cell.is-last::before,.ga-cell.is-sel::before,.ga-cell.is-path::before{content:"";position:absolute;inset:0}
.ga-cell.is-last::before{background:rgba(232,166,66,.40)}
.ga-cell.is-path::before{background:rgba(232,166,66,.22)}
.ga-cell.is-sel::before{background:rgba(232,166,66,.55);box-shadow:inset 0 0 0 3px #E8A642}
.ga-cell.is-dot::after{content:"";position:absolute;z-index:2;inline-size:30%;block-size:30%;border-radius:50%;background:var(--dot,rgba(250,245,236,.62));box-shadow:0 0 0 2px rgba(0,0,0,.18)}
.ga-cell.is-ghost::after{content:"";position:absolute;z-index:2;inline-size:70%;block-size:70%;border-radius:50%;border:3px dashed var(--dot,rgba(250,245,236,.75))}
.ga-cell.is-cap>img{outline:3px solid #F0AAA3;outline-offset:-2px;border-radius:50%}
.ga-cell.is-flip>img{opacity:.55}
.ga-coords{position:absolute;inset:0;pointer-events:none;font:700 11px/1 var(--font-latin);color:rgba(250,245,236,.8)}
.ga-coords span{position:absolute}
.ga-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px}
.ga-score__p{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--text)}
.ga-score__p:last-child{flex-direction:row-reverse}
.ga-score__p img{inline-size:30px;block-size:30px}
.ga-score__n{font-size:30px;font-weight:900;color:var(--heading);font-variant-numeric:normal}
.ga-score__vs{font-size:14px;color:var(--text-muted)}
.ga-rule{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.75;color:var(--text);background:var(--surface-sunken);border-radius:var(--radius-sm);padding:10px 12px}
.ga-rule .bgv-icon{flex:none;margin-block-start:3px;color:var(--link)}
.ga-mini{display:inline-flex;align-items:center;gap:2px}
.ga-mini img{inline-size:16px;block-size:16px;margin-inline-end:-6px}
.cx-felt .cx-pbar{inline-size:var(--b,572px)}
.ga-mini b{margin-inline-start:10px;font-size:13px;color:var(--text-muted)}
.ga-mlhead{display:grid;grid-template-columns:34px 1fr 1fr;font-size:12.5px;color:var(--text-muted);padding-inline:6px}
/* QA 1405-08-18: 44px minimum touch area on phone for game controls (visual size unchanged) */
.cx-phone button:not(.bgv-btn){position:relative}
.cx-phone button:not(.bgv-btn)::after{content:"";position:absolute;inset-block:min(0px,calc((100% - 44px) / 2));inset-inline:min(0px,calc((100% - 44px) / 2))}
.cx-phone .ga-board{--b:366px}
.cx-felt,.cx-pfelt{position:relative}
.gd-modal{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(6,14,20,.55);padding:16px;box-sizing:border-box}
.gd-modal__box{display:grid;gap:14px;inline-size:min(560px,100%);max-block-size:100%;overflow:auto;box-sizing:border-box;padding:18px 20px;border-radius:var(--radius-lg,16px);background:var(--surface);color:var(--text);box-shadow:0 24px 48px -16px rgba(0,0,0,.6)}
.gd-modal__box h3{margin:0;font-size:18px;font-weight:800;color:var(--heading)}
.gd-modal__box p{margin:0;font-size:14px;line-height:1.75}
.gd-modal__acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.gd-score{inline-size:100%;border-collapse:collapse;font-size:14px}.gd-score th,.gd-score td{padding:7px 8px;border-block-end:1px solid var(--border);text-align:start}.gd-score th{font-size:12.5px;color:var(--text-muted);font-weight:700}.gd-score tr.is-win td{font-weight:800;color:var(--heading)}.gd-score td.n,.gd-score th.n{text-align:center}
.ga-notes{margin:0;padding:0 0 0 0;list-style:none;display:grid;gap:8px;max-inline-size:1440px}
.ga-notes li{display:flex;gap:10px;font-size:15px;line-height:1.8;color:#3A4F5E}
.ga-notes li b{color:#142B3B}
.ga-head{display:grid;gap:10px;max-inline-size:1440px}
.ga-head h1{margin:0;font-size:40px;font-weight:900;color:#142B3B;display:flex;align-items:baseline;gap:14px}
.ga-head h1 small{font:800 15px var(--font-latin);letter-spacing:.12em;color:#8D581A;text-transform:uppercase}
.ga-doc{display:flex;flex-direction:column;gap:48px;padding:40px;background:#EFEAE2;inline-size:1520px;box-sizing:border-box}
.ga-phones{display:flex;gap:40px;align-items:flex-start}
`;

const img = (name, alt = '') => `<img src="${ART[name]}" alt="${esc(alt)}">`;

function boardHtml(g, s, o = {}) {
  const cells = [];
  for (let r = 0; r < g.n; r++) for (let c = 0; c < g.n; c++) {
    const i = r * g.n + c; const cls = ['ga-cell'];
    if (o.last?.includes(i)) cls.push('is-last');
    if (o.path?.includes(i)) cls.push('is-path');
    if (o.sel === i) cls.push('is-sel');
    if (o.dots?.includes(i)) cls.push('is-dot');
    if (o.caps?.includes(i)) cls.push('is-cap');
    if (o.flip?.includes(i)) cls.push('is-flip');
    const p = s.b[i];
    cells.push(`<span class="${cls.join(' ')}">${p ? img(g.piece(p), g.pieceAlt(p)) : ''}</span>`);
  }
  return `<div class="ga-board" style="--img:url(${ART[g.board]});--inset:${g.inset};--n:${g.n};${g.pcSize ? `--pc:${g.pcSize};` : ''}${o.b ? `--b:${o.b}px;` : ''}" role="grid" aria-label="${esc(g.fa)}"><div class="ga-grid">${cells.join('')}</div></div>`;
}

function gamebarG(g, o = {}) {
  return `<header class="bgv-gamebar"><button class="bgv-btn bgv-btn--icon bgv-btn--ghost" type="button" aria-label="بازگشت">${ic('back')}</button><div class="bgv-gamebar__title"><span class="bgv-gamebar__name">${g.fa}<span class="bgv-latin" dir="ltr" style="font-size:12.5px;font-weight:600;color:var(--text-muted)">${g.latin.toUpperCase()}</span></span><span class="bgv-gamebar__meta">${(o.meta ?? g.meta).map((m, k) => `<span class="bgv-gamebar__mi${k ? '' : ' is-first'}">${m}</span>`).join('')}</span></div>${o.phone ? '' : `${ibtn('sound', 'صدا')}`}${ibtn('chat', 'گفت‌وگو', 'secondary')}${ibtn('more', 'گزینه‌های میز')}</header>`;
}

function players(g, st, o = {}) {
  const top = { ...OPP, clock: clock(st.clocks.opp, st.turnMe ? 'idle' : 'run', { who: OPP.name, sm: o.sm }), turn: !st.turnMe, note: g.note(st, 'opp') };
  const bot = { ...ME, clock: clock(st.clocks.me, st.turnMe ? 'run' : 'idle', { who: 'شما', sm: o.sm }), turn: st.turnMe, note: g.note(st, 'me') };
  return { top, bot };
}

function rail(g, st) {
  const hist = st.hist;
  return `<section class="cx-card"><div class="cx-status"><i class="cx-dot-turn"></i><span>${st.status}</span></div></section>
${g.railCard(st)}
<section class="cx-card cx-card--fill"><h3>حرکت‌ها<span class="bgv-spacer"></span><span class="cx-note">${g.notation}</span></h3><div class="ga-mlhead"><span>#</span><span>${g.sideFa[0]}</span><span>${g.sideFa[1]}</span></div>${moveList(hist, { from: Math.max(0, hist.length - 14 - (hist.length % 2)) })}${navBtns()}</section>
${g.actions ?? `<div class="cx-actions"${g.noDraw ? ' style="grid-template-columns:1fr auto auto"' : ''}>${g.noDraw ? '' : btn('مساوی', 'secondary', 'hand')}${btn('تسلیم', 'leave', 'flag')}${ibtn('list', 'قوانین بازی', 'secondary')}${ibtn('settings', 'تنظیمات صفحه', 'secondary')}</div>`}`;
}

function desk(g, st, theme) {
  const P = players(g, st);
  const felt = `${pbar(P.top)}${(g.boardHtml ?? boardHtml)(g, st.s, st.bo, H)}${g.feltExtra ? g.feltExtra(st, false) : ''}${pbar(P.bot)}${g.overlay ? g.overlay(false, st) : ''}`;
  return `<div class="cx-frame bgv" data-theme="${theme}" dir="rtl"><div class="cx-desk">${gamebarG(g)}<aside class="cx-rail" aria-label="وضعیت، حرکت‌ها و دکمه‌ها">${rail(g, st)}</aside><main class="cx-felt" aria-label="میز ${g.fa}">${felt}</main>${chatCol({ msgs: [['sys', `بازی شروع شد. <b>مینا</b> ${g.sideFa[1]} است، <b>نیلوفر</b> ${g.sideFa[0]}`], ['opp', 'سلام، بازی خوبی داشته باشیم'], ['me', 'سلام، همچنین']] })}</div></div>`;
}

function phone(g, st, theme) {
  const P = players(g, st, { sm: true });
  const strip = `<div class="cx-ms" dir="ltr" aria-label="حرکت‌ها">${st.hist.slice((st.hist.slice(-6).reduce((a, h) => a + h.san.length, 0) / 6) > 7 ? -5 : -10).map((h, k, a) => `<span class="cx-ms__m${k === a.length - 1 ? ' is-cur' : ''}" dir="ltr">${h.san}</span>`).join('')}</div>`;
  const items = g.dockItems ?? [['more', 'گزینه‌ها'], ...(g.noDraw ? [] : [['hand', 'مساوی']]), ['flag', 'تسلیم'], ['list', 'قوانین']];
  const dock = `<nav class="cx-pdock" aria-label="دکمه‌های بازی">${items.map(([i, l]) => `<button type="button">${ic(i)}${l}</button>`).join('')}</nav>`;
  return `<div class="cx-phone bgv" data-theme="${theme}" dir="rtl">${gamebarG(g, { phone: true })}<main class="cx-pfelt" aria-label="میز ${g.fa}">${pbar(P.top, { sm: true })}${(g.boardHtml ?? boardHtml)(g, st.s, { ...st.bo, b: 366 }, H)}${g.feltExtra ? g.feltExtra(st, true) : ''}${pbar(P.bot, { sm: true })}<div class="cx-pstat">${ic('info')}<span>${st.pstatus ?? st.status}</span></div>${strip}${g.overlay ? g.overlay(true, st) : ''}</main>${dock}</div>`;
}

function artboard(g, st) {
  const notes = g.diffs.map(([a, b]) => `<li>${ic('info')}<span><b>${a}:</b> ${b}</span></li>`).join('');
  return `<div class="ga-doc">
<header class="ga-head"><h1>${g.fa}<small>${g.latin}</small></h1><ul class="ga-notes">${notes}</ul></header>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۱</span>نوبت شما<small>${g.turnSub}</small></h2></header>${desk(g, st, 'light')}</section>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۲</span>حالت تیره</h2></header>${desk(g, st, 'dark')}</section>
<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§۳</span>گوشی ۳۹۰، روشن و تیره</h2></header><div class="ga-phones">${phone(g, st, 'light')}${phone(g, st, 'dark')}</div></section>
${(g.phases ?? []).map((p, i) => { const gp = { ...g, ...p }; const sp = p.st ?? st; return `<section class="cx-shot"><header class="cx-cap"><h2><span class="cx-tag">§${fa(4 + i)}</span>${p.shotTitle}<small>${p.turnSub ?? ''}</small></h2></header>${p.phoneOnly ? '' : desk(gp, sp, p.theme ?? 'light')}${p.phone ? `<div class="ga-phones" style="margin-block-start:${p.phoneOnly ? 0 : 48}px">${phone(gp, sp, 'light')}${p.phone === 'both' ? phone(gp, sp, 'dark') : ''}</div>` : ''}</section>`; }).join('')}
</div>`;
}

function dcFile({ title, w, h, css, body }) {
  return `<!doctype html>
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
}

// ---------------- games (one module per game in ./games) ----------------
import { readdirSync } from 'node:fs';
const modal = (title, body, acts = '') => `<div class="gd-modal" role="dialog" aria-label="${esc(title)}"><div class="gd-modal__box"><h3>${title}</h3>${body}${acts ? `<div class="gd-modal__acts">${acts}</div>` : ''}</div></div>`;
const H = { img, fa, ic, esc, ART, CK, OT, playout, boardHtml, clock, btn, ibtn, modal };
const ORDER = ['checkers', 'othello', 'go', 'line-three', 'tak', 'quoridor', 'onitama', 'abalone', 'hive', 'santorini', 'backgammon'];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const GAMES = [];
for (const name of ORDER) {
  if (!readdirSync(new URL('./games/', import.meta.url)).includes(`${name}.mjs`)) continue;
  if (only && !only.includes(name)) continue;
  GAMES.push((await import(`./games/${name}.mjs`)).default(H));
}

// ---------------- write ----------------
const CSS0 = cssFor(true) + GA_CSS;
const manifest = [];
for (const g of GAMES) {
  const body = artboard(g, g.st);
  const CSS = CSS0 + (g.css ?? '');
  let h = 40 + 110 + g.diffs.length * 34 + 48 + 2 * (900 + 64 + 48) + 844 + 64 + 40 + 40;
  for (const p of g.phases ?? []) h += (p.phoneOnly ? 64 + 48 : 900 + 64 + 48) + (p.phone ? (p.phoneOnly ? 844 : 844 + 48) : 0);
  writeFileSync(`${OUT}/${g.slug}.dc.html`, dcFile({ title: `${g.fa}، میز بازی`, w: 1520, h, css: CSS, body }));
  manifest.push({ key: `group-a/${g.slug}.dc.html`, title: `${g.fa}: میز، تیره و گوشی`, w: 1520, h });
}
writeFileSync(`E:/AI/Claude/bgv-groupa/canvas/manifest${only ? '-' + only.join('_') : ''}.json`, JSON.stringify(manifest, null, 1));
console.log('wrote', manifest.map((m) => m.key).join(', '));
