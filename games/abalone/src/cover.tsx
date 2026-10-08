// Catalog cover: part of the hexagonal walnut tray with black glass and white pearl marbles in a push.
export default function AbaloneCover({ title }: { title: string }) {
  const R = 17;
  const cells: [number, number, 'b' | 'w' | null][] = [];
  for (let r = -3; r <= 3; r++) for (let q = -6; q <= 6; q++) {
    const x = 160 + R * Math.sqrt(3) * (q + r / 2), y = 90 + R * 1.5 * r;
    if (x < -10 || x > 330) continue;
    const b = r >= 1 && q >= -2 && q <= 1 ? 'b' : r <= -1 && q >= 0 && q <= 3 ? 'w' : null;
    cells.push([x, y, b]);
  }
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="ablc-tray" cx=".5" cy=".45" r=".75"><stop offset="0" stopColor="#6b4223" /><stop offset="1" stopColor="#2e1a0b" /></radialGradient>
        <radialGradient id="ablc-b" cx=".33" cy=".28" r=".85"><stop offset="0" stopColor="#7c8290" /><stop offset=".35" stopColor="#262a33" /><stop offset="1" stopColor="#05060a" /></radialGradient>
        <radialGradient id="ablc-w" cx=".33" cy=".28" r=".85"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#ece8df" /><stop offset="1" stopColor="#b8b0a0" /></radialGradient>
        <filter id="ablc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#ablc-tray)" />
      {cells.map(([x, y, c], k) => (
        <g key={k}>
          <circle cx={x} cy={y} r={R * 0.84} fill="#21130a" />
          {c && <g filter="url(#ablc-sh)"><circle cx={x} cy={y} r={R * 0.78} fill={c === 'b' ? 'url(#ablc-b)' : 'url(#ablc-w)'} /></g>}
        </g>
      ))}
    </svg>
  );
}
