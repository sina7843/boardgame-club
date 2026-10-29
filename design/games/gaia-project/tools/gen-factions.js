// Build gaia/Gaia-Factions.dc.html (all 14 faction boards + rule text from the repo): node gen-factions.js <factions.json> <out.dc.html>
const fs = require('fs');
const [jsonPath, outPath] = process.argv.slice(2);
const factions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PLANET = { r: ['blue', 'زمین‌گون'], o: ['red', 'اکسیدی'], v: ['orange', 'آتشفشانی'], d: ['yellow', 'بیابانی'], s: ['brown', 'باتلاقی'], t: ['grey', 'تیتانیومی'], i: ['white', 'یخی'] };
const order = ['r', 'o', 'v', 'd', 's', 't', 'i'];
factions.sort((a, b) => order.indexOf(a.home) - order.indexOf(b.home));

const cards = factions.map((f) => {
  const [color, planetFa] = PLANET[f.home];
  return `<article class="bgv-card gf-card" aria-labelledby="gf-${f.id}">
 <header class="gf-head"><img class="gf-planet" src="../assets/games/gaia/planet-${color}.webp" alt=""><div><h2 id="gf-${f.id}">${esc(f.nameFa)} <span class="bgv-latin">${esc(f.nameEn)}</span></h2><small>خانه: ${planetFa} · <code>${f.id}</code></small></div></header>
 <img class="gf-board" src="../assets/games/gaia/faction-${f.id}-sm.webp" alt="صفحهٔ جناح ${esc(f.nameFa)}" width="880" height="501">
 <dl><dt>توانایی</dt><dd>${esc(f.abilityFa)}</dd><dt>مؤسسهٔ سیاره‌ای</dt><dd>${esc(f.piFa)}</dd></dl>
</article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>پروژه گایا، ۱۴ جناح</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../ds/bgv/tokens.css">
<link rel="stylesheet" href="../ds/bgv/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&amp;family=Manrope:wght@600;800&amp;display=swap">
<style>
body{margin:0}
.gf{background:var(--bg);color:var(--text);font-family:var(--font-fa);padding:40px 48px;display:grid;gap:24px}
.gf h1{margin:0;font-size:32px;font-weight:900;color:var(--heading);line-height:1.4}
.gf-lead{margin:0;font-size:16px;line-height:1.8;color:var(--text-muted);max-inline-size:960px}
.gf-rules{margin:0;padding-inline-start:18px;display:grid;gap:4px;font-size:14px;line-height:1.75}
.gf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}
.gf-card{padding:16px;display:grid;gap:12px;align-content:start}
.gf-head{display:flex;gap:10px;align-items:center}
.gf-planet{inline-size:40px;block-size:40px;flex:none}
.gf-head h2{margin:0;font-size:18px;font-weight:900;color:var(--heading);line-height:1.5}
.gf-head h2 .bgv-latin{font-size:13px;font-weight:600;color:var(--text-muted)}
.gf-head small{font-size:12.5px;color:var(--text-muted)}
.gf code{font-family:var(--font-latin);font-size:12px;direction:ltr;unicode-bidi:isolate}
.gf-board{display:block;inline-size:100%;block-size:auto;border-radius:var(--radius-sm);background:#0D1A23}
.gf dl{margin:0;display:grid;gap:4px}
.gf dt{font-size:12px;font-weight:700;color:var(--label)}
.gf dd{margin:0 0 6px;font-size:13.5px;line-height:1.75}
</style>
</helmet>
<div class="bgv gf" data-theme="light" dir="rtl">
<header style="display:grid;gap:8px"><span class="bgv-tag" style="justify-self:start">گایا، همهٔ جناح‌ها از <code>content/*.ts</code></span><h1>۱۴ جناح، یک قالب صفحه</h1><p class="gf-lead">هر ۱۴ صفحهٔ جناح در مجموعهٔ فلت یک قاب ۱۷۵۳×۹۹۹ دارند، پس لایهٔ روی صفحه (ساختمان‌های باقی‌مانده، ژتون‌های قدرت در کاسه‌ها، دکمه‌های تبدیل، بوستر کنار صفحه) با همان مختصات صفحهٔ هادش هالا روی همه می‌نشیند. فقط تصویر و داده عوض می‌شود.</p>
<ul class="gf-rules"><li>تصویر: <code>faction-{id}.webp</code> اندازهٔ کامل برای «صفحهٔ من» و <code>faction-{id}-sm.webp</code> برای فهرست و انتخاب جناح.</li><li>متن توانایی و مؤسسه عین <code>abilityFa</code> و <code>piFa</code> در کد؛ نام سیاره از <code>PLANET_FA</code>.</li><li>رنگ استروک ساختمان‌های خودی = رنگ سیارهٔ خانه. اقدام ویژهٔ جناح (نارنجی) روی صفحه کلیک می‌شود و تبدیل‌های جناح به ردیف تبدیل نوار کنش اضافه می‌شوند.</li></ul></header>
<div class="gf-grid">
${cards}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":3000}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
fs.writeFileSync(outPath, html);
console.log('cards', factions.length);
