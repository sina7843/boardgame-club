// Usage: node canvas-edit.js <fresh canvas.json> <out canvas.json> <patch.json>
// patch: { pages:[...], boards:{path:entry}, notes:{id:note} } — adds/replaces only these keys.
const fs = require('fs');
const [src, out, patchPath] = process.argv.slice(2);
const c = JSON.parse(fs.readFileSync(src, 'utf8'));
const p = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
for (const pg of p.pages || []) {
  c.pages = c.pages || [];
  const i = c.pages.findIndex((x) => x.id === pg.id);
  if (i >= 0) c.pages[i] = pg; else c.pages.push(pg);
}
for (const [k, v] of Object.entries(p.boards || {})) {
  c.boards[k] = v;
  if (!c.order.includes(k)) c.order.push(k);
}
for (const [k, v] of Object.entries(p.notes || {})) c.notes[k] = v;
fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(c, null, 1));
console.log('boards', Object.keys(c.boards).length, 'notes', Object.keys(c.notes).length, 'pages', c.pages.length);
