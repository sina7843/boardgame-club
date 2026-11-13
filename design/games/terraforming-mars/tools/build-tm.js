// Builds every Terraforming Mars artboard (canvas .dc.html) and copies the referenced art into the canvas folder.
// node build-tm.js <canvas root holding project/>   (art comes from ../art, made by pack-art.py)
const fs = require('fs');
const path = require('path');
const { L, used } = require('./tm-lib');
const CSS = require('./tm-css');
const P = require('./tm-parts');
const X = require('./tm-screens');

const root = process.argv[2];
const outDir = path.join(root, 'project', 'tm');
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
<div class="bgv tm" data-theme="${theme}" dir="${l.dir}" lang="${lang}" style="${rootStyle}">
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

const boards = X.screens(P);
for (const b of boards) {
  const html = page(b);
  fs.writeFileSync(path.join(outDir, b.id + '.dc.html'), html);
  console.log(b.id, html.length);
}

// copy only the art the artboards reference
const ART = path.join(__dirname, '..', 'art');
const assets = path.join(root, 'project', 'assets', 'games', 'tm');
fs.mkdirSync(assets, { recursive: true });
const proj = fs.readdirSync(path.join(ART, 'cards', 'projects'));
function srcOf(name) {
  if (name === 'board-tharsis' || name === 'player-board') return path.join(ART, 'boards', name + '.webp');
  if (name === 'tile-mining-area') return path.join(ART, 'tiles', 'special', 'mining-area.webp');
  if (name.startsWith('tile-')) return path.join(ART, 'tiles', name.slice(5) + '.webp');
  if (name.startsWith('logo-')) return path.join(ART, 'markers', 'corp-logos', name + '.webp');
  if (name.startsWith('tag-')) return path.join(ART, 'markers', 'tags', name + '.webp');
  if (name === 'cube-white') return path.join(ART, 'markers', 'white-cube.webp');
  if (name.startsWith('cube-')) return path.join(ART, 'markers', 'player', name.slice(5) + '-cube.webp');
  if (name === 'first-player') return path.join(ART, 'markers', 'first-player-marker.webp');
  if (name.startsWith('i-')) return path.join(ART, 'icons', name.slice(2) + '.webp');
  if (name === 'card-back') return path.join(ART, 'cards', 'backs', 'project-card-back.webp');
  if (name.startsWith('card-')) return path.join(ART, 'cards', 'projects', proj.find((f) => f.startsWith(name.slice(5) + '-')));
  if (name.startsWith('corp-')) return path.join(ART, 'cards', 'corporations', name.slice(5) + '.webp');
  throw new Error('no art for ' + name);
}
used.add('i-tr'); // panel TR badge background (CSS url)
let bytes = 0;
for (const n of used) { const s = srcOf(n); fs.copyFileSync(s, path.join(assets, n + '.webp')); bytes += fs.statSync(s).size; }
console.log('assets', used.size, Math.round(bytes / 1024), 'KB');
fs.writeFileSync(path.join(root, 'assets-used.json'), JSON.stringify([...used].sort(), null, 1));
