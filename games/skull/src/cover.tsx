// Catalog cover: tavern coasters — a fan of face-down discs, a rose turned up, and the skull.
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
      <g transform="translate(150 92)" filter="url(#skc-sh)">
        <circle r="34" fill="#6b4a2b" stroke="#2a1d12" strokeWidth="2" />
        <circle cx="0" cy="-4" r="13" fill="#c0263c" /><path d="M-8 -6 Q0 -17 8 -6 Q0 3 -8 -6 Z" fill="#e0475f" />
        <path d="M0 9 Q-2 20 -8 26" fill="none" stroke="#3d7a3d" strokeWidth="3" />
      </g>
      <g transform="translate(222 64) rotate(10)" filter="url(#skc-sh)">
        <circle r="34" fill="#6b4a2b" stroke="#2a1d12" strokeWidth="2" />
        <path d="M-15 -3 Q-15 -21 0 -21 Q15 -21 15 -3 Q15 6 9 9 L9 16 L-9 16 L-9 9 Q-15 6 -15 -3 Z" fill="#f2ead8" stroke="#3a2a1a" strokeWidth="2" />
        <circle cx="-6" cy="-5" r="4.5" fill="#2a1d12" /><circle cx="6" cy="-5" r="4.5" fill="#2a1d12" />
      </g>
    </svg>
  );
}
