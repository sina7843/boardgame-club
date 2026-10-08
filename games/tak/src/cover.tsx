// Catalog cover: a walnut Tak board with a birch road across, a black wall and a tall stack crowned by a capstone.
export default function TakCover({ title }: { title: string }) {
  const S = 44;
  const flat = (x: number, y: number, w: boolean, k = 0) => <rect key={`${x}-${y}-${k}`} x={x - 15} y={y - 4 - k * 5} width="30" height="9" rx="3" fill={w ? 'url(#takc-w)' : 'url(#takc-b)'} stroke={w ? '#a8916a' : '#000'} />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="takc-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf1dc" /><stop offset="1" stopColor="#d9c39a" /></linearGradient>
        <linearGradient id="takc-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4038" /><stop offset="1" stopColor="#15110d" /></linearGradient>
        <filter id="takc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity=".45" /></filter>
      </defs>
      <rect width="320" height="180" fill="#2b190c" />
      {Array.from({ length: 7 }, (_, c) => Array.from({ length: 4 }, (_, r) => <rect key={`${c}-${r}`} x={8 + c * S} y={4 + r * S} width={S - 6} height={S - 6} rx="5" fill="#7a4b28" />))}
      <g filter="url(#takc-sh)">
        {[0, 1, 2, 3, 4, 5, 6].map((c) => flat(27 + c * S, 115, true))}
        <rect x="104" y="18" width="10" height="26" rx="2" fill="url(#takc-b)" stroke="#000" transform="rotate(-20 109 31)" />
        {[0, 1, 2, 3].map((k) => flat(203, 74, k % 2 === 0, k))}
        <rect x="193" y="40" width="20" height="18" rx="8" fill="url(#takc-b)" stroke="#000" />
      </g>
    </svg>
  );
}
