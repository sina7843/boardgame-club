// Catalog cover: the parchment world map on a wavy sea with a few army tokens, a battle arrow and two dice
// (vector only; shares the map defs and token art from art.tsx).
import { CONTINENT_OF } from './board.ts';
import { ArmyToken, MapDefs } from './art.tsx';
import { COASTS, REGIONS } from './geometry.ts';

const TOKENS: [number, number, number][] = [[REGIONS[11]!.center[0], REGIONS[11]!.center[1], 0], [REGIONS[20]!.center[0], REGIONS[20]!.center[1], 1],
  [REGIONS[35]!.center[0], REGIONS[35]!.center[1], 4], [REGIONS[4]!.center[0], REGIONS[4]!.center[1], 3], [REGIONS[19]!.center[0], REGIONS[19]!.center[1], 5]];
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
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <MapDefs />
      <rect width="320" height="180" fill="url(#rkm-sea)" />
      <rect width="320" height="180" fill="url(#rkm-waves)" />
      <g transform="translate(4 -2) scale(0.312)">
        {COASTS.map((d, i) => <path key={i} d={d} fill="#d9c48f" stroke="#3b2a14" strokeWidth="3" filter="url(#rkm-land)" />)}
        {REGIONS.map((r, t) => <path key={r.id} d={r.d} fill={`url(#rkm-c-${CONTINENT_OF[t]})`} stroke="#3b2a14" strokeWidth="1.6" />)}
        <path d={`M${REGIONS[11]!.center.join(' ')} Q450 300 ${REGIONS[20]!.center.join(' ')}`} fill="none" stroke="#b3261e" strokeWidth="7" strokeLinecap="round" strokeDasharray="16 9" />
        {TOKENS.map(([x, y, seat], i) => <g key={i} transform={`translate(${x} ${y}) scale(2.6)`}><ArmyToken seat={seat} n={ARMIES[i]!} big /></g>)}
      </g>
      <Die x={262} y={150} v={6} red />
      <Die x={292} y={156} v={5} />
      <rect x="1.5" y="1.5" width="317" height="177" fill="none" stroke="url(#rkm-wood)" strokeWidth="3" />
    </svg>
  );
}
