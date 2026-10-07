// Catalog cover: a corner of the printed board in a wooden frame with a ladder, a snake, a pawn and a die (vector only).
import { BoardDefs, LadderArt, PawnArt, SnakeArt, pipsOf } from './art.tsx';

const TINTS = ['#fbe3b0', '#cfe8c6', '#f7cdbb', '#cfe1f2'];

export default function SnakesCover({ title }: { title: string }) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    cells.push(<rect key={`${r}${c}`} x={c * 40} y={r * 45} width="40" height="45" fill={TINTS[(r + 2 * c) % 4]} stroke="#3a2a1a" strokeOpacity="0.25" strokeWidth="0.8" />);
    cells.push(<rect key={`b${r}${c}`} x={c * 40 + 1.5} y={r * 45 + 1.5} width="37" height="42" rx="2" fill="none" stroke="url(#sl-bevel)" strokeWidth="2" />);
  }
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <BoardDefs />
      {cells}
      <rect width="320" height="180" fill="url(#sl-paper)" />
      <rect width="320" height="180" fill="url(#sl-vignette)" />
      <LadderArt x1={66} y1={166} x2={122} y2={22} />
      <SnakeArt x1={262} y1={34} x2={206} y2={160} hue={0} />
      <g transform="translate(168 102)"><PawnArt color="#d62f35" label="1" /></g>
      <g transform="translate(28 36) scale(0.6)">
        <rect x="5" y="7" width="36" height="36" rx="9" fill="#000" opacity="0.3" />
        <rect x="3" y="3" width="36" height="36" rx="9" fill="url(#sl-die-face)" stroke="#8f7f58" strokeWidth="1.2" />
        {pipsOf(5).map(([x, y], i) => <circle key={i} cx={x * 9 + 3} cy={y * 9 + 3} r="3.5" fill="url(#sl-pip)" />)}
      </g>
      <rect x="1.5" y="1.5" width="317" height="177" fill="none" stroke="url(#sl-wood)" strokeWidth="3" />
    </svg>
  );
}
