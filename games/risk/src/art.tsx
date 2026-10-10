// RISK vector art: antique-map defs (engraved waves removed: the sea is a painted parchment), 3D army tokens carrying a painted miniature,
// compass rose, cartouche, ships and a sea serpent, card illustrations and dice. Decorative only: every part is
// aria-hidden or sits inside an element that carries the label.
import type { CardKind, ContinentId } from './board.ts';
import infantry from './art/infantry.webp';
import cavalry from './art/cavalry.webp';
import artillery from './art/artillery.webp';
import cardBack from './art/card-back.webp';
import parchment from './art/bd-parchment.webp';

// The miniatures, card back and parchment sea are painted WebP cut from a generated sheet (see DECISIONS.md).
const MINI: Record<'infantry' | 'cavalry' | 'artillery', string> = { infantry, cavalry, artillery };
export const CARD_BACK = cardBack;
/** The aged world-map parchment that lies under the territories (decorative). */
export function Parchment({ w, h }: { w: number; h: number }) {
  return <image href={parchment} width={w} height={h} preserveAspectRatio="xMidYMid slice" />;
}

/** Seat colours (always shown with the seat number and the colour name in text): [light, base, dark]. */
export const SEAT_SHADES: [string, string, string][] = [
  ['#ee7077', '#c62f3a', '#86161f'], ['#76a0f0', '#2a5bc4', '#143585'], ['#fffef6', '#efe8d6', '#b3a684'],
  ['#62626c', '#26262b', '#0b0b0e'], ['#f8d870', '#e2a91e', '#a06c00'], ['#68d6c3', '#1f9a87', '#0d5a4d']
];
export const SEAT_COLOR = SEAT_SHADES.map((s) => s[1]!);
export const SEAT_FA = ['قرمز', 'آبی', 'سفید', 'مشکی', 'زرد', 'سبزآبی'];
/** How strongly the owner colour washes over the continent tint. */
export const SEAT_WASH = [0.46, 0.46, 0.62, 0.52, 0.5, 0.46];

/** Continent watercolours (muted): [light, dark]. */
export const CONTINENT_TINT: Record<ContinentId, [string, string]> = {
  na: ['#ead7a0', '#d2b46c'], sa: ['#e6bba0', '#cf9274'], eu: ['#cbd0dc', '#a3afc8'],
  af: ['#ecd0a6', '#d4a86f'], as: ['#cdd8aa', '#a6ba7c'], au: ['#dfc6d6', '#bf9db6']
};
export const INK = '#3a2a16';

export function MapDefs() {
  return (
    <defs>
      <linearGradient id="rkm-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset="0.5" stopColor="#d9a62e" /><stop offset="1" stopColor="#8d6210" /></linearGradient>
      {(Object.keys(CONTINENT_TINT) as ContinentId[]).map((c) => (
        <linearGradient key={c} id={`rkm-c-${c}`} x1="0" y1="0" x2="0.7" y2="1"><stop offset="0" stopColor={CONTINENT_TINT[c][0]} /><stop offset="1" stopColor={CONTINENT_TINT[c][1]} /></linearGradient>
      ))}
      {SEAT_SHADES.map(([l, b, d], i) => (
        <radialGradient key={i} id={`rkm-tok-${i}`} cx="35%" cy="28%" r="80%"><stop offset="0" stopColor={l} /><stop offset="0.55" stopColor={b} /><stop offset="1" stopColor={d} /></radialGradient>
      ))}
      {/* Paper fibres and speckles over the land. */}
      <pattern id="rkm-paper" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="5" r="0.7" fill="#5a3b14" fillOpacity="0.2" /><circle cx="15" cy="13" r="0.6" fill="#5a3b14" fillOpacity="0.16" />
        <circle cx="10" cy="19" r="0.5" fill="#fff" fillOpacity="0.4" /><path d="M1 15 q4 -1.5 8 0" stroke="#5a3b14" strokeOpacity="0.1" strokeWidth="0.6" fill="none" />
      </pattern>
      <linearGradient id="rkm-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.3" /></linearGradient>
      <radialGradient id="rkm-vignette" cx="50%" cy="50%" r="72%"><stop offset="0.62" stopColor="#5a3b14" stopOpacity="0" /><stop offset="1" stopColor="#5a3b14" stopOpacity="0.38" /></radialGradient>
      <filter id="rkm-land" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1" dy="2" stdDeviation="1.6" floodColor="#1c3a3c" floodOpacity="0.45" /></filter>
      <filter id="rkm-soft" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0.6" dy="1.4" stdDeviation="1" floodColor="#000" floodOpacity="0.5" /></filter>
      <marker id="rkm-arrow" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse" markerUnits="strokeWidth">
        <path d="M0 0 L10 5 L0 10 L3 5 Z" fill="#8f1d16" stroke="#fff5d6" strokeWidth="1.4" strokeLinejoin="round" paintOrder="stroke" />
      </marker>
    </defs>
  );
}

/** Compass rose (decorative), drawn at the origin, radius ~38. */
export function Compass() {
  const star = (len: number, w: number, rot: number, dark: boolean) => (
    <g transform={`rotate(${rot})`}>
      <path d={`M0 ${-len} L${w} 0 L0 0 Z M0 ${len} L${-w} 0 L0 0 Z M${-len} 0 L0 ${-w} L0 0 Z M${len} 0 L0 ${w} L0 0 Z`} fill={dark ? INK : '#f3e7c6'} stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
      <path d={`M0 ${-len} L${-w} 0 L0 0 Z M0 ${len} L${w} 0 L0 0 Z M${-len} 0 L0 ${w} L0 0 Z M${len} 0 L0 ${-w} L0 0 Z`} fill={dark ? '#f3e7c6' : INK} stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
    </g>
  );
  return (
    <g aria-hidden="true" pointerEvents="none" opacity="0.92">
      <circle r="34" fill="#f3e7c6" fillOpacity="0.28" stroke={INK} strokeWidth="1.1" />
      <circle r="29" fill="none" stroke={INK} strokeWidth="0.7" strokeDasharray="1.5 2.6" />
      {star(26, 5.5, 45, false)}
      {star(38, 6.5, 0, true)}
      <circle r="3.4" fill="#d9a62e" stroke={INK} strokeWidth="0.9" />
      <text y="-41" fontSize="11" fontWeight="900" fill={INK} textAnchor="middle">ش</text>
    </g>
  );
}

/** Ornate title cartouche (decorative), centred on the origin, 168 x 58. */
export function Cartouche({ title }: { title: string }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d="M-84 -29 H84 Q90 -29 90 -23 V23 Q90 29 84 29 H-84 Q-90 29 -90 23 V-23 Q-90 -29 -84 -29 Z" fill="#00000026" transform="translate(1.5 3)" />
      <path d="M-82 -27 H82 Q88 -27 88 -21 V21 Q88 27 82 27 H-82 Q-88 27 -88 21 V-21 Q-88 -27 -82 -27 Z" fill="#f1e4c0" stroke={INK} strokeWidth="1.8" />
      <path d="M-78 -23 H78 Q84 -23 84 -17 V17 Q84 23 78 23 H-78 Q-84 23 -84 17 V-17 Q-84 -23 -78 -23 Z" fill="none" stroke={INK} strokeWidth="0.8" />
      {[[-88, -27], [88, -27], [-88, 27], [88, 27]].map(([x, y]) => <g key={`${x}${y}`} transform={`translate(${x} ${y})`}><circle r="6.5" fill="url(#rkm-gold)" stroke={INK} strokeWidth="1.1" /><circle r="2.4" fill="#f1e4c0" stroke={INK} strokeWidth="0.7" /></g>)}
      <path d="M-62 12 H62" stroke={INK} strokeWidth="0.8" strokeDasharray="1 3" />
      <path d="M-14 13 q14 -6 28 0" fill="none" stroke={INK} strokeWidth="1" />
      <text y="6" fontSize="31" fontWeight="900" fill={INK} textAnchor="middle" stroke="#f1e4c0" strokeWidth="2" paintOrder="stroke">{title}</text>
    </g>
  );
}

/** A tiny galleon (decorative), about 46 wide. */
export function Ship() {
  return (
    <g aria-hidden="true" pointerEvents="none" opacity="0.62" stroke={INK} strokeWidth="0.9" strokeLinejoin="round">
      <path d="M-22 4 H22 L16 13 H-15 Z" fill="#a98458" />
      <path d="M-26 -2 Q-22 0 -22 4 M26 -4 Q22 0 22 4" fill="none" />
      <path d="M0 4 V-26 M-11 4 V-14 M11 4 V-16" fill="none" strokeWidth="1.2" />
      <path d="M-9 -24 Q6 -18 9 -6 H-9 Z M-19 -12 Q-11 -8 -9 0 H-19 Z M3 -14 Q16 -10 19 0 H3 Z" fill="#f6ecd0" />
      <path d="M0 -26 L8 -23 L0 -20 Z" fill="#b3261e" />
      <path d="M-30 15 q5 -3.5 10 0 t10 0 t10 0 t10 0 t10 0" fill="none" strokeOpacity="0.7" />
    </g>
  );
}

/** A sea serpent (decorative), about 70 wide. */
export function Serpent() {
  return (
    <g aria-hidden="true" pointerEvents="none" opacity="0.55" stroke={INK} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="#7d9a73">
      <path d="M-34 8 q6 -18 12 0 q6 -18 12 0 q6 -22 14 -4 q4 -14 14 -16 l5 -4 l1 6 l-6 3 q-6 12 -9 14 q-3 -14 -8 -2 q-6 -16 -12 2 q-6 -16 -12 0 Z" />
      <circle cx="19" cy="-10" r="1" fill={INK} />
      <path d="M-40 11 q5 -3.5 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0" fill="none" strokeOpacity="0.7" />
    </g>
  );
}

/**
 * Army token: a 3D disc (rim, edge, bevel) in the owner's colour with the army count in big Persian digits and a
 * small ivory seat tab. `r` is the disc radius in map units.
 */
export function ArmyToken({ seat, n, r = 14, lift = false }: { seat: number; n: number; r?: number; lift?: boolean }) {
  const dark = SEAT_SHADES[seat]?.[2] ?? '#333';
  const mini = MINI[n >= 10 ? 'artillery' : n >= 5 ? 'cavalry' : 'infantry'];
  return (
    <g className="rk-token" transform={lift ? `translate(0 ${(-r * 0.25).toFixed(1)})` : undefined}>
      <ellipse cx={r * 0.12} cy={r * 0.82 + 2} rx={r * 1.05} ry={r * 0.45} fill="#1c1208" opacity="0.4" />
      <circle cy={r * 0.22} r={r} fill={dark} stroke="#140d05" strokeWidth={r * 0.1} />
      <circle r={r} fill={`url(#rkm-tok-${seat})`} stroke="#140d05" strokeWidth={r * 0.1} />
      <circle r={r} fill="url(#rkm-shine)" />
      <image href={mini} x={-r * 0.85} y={-r * 1.05} width={r * 1.7} height={r * 1.7} />
      <g transform={`translate(0 ${(r * 0.72).toFixed(1)})`}>
        <rect x={-r * 0.62} y={-r * 0.36} width={r * 1.24} height={r * 0.72} rx={r * 0.36} fill="#fbf3dc" stroke="#140d05" strokeWidth={r * 0.08} />
        <text y={r * 0.26} fontSize={r * 0.82} className="rk-token__n" fill={INK}>{n.toLocaleString('fa-IR')}</text>
      </g>
      <g transform={`translate(${(r * 0.8).toFixed(1)} ${(-r * 0.8).toFixed(1)})`}>
        <circle r={r * 0.42} fill="#fbf3dc" stroke="#140d05" strokeWidth={r * 0.08} />
        <text y={r * 0.15} fontSize={r * 0.5} className="rk-token__seat">{(seat + 1).toLocaleString('fa-IR')}</text>
      </g>
    </g>
  );
}

const STROKE = '#2a2520';
/** Card illustration (24×24): pewter miniature for infantry, cavalry, artillery; a star for the wild card. */
export function CardIcon({ kind }: { kind: CardKind }) {
  if (kind !== 'wild') return <img src={MINI[kind]} alt="" aria-hidden="true" className="rk-ico rk-ico--mini" />;
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false as const, className: 'rk-ico' };
  switch (kind) {
    case 'wild': return (
      <svg {...common}>
        <path d="M12 2 L14.6 8.6 L21.6 9 L16.2 13.4 L18 20.4 L12 16.5 L6 20.4 L7.8 13.4 L2.4 9 L9.4 8.6 Z" fill="#e2b020" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M12 5.5 L13.5 9.5 L17.5 9.8" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
}

/** Small panel icons (decorative): territories (flag), armies (crossed swords), cards (card). */
export function StatIcon({ kind }: { kind: 'terr' | 'army' | 'card' }) {
  const p = { viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false as const, className: 'rk-stat__ico', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'terr') return <svg {...p}><path d="M4 14 V2.5 M4 3 H12 L10.2 5.6 L12 8.2 H4" /></svg>;
  if (kind === 'army') return <svg {...p}><path d="M3 3 L12.5 12.5 M13 3 L3.5 12.5 M2.5 11 L5 13.5 M13.5 11 L11 13.5" /></svg>;
  return <img src={cardBack} alt="" aria-hidden="true" className="rk-stat__ico rk-stat__ico--card" />;
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** CSS die with visible thickness; attacker dice are red, defender dice ivory. Decorative: the tray carries the label. */
export function DieFace({ value, side }: { value: number; side: 'att' | 'def' }) {
  return (
    <span aria-hidden="true" className={`rk-die rk-die--${side}`}>
      {Array.from({ length: 9 }, (_, k) => (PIPS[value]?.includes(k) ? <i key={k} className="rk-die__pip" data-pip /> : <i key={k} />))}
    </span>
  );
}
