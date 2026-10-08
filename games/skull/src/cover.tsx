import rose from './art/disc-rose.webp';
import skull from './art/disc-skull.webp';
// Catalog cover (faces cut from a generated sheet, see DECISIONS.md): tavern coasters — a fan of face-down discs, a rose turned up, and the skull.
export default function SkullCover({ title }: { title: string }) {
  const back = (x: number, y: number, c: string, k: string) => (
    <g key={k} transform={`translate(${x} ${y})`} filter="url(#skc-sh)">
      <circle r="30" fill={c} stroke="#1a120b" strokeWidth="2" /><circle r="25" fill="none" stroke="rgb(255 255 255 / .35)" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M0 -14 L12 7 L-12 7 Z M0 14 L-12 -7 L12 -7 Z" fill="rgb(255 255 255 / .28)" />
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="skc-bg" cx=".5" cy=".4" r=".8"><stop offset="0" stopColor="#3a2416" /><stop offset="1" stopColor="#120b06" /></radialGradient>
        <filter id="skc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity=".6" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#skc-bg)" />
      {back(60, 110, '#d1495b', 'a')}{back(84, 98, '#d1495b', 'b')}{back(250, 120, '#2f80c9', 'c')}
      <image href={rose} x="116" y="58" width="68" height="68" filter="url(#skc-sh)" />
      <image href={skull} x="188" y="30" width="68" height="68" transform="rotate(10 222 64)" filter="url(#skc-sh)" />
    </svg>
  );
}
