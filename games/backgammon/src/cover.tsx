// Catalog cover: one half of an inlaid walnut backgammon board, stacks of ivory and ebony checkers, two dice.
export default function BackgammonCover({ title }: { title: string }) {
  const pts = Array.from({ length: 7 }, (_, k) => k);
  const checker = (x: number, y: number, ivory: boolean, key: string) => (
    <g key={key} filter="url(#bgc-shadow)">
      <circle cx={x} cy={y} r="17" fill={ivory ? 'url(#bgc-iv)' : 'url(#bgc-eb)'} stroke={ivory ? '#a8936b' : '#000'} strokeWidth="1.2" />
      <circle cx={x} cy={y} r="11" fill="none" stroke={ivory ? '#c4ad84' : '#4a433d'} strokeWidth="1.4" />
    </g>
  );
  const pip = (cx: number, cy: number, k: string, light: boolean) => <circle key={k} cx={cx} cy={cy} r="3.4" fill={light ? '#2a1a0d' : '#f3e6c8'} />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="bgc-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b4223" /><stop offset="1" stopColor="#3f2511" /></linearGradient>
        <pattern id="bgc-kh" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#3b2412" /><path d="M7 1 L9 5 L13 7 L9 9 L7 13 L5 9 L1 7 L5 5 Z" fill="#c9a46a" /><circle cx="7" cy="7" r="1.2" fill="#6e1f1a" />
        </pattern>
        <radialGradient id="bgc-iv" cx=".38" cy=".32" r=".75"><stop offset="0" stopColor="#fffaf0" /><stop offset=".6" stopColor="#efe2c4" /><stop offset="1" stopColor="#c9b48c" /></radialGradient>
        <radialGradient id="bgc-eb" cx=".38" cy=".32" r=".75"><stop offset="0" stopColor="#5b5550" /><stop offset=".55" stopColor="#25211e" /><stop offset="1" stopColor="#0f0d0b" /></radialGradient>
        <radialGradient id="bgc-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
        <filter id="bgc-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="3" stdDeviation="2" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#bgc-wood)" />
      <rect x="6" y="6" width="308" height="168" fill="none" stroke="url(#bgc-kh)" strokeWidth="10" />
      <rect x="14" y="14" width="292" height="152" fill="#2a4f3e" />
      {pts.map((k) => (
        <g key={k}>
          <path d={`M${14 + k * 42} 14 L${35 + k * 42} 84 L${56 + k * 42} 14 Z`} fill={k % 2 ? '#efe2c4' : '#8c2f2b'} />
          <path d={`M${14 + k * 42} 166 L${35 + k * 42} 96 L${56 + k * 42} 166 Z`} fill={k % 2 ? '#8c2f2b' : '#efe2c4'} />
        </g>
      ))}
      {[0, 1, 2].map((n) => checker(35, 148 - n * 32, true, `a${n}`))}
      {[0, 1].map((n) => checker(119, 148 - n * 32, false, `b${n}`))}
      {[0, 1, 2, 3].map((n) => checker(245, 32 + n * 32, false, `c${n}`))}
      {[0, 1].map((n) => checker(161, 32 + n * 32, true, `d${n}`))}
      <g transform="translate(196 104) rotate(-14)" filter="url(#bgc-shadow)">
        <rect x="-16" y="-16" width="32" height="32" rx="7" fill="#fbf6ea" stroke="#b9a37a" />
        {[[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]].map(([x, y], k) => pip(x!, y!, `p${k}`, true))}
      </g>
      <g transform="translate(232 126) rotate(18)" filter="url(#bgc-shadow)">
        <rect x="-16" y="-16" width="32" height="32" rx="7" fill="#fbf6ea" stroke="#b9a37a" />
        {[[-8, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [8, 8]].map(([x, y], k) => pip(x!, y!, `q${k}`, true))}
      </g>
      <rect width="320" height="180" fill="url(#bgc-vig)" />
    </svg>
  );
}
