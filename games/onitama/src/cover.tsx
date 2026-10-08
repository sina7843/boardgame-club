// Catalog cover: an ink-lined rice-paper board with a vermilion master facing an indigo one, and a move card.
export default function OnitamaCover({ title }: { title: string }) {
  const S = 36;
  const token = (x: number, y: number, red: boolean, master: boolean) => (
    <g filter="url(#onic-sh)">
      <circle cx={x} cy={y} r={master ? 14 : 11} fill={red ? '#c8361f' : '#2b3f8c'} stroke={red ? '#6e170a' : '#16224d'} strokeWidth="1.5" />
      <circle cx={x} cy={y} r={master ? 10 : 8} fill="none" stroke="#f4ead2" strokeWidth="1.4" />
      {master ? <path d={`M${x - 6} ${y + 4} L${x - 7} ${y - 4} L${x - 3} ${y - 1} L${x} ${y - 7} L${x + 3} ${y - 1} L${x + 7} ${y - 4} L${x + 6} ${y + 4} Z`} fill="#f4ead2" /> : <circle cx={x} cy={y} r="2.5" fill="#f4ead2" />}
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="onic-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4ead2" /><stop offset="1" stopColor="#dccaa0" /></linearGradient>
        <filter id="onic-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity=".45" /></filter>
      </defs>
      <rect width="320" height="180" fill="#1f1611" />
      <rect x="20" y="0" width={5 * S} height="180" fill="url(#onic-paper)" />
      {Array.from({ length: 6 }, (_, k) => <line key={`v${k}`} x1={20 + k * S} y1="0" x2={20 + k * S} y2="180" stroke="#3a2a22" strokeWidth="1.6" opacity=".7" />)}
      {Array.from({ length: 6 }, (_, k) => <line key={`h${k}`} x1="20" y1={k * S} x2={20 + 5 * S} y2={k * S} stroke="#3a2a22" strokeWidth="1.6" opacity=".7" />)}
      {token(20 + 2.5 * S, 4.5 * S, true, true)}{token(20 + 0.5 * S, 4.5 * S, true, false)}{token(20 + 3.5 * S, 3.5 * S, true, false)}
      {token(20 + 2.5 * S, 0.5 * S, false, true)}{token(20 + 1.5 * S, 1.5 * S, false, false)}{token(20 + 4.5 * S, 0.5 * S, false, false)}
      <g transform="translate(222 36) rotate(6)" filter="url(#onic-sh)">
        <rect width="78" height="104" rx="8" fill="#efe2c2" stroke="#8a6a43" strokeWidth="2" />
        <rect x="8" y="8" width="9" height="9" fill="#c8361f" transform="rotate(45 12.5 12.5)" />
        {Array.from({ length: 25 }, (_, k) => {
          const dx = (k % 5) - 2, dy = 2 - Math.floor(k / 5);
          const on = (dx === -2 && dy === 1) || (dx === 2 && dy === 1) || (dx === -1 && dy === -1) || (dx === 1 && dy === -1);
          return <rect key={k} x={11 + (k % 5) * 12} y={30 + Math.floor(k / 5) * 12} width="10" height="10" rx="2" fill={dx === 0 && dy === 0 ? '#2a1d15' : on ? '#c8361f' : 'rgb(58 42 34 / .14)'} />;
        })}
      </g>
    </svg>
  );
}
