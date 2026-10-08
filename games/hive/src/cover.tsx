// Catalog cover: a small hive of ivory and black hex tiles — a queen bee nearly surrounded, an ant on the move.
export default function HiveCover({ title }: { title: string }) {
  const R = 26;
  const hex = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${x + Math.cos(a) * R * 0.92},${y + Math.sin(a) * R * 0.92}`;
  }).join(' ');
  const at = (q: number, r: number) => ({ x: 160 + R * Math.sqrt(3) * (q + r / 2), y: 90 + R * 1.5 * r });
  const tiles: [number, number, 'w' | 'b', string][] = [[0, 0, 'b', '#e0a526'], [1, 0, 'w', '#2f80c9'], [1, -1, 'w', '#7d4fb0'], [0, -1, 'b', '#8a5a2b'], [-1, 0, 'b', '#3fa34d'], [-1, 1, 'w', '#3fa34d'], [2, -1, 'w', '#e0a526'], [-2, 1, 'b', '#2f80c9']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="hvc-felt" cx=".5" cy=".45" r=".8"><stop offset="0" stopColor="#2f6a4f" /><stop offset="1" stopColor="#15392a" /></radialGradient>
        <linearGradient id="hvc-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#ddd2bc" /></linearGradient>
        <linearGradient id="hvc-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3c3833" /><stop offset="1" stopColor="#141210" /></linearGradient>
        <filter id="hvc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#hvc-felt)" />
      {tiles.map(([q, r, c, ink], k) => {
        const { x, y } = at(q, r);
        return (
          <g key={k} filter="url(#hvc-sh)">
            <polygon points={hex(x, y)} fill={c === 'w' ? 'url(#hvc-w)' : 'url(#hvc-b)'} stroke={c === 'w' ? '#a99b80' : '#000'} strokeWidth="1.5" />
            <ellipse cx={x} cy={y + 2} rx="6" ry="9" fill={ink} /><circle cx={x} cy={y - 9} r="4" fill={ink} />
          </g>
        );
      })}
    </svg>
  );
}
