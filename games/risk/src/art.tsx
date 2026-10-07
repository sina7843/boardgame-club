// RISK vector art: map defs (ocean, waves, wood frame, parchment, continent tints, shadows), 3D army tokens,
// card illustrations and dice. Decorative only: every part is aria-hidden or inside an element that carries the label.
import type { CardKind, ContinentId } from './board.ts';

/** Seat colours (always shown with the seat number and the colour name in text). */
export const SEAT_COLOR = ['#c62f3a', '#2a5bc4', '#efe8d6', '#26262b', '#e2a91e', '#1f9a87'];
export const SEAT_INK = ['#fff', '#fff', '#2a2520', '#fff', '#2a2520', '#fff'];
export const SEAT_FA = ['قرمز', 'آبی', 'سفید', 'مشکی', 'زرد', 'سبزآبی'];

/** Continent tints on parchment: [light, dark]. */
export const CONTINENT_TINT: Record<ContinentId, [string, string]> = {
  na: ['#ecc977', '#c99a3b'], sa: ['#e09878', '#b8603f'], eu: ['#a7bfdc', '#6d8db5'],
  af: ['#e2b884', '#b98549'], as: ['#b2cc8c', '#7c9d58'], au: ['#c8acd6', '#9677ab']
};

export function MapDefs() {
  return (
    <defs>
      <radialGradient id="rkm-sea" cx="50%" cy="45%" r="80%"><stop offset="0" stopColor="#4c9cc2" /><stop offset="0.55" stopColor="#2d6f93" /><stop offset="1" stopColor="#174b68" /></radialGradient>
      <pattern id="rkm-waves" width="34" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 8 Q8.5 2 17 8 T34 8" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1.1" />
        <path d="M-8.5 16 Q0 12 8.5 16 T25.5 16 T42.5 16" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1" />
      </pattern>
      <linearGradient id="rkm-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b98251" /><stop offset="0.5" stopColor="#7d5029" /><stop offset="1" stopColor="#5a3819" /></linearGradient>
      <pattern id="rkm-grain" width="70" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
        <path d="M0 2 H70" stroke="#2c1706" strokeOpacity="0.28" strokeWidth="0.7" />
        <path d="M0 5 Q17 3.6 35 5 T70 5" fill="none" stroke="#e8c08c" strokeOpacity="0.2" strokeWidth="0.8" />
      </pattern>
      <radialGradient id="rkm-brass" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff2b8" /><stop offset="0.5" stopColor="#d1a23c" /><stop offset="1" stopColor="#7a5a14" /></radialGradient>
      {(Object.keys(CONTINENT_TINT) as ContinentId[]).map((c) => (
        <linearGradient key={c} id={`rkm-c-${c}`} x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor={CONTINENT_TINT[c][0]} /><stop offset="1" stopColor={CONTINENT_TINT[c][1]} /></linearGradient>
      ))}
      {/* Parchment fibres and speckles over the land. */}
      <pattern id="rkm-paper" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="5" r="0.7" fill="#5a3b14" fillOpacity="0.22" /><circle cx="15" cy="13" r="0.6" fill="#5a3b14" fillOpacity="0.18" />
        <circle cx="10" cy="19" r="0.5" fill="#fff" fillOpacity="0.35" /><path d="M1 15 q4 -1.5 8 0" stroke="#5a3b14" strokeOpacity="0.12" strokeWidth="0.6" fill="none" />
      </pattern>
      <linearGradient id="rkm-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></linearGradient>
      <radialGradient id="rkm-vignette" cx="50%" cy="50%" r="70%"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></radialGradient>
      <filter id="rkm-land" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" floodColor="#04263a" floodOpacity="0.55" /></filter>
      <filter id="rkm-soft" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0.6" dy="1.5" stdDeviation="1" floodColor="#000" floodOpacity="0.5" /></filter>
      <marker id="rkm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="#fff5d6" stroke="#7a1414" strokeWidth="1.2" strokeLinejoin="round" />
      </marker>
    </defs>
  );
}

/** Compass rose (decorative), drawn at the origin, radius ~34. */
export function Compass() {
  return (
    <g className="rk-compass" aria-hidden="true" pointerEvents="none">
      <circle r="30" fill="none" stroke="#f6efdc" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle r="24" fill="none" stroke="#f6efdc" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 3" />
      <path d="M0 -36 L5 -5 L0 0 Z M0 36 L-5 5 L0 0 Z M-36 0 L-5 -5 L0 0 Z M36 0 L5 5 L0 0 Z" fill="#f6efdc" fillOpacity="0.85" />
      <path d="M0 -36 L-5 -5 L0 0 Z M0 36 L5 5 L0 0 Z M-36 0 L-5 5 L0 0 Z M36 0 L5 -5 L0 0 Z" fill="#c8a35a" fillOpacity="0.85" />
      <text y="-40" className="rk-compass__n">N</text>
    </g>
  );
}

/** 3D poker-chip style army token in the owner's colour: count in the middle, seat number on the rim tab. */
export function ArmyToken({ seat, n, big }: { seat: number; n: number; big?: boolean }) {
  const r = big ? 13 : 11.5;
  const color = SEAT_COLOR[seat] ?? '#888';
  const ink = SEAT_INK[seat] ?? '#fff';
  return (
    <g className="rk-token">
      <ellipse cx="1.2" cy={r * 0.62 + 2.6} rx={r * 1.02} ry={r * 0.42} fill="#000" opacity="0.38" />
      {/* side of the chip */}
      <circle cy="3" r={r} fill={color} stroke="#14110d" strokeWidth="1.3" />
      <circle cy="3" r={r} fill="#000" opacity="0.32" />
      {/* top face */}
      <circle r={r} fill={color} stroke="#14110d" strokeWidth="1.3" />
      <circle r={r - 2.6} fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.1" strokeDasharray="3 2.4" />
      <circle r={r} fill="url(#rkm-shine)" />
      <text y="4" className="rk-token__n" fill={ink} stroke={ink === '#fff' ? 'rgb(0 0 0 / 0.55)' : 'rgb(255 255 255 / 0.6)'}>{n.toLocaleString('fa-IR')}</text>
      <g transform={`translate(${r * 0.78} ${-r * 0.78})`}>
        <circle r="5.6" fill="#fbf5e4" stroke="#14110d" strokeWidth="1" />
        <text y="2.6" className="rk-token__seat">{(seat + 1).toLocaleString('fa-IR')}</text>
      </g>
    </g>
  );
}

const STROKE = '#2a2520';
/** Card illustration (24×24): infantry soldier, cavalry horse, artillery cannon, wild star. */
export function CardIcon({ kind }: { kind: CardKind }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false as const, className: 'rk-ico' };
  switch (kind) {
    case 'infantry': return (
      <svg {...common}>
        <circle cx="11" cy="5" r="2.6" fill="#e8c39a" stroke={STROKE} strokeWidth="0.9" />
        <path d="M8.2 4.2 Q11 0.8 13.8 4.2 Z" fill="#4f6b3a" stroke={STROKE} strokeWidth="0.8" />
        <path d="M7.5 9 Q11 7.2 14.5 9 L14 15 H8 Z" fill="#5d7a43" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8.5 15 L7.6 22 H10 L11 16.5 L12 22 H14.4 L13.5 15 Z" fill="#3f5530" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M16.5 2.5 L16.5 17" stroke="#6b4423" strokeWidth="1.5" strokeLinecap="round" /><path d="M16.5 1.5 L16.5 3.5" stroke="#9aa3ad" strokeWidth="1.2" />
        <path d="M14 10.5 L16.5 9.5" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
    case 'cavalry': return (
      <svg {...common}>
        <path d="M5 21 L6.5 13 Q5 9 8 6 L10 3 L11 5.5 Q15 4.5 17.5 8 L20 11.5 Q20.6 13 19 13.4 L16.6 12.4 Q15 13.6 14 15.5 L15 21 Z" fill="#8a5a2b" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 6 Q6.5 10 7.2 14 M10 3 Q8.5 7 9 11" fill="none" stroke="#3a2412" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="15.4" cy="8.4" r="0.9" fill={STROKE} />
        <path d="M17.5 8 Q15 10 13 9.5" fill="none" stroke="#c8a35a" strokeWidth="0.9" />
      </svg>
    );
    case 'artillery': return (
      <svg {...common}>
        <path d="M3 13.5 L17.5 6.5 L19 9.5 L5 16.5 Z" fill="#4c5260" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M4 14 L17.8 7.3" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.9" />
        <ellipse cx="18.4" cy="8" rx="1.3" ry="1.9" transform="rotate(-26 18.4 8)" fill="#1b1611" />
        <circle cx="9" cy="17" r="4.6" fill="#8a5a2b" stroke={STROKE} strokeWidth="0.9" />
        <circle cx="9" cy="17" r="1.3" fill="#c8a35a" stroke={STROKE} strokeWidth="0.6" />
        <path d="M9 12.4 V21.6 M4.4 17 H13.6 M5.8 13.8 L12.2 20.2 M12.2 13.8 L5.8 20.2" stroke={STROKE} strokeWidth="0.7" />
        <circle cx="20" cy="19.5" r="1.4" fill="#2a2520" /><circle cx="17.4" cy="20.2" r="1.4" fill="#2a2520" /><circle cx="18.7" cy="17.9" r="1.4" fill="#2a2520" />
      </svg>
    );
    case 'wild': return (
      <svg {...common}>
        <path d="M12 2 L14.6 8.6 L21.6 9 L16.2 13.4 L18 20.4 L12 16.5 L6 20.4 L7.8 13.4 L2.4 9 L9.4 8.6 Z" fill="#e2b020" stroke={STROKE} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M12 5.5 L13.5 9.5 L17.5 9.8" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** CSS die face; attacker dice are red, defender dice ivory. Decorative: the tray carries the label. */
export function DieFace({ value, side }: { value: number; side: 'att' | 'def' }) {
  return (
    <span aria-hidden="true" className={`rk-die rk-die--${side}`}>
      {Array.from({ length: 9 }, (_, k) => <i key={k} className={PIPS[value]?.includes(k) ? 'rk-die__pip' : ''} />)}
    </span>
  );
}
