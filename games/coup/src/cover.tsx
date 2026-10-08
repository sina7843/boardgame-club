// Catalog cover: palace intrigue — a fan of court cards on plum velvet, one face down, and a pile of gold coins.
// Portraits and coins are cut from a generated sheet (see DECISIONS.md).
import duke from './art/coup-duke.webp';
import contessa from './art/coup-contessa.webp';
import coins from './art/coins.webp';
export default function CoupCover({ title }: { title: string }) {
  const card = (x: number, rot: number, fill: string, k: string, art?: string) => (
    <g key={k} transform={`translate(${x} 96) rotate(${rot})`} filter="url(#cpc-sh)">
      <rect x="-30" y="-44" width="60" height="88" rx="7" fill={fill} stroke="#1a0d16" strokeWidth="2" />
      <rect x="-25" y="-39" width="50" height="78" rx="4" fill="none" stroke="#e3bd6b" strokeWidth="1.6" />
      {art ? <image href={art} x="-25" y="-39" width="50" height="50" preserveAspectRatio="xMidYMid slice" /> : <path d="M0 -24 L18 0 L0 24 L-18 0 Z M0 -12 L9 0 L0 12 L-9 0 Z" fill="rgb(227 189 107 / .6)" fillRule="evenodd" />}
    </g>
  );
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ inlineSize: '100%', blockSize: '100%', direction: 'ltr' }}>
      <defs>
        <radialGradient id="cpc-bg" cx=".5" cy=".35" r=".85"><stop offset="0" stopColor="#5a2348" /><stop offset="1" stopColor="#1c0a17" /></radialGradient>
        <filter id="cpc-sh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity=".6" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#cpc-bg)" />
      {card(98, -16, '#4a1f3c', 'back')}
      {card(140, -5, '#7b3fa0', 'duke', duke)}
      {card(182, 7, '#b8323f', 'contessa', contessa)}
      <image href={coins} x="222" y="76" width="68" height="68" preserveAspectRatio="xMidYMid slice" filter="url(#cpc-sh)" />
    </svg>
  );
}
