// Catalog cover: whitewashed towers with a blue dome on a grassy island, the Aegean behind, two workers.
export default function SantoriniCover({ title }: { title: string }) {
  const tower = (x: number, y: number, tiers: number, dome: boolean) => (
    <g filter="url(#stoc-sh)">
      {Array.from({ length: tiers }, (_, k) => {
        const w = 52 - k * 11;
        return <rect key={k} x={x - w / 2} y={y - w / 2 - k * 8} width={w} height={w} rx="4" fill="url(#stoc-stone)" stroke="#b9b2a3" strokeWidth="1.2" />;
      })}
      {dome && <circle cx={x} cy={y - tiers * 8 - 6} r="13" fill="url(#stoc-dome)" stroke="#173a7a" strokeWidth="1.2" />}
    </g>
  );
  const pawn = (x: number, y: number, c: string) => (
    <g transform={`translate(${x} ${y})`} filter="url(#stoc-sh)"><path d="M-8 12 Q-9 2 -4 -1 A6 6 0 1 1 4 -1 Q9 2 8 12 Z" fill={c} stroke="rgb(0 0 0 / .35)" /></g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="stoc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd0ef" /><stop offset=".45" stopColor="#3aa0c8" /><stop offset="1" stopColor="#1b5f8c" /></linearGradient>
        <linearGradient id="stoc-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d9d4c8" /></linearGradient>
        <radialGradient id="stoc-dome" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#5d8bd8" /><stop offset="1" stopColor="#173a7a" /></radialGradient>
        <filter id="stoc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".4" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#stoc-sky)" />
      <ellipse cx="160" cy="150" rx="190" ry="70" fill="#e9dcc0" />
      <ellipse cx="160" cy="152" rx="170" ry="58" fill="#8fbd5e" />
      {tower(88, 120, 2, false)}{tower(158, 112, 3, true)}{tower(228, 128, 1, false)}
      {pawn(120, 140, '#f3efe6')}{pawn(198, 104, '#3d4f9e')}
    </svg>
  );
}
