// Ticket to Ride renderer: the chosen map (cities, coloured route slots, claimed trains in seat colours) in a
// ZoomBoard, plus panels driven by the phase and legal actions: ticket choice, face-up cards and deck, claiming a route
// (colour + locomotives), own hand and tickets, players, final scores and log. Shows only the projection.
import './renderer.css';
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { BOARDS, COLORS, COLOR_FA, LOCO, ROUTE_POINTS, TRAINS, type Board, type MapId } from './board.ts';
import { CAR_H, CITY_R, layoutOf, type Pt } from './geometry.ts';
import { Car, CardArt, CardBack, Cartouche, Compass, GRAY, INK, MapDefs, TrainGlyph, ON, SEAT_COLOR, SEAT_FA, SEAT_INK, SHADES, colorIx } from './art.tsx';
import type { LogEntry, TtrView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
/** Isolate a (possibly Latin) player name inside Persian text. */
const iso = (s: string) => `⁨${s}⁩`;
type Hint = { type: string; [k: string]: unknown };
type Pay = { color: number; minLocos: number; maxLocos: number };
const CARD_FA = (c: number) => (c === LOCO ? COLOR_FA.loco : COLOR_FA[COLORS[c]!]);
const routeName = (b: Board, r: number) => `${b.cities[b.routes[r]!.a]!.fa}–${b.cities[b.routes[r]!.b]!.fa}`;
const ticketName = (b: Board, t: number) => `${b.cities[b.tickets[t]!.a]!.fa} ← ${b.cities[b.tickets[t]!.b]!.fa}`;

function describe(e: LogEntry, b: Board, name: (s: number) => string): string {
  const n = (s: number) => iso(name(s));
  switch (e.t) {
    case 'start': return `بازی روی نقشه ${b.nameFa} شروع شد؛ همه بلیت‌های مقصد را انتخاب می‌کنند و بعد ${n(e.first)} شروع می‌کند.`;
    case 'keep': return `${n(e.seat)} ${fa(e.kept)} بلیت از ${fa(e.offered)} نگه داشت.`;
    case 'market': return `${n(e.seat)} کارت ${CARD_FA(e.color)} رو را برداشت.`;
    case 'deck': return `${n(e.seat)} یک کارت از دسته بسته کشید.`;
    case 'tickets': return `${n(e.seat)} ${fa(e.n)} بلیت مقصد کشید.`;
    case 'claim': return `${n(e.seat)} مسیر ${routeName(b, e.route)} (${fa(b.routes[e.route]!.len)} واگن) را ساخت: +${fa(e.points)}.`;
    case 'redeal': return 'سه لوکوموتیو رو بود؛ کارت‌های رو عوض شد.';
    case 'final': return `واگن‌های ${n(e.seat)} به ۲ یا کمتر رسید؛ دور پایانی: هر کس یک نوبت دیگر دارد.`;
    case 'pass': return `${n(e.seat)} کاری برای انجام نداشت و نوبتش گذشت.`;
    case 'timeout': return `زمان ${n(e.seat)} تمام شد.`;
    case 'left': return `${n(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}؛ مسیرهایش روی نقشه می‌ماند.`;
    case 'end': return `بازی تمام شد. برنده: ${e.winners.map(n).join('، ')}.`;
  }
}

// ---------- map ----------

const FRAME = 40;
/** Where the compass and the title cartouche sit on each map (empty sea or land without stations). */
const DECOR: Record<MapId, { compass: Pt; cartouche: Pt }> = {
  usa: { compass: [925, -150], cartouche: [135, -42] },
  europe: { compass: [72, 470], cartouche: [135, 52] },
  iran: { compass: [70, -130], cartouche: [235, -42] }
};
const at = (p: Pt, h: number): Pt => [p[0], p[1] < 0 ? h + p[1] : p[1]];

/** Static map art (sea, land, terrain, borders, frame, decorations); drawn once per map. */
const MapArt = memo(function MapArt({ map, title }: { map: MapId; title: string }) {
  const L = layoutOf(map);
  const T = L.terrain;
  const d = DECOR[map];
  const [cx, cy] = at(d.compass, L.h), [tx, ty] = at(d.cartouche, L.h);
  return (
    <g aria-hidden="true" pointerEvents="none">
      {/* Wooden frame with an ivory score band. */}
      <rect x={-FRAME} y={-FRAME} width={L.w + FRAME * 2} height={L.h + FRAME * 2} rx="12" fill="url(#ttr-wood)" />
      <rect x={-FRAME} y={-FRAME} width={L.w + FRAME * 2} height={L.h + FRAME * 2} rx="12" fill="url(#ttr-grain)" />
      <rect x={-FRAME + 3} y={-FRAME + 3} width={L.w + FRAME * 2 - 6} height={L.h + FRAME * 2 - 6} rx="10" fill="none" stroke="#c99a5c" strokeOpacity="0.5" strokeWidth="1.2" />
      <path d={`M${-FRAME + 5} ${-FRAME + 5} H${L.w + FRAME - 5} V${L.h + FRAME - 5} H${-FRAME + 5} Z M-16 -16 V${L.h + 16} H${L.w + 16} V-16 Z`} fillRule="evenodd" fill="url(#ttr-tile)" />
      <rect x="-16" y="-16" width={L.w + 32} height={L.h + 32} rx="3" className="ttr-band" />
      {L.track.map(([x, y], i) => (
        <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
          <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" className={i % 5 === 0 ? 'ttr-cell ttr-cell--five' : 'ttr-cell'} />
          {i % 5 === 0 && <text y="2.6" className="ttr-cell__n">{fa(i)}</text>}
        </g>
      ))}

      <clipPath id={`ttr-clip-${map}`}><rect width={L.w} height={L.h} /></clipPath>
      <g clipPath={`url(#ttr-clip-${map})`}>
        <rect width={L.w} height={L.h} fill="url(#ttr-sea)" />
        <rect width={L.w} height={L.h} fill="url(#ttr-waves)" />
        {/* Water-lining around the coasts, then the land. */}
        {[26, 17, 9].map((w, i) => <path key={i} d={`${T.land} ${T.islands}`} className={`ttr-ripple ttr-ripple--${i}`} strokeWidth={w} />)}
        <path d={T.land} className="ttr-land" filter="url(#ttr-landshadow)" />
        <path d={T.land} fill="url(#ttr-paper)" />
        {[14, 8].map((w, i) => <path key={i} d={T.water} className={`ttr-ripple ttr-ripple--in${i}`} strokeWidth={w} />)}
        <path d={T.water} className="ttr-water" />
        <path d={T.water} fill="url(#ttr-waves)" />
        <path d={T.islands} className="ttr-land" />
        <path d={T.islands} fill="url(#ttr-paper)" />
        <path d={`${T.land} ${T.islands}`} className="ttr-hachure" />
        <path d={`${T.land} ${T.islands}`} className="ttr-coast" />
        <path d={T.water} className="ttr-coast ttr-coast--water" />
        {T.outside && <path d={T.outside} fillRule="evenodd" className="ttr-outside" />}
        {T.borders.map((b, i) => <path key={i} d={b} className="ttr-border" />)}
        {T.dunes.map((p, i) => <use key={`d${i}`} href="#ttr-dune" x={p.x - 8 * p.s} y={p.y - 4 * p.s} width={16 * p.s} height={7 * p.s} />)}
        {T.trees.map((p, i) => <use key={`t${i}`} href="#ttr-tree" x={p.x - 6 * p.s} y={p.y - 9 * p.s} width={12 * p.s} height={13 * p.s} />)}
        {T.mountains.map((p, i) => <use key={`m${i}`} href="#ttr-mtn" x={p.x - 12 * p.s} y={p.y - 10 * p.s} width={24 * p.s} height={15 * p.s} />)}
        {T.seas.map((s) => <text key={s.text} x={s.x} y={s.y} className="ttr-sea-name">{s.text}</text>)}
        <rect width={L.w} height={L.h} fill="url(#ttr-graticule)" />
        {[[0.2, 0.3, 0.35], [0.78, 0.2, 0.3], [0.6, 0.85, 0.4], [0.1, 0.9, 0.28]].map(([x, y, s], i) => <ellipse key={i} cx={x! * L.w} cy={y! * L.h} rx={s! * L.w} ry={s! * L.h * 0.8} fill="url(#ttr-stain1)" />)}
        <rect width={L.w} height={L.h} fill="url(#ttr-vignette)" />
        <g transform={`translate(${cx} ${cy})`}><Compass /></g>
        <g transform={`translate(${tx} ${ty})`}><Cartouche title={title} sub="بلیت قطار · نقشه راه‌آهن" /></g>
      </g>
      <rect x="-1.5" y="-1.5" width={L.w + 3} height={L.h + 3} fill="none" stroke={INK} strokeWidth="2.4" />
    </g>
  );
});

interface MapProps {
  view: TtrView;
  board: Board;
  claimable: Set<number>;
  selected: number | null;
  hinted: number | null;
  cityMarks: Map<number, 'done' | 'open'>;
  label: (r: number) => string;
  onPick: (r: number) => void;
  seatName: (s: number) => string;
}

function TtrMap({ view, board, claimable, selected, hinted, cityMarks, label, onPick, seatName }: MapProps) {
  const L = layoutOf(view.map);
  const key = (r: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r); } };
  const lastClaim = [...view.log].reverse().find((e) => e.t === 'claim');
  const recent = lastClaim?.t === 'claim' ? lastClaim.route : null;
  const scores = Array.from({ length: view.players }, (_, s) => view.routePoints[s] ?? 0);
  return (
    <svg className="ttr-map" viewBox={`${-FRAME} ${-FRAME} ${L.w + FRAME * 2} ${L.h + FRAME * 2}`} role="group" aria-label={`نقشه ${board.nameFa}`} style={{ direction: 'ltr' }}>
      <MapDefs map={view.map} />
      <MapArt map={view.map} title={board.nameFa} />

      {/* Score markers on the track (route points; tickets are scored at the end). */}
      <g aria-hidden="true" pointerEvents="none">
        {scores.map((pts, s) => {
          const [x, y] = L.track[pts % 100]!;
          const stack = scores.slice(0, s).filter((o) => o % 100 === pts % 100).length;
          return (
            <g key={s} transform={`translate(${x.toFixed(1)} ${(y - stack * 4).toFixed(1)})`} className="ttr-marker">
              <title>{`${seatName(s)}: ${fa(pts)}`}</title>
              <ellipse cx="0.8" cy="2.6" rx="6.6" ry="3" fill="#000" opacity="0.35" />
              <rect x="-6" y="-5.5" width="12" height="9" rx="2" fill={`url(#ttr-s-${s})`} stroke="#120c05" strokeWidth="1" />
              <text y="1.9" className="ttr-marker__n" fill={SEAT_INK[s]}>{fa(s + 1)}</text>
            </g>
          );
        })}
      </g>

      {board.routes.map((r, i) => {
        const shape = L.routes[i]!;
        const owner = view.owner[i];
        const can = claimable.has(i);
        const ci = colorIx(r.color);
        const cls = ['ttr-route', can ? 'ttr-route--can' : '', selected === i ? 'ttr-route--sel' : '', hinted === i ? 'ttr-route--hint' : '', owner !== null ? 'ttr-route--owned' : '', recent === i ? 'ttr-route--recent' : ''].join(' ');
        const props = can
          ? { role: 'button', tabIndex: 0, 'aria-label': label(i), 'aria-pressed': selected === i, onClick: () => onPick(i), onKeyDown: key(i) }
          : { role: 'img', 'aria-label': label(i) };
        return (
          <g key={i} className={cls} {...props}>
            <path d={shape.d} className="ttr-route__hit" />
            <path d={shape.d} className="ttr-route__glow" />
            {shape.slots.map((s, k) => (
              <g key={k} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.angle.toFixed(1)})`}>
                {owner === null || owner === undefined ? (
                  <>
                    <rect x={-s.len / 2 + 0.5} y={-CAR_H / 2 + 1.6} width={s.len} height={CAR_H} rx="2" className="ttr-slot__shadow" />
                    <rect x={-s.len / 2} y={-CAR_H / 2} width={s.len} height={CAR_H} rx="2" className="ttr-slot" fill={`url(#ttr-c-${ci})`} />
                    <rect x={-s.len / 2 + 1.5} y={-CAR_H / 2 + 1} width={s.len - 3} height="1.8" rx="0.9" className="ttr-slot__shine" />
                    {ci === GRAY
                      ? <rect x={-s.len / 2 + 2} y={-CAR_H / 2 + 2} width={s.len - 4} height={CAR_H - 4} rx="1.4" className="ttr-slot__gray" />
                      : <path d={`M${-s.len / 2 + 3} 2.6 H${s.len / 2 - 3}`} className="ttr-slot__tie" stroke={ON[ci]} />}
                  </>
                ) : (
                  <g className="ttr-car" style={{ ['--k' as string]: k }}><Car len={s.len} seat={owner} /></g>
                )}
              </g>
            ))}
            {owner !== null && owner !== undefined && (
              <g transform={`translate(${shape.mid[0].toFixed(1)} ${shape.mid[1].toFixed(1)})`} aria-hidden="true">
                <circle r="6.5" fill={SEAT_COLOR[owner]} stroke="#120c05" strokeWidth="1.2" />
                <text y="2.9" className="ttr-route__seat" fill={SEAT_INK[owner]}>{fa(owner + 1)}</text>
              </g>
            )}
          </g>
        );
      })}

      <g aria-hidden="true" pointerEvents="none">
        {board.cities.map((c, i) => {
          const [x, y] = L.cities[i]!;
          const [lx, ly] = L.labels[i]!;
          const mark = cityMarks.get(i);
          const w = c.fa.length * 6.4 + 12;
          return (
            <g key={c.id} className={mark ? `ttr-city ttr-city--${mark}` : 'ttr-city'}>
              <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                {mark && <circle r={CITY_R + 5.5} className="ttr-city__mark" />}
                <circle r={CITY_R + 1} cy="1.4" fill="#000" opacity="0.3" />
                <circle r={CITY_R} className="ttr-city__ring" />
                <circle r={CITY_R - 2.8} className="ttr-city__inner" />
                <circle r={CITY_R - 5} className="ttr-city__dot" />
              </g>
              <g transform={`translate(${lx.toFixed(1)} ${ly.toFixed(1)})`} className="ttr-plaque">
                <rect x={-w / 2} y="-7.5" width={w} height="15" rx="3" className="ttr-plaque__bg" />
                <text y="3.6" className="ttr-plaque__t">{c.fa}</text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ---------- small controls ----------

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className="ttr-step" role="group" aria-label={label}>
      <button type="button" aria-label={`کمتر: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{fa(value)}</output>
      <button type="button" aria-label={`بیشتر: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

const Panel = ({ title, children, tone }: { title: string; children: ReactNode; tone?: 'decide' }) => (
  <section className={tone ? 'ttr-panel ttr-panel--decide' : 'ttr-panel'} aria-label={title}><h3>{title}</h3>{children}</section>
);

/** Whole map in miniature with the two ticket cities joined by a dashed line. */
function MiniMap({ map, a, b }: { map: MapId; a: number; b: number }) {
  const L = layoutOf(map);
  const [ax, ay] = L.cities[a]!, [bx, by] = L.cities[b]!;
  return (
    <svg className="ttr-mini" viewBox={`0 0 ${L.w} ${L.h}`} aria-hidden="true" focusable="false" style={{ direction: 'ltr' }}>
      <rect width={L.w} height={L.h} fill="#b7d6d1" />
      <path d={`${L.terrain.land} ${L.terrain.islands}`} fill="#efe1b8" stroke="#5a3f17" strokeWidth="6" />
      <path d={L.terrain.water} fill="#b7d6d1" stroke="#5a3f17" strokeWidth="4" />
      {L.cities.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#8a7550" />)}
      <path d={`M${ax} ${ay} L${bx} ${by}`} stroke="#b3261e" strokeWidth="14" strokeDasharray="30 18" strokeLinecap="round" />
      {[[ax, ay], [bx, by]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="26" fill="#b3261e" stroke="#fff" strokeWidth="8" />)}
    </svg>
  );
}

function Ticket({ board, id, done, checked, onToggle, disabled }: { board: Board; id: number; done?: boolean; checked?: boolean; onToggle?: () => void; disabled?: boolean }) {
  const t = board.tickets[id]!;
  const text = `بلیت ${ticketName(board, id)}، ${fa(t.points)} امتیاز${done === undefined ? '' : done ? '، کامل شده' : '، هنوز کامل نشده'}`;
  const body = (
    <>
      <MiniMap map={board.id} a={t.a} b={t.b} />
      <span className="ttr-ticket__route">
        <span className="ttr-ticket__city">{board.cities[t.a]!.fa}</span>
        <span className="ttr-ticket__rail" aria-hidden="true" />
        <span className="ttr-ticket__city">{board.cities[t.b]!.fa}</span>
      </span>
      <span className="ttr-ticket__pts" aria-hidden="true"><b>{fa(t.points)}</b><small>امتیاز</small></span>
      {done !== undefined && <span className={done ? 'ttr-ticket__stamp ttr-ticket__stamp--done' : 'ttr-ticket__stamp'} aria-hidden="true">{done ? 'کامل' : 'باز'}</span>}
    </>
  );
  return onToggle
    ? <button type="button" className="ttr-ticket ttr-ticket--pick" aria-pressed={!!checked} aria-label={text} disabled={disabled} onClick={onToggle}>{body}</button>
    : <span className={done ? 'ttr-ticket ttr-ticket--done' : 'ttr-ticket'} role="img" aria-label={text}>{body}</span>;
}

/** Small stat icons for the player boards. */
function Icon({ kind }: { kind: 'card' | 'ticket' | 'path' }) {
  return (
    <svg className="ttr-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {kind === 'card' && <><rect x="2.5" y="3" width="7" height="10.5" rx="1.4" fill="#c42a2a" stroke="currentColor" strokeWidth="1" transform="rotate(-10 6 8)" /><rect x="6.5" y="2.5" width="7" height="10.5" rx="1.4" fill="#2f6fd0" stroke="currentColor" strokeWidth="1" transform="rotate(8 10 8)" /></>}
      {kind === 'ticket' && <><path d="M1.5 4.5 H14.5 V7 a1.4 1.4 0 0 0 0 2.6 V12 H1.5 V9.6 a1.4 1.4 0 0 0 0 -2.6 Z" fill="#f3e2b4" stroke="currentColor" strokeWidth="1" /><path d="M5 8.3 H11" stroke="#b3261e" strokeWidth="1.2" strokeDasharray="1.6 1.2" /></>}
      {kind === 'path' && <><path d="M2 12 L6 6 L10 10 L14 4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 12 L6 6 L10 10 L14 4" fill="none" stroke="#e2a91e" strokeWidth="1.2" strokeDasharray="1.8 1.2" strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

// ---------- renderer ----------

export default function TtrRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<TtrView>) {
  const hints = legalActions as Hint[];
  const board = BOARDS[view.map];
  const exp = expected as Hint | null;
  const myTurn = mySeat !== null && view.phase === 'play' && view.current === mySeat && !view.outcome;

  const keepHint = hints.find((h) => h.type === 'keep');
  const marketHint = hints.find((h) => h.type === 'drawMarket');
  const claims = useMemo(() => new Map(hints.filter((h) => h.type === 'claim').map((h) => [h.route as number, h.pay as Pay[]])), [hints]);
  const has = (t: string) => hints.some((h) => h.type === t);

  const [sel, setSel] = useState<number | null>(null);
  const [payColor, setPayColor] = useState<number | null>(null);
  const [locos, setLocos] = useState(0);
  const [kept, setKept] = useState<number[]>([]);
  const [focusTicket, setFocusTicket] = useState<number | null>(null);
  const turnKey = `${view.turn}|${view.current}|${view.drew}|${view.phase}`;
  useEffect(() => { setSel(null); setPayColor(null); }, [turnKey]);
  const offerKey = (view.myOffer ?? []).join(',');
  useEffect(() => { setKept(view.myOffer ? [...view.myOffer] : []); }, [offerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, board, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, board, seatName]);

  const act = (a: Hint) => { if (!busy) onAction(a); };

  const pays = sel !== null ? claims.get(sel) ?? [] : [];
  const pay = pays.find((x) => x.color === payColor) ?? null;
  const pickRoute = (r: number) => {
    if (busy || !claims.has(r)) return;
    setSel(r);
    const first = claims.get(r)![0]!;
    setPayColor(first.color);
    setLocos(first.minLocos);
  };
  const choosePay = (p: Pay) => { setPayColor(p.color); setLocos(p.minLocos); };

  // Map highlights: my tickets' cities (done / open), the focused ticket only when one is focused.
  const cityMarks = new Map<number, 'done' | 'open'>();
  for (const t of view.myTickets ?? []) {
    if (focusTicket !== null && focusTicket !== t.id) continue;
    const tk = board.tickets[t.id]!;
    cityMarks.set(tk.a, t.done ? 'done' : 'open');
    cityMarks.set(tk.b, t.done ? 'done' : 'open');
  }
  if (focusTicket !== null && !(view.myTickets ?? []).some((t) => t.id === focusTicket)) {
    const tk = board.tickets[focusTicket]!;
    cityMarks.set(tk.a, 'open'); cityMarks.set(tk.b, 'open');
  }

  const routeLabel = (r: number) => {
    const rt = board.routes[r]!;
    const o = view.owner[r];
    const owner = o === null || o === undefined ? 'آزاد' : `ساخته‌شده توسط ${iso(seatName(o))} (${SEAT_FA[o]}${o === mySeat ? '، شما' : ''})`;
    return `مسیر ${routeName(board, r)}، ${fa(rt.len)} واگن، ${COLOR_FA[rt.color]}${rt.sib !== null ? '، مسیر دوتایی' : ''}، ${owner}${claims.has(r) ? '، قابل ساخت' : ''}`;
  };
  const hintedRoute = exp?.type === 'claim' ? (exp.route as number) : null;

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    if (view.phase === 'tickets') status = keepHint ? { tone: 'mine', text: `دست‌کم ${fa(view.minKeep)} بلیت مقصد را نگه دارید` } : { tone: 'wait', text: 'منتظر انتخاب بلیت‌های دیگران' };
    else if (!myTurn) status = { tone: 'wait', text: `نوبت ${iso(seatName(view.current))}${view.choosing[view.current] ? ' — انتخاب بلیت' : ''}` };
    else if (keepHint) status = { tone: 'mine', text: 'دست‌کم ۱ بلیت را نگه دارید' };
    else if (view.drew === 1) status = { tone: 'mine', text: 'کارت دوم را بکشید (لوکوموتیو رو مجاز نیست)' };
    else status = { tone: 'mine', text: '۲ کارت بکشید، یک مسیر بسازید یا بلیت مقصد بکشید' };
  }

  const hand = view.myHand;
  const handTotal = hand ? hand.reduce((a, b) => a + b, 0) : 0;
  const slots = new Set((marketHint?.slots as number[] | undefined) ?? []);
  const pickedOk = keepHint ? kept.length >= (keepHint.min as number) : false;

  return (
    <div className="ttr">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="ttr__meta">
        <span className="ttr-chipmeta ttr-chipmeta--turn">نقشه {board.nameFa}{view.phase === 'play' ? ` · نوبت ${fa(view.turn)}` : ''}</span>
        <span className="ttr-chipmeta">کارت در دسته: {fa(view.deckCount)}</span>
        <span className="ttr-chipmeta">بلیت در دسته: {fa(view.ticketDeckCount)}</span>
        {view.finalLeft && !view.outcome && <span className="ttr-chipmeta ttr-chipmeta--final">دور پایانی: {fa(view.finalLeft.length)} نوبت مانده</span>}
      </div>

      <div className="ttr-main">
        <div className="ttr-board-wrap">
          <ZoomBoard label={`نقشه ${board.nameFa}`}>
            <TtrMap view={view} board={board} claimable={myTurn && view.drew === 0 ? new Set(claims.keys()) : new Set()} selected={sel} hinted={hintedRoute}
              cityMarks={cityMarks} label={routeLabel} onPick={pickRoute} seatName={seatName} />
          </ZoomBoard>
          <p className="ttr-help">مسیرهای قابل ساخت برجسته‌اند؛ روی یکی بزنید. حلقه سبز: شهر بلیت کامل‌شده شما، حلقه طلایی: شهر بلیت باز.</p>
        </div>

        <div className="ttr-side">
          {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

          {keepHint && view.myOffer && (
            <Panel title={view.phase === 'tickets' ? 'بلیت‌های مقصد آغازین' : 'بلیت‌های مقصد تازه'} tone="decide">
              <p className="ttr-help">بلیت کامل‌شده امتیازش اضافه و بلیت ناقص در پایان کم می‌شود. دست‌کم {fa(keepHint.min as number)} را نگه دارید؛ بقیه زیر دسته می‌رود.</p>
              <div className="ttr-tickets">
                {view.myOffer.map((id) => (
                  <Ticket key={id} board={board} id={id} checked={kept.includes(id)} disabled={busy}
                    onToggle={() => { setKept((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id])); setFocusTicket(id); }} />
                ))}
              </div>
              <Button className={exp?.type === 'keep' ? 'ttr-hintbtn' : ''} disabled={busy || !pickedOk}
                onClick={() => { act({ type: 'keep', keep: view.myOffer!.filter((t) => kept.includes(t)) }); setFocusTicket(null); }}>
                نگه داشتن {fa(kept.length)} بلیت
              </Button>
            </Panel>
          )}

          {myTurn && !keepHint && sel !== null && (
            <Panel title={`ساخت مسیر ${routeName(board, sel)}`} tone="decide">
              <p className="ttr-help">
                {fa(board.routes[sel]!.len)} واگن، {COLOR_FA[board.routes[sel]!.color]} — {fa(ROUTE_POINTS[board.routes[sel]!.len] ?? 0)} امتیاز. با چه رنگی می‌پردازید؟
              </p>
              <div className="ttr-paychips" role="group" aria-label="رنگ پرداخت">
                {pays.map((p) => (
                  <button key={p.color} type="button" className="ttr-chip" aria-pressed={payColor === p.color} onClick={() => choosePay(p)} style={{ ['--cc' as string]: SHADES[p.color]![1], ['--ci' as string]: ON[p.color] }}>
                    <span className="ttr-chip__sw" aria-hidden="true" />{p.minLocos === board.routes[sel]!.len ? 'فقط لوکوموتیو' : COLOR_FA[COLORS[p.color]!]}
                  </button>
                ))}
              </div>
              {pay && pay.maxLocos > pay.minLocos && (
                <p className="ttr-row">لوکوموتیو: <Stepper label="تعداد لوکوموتیو" value={locos} min={pay.minLocos} max={pay.maxLocos} onChange={setLocos} /></p>
              )}
              {pay && (
                <div className="ttr-payview" aria-hidden="true">
                  {Array.from({ length: board.routes[sel]!.len }, (_, i) => (
                    <span key={i} className="ttr-payview__card" style={{ ['--i' as string]: i }}><CardArt c={i < board.routes[sel]!.len - locos ? pay.color : LOCO} /></span>
                  ))}
                  <span className="ttr-payview__arrow">←</span>
                  <span className="ttr-payview__route">
                    {Array.from({ length: board.routes[sel]!.len }, (_, i) => <i key={i} style={{ background: SHADES[colorIx(board.routes[sel]!.color)]![1] }} />)}
                  </span>
                  <span className="ttr-payview__pts">+{fa(ROUTE_POINTS[board.routes[sel]!.len] ?? 0)}</span>
                </div>
              )}
              {pay && (
                <p className="ttr-help">پرداخت:{pay && board.routes[sel]!.len - locos > 0 ? `${fa(board.routes[sel]!.len - locos)} کارت ${COLOR_FA[COLORS[pay.color]!]}` : ''}{locos > 0 && board.routes[sel]!.len - locos > 0 ? ' + ' : ''}{locos > 0 ? `${fa(locos)} لوکوموتیو` : ''}</p>
              )}
              <div className="row">
                <Button className={exp?.type === 'claim' ? 'ttr-hintbtn' : ''} disabled={busy || !pay} onClick={() => act({ type: 'claim', route: sel, color: pay!.color, locos })}>ساخت مسیر</Button>
                <Button variant="ghost" onClick={() => setSel(null)}>انصراف</Button>
              </div>
            </Panel>
          )}

          {view.phase === 'play' && !view.outcome && (
            <section className="ttr-market" aria-label="کارت‌های رو و دسته">
              <h3>کارت‌های رو</h3>
              <ul className="ttr-cards">
                {view.market.map((c, i) => (
                  <li key={i}>
                    {c === null ? <span className="ttr-card ttr-card--empty" role="img" aria-label="خالی" /> : (
                      <button type="button" className={['ttr-card', exp?.type === 'drawMarket' && exp.slot === i ? 'ttr-hintbtn' : ''].join(' ')}
                        aria-label={`برداشتن کارت ${CARD_FA(c)}${c === LOCO ? ' (جای هر دو کارت)' : ''}`} disabled={busy || !myTurn || !slots.has(i)} onClick={() => act({ type: 'drawMarket', slot: i })}>
                        <CardArt c={c} /><span className="ttr-card__name">{CARD_FA(c)}</span>
                      </button>
                    )}
                  </li>
                ))}
                <li>
                  <button type="button" className={['ttr-card ttr-card--deck', exp?.type === 'drawDeck' ? 'ttr-hintbtn' : ''].join(' ')} aria-label={`کشیدن از دسته بسته (${fa(view.deckCount)} کارت)`}
                    disabled={busy || !myTurn || !has('drawDeck')} onClick={() => act({ type: 'drawDeck' })}>
                    <span className="ttr-deck" aria-hidden="true"><CardBack /><CardBack /><CardBack /><b className="ttr-deck__n">{fa(view.deckCount)}</b></span><span className="ttr-card__name">دسته بسته</span>
                  </button>
                </li>
              </ul>
              <div className="row">
                <Button size="sm" variant="secondary" disabled={busy || !has('drawTickets')} onClick={() => act({ type: 'drawTickets' })}>کشیدن ۳ بلیت مقصد</Button>
                {has('pass') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ type: 'pass' })}>گذشتن از نوبت</Button>}
              </div>
            </section>
          )}

          <div className="ttr-duo">
          {hand && !view.outcome && (
            <section className="ttr-hand" aria-label="کارت‌های شما">
              <h3>کارت‌های شما ({fa(handTotal)}) · واگن‌ها: {fa(view.trains[mySeat!] ?? 0)}</h3>
              {handTotal === 0 ? <p className="ttr-help">کارتی ندارید.</p> : (
                <ul className="ttr-handcards">
                  {hand.map((k, c) => (k > 0 ? (
                    <li key={c} className="ttr-handcard" role="img" aria-label={`${fa(k)} کارت ${CARD_FA(c)}`}>
                      {Array.from({ length: Math.min(k, 3) }, (_, i) => <span key={i} className="ttr-handcard__layer" style={{ ['--l' as string]: i }}><CardArt c={c} /></span>)}<span className="ttr-handcard__n" aria-hidden="true">{fa(k)}</span><span className="ttr-handcard__name" aria-hidden="true">{CARD_FA(c)}</span>
                    </li>
                  ) : null))}
                </ul>
              )}
            </section>
          )}

          {view.myTickets && view.myTickets.length > 0 && !view.outcome && (
            <section className="ttr-mytickets" aria-label="بلیت‌های شما">
              <h3>بلیت‌های شما</h3>
              <div className="ttr-tickets">
                {view.myTickets.map((t) => (
                  <span key={t.id} onPointerEnter={() => setFocusTicket(t.id)} onPointerLeave={() => setFocusTicket(null)}>
                    <Ticket board={board} id={t.id} done={t.done} />
                  </span>
                ))}
              </div>
            </section>
          )}

          </div>

          {view.final && (
            <section className="ttr-final" aria-label="امتیاز پایانی">
              <h3>امتیاز پایانی</h3>
              <table>
                <thead><tr><th scope="col">بازیکن</th><th scope="col">مسیرها</th><th scope="col">بلیت‌ها</th><th scope="col">طولانی‌ترین</th><th scope="col">جمع</th></tr></thead>
                <tbody>
                  {[...view.final].sort((a, b) => b.total - a.total).map((f) => (
                    <tr key={f.seat} className={`ttr-final__row ttr-final__row--${view.outcome?.placements.find((p) => p.seat === f.seat)?.place ?? 9}`}>
                      <th scope="row"><span className="ttr-medal" aria-hidden="true">{fa(view.outcome?.placements.find((p) => p.seat === f.seat)?.place ?? 0)}</span><span className="ttr-swatch" style={{ ['--pc' as string]: SEAT_COLOR[f.seat] }} aria-hidden="true">{fa(f.seat + 1)}</span><bdi>{seatName(f.seat)}</bdi></th>
                      <td>{fa(f.routePoints)}</td>
                      <td>{f.ticketPoints >= 0 ? '+' : '−'}{fa(Math.abs(f.ticketPoints))} <small>({fa(f.tickets.filter((t) => t.done).length)} از {fa(f.tickets.length)})</small></td>
                      <td>{fa(f.longest)}{f.bonus ? ' (+۱۰)' : ''}</td>
                      <td><strong>{fa(f.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details>
                <summary>بلیت‌های همه بازیکنان</summary>
                {view.final.map((f) => (
                  <div key={f.seat} className="ttr-final__tickets"><bdi>{seatName(f.seat)}</bdi>: <span className="ttr-tickets">{f.tickets.map((t) => <Ticket key={t.id} board={board} id={t.id} done={t.done} />)}</span></div>
                ))}
              </details>
            </section>
          )}

          <ul className="ttr-players" aria-label="بازیکنان">
            {Array.from({ length: view.players }, (_, s) => {
              const turn = view.phase === 'play' && view.current === s && !view.outcome;
              const trains = view.trains[s] ?? TRAINS;
              return (
                <li key={s} className={['ttr-player', turn ? 'ttr-player--turn' : '', view.status[s] !== 'active' ? 'ttr-player--out' : ''].join(' ')} style={{ ['--pc' as string]: SEAT_COLOR[s] }}>
                  <span className="ttr-player__top">
                    <span className="ttr-seal" aria-hidden="true"><svg viewBox="-16 -12 32 22" aria-hidden="true"><g transform="scale(0.9)"><TrainGlyph loco color={SEAT_INK[s]} /></g></svg></span>
                    <span className="ttr-player__head">
                      <bdi className="ttr-player__name">{seatName(s)}</bdi>
                      <span className="ttr-player__color">{SEAT_FA[s]} · صندلی {fa(s + 1)}{s === mySeat ? ' · شما' : ''}</span>
                    </span>
                    <span className="ttr-player__score" aria-label={`${fa(view.routePoints[s] ?? 0)} امتیاز مسیر`}>{fa(view.routePoints[s] ?? 0)}</span>
                  </span>
                  <span className="ttr-player__badges">
                    {turn && <span className="ttr-badge">نوبت</span>}
                    {view.choosing[s] && !view.outcome && <span className="ttr-badge ttr-badge--soft">انتخاب بلیت</span>}
                    {view.status[s] === 'abandoned' && <span className="ttr-badge ttr-badge--out">کنار رفته</span>}
                    {view.finalLeft?.includes(s) && !view.outcome && <span className="ttr-badge ttr-badge--final">نوبت آخر</span>}
                  </span>
                  <span className="ttr-stock" role="img" aria-label={`${fa(trains)} واگن از ${fa(TRAINS)}`}>
                    <span className="ttr-stock__bar" style={{ ['--p' as string]: `${(trains / TRAINS) * 100}%` }} />
                    <span className="ttr-stock__t">{fa(trains)} واگن</span>
                  </span>
                  <span className="ttr-player__counts">
                    <span className="ttr-stat"><Icon kind="card" />{fa(view.handCounts[s] ?? 0)}<small>کارت</small></span>
                    <span className="ttr-stat"><Icon kind="ticket" />{fa(view.ticketCounts[s] ?? 0)}<small>بلیت</small></span>
                    <span className="ttr-stat"><Icon kind="path" />{fa(view.longest[s] ?? 0)}<small>بلندترین</small></span>
                  </span>
                </li>
              );
            })}
          </ul>

          <details className="ttr-log" open>
            <summary>رویدادها</summary>
            <ol>
              {view.log.slice(-10).reverse().map((e) => {
                const seat = 'seat' in e ? e.seat : null;
                return (
                  <li key={e.seq} className={`ttr-log__${e.t}`}>
                    <span className="ttr-log__dot" style={seat !== null ? { ['--pc' as string]: SEAT_COLOR[seat] } : undefined} aria-hidden="true" />
                    <span>{describe(e, board, seatName)}</span>
                  </li>
                );
              })}
            </ol>
          </details>
          <p className="ttr-legend" aria-label="امتیاز مسیرها بر اساس طول">
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <span key={n} className="ttr-legend__i"><span className="ttr-legend__cars" aria-hidden="true">{Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} />)}{n > 4 ? <small>×{fa(n)}</small> : null}</span>{fa(ROUTE_POINTS[n] ?? 0)}</span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
