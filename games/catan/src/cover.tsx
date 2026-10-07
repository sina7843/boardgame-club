// Catalog cover: a small cluster of terrain hexes with a number token, a settlement and roads (vector only).
const SQ3 = Math.sqrt(3);
const TILES: { q: number; r: number; fill: string }[] = [
  { q: 0, r: -1, fill: '#2f6b3a' }, { q: 1, r: -1, fill: '#e3bf4a' },
  { q: -1, r: 0, fill: '#93c463' }, { q: 0, r: 0, fill: '#c4683b' }, { q: 1, r: 0, fill: '#8b919c' },
  { q: -1, r: 1, fill: '#e3bf4a' }, { q: 0, r: 1, fill: '#2f6b3a' }
];

export default function CatanCover({ title }: { title: string }) {
  const s = 30;
  const corners = (cx: number, cy: number) => Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const at = (q: number, r: number) => ({ x: 160 + SQ3 * s * (q + r / 2), y: 90 + 1.5 * s * r });
  const c = at(0, 0);
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="ct-sea" cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#3b85ad" /><stop offset="1" stopColor="#173f57" /></radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ct-sea)" />
      {TILES.map((t) => { const p = at(t.q, t.r); return <polygon key={`${t.q}${t.r}`} points={corners(p.x, p.y)} fill={t.fill} stroke="#f2e6c8" strokeWidth="3" />; })}
      <circle cx={c.x} cy={c.y + 2} r="12" fill="#f6efdc" stroke="#b9a77c" />
      <text x={c.x} y={c.y + 8} textAnchor="middle" fontSize="15" fontWeight="900" fill="#b3261e" fontFamily="Estedad Variable, Vazirmatn, Tahoma, sans-serif">۸</text>
      <line x1={c.x - SQ3 * s / 2} y1={c.y - s / 2} x2={c.x} y2={c.y - s} stroke="#1b1611" strokeWidth="9" strokeLinecap="round" />
      <line x1={c.x - SQ3 * s / 2} y1={c.y - s / 2} x2={c.x} y2={c.y - s} stroke="#c8323c" strokeWidth="6" strokeLinecap="round" />
      <path transform={`translate(${c.x} ${c.y - s})`} d="M-9 8 L-9 -3 L0 -11 L9 -3 L9 8 Z" fill="#c8323c" stroke="#1b1611" strokeWidth="2" />
      <line x1={c.x + SQ3 * s / 2} y1={c.y + s / 2} x2={c.x} y2={c.y + s} stroke="#1b1611" strokeWidth="9" strokeLinecap="round" />
      <line x1={c.x + SQ3 * s / 2} y1={c.y + s / 2} x2={c.x} y2={c.y + s} stroke="#2f62c9" strokeWidth="6" strokeLinecap="round" />
      <path transform={`translate(${c.x + SQ3 * s / 2} ${c.y + s / 2})`} d="M-12 8 L-12 -4 L-4 -4 L-4 -12 L4 -16 L12 -12 L12 8 Z" fill="#2f62c9" stroke="#1b1611" strokeWidth="2" />
    </svg>
  );
}
