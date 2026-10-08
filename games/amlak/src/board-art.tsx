// «املاک» board art: a printed Tehran board in a walnut frame. Real-board geometry (large corners, colour bands on the
// inner edge, owner ribbons on the outer edge), a girih-tile centre with the Alborz, Milad and Azadi skyline, the two
// card decks, 3D dice, houses/hotels, mortgage stamps and eight distinct pawn tokens (pawn, tea glass, car, top hat, tower,
// crown, boat, pomegranate). Coordinates are literal (ltr); 1100×1100.
import type React from 'react';
import { BOARD, GROUP_COLOR, type Square } from './board.ts';
import type { AmlakView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const SEAT_COLORS = ['#d62f35', '#1c63c9', '#23843f', '#e0a400', '#7a3fa0', '#e06a1b', '#0f8f8f', '#6b4f3a'];
const S = 1100;
const C = 150; // corner size
const W = (S - 2 * C) / 9; // edge square width
const BAND = 30;

type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';
interface Geo { x: number; y: number; w: number; h: number; side: Side }
/** Square geometry: 0 is the bottom-right corner, then counter-clockwise like the classic board. */
export function geo(i: number): Geo {
  if (i === 0) return { x: S - C, y: S - C, w: C, h: C, side: 'corner' };
  if (i < 10) return { x: S - C - i * W, y: S - C, w: W, h: C, side: 'bottom' };
  if (i === 10) return { x: 0, y: S - C, w: C, h: C, side: 'corner' };
  if (i < 20) return { x: 0, y: S - C - (i - 10) * W, w: C, h: W, side: 'left' };
  if (i === 20) return { x: 0, y: 0, w: C, h: C, side: 'corner' };
  if (i < 30) return { x: C + (i - 21) * W, y: 0, w: W, h: C, side: 'top' };
  if (i === 30) return { x: S - C, y: 0, w: C, h: C, side: 'corner' };
  return { x: S - C, y: C + (i - 31) * W, w: C, h: W, side: 'right' };
}
/** Colour band rectangle on the square's inner edge. */
function band(g: Geo) {
  switch (g.side) {
    case 'bottom': return { x: g.x, y: g.y, w: g.w, h: BAND };
    case 'top': return { x: g.x, y: g.y + g.h - BAND, w: g.w, h: BAND };
    case 'left': return { x: g.x + g.w - BAND, y: g.y, w: BAND, h: g.h };
    case 'right': return { x: g.x, y: g.y, w: BAND, h: g.h };
    default: return null;
  }
}
/** Owner ribbon on the outer edge. */
function ribbon(g: Geo) {
  const t = 9;
  switch (g.side) {
    case 'bottom': return { x: g.x + 3, y: g.y + g.h - t, w: g.w - 6, h: t };
    case 'top': return { x: g.x + 3, y: g.y, w: g.w - 6, h: t };
    case 'left': return { x: g.x, y: g.y + 3, w: t, h: g.h - 6 };
    case 'right': return { x: g.x + g.w - t, y: g.y + 3, w: t, h: g.h - 6 };
    default: return null;
  }
}
/** Content area (without band), where the name, icon and price go. */
function body(g: Geo) {
  switch (g.side) {
    case 'bottom': return { x: g.x, y: g.y + BAND, w: g.w, h: g.h - BAND };
    case 'top': return { x: g.x, y: g.y, w: g.w, h: g.h - BAND };
    case 'left': return { x: g.x, y: g.y, w: g.w - BAND, h: g.h };
    case 'right': return { x: g.x + BAND, y: g.y, w: g.w - BAND, h: g.h };
    default: return g;
  }
}
const lines = (name: string) => { const p = name.split(' '); return p.length < 2 ? [name] : [p.slice(0, -1).join(' '), p.at(-1)!]; };

// ---------- small vector icons (centred at 0,0, ~40px) ----------
function Icon({ kind, nameFa }: { kind: Square['kind']; nameFa: string }) {
  switch (kind) {
    case 'station':
      return (
        <g className="amb-ico">
          <rect x="-15" y="-20" width="30" height="34" rx="7" fill="#2b2f36" />
          <rect x="-10" y="-14" width="20" height="11" rx="2" fill="#bfe3ef" />
          <circle cx="-7" cy="5" r="3" fill="#ffd36b" /><circle cx="7" cy="5" r="3" fill="#ffd36b" />
          <path d="M-12 14 L-17 22 M12 14 L17 22" stroke="#2b2f36" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'utility':
      return nameFa.includes('آب')
        ? <path className="amb-ico" d="M0 -22 C 10 -8 16 0 16 8 A 16 16 0 0 1 -16 8 C -16 0 -10 -8 0 -22 Z" fill="#2a8fd6" stroke="#145a8a" strokeWidth="2" />
        : (
          <g className="amb-ico">
            <circle cx="0" cy="-6" r="14" fill="#ffd94a" stroke="#a8860a" strokeWidth="2" />
            <rect x="-7" y="7" width="14" height="10" rx="2" fill="#7c7f86" />
            <path d="M-4 -8 L0 -2 L4 -8" fill="none" stroke="#a8860a" strokeWidth="2" />
          </g>
        );
    case 'chance':
      return <text className="amb-ico amb-ico--chance" y="16">؟</text>;
    case 'chest':
      return (
        <g className="amb-ico">
          <rect x="-18" y="-8" width="36" height="24" rx="3" fill="#1f7a8c" stroke="#0d3e48" strokeWidth="2" />
          <path d="M-18 -8 Q0 -26 18 -8 Z" fill="#2a9bb0" stroke="#0d3e48" strokeWidth="2" />
          <rect x="-4" y="-4" width="8" height="9" rx="1.5" fill="#f2c94c" />
        </g>
      );
    case 'tax':
      return (
        <g className="amb-ico">
          {[0, 1, 2].map((k) => <ellipse key={k} cx="0" cy={10 - k * 9} rx="16" ry="6" fill="#e2b43b" stroke="#8a6b12" strokeWidth="2" />)}
        </g>
      );
    default: return null;
  }
}

function House({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path className="amb-house" d={`M ${x - 7} ${y + 7} L ${x - 7} ${y - 1} L ${x + 7} ${y - 1} L ${x + 7} ${y + 7} Z`} />
      <path className="amb-house__roof" d={`M ${x - 9} ${y - 1} L ${x} ${y - 9} L ${x + 9} ${y - 1} Z`} />
      <rect x={x - 1.8} y={y + 2} width="3.6" height="5" fill="#1f1a14" opacity="0.6" />
    </g>
  );
}
function Hotel({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path className="amb-hotel" d={`M ${x - 16} ${y + 8} L ${x - 16} ${y - 4} L ${x} ${y - 11} L ${x + 16} ${y - 4} L ${x + 16} ${y + 8} Z`} />
      {[-9, -2.5, 4].map((dx) => <rect key={dx} x={x + dx} y={y - 3} width="5.5" height="6" rx="1" fill="#fff4c9" />)}
    </g>
  );
}

/** Pawn silhouettes, one per seat; `shine` adds the dome highlight (board only: its gradient lives in the board defs). */
export function Token({ seat, shine }: { seat: number; shine?: boolean }) {
  const fill = SEAT_COLORS[seat] ?? '#888';
  const shapes = (f: string, cls?: string) => {
    const k = seat % 8;
    const g = (kids: React.ReactNode) => <g fill={f} className={cls}>{kids}</g>;
    switch (k) {
      case 0: return g(<><circle cy="-10" r="6" /><path d="M-5 -4 Q-3 4 -9 11 H9 Q3 4 5 -4Z" /><rect x="-11" y="10" width="22" height="4.5" rx="2.2" /></>);
      case 1: return g(<><path d="M-9 -13 H9 L7 8 Q0 12 -7 8Z" /><ellipse cy="12" rx="14" ry="3.6" /></>);
      case 2: return g(<><path d="M-16 9 V1 L-10 -2 L-6 -10 H5 L10 -2 L16 1 V9Z" /><circle cx="-8" cy="9" r="4" /><circle cx="8" cy="9" r="4" /></>);
      case 3: return g(<><rect x="-8" y="-13" width="16" height="19" rx="2" /><ellipse cy="7" rx="15" ry="4.2" /></>);
      case 4: return g(<path d="M-10 13 V1 H-8 V-13 H-4.5 V-8.5 H-1.8 V-13 H1.8 V-8.5 H4.5 V-13 H8 V1 H10 V13Z" />);
      case 5: return g(<path d="M-13 11 L-15 -9 L-7 -2 L0 -13 L7 -2 L15 -9 L13 11Z" />);
      case 6: return g(<><path d="M-15 4 H15 L10 13 H-10Z" /><path d="M1 -14 V2 H12Z" /><path d="M-1 -9 V2 H-11Z" /></>);
      default: return g(<><circle cy="3" r="11" /><path d="M-6 -7 L-4 -13 L0 -9 L4 -13 L6 -7Z" /></>);
    }
  };
  return (
    <g strokeLinejoin="round">
      <g className="amb-pawn__body" strokeWidth="3" paintOrder="stroke">{shapes(fill)}</g>
      {seat % 8 === 2 && <path d="M-8 -3.5 H-4 V-8 H-6 Z M-1 -3.5 H4 L6 -3.5 L3 -8 H-1 Z" fill="#dff3fb" />}
      {seat % 8 === 3 && <rect x="-8" y="0" width="16" height="4" fill="rgb(0 0 0 / 0.35)" />}
      {shine && shapes('url(#amb-dome)', 'amb-pawn__shine')}
    </g>
  );
}

/** Azadi Tower and Milad Tower silhouettes (centre of the board, deed watermark, cover). Origin at the ground, ~100 tall. */
export function Landmarks({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M-46 0 L-34 -42 Q-22 -62 -10 -42 L2 0 L-12 0 Q-22 -26 -32 0 Z" />
      <rect x="-30" y="-52" width="16" height="6" rx="2" />
      <path d="M18 0 L21 -74 L25 -74 L28 0 Z" />
      <path d="M12 -84 Q23 -100 34 -84 L31 -74 L15 -74 Z" />
      <rect x="22" y="-124" width="2" height="42" />
    </g>
  );
}

function Corner({ i, g }: { i: number; g: Geo }) {
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  if (i === 0) return (
    <g>
      <text x={cx} y={cy - 26} className="amb-corner__title">شروع</text>
      <text x={cx} y={cy - 2} className="amb-corner__small">۲۰۰ هزار تومان حقوق</text>
      <path d={`M ${cx + 46} ${cy + 34} L ${cx - 30} ${cy + 34} M ${cx - 30} ${cy + 34} l 18 -14 M ${cx - 30} ${cy + 34} l 18 14`} className="amb-go-arrow" />
    </g>
  );
  if (i === 10) return (
    <g>
      <rect x={g.x + 46} y={g.y + 8} width="96" height="96" rx="6" className="amb-jail" />
      {[0, 1, 2, 3].map((k) => <line key={k} x1={g.x + 62 + k * 21} y1={g.y + 12} x2={g.x + 62 + k * 21} y2={g.y + 100} className="amb-jail__bar" />)}
      <text x={g.x + 94} y={g.y + 62} className="amb-corner__title amb-corner__title--jail">زندان</text>
      <text x={g.x + 24} y={g.y + 132} className="amb-corner__small">ملاقات</text>
    </g>
  );
  if (i === 20) return (
    <g>
      <rect x={cx - 34} y={cy - 46} width="68" height="56" rx="10" className="amb-park" />
      <text x={cx} y={cy - 4} className="amb-park__p">P</text>
      <text x={cx} y={cy + 42} className="amb-corner__title">پارکینگ</text>
    </g>
  );
  return (
    <g>
      <circle cx={cx} cy={cy - 18} r="30" className="amb-police" />
      <path d={`M ${cx - 12} ${cy - 22} l 12 -10 l 12 10 v 12 h -24 z`} fill="#fff" />
      <text x={cx} y={cy + 36} className="amb-corner__title">برو به زندان</text>
    </g>
  );
}

function Skyline() {
  // Dusk over Tehran: sun, three Alborz ridges, low city, Milad Tower and Azadi Tower — the centre's signature.
  const base = 836;
  return (
    <g className="amb-sky" aria-hidden="true">
      <circle cx="560" cy={base - 150} r="150" fill="url(#amb-sun)" />
      <circle cx="560" cy={base - 150} r="62" className="amb-sky__sun" />
      <path d={`M 170 ${base - 120} L 250 ${base - 190} L 310 ${base - 150} L 390 ${base - 240} L 470 ${base - 150} L 540 ${base - 200} L 620 ${base - 130} L 700 ${base - 225} L 790 ${base - 140} L 870 ${base - 190} L 930 ${base - 110} L 930 ${base} L 170 ${base} Z`} className="amb-sky__far" />
      <path d={`M 170 ${base - 70} L 260 ${base - 150} L 330 ${base - 105} L 400 ${base - 190} L 480 ${base - 110} L 560 ${base - 160} L 640 ${base - 90} L 710 ${base - 175} L 800 ${base - 100} L 870 ${base - 135} L 930 ${base - 70} L 930 ${base} L 170 ${base} Z`} className="amb-sky__mount" />
      <path d={`M 400 ${base - 190} L 378 ${base - 170} L 391 ${base - 165} L 400 ${base - 175} L 411 ${base - 163} L 424 ${base - 170} Z M 710 ${base - 175} L 691 ${base - 158} L 704 ${base - 154} L 714 ${base - 163} Z`} className="amb-sky__snow" />
      {[[190, 36], [222, 58], [252, 32], [284, 48], [316, 26], [612, 40], [640, 66], [672, 36], [720, 54], [752, 28], [786, 46], [820, 34], [852, 56], [884, 30]].map(([x, h]) => (
        <g key={x}>
          <rect x={x} y={base - h!} width="26" height={h} className="amb-sky__city" />
          {h! > 40 && <rect x={x! + 6} y={base - h! + 8} width="4" height="5" className="amb-sky__win" />}
        </g>
      ))}
      <rect x="170" y={base - 8} width="760" height="8" className="amb-sky__ink" />
      <g transform={`translate(520 ${base - 6})`}>
        {/* Milad: shaft, pod, mast; Azadi: legs, arch and lantern */}
        <Landmarks fill="#1d3a5f" />
        <path d="M-32 -48 Q-22 -64 -12 -48" fill="none" stroke="#f7d9a8" strokeWidth="2" opacity="0.7" />
        <circle cx="23" cy="-90" r="2.2" fill="#f7d9a8" /><circle cx="23" cy="-80" r="2.2" fill="#f7d9a8" />
        <rect x="22" y="-126" width="2" height="8" fill="#c8372d" />
      </g>
      <g transform={`translate(780 ${base - 6}) scale(0.6)`} opacity="0.55"><Landmarks fill="#1d3a5f" /></g>
    </g>
  );
}

function Deck({ x, y, label, kind, count }: { x: number; y: number; label: string; kind: 'chance' | 'chest'; count: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-45)`} className={`amb-deck amb-deck--${kind}`} aria-hidden="true">
      <rect x="-92" y="-56" width="184" height="112" rx="12" className="amb-deck__shadow" />
      <rect x="-90" y="-58" width="180" height="112" rx="12" className="amb-deck__card" />
      <rect x="-80" y="-48" width="160" height="92" rx="8" className="amb-deck__inner" />
      <text y="2" className="amb-deck__label">{label}</text>
      <text y="30" className="amb-deck__count">{fa(count)} کارت</text>
    </g>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
};
export function Die({ v, x, y, rot, rollKey }: { v: number; x: number; y: number; rot: number; rollKey: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g key={rollKey} className="amb-die">
        <rect x="-34" y="-30" width="68" height="68" rx="14" className="amb-die__shadow" />
        <rect x="-34" y="-34" width="68" height="68" rx="14" className="amb-die__face" />
        <rect x="-34" y="-34" width="68" height="68" rx="14" fill="url(#amb-die-sheen)" />
        {PIPS[v]!.map(([px, py], k) => <circle key={k} cx={px * 17} cy={py * 17} r="6.5" className="amb-die__pip" />)}
      </g>
    </g>
  );
}

export function AmlakBoard({ view, selected, onSelect, seatName, rollKey }: {
  view: AmlakView; selected: number | null; onSelect: (i: number) => void; seatName: (s: number) => string; rollKey: number;
}) {
  const roll = view.lastRoll;
  return (
    <svg className="amb" viewBox="-28 -28 1156 1156" role="group" aria-label="صفحه املاک" style={{ direction: 'ltr' }}>
      <defs>
        <linearGradient id="amb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a32" /><stop offset="0.5" stopColor="#6b4423" /><stop offset="1" stopColor="#3d2410" /></linearGradient>
        <linearGradient id="amb-field" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bfd9e6" /><stop offset="0.55" stopColor="#f8eed6" /><stop offset="1" stopColor="#f3cf9f" /></linearGradient>
        <radialGradient id="amb-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
        <linearGradient id="amb-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6dc8e" /><stop offset="0.5" stopColor="#b88a2e" /><stop offset="1" stopColor="#7a5a14" /></linearGradient>
        <pattern id="amb-grain" width="60" height="10" patternUnits="userSpaceOnUse"><path d="M0 3 Q15 0 30 3 T60 3 M0 8 Q15 5 30 8 T60 8" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" /></pattern>
        <pattern id="amb-arches" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10 V6 A5 5 0 0 1 10 6 V10" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" /><circle cx="5" cy="3.4" r="0.9" fill="#fff" fillOpacity="0.6" /></pattern>
        <linearGradient id="amb-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#f3ead2" /></linearGradient>
        <linearGradient id="amb-band-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></linearGradient>
        <linearGradient id="amb-die-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.85" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></linearGradient>
        <radialGradient id="amb-dome" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.75" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></radialGradient>
        <pattern id="amb-girih" width="88" height="88" patternUnits="userSpaceOnUse">
          <path d="M44 6 L54 34 L82 44 L54 54 L44 82 L34 54 L6 44 L34 34 Z" className="amb-girih" />
          <rect x="26" y="26" width="36" height="36" transform="rotate(45 44 44)" className="amb-girih" />
          <circle cx="0" cy="0" r="8" className="amb-girih" /><circle cx="88" cy="0" r="8" className="amb-girih" />
          <circle cx="0" cy="88" r="8" className="amb-girih" /><circle cx="88" cy="88" r="8" className="amb-girih" />
        </pattern>
        <pattern id="amb-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#3a2a1a" strokeOpacity="0.35" strokeWidth="5" />
        </pattern>
      </defs>

      {/* frame */}
      <rect x="-28" y="-28" width="1156" height="1156" rx="26" fill="url(#amb-wood)" className="amb-frame" />
      <rect x="-28" y="-28" width="1156" height="1156" rx="26" fill="url(#amb-grain)" />
      <rect x="-10" y="-10" width="1120" height="1120" rx="10" className="amb-frame__inlay" />
      <rect x="-17" y="-17" width="1134" height="1134" rx="16" fill="none" stroke="#c9a24a" strokeWidth="1.2" opacity="0.55" />
      {[[-15, -15], [1115, -15], [-15, 1115], [1115, 1115]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="7" fill="url(#amb-brass)" stroke="#2a170a" strokeWidth="1.5" />)}
      <rect x="0" y="0" width={S} height={S} fill="url(#amb-paper)" className="amb-print" />

      {/* centre */}
      <rect x={C} y={C} width={S - 2 * C} height={S - 2 * C} fill="url(#amb-field)" />
      <rect x={C} y={C} width={S - 2 * C} height={S - 2 * C} fill="url(#amb-girih)" />
      <Skyline />
      <rect x={C + 12} y={C + 12} width={S - 2 * C - 24} height={S - 2 * C - 24} className="amb-tiles amb-tiles--a" />
      <rect x={C + 12} y={C + 12} width={S - 2 * C - 24} height={S - 2 * C - 24} className="amb-tiles amb-tiles--b" />
      <rect x={C + 21} y={C + 21} width={S - 2 * C - 42} height={S - 2 * C - 42} className="amb-tiles__line" />
      <g className="amb-title">
        <text x="550" y="452" className="amb-title__fa">املاک</text>
        <path d="M 400 478 H 520 M 580 478 H 700" className="amb-title__rule" />
        <path d="M 550 468 L 560 478 L 550 488 L 540 478 Z" className="amb-title__gem" />
        <text x="550" y="528" className="amb-title__sub">خیابان‌های تهران</text>
      </g>
      <Deck x={318} y={318} label="شانس" kind="chance" count={view.deckCounts.chance} />
      <Deck x={782} y={782} label="صندوق" kind="chest" count={view.deckCounts.chest} />
      {roll && (
        <g aria-label={`آخرین تاس: ${fa(roll[0])} و ${fa(roll[1])}`} role="img">
          <Die v={roll[0]} x={500} y={612} rot={-12} rollKey={rollKey} />
          <Die v={roll[1]} x={604} y={600} rot={9} rollKey={rollKey} />
        </g>
      )}
      {view.rules.freeParking && view.pot > 0 && (
        <g className="amb-pot"><circle cx="232" cy="232" r="38" /><text x="232" y="228">صندوق</text><text x="232" y="250">{fa(view.pot)}</text></g>
      )}

      {/* squares */}
      {BOARD.map((b, i) => {
        const g = geo(i);
        const bd = band(g);
        const bo = body(g);
        const owner = view.owner[i];
        const h = view.houses[i]!;
        const rb = ribbon(g);
        const tokens = view.p.map((pl, seat) => ({ pl, seat })).filter((t) => !t.pl.bankrupt && t.pl.pos === i);
        const label = `${b.nameFa}${'price' in b ? `، ${fa(b.price)} هزار تومان` : ''}${owner !== null && owner !== undefined ? `، مالک ${seatName(owner)}` : ''}${h ? `، ${h === 5 ? 'هتل' : `${fa(h)} خانه`}` : ''}${view.mortgaged[i] ? '، در رهن' : ''}${tokens.length ? `، اینجا: ${tokens.map((t) => seatName(t.seat)).join('، ')}` : ''}`;
        const portrait = g.side === 'top' || g.side === 'bottom';
        const nameLines = lines(b.nameFa);
        const mid = { x: bo.x + bo.w / 2, y: bo.y + bo.h / 2 };
        return (
          <g key={i} className={['amb-sq', selected === i ? 'amb-sq--sel' : '', g.side === 'corner' ? 'amb-sq--corner' : ''].join(' ')} role="button" tabIndex={0} aria-label={label}
            aria-pressed={selected === i} onClick={() => onSelect(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } }}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} className="amb-sq__bg" />
            {b.kind === 'street' && bd && (
              <>
                <rect x={bd.x} y={bd.y} width={bd.w} height={bd.h} fill={GROUP_COLOR[b.group]} className="amb-band" />
                <rect x={bd.x} y={bd.y} width={bd.w} height={bd.h} fill="url(#amb-arches)" />
                <rect x={bd.x} y={bd.y} width={bd.w} height={bd.h} fill="url(#amb-band-sheen)" />
              </>
            )}
            {g.side === 'corner' ? <Corner i={i} g={g} /> : (
              <>
                {b.kind !== 'street' && <g transform={`translate(${mid.x} ${portrait ? bo.y + 30 : mid.y - 20}) scale(${portrait ? 0.85 : 0.65})`}><Icon kind={b.kind} nameFa={b.nameFa} /></g>}
                {nameLines.map((ln, k) => {
                  // Name block sits between the icon (non-streets) and the price line; never overlaps the price.
                  const step = b.kind === 'street' ? 19 : 16;
                  const y0 = b.kind === 'street'
                    ? (portrait ? bo.y + 34 : mid.y - 10 - (nameLines.length - 1) * 9)
                    : (portrait ? bo.y + 68 : mid.y + (nameLines.length === 1 ? 16 : 9));
                  return <text key={k} x={mid.x} y={y0 + k * step} className={b.kind === 'street' ? 'amb-sq__name' : 'amb-sq__name amb-sq__name--sm'}>{ln}</text>;
                })}
                {('price' in b || b.kind === 'tax') && (
                  <text x={mid.x} y={portrait ? bo.y + bo.h - 12 : mid.y + (b.kind === 'street' ? 34 : 40)} className="amb-sq__price">{fa('price' in b ? b.price : b.kind === 'tax' ? b.amount : 0)}</text>
                )}
              </>
            )}
            {view.mortgaged[i] && (
              <g className="amb-mortgage">
                <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="url(#amb-hatch)" />
                <text x={g.x + g.w / 2} y={g.y + g.h / 2 + 8} transform={`rotate(-30 ${g.x + g.w / 2} ${g.y + g.h / 2})`} className="amb-mortgage__stamp">رهن</text>
              </g>
            )}
            {owner !== null && owner !== undefined && rb && (
              <g className="amb-owner">
                <rect x={rb.x} y={rb.y} width={rb.w} height={rb.h} rx="3" fill={SEAT_COLORS[owner]} />
              </g>
            )}
            {bd && h > 0 && h < 5 && Array.from({ length: h }, (_, k) => {
              const t = (k + 0.5) / 4;
              return portrait ? <House key={k} x={bd.x + bd.w * t} y={bd.y + bd.h / 2} /> : <House key={k} x={bd.x + bd.w / 2} y={bd.y + bd.h * t} />;
            })}
            {bd && h === 5 && <Hotel x={bd.x + bd.w / 2} y={bd.y + bd.h / 2} />}
            {tokens.map((t, k) => {
              const n = tokens.length;
              // Jail corner: prisoners inside the cell, visitors on the «ملاقات» strip.
              const [bx, by] = i === 10 ? (t.pl.inJail ? [g.x + 94, g.y + 66] : [g.x + 24, g.y + 74]) : [g.x + g.w / 2, g.y + g.h / 2 + 18];
              const tx = bx + (n > 1 && i !== 10 ? ((k % 3) - (Math.min(n, 3) - 1) / 2) * 24 : i === 10 ? (k % 2) * 18 - 9 : 0);
              const ty = by + (n > 3 && i !== 10 ? (Math.floor(k / 3) - 0.5) * 24 : i === 10 ? Math.floor(k / 2) * 20 - 10 : 0);
              return (
                <g key={t.seat} className={t.seat === view.current && !view.outcome ? 'amb-pawn amb-pawn--turn' : 'amb-pawn'} transform={`translate(${tx} ${ty})`}>
                  <ellipse cx="1" cy="14" rx="16" ry="5" className="amb-pawn__shadow" />
                  <Token seat={t.seat} shine />
                  <g transform="translate(13 -12)"><circle r="8" className="amb-pawn__badge" /><text y="4" className="amb-pawn__n">{fa(t.seat + 1)}</text></g>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
