// Catalog cover art for line-three: an engraved wooden board mid-game, ivory X and brass O inlays, winning diagonal.
// Board coordinates are literal (never mirrored in the RTL shell).
export default function LineThreeCover({ title }: { title: string }) {
  const cell = (c: number, r: number) => ({ x: 70 + c * 60, y: 20 + r * 60 });
  const marks: [number, number, 'x' | 'o'][] = [[0, 0, 'x'], [1, 1, 'x'], [2, 2, 'x'], [2, 0, 'o'], [0, 2, 'o'], [1, 0, 'o']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="lt-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a56c3a" /><stop offset="0.5" stopColor="#7a4b25" /><stop offset="1" stopColor="#4b2a12" /></linearGradient>
        <linearGradient id="lt-pit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#35200f" /><stop offset="1" stopColor="#5f3a1b" /></linearGradient>
        <linearGradient id="lt-ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf4" /><stop offset="1" stopColor="#bfb28d" /></linearGradient>
        <linearGradient id="lt-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7dd8d" /><stop offset="0.55" stopColor="#c8963a" /><stop offset="1" stopColor="#8b5e17" /></linearGradient>
        <pattern id="lt-grain" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M1 0v7" stroke="#fff" strokeOpacity="0.06" /><path d="M4.5 0v7" stroke="#000" strokeOpacity="0.09" /></pattern>
        <filter id="lt-drop" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity="0.65" /></filter>
        <filter id="lt-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
        <radialGradient id="lt-table" cx="50%" cy="40%" r="80%"><stop offset="0" stopColor="#1d4a3e" /><stop offset="1" stopColor="#0d241d" /></radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#lt-table)" />
      <g transform="translate(29 2) scale(0.82)">
        <rect x="56" y="8" width="208" height="204" rx="16" fill="#000" opacity="0.4" transform="translate(0 6)" filter="url(#lt-glow)" />
        <rect x="56" y="6" width="208" height="204" rx="16" fill="url(#lt-wood)" stroke="#2f1808" strokeWidth="2" />
        <rect x="56" y="6" width="208" height="204" rx="16" fill="url(#lt-grain)" />
        <rect x="60" y="10" width="200" height="196" rx="13" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
        {[0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => {
          const { x, y } = cell(c, r);
          return <rect key={`${c}${r}`} x={x + 4} y={y + 4} width="52" height="52" rx="8" fill="url(#lt-pit)" stroke="#000" strokeOpacity="0.45" strokeWidth="2" />;
        }))}
        {marks.map(([c, r, m]) => {
          const { x, y } = cell(c, r);
          return m === 'x'
            ? <path key={`${c}${r}`} d={`M${x + 16} ${y + 16}l28 28M${x + 44} ${y + 16}l-28 28`} stroke="url(#lt-ivory)" strokeWidth="9" strokeLinecap="round" filter="url(#lt-drop)" />
            : <circle key={`${c}${r}`} cx={x + 30} cy={y + 30} r="15" fill="none" stroke="url(#lt-brass)" strokeWidth="8" filter="url(#lt-drop)" />;
        })}
        <line x1="88" y1="38" x2="232" y2="182" stroke="#f2c230" strokeWidth="12" strokeLinecap="round" opacity="0.35" filter="url(#lt-glow)" />
        <line x1="88" y1="38" x2="232" y2="182" stroke="#f2c230" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </g>
    </svg>
  );
}
