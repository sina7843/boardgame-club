// Measures WCAG contrast of the token pairs the UI relies on, for both themes. Fails (exit 1) below the minimum.
//   node apps/web/scripts/contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../packages/ui/src/tokens.css', import.meta.url), 'utf8');
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
  ['text', 'bg', 7], ['text', 'surface', 7], ['text', 'surface-2', 7], ['text-2', 'surface', 4.5], ['text-2', 'surface-2', 4.5], ['text-2', 'bg', 4.5],
  ['on-action', 'action', 4.5], ['on-action', 'action-hover', 4.5], ['link', 'surface', 4.5], ['link', 'bg', 4.5], ['brand', 'surface', 3],
  ['focus', 'bg', 3], ['gold', 'surface', 4.5], ['success', 'surface', 4.5], ['warning', 'surface', 4.5], ['danger', 'surface', 4.5],
  ['wood-text', 'wood', 7], ['wood-text-2', 'wood', 4.5], ['wood-text-2', 'wood-dark', 4.5], ['felt-text', 'table-felt', 4.5], ['line', 'surface', 1.2]
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
