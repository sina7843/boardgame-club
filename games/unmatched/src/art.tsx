// Unmatched vector art, all drawn in code (no raster images): battlefield scenery per map, hero / sidekick emblems and
// card-type emblems. Everything here is decorative: callers mark it aria-hidden and keep the accessible text themselves.
import type { ReactNode } from 'react';

const INK = '#1d1812', SKIN = '#f2cf9f', GOLD = '#f0b72a', STEEL = '#d7dde3', PAPER = '#f6efdc';

// ---------- emblems (drawn inside a -30..30 box) ----------

const Snake = ({ d }: { d: string }) => <><path d={d} fill="none" stroke={INK} strokeWidth="5.6" /><path d={d} fill="none" stroke="#4aa14f" strokeWidth="3" /></>;
const Wing = ({ c }: { c: string }) => <path d="M-3 6 Q-12 -16 -28 -15 Q-22 -9 -26 -4 Q-20 -2 -22 4 Q-14 4 -12 13 Z" fill={c} />;

const EMBLEMS: Record<string, (c: string) => ReactNode> = {
  arthur: (c) => <>
    <path d="M-3 8 H3 V24 L0 28 L-3 24Z" fill={STEEL} /><rect x="-12" y="4" width="24" height="5" rx="2" fill={GOLD} />
    <path d="M-14 -8 L-15 -25 L-8 -18 L0 -28 L8 -18 L15 -25 L14 -8Z" fill={GOLD} /><rect x="-14" y="-10" width="28" height="6" rx="1.5" fill={c} />
    <circle cx="0" cy="-17" r="2.3" fill={c} />
  </>,
  merlin: (c) => <>
    <path d="M-18 12 L-5 -20 Q0 -29 10 -22 Q4 -14 8 -2 L18 12Z" fill={c} /><ellipse cx="0" cy="12" rx="23" ry="5.5" fill={c} />
    <path d="M-13 6 Q0 10 14 6" fill="none" stroke={GOLD} strokeWidth="4" /><circle cx="0" cy="-5" r="3.4" fill={GOLD} />
    <path d="M22 -2 L27 28" stroke={INK} strokeWidth="4" /><circle cx="21" cy="-5" r="4.4" fill={GOLD} />
  </>,
  medusa: () => <>
    <Snake d="M-6 -2 Q-19 -8 -13 -19 Q-8 -25 -15 -28" /><Snake d="M-2 -4 Q-8 -14 -2 -22 Q2 -27 -3 -29" /><Snake d="M3 -4 Q9 -14 3 -22 Q0 -27 5 -29" />
    <Snake d="M7 -2 Q19 -8 13 -19 Q8 -25 15 -28" /><Snake d="M-9 4 Q-24 2 -25 -8" /><Snake d="M9 4 Q24 2 25 -8" />
    <circle cx="0" cy="7" r="12" fill="#bfe3a0" /><circle cx="-4.5" cy="5" r="2.4" fill="#fff" /><circle cx="4.5" cy="5" r="2.4" fill="#fff" />
    <circle cx="-4.5" cy="5" r="1.1" fill={INK} /><circle cx="4.5" cy="5" r="1.1" fill={INK} /><path d="M-4 12 Q0 15 4 12" fill="none" />
  </>,
  harpy: (c) => <><Wing c={c} /><g transform="scale(-1 1)"><Wing c={c} /></g><circle cx="0" cy="-3" r="7.5" fill={SKIN} /><path d="M-3 22 L0 14 L3 22 M-8 20 L-5 13 M8 20 L5 13" fill="none" /><circle cx="-2.5" cy="-4" r="1.2" fill={INK} /><circle cx="2.5" cy="-4" r="1.2" fill={INK} /></>,
  sinbad: (c) => <>
    <path d="M-15 -2 Q-16 -21 0 -21 Q16 -21 15 -2 Q0 4 -15 -2Z" fill={PAPER} /><path d="M-14 -6 Q0 0 14 -6 M-10 -14 Q0 -8 12 -14" fill="none" stroke={c} strokeWidth="3" />
    <circle cx="0" cy="-13" r="3.6" fill="#d42a3a" /><path d="M0 -21 Q4 -29 9 -27" fill="none" stroke={GOLD} strokeWidth="3" />
    <circle cx="0" cy="8" r="9.5" fill={SKIN} /><path d="M-6 13 Q0 21 6 13" fill="#3a2a20" />
    <path d="M13 28 Q31 12 22 -10" fill="none" stroke={INK} strokeWidth="6" /><path d="M13 28 Q31 12 22 -10" fill="none" stroke={STEEL} strokeWidth="3" />
  </>,
  porter: (c) => <>
    <rect x="-16" y="-4" width="32" height="26" rx="3" fill="#c0935a" /><path d="M-16 5 H16 M-16 14 H16 M0 -4 V22" fill="none" stroke="#7a5528" strokeWidth="2" />
    <path d="M-16 -4 L16 22 M16 -4 L-16 22" fill="none" stroke={c} strokeWidth="3.4" />
    <circle cx="0" cy="-13" r="8" fill={SKIN} /><path d="M-9 -15 Q0 -26 9 -15Z" fill={c} /><path d="M-10 -15 H12" fill="none" />
  </>,
  alice: (c) => <>
    <path d="M-4 -3 L4 -3 L17 23 H-17Z" fill="#8ec9ff" /><path d="M-3 0 L3 0 L8 23 H-8Z" fill={PAPER} />
    <path d="M-10 -14 Q-12 -4 -7 0 M10 -14 Q12 -4 7 0" fill="none" stroke="#e0b23a" strokeWidth="5" />
    <circle cx="0" cy="-12" r="8" fill={SKIN} /><path d="M-8 -14 Q0 -24 8 -14 Q0 -17 -8 -14Z" fill="#e0b23a" />
    <path d="M0 -22 L-9 -28 V-17Z M0 -22 L9 -28 V-17Z" fill={c} /><circle cx="0" cy="-22" r="2.4" fill={c} />
  </>,
  jabberwock: (c) => <>
    <path d="M-25 -2 Q-8 -24 14 -15 L27 -4 L10 0Z" fill={c} /><path d="M-22 5 Q0 24 25 9 L14 2Z" fill={c} />
    <path d="M12 -1 L15 5 L18 -1 L21 5 L24 0 M-4 3 L-1 -3 L3 3" fill={PAPER} /><path d="M-10 -14 L-14 -27 L-4 -18Z" fill={GOLD} />
    <circle cx="-3" cy="-8" r="3.6" fill="#fff" /><circle cx="-3" cy="-8" r="1.5" fill="#d42a3a" />
  </>,
  holmes: (c) => <>
    <path d="M-17 6 Q-17 -17 0 -17 Q17 -17 17 6Z" fill="#a68a64" /><path d="M-17 6 Q-17 0 -25 2 L-17 10Z M17 6 Q17 0 25 2 L17 10Z" fill="#8c7050" />
    <path d="M-8 -16 V6 M8 -16 V6 M-17 -5 H17" fill="none" stroke={c} strokeWidth="2" /><path d="M-4 -17 Q0 -23 4 -17" fill="#8c7050" />
    <circle cx="9" cy="17" r="7" fill="#cfe8f5" fillOpacity="0.75" strokeWidth="2.6" /><path d="M14 22 L22 29" strokeWidth="4" />
  </>,
  watson: (c) => <>
    <path d="M-13 2 Q-13 -17 0 -17 Q13 -17 13 2Z" fill="#3d3d46" /><ellipse cx="0" cy="3" rx="22" ry="5.5" fill="#3d3d46" /><path d="M-13 -2 H13" fill="none" stroke={c} strokeWidth="3" />
    <path d="M-4 12 H4 V17 H9 V25 H4 V30 H-4 V25 H-9 V17 H-4Z" fill="#d42a3a" transform="translate(0 -3) scale(.9)" />
  </>,
  dracula: (c) => <>
    <path d="M-29 28 L-15 -6 L-8 6 L0 15 L8 6 L15 -6 L29 28Z" fill={c} /><path d="M-15 -6 L-8 6 L0 -2 L8 6 L15 -6 L0 -14Z" fill="#2b1018" />
    <circle cx="0" cy="-7" r="11" fill="#efe6e0" /><path d="M-11 -9 Q-4 -22 0 -14 Q4 -22 11 -9 Q0 -14 -11 -9Z" fill={INK} />
    <circle cx="-4" cy="-8" r="1.7" fill="#d42a3a" /><circle cx="4" cy="-8" r="1.7" fill="#d42a3a" /><path d="M-4 -1 Q0 1 4 -1" fill="none" /><path d="M-3.4 -1 L-2.4 4.6 L-1 -0.6 M3.4 -1 L2.4 4.6 L1 -0.6" fill="#fff" strokeWidth="1.2" />
  </>,
  sister: (c) => <>
    <path d="M0 -2 Q-10 -18 -28 -12 Q-22 -6 -24 2 Q-16 -2 -12 6 Q-6 0 0 8 Q6 0 12 6 Q16 -2 24 2 Q22 -6 28 -12 Q10 -18 0 -2Z" fill={c} />
    <path d="M-5 -10 L-6 -18 L0 -13 L6 -18 L5 -10Z" fill="#2b1018" /><circle cx="0" cy="-5" r="7" fill="#2b1018" /><circle cx="-2.6" cy="-6" r="1.3" fill="#ffd2d2" /><circle cx="2.6" cy="-6" r="1.3" fill="#ffd2d2" />
    <path d="M-2.6 -1.4 L-1.8 2.6 L-0.8 -1 M2.6 -1.4 L1.8 2.6 L0.8 -1" fill="#fff" strokeWidth="1" />
  </>,
  jekyll: (c) => <>
    <path d="M-5 -22 H5 V-8 L18 16 Q21 25 12 25 H-12 Q-21 25 -18 16 L-5 -8Z" fill="#dcecf4" />
    <path d="M-13 9 H13 L18 16 Q21 25 12 25 H-12 Q-21 25 -18 16Z" fill={c} /><rect x="-6" y="-27" width="12" height="6" rx="2" fill="#a97a43" />
    <circle cx="-4" cy="16" r="2" fill="#fff" fillOpacity="0.8" strokeWidth="1" /><circle cx="5" cy="13" r="1.4" fill="#fff" fillOpacity="0.8" strokeWidth="1" /><circle cx="2" cy="19" r="2.4" fill="#fff" fillOpacity="0.8" strokeWidth="1" />
  </>,
  hyde: (c) => <>
    <circle cx="0" cy="0" r="19" fill="#9bb87a" /><path d="M-13 -10 L-3 -5 M13 -10 L3 -5" strokeWidth="3.4" fill="none" />
    <circle cx="-7" cy="-3" r="3" fill="#ffe27a" /><circle cx="7" cy="-3" r="3" fill="#ffe27a" /><circle cx="-7" cy="-3" r="1.1" fill={INK} /><circle cx="7" cy="-3" r="1.1" fill={INK} />
    <path d="M-11 8 L-7 13 L-4 8 L0 14 L4 8 L7 13 L11 8 Q0 5 -11 8Z" fill={PAPER} /><path d="M-19 -10 L-14 -22 M19 -10 L14 -22" stroke={c} strokeWidth="4" fill="none" />
  </>,
  invisible: (c) => <>
    <circle cx="0" cy="2" r="15" fill={PAPER} /><path d="M-13 -6 L13 -2 M-14 5 L14 9 M-9 13 L9 15" fill="none" stroke="#c9bd9e" strokeWidth="3" />
    <rect x="-13" y="-4" width="26" height="9" rx="4" fill="#232a35" /><circle cx="-6" cy="0.5" r="3" fill="#9fd0f0" /><circle cx="6" cy="0.5" r="3" fill="#9fd0f0" />
    <ellipse cx="0" cy="-12" rx="19" ry="4.5" fill={c} /><path d="M-10 -12 Q-9 -25 0 -25 Q9 -25 10 -12Z" fill={c} /><path d="M-10 -15 H10" fill="none" stroke={INK} strokeWidth="2" />
  </>
};

/** Which emblem a fighter wears: the hero, or that hero's sidekick type. */
export const SIDEKICK_EMBLEM: Record<string, string> = { arthur: 'merlin', medusa: 'harpy', sinbad: 'porter', alice: 'jabberwock', holmes: 'watson', dracula: 'sister' };

export function Emblem({ id, c }: { id: string; c: string }) {
  return <g stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">{(EMBLEMS[id] ?? EMBLEMS.arthur!)(c)}</g>;
}

/** Round portrait in the hero colour; an optional ring is the hero's health dial (pct 0-100). */
export function Portrait({ id, color, size = 56, pct }: { id: string; color: string; size?: number; pct?: number }) {
  return (
    <svg className="um-portrait" viewBox="-40 -40 80 80" width={size} height={size} aria-hidden="true" focusable="false">
      {pct !== undefined && <>
        <circle r="36" fill="none" stroke="rgb(0 0 0 / 0.28)" strokeWidth="5" />
        <circle r="36" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(0, pct)} 100`} transform="rotate(-90)" />
      </>}
      <circle r="31" fill={color} stroke="#fff" strokeWidth="2" />
      <circle r="25" fill={PAPER} stroke={INK} strokeWidth="2" />
      <ellipse cx="-9" cy="-14" rx="10" ry="4" fill="#fff" fillOpacity="0.6" transform="rotate(-30 -9 -14)" />
      <g transform="scale(.78)"><Emblem id={id} c={color} /></g>
    </svg>
  );
}

const TYPE_ART: Record<string, ReactNode> = {
  attack: <><path d="M-12 14 L10 -12 M-12 -12 L10 14" stroke={INK} strokeWidth="6" /><path d="M-12 14 L10 -12 M-12 -12 L10 14" stroke={STEEL} strokeWidth="3" /><path d="M-14 8 L-8 14 M14 8 L8 14 M-14 -8 L-8 -14" stroke={GOLD} strokeWidth="3" fill="none" /></>,
  defense: <path d="M0 -15 L13 -10 V3 Q13 12 0 17 Q-13 12 -13 3 V-10Z" fill={STEEL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />,
  versatile: <><path d="M0 -15 L13 -10 V3 Q13 12 0 17 Q-13 12 -13 3 V-10Z" fill={STEEL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" /><path d="M0 -10 V12 M-7 -2 H7" stroke={INK} strokeWidth="3" /></>,
  scheme: <path d="M3 -16 L-9 3 H-1 L-4 16 L10 -4 H2Z" fill={GOLD} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
};

/** Illustrated art window of a card (viewBox 120x64): rays in the type colour, the owner's emblem and the type seal. */
export function CardArt({ type, emblem, color }: { type: string; emblem: string; color: string }) {
  return (
    <svg className="um-card__art" viewBox="0 0 120 64" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="umc-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.4" /></linearGradient></defs>
      <rect width="120" height="64" className="um-card__art-bg" />
      <g stroke="#fff" strokeOpacity="0.16" strokeWidth="6">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M60 38 L${60 + 90 * Math.cos((i * Math.PI) / 6)} ${38 + 90 * Math.sin((i * Math.PI) / 6)}`} />)}</g>
      <circle cx="60" cy="38" r="26" fill="#000" fillOpacity="0.2" />
      <g transform="translate(60 36) scale(.98)"><Emblem id={emblem} c={color} /></g>
      <g transform="translate(15 49)"><circle r="12" fill={PAPER} stroke={INK} strokeWidth="2" /><g transform="scale(.62)">{TYPE_ART[type]}</g></g>
      <rect width="120" height="64" fill="url(#umc-shade)" />
    </svg>
  );
}

// ---------- battlefield scenery (1337 x 866) ----------

/** Footpath palette per map: outline, trodden surface and stepping stones. */
export const PATHS: Record<string, { edge: string; fill: string; stone: string }> = {
  marmoreal: { edge: '#7d705a', fill: '#d6c8a2', stone: '#f1e7cb' },
  sarpedon: { edge: '#7c5a2e', fill: '#dbbb80', stone: '#f3deaa' },
  soho: { edge: '#1d1c22', fill: '#7c786c', stone: '#a6a294' },
  'baskerville-manor': { edge: '#2a2418', fill: '#97835c', stone: '#bba97f' }
};

const Column = ({ x, y, r = 17 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx="6" cy="9" rx={r + 5} ry={r} fill="#4a4030" opacity="0.3" filter="url(#umb-blur)" />
    <circle r={r + 3} fill="#d9d4c4" stroke="#9c9480" strokeWidth="2" /><circle r={r - 3} fill="#f4f1e8" stroke="#b5ad98" strokeWidth="1.5" />
    <path d="M-9 -9 L9 9 M9 -9 L-9 9 M0 -13 V13 M-13 0 H13" stroke="#bdb5a0" strokeWidth="1.2" /><circle r="5" fill="#d9d4c4" />
  </g>
);
const Statue = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-17" y="-15" width="34" height="34" rx="3" fill="#4a4030" opacity="0.28" filter="url(#umb-blur)" />
    <rect x="-17" y="-17" width="34" height="34" rx="3" fill="#e7e2d3" stroke="#9c9480" strokeWidth="2" /><circle r="10" fill="#fbf9f2" stroke="#b5ad98" strokeWidth="2" />
    <path d="M-6 3 Q0 -12 6 3 Q0 7 -6 3Z" fill="#d9d4c4" stroke="#b5ad98" />
  </g>
);
const Fountain = ({ x, y, r = 32 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r + 4} fill="#4a4030" opacity="0.25" filter="url(#umb-blur)" /><circle r={r} fill="#d6d0bd" stroke="#9c9480" strokeWidth="3" />
    <circle r={r - 6} fill="url(#umm-water)" stroke="#6aa7c0" strokeWidth="1.5" /><circle r={r * 0.5} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" />
    <circle r={r * 0.3} fill="#f4f1e8" stroke="#9c9480" strokeWidth="2" /><circle r={r * 0.12} fill="#dff3fb" />
  </g>
);

function Marmoreal() {
  return <>
    <defs>
      <linearGradient id="umm-floor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f1ea" /><stop offset="1" stopColor="#d6d3c8" /></linearGradient>
      <radialGradient id="umm-water"><stop offset="0" stopColor="#bfe6f4" /><stop offset="1" stopColor="#4f9dbd" /></radialGradient>
      <pattern id="umm-tile" width="134" height="134" patternUnits="userSpaceOnUse">
        <rect width="67" height="67" fill="#fff" fillOpacity="0.2" /><rect x="67" y="67" width="67" height="67" fill="#fff" fillOpacity="0.2" />
        <path d="M0 0 H134 V134 H0Z" fill="none" stroke="#9a968a" strokeOpacity="0.3" strokeWidth="2" />
        <path d="M10 30 Q40 10 70 36 T130 20 M0 96 Q30 80 60 100 T120 90 M80 130 Q96 112 118 124" fill="none" stroke="#7f8896" strokeOpacity="0.2" strokeWidth="1.6" />
      </pattern>
    </defs>
    <rect width="1337" height="866" fill="url(#umm-floor)" /><rect width="1337" height="866" fill="url(#umm-tile)" />
    <g fill="none" stroke="#b79b57" strokeOpacity="0.55">
      <circle cx="668" cy="433" r="372" strokeWidth="7" /><circle cx="668" cy="433" r="356" strokeWidth="2" /><circle cx="668" cy="433" r="210" strokeWidth="4" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} strokeWidth="3" d={`M668 433 L${668 + 372 * Math.cos((i * Math.PI) / 4)} ${433 + 372 * Math.sin((i * Math.PI) / 4)}`} />)}
    </g>
    {[[600, 26], [745, 26], [930, 26], [520, 840], [675, 842], [860, 840], [26, 520], [1311, 330], [26, 330]].map(([x, y]) => <Column key={`${x}-${y}`} x={x!} y={y!} />)}
    {[[30, 30], [1307, 30], [30, 836], [1307, 836]].map(([x, y]) => <Column key={`c${x}-${y}`} x={x!} y={y!} r={20} />)}
    <Fountain x={672} y={214} /><Fountain x={1190} y={690} /><Fountain x={88} y={160} r={26} />
    <Statue x={62} y={452} /><Statue x={1292} y={610} /><Statue x={1010} y={470} /><Statue x={300} y={650} />
  </>;
}

const ISLAND = 'M120 22 C400 -8 900 34 1240 24 C1330 40 1322 300 1306 420 C1332 600 1302 800 1200 846 C900 872 400 852 130 838 C20 800 40 600 30 420 C10 250 30 100 120 22Z';
const Tree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="6" cy="10" rx="26" ry="10" fill="#1d3a10" opacity="0.35" /><path d="M-3 12 Q-7 -2 0 -10 Q5 -2 4 12Z" fill="#5b4228" stroke="#3a2a18" />
    <circle cx="-11" cy="-12" r="13" fill="#6f8a3c" /><circle cx="11" cy="-14" r="14" fill="#7f9a46" /><circle cx="0" cy="-23" r="13" fill="#93ad56" /><circle cx="-4" cy="-25" r="5" fill="#c4d98c" opacity="0.7" />
  </g>
);
const Ruin = ({ x, y, k = 1 }: { x: number; y: number; k?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} stroke="#8d7f5e" strokeWidth="2">
    <rect x="-46" y="-6" width="92" height="14" rx="2" fill="#d8cdb0" />
    {[-34, -12, 12, 34].map((cx, i) => <rect key={cx} x={cx - 6} y={i % 2 ? -22 : -34} width="12" height={i % 2 ? 16 : 28} fill="#eadfc4" />)}
    <path d="M24 -22 l5 -6 l5 6" fill="#eadfc4" /><ellipse cx="-20" cy="16" rx="12" ry="5" fill="#cfc3a2" />
  </g>
);

function Sarpedon() {
  return <>
    <defs>
      <linearGradient id="ums-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b86a8" /><stop offset="1" stopColor="#0f4766" /></linearGradient>
      <linearGradient id="ums-sand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eadca8" /><stop offset="1" stopColor="#c7b374" /></linearGradient>
      <linearGradient id="ums-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a1c466" /><stop offset="1" stopColor="#67974a" /></linearGradient>
      <pattern id="ums-wave" width="80" height="40" patternUnits="userSpaceOnUse"><path d="M0 20 q10 -10 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="2" /></pattern>
    </defs>
    <rect width="1337" height="866" fill="url(#ums-sea)" /><rect width="1337" height="866" fill="url(#ums-wave)" />
    <path d={ISLAND} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="34" filter="url(#umb-blur)" />
    <path d={ISLAND} fill="url(#ums-sand)" stroke="#6f5a3c" strokeWidth="10" strokeLinejoin="round" />
    <path d={ISLAND} fill="url(#ums-grass)" opacity="0.9" transform="translate(668 433) scale(.93) translate(-668 -433)" />
    <path d={ISLAND} fill="none" stroke="#6f5a3c" strokeOpacity="0.45" strokeWidth="3" strokeDasharray="18 10" transform="translate(668 433) scale(.97) translate(-668 -433)" />
    <path d="M1150 20 Q1250 120 1306 250 M30 640 Q120 760 250 838" fill="none" stroke="#5d4a31" strokeOpacity="0.5" strokeWidth="16" />
    <Ruin x={700} y={470} /><Ruin x={1060} y={150} k={0.8} /><Ruin x={150} y={360} k={0.7} /><Ruin x={470} y={720} k={0.8} />
    {[[60, 190, 1], [120, 600, 1.1], [440, 330, 0.9], [610, 160, 1], [800, 360, 1], [1110, 330, 1.1], [1190, 470, 1], [300, 840, 0.9], [1290, 700, 1], [1220, 560, 0.9], [740, 560, 0.9], [980, 600, 1]].map(([x, y, s]) => <Tree key={`${x}-${y}`} x={x!} y={y!} s={s!} />)}
  </>;
}

const Building = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="6" y="8" width={w} height={h} fill="#000" opacity="0.35" filter="url(#umb-blur)" />
    <rect width={w} height={h} fill="url(#umh-brick)" stroke="#2b1c18" strokeWidth="3" /><rect x="-4" y="-10" width={w + 8} height="14" rx="2" fill="#3a2a2a" stroke="#1d1412" strokeWidth="2" />
    <rect x="8" y="14" width={w - 16} height={h - 22} fill="url(#umh-win)" /><rect x={w - 26} y="-24" width="12" height="16" fill="#5a3326" stroke="#1d1412" strokeWidth="2" />
  </g>
);
const Lamp = ({ x, y }: { x: number; y: number }) => <g transform={`translate(${x} ${y})`}><circle r="52" fill="url(#umh-glow)" /><circle r="9" fill="#2a2520" /><circle r="5.5" fill="#ffe9a8" /></g>;

function Soho() {
  return <>
    <defs>
      <pattern id="umh-cobble" width="56" height="56" patternUnits="userSpaceOnUse">
        <rect width="56" height="56" fill="#46454d" />
        {[[2, 2, 24, 18, '#5c5b66'], [30, 3, 24, 19, '#53525c'], [0, 24, 20, 16, '#53525c'], [24, 25, 30, 17, '#64636f'], [4, 44, 26, 12, '#5c5b66'], [34, 46, 20, 10, '#53525c']].map(([x, y, w, h, f]) => <rect key={`${x}${y}`} x={x as number} y={y as number} width={w as number} height={h as number} rx="7" fill={f as string} stroke="#2e2d34" strokeWidth="1.5" />)}
      </pattern>
      <pattern id="umh-brick" width="28" height="14" patternUnits="userSpaceOnUse"><rect width="28" height="14" fill="#8c3f2f" /><path d="M0 7 H28 M0 0 H28 M14 0 V7 M0 7 V14 M28 7 V14" stroke="#4f221a" strokeWidth="1.4" /><rect x="2" y="2" width="10" height="3" fill="#b05a44" opacity="0.4" /></pattern>
      <pattern id="umh-win" width="64" height="40" patternUnits="userSpaceOnUse"><rect x="8" y="6" width="18" height="26" rx="8" fill="#f4c86a" stroke="#2b1c18" strokeWidth="2.5" /><rect x="38" y="6" width="18" height="26" rx="8" fill="#26303f" stroke="#2b1c18" strokeWidth="2.5" /></pattern>
      <radialGradient id="umh-glow"><stop offset="0" stopColor="#ffe08a" stopOpacity="0.8" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient>
      <filter id="umh-fog" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="16" /></filter>
    </defs>
    <rect width="1337" height="866" fill="url(#umh-cobble)" /><rect width="1337" height="866" fill="#10121a" opacity="0.2" />
    {[[40, 155, 170, 100], [350, 165, 110, 70], [600, 170, 130, 90], [900, 150, 180, 110], [30, 415, 150, 120], [540, 440, 200, 110], [1090, 640, 100, 80], [200, 585, 150, 95]].map(([x, y, w, h]) => <Building key={`${x}-${y}`} x={x!} y={y!} w={w!} h={h!} />)}
    {[[350, 200], [745, 235], [1150, 190], [180, 560], [560, 560], [880, 540], [1180, 420], [400, 650]].map(([x, y]) => <Lamp key={`${x}-${y}`} x={x!} y={y!} />)}
    <g fill="#d8dce6" filter="url(#umh-fog)"><ellipse cx="320" cy="420" rx="260" ry="46" opacity="0.2" /><ellipse cx="900" cy="560" rx="300" ry="50" opacity="0.18" /><ellipse cx="660" cy="190" rx="240" ry="38" opacity="0.18" /><ellipse cx="1130" cy="780" rx="220" ry="40" opacity="0.2" /></g>
  </>;
}

const Gravestones = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`} stroke="#4b504c" strokeWidth="2">
    {[[-22, 4, 1], [0, -4, 1.2], [24, 6, 0.9]].map(([dx, dy, s]) => (
      <g key={dx} transform={`translate(${dx} ${dy}) scale(${s})`}><ellipse cx="4" cy="12" rx="12" ry="4" fill="#000" opacity="0.3" /><path d="M-8 11 V-4 Q-8 -13 0 -13 Q8 -13 8 -4 V11Z" fill="#9ea3a0" /><path d="M0 -8 V4 M-4 -3 H4" fill="none" /></g>
    ))}
  </g>
);
const Hedge = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => <rect x={x} y={y} width={w} height={h} rx="14" fill="url(#umk-hedge)" stroke="#1b2e14" strokeWidth="3" />;

function Baskerville() {
  return <>
    <defs>
      <linearGradient id="umk-moor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#62745a" /><stop offset="1" stopColor="#3d4d37" /></linearGradient>
      <pattern id="umk-heath" width="64" height="64" patternUnits="userSpaceOnUse"><g fill="#8a6a9a" fillOpacity="0.5"><circle cx="8" cy="14" r="2.2" /><circle cx="40" cy="8" r="1.8" /><circle cx="28" cy="40" r="2.2" /><circle cx="54" cy="52" r="1.8" /><circle cx="12" cy="56" r="1.6" /></g><path d="M20 22 q4 -8 8 0 M46 30 q4 -8 8 0" stroke="#2f3d2a" strokeOpacity="0.5" fill="none" strokeWidth="2" /></pattern>
      <pattern id="umk-hedge" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#2f5a26" /><circle cx="6" cy="8" r="6" fill="#3f7233" /><circle cx="19" cy="18" r="7" fill="#3a6a2f" /><circle cx="18" cy="5" r="3" fill="#4c8640" /></pattern>
      <pattern id="umk-floor" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#a98a5c" /><path d="M0 0 H40 M0 20 H40 M10 0 V20 M30 20 V40" stroke="#6d5233" strokeWidth="1.6" /></pattern>
      <filter id="umk-fog" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="18" /></filter>
    </defs>
    <rect width="1337" height="866" fill="url(#umk-moor)" /><rect width="1337" height="866" fill="url(#umk-heath)" />
    <path d="M0 250 Q300 200 520 290 T1337 260 V300 Q900 340 660 300 T0 300Z" fill="#2c3a2a" opacity="0.5" />
    {[[620, 28, 220, 38], [1000, 640, 170, 34], [560, 330, 120, 30], [880, 330, 40, 120], [1180, 340, 38, 140], [300, 160, 100, 30]].map(([x, y, w, h]) => <Hedge key={`${x}-${y}`} x={x!} y={y!} w={w!} h={h!} />)}
    <g><rect x="64" y="338" width="510" height="400" rx="6" fill="#241f1a" opacity="0.4" filter="url(#umb-blur)" /><rect x="70" y="344" width="498" height="388" fill="url(#umk-floor)" stroke="#3a3530" strokeWidth="20" strokeLinejoin="round" />
      <path d="M70 540 H260 M380 344 V480 M300 732 V620" stroke="#3a3530" strokeWidth="12" fill="none" /><g fill="#3a3530">{[[70, 344], [568, 344], [70, 732], [568, 732]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="26" stroke="#1d1a16" strokeWidth="3" />)}</g>
      <g fill="#f4c86a" stroke="#1d1a16" strokeWidth="2.5">{[150, 290, 440].map((x) => <rect key={x} x={x} y="326" width="30" height="16" rx="3" />)}</g>
    </g>
    {[[1190, 300], [760, 590], [1100, 600], [980, 160], [620, 830], [1010, 800], [240, 90]].map(([x, y]) => <Gravestones key={`${x}-${y}`} x={x!} y={y!} />)}
    <g fill="#e3e8ee" filter="url(#umk-fog)"><ellipse cx="700" cy="610" rx="320" ry="52" opacity="0.22" /><ellipse cx="260" cy="250" rx="240" ry="40" opacity="0.2" /><ellipse cx="1100" cy="420" rx="260" ry="44" opacity="0.2" /><ellipse cx="640" cy="130" rx="260" ry="36" opacity="0.2" /></g>
  </>;
}

const SCENES: Record<string, () => ReactNode> = { marmoreal: Marmoreal, sarpedon: Sarpedon, soho: Soho, 'baskerville-manor': Baskerville };
export const Scenery = ({ boardId }: { boardId: string }) => { const S = SCENES[boardId] ?? Marmoreal; return <S />; };
