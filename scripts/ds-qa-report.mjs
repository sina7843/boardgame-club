#!/usr/bin/env node
// Builds the BGV design-QA report from: design/reference/screens.json (what was designed),
// design/qa/app/audit.json (what the app renders, from e2e/design-qa.spec.ts) and design/qa/ds-check.json
// (static guard, from `node scripts/ds-check.mjs --strict --json > design/qa/ds-check.json`).
// Writes design/qa/index.html (side-by-side reference vs app), design/qa/summary.md and design/qa/summary.json.
// Exit 1 when any automated gate fails. The visual verdict (does it LOOK like the design?) is written by the
// bgv-design-qa agent into design/qa/VERDICT.md — this script only prepares the evidence.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const { screens } = read('design/reference/screens.json', { screens: [] });
const cfg = read('design/ds.config.json', {});
const T = { maxOffTokenColors: 0, maxOffTokenRadii: 0, maxHorizontalScroll: 0, maxOverflowingElements: 0, ...(cfg.qa?.thresholds ?? {}) };
const audit = read('design/qa/app/audit.json', {});
mkdirSync('design/qa', { recursive: true });
// Fresh static gate unless --no-static (then an existing design/qa/ds-check.json is used).
if (!process.argv.includes('--no-static')) {
  const r = spawnSync(process.execPath, ['scripts/ds-check.mjs', '--strict', '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.stdout) writeFileSync('design/qa/ds-check.json', r.stdout);
}
const ds = read('design/qa/ds-check.json', null);

const rows = [];
for (const s of screens) {
  const a = audit[s.id];
  const status = a?.status ?? 'not-run';
  const problems = []; const warnings = [];
  for (const sh of a?.shots ?? []) {
    const w = sh.width;
    const nColors = Object.values(sh.offTokenColors ?? {}).reduce((x, y) => x + y, 0);
    const nRadii = Object.values(sh.offTokenRadii ?? {}).reduce((x, y) => x + y, 0);
    if (nColors > T.maxOffTokenColors) problems.push(`@${w} ${nColors} off-token colours: ${Object.keys(sh.offTokenColors).slice(0, 4).join(' | ')}`);
    if (nRadii > T.maxOffTokenRadii) problems.push(`@${w} off-token radii: ${Object.keys(sh.offTokenRadii).join(', ')}`);
    if (sh.hScroll > T.maxHorizontalScroll) problems.push(`@${w} horizontal scroll ${sh.hScroll}px`);
    if ((sh.overflow?.length ?? 0) > T.maxOverflowingElements) problems.push(`@${w} ${sh.overflow.length} elements stick out of their frame: ${sh.overflow.slice(0, 3).join(' | ')}`);
    const nonDsFonts = Object.keys(sh.fonts ?? {}).filter((f) => !/Vazirmatn|Manrope/i.test(f));
    if (nonDsFonts.length) problems.push(`@${w} fonts outside the DS: ${nonDsFonts.join(', ')}`);
    if (s.kind === 'table' && !sh.shell?.tablescreen) problems.push(`@${w} table screen is not built on .bgv-tablescreen`);
    if ((s.kind === 'page' || s.kind === 'page-new') && !['/login', '/payments/result'].includes(s.route) && !sh.shell?.app) problems.push(`@${w} page is not inside the canonical .bgv-app shell`);
    if (sh.touching?.length) warnings.push(`@${w} text close to its frame (<${cfg.qa?.thresholds?.minEdgeGapPx ?? 6}px): ${sh.touching.slice(0, 3).join(' | ')}`);
    if (sh.latinDigits?.length) warnings.push(`@${w} Latin digits in Persian text: ${sh.latinDigits.slice(0, 3).join(' | ')}`);
    if (sh.middot) warnings.push(`@${w} ${sh.middot} «·/•» separators (use .bgv-sep)`);
    if (sh.dsCoverage < 0.3) warnings.push(`@${w} only ${(sh.dsCoverage * 100).toFixed(0)}% of elements use bgv-* classes`);
    if (s.theme !== 'light' && sh.theme !== s.theme) warnings.push(`@${w} expected theme ${s.theme}, page had ${sh.theme}`);
  }
  const gate = s.kind === 'spec' ? 'N/A' : status === 'captured' ? (problems.length ? 'FAIL' : 'PASS') : 'TODO';
  rows.push({ ...s, status, gate, problems, warnings, shots: a?.shots ?? [] });
}
const count = (g) => rows.filter((r) => r.gate === g).length;
const dsGate = ds ? (ds.failed ? 'FAIL' : 'PASS') : 'NOT RUN';
const summary = { generated: new Date().toISOString(), staticGuard: dsGate, staticErrors: ds?.errors ?? null, pass: count('PASS'), fail: count('FAIL'), todo: count('TODO'), na: count('N/A'), total: rows.length };
writeFileSync('design/qa/summary.json', JSON.stringify({ summary, rows }, null, 1));

const md = [`# BGV design QA — automated gates`, '', `Static guard (ds-check --strict): **${dsGate}**${ds ? ` — ${ds.errors} errors, ${ds.warnings} warnings` : ''}`, `Screens: **${summary.pass} PASS · ${summary.fail} FAIL · ${summary.todo} TODO (not captured yet) · ${summary.na} spec-only** of ${summary.total}`, '', '| Screen | Route | Status | Gate | Problems | Warnings |', '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.page}/${r.id} | ${r.route ?? '—'} | ${r.status} | ${r.gate} | ${r.problems.join('<br>') || '—'} | ${r.warnings.slice(0, 3).join('<br>') || '—'} |`), '',
  'TODO = not captured: `needs-flow` (table screen, provide BGV_QA_TABLES or capture with a game flow), `needs-data` (route parameter could not be resolved), `needs-role` (moderator/admin storage state), `manual` (overlay/system state, capture by hand into design/qa/app/<id>@<width>.png).',
  'Visual verdict per screen (does it match the reference?) is in design/qa/VERDICT.md, written by the bgv-design-qa agent.'].join('\n');
writeFileSync('design/qa/summary.md', md + '\n');

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>BGV design QA</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Vazirmatn,Tahoma,sans-serif;background:#F6F0E4;color:#14211B;margin:0;padding:24px}h1{margin:0 0 8px}.sum{margin:0 0 24px;color:#4A5A51}
.s{background:#FBF8F1;border:1px solid #D9CDB4;border-radius:20px;padding:20px;margin:0 0 20px}.s h2{margin:0;font-size:18px}.meta{color:#4A5A51;font-size:13px;margin:4px 0 12px}
.g{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-inline-start:8px}.PASS{background:#DCEBDD;color:#1E6B45}.FAIL{background:#F6DADD;color:#A8283E}.TODO,.N\\/A{background:#EDE4D1;color:#4A5A51}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.pair figure{margin:0}.pair img{max-width:100%;border:1px solid #D9CDB4;border-radius:12px;background:#fff}figcaption{font-size:12px;color:#4A5A51}
ul{margin:8px 0;padding-inline-start:20px;font-size:13px}.p li{color:#A8283E}.w li{color:#875400}.miss{display:grid;place-items:center;min-height:120px;border:2px dashed #D9CDB4;border-radius:12px;color:#4A5A51;font-size:13px}</style></head><body>
<h1>BGV design QA</h1><p class="sum">static guard: <b>${dsGate}</b> · ${summary.pass} PASS · ${summary.fail} FAIL · ${summary.todo} TODO · ${summary.na} spec-only · ${esc(summary.generated)}</p>
${rows.map((r) => `<section class="s" id="${r.id}"><h2>${esc(r.title ?? r.id)}<span class="g ${r.gate}">${r.gate}</span></h2><div class="meta">${esc(r.page)}/${esc(r.id)} · ${esc(r.route ?? 'spec')} · ${esc(r.state)} · theme ${r.theme} · status ${r.status}</div>
${r.reference.map((ref, i) => { const w = r.viewports[i]; const sh = r.shots.find((x) => x.width === w); return `<div class="pair"><figure><img loading="lazy" src="../${ref}" alt=""><figcaption>طراحی (reference) @${w}</figcaption></figure><figure>${sh ? `<img loading="lazy" src="../${sh.file}" alt="">` : `<div class="miss">هنوز گرفته نشده (${esc(r.status)})</div>`}<figcaption>اپ (implementation) @${w}${sh ? ' · ' + esc(sh.url) : ''}</figcaption></figure></div>`; }).join('')}
${r.problems.length ? `<ul class="p">${r.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}${r.warnings.length ? `<ul class="w">${r.warnings.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</section>`).join('\n')}
</body></html>`;
writeFileSync('design/qa/index.html', html);
console.log(`BGV design QA: static ${dsGate} · ${summary.pass} PASS · ${summary.fail} FAIL · ${summary.todo} TODO · ${summary.na} spec-only → design/qa/index.html, design/qa/summary.md`);
process.exit(dsGate === 'FAIL' || summary.fail > 0 ? 1 : 0);
