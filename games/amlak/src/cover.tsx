// Catalog cover: a corner of the «املاک» board with colour bands, a house and a hotel (vector only).
export default function AmlakCover({ title }: { title: string }) {
  const bands = ['#8b5a2b', '#8fd3f4', '#d63a8f', '#f28c28', '#d62f35', '#f2d22e', '#23843f'];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <rect width="320" height="180" fill="#e9f2e4" />
      {bands.map((c, i) => (
        <g key={c} transform={`translate(${8 + i * 44} 112)`}>
          <rect width="40" height="60" fill="#fffaf0" stroke="#2a1d12" strokeWidth="2" />
          <rect x="2" y="2" width="36" height="14" fill={c} />
        </g>
      ))}
      <text x="160" y="72" textAnchor="middle" fontSize="54" fontWeight="900" fill="#8b1e2d" fontFamily="Estedad Variable, Vazirmatn, Tahoma, sans-serif">املاک</text>
      <rect x="100" y="118" width="12" height="10" fill="#23843f" stroke="#fff" strokeWidth="1.5" />
      <rect x="116" y="118" width="12" height="10" fill="#23843f" stroke="#fff" strokeWidth="1.5" />
      <rect x="226" y="117" width="26" height="11" rx="2" fill="#d62f35" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
