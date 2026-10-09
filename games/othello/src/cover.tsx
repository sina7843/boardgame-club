// Catalog cover: a corner of the green Othello board, a black/white cluster and one disc caught mid-turn.
// Disc and baize art are cut from a generated sheet (see DECISIONS.md).
import { useId } from 'react';
import discB from './art/disc-b.webp';
import discW from './art/disc-w.webp';
import texBaize from './art/tex-baize.webp';

export default function OthelloCover({ title }: { title: string }) {
  const id = useId();
  const cell = 40;
  const discs: [number, number, 'b' | 'w'][] = [[3, 1, 'b'], [4, 1, 'w'], [3, 2, 'w'], [4, 2, 'b'], [5, 2, 'b'], [2, 2, 'b'], [5, 1, 'w'], [2, 3, 'w'], [3, 3, 'b'], [6, 1, 'b']];
  const disc = (c: number, r: number, d: 'b' | 'w', k: string, sx = 1) => (
    <image key={k} href={d === 'b' ? discB : discW} x={-19} y={-19} width="38" height="38" filter={`url(#${id}-sh)`} transform={`translate(${c * cell + cell / 2} ${r * cell + cell / 2}) scale(${sx} 1)`} />
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id={`${id}-felt`} patternUnits="userSpaceOnUse" width="160" height="160"><image href={texBaize} width="160" height="160" /></pattern>
        <filter id={`${id}-sh`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".55" /></filter>
      </defs>
      <rect width="320" height="180" fill={`url(#${id}-felt)`} />
      {Array.from({ length: 9 }, (_, k) => <line key={`v${k}`} x1={k * cell} y1="0" x2={k * cell} y2="180" stroke="#0c3a25" strokeWidth="2" />)}
      {Array.from({ length: 5 }, (_, k) => <line key={`h${k}`} x1="0" y1={k * cell} x2="320" y2={k * cell} stroke="#0c3a25" strokeWidth="2" />)}
      {discs.map(([c, r, d], k) => disc(c, r, d, `d${k}`))}
      {disc(6, 2, 'w', 'turning', 0.35)}
    </svg>
  );
}
