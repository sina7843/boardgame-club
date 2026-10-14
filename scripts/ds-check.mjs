#!/usr/bin/env node
// BGV design-system guard — static check that code uses the design system and nothing else.
// No dependencies (Node ≥ 18). Config: design/ds.config.json. Baseline (ratchet): design/ds-baseline.json.
//
//   node scripts/ds-check.mjs                 report for all files in scope (exit 1 if any NEW error vs baseline)
//   node scripts/ds-check.mjs --changed       only files changed vs git HEAD (+ untracked)
//   node scripts/ds-check.mjs --file <path>   one file
//   node scripts/ds-check.mjs --strict        final gate: ANY error in a strict zone fails (baseline ignored)
//   node scripts/ds-check.mjs --write-baseline   record today's violations (run ONCE, before migration starts)
//   node scripts/ds-check.mjs --ratchet       lower the baseline where files improved (never raises it)
//   node scripts/ds-check.mjs --json          machine-readable output
//   --hook / --stop-hook                      Claude Code hooks (read hook JSON on stdin, exit 2 = feedback to Claude)
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep, extname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const CFG_PATH = join(ROOT, 'design/ds.config.json');
if (!existsSync(CFG_PATH)) { console.error(`ds-check: missing ${CFG_PATH}`); process.exit(0); }
const CFG = JSON.parse(readFileSync(CFG_PATH, 'utf8'));
const BASE_PATH = join(ROOT, CFG.baseline || 'design/ds-baseline.json');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const toPosix = (p) => p.split(sep).join('/');
const glob2re = (g) => new RegExp('^' + g.split('**').map((s) => s.split('*').map((t) => t.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
const match = (file, globs = []) => globs.some((g) => glob2re(g).test(file));
const EXT = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.html']);

function inScope(file) {
  if (!EXT.has(extname(file))) return false;
  if (!match(file, CFG.include)) return false;
  if (match(file, CFG.exclude)) return false;
  return true;
}
function zoneOf(file) {
  for (const [name, z] of Object.entries(CFG.zones || {})) if (match(file, z.files)) return { name, ...z };
  return { name: 'app', strict: true, rules: {} };
}

// ── rules ──────────────────────────────────────────────────────────────
// Each rule: id, sev (error|warn), test(line, ctx) → message | null. Zones may override severity (off|warn|error).
const COLOR_LIT = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/;
const TW_ARBITRARY = /\b(?:bg|text|border|outline|ring|fill|stroke|from|via|to|shadow|rounded(?:-[a-z]{1,2})?|font|z|decoration|accent|caret|divide|placeholder)-\[[^\]]+\]/;
const TW_PALETTE = /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d+)?\b/;
const LEGACY_VARS = new RegExp(`var\\(\\s*--(?:${(CFG.legacyVars || []).map((v) => v.replace(/^--/, '')).join('|')})\\s*[,)]`);
const RADIUS_OK = /^(?:0|0px|50%|100%|inherit|initial|unset|var\(--radius-[a-z0-9-]+\)(?:\s+var\(--radius-[a-z0-9-]+\))*|calc\(var\(--radius-[^)]*\)[^;]*\))$/;
const SHADOW_OK = /^(?:none|inherit|initial|unset|var\(--shadow-[a-z0-9-]+\)(?:\s*,\s*var\(--shadow-[a-z0-9-]+\))*)$/;
const FONT_OK = /^(?:inherit|initial|unset|var\(--font-(?:fa|latin)\))$/;
const Z_OK = /^(?:auto|inherit|initial|unset|0|1|-1|var\(--z-[a-z-]+\)|calc\(var\(--z-[^)]*\)[^;]*\))$/;
const PHYSICAL = /(?:^|[\s;{])(?:margin-left|margin-right|padding-left|padding-right|border-left|border-right|left|right)\s*:|text-align\s*:\s*(?:left|right)\b|\bfloat\s*:\s*(?:left|right)\b/;
const TW_PHYSICAL = /(?:^|[\s"'`])-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right)(?:-[\w./[\]-]+)?(?=[\s"'`])/;
const MIDDOT = /[\u00B7\u2022\u22C5\u2027]/;
const LATIN_DIGIT_IN_FA = /[\u0600-\u06FF][^"'`<>{}\n]{0,12}\b[0-9]{1,}\b|\b[0-9]+\b[^"'`<>{}\n]{0,6}[\u0600-\u06FF]/;

const RULES = [
  { id: 'DS001', sev: 'error', title: 'hard-coded colour — use a semantic token (var(--text), var(--surface)…)', test: (l) => (COLOR_LIT.test(l.code) ? l.code.match(COLOR_LIT)[0] : null) },
  { id: 'DS002', sev: 'error', title: 'Tailwind arbitrary value for colour/radius/shadow/font/z — use DS classes or tokens', test: (l) => TW_ARBITRARY.test(l.code) && !/-\[var\(--[a-z0-9-]+\)\]/.test(l.code.match(TW_ARBITRARY)?.[0] ?? '') ? l.code.match(TW_ARBITRARY)[0] : null },
  { id: 'DS003', sev: 'error', title: 'border-radius must be a --radius-* token (brand book: 8 controls · 12 inner tiles · 20 cards · 28 felt/sheets · pill)', test: (l, c) => c.css && cssVal(l.code, 'border(?:-[a-z-]+)?-radius') && !RADIUS_OK.test(cssVal(l.code, 'border(?:-[a-z-]+)?-radius')) ? cssVal(l.code, 'border(?:-[a-z-]+)?-radius') : (c.tsx && /borderRadius\s*:\s*['"`]?\d/.test(l.code) ? 'inline borderRadius' : null) },
  { id: 'DS004', sev: 'error', title: 'box-shadow must be a --shadow-* token (claymorphism lives in the tokens)', test: (l, c) => c.css && cssVal(l.code, 'box-shadow') && !SHADOW_OK.test(cssVal(l.code, 'box-shadow')) ? 'box-shadow' : (c.tsx && /boxShadow\s*:\s*['"`](?!var\(--shadow)/.test(l.code) ? 'inline boxShadow' : null) },
  { id: 'DS005', sev: 'error', title: 'font-family must be var(--font-fa) / var(--font-latin)', test: (l, c) => c.css && cssVal(l.code, 'font-family') && !FONT_OK.test(cssVal(l.code, 'font-family')) ? 'font-family' : (c.tsx && /fontFamily\s*:/.test(l.code) ? 'inline fontFamily' : null) },
  { id: 'DS006', sev: 'error', title: 'z-index must be a --z-* token', test: (l, c) => c.css && cssVal(l.code, 'z-index') && !Z_OK.test(cssVal(l.code, 'z-index')) ? 'z-index ' + cssVal(l.code, 'z-index') : (c.tsx && /zIndex\s*:\s*\d{2,}/.test(l.code) ? 'inline zIndex' : null) },
  { id: 'DS007', sev: 'error', title: 'legacy VibeFarsi token — the old theme.css is retired; map to the BGV semantic token (see design/MIGRATION-MAP.md)', test: (l) => (CFG.legacyVars || []).length && LEGACY_VARS.test(l.code) ? l.code.match(LEGACY_VARS)[0] : null },
  { id: 'DS008', sev: 'error', title: 'Tailwind palette colour class — colours come only from DS tokens', test: (l) => TW_PALETTE.test(l.code) ? l.code.match(TW_PALETTE)[0] : null },
  { id: 'DS009', sev: 'error', title: 'physical left/right — the UI is RTL, use logical properties (inline-start/end)', test: (l, c) => (c.css && PHYSICAL.test(l.code)) || (c.tsx && /className=|clsx\(|cn\(/.test(l.code) && TW_PHYSICAL.test(l.code)) ? 'physical direction' : null },
  { id: 'DS010', sev: 'warn', title: 'middle dot / bullet character in UI text — use <span class="bgv-sep"/> between meta items', test: (l, c) => c.tsx && c.kind !== 'comment' && MIDDOT.test(l.code) ? 'separator glyph' : null },
  { id: 'DS011', sev: 'warn', title: 'raw <button>/<input> without a DS class — use the DS component (Button, TextField, Select…)', test: (l, c) => c.tsx && /<(button|input|select|textarea)\b/.test(l.code) && !/className=\{?["'`][^"'`]*\bbgv-/.test(l.code) && !/\{\.\.\.[a-zA-Z]+\}/.test(l.code) ? 'raw control' : null },
  { id: 'DS012', sev: 'error', title: 'retired stylesheet import — the app loads design/system tokens.css + bundle.css only', test: (l) => (CFG.retiredImports || []).some((s) => l.code.includes(s)) ? 'retired import' : null },
  { id: 'DS013', sev: 'warn', title: 'Latin digits next to Persian text — render numbers with the DS formatter (fa digits, «٬»)', test: (l, c) => c.tsx && c.kind !== 'comment' && LATIN_DIGIT_IN_FA.test(l.code) && !/\bt\(|`\$\{/.test(l.code) ? 'latin digits' : null },
  { id: 'DS014', sev: 'error', title: 'logo drawn or recoloured in code — use the brand-kit file via <Logo/> (see design/brand/LOGO-USAGE.md)', test: (l, c) => c.tsx && /(BGV|bgv|logo|Logo)[^\n]*<path\b/.test(l.code) ? 'inline logo svg' : null },
  { id: 'DS015', sev: 'warn', title: 'inline style with literal spacing/size — prefer DS classes or --space-* tokens', test: (l, c) => c.tsx && /style=\{\{[^}]*(?:padding|margin|gap)\s*:\s*['"`]?\d/.test(l.code) ? 'inline spacing' : null }
];

function cssVal(code, prop) {
  const m = code.match(new RegExp(`(?:^|[\\s;{])(${prop})\\s*:\\s*([^;}{]+)`));
  return m ? m[2].trim().replace(/\s*!important$/, '') : null;
}

function scanFile(file) {
  const abs = join(ROOT, file);
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { return []; }
  const zone = zoneOf(file);
  const css = file.endsWith('.css');
  const tsx = /\.(tsx|jsx|ts|js|mjs|html)$/.test(file);
  const out = [];
  let inBlock = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    let code = raw;
    // strip comments (good enough for a guard; not a parser)
    if (inBlock) { const e = code.indexOf('*/'); if (e < 0) return; code = code.slice(e + 2); inBlock = false; }
    code = code.replace(/\/\*.*?\*\//g, '');
    const s = code.indexOf('/*'); if (s >= 0) { code = code.slice(0, s); inBlock = true; }
    if (!css) code = code.replace(/(^|[^:"'`])\/\/.*$/, '$1');
    if (/ds-check-ignore/.test(raw)) return;
    if (!code.trim()) return;
    for (const r of RULES) {
      const sev = (zone.rules && zone.rules[r.id]) || r.sev;
      if (sev === 'off') continue;
      let msg = null;
      try { msg = r.test({ code }, { css, tsx, kind: 'code' }); } catch { msg = null; }
      if (msg) out.push({ file, line: i + 1, rule: r.id, sev, msg, title: r.title, zone: zone.name, src: raw.trim().slice(0, 160) });
    }
  });
  return out;
}

function walk(dir, acc = []) {
  let entries; try { entries = readdirSync(join(ROOT, dir)); } catch { return acc; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const rel = dir ? `${dir}/${e}` : e;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, acc); else if (inScope(rel)) acc.push(rel);
  }
  return acc;
}
function changedFiles() {
  try {
    const a = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' });
    const b = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
    return [...new Set((a + '\n' + b).split('\n').map((s) => s.trim()).filter(Boolean))].filter(inScope);
  } catch { return []; }
}
const countBy = (vs) => vs.filter((v) => v.sev === 'error').reduce((m, v) => { (m[v.file] ||= {})[v.rule] = ((m[v.file] || {})[v.rule] || 0) + 1; return m; }, {});
const loadBase = () => (existsSync(BASE_PATH) ? JSON.parse(readFileSync(BASE_PATH, 'utf8')) : { files: {} });

function newErrors(vs, base) {
  const counts = countBy(vs); const fresh = [];
  for (const [file, rules] of Object.entries(counts)) for (const [rule, n] of Object.entries(rules)) {
    const allowed = base.files?.[file]?.[rule] ?? 0;
    if (n > allowed) fresh.push({ file, rule, n, allowed, items: vs.filter((v) => v.file === file && v.rule === rule && v.sev === 'error') });
  }
  return fresh;
}
function fmt(v) { return `  ${v.file}:${v.line}  ${v.rule} ${v.msg}\n      ${v.src}`; }

async function readStdin() { let s = ''; for await (const c of process.stdin) s += c; return s; }

// ── modes ──────────────────────────────────────────────────────────────
if (has('--hook') || has('--stop-hook')) {
  let input = {}; try { input = JSON.parse(await readStdin() || '{}'); } catch { /* not JSON */ }
  let files;
  if (has('--hook')) {
    const fp = input?.tool_input?.file_path || input?.tool_input?.path;
    if (!fp) process.exit(0);
    const rel = toPosix(relative(ROOT, resolve(fp)));
    if (!inScope(rel)) process.exit(0);
    files = [rel];
  } else {
    if (input?.stop_hook_active) process.exit(0); // never loop: one blocking reminder per stop
    files = changedFiles();
  }
  const vs = files.flatMap(scanFile);
  const fresh = newErrors(vs, loadBase());
  if (!fresh.length) process.exit(0);
  const lines = fresh.flatMap((f) => [`${f.file}: ${f.rule} ${f.n} (baseline ${f.allowed}) — ${f.items[0].title}`, ...f.items.slice(0, 6).map(fmt)]);
  console.error(`BGV design-system guard: this change adds design-system violations. Fix them before continuing — use the DS tokens/classes/components (skill: bgv-design-system, rules: design/CLAUDE.design-system.md).\n${lines.join('\n')}`);
  process.exit(2);
}

if (has('--write-baseline') || has('--ratchet')) {
  const vs = walk('').flatMap(scanFile);
  const now = countBy(vs);
  let files = now;
  if (has('--ratchet')) {
    const base = loadBase(); files = {};
    for (const [f, rules] of Object.entries(base.files || {})) for (const [r, n] of Object.entries(rules)) {
      const cur = now[f]?.[r] ?? 0; const keep = Math.min(n, cur);
      if (keep > 0) (files[f] ||= {})[r] = keep;
    }
  }
  const total = Object.values(files).reduce((s, r) => s + Object.values(r).reduce((a, b) => a + b, 0), 0);
  writeFileSync(BASE_PATH, JSON.stringify({ note: 'BGV design-system debt. Counts may only go DOWN (node scripts/ds-check.mjs --ratchet). Never edit by hand to raise a number.', updated: new Date().toISOString().slice(0, 10), total, files }, null, 1) + '\n');
  console.log(`ds-check: baseline ${has('--ratchet') ? 'ratcheted' : 'written'} — ${total} known errors in ${Object.keys(files).length} files → ${toPosix(relative(ROOT, BASE_PATH))}`);
  process.exit(0);
}

const files = has('--changed') ? changedFiles() : argVal('--file') ? [toPosix(argVal('--file'))] : walk('');
const vs = files.flatMap(scanFile);
const errors = vs.filter((v) => v.sev === 'error'); const warns = vs.filter((v) => v.sev === 'warn');
let failed = false; let report = [];
if (has('--strict')) {
  const strictErr = errors.filter((v) => zoneOf(v.file).strict !== false);
  failed = strictErr.length > 0;
  report = strictErr;
} else {
  const fresh = newErrors(vs, loadBase());
  failed = fresh.length > 0;
  report = fresh.flatMap((f) => f.items);
}
if (has('--json')) {
  const byRule = vs.reduce((m, v) => ((m[v.rule] = (m[v.rule] || 0) + 1), m), {});
  console.log(JSON.stringify({ files: files.length, errors: errors.length, warnings: warns.length, byRule, failed, mode: has('--strict') ? 'strict' : 'ratchet', violations: vs }, null, 1));
} else {
  const byRule = {}; for (const v of vs) byRule[`${v.rule} ${v.sev}`] = (byRule[`${v.rule} ${v.sev}`] || 0) + 1;
  console.log(`BGV ds-check — ${files.length} files · ${errors.length} errors · ${warns.length} warnings (${has('--strict') ? 'STRICT: every error counts' : 'ratchet: only errors above design/ds-baseline.json fail'})`);
  for (const [k, n] of Object.entries(byRule).sort()) console.log(`  ${k.padEnd(14)} ${n}  ${RULES.find((r) => r.id === k.split(' ')[0]).title}`);
  if (report.length) { console.log(`\n${failed ? 'FAIL' : 'info'} — ${report.length} ${has('--strict') ? 'errors in strict zones' : 'NEW errors (above baseline)'}:`); report.slice(0, 80).forEach((v) => console.log(fmt(v))); if (report.length > 80) console.log(`  … ${report.length - 80} more (use --json)`); }
  else console.log('\nPASS');
}
process.exit(failed ? 1 : 0);
