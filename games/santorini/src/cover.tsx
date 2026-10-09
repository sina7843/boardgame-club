import { DOME, SEA, WORKER_SRC } from './pieces.ts';
// Catalog cover (art cut from a generated sheet, see DECISIONS.md): whitewashed towers with a blue dome on a grassy island, the Aegean behind, two workers.
export default function SantoriniCover({ title }: { title: string }) {
  const tower = (x: number, y: number, tiers: number, dome: boolean) => (
    <g filter="url(#stoc-sh)">
      {Array.from({ length: tiers }, (_, k) => {
        const w = 52 - k * 11;
        return <rect key={k} x={x - w / 2} y={y - w / 2 - k * 8} width={w} height={w} rx="4" fill="url(#stoc-stone)" stroke="#b9b2a3" strokeWidth="1.2" />;
      })}
      {dome && <image href={DOME} x={x - 28} y={y - tiers * 8 - 40} width="56" height="56" />}
    </g>
  );
  const pawn = (x: number, y: number, seat: number) => <image href={WORKER_SRC[seat]} x={x - 22} y={y - 36} width="44" height="44" filter="url(#stoc-sh)" />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id="stoc-sea" patternUnits="userSpaceOnUse" width="180" height="180"><image href={SEA} width="180" height="180" preserveAspectRatio="none" /></pattern>
        <linearGradient id="stoc-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d9d4c8" /></linearGradient>
        <filter id="stoc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".4" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#stoc-sea)" />
      <ellipse cx="160" cy="150" rx="190" ry="70" fill="#e9dcc0" />
      <ellipse cx="160" cy="152" rx="170" ry="58" fill="#8fbd5e" />
      {tower(88, 120, 2, false)}{tower(158, 112, 3, true)}{tower(228, 128, 1, false)}
      {pawn(120, 140, 0)}{pawn(198, 104, 1)}
    </svg>
  );
}
