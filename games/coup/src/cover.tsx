// Catalog cover: palace intrigue — a fan of court cards on plum velvet, one face down, and a stack of gold coins.
export default function CoupCover({ title }: { title: string }) {
  const card = (x: number, rot: number, fill: string, k: string, emblem?: string) => (
    <g key={k} transform={`translate(${x} 96) rotate(${rot})`} filter="url(#cpc-sh)">
      <rect x="-30" y="-44" width="60" height="88" rx="7" fill={fill} stroke="#1a0d16" strokeWidth="2" />
      <rect x="-25" y="-39" width="50" height="78" rx="4" fill="none" stroke="#e3bd6b" strokeWidth="1.6" />
      {emblem ? <path d={emblem} fill="#fbeccb" /> : <path d="M0 -24 L18 0 L0 24 L-18 0 Z M0 -12 L9 0 L0 12 L-9 0 Z" fill="rgb(227 189 107 / .6)" fillRule="evenodd" />}
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="cpc-bg" cx=".5" cy=".35" r=".85"><stop offset="0" stopColor="#5a2348" /><stop offset="1" stopColor="#1c0a17" /></radialGradient>
        <radialGradient id="cpc-coin" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff1c2" /><stop offset=".45" stopColor="#e3bd6b" /><stop offset="1" stopColor="#9a6f1f" /></radialGradient>
        <filter id="cpc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity=".6" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#cpc-bg)" />
      {card(98, -16, '#4a1f3c', 'back')}
      {card(140, -5, '#7b3fa0', 'duke', 'M-20 10 L-20 -10 L-10 1 L0 -16 L10 1 L20 -10 L20 10 Z M-20 14 H20 V20 H-20 Z')}
      {card(182, 7, '#b8323f', 'contessa', 'M0 -22 L20 -2 L0 6 L-20 -2 Z M-2 6 H2 V22 H-2 Z M-9 18 H9 V22 H-9 Z')}
      <g filter="url(#cpc-sh)">
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="252" cy={138 - i * 7} rx="20" ry="7" fill="url(#cpc-coin)" stroke="#7a5410" strokeWidth="1.5" />)}
        <circle cx="270" cy="100" r="13" fill="url(#cpc-coin)" stroke="#7a5410" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
