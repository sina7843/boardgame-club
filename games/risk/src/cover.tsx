// Catalog cover: the antique world map on a wavy sea with a few army tokens, a battle arrow and two dice
// (vector only; shares the map defs and token art from art.tsx).
import { CONTINENT_OF } from './board.ts';
import { ArmyToken, INK, MapDefs } from './art.tsx';
import { COASTS, CONTINENT_LINES, MAP_H, MAP_W, REGIONS } from './geometry.ts';

const TOKENS: [number, number][] = [[11, 0], [20, 1], [35, 4], [4, 3], [19, 5]];
const ARMIES = [12, 3, 7, 9, 5];

function Die({ x, y, v, red }: { x: number; y: number; v: number; red?: boolean }) {
  const pips: Record<number, [number, number][]> = { 5: [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]], 6: [[-5, -6], [5, -6], [-5, 0], [5, 0], [-5, 6], [5, 6]] };
  return (
    <g transform={`translate(${x} ${y}) rotate(${red ? -12 : 9})`}>
      <rect x="-11" y="-9" width="24" height="24" rx="5" fill="#000" opacity="0.3" />
      <rect x="-12" y="-12" width="24" height="24" rx="5" fill={red ? '#c62f3a' : '#fbf5e4'} stroke="#1b1611" strokeWidth="1.2" />
      <rect x="-12" y="-12" width="24" height="24" rx="5" fill="url(#rkm-shine)" />
      {(pips[v] ?? []).map(([px, py], i) => <circle key={i} cx={px} cy={py} r="2.1" fill={red ? '#fff' : '#1b130b'} />)}
    </g>
  );
}

export default function RiskCover({ title }: { title: string }) {
  const S = 0.31;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <MapDefs />
      <rect width="320" height="180" fill="url(#rkm-sea)" />
      <rect width="320" height="180" fill="url(#rkm-waves)" />
      <g transform={`translate(${(320 - MAP_W * S) / 2} ${(180 - MAP_H * S) / 2 - 2}) scale(${S})`}>
        {COASTS.map((d, i) => <path key={i} d={d} fill="none" stroke="#f3e7c6" strokeOpacity="0.35" strokeWidth="14" strokeLinejoin="round" />)}
        {COASTS.map((d, i) => <path key={`l${i}`} d={d} fill="#e9dcb4" stroke={INK} strokeWidth="3" filter="url(#rkm-land)" />)}
        {REGIONS.map((r, t) => <path key={r.id} d={r.d} fill={`url(#rkm-c-${CONTINENT_OF[t]})`} stroke={INK} strokeWidth="1" strokeOpacity="0.6" />)}
        <path d={CONTINENT_LINES} fill="none" stroke={INK} strokeWidth="2.6" />
        <path d={`M${REGIONS[11]!.center.join(' ')} Q330 230 ${REGIONS[20]!.center.join(' ')}`} fill="none" stroke="#b3261e" strokeWidth="7" strokeLinecap="round" strokeDasharray="16 9" />
        {TOKENS.map(([t, seat], i) => <g key={i} transform={`translate(${REGIONS[t]!.center[0]} ${REGIONS[t]!.center[1]})`}><ArmyToken seat={seat} n={ARMIES[i]!} r={28} /></g>)}
      </g>
      <Die x={262} y={150} v={6} red />
      <Die x={292} y={156} v={5} />
      <rect x="2" y="2" width="316" height="176" fill="none" stroke={INK} strokeWidth="2.5" />
      <rect x="5" y="5" width="310" height="170" fill="none" stroke="#f3e7c6" strokeOpacity="0.7" strokeWidth="0.8" />
    </svg>
  );
}
