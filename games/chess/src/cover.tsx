// Catalog cover: a corner of a wooden chessboard with a king and a knight (vector + text glyphs).
export default function ChessCover({ title }: { title: string }) {
  const squares = [];
  for (let r = 0; r < 5; r++) for (let f = 0; f < 9; f++) squares.push(<rect key={`${r}-${f}`} x={f * 36} y={r * 36} width="36" height="36" fill={(r + f) % 2 ? '#b07e52' : '#ecd9b4'} />);
  const glyph = { fontFamily: "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', serif", fontSize: 64, textAnchor: 'middle' as const };
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      {squares}
      <text x="110" y="126" {...glyph} fill="#fffaf0" stroke="#1b130b" strokeWidth="2" paintOrder="stroke">♚︎</text>
      <text x="210" y="112" {...glyph} fill="#1b130b">♞︎</text>
    </svg>
  );
}
