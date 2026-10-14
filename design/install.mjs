#!/usr/bin/env node
// Installs the BGV design-system workflow into this repository (idempotent, safe to re-run).
// Run from the repo root AFTER copying the handoff `repo/` folder over it:   node design/install.mjs
//  1. .claude/settings.json  ← merges the guard hooks from design/claude-hooks.json (keeps your existing settings/hooks)
//  2. CLAUDE.md              ← adds the line `@design/CLAUDE.design-system.md` (creates the file if missing)
//  3. package.json           ← adds scripts ds:check, ds:check:strict, ds:baseline, ds:ratchet, ds:qa, ds:report
//  4. design/ds-baseline.json ← records today's design-system debt once (the ratchet starts here)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const must = ['design/ds.config.json', 'design/claude-hooks.json', 'scripts/ds-check.mjs', 'design/CLAUDE.design-system.md'];
for (const f of must) if (!existsSync(f)) { console.error(`install: ${f} not found — run from the repo root after copying the handoff files.`); process.exit(1); }
const log = (s) => console.log('  ✓ ' + s);
console.log('BGV design-system install');

// 1. hooks
mkdirSync('.claude', { recursive: true });
const settingsPath = '.claude/settings.json';
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
const add = JSON.parse(readFileSync('design/claude-hooks.json', 'utf8')).hooks;
settings.hooks ??= {};
for (const [event, groups] of Object.entries(add)) {
  settings.hooks[event] ??= [];
  for (const g of groups) {
    const cmd = g.hooks[0].command;
    const exists = settings.hooks[event].some((x) => (x.hooks || []).some((h) => h.command === cmd));
    if (!exists) settings.hooks[event].push(g);
  }
}
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
log('hooks merged into .claude/settings.json (PostToolUse edit guard + Stop guard)');

// 2. CLAUDE.md import
const line = '@design/CLAUDE.design-system.md';
const claude = existsSync('CLAUDE.md') ? readFileSync('CLAUDE.md', 'utf8') : '# Project instructions\n';
if (!claude.includes(line)) writeFileSync('CLAUDE.md', claude.replace(/\s*$/, '\n\n## Design system (mandatory)\n' + line + '\n'));
log('CLAUDE.md imports design/CLAUDE.design-system.md');

// 3. package.json scripts
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.scripts = {
  ...pkg.scripts,
  'ds:check': 'node scripts/ds-check.mjs',
  'ds:check:strict': 'node scripts/ds-check.mjs --strict',
  'ds:baseline': 'node scripts/ds-check.mjs --write-baseline',
  'ds:ratchet': 'node scripts/ds-check.mjs --ratchet',
  'ds:qa': 'playwright test e2e/design-qa.spec.ts --project=desktop-1440',
  'ds:report': 'node scripts/ds-qa-report.mjs'
};
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
log('package.json scripts: ds:check, ds:check:strict, ds:baseline, ds:ratchet, ds:qa, ds:report');

// 4. baseline
if (!existsSync('design/ds-baseline.json')) { execSync('node scripts/ds-check.mjs --write-baseline', { stdio: 'inherit' }); log('baseline recorded (debt may only go down from here)'); }
else log('baseline already exists (kept)');

mkdirSync('design/qa/app', { recursive: true });
console.log('\nDone. Open Claude Code in this repo and start with:  /bgv-implement phase-0');
console.log('Note: /.claude/ and /CLAUDE.md are git-ignored in this repo — every developer runs `node design/install.mjs` once.');
