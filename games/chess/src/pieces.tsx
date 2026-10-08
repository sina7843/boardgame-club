// Hand-drawn Staunton-style piece silhouettes (100x100). Shared by the renderer and the catalog cover.
// Fills reference <PieceDefs idp> gradients, so render PieceDefs once per document/SVG with the same prefix.
import type { ReactNode } from 'react';
import type { Color, PieceType } from './rules.ts';

const base = <><rect x="27" y="78" width="46" height="11" rx="5.5" /><rect x="33" y="73" width="34" height="7" rx="3.5" /></>;
const stem = (top: number) => <path d={`M42 ${top} C43 66 39 72 32 79 H68 C61 72 57 66 58 ${top}Z`} />;

const SHAPES: Record<PieceType, ReactNode> = {
  P: <><circle cx="50" cy="29" r="12" /><rect x="37" y="43" width="26" height="7" rx="3.5" />{stem(50)}{base}</>,
  R: <><path d="M31 14 H41 V22 H46 V14 H54 V22 H59 V14 H69 V34 H31Z" /><path d="M36 33 H64 L61 72 H39Z" />{base}</>,
  B: <><circle cx="50" cy="11" r="5" /><path d="M50 17 C64 26 67 40 58 49 H42 C33 40 36 26 50 17Z" /><rect x="37" y="48" width="26" height="7" rx="3.5" />{stem(55)}{base}</>,
  N: <><path d="M31 80 C28 64 38 58 44 47 C38 48 33 52 29 57 L22 51 C25 39 35 27 44 21 L45 9 L53 17 C70 20 79 40 75 62 C74 70 74 76 74 80Z" />{base}</>,
  Q: <><path d="M33 28 L39 48 H61 L67 28 L58 38 L56 20 L50 36 L44 20 L42 38Z" />{[[33, 25], [44, 17], [56, 17], [67, 25]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" />)}<rect x="36" y="46" width="28" height="7" rx="3.5" />{stem(53)}{base}</>,
  K: <><rect x="46.5" y="3" width="7" height="22" rx="2" /><rect x="40" y="9" width="20" height="7" rx="2" /><path d="M50 24 C65 26 69 38 62 48 H38 C31 38 35 26 50 24Z" /><rect x="36" y="46" width="28" height="7" rx="3.5" />{stem(53)}{base}</>
};
// Etched details, drawn in a contrasting line.
const DETAIL: Record<PieceType, ReactNode> = {
  P: null, R: <path d="M38 44 H62 M37 60 H63" />, B: <path d="M51 27 L58 36" />,
  N: <><path d="M44 47 C50 44 56 40 58 34 M60 24 C66 28 70 36 70 46" /><circle cx="49" cy="28" r="2.6" fill="currentColor" /></>,
  Q: <path d="M40 62 H60" />, K: <path d="M40 62 H60" />
};

export function PieceDefs({ idp }: { idp: string }) {
  return (
    <defs>
      <linearGradient id={`${idp}-w`} x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stopColor="#fffaea" /><stop offset=".42" stopColor="#f1e3be" /><stop offset="1" stopColor="#b79c68" /></linearGradient>
      <linearGradient id={`${idp}-b`} x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stopColor="#85735f" /><stop offset=".3" stopColor="#3a2d23" /><stop offset="1" stopColor="#0a0705" /></linearGradient>
    </defs>
  );
}

export function PieceArt({ type, color, idp }: { type: PieceType; color: Color; idp: string }) {
  const w = color === 'w';
  return (
    <>
      <g fill={`url(#${idp}-${color})`} stroke={w ? '#2a1a0e' : '#000'} strokeWidth="3.2" strokeLinejoin="round">{SHAPES[type]}</g>
      <g fill="none" stroke={w ? '#6b5233' : '#cdb78f'} strokeWidth="2.2" strokeLinecap="round" color={w ? '#2a1a0e' : '#e8d8b4'} opacity={w ? 0.8 : 0.7}>{DETAIL[type]}</g>
    </>
  );
}
