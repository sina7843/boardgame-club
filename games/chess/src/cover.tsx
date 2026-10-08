// Catalog cover: a corner of an inlaid maple/walnut chessboard under lamplight, with a carved king, knight and pawn.
import { pieceSrc } from './pieces.tsx';

export default function ChessCover({ title }: { title: string }) {
  const squares = [];
  for (let r = 0; r < 5; r++) for (let f = 0; f < 9; f++) squares.push(<rect key={`${r}-${f}`} x={f * 36} y={r * 36} width="36" height="36" fill={(r + f) % 2 ? '#7a4a2b' : '#ead7ae'} />);
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="chc-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.32" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></linearGradient>
        <radialGradient id="chc-lamp" cx="0.3" cy="0.15" r="0.9"><stop offset="0" stopColor="#ffe9b0" stopOpacity="0.45" /><stop offset="0.5" stopColor="#ffe9b0" stopOpacity="0" /><stop offset="1" stopColor="#1a0e06" stopOpacity="0.6" /></radialGradient>
        <filter id="chc-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="3" dy="5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" /></filter>
      </defs>
      {squares}
      <rect width="320" height="180" fill="url(#chc-sheen)" />
      <rect width="320" height="180" fill="url(#chc-lamp)" />
      <g filter="url(#chc-shadow)">
        <image href={pieceSrc('K', 'w')} x="52" y="52" width="104" height="104" />
        <image href={pieceSrc('N', 'b')} x="196" y="42" width="104" height="104" />
        <image href={pieceSrc('P', 'w')} x="150" y="94" width="64" height="64" />
      </g>
    </svg>
  );
}
