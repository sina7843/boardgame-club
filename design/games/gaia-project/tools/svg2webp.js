// Extract the single embedded raster from each ready-to-use SVG: node svg2webp.js <outDir> <file.svg=name>...
const fs = require('fs'), path = require('path');
const [out, ...pairs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const p of pairs) {
  const [file, name] = p.split('=');
  const m = fs.readFileSync(file, 'utf8').match(/data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=\s]+)/);
  if (!m) { console.log('NO IMAGE', file); continue; }
  fs.writeFileSync(path.join(out, name + '.' + m[1]), Buffer.from(m[2].replace(/\s/g, ''), 'base64'));
}
