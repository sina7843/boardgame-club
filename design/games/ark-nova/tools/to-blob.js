// Canvas copy of the artboards: ../assets/games/ark-nova/<name>.webp -> /_blob/<id> (canvas asset store; the canvas is
// at its 512-file limit). node to-blob.js <blob-map.json> <build/project/ark-nova> <out/project/ark-nova>
const fs = require('fs'), path = require('path');
const [mapPath, src, dst] = process.argv.slice(2);
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.dc.html'))) {
  const h = fs.readFileSync(path.join(src, f), 'utf8').replace(/\.\.\/assets\/games\/ark-nova\/([A-Za-z0-9-]+)\.webp/g, (m, n) => {
    if (!map[n]) throw new Error('no blob for ' + n);
    return '/_blob/' + map[n];
  });
  fs.writeFileSync(path.join(dst, f), h);
}
console.log('ok', fs.readdirSync(dst).length);
