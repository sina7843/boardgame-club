// Catalog cover art for sealed-bids: a rack of poker-chip bid tokens 1-5 and a wax-sealed envelope on felt.
export default function SealedBidsCover({ title }: { title: string }) {
  const chips = [
    { n: 1, rim: '#c9bfa0', face: '#f6f1e1', ink: '#1b1300' },
    { n: 2, rim: '#8f1a20', face: '#b3232a', ink: '#fff' },
    { n: 3, rim: '#113f82', face: '#174f9e', ink: '#fff' },
    { n: 4, rim: '#14522a', face: '#1b6e34', ink: '#fff' },
    { n: 5, rim: '#0b0b10', face: '#22222c', ink: '#fff' }
  ];
  const font = 'Estedad Variable, Vazirmatn, sans-serif';
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="sb-felt" cx="50%" cy="35%" r="80%"><stop offset="0" stopColor="#223a6e" /><stop offset="1" stopColor="#0d1530" /></radialGradient>
        <pattern id="sb-weave" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4M0 2h4" stroke="#fff" strokeOpacity="0.035" /><path d="M2 0v4" stroke="#000" strokeOpacity="0.06" /></pattern>
        <linearGradient id="sb-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7edd6" /><stop offset="1" stopColor="#dccba6" /></linearGradient>
        <radialGradient id="sb-wax" cx="34%" cy="30%" r="75%"><stop offset="0" stopColor="#e0505f" /><stop offset="0.55" stopColor="#9e2b3b" /><stop offset="1" stopColor="#6e1624" /></radialGradient>
        <radialGradient id="sb-shine" cx="32%" cy="28%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity="0.4" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <filter id="sb-drop" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="1" dy="3" stdDeviation="2.5" floodOpacity="0.55" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#sb-felt)" />
      <rect width="320" height="180" fill="url(#sb-weave)" />
      <g transform="translate(176 26) rotate(-8)" filter="url(#sb-drop)">
        <rect width="112" height="132" rx="10" fill="url(#sb-paper)" />
        <rect width="112" height="132" rx="10" fill="none" stroke="#000" strokeOpacity="0.15" />
        <path d="M0 10 56 66 112 10" fill="none" stroke="#b8a481" strokeWidth="3" />
        <path d="M0 126 44 76M112 126 68 76" stroke="#b8a481" strokeWidth="2" opacity="0.7" />
        <path d="M44 78q-8 8-4 14M70 80q8 10 3 15" fill="none" stroke="#6e1624" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M56 48c13 0 25 9 26 22 1 14-10 26-26 26s-27-12-26-26c1-13 13-22 26-22z" fill="url(#sb-wax)" stroke="#5a0f1c" strokeOpacity="0.5" />
        <circle cx="56" cy="72" r="16" fill="none" stroke="#c9505f" strokeWidth="2.5" />
        <path d="M56 72 m-7 -2a7 7 0 1 1 7 7v3" fill="none" stroke="#f2c7cd" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="56" cy="87" r="1.6" fill="#f2c7cd" />
        <ellipse cx="48" cy="60" rx="9" ry="6" fill="url(#sb-shine)" />
      </g>
      {chips.map((c, i) => {
        const cx = 56 + i * 26, cy = 76 + (i % 2) * 18;
        return (
          <g key={c.n} filter="url(#sb-drop)">
            <circle cx={cx} cy={cy} r="23" fill="#f7f3e6" />
            <circle cx={cx} cy={cy} r="23" fill="none" stroke={c.rim} strokeWidth="6" strokeDasharray="9 9" />
            <circle cx={cx} cy={cy} r="23" fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="15" fill={c.face} stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="12" fill="none" stroke={c.ink} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2.5 2" />
            <circle cx={cx} cy={cy} r="23" fill="url(#sb-shine)" />
            <text x={cx} y={cy + 6.5} textAnchor="middle" fontSize="18" fontWeight="900" fill={c.ink} fontFamily={font}>{c.n.toLocaleString('fa-IR')}</text>
          </g>
        );
      })}
      <rect x="30" y="140" width="140" height="6" rx="3" fill="#d6ad60" opacity="0.7" />
    </svg>
  );
}
