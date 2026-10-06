// Catalog cover: a fanned hand of four original card faces on felt (vector only).
export default function UnoCover({ title }: { title: string }) {
  const cards = [
    { x: 92, r: -24, fill: '#d62f35', label: '۷' },
    { x: 128, r: -8, fill: '#f2c230', label: '+۲', dark: true },
    { x: 164, r: 8, fill: '#23843f', label: '۰' },
    { x: 200, r: 24, fill: '#1c63c9', label: '۹' }
  ];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="uno-felt" cx="50%" cy="40%" r="75%"><stop offset="0" stopColor="#1f4d41" /><stop offset="1" stopColor="#10291f" /></radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#uno-felt)" />
      {cards.map((c) => (
        <g key={c.x} transform={`rotate(${c.r} ${c.x + 26} 170)`}>
          <rect x={c.x} y="42" width="52" height="78" rx="8" fill={c.fill} stroke="#fff" strokeWidth="4" />
          <ellipse cx={c.x + 26} cy="81" rx="18" ry="30" fill="#fff" transform={`rotate(-28 ${c.x + 26} 81)`} />
          <text x={c.x + 26} y="90" textAnchor="middle" fontSize="24" fontWeight="900" fill={c.dark ? '#8a6a00' : c.fill} fontFamily="Vazirmatn, Tahoma, sans-serif">{c.label}</text>
        </g>
      ))}
      <g transform="rotate(-10 262 70)">
        <rect x="236" y="30" width="52" height="78" rx="8" fill="#17131f" stroke="#fff" strokeWidth="4" />
        <path d="M262 69 L262 49 A20 20 0 0 1 282 69 Z" fill="#d62f35" />
        <path d="M262 69 L282 69 A20 20 0 0 1 262 89 Z" fill="#1c63c9" />
        <path d="M262 69 L262 89 A20 20 0 0 1 242 69 Z" fill="#f2c230" />
        <path d="M262 69 L242 69 A20 20 0 0 1 262 49 Z" fill="#23843f" />
      </g>
    </svg>
  );
}
