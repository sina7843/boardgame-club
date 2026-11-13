// Builds every Ark Nova artboard (canvas .dc.html) and copies the referenced art into the canvas folder.
// node build-an.js <canvas root holding project/>   (art comes from ../art, made by pack-art.py)
const fs = require('fs');
const path = require('path');
const { used } = require('./an-lib');
const CSS = require('./an-css') + require('./an-bga').CSS;
const P = require('./an-bga');
const X = require('./an-screens');

const root = process.argv[2];
const outDir = path.join(root, 'project', 'ark-nova');
fs.mkdirSync(outDir, { recursive: true });

function page({ title, lang = 'fa', theme = 'light', w, h, extraCss = '', body, fixed = false }) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const l = require('./an-lib').L(lang);
  const rootStyle = fixed ? `width: ${w}px; height: ${h}px; overflow: hidden; position: relative;` : `min-height: ${h}px;`;
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../ds/bgv/tokens.css">
<link rel="stylesheet" href="../ds/bgv/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&amp;family=Manrope:wght@600;700;800&amp;display=swap">
<style>
${CSS.trim()}
${extraCss.trim()}
</style>
</helmet>
<div class="bgv an" data-theme="${theme}" dir="${dir}" lang="${lang}" style="${rootStyle}">
${body(l)}
</div>
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

for (const b of X.screens(P)) {
  const html = page(b);
  fs.writeFileSync(path.join(outDir, b.id + '.dc.html'), html);
  console.log(b.id, html.length);
}
const ART = path.join(__dirname, '..', 'art');
const assets = path.join(root, 'project', 'assets', 'games', 'ark-nova');
fs.mkdirSync(assets, { recursive: true });
let bytes = 0;
for (const n of used) { const s = path.join(ART, n + '.webp'); fs.copyFileSync(s, path.join(assets, n.replace(/\//g, '--') + '.webp')); bytes += fs.statSync(s).size; }
console.log('assets', used.size, Math.round(bytes / 1024), 'KB');
fs.writeFileSync(path.join(root, 'assets-used.json'), JSON.stringify([...used].sort(), null, 1));
