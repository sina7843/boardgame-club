// Catalog cover: a corner of the green Othello board, a black/white cluster and one disc caught mid-turn.
export default function OthelloCover({ title }: { title: string }) {
  const cell = 40;
  const discs: [number, number, 'b' | 'w'][] = [[3, 1, 'b'], [4, 1, 'w'], [3, 2, 'w'], [4, 2, 'b'], [5, 2, 'b'], [2, 2, 'b'], [5, 1, 'w'], [2, 3, 'w'], [3, 3, 'b'], [6, 1, 'b']];
  const disc = (c: number, r: number, d: 'b' | 'w', k: string, sx = 1) => (
    <g key={k} filter="url(#othc-sh)" transform={`translate(${c * cell + cell / 2} ${r * cell + cell / 2}) scale(${sx} 1)`}>
      <circle r="16" fill={d === 'b' ? 'url(#othc-b)' : 'url(#othc-w)'} stroke={d === 'b' ? '#000' : '#a19d92'} />
      <ellipse cx="-5" cy="-6" rx="5.5" ry="2.6" fill="#fff" opacity={d === 'b' ? 0.18 : 0.6} transform="rotate(-28 -5 -6)" />
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="othc-felt" cx=".5" cy=".4" r=".8"><stop offset="0" stopColor="#2f8a5a" /><stop offset="1" stopColor="#11492f" /></radialGradient>
        <radialGradient id="othc-b" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#5c5f63" /><stop offset=".45" stopColor="#1d1f22" /><stop offset="1" stopColor="#060708" /></radialGradient>
        <radialGradient id="othc-w" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#ecebe6" /><stop offset="1" stopColor="#b9b6ac" /></radialGradient>
        <filter id="othc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".55" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#othc-felt)" />
      {Array.from({ length: 9 }, (_, k) => <line key={`v${k}`} x1={k * cell} y1="0" x2={k * cell} y2="180" stroke="#0c3a25" strokeWidth="2" />)}
      {Array.from({ length: 5 }, (_, k) => <line key={`h${k}`} x1="0" y1={k * cell} x2="320" y2={k * cell} stroke="#0c3a25" strokeWidth="2" />)}
      {discs.map(([c, r, d], k) => disc(c, r, d, `d${k}`))}
      {disc(6, 2, 'w', 'turning', 0.35)}
    </svg>
  );
}
