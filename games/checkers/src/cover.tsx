// Catalog cover: a corner of a maple/walnut checkerboard with red and ivory discs and one crowned king mid-jump.
export default function CheckersCover({ title }: { title: string }) {
  const squares = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) squares.push(<rect key={`${r}-${c}`} x={c * 36} y={r * 36} width="36" height="36" fill={(r + c) % 2 ? '#6a3f1f' : '#ecd4a6'} />);
  const disc = (x: number, y: number, red: boolean, king = false, key = '') => (
    <g key={key || `${x}-${y}`} filter="url(#ckc-shadow)">
      <circle cx={x} cy={y + 3} r="14" fill={red ? '#3a0a06' : '#9c8862'} />
      <circle cx={x} cy={y} r="14" fill={red ? 'url(#ckc-d)' : 'url(#ckc-l)'} stroke={red ? '#2c0703' : '#8f7b55'} strokeWidth="1.2" />
      <circle cx={x} cy={y} r="9.5" fill="none" stroke={red ? '#5f150c' : '#cdb88e'} strokeWidth="1.6" />
      {king && <path transform={`translate(${x} ${y}) scale(.38)`} d="M-20 10 L-24 -10 L-12 0 L0 -16 L12 0 L24 -10 L20 10 Z" fill="#e9c46a" stroke="#7a5a14" strokeWidth="3" />}
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="ckc-d" cx=".38" cy=".3" r=".8"><stop offset="0" stopColor="#c24a3a" /><stop offset=".55" stopColor="#8e2318" /><stop offset="1" stopColor="#4d0f09" /></radialGradient>
        <radialGradient id="ckc-l" cx=".38" cy=".3" r=".8"><stop offset="0" stopColor="#fffaf0" /><stop offset=".6" stopColor="#efe2c4" /><stop offset="1" stopColor="#bba47a" /></radialGradient>
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
