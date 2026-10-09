// Catalog cover: a small hive of ivory and black hex tiles — a queen bee nearly surrounded, an ant on the move.
// Bug and felt art are cut from a generated sheet (see DECISIONS.md).
import { useId } from 'react';
import bugQ from './art/bug-Q.webp';
import bugS from './art/bug-S.webp';
import bugB from './art/bug-B.webp';
import bugG from './art/bug-G.webp';
import bugA from './art/bug-A.webp';
import texFelt from './art/tex-felt.webp';

const BUG_IMG = { Q: bugQ, S: bugS, B: bugB, G: bugG, A: bugA };

export default function HiveCover({ title }: { title: string }) {
  const id = useId();
  const R = 26;
  const hex = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${x + Math.cos(a) * R * 0.92},${y + Math.sin(a) * R * 0.92}`;
  }).join(' ');
  const at = (q: number, r: number) => ({ x: 160 + R * Math.sqrt(3) * (q + r / 2), y: 90 + R * 1.5 * r });
  const tiles: [number, number, 'w' | 'b', keyof typeof BUG_IMG][] = [[0, 0, 'b', 'Q'], [1, 0, 'w', 'A'], [1, -1, 'w', 'B'], [0, -1, 'b', 'S'], [-1, 0, 'b', 'G'], [-1, 1, 'w', 'G'], [2, -1, 'w', 'Q'], [-2, 1, 'b', 'A']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id={`${id}-felt`} patternUnits="userSpaceOnUse" width="160" height="160"><image href={texFelt} width="160" height="160" /></pattern>
        <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#ddd2bc" /></linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#77716a" /><stop offset="1" stopColor="#45403a" /></linearGradient>
        <filter id={`${id}-sh`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill={`url(#${id}-felt)`} />
      {tiles.map(([q, r, c, bug], k) => {
        const { x, y } = at(q, r);
        return (
          <g key={k} filter={`url(#${id}-sh)`}>
            <polygon points={hex(x, y)} fill={`url(#${id}-${c})`} stroke={c === 'w' ? '#a99b80' : '#000'} strokeWidth="1.5" />
            <image href={BUG_IMG[bug]} x={x - 21} y={y - 21} width="42" height="42" />
          </g>
        );
      })}
    </svg>
  );
}
