// Catalog cover: a sealed love letter beside the Princess card and a scatter of hearts.
// Art is cut from a generated sheet (see DECISIONS.md).
import letter from './art/letter.webp';
import princess from './art/ll-princess.webp';
export default function LoveLetterCover({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="llc-bg" cx=".5" cy=".4" r=".8"><stop offset="0" stopColor="#6e1a32" /><stop offset="1" stopColor="#2a0811" /></radialGradient>
        <linearGradient id="llc-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf3df" /><stop offset="1" stopColor="#e2c99a" /></linearGradient>
        <filter id="llc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#llc-bg)" />
      <g transform="translate(70 92) rotate(-8)" filter="url(#llc-sh)">
        <image href={letter} x="-62" y="-62" width="124" height="124" preserveAspectRatio="xMidYMid slice" />
      </g>
      <g transform="translate(236 90) rotate(7)" filter="url(#llc-sh)">
        <rect x="-44" y="-64" width="88" height="128" rx="9" fill="url(#llc-paper)" stroke="#e0475f" strokeWidth="3" />
        <text x="-30" y="-40" fontSize="24" fontWeight="900" fill="#a01e5a" fontFamily="Vazirmatn, sans-serif">۸</text>
        <image href={princess} x="-38" y="-30" width="76" height="76" preserveAspectRatio="xMidYMid slice" />
      </g>
      {[[150, 40], [170, 140], [140, 150], [292, 28]].map(([x, y], k) => <path key={k} transform={`translate(${x} ${y}) scale(.8)`} d="M0 8 C-7 3 -8 -2 -5 -4 C-3 -5 0 -3 0 -2 C0 -3 3 -5 5 -4 C8 -2 7 3 0 8 Z" fill="#e0475f" opacity=".7" />)}
    </svg>
  );
}
