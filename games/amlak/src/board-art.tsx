// «املاک» board art: a printed Tehran board in a walnut frame. Real-board geometry (large corners, colour bands on the
// inner edge, owner ribbons on the outer edge), a painted Tehran skyline centre, the two
// card decks, 3D dice, houses/hotels, mortgage stamps and painted pewter tokens (car, samovar,
// ship, horse, plane, top hat; vector pawns for seats 7-8). Coordinates are literal (ltr); 1100×1100.
import type React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { MOTION, motionOff } from '@bg/ui';
import { BOARD, GROUP_COLOR, type Square } from './board.ts';
import type { AmlakView } from './rules.ts';
import tokCar from './art/tok-car.webp';
import tokSamovar from './art/tok-samovar.webp';
import tokShip from './art/tok-ship.webp';
import tokHorse from './art/tok-horse.webp';
import tokPlane from './art/tok-plane.webp';
import tokHat from './art/tok-hat.webp';
import houseImg from './art/house.webp';
import hotelImg from './art/hotel.webp';
import stationImg from './art/station.webp';
import waterImg from './art/water.webp';
import powerImg from './art/power.webp';
import chanceImg from './art/chance.webp';
import chestImg from './art/chest.webp';
import taxImg from './art/tax.webp';
import goImg from './art/go.webp';
import jailImg from './art/jail.webp';
import parkingImg from './art/parking.webp';
import policeImg from './art/police.webp';
import centreImg from './art/centre.webp';

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

// ---------- painted icons (WebP cut-outs from a generated sheet, see DECISIONS.md), centred at 0,0 ----------
const ICON: Partial<Record<Square['kind'], string>> = { station: stationImg, chance: chanceImg, chest: chestImg, tax: taxImg };
function Icon({ kind, nameFa }: { kind: Square['kind']; nameFa: string }) {
  const href = kind === 'utility' ? (nameFa.includes('آب') ? waterImg : powerImg) : ICON[kind];
  return href ? <image className="amb-ico" href={href} x="-26" y="-26" width="52" height="52" /> : null;
}

function House({ x, y }: { x: number; y: number }) {
  return <image className="amb-house" href={houseImg} x={x - 11} y={y - 12} width="22" height="22" />;
}
function Hotel({ x, y }: { x: number; y: number }) {
  return <image className="amb-hotel" href={hotelImg} x={x - 17} y={y - 19} width="34" height="34" />;
}

const TOKENS = [tokCar, tokSamovar, tokShip, tokHorse, tokPlane, tokHat];
/** Pawn silhouettes, one per seat; `shine` adds the dome highlight (board only: its gradient lives in the board defs). */
export function Token({ seat, shine }: { seat: number; shine?: boolean }) {
  // Seats 1-6: painted pewter tokens on a disc in the seat colour; seats 7-8 keep the vector silhouettes below.
  const img = TOKENS[seat];
  if (img) return (
    <g>
      <ellipse cy="9" rx="15" ry="6" fill={SEAT_COLORS[seat]} stroke="#1d1812" strokeWidth="1.6" />
      <image href={img} x="-17" y="-19" width="34" height="34" className="amb-pawn__img" />
    </g>
  );
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
      <text x={cx} y={g.y + 34} className="amb-corner__title">شروع</text>
      <image href={goImg} x={cx - 44} y={cy - 36} width="88" height="88" />
      <text x={cx} y={g.y + g.h - 10} className="amb-corner__small">۲۰۰ هزار تومان حقوق</text>
    </g>
  );
  if (i === 10) return (
    <g>
      <rect x={g.x + 46} y={g.y + 8} width="96" height="96" rx="6" className="amb-jail" />
      <image href={jailImg} x={g.x + 48} y={g.y + 10} width="92" height="92" />
      <text x={g.x + 94} y={g.y + 124} className="amb-corner__title amb-corner__title--jail">زندان</text>
      <text x={g.x + 24} y={g.y + 132} className="amb-corner__small">ملاقات</text>
    </g>
  );
  if (i === 20) return (
    <g>
      <image href={parkingImg} x={cx - 50} y={cy - 62} width="100" height="100" />
      <text x={cx} y={cy + 52} className="amb-corner__title">پارکینگ</text>
    </g>
  );
  return (
    <g>
      <image href={policeImg} x={cx - 48} y={cy - 64} width="96" height="96" />
      <text x={cx} y={cy + 50} className="amb-corner__title">برو به زندان</text>
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
export function Die({ v, x, y, rot, rollKey, i, pending }: { v: number; x: number; y: number; rot: number; rollKey: number; i: number; pending?: boolean }) {
  // pending: the own roll waits in the undo window or for the server — tumble with pips hidden; the result is thrown in.
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g key={pending ? 'pending' : rollKey} className={pending ? 'amb-die bg-tumble' : 'amb-die bg-roll'} style={{ ['--i' as string]: i }}>
        <rect x="-34" y="-30" width="68" height="68" rx="14" className="amb-die__shadow" />
        <rect x="-34" y="-34" width="68" height="68" rx="14" className="amb-die__face" />
        <rect x="-34" y="-34" width="68" height="68" rx="14" fill="url(#amb-die-sheen)" />
        {PIPS[v]!.map(([px, py], k) => <circle key={k} cx={px * 17} cy={py * 17} r="6.5" className="amb-die__pip" />)}
      </g>
    </g>
  );
}

/** Where a seat's token stands now (several tokens on one square spread out; jail splits prisoners and visitors). */
function tokenXY(view: AmlakView, seat: number): [number, number] {
  const pl = view.p[seat]!, i = pl.pos, g = geo(i);
  const here = view.p.map((q, s) => ({ q, s })).filter((t) => !t.q.bankrupt && t.q.pos === i);
  const k = here.findIndex((t) => t.s === seat), n = here.length;
  const [bx, by] = i === 10 ? (pl.inJail ? [g.x + 94, g.y + 66] : [g.x + 24, g.y + 74]) : [g.x + g.w / 2, g.y + g.h / 2 + 18];
  const tx = bx + (n > 1 && i !== 10 ? ((k % 3) - (Math.min(n, 3) - 1) / 2) * 24 : i === 10 ? (k % 2) * 18 - 9 : 0);
  const ty = by + (n > 3 && i !== 10 ? (Math.floor(k / 3) - 0.5) * 24 : i === 10 ? Math.floor(k / 2) * 20 - 10 : 0);
  return [tx, ty];
}
const centre = (i: number): [number, number] => { const g = geo(i); return [g.x + g.w / 2, g.y + g.h / 2 + 18]; };
/** Squares a token passes from `o` to `p`: forward square by square (backward for a short step back); jail is a straight jump. */
function walk(o: number, p: number, jailed: boolean): number[] {
  const f = (p - o + 40) % 40;
  if (jailed || f === 0) return [o, p];
  const back = 40 - f <= 3, n = back ? 40 - f : f;
  return Array.from({ length: n + 1 }, (_, k) => (o + (back ? -k : k) + 40) % 40);
}

export function AmlakBoard({ view, selected, onSelect, seatName, rollKey, rolling }: {
  view: AmlakView; selected: number | null; onSelect: (i: number) => void; seatName: (s: number) => string; rollKey: number; rolling?: boolean;
}) {
  const roll = view.lastRoll;
  // Tokens walk square by square along the track (after the dice land), instead of jumping across the board.
  const svg = useRef<SVGSVGElement>(null);
  const sig = view.p.map((q) => `${q.pos}${q.inJail ? 'j' : ''}${q.bankrupt ? 'x' : ''}`).join(',');
  const before = useRef({ p: view.p, roll: rollKey });
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = { p: view.p, roll: rollKey };
    const host = svg.current;
    if (!host || motionOff()) return;
    const wait = prev.roll !== rollKey ? MOTION.roll * 0.8 + 110 : 0;
    view.p.forEach((q, seat) => {
      const o = prev.p[seat];
      const el = host.querySelector<SVGGElement>(`[data-pawn="${seat}"]`);
      if (!o || !el || q.bankrupt) return;
      const [fx, fy] = tokenXY(view, seat);
      if (o.pos === q.pos) return;
      const sq = walk(o.pos, q.pos, q.inJail && !o.inJail);
      const pts = sq.map((i, k) => (k === sq.length - 1 ? [fx, fy] : centre(i)));
      el.animate(pts.map(([x, y], k) => ({ transform: `translate(${x! - fx}px, ${y! - fy}px) scale(${k && k < pts.length - 1 ? 1.1 : 1})` })),
        { duration: Math.min(360 + pts.length * 180, 2600), delay: wait, easing: 'linear', fill: 'backwards' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (
    <svg ref={svg} className="amb" viewBox="-28 -28 1156 1156" role="group" aria-label="صفحه مونوپولی" style={{ direction: 'ltr' }}>
      <defs>
        <linearGradient id="amb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a32" /><stop offset="0.5" stopColor="#6b4423" /><stop offset="1" stopColor="#3d2410" /></linearGradient>
        <linearGradient id="amb-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6dc8e" /><stop offset="0.5" stopColor="#b88a2e" /><stop offset="1" stopColor="#7a5a14" /></linearGradient>
        <pattern id="amb-grain" width="60" height="10" patternUnits="userSpaceOnUse"><path d="M0 3 Q15 0 30 3 T60 3 M0 8 Q15 5 30 8 T60 8" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" /></pattern>
        <pattern id="amb-arches" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10 V6 A5 5 0 0 1 10 6 V10" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" /><circle cx="5" cy="3.4" r="0.9" fill="#fff" fillOpacity="0.6" /></pattern>
        <linearGradient id="amb-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#f3ead2" /></linearGradient>
        <linearGradient id="amb-band-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></linearGradient>
        <linearGradient id="amb-die-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.85" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></linearGradient>
        <radialGradient id="amb-dome" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.75" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.45" /></radialGradient>
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
      <image href={centreImg} x={C} y={C} width={S - 2 * C} height={S - 2 * C} preserveAspectRatio="xMidYMid slice" />
      <rect x={350} y={372} width={400} height={186} rx="22" className="amb-title__plate" />
      <rect x={C + 12} y={C + 12} width={S - 2 * C - 24} height={S - 2 * C - 24} className="amb-tiles amb-tiles--a" />
      <rect x={C + 12} y={C + 12} width={S - 2 * C - 24} height={S - 2 * C - 24} className="amb-tiles amb-tiles--b" />
      <rect x={C + 21} y={C + 21} width={S - 2 * C - 42} height={S - 2 * C - 42} className="amb-tiles__line" />
      <g className="amb-title">
        <text x="550" y="452" className="amb-title__fa">مونوپولی</text>
        <path d="M 400 478 H 520 M 580 478 H 700" className="amb-title__rule" />
        <path d="M 550 468 L 560 478 L 550 488 L 540 478 Z" className="amb-title__gem" />
        <text x="550" y="528" className="amb-title__sub">خیابان‌های تهران</text>
      </g>
      <g data-flip-anchor="deck-chance"><Deck x={318} y={318} label="شانس" kind="chance" count={view.deckCounts.chance} /></g>
      <g data-flip-anchor="deck-chest"><Deck x={782} y={782} label="صندوق" kind="chest" count={view.deckCounts.chest} /></g>
      {(roll || rolling) && (
        <g aria-label={rolling || !roll ? 'تاس‌ها در حال چرخیدن' : `آخرین تاس: ${fa(roll[0])} و ${fa(roll[1])}`} role="img">
          <Die v={roll?.[0] ?? 1} x={500} y={612} rot={-12} rollKey={rollKey} i={0} pending={rolling} />
          <Die v={roll?.[1] ?? 1} x={604} y={600} rot={9} rollKey={rollKey} i={1} pending={rolling} />
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
              <g className="amb-mortgage" data-flip={`mort-${i}`}>
                <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="url(#amb-hatch)" />
                <text x={g.x + g.w / 2} y={g.y + g.h / 2 + 8} transform={`rotate(-30 ${g.x + g.w / 2} ${g.y + g.h / 2})`} className="amb-mortgage__stamp">رهن</text>
              </g>
            )}
            {owner !== null && owner !== undefined && rb && (
              <g className="amb-owner" data-flip={`own-${i}`}>
                <rect x={rb.x} y={rb.y} width={rb.w} height={rb.h} rx="3" fill={SEAT_COLORS[owner]} />
              </g>
            )}
            {bd && h > 0 && h < 5 && Array.from({ length: h }, (_, k) => {
              const t = (k + 0.5) / 4;
              return <g key={k} data-flip={`house-${i}-${k}`}>{portrait ? <House x={bd.x + bd.w * t} y={bd.y + bd.h / 2} /> : <House x={bd.x + bd.w / 2} y={bd.y + bd.h * t} />}</g>;
            })}
            {bd && h === 5 && <g data-flip={`hotel-${i}`}><Hotel x={bd.x + bd.w / 2} y={bd.y + bd.h / 2} /></g>}
            {tokens.map((t) => {
              const [tx, ty] = tokenXY(view, t.seat);
              return (
                <g key={t.seat} transform={`translate(${tx} ${ty})`}>
                  <g data-pawn={t.seat} className={t.seat === view.current && !view.outcome ? 'amb-pawn amb-pawn--turn' : 'amb-pawn'}>
                    <ellipse cx="1" cy="14" rx="16" ry="5" className="amb-pawn__shadow" />
                    <Token seat={t.seat} shine />
                    <g transform="translate(13 -12)"><circle r="8" className="amb-pawn__badge" /><text y="4" className="amb-pawn__n">{fa(t.seat + 1)}</text></g>
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
