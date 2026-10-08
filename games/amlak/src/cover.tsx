// Catalog cover: dusk over Tehran (Alborz, Milad, Azadi) above a row of arch-banded street tiles, house and hotel (vector only).
import { Landmarks } from './board-art.tsx';

export default function AmlakCover({ title }: { title: string }) {
  const bands = ['#8b5a2b', '#8fd3f4', '#d63a8f', '#f28c28', '#d62f35', '#f2d22e', '#23843f'];
  const font = 'Estedad Variable, Vazirmatn, Tahoma, sans-serif';
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <linearGradient id="am-cv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fa6d6" /><stop offset="0.55" stopColor="#f8e3bd" /><stop offset="1" stopColor="#f3b97a" /></linearGradient>
        <radialGradient id="am-cv-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffe3a0" stopOpacity="0.95" /><stop offset="1" stopColor="#ffe3a0" stopOpacity="0" /></radialGradient>
        <pattern id="am-cv-arch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8V5a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" /></pattern>
      </defs>
      <rect width="320" height="180" fill="url(#am-cv-sky)" />
      <circle cx="160" cy="92" r="70" fill="url(#am-cv-sun)" />
      <path d="M0 112 L40 70 L74 94 L118 52 L160 96 L204 66 L250 98 L292 62 L320 90 V130 H0Z" fill="#b9c9de" opacity="0.8" />
      <path d="M0 126 L46 92 L86 112 L130 78 L176 116 L222 88 L270 116 L320 96 V140 H0Z" fill="#6f9aa6" />
      <path d="M118 52 L108 63 L116 66 L120 60 L127 67 L131 61Z M292 62 L283 71 L291 73 L296 68Z" fill="#fff" opacity="0.9" />
      <g transform="translate(160 118) scale(0.9)"><Landmarks fill="#1d3a5f" /></g>
      <text x="160" y="44" textAnchor="middle" fontSize="40" fontWeight="900" fill="#9b1c31" stroke="#fffaf0" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round" fontFamily={font}>املاک</text>
      <rect y="124" width="320" height="56" fill="#2a170a" />
      <rect y="124" width="320" height="3" fill="#c9a24a" />
      {bands.map((c, i) => (
        <g key={c} transform={`translate(${6 + i * 44} 134)`}>
          <rect width="40" height="44" fill="#fffaf0" stroke="#2a1d12" strokeWidth="2" />
          <rect x="1" y="1" width="38" height="14" fill={c} />
          <rect x="1" y="1" width="38" height="14" fill="url(#am-cv-arch)" />
        </g>
      ))}
      <g stroke="#1f1a14" strokeWidth="1.2"><path d="M96 158 v-8 h14 v8z" fill="#f6efe0" /><path d="M94 150 l9 -8 l9 8z" fill="#23843f" /></g>
      <g stroke="#1f1a14" strokeWidth="1.2"><path d="M232 160 v-10 h26 v10z" fill="#c8372d" /><path d="M230 150 l15 -9 l15 9z" fill="#c8372d" /></g>
    </svg>
  );
}
