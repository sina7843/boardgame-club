// Catalog cover: a hot 35 refused again and again — a fan of numbered cards and a heap of red chips.
export default function NoThanksCover({ title }: { title: string }) {
  const card = (x: number, y: number, n: number, rot: number, h: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot})`} filter="url(#ntc-sh)">
      <rect x="-30" y="-42" width="60" height="84" rx="8" fill={`hsl(${h} 78% 48%)`} stroke="#fff8ea" strokeWidth="3" />
      <text x="0" y="12" textAnchor="middle" fontSize="34" fontWeight="900" fill="#fff" fontFamily="Vazirmatn, sans-serif">{n.toLocaleString('fa-IR')}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="ntc-felt" cx=".5" cy=".45" r=".8"><stop offset="0" stopColor="#2f6a4f" /><stop offset="1" stopColor="#15392a" /></radialGradient>
        <filter id="ntc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#ntc-felt)" />
      {card(70, 96, 12, -16, 150, 'a')}{card(104, 88, 13, -6, 145, 'b')}{card(138, 84, 14, 4, 140, 'c')}
      {card(232, 90, 35, 6, 0, 'hot')}
      {Array.from({ length: 7 }, (_, k) => <ellipse key={k} cx={232 + (k % 2 ? 6 : -4)} cy={150 - k * 5} rx="20" ry="7" fill="#c0392b" stroke="#ffd2c8" strokeWidth="1.5" />)}
    </svg>
  );
}
