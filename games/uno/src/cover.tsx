// Catalog cover: a fanned hand of original card faces on felt (vector only), lit from the top-left.
export default function UnoCover({ title }: { title: string }) {
  const cards = [
    { x: 92, r: -24, fill: '#d62f35', ink: '#d62f35', label: '۷' },
    { x: 128, r: -8, fill: '#f2c230', ink: '#8a6a00', label: '+۲' },
    { x: 164, r: 8, fill: '#23843f', ink: '#23843f', label: '۰' },
    { x: 200, r: 24, fill: '#1c63c9', ink: '#1c63c9', label: '۹' }
  ];
  const font = 'Estedad Variable, Vazirmatn, Tahoma, sans-serif';
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="uno-felt" cx="50%" cy="40%" r="75%"><stop offset="0" stopColor="#3a2b82" /><stop offset="0.6" stopColor="#1b1540" /><stop offset="1" stopColor="#0c0820" /></radialGradient>
        <pattern id="uno-weave" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1" fill="#fff" fillOpacity="0.09" /></pattern>
        <linearGradient id="uno-gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.4" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></linearGradient>
        <radialGradient id="uno-oval" cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#e4dfd0" /></radialGradient>
        <filter id="uno-drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="1.5" dy="4" stdDeviation="3" floodOpacity="0.5" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#uno-felt)" />
      <rect width="320" height="180" fill="url(#uno-weave)" />
      <g stroke="#f2c230" strokeOpacity="0.07" strokeWidth="14">{Array.from({ length: 12 }, (_, k) => <path key={k} d={`M160 150 L${160 + 300 * Math.cos((k * 30 * Math.PI) / 180)} ${150 + 300 * Math.sin((k * 30 * Math.PI) / 180)}`} />)}</g>
      <g fill="none" stroke="#fdf6e3" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round"><circle cx="160" cy="92" r="84" strokeDasharray="230 40" /></g>
      <path d="M232 38 250 36 244 54Z" fill="#fdf6e3" fillOpacity="0.8" /><path d="M88 146 70 148 76 130Z" fill="#fdf6e3" fillOpacity="0.8" />
      {/* draw pile */}
      {[6, 4, 2, 0].map((o) => <rect key={o} x={30 + o} y={64 + o} width="48" height="72" rx="7" fill="#15102e" stroke="#fdf6e3" strokeWidth="3" />)}
      <ellipse cx="54" cy="100" rx="14" ry="21" fill="#d62f35" stroke="#fdf6e3" strokeWidth="2" transform="rotate(-28 54 100)" />
      {cards.map((c) => (
        <g key={c.x} transform={`rotate(${c.r} ${c.x + 26} 170)`} filter="url(#uno-drop)">
          <rect x={c.x} y="42" width="52" height="78" rx="8" fill={c.fill} stroke="#fdf6e3" strokeWidth="4" />
          <rect x={c.x} y="42" width="52" height="78" rx="8" fill="url(#uno-gloss)" />
          <ellipse cx={c.x + 26} cy="81" rx="18" ry="30" fill="url(#uno-oval)" transform={`rotate(-28 ${c.x + 26} 81)`} />
          <text x={c.x + 26} y="90" textAnchor="middle" fontSize="24" fontWeight="900" fill={c.ink} fontFamily={font}>{c.label}</text>
          <text x={c.x + 8} y="58" fontSize="9" fontWeight="900" fill={c.fill === '#f2c230' ? '#1b1300' : '#fff'} fontFamily={font}>{c.label}</text>
        </g>
      ))}
      <g transform="rotate(-10 262 70)" filter="url(#uno-drop)">
        <rect x="236" y="30" width="52" height="78" rx="8" fill="#17131f" stroke="#fdf6e3" strokeWidth="4" />
        <ellipse cx="262" cy="69" rx="18" ry="30" fill="#2a2338" transform="rotate(-28 262 69)" />
        <path d="M262 69 L262 49 A20 20 0 0 1 282 69 Z" fill="#d62f35" />
        <path d="M262 69 L282 69 A20 20 0 0 1 262 89 Z" fill="#1c63c9" />
        <path d="M262 69 L262 89 A20 20 0 0 1 242 69 Z" fill="#f2c230" />
        <path d="M262 69 L242 69 A20 20 0 0 1 262 49 Z" fill="#23843f" />
        <circle cx="262" cy="69" r="20" fill="none" stroke="#fff" strokeWidth="1.5" />
        <rect x="236" y="30" width="52" height="78" rx="8" fill="url(#uno-gloss)" />
      </g>
    </svg>
  );
}
