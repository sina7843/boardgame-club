// Catalog cover art for sealed-bids: the private token hand 1–5 and a sealed bid under wax.
export default function SealedBidsCover({ title }: { title: string }) {
  const tokens = [1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <rect width="320" height="220" fill="#2a1d3f" />
      <g transform="translate(176 26) rotate(-8)">
        <rect width="112" height="132" rx="10" fill="#e9dcc4" />
        <path d="M0 10 56 66 112 10" fill="none" stroke="#c8b493" strokeWidth="3" />
        <circle cx="56" cy="74" r="24" fill="#9e2b3b" />
        <circle cx="56" cy="74" r="16" fill="none" stroke="#c9505f" strokeWidth="3" />
        <text x="56" y="81" textAnchor="middle" fontSize="20" fontWeight="800" fill="#f2c7cd" fontFamily="Vazirmatn, sans-serif">?</text>
      </g>
      {tokens.map((n, i) => (
        <g key={n} transform={`translate(${34 + i * 26} ${50 + (i % 2) * 18})`}>
          <circle r="22" cx="22" cy="22" fill="#1b2233" stroke="#d6ad60" strokeWidth="3" />
          <text x="22" y="30" textAnchor="middle" fontSize="20" fontWeight="800" fill="#f4f6fc" fontFamily="Vazirmatn, sans-serif">
            {n.toLocaleString('fa-IR')}
          </text>
        </g>
      ))}
      <rect x="30" y="140" width="140" height="6" rx="3" fill="#8b5cf6" opacity="0.6" />
    </svg>
  );
}
