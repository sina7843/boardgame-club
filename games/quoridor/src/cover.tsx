import { OAK, PAWN_SRC } from './pieces.ts';
// Catalog cover (art cut from a generated sheet, see DECISIONS.md): a corner of the wooden Quoridor board, two maple walls and two pawns racing past them.
export default function QuoridorCover({ title }: { title: string }) {
  const P = 46, C = 38;
  const tiles = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) tiles.push(<rect key={`${r}-${c}`} x={8 + c * P} y={6 + r * P} width={C} height={C} rx="6" fill="url(#qdc-oak)" />);
  const pawn = (x: number, y: number, seat: number) => <image href={PAWN_SRC[seat]} x={x - 30} y={y - 42} width="60" height="60" filter="url(#qdc-sh)" />;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id="qdc-oak" patternUnits="userSpaceOnUse" width="92" height="92"><image href={OAK} width="92" height="92" preserveAspectRatio="none" /></pattern>
        <linearGradient id="qdc-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2dfb8" /><stop offset=".5" stopColor="#c48b4d" /><stop offset="1" stopColor="#7d4f22" /></linearGradient>
        <filter id="qdc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" floodOpacity=".5" /></filter>
      </defs>
      <rect width="320" height="180" fill="#3a2412" />
      {tiles}
      <rect x="54" y="44" width="84" height="8" rx="3" fill="url(#qdc-wall)" filter="url(#qdc-sh)" />
      <rect x="184" y="52" width="8" height="84" rx="3" fill="url(#qdc-wall)" filter="url(#qdc-sh)" />
      {pawn(119, 79, 0)}
      {pawn(211, 117, 1)}
    </svg>
  );
}
