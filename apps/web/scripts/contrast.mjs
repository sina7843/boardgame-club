// Measures WCAG contrast of the token pairs the UI relies on, for both themes. Fails (exit 1) below the minimum.
//   node apps/web/scripts/contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../packages/ui/src/theme.css', import.meta.url), 'utf8');
const block = (selector) => {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
};
const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark'] {") };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum]
const PAIRS = [
  ['foreground', 'background', 7], ['foreground', 'card', 7], ['foreground', 'secondary', 7], ['foreground', 'popover', 7],
  ['muted-foreground', 'card', 4.5], ['muted-foreground', 'background', 4.5], ['muted-foreground', 'secondary', 4.5], ['muted-foreground', 'muted', 4.5],
  ['primary-foreground', 'primary', 4.5], ['brand-foreground', 'brand', 4.5], ['primary', 'card', 4.5], ['primary', 'background', 4.5],
  ['brand', 'card', 4.5], ['ring', 'background', 3], ['destructive', 'card', 4.5], ['destructive-foreground', 'destructive', 4.5],
  ['success', 'card', 4.5], ['warning', 'card', 4.5], ['felt-foreground', 'felt', 4.5]
];

let failed = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
  const out = PAIRS.map(([f, b, min]) => {
    const r = ratio(t[f], t[b]);
    if (r < min) failed++;
    return `${r < min ? 'FAIL' : 'ok  '} ${f}/${b} ${r.toFixed(2)} (min ${min})`;
  });
  console.log(`${name}\n  ${out.join('\n  ')}`);
}
process.exit(failed ? 1 : 0);
