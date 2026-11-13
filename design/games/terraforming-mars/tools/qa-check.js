// Static QA of the artboards: every src/url resolves, no tabular-nums / letter-spacing, no element that is open at idle.
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
let bad = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.dc.html'))) {
  const h = fs.readFileSync(path.join(dir, f), 'utf8');
  const refs = [...h.matchAll(/(?:src|href)="(\.\.\/[^"]+)"/g), ...h.matchAll(/url\((\.\.\/[^)]+)\)/g)].map((m) => m[1]);
  const missing = [...new Set(refs)].filter((r) => !fs.existsSync(path.join(dir, r)));
  const issues = [];
  if (missing.length) issues.push('missing ' + missing.join(', '));
  if (/tabular-nums|tnum|letter-spacing/.test(h)) issues.push('tabular-nums/letter-spacing');
  if (/class="[^"]*\b(bgv-popover|tm-zoomtip)\b[^"]*"(?![^>]*hidden)/.test(h.replace(/<style>[\s\S]*?<\/style>/, ''))) issues.push('popover in markup');
  if (/\[\[|undefined|NaN/.test(h)) issues.push('unresolved marker / undefined / NaN');
  console.log(issues.length ? 'FAIL' : 'ok  ', f, refs.length, 'refs', issues.join(' | '));
  bad += issues.length;
}
process.exit(bad ? 1 : 0);
