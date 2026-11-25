// Build step (Phase F): design/games/**/RULES.md → src/generated/rules/<slug>.md, public part only (src/lib/rulesPublic.ts).
// The output is gitignored and rebuilt by `dev` and `build`; the web bundle lazy-loads one file per game
// (src/lib/rules.ts), so the browser fetches only the game it shows and the internal sections never ship.
// Run: node scripts/rules.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicRules } from '../src/lib/rulesPublic.ts';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = join(web, '..', '..');
export const outDir = join(web, 'src', 'generated', 'rules');

/** Every RULES.md under design/games, keyed by the folder name, which is the game slug (games/<slug>). */
export function rulesFiles(root = repoRoot): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'RULES.md') found.set(basename(dir), p);
    }
  };
  walk(join(root, 'design', 'games'));
  return found;
}

export const gameSlugs = (root = repoRoot) =>
  readdirSync(join(root, 'games'), { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(root, 'games', e.name, 'package.json'))).map((e) => e.name).sort();

if (import.meta.main) {
  const files = rulesFiles();
  const slugs = gameSlugs();
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const slug of slugs) {
    const file = files.get(slug);
    if (!file) continue;
    writeFileSync(join(outDir, `${slug}.md`), publicRules(readFileSync(file, 'utf8')));
    n++;
  }
  const missing = slugs.filter((s) => !files.has(s));
  const orphan = [...files.keys()].filter((s) => !slugs.includes(s));
  console.log(`rules: ${n} public rule files written${missing.length ? `; no RULES.md for: ${missing.join(', ')}` : ''}${orphan.length ? `; RULES.md without a game: ${orphan.join(', ')}` : ''}`);
}
