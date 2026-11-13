// Builds every Brass artboard (canvas .dc.html + a plain _qa-*.html twin for local renders) and copies the referenced
// art into the canvas folder. node build-br.js <canvas root holding project/> [ids...]   (art: ../art, from pack-art.py)
const fs = require('fs');
const path = require('path');
const { L, used } = require('./br-lib');
const CSS = require('./br-css');
const P = require('./br-parts');
const X = require('./br-screens');

const root = process.argv[2];
const only = process.argv.slice(3);
const outDir = path.join(root, 'project', 'brass');
fs.mkdirSync(outDir, { recursive: true });

function page({ title, lang = 'fa', theme = 'light', w, h, extraCss = '', body, fixed = false }) {
  const l = L(lang);
  const rootStyle = fixed ? `width: ${w}px; height: ${h}px; overflow: hidden; position: relative;` : `min-height: ${h}px;`;
  return `<!doctype html>
<html lang="${lang}" dir="${l.dir}">
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
<div class="bgv br" data-theme="${theme}" dir="${l.dir}" lang="${lang}" style="${rootStyle}">
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
// plain twin for local QA renders: helmet -> head, no DC runtime
const plain = (h) => {
  const helmet = (h.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  return h.replace(/<helmet>[\s\S]*?<\/helmet>/, '').replace('<script src="./support.js"></script>', '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '').replace(/<\/?x-dc>/g, '').replace('</head>', helmet + '\n</head>');
};

const boards = X.screens(P).filter((b) => !only.length || only.includes(b.id));
for (const b of boards) {
  const html = page(b);
  fs.writeFileSync(path.join(outDir, b.id + '.dc.html'), html);
  fs.writeFileSync(path.join(outDir, '_qa-' + b.id + '.html'), plain(html));
  console.log(b.id, Math.round(html.length / 1024) + ' KB');
}

// copy only the art the artboards reference
const ART = path.join(__dirname, '..', 'art');
const idx = JSON.parse(fs.readFileSync(path.join(ART, 'art-index.json'), 'utf8'));
const byName = Object.fromEntries(Object.keys(idx).map((k) => [k.split('/')[1], k]));
const assets = path.join(root, 'project', 'assets', 'games', 'brass');
fs.mkdirSync(assets, { recursive: true });
let bytes = 0;
for (const n of used) {
  if (!byName[n]) throw new Error('no art for ' + n);
  const s = path.join(ART, byName[n] + '.webp');
  fs.copyFileSync(s, path.join(assets, n + '.webp'));
  bytes += fs.statSync(s).size;
}
console.log('assets', used.size, Math.round(bytes / 1024), 'KB');
fs.writeFileSync(path.join(root, 'assets-used.json'), JSON.stringify([...used].sort(), null, 1));
