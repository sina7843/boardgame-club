import stoneB from './art/stone-b.webp';
import stoneW from './art/stone-w.webp';
import texKaya from './art/tex-kaya.webp';

// Stones and the kaya wood are cut from a generated sheet (see DECISIONS.md).
// Catalog cover: a corner of a kaya Go board with a fight between slate and shell stones and a star point.
export default function GoCover({ title }: { title: string }) {
  const G = 30;
  const stones: [number, number, 'b' | 'w'][] = [[3, 2, 'b'], [4, 2, 'w'], [4, 3, 'b'], [5, 3, 'w'], [3, 3, 'w'], [2, 3, 'b'], [5, 2, 'b'], [6, 3, 'b'], [5, 4, 'w'], [4, 4, 'w'], [7, 2, 'w'], [8, 3, 'b']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id="goc-kaya" width="320" height="320" patternUnits="userSpaceOnUse"><image href={texKaya} width="320" height="320" /></pattern>
        <filter id="goc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodOpacity=".45" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#goc-kaya)" />
      {Array.from({ length: 11 }, (_, k) => <line key={`v${k}`} x1={10 + k * G} y1="0" x2={10 + k * G} y2="180" stroke="#2b1d0e" strokeWidth="1.3" />)}
      {Array.from({ length: 7 }, (_, k) => <line key={`h${k}`} x1="0" y1={k * G} x2="320" y2={k * G} stroke="#2b1d0e" strokeWidth="1.3" />)}
      <circle cx={10 + 3 * G} cy={3 * G} r="4" fill="#2b1d0e" />
      {stones.map(([x, y, c], k) => (
        <image key={k} href={c === 'b' ? stoneB : stoneW} x={10 + x * G - 14} y={y * G - 14} width="28" height="28" filter="url(#goc-sh)" />
      ))}
    </svg>
  );
}
