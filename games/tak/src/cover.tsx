// Catalog cover: a walnut Tak board with a birch road across, a black wall and a tall stack crowned by a capstone.
// Stone and walnut art are cut from a generated sheet (see DECISIONS.md).
import { useId } from 'react';
import bF from './art/b-F.webp';
import bS from './art/b-S.webp';
import bC from './art/b-C.webp';
import wF from './art/w-F.webp';
import texWalnut from './art/tex-walnut.webp';

export default function TakCover({ title }: { title: string }) {
  const id = useId();
  const S = 44;
  const stone = (href: string, x: number, y: number, k: string) => <image key={k} href={href} x={x - 24} y={y - 28} width="48" height="48" />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id={`${id}-wood`} patternUnits="userSpaceOnUse" width="160" height="160"><image href={texWalnut} width="160" height="160" /></pattern>
        <filter id={`${id}-sh`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity=".45" /></filter>
      </defs>
      <rect width="320" height="180" fill="#2b190c" />
      {Array.from({ length: 7 }, (_, c) => Array.from({ length: 4 }, (_, r) => <rect key={`${c}-${r}`} x={8 + c * S} y={4 + r * S} width={S - 6} height={S - 6} rx="5" fill={`url(#${id}-wood)`} />))}
      <g filter={`url(#${id}-sh)`}>
        {[0, 1, 2, 3, 4, 5, 6].map((c) => stone(wF, 27 + c * S, 115, `r${c}`))}
        {stone(bS, 109, 36, 'wall')}
        {[0, 1, 2, 3].map((k) => stone(bF, 203, 78 - k * 5, `s${k}`))}
        {stone(bC, 203, 58, 'cap')}
      </g>
    </svg>
  );
}
