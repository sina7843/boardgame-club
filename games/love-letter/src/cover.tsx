// Catalog cover: a sealed love letter on parchment beside the Princess card and a scatter of hearts.
export default function LoveLetterCover({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="llc-bg" cx=".5" cy=".4" r=".8"><stop offset="0" stopColor="#6e1a32" /><stop offset="1" stopColor="#2a0811" /></radialGradient>
        <linearGradient id="llc-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf3df" /><stop offset="1" stopColor="#e2c99a" /></linearGradient>
        <radialGradient id="llc-seal" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#d64560" /><stop offset=".6" stopColor="#9b2242" /><stop offset="1" stopColor="#5b1428" /></radialGradient>
        <filter id="llc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#llc-bg)" />
      <g transform="translate(70 92) rotate(-8)" filter="url(#llc-sh)">
        <rect x="-62" y="-40" width="124" height="80" rx="6" fill="url(#llc-paper)" />
        <path d="M-62 -40 L0 8 L62 -40" fill="none" stroke="#c9a46a" strokeWidth="3" />
        <circle cx="0" cy="8" r="14" fill="url(#llc-seal)" />
        <path d="M0 15 C-7 10 -8 5 -5 3 C-3 2 0 4 0 5 C0 4 3 2 5 3 C8 5 7 10 0 15 Z" fill="#fbd3dc" />
      </g>
      <g transform="translate(236 90) rotate(7)" filter="url(#llc-sh)">
        <rect x="-44" y="-64" width="88" height="128" rx="9" fill="url(#llc-paper)" stroke="#e0475f" strokeWidth="3" />
        <text x="-30" y="-40" fontSize="24" fontWeight="900" fill="#a01e5a" fontFamily="Vazirmatn, sans-serif">۸</text>
        <path d="M0 30 C-26 12 -26 -10 -12 -14 C-5 -16 0 -8 0 -8 C0 -8 5 -16 12 -14 C26 -10 26 12 0 30 Z" fill="#e0475f" fillOpacity=".35" stroke="#a01e5a" strokeWidth="3" />
        <path d="M-14 -24 L-7 -17 L0 -28 L7 -17 L14 -24" fill="none" stroke="#a01e5a" strokeWidth="3" strokeLinejoin="round" />
      </g>
      {[[150, 40], [170, 140], [140, 150], [292, 28]].map(([x, y], k) => <path key={k} transform={`translate(${x} ${y}) scale(.8)`} d="M0 8 C-7 3 -8 -2 -5 -4 C-3 -5 0 -3 0 -2 C0 -3 3 -5 5 -4 C8 -2 7 3 0 8 Z" fill="#e0475f" opacity=".7" />)}
    </svg>
  );
}
