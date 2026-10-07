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
      <rect width="320" height="180" fill="#efe7d6" />
      {edges.map(([a, b]) => <line key={`${a}-${b}`} x1={spaces[a!]!.x} y1={spaces[a!]!.y} x2={spaces[b!]!.x} y2={spaces[b!]!.y} stroke="#2a2520" strokeWidth="4" />)}
      {spaces.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r="20" fill={s.c} stroke="#2a2520" strokeWidth="3" />)}
      {tokens.map((k) => (
        <g key={k.s} transform={`translate(${spaces[k.s]!.x} ${spaces[k.s]!.y})`}>
          <circle r="15" fill={k.c} stroke="#fff" strokeWidth="3" />
          <text y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="Estedad Variable, Vazirmatn, Tahoma, sans-serif">{k.t}</text>
        </g>
      ))}
      <path d="M150 128 l20 -20 M170 128 l-20 -20" stroke="#c0392b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
