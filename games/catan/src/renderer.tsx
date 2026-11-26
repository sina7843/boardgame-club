// Catan renderer: players strip, painted island (hexes, number tokens, harbors, roads, buildings, robber), one action
// panel driven by the phase and legal actions, own hand and development cards, event log. Shows only the projection:
// other players' hands and development cards are counts, never contents.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useFlip, useFresh, useInFrame, usePop, T, tx, useTermsLang, type Term, type GameRendererProps, DockSlot } from '@bg/ui';
import { BEGINNER_HARBORS, BEGINNER_MAP, EDGES, HEX_SIZE, RESOURCES, VERTICES, hexCenter, hexCorners, pips, type HarborKind, type Res, type Terrain } from './board.ts';
import { BOARD_PNG, BoardDefs, COST_PNG, CARD_BACK, pieceArt, DEV_ART, DieFace, HarborArt, HexArt, Ocean, ResIcon, RobberPawn } from './art.tsx';
import awardRoad from './art/catan-award-road.png';
import awardArmy from './art/catan-award-army.png';
import { terms } from './terms.ts';
import { COST, LIMITS, type CatanView, type Dev, type Hand, type LogEntry } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
type Hint = { type: string; [k: string]: unknown };

export const SEAT_COLOR = ['#c8323c', '#2f62c9', '#f1ece0', '#e0861a'];
const SEAT_FA = ['قرمز', 'آبی', 'سفید', 'نارنجی'];
const RES_T: Record<Res, Term> = { brick: terms.brick, lumber: terms.lumber, wool: terms.wool, grain: terms.grain, ore: terms.ore };
const TERRAIN_T: Record<Terrain, Term> = { hills: terms.hills, forest: terms.forest, pasture: terms.pasture, fields: terms.fields, mountains: terms.mountains, desert: terms.desert };
const PIECE_T = { road: terms.road, settlement: terms.settlement, city: terms.city } as const;
const DEV_T: Record<Dev, Term> = { knight: terms.knight, vp: terms.victoryPoint, road: terms.roadBuilding, plenty: terms.yearOfPlenty, monopoly: terms.monopoly };
const devHelp = (): Record<Dev, string> => ({
  knight: `${tx(terms.robber)} را جابه‌جا کنید و از صاحب یک ساختمان کنارش یک ${tx(terms.card)} ${tx(terms.stealImp)}.`,
  vp: '۱ امتیاز؛ تا پایان بازی مخفی می‌ماند.',
  road: `۲ ${tx(terms.road)} رایگان ${tx(terms.buildImp)}.`,
  plenty: `۲ ${tx(terms.resource)} دلخواه از ${tx(terms.bank)} بگیرید.`,
  monopoly: `یک ${tx(terms.resource)} را نام ببرید؛ همه بازیکنان دیگر ${tx(terms.cardsEz)} آن ${tx(terms.resource)} را به شما می‌دهند.`
});
const HARBOR_FA = (k: HarborKind) => (k === 'any' ? '۳:۱' : `۲:۱ ${tx(RES_T[k])}`);

const handText = (h: Partial<Hand>) => RESOURCES.filter((r) => (h[r] ?? 0) > 0).map((r) => `${fa(h[r]!)} ${tx(RES_T[r])}`).join('، ') || 'هیچ';
const vertexLabel = (view: CatanView, v: number) =>
  `${tx(terms.intersection)} کنار ${VERTICES[v]!.hexes.map((h) => `${tx(TERRAIN_T[view.hexes[h]!.terrain])}${view.hexes[h]!.number ? ` ${fa(view.hexes[h]!.number!)}` : ''}`).join('، ')}`;
const edgeLabel = (view: CatanView, e: number) => `مسیر میان ${vertexLabel(view, EDGES[e]!.a)} و ${vertexLabel(view, EDGES[e]!.b).replace(`${tx(terms.intersection)} کنار `, '')}`;
const hexLabel = (view: CatanView, h: number) => `${tx(TERRAIN_T[view.hexes[h]!.terrain])}${view.hexes[h]!.number ? ` ${fa(view.hexes[h]!.number!)}` : ''}`;

function describe(e: LogEntry, view: CatanView, name: (s: number) => string): string {
  switch (e.t) {
    case 'start': return `بازی شروع شد؛ ${name(e.first)} اول می‌چیند.`;
    case 'build': return `${name(e.seat)} ${tx(PIECE_T[e.piece])} ${tx(terms.buildPast)}${e.free ? ' (رایگان)' : ''}.`;
    case 'turn': return `نوبت ${fa(e.turn)}: ${name(e.seat)}.`;
    case 'roll': return `${name(e.seat)} ${tx(terms.dice)} ریخت: ${fa(e.dice[0])} + ${fa(e.dice[1])} = ${fa(e.dice[0] + e.dice[1])}.`;
    case 'produce': {
      const parts = e.gains.flatMap((g, s) => (Object.values(g).some((x) => x > 0) ? [`${name(s)}: ${handText(g)}`] : []));
      return `${e.setup ? `${tx(terms.resources)} آغازین` : tx(terms.production)} — ${parts.join('، ') || 'هیچ'}.`;
    }
    case 'shortage': return `${tx(terms.bank)} ${tx(RES_T[e.res])} کافی نداشت؛ کسی ${tx(RES_T[e.res])} نگرفت.`;
    case 'discard': return `${name(e.seat)} ${handText(e.cards)} ${tx(terms.discardPast)}.`;
    case 'robber': return `${name(e.seat)} ${tx(terms.robber)} را به ${hexLabel(view, e.hex)} برد.`;
    case 'steal': return `${name(e.seat)} از ${name(e.from)} ${e.res ? `یک ${tx(RES_T[e.res])}` : `یک ${tx(terms.card)}`} ${tx(terms.stealPast)}.`;
    case 'bank': return `${name(e.seat)} ${fa(e.n)} ${tx(RES_T[e.give])} را با ${tx(terms.bank)} به ۱ ${tx(RES_T[e.get])} ${tx(terms.tradedPast)}.`;
    case 'offer': return `${name(e.seat)} پیشنهاد داد: ${handText(e.give)} در ازای ${handText(e.get)}.`;
    case 'trade': return `${name(e.seat)} با ${name(e.with)} ${tx(terms.tradedPast)}: ${handText(e.give)} در ازای ${handText(e.get)}.`;
    case 'buy': return `${name(e.seat)} یک ${tx(terms.devCard)} ${tx(terms.buyPast)}.`;
    case 'dev':
      return `${name(e.seat)} «${tx(DEV_T[e.card])}» ${tx(terms.playedPast)}${e.card === 'monopoly' ? ` و ${fa(e.n ?? 0)} ${tx(RES_T[e.res!])} گرفت` : e.card === 'plenty' && e.pick ? ` و ${tx(RES_T[e.pick[0]])} و ${tx(RES_T[e.pick[1]])} گرفت` : ''}.`;
    case 'award': return e.seat === null
      ? `${tx(e.kind === 'road' ? terms.longestRoad : terms.largestArmy)} فعلاً صاحبی ندارد.`
      : `${name(e.seat)} ${tx(e.kind === 'road' ? terms.longestRoad : terms.largestArmy)} را گرفت (۲ امتیاز).`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد.`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'win': return `${name(e.seat)} با ${fa(e.vp)} امتیاز برد!`;
  }
}

// ---------- board ----------

type Sel = { kind: 'vertex' | 'edge' | 'hex'; id: number } | null;
interface Targets { vertices: Set<number>; edges: Set<number>; hexes: Set<number>; hint: Sel; sel: Sel }

const FRAME = [[0, -309], [277, -154], [277, 154], [0, 309], [-277, 154], [-277, -154]] as const;
const SEA = [[0, -285], [255, -142], [255, 142], [0, 285], [-255, 142], [-255, -142]] as const;
const ptsOf = (a: readonly (readonly [number, number])[], k = 1) => a.map(([x, y]) => `${x * k},${y * k}`).join(' ');
const HOUSE = ['M-8 8 V-1 H8 V8Z', 'M-10.5 -1 L0 -11 L10.5 -1Z'];
const CITY = ['M-13.5 8 V-1 H-4 V8Z', 'M-15 -1 L-8.7 -7 L-2.5 -1Z', 'M-4 8 V-8 H13 V8Z', 'M-5.6 -8 L4.5 -17 L14.6 -8Z'];

function Island({ view, t, onPick, mySeat }: { view: CatanView; t: Targets; onPick: (s: NonNullable<Sel>) => void; mySeat: number | null }) {
  useTermsLang();
  const key = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  const btn = (s: NonNullable<Sel>, label: string) => ({ role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': t.sel?.kind === s.kind && t.sel.id === s.id, onClick: () => onPick(s), onKeyDown: key(() => onPick(s)) });
  const is = (s: Sel, kind: string, id: number) => s?.kind === kind && s.id === id;
  const pts = (h: number, k = 1) => {
    const c = hexCenter(h);
    return hexCorners(h).map((p) => `${(c.x + (p.x - c.x) * k).toFixed(1)},${(c.y + (p.y - c.y) * k).toFixed(1)}`).join(' ');
  };
  const R = HEX_SIZE;
  // The handoff board image is the beginner island; random maps keep the per-hex composition.
  const beginner = view.hexes.every((h, i) => h.terrain === BEGINNER_MAP[i]!.terrain && h.number === BEGINNER_MAP[i]!.number) && view.harbors.every((h, i) => h.kind === BEGINNER_HARBORS[i]);
  // Pieces placed by the latest change drop in (bg-land); everything else is static.
  const fresh = useFresh([...view.roads.flatMap((o, i) => (o === null || o === undefined ? [] : [`e${i}`])), ...view.buildings.flatMap((b, i) => (b ? [`v${i}${b.city ? 'c' : 'h'}`] : []))]);
  return (
    <svg className="ct-board" viewBox="-320 -316 640 632" role="group" aria-label={tx(terms.map)} style={{ direction: 'ltr' }}>
      <BoardDefs />
      {beginner && <image href={BOARD_PNG} x="-320" y="-316" width="640" height="632" aria-hidden="true" pointerEvents="none" />}
      {!beginner && <><g aria-hidden="true" pointerEvents="none">
        <polygon className="ct-frame" points={ptsOf(FRAME)} fill="url(#ctb-wood)" />
        <polygon points={ptsOf(FRAME)} fill="url(#ctb-grain)" />
        {FRAME.map(([x, y], i) => <line key={i} className="ct-frame__miter" x1={x} y1={y} x2={SEA[i]![0]} y2={SEA[i]![1]} />)}
        <polygon className="ct-frame__edge" points={ptsOf(FRAME, 0.992)} />
      </g>
      <Ocean points={ptsOf(SEA)} box={300} />
      <polygon className="ct-sea" points={ptsOf(SEA)} fill="none" pointerEvents="none" aria-hidden="true" />
      <g aria-hidden="true" pointerEvents="none">
        {FRAME.map(([x, y], i) => <circle key={i} className="ct-stud" cx={x * 0.955} cy={y * 0.955} r="4.6" fill="url(#ctb-brass)" />)}
      </g>
      {view.harbors.map((h, i) => {
        const e = EDGES[h.edge]!, a = VERTICES[e.a]!, b = VERTICES[e.b]!;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(mx, my);
        const hx = mx + (mx / len) * 30, hy = my + (my / len) * 30;
        return (
          <g key={`h${i}`} className={h.kind === 'any' ? 'ct-harbor' : `ct-harbor ct-res--${h.kind}`} role="img" aria-label={`${tx(terms.harbor)} ${HARBOR_FA(h.kind)}`}>
            <line x1={a.x} y1={a.y} x2={hx} y2={hy} className="ct-pier__under" /><line x1={b.x} y1={b.y} x2={hx} y2={hy} className="ct-pier__under" />
            <line x1={a.x} y1={a.y} x2={hx} y2={hy} className="ct-pier" /><line x1={b.x} y1={b.y} x2={hx} y2={hy} className="ct-pier" />
            <HarborArt x={hx} y={hy + 6} />
            <circle cx={hx} cy={hy} r="17" className="ct-harbor__coin" />
            <text x={hx} y={hy - 1} className="ct-harbor__rate">{h.kind === 'any' ? '۳:۱' : '۲:۱'}</text>
            {h.kind !== 'any' && <text x={hx} y={hy + 10} className="ct-harbor__res">{tx(RES_T[h.kind])}</text>}
          </g>
        );
      })}
      <g aria-hidden="true" pointerEvents="none">
        {view.hexes.map((_, i) => <polygon key={`b${i}`} points={pts(i, 1.13)} className="ct-shore" strokeLinejoin="round" />)}
      </g></>}
      {view.hexes.map((h, i) => {
        const c = hexCenter(i);
        const target = t.hexes.has(i);
        return (
          <g key={`x${i}`} className={['ct-hex', target ? 'ct-target' : '', is(t.sel, 'hex', i) ? 'ct-selected' : '', is(t.hint, 'hex', i) ? 'ct-hint' : ''].join(' ')}
            {...(target ? btn({ kind: 'hex', id: i }, `${hexLabel(view, i)}، ${tx(terms.robber)} را اینجا ببرید`) : { role: 'img', 'aria-label': `${hexLabel(view, i)}${view.robber === i ? `، ${tx(terms.robber)} اینجاست` : ''}` })}>
            {!beginner && <HexArt terrain={h.terrain} cx={c.x} cy={c.y} r={R} className="ct-hex__art" />}
            <polygon points={pts(i)} fill="#000" fillOpacity="0.001" className="ct-hex__tile" />
            {!beginner && <text x={c.x} y={c.y - R * 0.5} className="ct-hex__name">{tx(TERRAIN_T[h.terrain])}</text>}
            {!beginner && h.number !== null && (
              <g className={h.number === 6 || h.number === 8 ? 'ct-token ct-token--hot' : 'ct-token'}>
                <circle className="ct-token__disc" cx={c.x} cy={c.y + 4} r="17" fill="url(#ctb-token)" filter="url(#ctb-soft)" />
                <circle className="ct-token__ring" cx={c.x} cy={c.y + 4} r="14" />
                <text x={c.x} y={c.y + 9}>{fa(h.number)}</text>
                {Array.from({ length: pips(h.number) }, (_, k) => <circle key={k} className="ct-pip" cx={c.x + (k - (pips(h.number) - 1) / 2) * 4.5} cy={c.y + 16} r="1.6" />)}
              </g>
            )}
            {view.robber === i && (
              <g transform={`translate(${c.x + (h.number === null ? 0 : 26)}, ${c.y + 14})`} aria-hidden="true" pointerEvents="none"><g data-flip="robber"><RobberPawn /></g></g>
            )}
          </g>
        );
      })}
      {EDGES.map((e, i) => {
        const a = VERTICES[e.a]!, b = VERTICES[e.b]!;
        const owner = view.roads[i] ?? null;
        const target = t.edges.has(i);
        if (owner === null && !target) return null;
        return (
          <g key={`e${i}`} className={['ct-edge', target ? 'ct-target' : '', is(t.sel, 'edge', i) ? 'ct-selected' : '', is(t.hint, 'edge', i) ? 'ct-hint' : ''].join(' ')}
            {...(target ? btn({ kind: 'edge', id: i }, `${edgeLabel(view, i)}، ${tx(terms.build)} ${tx(terms.road)}`) : { role: 'img', 'aria-label': `${tx(terms.road)} ${SEAT_FA[owner!]}` })}>
            {owner !== null && (
              <g className={fresh.has(`e${i}`) ? 'ct-plank bg-land' : 'ct-plank'}>
                {(() => {
                  let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                  if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
                  const p = pieceArt(owner, 'road');
                  return <image href={p.src} x="-24" y="-14" width="48" height="28" style={p.style} transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2}) rotate(${ang})`} />;
                })()}
              </g>
            )}
            {target && <rect x={-HEX_SIZE / 2 + 9} y="-7" width={HEX_SIZE - 18} height="14" rx="7" className="ct-edge__hit"
              transform={`translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})`} />}
          </g>
        );
      })}
      {VERTICES.map((v, i) => {
        const bld = view.buildings[i];
        const target = t.vertices.has(i);
        if (!bld && !target) return null;
        const label = bld ? `${tx(bld.city ? terms.city : terms.settlement)} ${SEAT_FA[bld.seat]}${bld.seat === mySeat ? ' (شما)' : ''}، ${vertexLabel(view, i)}` : vertexLabel(view, i);
        return (
          <g key={`v${i}`} transform={`translate(${v.x}, ${v.y})`} className={['ct-vertex', target ? 'ct-target' : '', is(t.sel, 'vertex', i) ? 'ct-selected' : '', is(t.hint, 'vertex', i) ? 'ct-hint' : ''].join(' ')}
            {...(target ? btn({ kind: 'vertex', id: i }, `${label}، ${bld ? `تبدیل به ${tx(terms.city)}` : `${tx(terms.build)} ${tx(terms.settlement)}`}`) : { role: 'img', 'aria-label': label })}>
            {target && <circle r="16" className="ct-vertex__ring" />}
            {bld && (
              <g className={fresh.has(`v${i}${bld.city ? 'c' : 'h'}`) ? 'ct-bld bg-land' : 'ct-bld'} key={bld.city ? 'city' : 'house'}>
                {(() => { const p = pieceArt(bld.seat, bld.city ? 'city' : 'set'); return <image href={p.src} x="-21" y="-22" width="42" height="39" style={p.style} />; })()}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- player board ----------


/** A wooden piece in the seat colour (road plank, settlement house, city). Decorative: the parent carries the label. */
function Piece({ kind, seat }: { kind: 'road' | 'settlement' | 'city'; seat: number }) {
  return (
    <svg className={`ct-pc ct-pc--${kind}`} viewBox={kind === 'road' ? '-16 -6 32 12' : '-17 -19 34 30'} aria-hidden="true">
      {kind === 'road'
        ? <rect x="-14" y="-3.5" width="28" height="7" rx="1.5" fill={SEAT_COLOR[seat]} className="ct-piece" />
        : (kind === 'city' ? CITY : HOUSE).map((d) => <path key={d} d={d} fill={SEAT_COLOR[seat]} className="ct-piece" />)}
    </svg>
  );
}

/** The printed building-cost card (handoff art). */
function CostCard() {
  useTermsLang();
  const [b, l, w, g, o] = [terms.brickAlt, terms.lumber, terms.wool, terms.grain, terms.ore].map(tx);
  return <img className="ct-costcard" src={COST_PNG} alt={`${tx(terms.cost)}: ${tx(terms.road)} یک ${l} و یک ${b}؛ ${tx(terms.settlement)} یک ${l}، ${b}، ${w} و ${g}؛ ${tx(terms.city)} دو ${g} و سه ${o}؛ ${tx(terms.devCard)} یک ${w}، ${g} و ${o}`} draggable={false} />;
}

// ---------- small controls ----------

/** A number that bumps when it changes (key remounts it so the animation replays). */
function Pop({ v, text, className = '' }: { v: number; text: string; className?: string }) {
  return <strong key={v} className={`${className} ${usePop(v)}`.trim()}>{text}</strong>;
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className="ct-step" role="group" aria-label={label}>
      <button type="button" aria-label={`کمتر ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{fa(value)}</output>
      <button type="button" aria-label={`بیشتر ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function HandPicker({ title, limit, values, onChange }: { title: string; limit: (r: Res) => number; values: Hand; onChange: (h: Hand) => void }) {
  return (
    <fieldset className="ct-picker">
      <legend>{title}</legend>
      {RESOURCES.map((r) => (
        <span key={r} className={`ct-picker__row ct-res--${r}`}>
          <span><span aria-hidden="true" className="ct-res__icon"><ResIcon r={r} /></span> {tx(RES_T[r])}</span>
          <Stepper label={tx(RES_T[r])} value={values[r]} max={limit(r)} onChange={(n) => onChange({ ...values, [r]: n })} />
        </span>
      ))}
    </fieldset>
  );
}

function ResChoice({ label, value, options, onChange }: { label: string; value: Res | null; options: readonly Res[]; onChange: (r: Res) => void }) {
  return (
    <fieldset className="ct-choice">
      <legend>{label}</legend>
      {RESOURCES.map((r) => (
        <button key={r} type="button" className={`ct-chip ct-res--${r}`} aria-pressed={value === r} disabled={!options.includes(r)} onClick={() => onChange(r)}>
          <span aria-hidden="true"><ResIcon r={r} /></span> {tx(RES_T[r])}
        </button>
      ))}
    </fieldset>
  );
}

const zero = (): Hand => ({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
const sum = (h: Hand) => RESOURCES.reduce((a, r) => a + h[r], 0);
const Panel = ({ title, children, tone }: { title: string; children: ReactNode; tone?: 'decide' }) => (
  <section className={tone ? 'ct-panel ct-panel--decide' : 'ct-panel'} aria-label={title}><h3>{title}</h3>{children}</section>
);

// ---------- renderer ----------

/** The own build / robber move while it waits in the undo window, applied to the view (only what the client knows). */
function preview(v: CatanView, q: Hint | null | undefined, me: number | null): CatanView {
  if (!q || me === null) return v;
  const pay = (k: 'road' | 'settlement' | 'city') => {
    const free = v.phase === 'setupSettlement' || v.phase === 'setupRoad' || v.phase === 'roadBuilding';
    return free || !v.myHand ? v.myHand : RESOURCES.reduce((h, r) => ({ ...h, [r]: h[r] - (COST[k][r] ?? 0) }), v.myHand);
  };
  if (q.type === 'moveRobber') return { ...v, robber: q.hex as number };
  if (q.type === 'buildRoad') return { ...v, roads: v.roads.map((o, i) => (i === q.edge ? me : o)), myHand: pay('road') };
  if (q.type === 'buildSettlement' || q.type === 'buildCity') {
    const city = q.type === 'buildCity';
    return { ...v, buildings: v.buildings.map((b, i) => (i === q.vertex ? { ...(b ?? {}), seat: me, city } as NonNullable<typeof b> : b)), myHand: pay(city ? 'city' : 'settlement') };
  }
  return v;
}

export default function CatanRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CatanView>) {
  useTermsLang(); // re-render when the terms language changes
  // Undo-window preview: the road / settlement / city already stands (cost paid) and the robber already moved; undo
  // clears `queued` and it goes back. A roll is never previewed: the dice tumble without pips until the server rolls.
  const view = useMemo(() => preview(real, queued as Hint | null, mySeat), [real, queued, mySeat]);
  const hints = legalActions as Hint[];
  const has = (t: string) => hints.some((h) => h.type === t);
  const myTurn = mySeat !== null && view.current === mySeat && !view.outcome;
  const exp = expected as Hint | null;
  const hand = view.myHand ?? zero();

  const legal = useMemo(() => ({
    road: new Set(hints.filter((h) => h.type === 'buildRoad').map((h) => h.edge as number)),
    settlement: new Set(hints.filter((h) => h.type === 'buildSettlement').map((h) => h.vertex as number)),
    city: new Set(hints.filter((h) => h.type === 'buildCity').map((h) => h.vertex as number)),
    robber: new Set(hints.filter((h) => h.type === 'moveRobber').map((h) => h.hex as number)),
    bank: hints.filter((h) => h.type === 'bankTrade') as { type: string; give: Res; get: Res; rate: number }[]
  }), [hints]);

  // Local UI state; reset when the turn or phase moves on.
  const [mode, setMode] = useState<'road' | 'settlement' | 'city' | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [discard, setDiscard] = useState<Hand>(zero());
  const [give, setGive] = useState<Hand>(zero());
  const [get, setGet] = useState<Hand>(zero());
  const [bankGive, setBankGive] = useState<Res | null>(null);
  const [bankGet, setBankGet] = useState<Res | null>(null);
  const [devPick, setDevPick] = useState<'plenty' | 'monopoly' | null>(null);
  const [pick, setPick] = useState<Res[]>([]);
  const phaseKey = `${view.turn}|${view.phase}|${view.current}`;
  useEffect(() => { setMode(null); setSel(null); setDiscard(zero()); setDevPick(null); setPick([]); setBankGive(null); setBankGet(null); }, [phaseKey]);
  useEffect(() => { setSel(null); }, [mode]);

  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, view, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName, view]);

  // The robber glides between hexes; a bought development card flies in from the deck.
  const root = useRef<HTMLDivElement>(null);
  const rollSeq = [...view.log].reverse().find((e) => e.t === 'roll')?.seq ?? 0;
  const [rollAsked, setRollAsked] = useState(-1);
  const rolling = queued?.type === 'roll' || (busy && rollAsked === rollSeq);
  useFlip(root, `${latest?.seq ?? 0}|${queued ? JSON.stringify(queued) : ''}|${rolling}`);

  const act = (a: Hint) => { if (!busy) { onAction(a); setSel(null); setMode(null); } };

  // Which targets the board offers right now.
  // No targets while a move is held or in flight: a tap then would be swallowed.
  const canPick = myTurn && !busy;
  const active = view.phase === 'setupSettlement' ? 'settlement' : view.phase === 'setupRoad' || view.phase === 'roadBuilding' ? 'road' : view.phase === 'robber' ? 'robber' : mode;
  const targets: Targets = {
    vertices: canPick && active === 'settlement' ? legal.settlement : canPick && active === 'city' ? legal.city : new Set(),
    edges: canPick && active === 'road' ? legal.road : new Set(),
    hexes: canPick && active === 'robber' ? legal.robber : new Set(),
    sel,
    hint: exp?.type === 'buildRoad' ? { kind: 'edge', id: exp.edge as number } : exp && 'vertex' in exp ? { kind: 'vertex', id: exp.vertex as number } : exp?.type === 'moveRobber' ? { kind: 'hex', id: exp.hex as number } : null
  };
  // One tap builds / moves the robber; the shell's undo window replaces a confirm step. The spot stays highlighted meanwhile.
  const pickTarget = (s: NonNullable<Sel>) => {
    if (busy) return;
    const a: Hint = s.kind === 'edge' ? { type: 'buildRoad', edge: s.id } : s.kind === 'hex' ? { type: 'moveRobber', hex: s.id }
      : active === 'city' ? { type: 'buildCity', vertex: s.id } : { type: 'buildSettlement', vertex: s.id };
    setSel(s);
    onAction(a);
  };

  // Status line.
  const owed = mySeat !== null ? view.owed[mySeat] ?? 0 : 0;
  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    if (queued) status = { tone: 'wait', text: 'حرکت شما در حال ثبت است…' };
    else if (owed > 0 && view.phase === 'discard') status = { tone: 'mine', text: `۷ آمد: ${fa(owed)} ${tx(terms.card)} ${tx(terms.discardImp)}` };
    else if (!myTurn) status = { tone: 'wait', text: view.phase === 'discard' ? `منتظر ${tx(terms.discard)} ${tx(terms.cardsPl)}` : `نوبت ${seatName(view.current)}` };
    else status = { tone: 'mine', text: {
      setupSettlement: `آغاز بازی: یک ${tx(terms.settlement)} بگذارید (${tx(terms.distanceRule)} رعایت شود)`,
      setupRoad: `یک ${tx(terms.road)} کنار ${tx(terms.settlement)} تازه‌تان بگذارید`,
      roll: `نوبت شماست: ${tx(terms.dice)} بریزید`,
      discard: `منتظر ${tx(terms.discard)} ${tx(terms.cardsEz)} دیگران`,
      robber: `${tx(terms.robber)} را به ${tx(terms.hex)} دیگری ببرید`,
      steal: `از چه کسی ${tx(terms.stealImp)}؟`,
      main: `${tx(terms.trade)} کنید، ${tx(terms.buildImp)} و در پایان نوبت را تمام کنید`,
      roadBuilding: `${tx(terms.roadBuilding)}: ${fa(view.freeRoads)} ${tx(terms.road)} رایگان بگذارید`
    }[view.phase] };
  }

  const framed = useInFrame() !== null; // the shell draws seats, scores, turn and events
  const bankRate = (r: Res) => legal.bank.find((h) => h.give === r)?.rate;
  const tradeOk = sum(give) > 0 && sum(get) > 0 && RESOURCES.every((r) => !(give[r] > 0 && get[r] > 0));
  const devCounts = (view.myDevs ?? []).reduce<Record<string, { n: number; fresh: number }>>((a, d) => {
    a[d.card] = { n: (a[d.card]?.n ?? 0) + 1, fresh: (a[d.card]?.fresh ?? 0) + (d.fresh ? 1 : 0) };
    return a;
  }, {});
  const playType: Record<Dev, string | null> = { knight: 'playKnight', road: 'playRoadBuilding', plenty: 'playPlenty', monopoly: 'playMonopoly', vp: null };

  const bank = <span className="ct-bank" aria-label={`${tx(terms.bank)}: ${handText(view.bank)}`}><T t={terms.bank} />: {RESOURCES.map((r) => <span key={r} className={`ct-mini ct-res--${r}`}><span aria-hidden="true"><ResIcon r={r} /></span>{fa(view.bank[r])}</span>)}</span>;
  const diceEl = rolling ? (
    <span key="rolling" className="ct-dice" aria-label={`${tx(terms.diceP)} در حال چرخیدن`}><DieFace value={6} pending /><DieFace value={6} red pending /></span>
  ) : view.dice && (
    <span key={rollSeq} className="ct-dice" aria-label={`${tx(terms.dice)}: ${fa(view.dice[0])} و ${fa(view.dice[1])}، جمع ${fa(view.dice[0] + view.dice[1])}`}>
      <DieFace value={view.dice[0]} /><DieFace value={view.dice[1]} red />
      <strong aria-hidden="true">= {fa(view.dice[0] + view.dice[1])}</strong>
    </span>
  );
  // Framed side column (reference §1): the bank as a 2 × 3 grid of cards (five resources + the development deck),
  // the dice, and the two award cards with their holder.
  const side = (
    <div className="ct-rack">
      <ul className="ct-bankgrid" aria-label={`${tx(terms.bank)}: ${handText(view.bank)}، ${tx(terms.devCard)}: ${fa(view.devDeckCount)}`}>
        {RESOURCES.map((r) => <li key={r} className={`ct-bankcard ct-res--${r}`}><span aria-hidden="true"><ResIcon r={r} /></span><b>{fa(view.bank[r])}</b></li>)}
        <li className="ct-bankcard" data-flip-anchor="devdeck"><img src={CARD_BACK} alt="" draggable={false} /><b>{fa(view.devDeckCount)}</b></li>
      </ul>
      {diceEl || <span className="ct-dice" aria-label={`${tx(terms.dice)} هنوز ریخته نشده`}><span className="ct-die ct-die--blank" aria-hidden="true" /><span className="ct-die ct-die--blank" aria-hidden="true" /></span>}
      <div className="ct-awards">
        <span className="ct-award"><img src={awardRoad} alt="" draggable={false} /><small><T t={terms.road} />: {view.longestRoad === null ? 'هنوز کسی' : <bdi>{view.longestRoad === mySeat ? 'شما' : seatName(view.longestRoad)}</bdi>}</small></span>
        <span className="ct-award"><img src={awardArmy} alt="" draggable={false} /><small><T t={terms.army} />: {view.largestArmy === null ? 'هنوز کسی' : <bdi>{view.largestArmy === mySeat ? 'شما' : seatName(view.largestArmy)}</bdi>}</small></span>
      </div>
    </div>
  );

  return (
    <div className={framed ? 'ct ct--framed' : 'ct'} ref={root}>
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p><T t={terms.settlement} /> ۱ امتیاز، <T t={terms.city} /> ۲، <T t={terms.longestRoad} /> و <T t={terms.largestArmy} /> هر کدام ۲ امتیاز؛ با {fa(10)} امتیاز برنده‌اید. <T t={terms.dice} /> ۷: بیش از {fa(7)} <T t={terms.card} /> را نصف کنید و <T t={terms.robber} /> را ببرید.</p>
          {view.myHand && <CostCard />}
        </RailSlot>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      <div className="ct__meta">
        {!framed && <span>نوبت {fa(view.turn)}</span>}
        {!framed && diceEl}
        {!framed && <span className="ct-deck" data-flip-anchor="devdeck"><img src={CARD_BACK} alt="" aria-hidden="true" draggable={false} /><T t={terms.devCard} /> در <T t={terms.deck} />: {fa(view.devDeckCount)}</span>}
        {!framed && bank}
      </div>

      {!framed && <ul className="ct-players" aria-label="بازیکنان">
        {(mySeat === null ? [] : [mySeat]).concat(Array.from({ length: view.players }, (_, s) => s).filter((s) => s !== mySeat)).map((s) => {
          const turn = view.current === s && !view.outcome;
          const vp = s === mySeat && view.myVp !== null ? view.myVp : view.publicVp[s]! + (view.vpCards?.[s] ?? 0);
          const supply = {
            road: LIMITS.road - view.roads.filter((o) => o === s).length,
            settlement: LIMITS.settlement - view.buildings.filter((b) => b?.seat === s && !b.city).length,
            city: LIMITS.city - view.buildings.filter((b) => b?.seat === s && b.city).length
          };
          return (
            <li key={s} className={['ct-player', turn ? 'ct-player--turn' : '', s === mySeat ? 'ct-player--me' : '', view.active[s] ? '' : 'ct-player--out'].join(' ')} style={{ ['--pc' as string]: SEAT_COLOR[s] }}>
              <span className="ct-player__head">
                <span className="ct-swatch" aria-hidden="true">{fa(s + 1)}</span>
                <bdi className="ct-player__name">{seatName(s)}</bdi>
                <span className="ct-player__color">({SEAT_FA[s]}{s === mySeat ? '، شما' : ''})</span>
                {turn && <span className="ct-badge">نوبت</span>}
                {!view.active[s] && <span className="ct-badge ct-badge--out">کنار رفته</span>}
                <span className="ct-player__vp"><Pop v={vp} text={fa(vp)} /> امتیاز</span>
              </span>
              <span className="ct-supply" aria-label={`${tx(terms.supply)}: ${fa(supply.road)} ${tx(terms.road)}، ${fa(supply.settlement)} ${tx(terms.settlement)}، ${fa(supply.city)} ${tx(terms.city)}`}>
                {(['road', 'settlement', 'city'] as const).map((k) => (
                  <span key={k} className="ct-supply__slot">
                    <Piece kind={k} seat={s} />
                    <b>{fa(supply[k])}</b><small>/{fa(LIMITS[k])} {tx(PIECE_T[k])}</small>
                  </span>
                ))}
              </span>
              <span className="ct-player__counts">
                <span className="ct-tally"><i className="ct-tally__card" aria-hidden="true" />{fa(view.handCounts[s] ?? 0)} <T t={terms.resourceCard} /></span>
                <span className="ct-tally"><img src={CARD_BACK} alt="" aria-hidden="true" draggable={false} />{fa(view.devCounts[s] ?? 0)} <T t={terms.devCard} /></span>
                <span className="ct-tally"><span aria-hidden="true">⚔</span> {fa(view.knights[s] ?? 0)} <T t={terms.knight} /></span>
                <span className="ct-tally"><T t={terms.roadLen} /> {fa(view.roadLength[s] ?? 0)}</span>
              </span>
              <span className="ct-player__awards">
                {view.longestRoad === s && <span className="ct-badge ct-badge--award"><T t={terms.longestRoad} /></span>}
                {view.largestArmy === s && <span className="ct-badge ct-badge--award"><T t={terms.largestArmy} /></span>}
                {view.phase === 'discard' && (view.owed[s] ?? 0) > 0 && <span className="ct-badge ct-badge--warn">باید {fa(view.owed[s]!)} <T t={terms.card} /> <T t={terms.discardMust} /></span>}
              </span>
              {s === mySeat && <CostCard />}
            </li>
          );
        })}
      </ul>}

      <div className="ct-main">
        <div className="ct-board-wrap">
          <ZoomBoard label={tx(terms.map)}><Island view={view} t={targets} onPick={pickTarget} mySeat={mySeat} /></ZoomBoard>
          {framed && side}
        </div>

        <div className="ct-side">
          {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

          {has('discard') && (
            <Panel title={`${tx(terms.discard)} ${fa(owed)} ${tx(terms.card)}`} tone="decide">
              <p className="ct-help">بیش از ۷ {tx(terms.card)} دارید؛ نصف آن (رو به پایین گرد) را انتخاب کنید.</p>
              <HandPicker title={`${tx(terms.cardsYi)} که ${tx(terms.discardNow)}`} values={discard} limit={(r) => hand[r]} onChange={setDiscard} />
              <Button disabled={busy || sum(discard) !== owed} onClick={() => act({ type: 'discard', cards: discard })}><T t={terms.discard} /> ({fa(sum(discard))} از {fa(owed)})</Button>
            </Panel>
          )}

          {myTurn && has('roll') && <DockSlot><Button className={exp?.type === 'roll' ? 'ct-hintbtn' : ''} disabled={busy} onClick={() => { if (!busy) setRollAsked(rollSeq); act({ type: 'roll' }); }}><T t={terms.rollDice} /></Button></DockSlot>}

          {myTurn && view.phase === 'steal' && (
            <Panel title={tx(terms.steal)} tone="decide">
              <div className="row">{view.stealFrom.map((s) => <Button key={s} disabled={busy} onClick={() => act({ type: 'steal', seat: s })}>از <bdi>{seatName(s)}</bdi> ({fa(view.handCounts[s] ?? 0)} <T t={terms.card} />)</Button>)}</div>
            </Panel>
          )}

          {myTurn && view.phase === 'main' && (
            <Panel title={tx(terms.buildV)}>
              <div className="ct-build">
                {([['road', tx(terms.road), legal.road.size], ['settlement', tx(terms.settlement), legal.settlement.size], ['city', tx(terms.city), legal.city.size]] as const).map(([k, label, n]) => (
                  <button key={k} type="button" className={['ct-buildbtn', exp && ((k === 'road' && exp.type === 'buildRoad') || (k === 'settlement' && exp.type === 'buildSettlement') || (k === 'city' && exp.type === 'buildCity')) ? 'ct-hintbtn' : ''].join(' ')}
                    aria-pressed={mode === k} disabled={busy || n === 0} onClick={() => setMode(mode === k ? null : k)}>
                    <strong>{label}</strong><span className="ct-cost">{handText(COST[k])}</span>
                  </button>
                ))}
                <button type="button" className="ct-buildbtn" disabled={busy || !has('buyDev')} onClick={() => act({ type: 'buyDev' })}>
                  <strong><T t={terms.devCard} /></strong><span className="ct-cost">{handText(COST.dev)}</span>
                </button>
              </div>
              {mode && <p className="ct-help">روی نقشه یکی از جاهای مجازِ برجسته را انتخاب کنید.</p>}
            </Panel>
          )}

          {myTurn && view.phase === 'main' && (
            <Panel title={`${tx(terms.trade)} با ${tx(terms.bank)} و ${tx(terms.harbor)}`}>
              <ResChoice label="می‌دهم" value={bankGive} options={RESOURCES.filter((r) => bankRate(r) !== undefined)} onChange={setBankGive} />
              <ResChoice label="می‌گیرم" value={bankGet} options={RESOURCES.filter((r) => r !== bankGive && view.bank[r] > 0)} onChange={setBankGet} />
              <Button className={exp?.type === 'bankTrade' ? 'ct-hintbtn' : ''} disabled={busy || !bankGive || !bankGet || bankGive === bankGet || !legal.bank.some((h) => h.give === bankGive && h.get === bankGet)}
                onClick={() => act({ type: 'bankTrade', give: bankGive!, get: bankGet! })}>
                {bankGive ? `${fa(bankRate(bankGive) ?? 4)} ${tx(RES_T[bankGive])}` : '…'} ← ۱ {bankGet ? tx(RES_T[bankGet]) : '…'}
              </Button>
            </Panel>
          )}

          {myTurn && view.phase === 'main' && (
            <Panel title={`${tx(terms.trade)} با بازیکنان`}>
              {view.trade ? (
                <>
                  <p>پیشنهاد شما: <strong>{handText(view.trade.give)}</strong> در ازای <strong>{handText(view.trade.get)}</strong></p>
                  <ul className="ct-answers">
                    {Array.from({ length: view.players }, (_, s) => s).filter((s) => s !== mySeat && view.active[s]).map((s) => (
                      <li key={s}>
                        <bdi>{seatName(s)}</bdi>: {view.trade!.accepted.includes(s) ? '✓ پذیرفت' : view.trade!.declined.includes(s) ? '✗ رد کرد' : '… منتظر'}
                        {hints.some((h) => h.type === 'confirmTrade' && h.seat === s) && <Button size="sm" disabled={busy} onClick={() => act({ type: 'confirmTrade', seat: s })}><T t={terms.trade} /> با <bdi>{seatName(s)}</bdi></Button>}
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => act({ type: 'cancelTrade' })}>پس گرفتن پیشنهاد</Button>
                </>
              ) : (
                <details className="ct-offer">
                  <summary><T t={terms.tradeOffer} /></summary>
                  <HandPicker title="می‌دهم" values={give} limit={(r) => hand[r]} onChange={setGive} />
                  <HandPicker title="می‌خواهم" values={get} limit={() => 19} onChange={setGet} />
                  <Button disabled={busy || !tradeOk || !has('offerTrade')} onClick={() => { act({ type: 'offerTrade', give, get }); setGive(zero()); setGet(zero()); }}>ارسال پیشنهاد به همه</Button>
                  <p className="ct-help">یک <T t={terms.resource} /> نمی‌تواند هم در «می‌دهم» و هم در «می‌خواهم» باشد. پیشنهاد با هر حرکت دیگر شما پس گرفته می‌شود.</p>
                </details>
              )}
            </Panel>
          )}

          {!myTurn && view.trade && view.phase === 'main' && mySeat !== null && view.active[mySeat] && (
            <Panel title={tx(terms.tradeOffer)} tone="decide">
              <p><bdi>{seatName(view.current)}</bdi> می‌دهد <strong>{handText(view.trade.give)}</strong> و می‌خواهد <strong>{handText(view.trade.get)}</strong>.</p>
              <div className="row">
                <Button disabled={busy || !has('acceptTrade')} onClick={() => act({ type: 'acceptTrade' })}>{view.trade.accepted.includes(mySeat) ? '✓ پذیرفتید' : 'می‌پذیرم'}</Button>
                <Button variant="secondary" disabled={busy || !has('declineTrade')} onClick={() => act({ type: 'declineTrade' })}>{view.trade.declined.includes(mySeat) ? 'رد کردید' : 'نه'}</Button>
              </div>
              {!has('acceptTrade') && !view.trade.accepted.includes(mySeat) && <p className="ct-help"><T t={terms.resources} /> لازم را ندارید.</p>}
            </Panel>
          )}

          {view.myHand && !view.outcome && (
            <section className="ct-hand" aria-label={`${tx(terms.hand)} شما`}>
              <h3><T t={terms.resources} /> شما ({fa(sum(hand))})</h3>
              <ul className="ct-cards">
                {RESOURCES.map((r) => (
                  <li key={r} className={`ct-card ct-res--${r}${hand[r] === 0 ? ' ct-card--empty' : ''}`} hidden={framed && hand[r] === 0} aria-label={`${tx(RES_T[r])}: ${fa(hand[r])}`}>
                    <span aria-hidden="true" className="ct-card__icon"><ResIcon r={r} /></span>
                    <span className="ct-card__name">{tx(RES_T[r])}</span>
                    <Pop v={hand[r]} text={fa(hand[r])} className="ct-card__n" />
                  </li>
                ))}
              </ul>
              {(view.myDevs?.length ?? 0) > 0 && (
                <>
                  <h3><T t={terms.devCards} /> شما</h3>
                  <ul className="ct-devs">
                    {(Object.keys(devCounts) as Dev[]).map((d) => {
                      const t = playType[d];
                      const can = !!t && has(t);
                      return (
                        <li key={d} className="ct-dev" data-flip={`dev-${d}`} data-flip-from="devdeck">
                          <img className="ct-dev__art" src={DEV_ART[d]} alt="" aria-hidden="true" draggable={false} />
                          <span><strong><T t={DEV_T[d]} /></strong> ×{fa(devCounts[d]!.n)}{devCounts[d]!.fresh ? ` (${fa(devCounts[d]!.fresh)} تازه)` : ''}</span>
                          <span className="ct-help">{devHelp()[d]}</span>
                          {can && <Button size="sm" disabled={busy} onClick={() => {
                            if (d === 'plenty' || d === 'monopoly') { setDevPick(d); setPick([]); } else act({ type: t! });
                          }}>بازی</Button>}
                        </li>
                      );
                    })}
                  </ul>
                  {!view.devPlayed && myTurn && <p className="ct-help">در هر نوبت فقط یک <T t={terms.devCard} />، و نه کارتی که همین نوبت خریده‌اید.</p>}
                </>
              )}
              {devPick === 'plenty' && (
                <Panel title={`${tx(terms.yearOfPlenty)}: ۲ ${tx(terms.resource)} انتخاب کنید`} tone="decide">
                  <div className="ct-choice">
                    {RESOURCES.map((r) => <button key={r} type="button" className={`ct-chip ct-res--${r}`} disabled={pick.length >= 2 || view.bank[r] < 1 + pick.filter((x) => x === r).length} onClick={() => setPick([...pick, r])}><span aria-hidden="true"><ResIcon r={r} /></span> {tx(RES_T[r])}</button>)}
                  </div>
                  <p>انتخاب: {pick.map((r) => tx(RES_T[r])).join(' + ') || '—'}</p>
                  <div className="row">
                    <Button disabled={busy || pick.length !== 2} onClick={() => { act({ type: 'playPlenty', a: pick[0]!, b: pick[1]! }); setDevPick(null); }}>گرفتن</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDevPick(null); setPick([]); }}>انصراف</Button>
                  </div>
                </Panel>
              )}
              {devPick === 'monopoly' && (
                <Panel title={`${tx(terms.monopoly)}: کدام ${tx(terms.resource)}؟`} tone="decide">
                  <div className="ct-choice">
                    {RESOURCES.map((r) => <button key={r} type="button" className={`ct-chip ct-res--${r}`} disabled={busy} onClick={() => { act({ type: 'playMonopoly', res: r }); setDevPick(null); }}><span aria-hidden="true"><ResIcon r={r} /></span> {tx(RES_T[r])}</button>)}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setDevPick(null)}>انصراف</Button>
                </Panel>
              )}
            </section>
          )}

          {myTurn && has('endTurn') && <DockSlot><Button variant="secondary" disabled={busy} onClick={() => act({ type: 'endTurn' })}><T t={terms.endTurn} /></Button></DockSlot>}

          {!framed && <details className="ct-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-8).reverse().map((e) => <li key={e.seq}>{describe(e, view, seatName)}</li>)}</ol>
          </details>}
        </div>
      </div>
    </div>
  );
}
