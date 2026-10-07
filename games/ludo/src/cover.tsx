// Catalog cover: the cross-shaped Ludo board centre with pieces of the four colours (vector only).
export default function LudoCover({ title }: { title: string }) {
  const colors = ['#d62f35', '#23843f', '#e0a400', '#1c63c9'];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <rect width="320" height="180" fill="#fdf6e3" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={i % 2 ? 230 : 20} y={i < 2 ? 12 : 98} width="70" height="70" rx="12" fill={colors[i]} opacity="0.3" />)}
      {Array.from({ length: 9 }, (_, i) => <circle key={`h${i}`} cx={70 + i * 22} cy="90" r="9" fill="#fff" stroke="#3a2a1a" strokeWidth="2" />)}
      {Array.from({ length: 7 }, (_, i) => <circle key={`v${i}`} cx="158" cy={24 + i * 22} r="9" fill="#fff" stroke="#3a2a1a" strokeWidth="2" />)}
      {[[92, 90, 0], [158, 46, 1], [224, 90, 2], [158, 134, 3], [114, 90, 0], [55, 47, 1]].map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r="11" fill={colors[c!]} stroke="#fff" strokeWidth="3" />
      ))}
    </svg>
  );
}
