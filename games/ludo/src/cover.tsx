// Catalog cover: the cross-shaped Ludo board centre on a wooden table with glossy pawns of the four colours (vector only).
export default function LudoCover({ title }: { title: string }) {
  const colors = ['#d62f35', '#23843f', '#e0a400', '#1c63c9'];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="ldc-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8754a" /><stop offset="1" stopColor="#5e3a1e" /></linearGradient>
        <linearGradient id="ldc-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#f0e3c4" /></linearGradient>
        <linearGradient id="ldc-cell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#e3d8bd" /></linearGradient>
        <linearGradient id="ldc-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.4" /><stop offset="1" stopColor="#000" stopOpacity="0.3" /></linearGradient>
        <radialGradient id="ldc-dome" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.5" /></radialGradient>
        <filter id="ldc-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#ldc-wood)" />
      <path d="M0 20 Q80 14 160 20 T320 20 M0 70 Q90 76 180 70 T320 70 M0 120 Q70 114 150 120 T320 120 M0 165 Q100 170 200 165 T320 165" fill="none" stroke="#2a1608" strokeOpacity="0.2" strokeWidth="1.2" />
      <rect x="10" y="6" width="300" height="168" rx="12" fill="url(#ldc-paper)" stroke="#2a1608" strokeOpacity="0.5" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={i % 2 ? 232 : 22} y={i < 2 ? 14 : 98} width="66" height="68" rx="12" fill={colors[i]} />
          <rect x={i % 2 ? 232 : 22} y={i < 2 ? 14 : 98} width="66" height="68" rx="12" fill="url(#ldc-shade)" stroke="#000" strokeOpacity="0.35" />
          <rect x={(i % 2 ? 232 : 22) + 8} y={(i < 2 ? 14 : 98) + 8} width="50" height="52" rx="8" fill="#fffaf0" fillOpacity="0.88" />
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => <rect key={`h${i}`} x={61 + i * 22} y="81" width="18" height="18" rx="5" fill="url(#ldc-cell)" stroke="#3a2a1a" strokeWidth="1.5" />)}
      {Array.from({ length: 7 }, (_, i) => <rect key={`v${i}`} x="149" y={15 + i * 22} width="18" height="18" rx="5" fill="url(#ldc-cell)" stroke="#3a2a1a" strokeWidth="1.5" />)}
      {[[92, 90, 0], [158, 46, 1], [224, 90, 2], [158, 134, 3], [114, 90, 0], [55, 47, 1]].map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx="2.5" cy="5" rx="12" ry="9" fill="#000" opacity="0.4" filter="url(#ldc-blur)" />
          <circle r="12" fill={colors[c!]} stroke="#000" strokeOpacity="0.5" />
          <circle r="12" fill="url(#ldc-dome)" />
          <circle r="7.5" fill={colors[c!]} /><circle r="7.5" fill="url(#ldc-dome)" />
          <ellipse cx="-3" cy="-5" rx="3.5" ry="1.8" transform="rotate(-35 -3 -5)" fill="#fff" opacity="0.65" />
        </g>
      ))}
    </svg>
  );
}
