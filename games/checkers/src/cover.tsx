import manD from './art/man-d.webp';
import kingD from './art/king-d.webp';
import manL from './art/man-l.webp';
import texWalnut from './art/tex-walnut.webp';
import texMaple from './art/tex-maple.webp';

// Pieces and woods are cut from a generated sheet (see DECISIONS.md).
// Catalog cover: a corner of a maple/walnut checkerboard with red and ivory discs and one crowned king mid-jump.
export default function CheckersCover({ title }: { title: string }) {
  const squares = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) squares.push(<rect key={`${r}-${c}`} x={c * 36} y={r * 36} width="36" height="36" fill={(r + c) % 2 ? 'url(#ckc-walnut)' : 'url(#ckc-maple)'} />);
  const disc = (x: number, y: number, red: boolean, king = false, key = '') => (
    <image key={key || `${x}-${y}`} href={red ? (king ? kingD : manD) : manL} x={x - 17} y={y - 17} width="34" height="34" filter="url(#ckc-shadow)" />
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <pattern id="ckc-walnut" width="72" height="72" patternUnits="userSpaceOnUse"><image href={texWalnut} width="72" height="72" /></pattern>
        <pattern id="ckc-maple" width="72" height="72" patternUnits="userSpaceOnUse"><image href={texMaple} width="72" height="72" /></pattern>
        <radialGradient id="ckc-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
        <filter id="ckc-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="1.5" dy="3" stdDeviation="2" floodOpacity=".5" /></filter>
      </defs>
      {squares}
      {disc(54, 126, false, false, 'a')}{disc(126, 126, false, false, 'b')}{disc(198, 54, true, false, 'c')}{disc(270, 54, true, false, 'd')}{disc(234, 162, false, false, 'e')}
      <path d="M90 90 Q126 40 162 20" fill="none" stroke="#ffd27a" strokeWidth="3" strokeDasharray="4 6" opacity=".9" />
      {disc(90, 90, true, true, 'k')}
      <rect width="320" height="180" fill="url(#ckc-vig)" />
    </svg>
  );
}
