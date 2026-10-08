// Catalog cover: a corner of a kaya Go board with a fight between slate and shell stones and a star point.
export default function GoCover({ title }: { title: string }) {
  const G = 30;
  const stones: [number, number, 'b' | 'w'][] = [[3, 2, 'b'], [4, 2, 'w'], [4, 3, 'b'], [5, 3, 'w'], [3, 3, 'w'], [2, 3, 'b'], [5, 2, 'b'], [6, 3, 'b'], [5, 4, 'w'], [4, 4, 'w'], [7, 2, 'w'], [8, 3, 'b']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="goc-kaya" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9c27a" /><stop offset="1" stopColor="#c99848" /></linearGradient>
        <radialGradient id="goc-b" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#6b6e73" /><stop offset=".4" stopColor="#25272a" /><stop offset="1" stopColor="#050506" /></radialGradient>
        <radialGradient id="goc-w" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#fff" /><stop offset=".65" stopColor="#efede6" /><stop offset="1" stopColor="#c3bfb3" /></radialGradient>
        <filter id="goc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodOpacity=".45" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#goc-kaya)" />
      {Array.from({ length: 11 }, (_, k) => <line key={`v${k}`} x1={10 + k * G} y1="0" x2={10 + k * G} y2="180" stroke="#2b1d0e" strokeWidth="1.3" />)}
      {Array.from({ length: 7 }, (_, k) => <line key={`h${k}`} x1="0" y1={k * G} x2="320" y2={k * G} stroke="#2b1d0e" strokeWidth="1.3" />)}
      <circle cx={10 + 3 * G} cy={3 * G} r="4" fill="#2b1d0e" />
      {stones.map(([x, y, c], k) => (
        <g key={k} filter="url(#goc-sh)">
          <circle cx={10 + x * G} cy={y * G} r="13.5" fill={c === 'b' ? 'url(#goc-b)' : 'url(#goc-w)'} />
          <ellipse cx={10 + x * G - 4} cy={y * G - 5} rx="4" ry="2" fill="#fff" opacity={c === 'b' ? 0.2 : 0.6} transform={`rotate(-30 ${10 + x * G - 4} ${y * G - 5})`} />
        </g>
      ))}
    </svg>
  );
}
