// Catalog cover: an original vector skirmish — zone-coloured spaces, connecting lines and four hero tokens.
export default function UnmatchedCover({ title }: { title: string }) {
  const spaces = [
    { x: 40, y: 50, c: '#c3d5c4' }, { x: 100, y: 34, c: '#c3d5c4' }, { x: 160, y: 56, c: '#e6cdb2' }, { x: 220, y: 40, c: '#e6cdb2' }, { x: 282, y: 60, c: '#c4cdd4' },
    { x: 70, y: 112, c: '#e1b7b8' }, { x: 132, y: 104, c: '#c3d5c4' }, { x: 196, y: 116, c: '#d6c2cd' }, { x: 258, y: 120, c: '#c4cdd4' },
    { x: 46, y: 160, c: '#e1b7b8' }, { x: 108, y: 166, c: '#d5c8c4' }, { x: 170, y: 168, c: '#d6c2cd' }, { x: 236, y: 166, c: '#d5c8c4' }, { x: 292, y: 164, c: '#c4cdd4' }
  ];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 6], [3, 7], [4, 8], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [6, 10], [10, 11], [7, 11], [11, 12], [8, 12], [12, 13], [8, 13]];
  const tokens = [{ s: 6, c: '#c8323a', t: 'آ' }, { s: 7, c: '#3f8f4f', t: 'م' }, { s: 2, c: '#d98a1f', t: 'س' }, { s: 11, c: '#2f7fc1', t: 'آل' }];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="umc-parch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7f0de" /><stop offset="1" stopColor="#e2d3b0" /></linearGradient>
        <radialGradient id="umc-vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#6b4a1c" stopOpacity="0" /><stop offset="1" stopColor="#6b4a1c" stopOpacity="0.35" /></radialGradient>
        <radialGradient id="umc-bevel" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></radialGradient>
        <radialGradient id="umc-plastic" cx="0.35" cy="0.28" r="0.9"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.5" /></radialGradient>
        <filter id="umc-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#umc-parch)" />
      <rect width="320" height="180" fill="url(#umc-vig)" />
      <rect x="3" y="3" width="314" height="174" rx="4" fill="none" stroke="#7a5208" strokeWidth="3" />
      <rect x="7" y="7" width="306" height="166" rx="2" fill="none" stroke="#c8921a" strokeWidth="1" />
      {edges.map(([a, b]) => <line key={`u${a}-${b}`} x1={spaces[a!]!.x} y1={spaces[a!]!.y} x2={spaces[b!]!.x} y2={spaces[b!]!.y} stroke="#fffaeb" strokeOpacity="0.6" strokeWidth="7" strokeLinecap="round" />)}
      {edges.map(([a, b]) => <line key={`${a}-${b}`} x1={spaces[a!]!.x} y1={spaces[a!]!.y} x2={spaces[b!]!.x} y2={spaces[b!]!.y} stroke="#2a2520" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 6" />)}
      {spaces.map((s, i) => <circle key={`sh${i}`} cx={s.x + 2} cy={s.y + 4} r="21" fill="#3c260a" fillOpacity="0.4" filter="url(#umc-blur)" />)}
      {spaces.map((s, i) => <g key={i}><circle cx={s.x} cy={s.y} r="20" fill={s.c} /><circle cx={s.x} cy={s.y} r="20" fill="url(#umc-bevel)" /><circle cx={s.x} cy={s.y} r="20" fill="none" stroke="#2a2520" strokeWidth="3" /></g>)}
      {tokens.map((k) => (
        <g key={k.s} transform={`translate(${spaces[k.s]!.x} ${spaces[k.s]!.y})`}>
          <ellipse cx="2" cy="10" rx="16" ry="8" fill="#2a1a06" fillOpacity="0.55" filter="url(#umc-blur)" />
          <circle r="15" fill={k.c} stroke="#fff" strokeWidth="3" />
          <circle r="15" fill="url(#umc-plastic)" />
          <ellipse cx="-5" cy="-7" rx="5" ry="2.6" fill="#fff" fillOpacity="0.7" transform="rotate(-35 -5 -7)" />
          <text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" stroke="#000" strokeOpacity="0.5" strokeWidth="2.5" paintOrder="stroke" fontFamily="Estedad Variable, Vazirmatn, Tahoma, sans-serif">{k.t}</text>
        </g>
      ))}
      <path d="M150 128 l20 -20 M170 128 l-20 -20" stroke="#5a130c" strokeWidth="7" strokeLinecap="round" strokeOpacity="0.5" transform="translate(1 2)" />
      <path d="M150 128 l20 -20 M170 128 l-20 -20" stroke="#c0392b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
