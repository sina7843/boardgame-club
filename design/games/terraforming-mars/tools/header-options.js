// One-off comparison page: three colour options for the player-area header (same content, only the plate changes).
// node header-options.js <canvas root>  ->  project/tm/_header-options.html
const fs = require('fs'), path = require('path');
const { L } = require('./tm-lib');
const CSS = require('./tm-css');
const P = require('./tm-parts');
const l = L('fa');
const OPTS = [
  ['a', 'الف) خاک مریخ', 'کرم گرم، هم‌خانوادهٔ صفحهٔ مریخ و قاب قهوه‌ای تولید', '.tm-ahead.opt-a{background:linear-gradient(180deg,#F6ECDD,#E4CDAE);box-shadow:inset 0 0 0 1px rgba(107,58,28,.28),inset 0 1px 0 rgba(255,255,255,.7)}'],
  ['b', 'ب) رنگ بازیکن', 'سفید با ته‌رنگ رنگِ همان بازیکن؛ محوطهٔ هر کس از دور شناخته می‌شود', '.tm-ahead.opt-b{background:linear-gradient(180deg,color-mix(in srgb,var(--pc) 10%,#FFFFFF),color-mix(in srgb,var(--pc) 24%,#EEF0F2));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pc) 45%,transparent)}'],
  ['c', 'ج) فلز روشن', 'نقره‌ای سرد مثل پنل‌های فلزی BGA و صفحهٔ بازیکن، با برجستگی ملایم', '.tm-ahead.opt-c{background:linear-gradient(180deg,#FBFCFD 0%,#E3E7EB 55%,#C9CFD5 100%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.16),inset 0 1px 0 #FFFFFF,0 1px 2px rgba(0,0,0,.25)}']
];
const block = ([k, title, note, css]) => `<section class="opt"><h2>${title}</h2><p>${note}</p>${[3, 0].map((s) => `<div class="tm-player" style="--pc:var(--tm-${['red', 'blue', 'green', 'yellow'][s]})">${P.areaHead(l, s).replace('class="tm-ahead"', `class="tm-ahead opt-${k}"`)}</div>`).join('')}</section>`;
const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>رنگ سر محوطه</title>
<link rel="stylesheet" href="../ds/bgv/tokens.css"><link rel="stylesheet" href="../ds/bgv/components/bundle.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap">
<style>${CSS}
${OPTS.map((o) => o[3]).join('\n')}
.opt-wrap{display:grid;gap:22px;padding:22px;background:var(--felt);inline-size:1080px}
.opt{display:grid;gap:10px}.opt h2{margin:0;color:var(--felt-ink);font-size:20px}.opt p{margin:0;color:var(--felt-muted);font-size:14px}
</style></head><body style="margin:0"><div class="bgv tm" data-theme="light" dir="rtl" lang="fa"><div class="opt-wrap">${OPTS.map(block).join('')}</div></div></body></html>`;
fs.writeFileSync(path.join(process.argv[2], 'project', 'tm', '_header-options.html'), html);
console.log('ok');
