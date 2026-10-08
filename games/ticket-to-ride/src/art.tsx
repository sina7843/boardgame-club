// Ticket to Ride vector art: map defs (sea, land watercolours, paper, wood), terrain symbols, compass, cartouche,
// illustrated train cards, claimed train cars and the seat colours. Decorative only: every part is aria-hidden or
// inside an element that carries the label.
import { COLORS, LOCO } from './board.ts';

/** Card / route colours: [light, base, dark]. Index = colour index (0–7), 8 = locomotive, 9 = gray route. */
export const SHADES: [string, string, string][] = [
  ['#f07a7a', '#d23a3a', '#8e1a1a'], ['#ffb46a', '#ee8424', '#a8510a'], ['#ffe783', '#f0c92a', '#a88405'],
  ['#86cf8c', '#3d9a4a', '#1f5f28'], ['#7fb0f2', '#2f6fd0', '#173f86'], ['#f6b3d7', '#df73ae', '#9b3a72'],
  ['#6b6b72', '#2c2c31', '#0c0c0f'], ['#ffffff', '#efe9d8', '#b4aa8e'], ['#e9d8a6', '#c9a74a', '#7a5f17'],
  ['#d3cec3', '#a8a296', '#6c675d']
];
export const GRAY = 9;
/** Text colour on a card / route of that colour. */
export const ON = ['#fff', '#2a1a05', '#2a1a05', '#fff', '#fff', '#2a1a05', '#fff', '#2a1a05', '#2a1a05', '#2a1a05'];
export const colorIx = (c: string) => (c === 'gray' ? GRAY : (COLORS as readonly string[]).indexOf(c));

/** Seat colours, in the table shell's seat order (always shown with the seat number and the colour name in text). */
export const SEAT_SHADES: [string, string, string][] = [
  ['#ff8b8b', '#c42a2a', '#7a1010'], ['#7aa8ff', '#1f57c8', '#0e2f78'], ['#ffe28a', '#e2a91e', '#8a6400'],
  ['#8fe0a0', '#1e8a3c', '#0b4d1f'], ['#b9a1ff', '#6b3fc6', '#3a1f7a']
];
export const SEAT_COLOR = SEAT_SHADES.map((s) => s[1]);
export const SEAT_INK = ['#fff', '#fff', '#2a1a05', '#fff', '#fff'];
export const SEAT_FA = ['قرمز', 'آبی', 'زرد', 'سبز', 'بنفش'];
export const INK = '#3b2a17';

/** Land watercolour per map: [light, dark]. */
export const LAND: Record<string, [string, string]> = {
  usa: ['#efe2b9', '#d3c08a'], europe: ['#e9e8c2', '#c8cf9a'], iran: ['#f1ddb2', '#d8b57c']
};

export function MapDefs({ map = 'usa' }: { map?: string }) {
  const [l, d] = LAND[map] ?? LAND.usa!;
  return (
    <defs>
      <linearGradient id="ttr-sea" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#9fd0c8" /><stop offset="0.55" stopColor="#6fa9ae" /><stop offset="1" stopColor="#487f92" /></linearGradient>
      <pattern id="ttr-waves" width="34" height="15" patternUnits="userSpaceOnUse">
        <path d="M2 7 q4 -3.4 8 0 t8 0" fill="none" stroke="#244f58" strokeOpacity="0.22" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M19 14 q3 -2.6 6 0" fill="none" stroke="#244f58" strokeOpacity="0.14" strokeWidth="0.8" strokeLinecap="round" />
      </pattern>
      <linearGradient id="ttr-land" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stopColor={l} /><stop offset="1" stopColor={d} /></linearGradient>
      <pattern id="ttr-paper" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="5" r="0.8" fill="#5a3b14" fillOpacity="0.16" /><circle cx="17" cy="14" r="0.6" fill="#5a3b14" fillOpacity="0.14" />
        <circle cx="10" cy="21" r="0.5" fill="#fff" fillOpacity="0.45" /><circle cx="22" cy="4" r="0.5" fill="#fff" fillOpacity="0.4" />
        <path d="M1 15 q4 -1.5 8 0 M13 25 q5 -1.2 10 0" stroke="#5a3b14" strokeOpacity="0.09" strokeWidth="0.6" fill="none" />
      </pattern>
      <linearGradient id="ttr-loco" x1="0" y1="0" x2="1" y2="1">
        {['#d23a3a', '#ee8424', '#f0c92a', '#3d9a4a', '#2f6fd0', '#9b59c9'].map((c, i) => <stop key={c} offset={i / 5} stopColor={c} />)}
      </linearGradient>
      {SHADES.map(([a, b, c], i) => (
        <linearGradient key={i} id={`ttr-c-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="0.45" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient>
      ))}
      {SEAT_SHADES.map(([a, b, c], i) => (
        <linearGradient key={i} id={`ttr-s-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="0.4" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient>
      ))}
      <linearGradient id="ttr-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a2f" /><stop offset="0.5" stopColor="#6b4220" /><stop offset="1" stopColor="#4a2c12" /></linearGradient>
      <pattern id="ttr-grain" width="80" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-3)">
        <path d="M0 2 H80" stroke="#2c1706" strokeOpacity="0.3" strokeWidth="0.7" /><path d="M0 6 Q20 4.5 40 6 T80 6" fill="none" stroke="#e8c08c" strokeOpacity="0.18" strokeWidth="0.8" />
      </pattern>
      <linearGradient id="ttr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset="0.5" stopColor="#d9a62e" /><stop offset="1" stopColor="#8d6210" /></linearGradient>
      <radialGradient id="ttr-vignette" cx="50%" cy="50%" r="72%"><stop offset="0.6" stopColor="#4a2f10" stopOpacity="0" /><stop offset="1" stopColor="#4a2f10" stopOpacity="0.34" /></radialGradient>
      <radialGradient id="ttr-station" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#e2d3ae" /></radialGradient>
      {/* Girih-style tile lattice for the frame, a surveyor's graticule and age stains for the chart. */}
      <pattern id="ttr-tile" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#2a1a0b" fillOpacity="0.55" />
        <path d="M10 1 L12.6 7.4 L19 10 L12.6 12.6 L10 19 L7.4 12.6 L1 10 L7.4 7.4 Z" fill="none" stroke="#e8c35f" strokeOpacity="0.55" strokeWidth="0.7" />
        <path d="M10 5 L15 10 L10 15 L5 10 Z" fill="#2f7a82" fillOpacity="0.6" stroke="#e8c35f" strokeOpacity="0.4" strokeWidth="0.5" />
        <circle cx="10" cy="10" r="1.3" fill="#e8c35f" fillOpacity="0.8" /><circle cx="0" cy="0" r="1" fill="#e8c35f" fillOpacity="0.5" /><circle cx="20" cy="20" r="1" fill="#e8c35f" fillOpacity="0.5" /><circle cx="20" cy="0" r="1" fill="#e8c35f" fillOpacity="0.5" /><circle cx="0" cy="20" r="1" fill="#e8c35f" fillOpacity="0.5" />
      </pattern>
      <pattern id="ttr-graticule" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0 V72 H0" fill="none" stroke="#5a3b14" strokeOpacity="0.14" strokeWidth="0.7" strokeDasharray="6 4" /></pattern>
      <radialGradient id="ttr-stain1" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#8a5a1c" stopOpacity="0.2" /><stop offset="1" stopColor="#8a5a1c" stopOpacity="0" /></radialGradient>
      <filter id="ttr-landshadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1" dy="2.2" stdDeviation="2" floodColor="#1c3a3c" floodOpacity="0.45" /></filter>
      {/* Terrain glyphs, reused with <use>. */}
      <symbol id="ttr-mtn" viewBox="-12 -10 24 15" width="24" height="15" overflow="visible">
        <path d="M-11 4 L-2 -9 L7 4 Z" fill="#b59a6a" stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M-2 -9 L7 4 L1 4 L-1 -2 Z" fill="#8a6f45" />
        <path d="M-4.6 -5.2 L-2 -9 L0.4 -5.6 L-1 -6.4 L-2.6 -4.8 Z" fill="#fbf7ec" />
        <path d="M0 4 L6 -4 L12 4 Z" fill="#c4aa79" stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M6 -4 L12 4 L8.5 4 Z" fill="#987b4e" />
      </symbol>
      <symbol id="ttr-tree" viewBox="-6 -9 12 13" width="12" height="13" overflow="visible">
        <path d="M0 -8 L5 1 L-5 1 Z" fill="#6c9653" stroke="#2f4a22" strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M0 -8 L5 1 L1 1 Z" fill="#4c7a3e" /><path d="M0 1 V3.5" stroke="#5a3b14" strokeWidth="1.1" />
      </symbol>
      <symbol id="ttr-dune" viewBox="-8 -4 16 7" width="16" height="7" overflow="visible">
        <path d="M-8 2 Q-3 -3 2 1 Q5 -1.5 8 1.5" fill="none" stroke="#9c7440" strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="-3" cy="3" r="0.5" fill="#9c7440" /><circle cx="3" cy="3.2" r="0.5" fill="#9c7440" />
      </symbol>
    </defs>
  );
}

/** Compass rose (decorative), radius ~36. */
export function Compass() {
  const star = (len: number, w: number, rot: number, dark: boolean) => (
    <g transform={`rotate(${rot})`}>
      <path d={`M0 ${-len} L${w} 0 L0 0 Z M0 ${len} L${-w} 0 L0 0 Z M${-len} 0 L0 ${-w} L0 0 Z M${len} 0 L0 ${w} L0 0 Z`} fill={dark ? INK : '#f3e7c6'} stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
      <path d={`M0 ${-len} L${-w} 0 L0 0 Z M0 ${len} L${w} 0 L0 0 Z M${-len} 0 L0 ${w} L0 0 Z M${len} 0 L0 ${-w} L0 0 Z`} fill={dark ? '#f3e7c6' : INK} stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
    </g>
  );
  return (
    <g aria-hidden="true" pointerEvents="none" opacity="0.92">
      <circle r="31" fill="#f3e7c6" fillOpacity="0.35" stroke={INK} strokeWidth="1.1" />
      <circle r="26" fill="none" stroke={INK} strokeWidth="0.7" strokeDasharray="1.5 2.6" />
      {star(24, 5, 45, false)}
      {star(36, 6, 0, true)}
      <circle r="3.2" fill="url(#ttr-gold)" stroke={INK} strokeWidth="0.9" />
      <text y="-40" fontSize="11" fontWeight="900" fill={INK} textAnchor="middle">ش</text>
    </g>
  );
}

/** Title cartouche with two little locomotives, centred on the origin, about 200 × 60. */
export function Cartouche({ title, sub }: { title: string; sub: string }) {
  const frame = (k: number) => `M${-92 - k} ${-28 - k} H${92 + k} Q${99 + k} ${-28 - k} ${99 + k} ${-21 - k} V${21 + k} Q${99 + k} ${28 + k} ${92 + k} ${28 + k} H${-92 - k} Q${-99 - k} ${28 + k} ${-99 - k} ${21 + k} V${-21 - k} Q${-99 - k} ${-28 - k} ${-92 - k} ${-28 - k} Z`;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <path d={frame(0)} fill="#00000030" transform="translate(2 3)" />
      <path d={frame(0)} fill="#f4e8c8" stroke={INK} strokeWidth="1.8" />
      <path d={frame(-4)} fill="none" stroke={INK} strokeWidth="0.7" />
      {[[-99, -28], [99, -28], [-99, 28], [99, 28]].map(([x, y]) => <g key={`${x}${y}`} transform={`translate(${x} ${y})`}><circle r="6" fill="url(#ttr-gold)" stroke={INK} strokeWidth="1" /><circle r="2.2" fill="#f4e8c8" stroke={INK} strokeWidth="0.6" /></g>)}
      <text y="3" fontSize={Math.min(24, 190 / Math.max(1, title.length))} fontWeight="900" fill={INK} textAnchor="middle">{title}</text>
      <text y="18" fontSize="9" fontWeight="700" fill="#6b5330" textAnchor="middle">{sub}</text>
      <g transform="translate(-80 -10) scale(0.5)"><TrainGlyph loco color={INK} /></g>
      <g transform="translate(80 -10) scale(-0.5 0.5)"><TrainGlyph loco color={INK} /></g>
    </g>
  );
}

/** Fill for a card colour index (locomotive = rainbow). */
export const cardFill = (c: number) => (c === LOCO ? 'url(#ttr-loco)' : `url(#ttr-c-${c})`);

/** A small locomotive or wagon silhouette, centred on the origin, about 30 × 16. */
export function TrainGlyph({ loco, color = '#fff' }: { loco?: boolean; color?: string }) {
  return loco ? (
    <g fill={color} aria-hidden="true">
      <rect x="-14" y="-6" width="18" height="10" rx="1.5" /><rect x="4" y="-9" width="9" height="13" rx="1.5" />
      <rect x="-11" y="-11" width="4" height="6" /><rect x="6" y="-7" width="5" height="4" fill="#0006" />
      <circle cx="-9" cy="6" r="3" /><circle cx="-1" cy="6" r="3" /><circle cx="8" cy="6" r="3" />
      <path d="M-14 3 L-18 6 L-14 6 Z" />
    </g>
  ) : (
    <g fill={color} aria-hidden="true">
      <rect x="-14" y="-8" width="28" height="12" rx="2" />
      <rect x="-11" y="-5" width="6" height="4" fill="#0005" /><rect x="-3" y="-5" width="6" height="4" fill="#0005" /><rect x="5" y="-5" width="6" height="4" fill="#0005" />
      <circle cx="-8" cy="6" r="3" /><circle cx="8" cy="6" r="3" />
    </g>
  );
}

type WagonKind = 'box' | 'hopper' | 'tank' | 'caboose' | 'coach' | 'logs' | 'coal' | 'reefer';
/** Which wagon each card colour shows (colour index order). */
const WAGON: WagonKind[] = ['box', 'hopper', 'tank', 'caboose', 'coach', 'logs', 'coal', 'reefer'];
const WINK = '#1d140a';

function Wheels({ xs }: { xs: number[] }) {
  return <>{xs.map((x) => <g key={x}><circle cx={x} cy="4.2" r="2.9" fill="#2a2420" stroke={WINK} strokeWidth="0.6" /><circle cx={x} cy="4.2" r="1" fill="#9c9389" /></g>)}</>;
}
const Under = () => <><rect x="-17" y="1" width="34" height="1.8" fill="#3a302a" /><rect x="-19" y="0.4" width="2" height="1.6" fill={WINK} /><rect x="17" y="0.4" width="2" height="1.6" fill={WINK} /></>;

/** A wagon about 36 wide, wheels on y = 4, painted in the card colour. */
function Wagon({ kind, c }: { kind: WagonKind; c: number }) {
  const [l, b, d] = SHADES[c]!;
  const sw = 0.9;
  switch (kind) {
    case 'box': return (
      <g><Under /><rect x="-16.5" y="-13" width="33" height="14" rx="1" fill={b} stroke={WINK} strokeWidth={sw} />
        <rect x="-16.5" y="-13" width="33" height="2.4" fill={d} /><path d="M-12 -10 V0.5 M-8 -10 V0.5 M8 -10 V0.5 M12 -10 V0.5" stroke={d} strokeWidth="0.7" />
        <rect x="-4.5" y="-10" width="9" height="10.5" fill={l} stroke={WINK} strokeWidth="0.7" /><path d="M-4.5 -10 L4.5 0.5 M4.5 -10 L-4.5 0.5" stroke={d} strokeWidth="0.7" />
        <Wheels xs={[-11, -6, 6, 11]} /></g>
    );
    case 'hopper': return (
      <g><Under /><path d="M-17 -12 H17 L13 1 H-13 Z" fill={b} stroke={WINK} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M-17 -12 H17 V-10 H-17 Z" fill={d} /><path d="M-9 -10 L-7.5 1 M0 -10 V1 M9 -10 L7.5 1" stroke={d} strokeWidth="0.8" />
        <path d="M-15 -12 Q-8 -17 0 -14.5 Q8 -17.5 15 -12 Z" fill="#e6c36a" stroke={WINK} strokeWidth="0.6" />
        <Wheels xs={[-10, -5, 5, 10]} /></g>
    );
    case 'tank': return (
      <g><Under /><rect x="-17" y="-11.5" width="34" height="12" rx="6" fill={b} stroke={WINK} strokeWidth={sw} />
        <path d="M-14 -9 H14" stroke={l} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" /><path d="M-8 -11.5 V0.5 M8 -11.5 V0.5" stroke={d} strokeWidth="0.8" />
        <rect x="-2.5" y="-15" width="5" height="4" rx="1" fill={b} stroke={WINK} strokeWidth="0.7" />
        <Wheels xs={[-11, -6, 6, 11]} /></g>
    );
    case 'caboose': return (
      <g><Under /><rect x="-15" y="-11" width="30" height="12" rx="1" fill={b} stroke={WINK} strokeWidth={sw} />
        <rect x="-6" y="-16.5" width="12" height="6" rx="0.8" fill={b} stroke={WINK} strokeWidth="0.8" /><path d="M-7.5 -16.5 H7.5" stroke={WINK} strokeWidth="1.4" />
        <rect x="-4" y="-15" width="3" height="2.6" fill={l} stroke={WINK} strokeWidth="0.4" /><rect x="1" y="-15" width="3" height="2.6" fill={l} stroke={WINK} strokeWidth="0.4" />
        <rect x="-12" y="-8" width="4" height="4" fill={l} stroke={WINK} strokeWidth="0.5" /><rect x="8" y="-8" width="4" height="4" fill={l} stroke={WINK} strokeWidth="0.5" />
        <path d="M-17 -11 H-15 M15 -11 H17 M-16.5 -11 V1 M16.5 -11 V1" stroke={WINK} strokeWidth="0.7" />
        <Wheels xs={[-9, 9]} /></g>
    );
    case 'coach': return (
      <g><Under /><path d="M-17 -10 Q0 -15.5 17 -10 V1 H-17 Z" fill={b} stroke={WINK} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M-17 -10 Q0 -15.5 17 -10" fill="none" stroke={d} strokeWidth="1.6" />
        {[-13, -7.5, -2, 3.5, 9].map((x) => <rect key={x} x={x} y="-8" width="4" height="4.5" rx="0.8" fill="#fff6d8" stroke={WINK} strokeWidth="0.5" />)}
        <path d="M-17 -1.5 H17" stroke={l} strokeWidth="1" />
        <Wheels xs={[-12, -8, 8, 12]} /></g>
    );
    case 'logs': return (
      <g><Under /><rect x="-17" y="-2.5" width="34" height="3.5" fill={b} stroke={WINK} strokeWidth={sw} />
        <path d="M-16 -2.5 V-12 M16 -2.5 V-12" stroke={d} strokeWidth="1.4" />
        {[[-4.6, 0], [-8.8, -1.5], [-8.8, 1.5], [-13, 0]].map(([y, dx], i) => (
          <g key={i}><rect x={-15 + dx!} y={y! - 2.2} width="30" height="4.4" rx="2.2" fill="#9a6a3a" stroke={WINK} strokeWidth="0.5" /><circle cx={15 + dx!} cy={y} r="2.1" fill="#e2bd86" stroke={WINK} strokeWidth="0.5" /></g>
        ))}
        <Wheels xs={[-11, -6, 6, 11]} /></g>
    );
    case 'coal': return (
      <g><Under /><path d="M-17 -10 H17 L15 1 H-15 Z" fill={b} stroke={WINK} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M-17 -10 Q-12 -16 -6 -12.5 Q-1 -17 4 -12.8 Q10 -16.5 17 -10 Z" fill="#1b1b1e" stroke={WINK} strokeWidth="0.6" />
        <circle cx="-9" cy="-12.5" r="0.8" fill="#8b8b92" /><circle cx="2" cy="-14" r="0.7" fill="#8b8b92" /><circle cx="10" cy="-12.5" r="0.8" fill="#8b8b92" />
        <path d="M-8 -10 L-7 1 M8 -10 L7 1" stroke="#55555c" strokeWidth="0.8" />
        <Wheels xs={[-10, -5, 5, 10]} /></g>
    );
    case 'reefer': return (
      <g><Under /><rect x="-16.5" y="-13" width="33" height="14" rx="1" fill={b} stroke={WINK} strokeWidth={sw} />
        <rect x="-16.5" y="-13" width="33" height="2.6" fill="#8fb7d6" /><rect x="-16.5" y="-1.6" width="33" height="2.2" fill="#8fb7d6" />
        <path d="M-6 -6 H-2 M-4 -8 V-4 M-5.4 -7.4 L-2.6 -4.6 M-2.6 -7.4 L-5.4 -4.6" stroke="#4a7ea6" strokeWidth="0.8" strokeLinecap="round" />
        <rect x="3" y="-9.5" width="9" height="8" fill={l} stroke={WINK} strokeWidth="0.6" />
        <Wheels xs={[-11, -6, 6, 11]} /></g>
    );
  }
}

/** Steam locomotive about 38 wide, wheels on y = 4. */
function Locomotive() {
  return (
    <g>
      <circle cx="-9" cy="-24" r="3.2" fill="#fff" opacity="0.85" /><circle cx="-4" cy="-27" r="4" fill="#fff" opacity="0.7" /><circle cx="2" cy="-29" r="3.2" fill="#fff" opacity="0.55" />
      <rect x="-15" y="-9" width="22" height="9.5" rx="4.5" fill="#2c2c31" stroke={WINK} strokeWidth="0.9" />
      <path d="M-15 -6 H7" stroke="#6b6b72" strokeWidth="1" /><path d="M-6 -9 V0.5 M1 -9 V0.5" stroke="#d9a62e" strokeWidth="1.2" />
      <rect x="-12.5" y="-19" width="4.5" height="10.5" fill="#2c2c31" stroke={WINK} strokeWidth="0.8" /><rect x="-13.5" y="-20.5" width="6.5" height="2.2" rx="0.6" fill="#d9a62e" stroke={WINK} strokeWidth="0.5" />
      <path d="M-3 -9 Q-1.5 -14 0 -9 Z" fill="#d9a62e" stroke={WINK} strokeWidth="0.5" />
      <rect x="6" y="-16" width="11" height="17" rx="1" fill="#c42a2a" stroke={WINK} strokeWidth="0.9" /><rect x="5" y="-17.5" width="13" height="2.4" rx="0.8" fill="#2c2c31" />
      <rect x="8.5" y="-13" width="6" height="5" rx="0.8" fill="#fff6d8" stroke={WINK} strokeWidth="0.5" />
      <path d="M-15 0 L-20 4.5 H-15 Z" fill="#c42a2a" stroke={WINK} strokeWidth="0.6" />
      <rect x="-16.5" y="-7" width="2.5" height="3" rx="1" fill="#ffe08a" stroke={WINK} strokeWidth="0.4" />
      {[-10, -2.5, 5].map((x) => <g key={x}><circle cx={x} cy="3.4" r="3.6" fill="#c42a2a" stroke={WINK} strokeWidth="0.8" /><circle cx={x} cy="3.4" r="1.1" fill="#2a2420" /></g>)}
      <circle cx="13" cy="4.4" r="2.6" fill="#c42a2a" stroke={WINK} strokeWidth="0.7" />
      <path d="M-10 3.4 H5" stroke="#9c9389" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

/** Illustrated train card (SVG), 48 × 72 view box: frame in the card colour, a scene with the wagon on rails. */
export function CardArt({ c }: { c: number }) {
  const loco = c === LOCO;
  const id = `ttr-card-sky-${c}`;
  const [l, , d] = SHADES[c]!;
  return (
    <svg viewBox="0 0 48 72" className="ttr-cardart" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdf7e6" /><stop offset="1" stopColor={loco ? '#f2d9a0' : l} stopOpacity={loco ? 1 : 0.6} /></linearGradient>
      </defs>
      <rect x="0.6" y="0.6" width="46.8" height="70.8" rx="5.5" fill={cardFill(c)} stroke={WINK} strokeWidth="1.1" />
      <rect x="0.6" y="0.6" width="46.8" height="70.8" rx="5.5" fill="url(#ttr-paper)" />
      <rect x="4" y="4" width="40" height="52" rx="3.5" fill={`url(#${id})`} stroke={WINK} strokeWidth="0.8" />
      <path d="M4 38 Q14 31 22 36 T44 33 V55 H4 Z" fill={loco ? '#c9b27a' : d} opacity="0.2" />
      <path d="M4 44 Q16 39 28 43 T44 42 V55 H4 Z" fill="#8a6f45" opacity="0.2" />
      <path d="M5 49.6 H43" stroke="#5a3b14" strokeWidth="1" />
      {[7, 11, 15, 19, 23, 27, 31, 35, 39].map((x) => <rect key={x} x={x} y="49.8" width="2" height="1.6" fill="#7a5a30" />)}
      <g transform={`translate(24 44.4) scale(${loco ? 0.92 : 0.98})`}>{loco ? <Locomotive /> : <Wagon kind={WAGON[c]!} c={c} />}</g>
      <rect x="6" y="59" width="36" height="9.5" rx="2" fill="#fbf5e4" fillOpacity="0.92" stroke={WINK} strokeWidth="0.6" />
      <g transform="translate(24 63.8) scale(0.36)"><TrainGlyph loco={loco} color="#3b2a17" /></g>
    </svg>
  );
}

/** Back of a train card (the closed deck), 48 × 72 view box. */
export function CardBack() {
  return (
    <svg viewBox="0 0 48 72" className="ttr-cardart" aria-hidden="true" focusable="false">
      <rect x="0.6" y="0.6" width="46.8" height="70.8" rx="5.5" fill="#24402f" stroke={WINK} strokeWidth="1.1" />
      <rect x="3.5" y="3.5" width="41" height="65" rx="4" fill="none" stroke="url(#ttr-gold)" strokeWidth="1.6" />
      <rect x="6.5" y="6.5" width="35" height="59" rx="3" fill="none" stroke="#d9a62e" strokeOpacity="0.5" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      <path d="M24 12 L36 36 L24 60 L12 36 Z" fill="#2f5a40" stroke="#d9a62e" strokeWidth="0.8" />
      <circle cx="24" cy="36" r="10" fill="#1b3024" stroke="url(#ttr-gold)" strokeWidth="1.4" />
      <g transform="translate(24 36.5) scale(0.42)"><TrainGlyph loco color="#e8c35f" /></g>
      {[[10, 10], [38, 10], [10, 62], [38, 62]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#d9a62e" />)}
    </svg>
  );
}

/** One claimed train car in the owner's colour, centred on the origin, rotated by the caller. */
export function Car({ len, seat }: { len: number; seat: number }) {
  const w = len, h = 11, x = -w / 2, y = -h / 2;
  const win = Math.max(1, Math.floor((w - 6) / 7));
  const ww = (w - 6) / win;
  return (
    <g>
      <rect x={x + 0.6} y={y + 1.8} width={w} height={h} rx="2.4" fill="#000" opacity="0.35" />
      <rect x={x} y={y} width={w} height={h} rx="2.4" fill={`url(#ttr-s-${seat})`} stroke="#120c05" strokeWidth="1" />
      <rect x={x + 1.5} y={y + 1} width={w - 3} height="2" rx="1" fill="#fff" fillOpacity="0.45" />
      {Array.from({ length: win }, (_, i) => <rect key={i} x={x + 3 + i * ww + 0.8} y={y + 3.6} width={ww - 1.6} height="3" rx="0.6" fill="#120c05" fillOpacity="0.55" />)}
      <rect x={x + 1} y={y + h - 2.6} width={w - 2} height="1.4" fill="#120c05" fillOpacity="0.35" />
      <circle cx={x + 3.2} cy={y + h} r="1.7" fill="#120c05" /><circle cx={x + w - 3.2} cy={y + h} r="1.7" fill="#120c05" />
    </g>
  );
}
