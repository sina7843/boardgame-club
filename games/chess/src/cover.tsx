// Catalog cover: a corner of an inlaid wooden chessboard with a king and a knight (vector + text glyphs).
export default function ChessCover({ title }: { title: string }) {
  const squares = [];
  for (let r = 0; r < 5; r++) for (let f = 0; f < 9; f++) squares.push(<rect key={`${r}-${f}`} x={f * 36} y={r * 36} width="36" height="36" fill={(r + f) % 2 ? '#b07e52' : '#ecd9b4'} />);
  const glyph = { fontFamily: "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', serif", fontSize: 64, textAnchor: 'middle' as const };
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="chc-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.3" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.3" /></linearGradient>
        <linearGradient id="chc-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="0.5" stopColor="#f6ecd2" /><stop offset="1" stopColor="#c4ae80" /></linearGradient>
        <linearGradient id="chc-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6e5c4a" /><stop offset="0.5" stopColor="#2b2018" /><stop offset="1" stopColor="#0c0805" /></linearGradient>
        <radialGradient id="chc-vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.4" /></radialGradient>
        <filter id="chc-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="2.5" floodColor="#000" floodOpacity="0.5" /></filter>
      </defs>
      {squares}
      <rect width="320" height="180" fill="url(#chc-sheen)" />
      <rect width="320" height="180" fill="url(#chc-vig)" />
      <g filter="url(#chc-shadow)">
        <text x="110" y="126" {...glyph} fill="url(#chc-w)" stroke="#2a1d12" strokeWidth="2" paintOrder="stroke">♚︎</text>
        <text x="210" y="112" {...glyph} fill="url(#chc-b)" stroke="#050302" strokeWidth="1">♞︎</text>
      </g>
    </svg>
  );
}
