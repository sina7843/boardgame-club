// Catalog cover: half a rosewood khatam-inlaid backgammon board, lapis field, bone and crimson-lacquer checkers, two dice.
export default function BackgammonCover({ title }: { title: string }) {
  const pts = Array.from({ length: 7 }, (_, k) => k);
  const checker = (x: number, y: number, ivory: boolean, key: string) => (
    <g key={key} filter="url(#bgc-shadow)">
      <circle cx={x} cy={y} r="17" fill={ivory ? 'url(#bgc-iv)' : 'url(#bgc-eb)'} stroke={ivory ? '#5a3b16' : '#e0b341'} strokeWidth="1.6" />
      <circle cx={x} cy={y} r="12" fill="none" stroke={ivory ? '#b99a62' : '#f0c75e'} strokeWidth="1.2" />
      <path d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill={ivory ? '#c9ab6e' : '#f0c75e'} />
    </g>
  );
  const pip = (cx: number, cy: number, k: string) => <circle key={k} cx={cx} cy={cy} r="3.4" fill="#2a1a0d" />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="bgc-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5a2c1b" /><stop offset="1" stopColor="#2d140c" /></linearGradient>
        <radialGradient id="bgc-field" cx=".5" cy=".5" r=".8"><stop offset="0" stopColor="#1d4468" /><stop offset="1" stopColor="#0a1d33" /></radialGradient>
        <linearGradient id="bgc-tq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#35b5ac" /><stop offset="1" stopColor="#146461" /></linearGradient>
        <linearGradient id="bgc-sf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2c36b" /><stop offset="1" stopColor="#a8701f" /></linearGradient>
        <pattern id="bgc-kh" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#2d140c" /><path d="M7 1 L9 5 L13 7 L9 9 L7 13 L5 9 L1 7 L5 5 Z" fill="#e6d4a6" /><circle cx="7" cy="7" r="1.5" fill="#1f8a86" />
        </pattern>
        <radialGradient id="bgc-iv" cx=".36" cy=".3" r=".8"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#f3e7c9" /><stop offset="1" stopColor="#c7ae7c" /></radialGradient>
        <radialGradient id="bgc-eb" cx=".36" cy=".3" r=".8"><stop offset="0" stopColor="#e5555d" /><stop offset=".5" stopColor="#a8222c" /><stop offset="1" stopColor="#4d0a10" /></radialGradient>
        <radialGradient id="bgc-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".5" /></radialGradient>
        <filter id="bgc-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="3" stdDeviation="2" floodOpacity=".55" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#bgc-wood)" />
      <rect x="6" y="6" width="308" height="168" fill="none" stroke="url(#bgc-kh)" strokeWidth="10" />
      <rect x="14" y="14" width="292" height="152" fill="url(#bgc-field)" stroke="#d9983a" strokeWidth="1.5" />
      {pts.map((k) => (
        <g key={k}>
          <path d={`M${14 + k * 42} 14 L${35 + k * 42} 84 L${56 + k * 42} 14 Z`} fill={k % 2 ? 'url(#bgc-sf)' : 'url(#bgc-tq)'} />
          <path d={`M${14 + k * 42} 166 L${35 + k * 42} 96 L${56 + k * 42} 166 Z`} fill={k % 2 ? 'url(#bgc-tq)' : 'url(#bgc-sf)'} />
        </g>
      ))}
      {[0, 1, 2].map((n) => checker(35, 148 - n * 32, true, `a${n}`))}
      {[0, 1].map((n) => checker(119, 148 - n * 32, false, `b${n}`))}
      {[0, 1, 2, 3].map((n) => checker(245, 32 + n * 32, false, `c${n}`))}
      {[0, 1].map((n) => checker(161, 32 + n * 32, true, `d${n}`))}
      <g transform="translate(196 104) rotate(-14)" filter="url(#bgc-shadow)">
        <rect x="-16" y="-16" width="32" height="32" rx="7" fill="#fbf6ea" stroke="#5a3b16" />
        {[[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]].map(([x, y], k) => pip(x!, y!, `p${k}`))}
      </g>
      <g transform="translate(232 126) rotate(18)" filter="url(#bgc-shadow)">
        <rect x="-16" y="-16" width="32" height="32" rx="7" fill="#fbf6ea" stroke="#5a3b16" />
        {[[-8, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [8, 8]].map(([x, y], k) => pip(x!, y!, `q${k}`))}
      </g>
      <rect width="320" height="180" fill="url(#bgc-vig)" />
    </svg>
  );
}
