// Catalog cover: part of the hexagonal walnut tray with black glass and white pearl marbles in a push.
import marbleB from './art/marble-b.webp';
import marbleW from './art/marble-w.webp';

// Marbles are cut from a generated sheet (see DECISIONS.md).
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
      </defs>
      <rect width="320" height="180" fill="url(#ablc-tray)" />
      {cells.map(([x, y, c], k) => (
        <g key={k}>
          <circle cx={x} cy={y} r={R * 0.84} fill="#21130a" />
          {c && <image href={c === 'b' ? marbleB : marbleW} x={x - R * 0.86} y={y - R * 0.86} width={R * 1.72} height={R * 1.72} />}
        </g>
      ))}
    </svg>
  );
}
