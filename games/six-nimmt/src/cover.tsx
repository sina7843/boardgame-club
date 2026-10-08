import bull from './art/bull.webp';

// Catalog cover: a row of five cards and the dreaded sixth one landing, bull heads on every card.
export default function SixNimmtCover({ title }: { title: string }) {
  const card = (x: number, y: number, n: number, bg: string, ink: string, heads: number, rot = 0, k = '') => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot})`} filter="url(#snc-sh)">
      <rect x="-22" y="-31" width="44" height="62" rx="6" fill={bg} stroke="#e2d6c2" strokeWidth="2" />
      <image href={bull} x="-18" y="-12" width="36" height="36" opacity=".18" />
      {Array.from({ length: heads }, (_, i) => <image key={i} href={bull} x={-12 + i * 8} y="-26" width="8" height="8" />)}
      <text x="0" y="12" textAnchor="middle" fontSize="20" fontWeight="900" fill={ink} fontFamily="Vazirmatn, sans-serif">{n.toLocaleString('fa-IR')}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="snc-felt" cx=".5" cy=".45" r=".8"><stop offset="0" stopColor="#2f6a4f" /><stop offset="1" stopColor="#15392a" /></radialGradient>
        <filter id="snc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#snc-felt)" />
      {card(40, 100, 31, '#fffdf8', '#5a2a5f', 1, 0, 'a')}{card(90, 100, 33, '#ffe2dd', '#b42318', 5, 0, 'b')}{card(140, 100, 40, '#fff5d6', '#8a6200', 3, 0, 'c')}
      {card(190, 100, 45, '#e8f1ff', '#1f4f9a', 2, 0, 'd')}{card(240, 100, 47, '#fffdf8', '#5a2a5f', 1, 0, 'e')}
      {card(286, 62, 55, '#f1e2ff', '#6b1fa8', 7, 14, 'six')}
    </svg>
  );
}
