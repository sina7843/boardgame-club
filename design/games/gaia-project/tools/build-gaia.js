// Builds the FA and EN Gaia desktop artboards from one template.
// Template syntax: [[فارسی||English]] picks a side; [[#123]] is a number (Persian digits in FA);
// [[@dir]] / [[@lang]]; [[@hexgrid]] sector outlines; [[@research]] [[@scoring]] [[@faction]] board overlays.
// All board positions are measured on the ready-to-use images (see games/gaia-project/HANDOFF.md).
const fs = require('fs');
const path = require('path');
const [tpl, outDir] = process.argv.slice(2);
const src = fs.readFileSync(tpl, 'utf8');

const faDigits = (s) => String(s).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const pct = (v, total) => +(v / total * 100).toFixed(2) + '%';
const A = 'src="../assets/games/gaia/';

// --- Map: outline of each 19-hex sector (sector art already draws the inner lines) ---
const sectors = [[240, 140], [840, 70], [1440, 0], [0, 700], [600, 630], [1200, 560], [1800, 490], [360, 1190], [960, 1120], [1560, 1050]];
const cols = [[210, 350, 490], [140, 280, 420, 560], [70, 210, 350, 490, 630], [140, 280, 420, 560], [210, 350, 490]];
let outline = '';
for (const [sx, sy] of sectors) {
  const edges = new Map();
  cols.forEach((ys, c) => {
    const x = sx + 80 + 120 * c;
    for (const y0 of ys) {
      const y = sy + y0;
      const p = [[x - 80, y], [x - 40, y - 70], [x + 40, y - 70], [x + 80, y], [x + 40, y + 70], [x - 40, y + 70]];
      for (let i = 0; i < 6; i++) {
        const a = p[i], b = p[(i + 1) % 6];
        const key = [a, b].map((q) => q.join(',')).sort().join('|');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  });
  for (const [key, n] of edges) if (n === 1) { const [a, b] = key.split('|'); outline += `M${a.replace(',', ' ')}L${b.replace(',', ' ')}`; }
}

// --- Research board (1838 x 1972) ---
const RW = 1838, RH = 1972;
const at = (cls, file, x, y, alt, extra = '') => `   <img class="gp-at ${cls}" ${A}${file}.webp" alt="${alt}" style="left:${pct(x, RW)};top:${pct(y, RH)}${extra}">\n`;
const adv = [['advore', '[[فناوری پیشرفته: اقدام ۳ سنگ معدن||Advanced tech: action, 3 ore]]'], ['advfedv', '[[فناوری پیشرفته: فوری ۵ امتیاز برای هر فدراسیون||Advanced tech: 5 VP per federation now]]'], ['advqic', '[[فناوری پیشرفته: اقدام ۱ QIC و ۵ اعتبار||Advanced tech: action, 1 QIC and 5 credits]]'], ['advlab', '[[فناوری پیشرفته: هنگام پاس ۳ امتیاز برای هر آزمایشگاه||Advanced tech: pass, 3 VP per lab]]'], ['advtrsb', '[[فناوری پیشرفته: هر ایستگاه تجاری ۳ امتیاز||Advanced tech: 3 VP per trading station]]'], ['advstp', '[[فناوری پیشرفته: هر پیشرفت پژوهش ۲ امتیاز||Advanced tech: 2 VP per research step]]']];
const std = [['tecore', '[[درآمد ۱ سنگ معدن و ۱ شارژ قدرت||Income: 1 ore, 1 power charge]]'], ['tecqic', '[[فوری ۱ سنگ معدن و ۱ QIC||Now: 1 ore and 1 QIC]]'], ['tecknw', '[[درآمد ۱ دانش و ۱ اعتبار||Income: 1 knowledge, 1 credit]]'], ['tecgai', '[[هر معدن روی سیارهٔ گایا ۳ امتیاز||3 VP per mine on a Gaia planet]]'], ['tecpow', '[[اقدام ۴ شارژ قدرت||Action: charge 4 power]]'], ['tectyp', '[[فوری ۱ دانش برای هر نوع سیاره||Now: 1 knowledge per planet type]]']];
const stdBottom = [['teccre', '[[درآمد ۴ اعتبار||Income: 4 credits]]'], ['tecpia', '[[ارزش قدرت مؤسسه و آکادمی‌ها ۴||PI and academies have power value 4]]'], ['tecvps', '[[فوری ۷ امتیاز||Now: 7 VP]]']];
let research = '';
adv.forEach(([f, alt], t) => { research += at('gp-adv', f, 185 + 300 * t, 245, alt); });
std.forEach(([f, alt], t) => { research += at('gp-tech', f, 160 + 298 * t, 1288, alt); });
stdBottom.forEach(([f, alt], i) => { research += at('gp-tech', f, 280 + 585 * i, 1565, alt); });
// player markers sit in the top-left of each level cell, clear of the level rewards
// player markers cluster at the left of each level cell (BGA layout): 1 centred, 2 side by side, 3 as a triangle, 4 as 2x2
const rowMid = [1040, 900, 765, 542, 395, 75];
const players = [['red', '[[مینا||Mina]]', [1, 1, 0, 0, 2, 1]], ['yellow', '[[نیلوفر||Niloufar]]', [0, 2, 2, 1, 1, 2]], ['brown', '[[آرش||Arash]]', [1, 1, 0, 0, 1, 1]], ['orange', '[[سارا||Sara]]', [2, 0, 0, 1, 2, 0]]];
const cluster = { 1: [[0, 0]], 2: [[-0.5, 0], [0.5, 0]], 3: [[-0.5, -0.45], [0.5, -0.45], [0, 0.45]], 4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] };
for (let t = 0; t < 6; t++) for (let l = 0; l < 6; l++) {
  const here = players.filter((p) => p[2][t] === l);
  here.forEach(([c, name], k) => {
    const [dx, dy] = cluster[here.length][k];
    research += `   <img class="gp-at gp-tok" ${A}sat-${c}.webp" alt="${name}" title="${name}" style="left:${pct(15 + 298 * t + 80 + dx * 60, RW)};top:${pct(rowMid[l] + dy * 52, RH)}">
`;
  });
}
const pw = [['[[۷ قدرت: ۳ دانش||7 power: 3 knowledge]]'], ['[[۵ قدرت: ۲ گام زمین‌سازی و ساخت معدن||5 power: 2 terraforming steps and a mine]]'], ['[[۴ قدرت: ۲ سنگ معدن||4 power: 2 ore]]', 1], ['[[۴ قدرت: ۷ اعتبار||4 power: 7 credits]]', 1], ['[[۴ قدرت: ۲ دانش||4 power: 2 knowledge]]'], ['[[۳ قدرت: ۱ گام زمین‌سازی و ساخت معدن||3 power: 1 terraforming step and a mine]]'], ['[[۳ قدرت: ۲ ژتون قدرت||3 power: 2 power tokens]]']];
pw.forEach(([label, used], i) => {
  const x = 115 + 161 * i, y = 1870;
  research += `   <button class="gp-act" type="button"${used ? ' disabled=""' : ''}${i === 0 ? ' aria-describedby="gp-tip-pw1"' : ''} aria-label="[[اقدام قدرت||Power action]]: ${label}${used ? '[[، استفاده شده||, used]]' : ''}" style="left:${pct(x, RW)};top:${pct(y, RH)}"></button>\n`;
  if (used) research += at('gp-token', 'actiontoken', x, y, '');
});
const qic = [['[[۴ QIC: یک کاشی فناوری||4 QIC: a tech tile]]'], ['[[۳ QIC: پاداش دوبارهٔ یک فدراسیون||3 QIC: re-score a federation]]', 1], ['[[۲ QIC: ۳ امتیاز + ۱ برای هر نوع سیاره||2 QIC: 3 VP + 1 per planet type]]']];
qic.forEach(([label, used], i) => {
  const x = [1260, 1475, 1695][i], y = 1858;
  research += `   <button class="gp-act gp-act--q" type="button"${used ? ' disabled=""' : ''} aria-label="[[اقدام QIC||QIC action]]: ${label}${used ? '[[، استفاده شده||, used]]' : ''}" style="left:${pct(x, RW)};top:${pct(y, RH)}"></button>\n`;
  if (used) research += at('gp-token gp-token--q', 'actiontoken', x, y, '');
});

// --- Scoring board (1737 x 1718, flat digital, planet ring printed on it) ---
const SW = 1737, SH = 1718;
const rounds = [['rndter', '[[دور ۱: هر گام زمین‌سازی ۲ امتیاز||Round 1: 2 VP per terraforming step]]'], ['rndstp', '[[دور ۲: هر پیشرفت پژوهش ۲ امتیاز||Round 2: 2 VP per research step]]'], ['rndmin', '[[دور ۳: هر معدن ۲ امتیاز||Round 3: 2 VP per mine]]'], ['rndtrs3', '[[دور ۴: هر ایستگاه تجاری ۳ امتیاز||Round 4: 3 VP per trading station]]'], ['rndfed', '[[دور ۵: هر فدراسیون ۵ امتیاز||Round 5: 5 VP per federation]]'], ['rndpia', '[[دور ۶: مؤسسه یا آکادمی ۵ امتیاز||Round 6: 5 VP per PI or academy]]']];
const played = 3; // rounds 1..3 are over: their tiles are flipped (no "current round" marker)
let scoring = `   <div class="gp-board" dir="ltr" role="group" aria-label="[[صفحهٔ امتیاز||Scoring board]]">
    <img class="gp-base" ${A}scoring-board.webp" alt="[[صفحهٔ امتیاز با چرخهٔ سیاره‌ها||Scoring board with the planet cycle]]" width="1737" height="1718">
`;
rounds.forEach(([f, alt], i) => {
  const deg = 165 - 30 * i, r = deg * Math.PI / 180;
  const pos = `left:${pct(863 + 410 * Math.cos(r), SW)};top:${pct(834 - 410 * Math.sin(r), SH)};--a:${90 - deg}deg`;
  scoring += i < played
    ? `    <img class="gp-rnd" ${A}rnd-back.webp" alt="[[دور ${'۱۲۳۴۵۶'[i]}، انجام شد||Round ${i + 1}, done]]" style="${pos}">
`
    : `    <img class="gp-rnd" ${A}${f}.webp" alt="${alt}" style="${pos}">
`;
});
scoring += `    <img class="gp-at gp-fin" ${A}finbld.webp" alt="[[امتیاز پایانی: بیشترین سازه روی نقشه||Final scoring: most structures on the map]]" style="left:${pct(1209, SW)};top:${pct(955, SH)}">
`;
scoring += `    <img class="gp-at gp-fin" ${A}finsec.webp" alt="[[امتیاز پایانی: حضور در بیشترین بخش||Final scoring: most sectors]]" style="left:${pct(1209, SW)};top:${pct(1273, SH)}">
`;
const fin = [[7, 5, 4, 5], [4, 3, 2, 3]]; // per final row: [niloufar, mina, arash, sara]
const finP = [['yellow', '[[نیلوفر||Niloufar]]'], ['red', '[[مینا||Mina]]'], ['brown', '[[آرش||Arash]]'], ['orange', '[[سارا||Sara]]']];
fin.forEach((vals, row) => vals.forEach((v, i) => {
  scoring += `    <img class="gp-at gp-tok gp-tok--fin" ${A}sat-${finP[i][0]}.webp" alt="${finP[i][1]} ${v}" title="${finP[i][1]} ${v}" style="left:${pct(342 + 61.6 * v, SW)};top:${pct((row ? 1190 : 878) + 52 * i, SH)}">
`;
}));
// how many planets of each type every player has, as a counter on that planet
const planetsAt = { blue: [867, 133], white: [289, 400], red: [1444, 400], grey: [122, 1044], orange: [1589, 1033], brown: [556, 1551], yellow: [1178, 1551], gaia: [863, 790] };
const counts = [['red', 'red', 2, '[[مینا||Mina]]'], ['yellow', 'yellow', 3, '[[نیلوفر||Niloufar]]'], ['brown', 'brown', 2, '[[آرش||Arash]]'], ['orange', 'orange', 2, '[[سارا||Sara]]']];
for (const [planet, c, n, name] of counts) {
  const [x, y] = planetsAt[planet];
  scoring += `    <span class="gp-cnt" style="left:${pct(x, SW)};top:${pct(y, SH)}" title="${name}: [[#${n}]]"><img ${A}sat-${c}.webp" alt=""><b>[[#${n}]]</b></span>
`;
}
scoring += '   </div>\n';
const feds = [['fedvps', '[[۱۲ امتیاز||12 VP]]', 2], ['fedqic', '[[۸ امتیاز و ۱ QIC||8 VP and 1 QIC]]', 3], ['fedpwt', '[[۸ امتیاز و ۲ ژتون قدرت||8 VP and 2 power tokens]]', 3], ['fedore', '[[۷ امتیاز و ۲ سنگ معدن||7 VP and 2 ore]]', 2], ['fedcre', '[[۷ امتیاز و ۶ اعتبار||7 VP and 6 credits]]', 2], ['fedknw', '[[۶ امتیاز و ۲ دانش||6 VP and 2 knowledge]]', 0]];
let fedsupply = '  <div class="gp-fed" role="group" aria-label="[[توکن‌های فدراسیون باقی‌مانده||Federation tokens left]]"><b>[[توکن‌های فدراسیون||Federation tokens]]</b><div class="gp-fed__grid">\n';
for (const [f, alt, n] of feds) fedsupply += `    <span class="gp-fed__t${n ? '' : ' is-out'}" title="${alt}"><img ${A}${f}.webp" alt="${alt}">×[[#${n}]]</span>
`;
fedsupply += '  </div></div>\n';

// --- Faction board (1753 x 999, flat; no top resource strip): remaining buildings, power tokens, conversions, owned tiles ---
const FW = 1753, FH = 999;
const fat = (cls, file, x, y, alt) => `  <img class="gp-at ${cls}" ${A}${file}.webp" alt="${alt}" title="${alt}" style="left:${pct(x, FW)};top:${pct(y, FH)}">\n`;
let faction = ' <div class="gp-fwrap" dir="ltr">\n <div class="gp-board gp-board--fac" dir="ltr" role="tabpanel" aria-label="[[صفحهٔ جناح هادش هالا: ساختمان‌های باقی‌مانده و قدرت||Hadsch Hallas board: buildings left and power]]">\n';
faction += `  <img class="gp-base" ${A}faction-hadsch-hallas.webp" alt="[[صفحهٔ جناح هادش هالا||Hadsch Hallas faction board]]" width="1753" height="999">\n`;
faction += fat('gp-bld gp-bld--pi', 'pi-red', 300, 487, '[[مؤسسهٔ سیاره‌ای||Planetary institute]]');
[922, 1113].forEach((x) => { faction += fat('gp-bld gp-bld--ac', 'ac-red', x, 483, '[[آکادمی||Academy]]'); });
[892, 1017, 1150].forEach((x) => { faction += fat('gp-bld', 'rl-red', x, 705, '[[آزمایشگاه پژوهشی||Research lab]]'); });
[345, 433, 522].forEach((x) => { faction += fat('gp-bld', 'ts-red', x, 708, '[[ایستگاه تجاری||Trading station]]'); });
[612, 700, 792, 883].forEach((x) => { faction += fat('gp-bld', 'mi-red', x, 912, '[[معدن||Mine]]'); });
// power tokens: the real power-token piece (tokens-markers/power-token-physical), scattered in the bowls (bowl I: 4, bowl II: 2)
const coins = [[420, 223], [520, 218], [470, 273], [565, 283], [430, 63], [520, 93]];
coins.forEach(([x, y], i) => { faction += fat('gp-ptok', 'power-token', x, y, i < 4 ? '[[ژتون قدرت، کاسهٔ I||Power token, bowl I]]' : '[[ژتون قدرت، کاسهٔ II||Power token, bowl II]]'); });
const conv = [['[[۴ قدرت ← ۱ QIC||4 power → 1 QIC]]', 47.35], ['[[۳ قدرت ← ۱ سنگ معدن||3 power → 1 ore]]', 56.36], ['[[۴ قدرت ← ۱ دانش||4 power → 1 knowledge]]', 63.86], ['[[۱ قدرت ← ۱ اعتبار||1 power → 1 credit]]', 72.87], ['[[۱ دانش ← ۱ اعتبار||1 knowledge → 1 credit]]', 78.88], ['[[۱ سنگ معدن ← ۱ ژتون قدرت||1 ore → 1 power token]]', 87.89]];
conv.forEach(([label, top], i) => { faction += `  <button class="gp-conv" type="button" aria-label="${label}" style="left:88.14%;top:${top}%"></button>\n`; });
faction += ' </div>\n';
// booster stands beside the board, as tall as the board's lower section
faction += `  <button class="gp-boost is-avail" type="button" title="[[اقدام بوستر در دسترس: ۱ گام زمین‌سازی و ساخت معدن||Booster action available: 1 terraforming step and a mine]]" aria-label="[[بوستر مینا: +۲ اعتبار؛ اقدام: ۱ گام زمین‌سازی و ساخت معدن||Mina's booster: +2 credits; action: 1 terraforming step and a mine]]"><img ${A}booter.webp" alt=""></button>\n`;
faction += ' </div>\n';
faction += ' <div class="gp-owned" role="group" aria-label="[[کاشی‌ها و توکن‌های مینا||Mina\'s tiles and tokens]]">\n';
faction += `  <figure><button type="button" aria-label="[[درآمد ۱ سنگ معدن و ۱ شارژ قدرت||Income: 1 ore, 1 power charge]]"><img ${A}tecore.webp" alt=""></button><figcaption>[[فناوری||Tech]]</figcaption></figure>\n`;
faction += `  <figure><button class="gp-used" type="button" disabled="" aria-label="[[اقدام ۴ شارژ قدرت، استفاده شده||Action: charge 4 power, used]]"><img ${A}tecpow.webp" alt=""></button><figcaption>[[اقدام استفاده‌شده||Action used]]</figcaption></figure>\n`;
faction += `  <figure><img ${A}fedcre.webp" alt="[[۷ امتیاز و ۶ اعتبار||7 VP and 6 credits]]"><figcaption>[[فدراسیون||Federation]]</figcaption></figure>\n`;
faction += ' </div>\n';

for (const [lang, theme] of [['fa', 'light'], ['en', 'light'], ['fa', 'dark']]) {
  const out = src
    .replace(/\[\[@research\]\]/g, research.trimEnd())
    .replace(/\[\[@scoring\]\]/g, scoring.trimEnd())
    .replace(/\[\[@fedsupply\]\]/g, fedsupply.trimEnd())
    .replace(/\[\[@faction\]\]/g, faction.trimEnd())
    .replace(/\[\[@dir\]\]/g, lang === 'fa' ? 'rtl' : 'ltr')
    .replace(/\[\[@lang\]\]/g, lang)
    .replace('data-theme="light"', `data-theme="${theme}"`)
    .replace('<title>[[پروژه گایا، میز دسکتاپ||', theme === 'dark' ? '<title>[[پروژه گایا، میز دسکتاپ، تیره||' : '<title>[[پروژه گایا، میز دسکتاپ||')
    .replace(/\[\[@hexgrid\]\]/g, outline)
    .replace(/\[\[#([0-9.:+\-−]+)\]\]/g, (_, n) => (lang === 'fa' ? faDigits(n) : n))
    .replace(/\[\[([\s\S]*?)\|\|([\s\S]*?)\]\]/g, (_, fa, en) => (lang === 'fa' ? fa : en));
  if (/\[\[/.test(out)) throw new Error('unresolved marker in ' + lang + ': ' + out.match(/\[\[.{0,40}/)[0]);
  const name = theme === 'dark' ? 'Gaia-Table-Desktop-Dark.dc.html' : lang === 'fa' ? 'Gaia-Table-Desktop.dc.html' : 'Gaia-Table-Desktop-EN.dc.html';
  fs.writeFileSync(path.join(outDir, name), out);
  console.log(name, out.length);
}
