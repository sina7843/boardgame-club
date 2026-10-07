// Catalog cover: a corner of the board with a ladder and a snake (vector only).
export default function SnakesCover({ title }: { title: string }) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) cells.push(<rect key={`${r}${c}`} x={c * 40} y={r * 45} width="40" height="45" fill={(r + c) % 2 ? '#fbe9c6' : '#d9ecd2'} />);
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      {cells}
      <g stroke="#8a5a2b" strokeWidth="6" strokeLinecap="round">
        <line x1="60" y1="170" x2="120" y2="20" /><line x1="80" y1="176" x2="140" y2="26" />
        {[0.2, 0.4, 0.6, 0.8].map((t) => <line key={t} x1={60 + 60 * t} y1={170 - 150 * t} x2={80 + 60 * t} y2={176 - 150 * t} strokeWidth="4" />)}
      </g>
      <path d="M 260 30 C 180 60, 300 110, 210 160" fill="none" stroke="#2f8f4e" strokeWidth="14" strokeLinecap="round" />
      <circle cx="260" cy="30" r="13" fill="#2f8f4e" /><circle cx="255" cy="26" r="3" fill="#fff" /><circle cx="265" cy="26" r="3" fill="#fff" />
      <circle cx="170" cy="100" r="14" fill="#d62f35" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}
