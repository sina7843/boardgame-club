// Builds the Blood Rage artboards (canvas .dc.html + a plain _qa-*.html twin for local renders) and copies the
// referenced art into the canvas folder. node build-bdr.js <canvas root holding project/> [ids...]   (art: ../art)
const fs = require('fs');
const path = require('path');
const { L, used } = require('./bdr-lib');
const CSS = require('./bdr-css');
const X = require('./bdr-screens');

const root = process.argv[2];
const only = process.argv.slice(3);
const outDir = path.join(root, 'project', 'blood-rage');
fs.mkdirSync(outDir, { recursive: true });

function page({ title, lang = 'fa', theme = 'light', w, h, extraCss = '', body }) {
  const l = L(lang);
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
<div class="bgv bdr" data-theme="${theme}" dir="${l.dir}" lang="${lang}" style="min-height:${h}px;inline-size:100%;background:var(--bg)">
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

const boards = X.screens().filter((b) => !only.length || only.includes(b.id));
for (const b of boards) {
  // Persian: «·» next to a digit reads as zero «۰», so Persian pages separate with «،»
  // and signed Persian numbers (+۵, −۲) are isolated LTR so the sign stays in front (text nodes only)
  const fa = (h) => h.split(/(<[^>]+>)/).map((t, i) => (i % 2 ? t : t.replace(/ · /g, '، ').replace(/([+−])([۰-۹]+)/g, '<span class="bdr-num">$1$2</span>'))).join('');
  const html = (b.lang || 'fa') === 'fa' ? fa(page(b)) : page(b);
  fs.writeFileSync(path.join(outDir, b.id + '.dc.html'), html);
  fs.writeFileSync(path.join(outDir, '_qa-' + b.id + '.html'), plain(html));
  console.log(b.id, Math.round(html.length / 1024) + ' KB');
}

// copy only the art the artboards reference
const ART = path.join(__dirname, '..', 'art');
const idx = JSON.parse(fs.readFileSync(path.join(ART, 'art-index.json'), 'utf8'));
const byName = Object.fromEntries(Object.keys(idx).map((k) => [k.split('/')[1], k]));
const assets = path.join(root, 'project', 'assets', 'games', 'blood-rage');
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
