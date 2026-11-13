// Canvas copy of the artboards: ../assets/games/blood-rage/<name>.webp -> /_blob/<id> (canvas asset store; the canvas is at
// its 512-file limit). node to-blob.js <blob-map.json> <build/project/blood-rage> <out/project/blood-rage>
const fs = require('fs'), path = require('path');
const [mapPath, src, dst] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
fs.mkdirSync(dst, { recursive: true });
const missing = new Set();
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.dc.html'))) {
  const h = fs.readFileSync(path.join(src, f), 'utf8').replace(/\.\.\/assets\/games\/blood-rage\/([a-z0-9-]+).webp/g, (m, n) => {
    if (!map[n]) { missing.add(n); return m; }
    return '/_blob/' + map[n];
  });
  fs.writeFileSync(path.join(dst, f), h);
}
if (missing.size) { console.error('no blob for', [...missing].join(' ')); process.exit(1); }
console.log('ok', fs.readdirSync(dst).length);
