// Catalog cover art for line-three: the board itself, mid-game, with the winning diagonal.
// Board coordinates are literal (never mirrored in the RTL shell).
export default function LineThreeCover({ title }: { title: string }) {
  const cell = (c: number, r: number) => ({ x: 70 + c * 60, y: 20 + r * 60 });
  const marks: [number, number, 'x' | 'o'][] = [[0, 0, 'x'], [1, 1, 'x'], [2, 2, 'x'], [2, 0, 'o'], [0, 2, 'o'], [1, 0, 'o']];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <rect width="320" height="180" fill="#14372f" />
      <g transform="translate(29 2) scale(0.82)">
      <rect x="62" y="12" width="196" height="196" rx="14" fill="#0f2b25" stroke="#2b5a4e" strokeWidth="2" />
      {[1, 2].map((i) => (
        <g key={i} stroke="#3d7566" strokeWidth="4" strokeLinecap="round">
          <line x1={70 + i * 60} y1="28" x2={70 + i * 60} y2="192" />
          <line x1="78" y1={20 + i * 60} x2="242" y2={20 + i * 60} />
        </g>
      ))}
      {marks.map(([c, r, m]) => {
        const { x, y } = cell(c, r);
        return m === 'x'
          ? <path key={`${c}${r}`} d={`M${x + 16} ${y + 16}l28 28M${x + 44} ${y + 16}l-28 28`} stroke="#f4f6fc" strokeWidth="7" strokeLinecap="round" />
          : <circle key={`${c}${r}`} cx={x + 30} cy={y + 30} r="15" fill="none" stroke="#9fb0c9" strokeWidth="7" />;
      })}
      <line x1="88" y1="38" x2="232" y2="182" stroke="#d6ad60" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      </g>
    </svg>
  );
}
