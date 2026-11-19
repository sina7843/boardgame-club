// راه الدورادو renderer: an explorer's map. The hex jungle is drawn in SVG from the start camps (bottom) to the
// golden city (top): jungle green, river blue, village ochre, rubble grey, base camps rust, mountains dark. Pick a
// card from your hand to light up the hexes it can enter (or continue with the points left on the active card);
// rubble and camps ask which cards to give up. The market lists every card with price and stock.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, useFlip, useInFrame, type GameRendererProps, DockSlot } from '@bg/ui';
import mapArt from './art/ed-map.png';
import pawn0 from './art/ed-pawn-0.png';
import pawn1 from './art/ed-pawn-1.png';
import pawn2 from './art/ed-pawn-2.png';
import pawn3 from './art/ed-pawn-3.png';
import adventurer from './art/ed-adventurer.png'; import captain from './art/ed-captain.png'; import cartographer from './art/ed-cartographer.png';
import chest from './art/ed-chest.png'; import compass from './art/ed-compass.png'; import explorer from './art/ed-explorer.png';
import jack from './art/ed-jack.png'; import journalist from './art/ed-journalist.png'; import machete from './art/ed-machete.png';
import millionaire from './art/ed-millionaire.png'; import native from './art/ed-native.png'; import photographer from './art/ed-photographer.png';
import pioneer from './art/ed-pioneer.png'; import plane from './art/ed-plane.png'; import sailor from './art/ed-sailor.png';
import scientist from './art/ed-scientist.png'; import scout from './art/ed-scout.png'; import trailblazer from './art/ed-trailblazer.png';
import traveller from './art/ed-traveller.png';

// Art: design/games/group-d/art/el-dorado (printed map with the hex grid, full card faces, pawns).
const CARD_ART: Record<string, string> = { adventurer, captain, cartographer, chest, compass, explorer, jack, journalist, machete, millionaire, native, photographer, pioneer, plane, sailor, scientist, scout, trailblazer, traveller };
const PAWN_ART = [pawn0, pawn1, pawn2, pawn3];
import { COLS, MAP, ROWS, TYPE, coinValue, type CardType, type EdView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const PAWN = ['#e0473c', '#2f7de1', '#f2c230', '#9b59d0']; // fallback dot colours outside the frame
const KIND_FA: Record<string, string> = { g: 'جنگل', b: 'آب', y: 'روستا', r: 'آوار', c: 'اردوگاه', m: 'کوه', s: 'شروع', E: 'الدورادو' };
const SYM_FA: Record<string, string> = { g: 'قمه', b: 'پارو', y: 'سکه', any: 'همه‌کاره' };
// Hex grid measured on the 372x553 map image: pointy hexes, R 32, column pitch 54.3, row pitch 48, odd rows shifted half a column.
const R = 32, W = 54.3, MAP_W = 372, MAP_H = 553;
const center = (i: number) => { const r = Math.floor(i / COLS), c = i % COLS; return [36.75 + c * W + (r % 2 ? W / 2 : 0), 37.6 + (ROWS - 1 - r) * 48] as const; };
const hexPath = (x: number, y: number) => [[0, -R], [27, -R / 2], [27, R / 2], [0, R], [-27, R / 2], [-27, -R / 2]].map(([dx, dy]) => `${(x + dx!).toFixed(1)},${(y + dy!).toFixed(1)}`).join(' ');

export function EdCard({ t, size = 'md' }: { t: CardType; size?: 'sm' | 'md' }) {
  return (
    <span className={`ed-card ed-card--${size}`} aria-label={`${t.name}: ${t.pts ? `${fa(t.pts)} ${SYM_FA[t.sym]}` : t.draw ? `${fa(t.draw)} کارت بکش` : 'حرکت آزاد'}${t.once ? '، یک‌بار مصرف' : ''}`}>
      <img src={CARD_ART[t.key]} alt="" draggable={false} />
      <span className="visually-hidden">{t.name}</span>
    </span>
  );
}

export function MapSvg({ view, targets, onPick, hint }: { view: Pick<EdView, 'explorers'>; targets?: Set<number>; onPick?: (hex: number) => void; hint?: number }) {
  return (
    <div className="ed-mapi">
      <img src={mapArt} alt="" draggable={false} />
      <svg className="ed-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="نقشه">
        {MAP.map((h, i) => {
          if (!targets?.has(i)) return null;
          const [x, y] = center(i);
          return (
            <g key={i} data-hex={i} className={`ed-hex ed-hex--can ${hint === i ? 'ed-hint' : ''}`} onClick={onPick ? () => onPick(i) : undefined}
              role="button" aria-label={`رفتن به ${KIND_FA[h.kind]}${h.cost ? ` ${fa(h.cost)}` : ''}`} tabIndex={0}
              onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onPick(i); } : undefined}>
              <polygon className="ed-tap" points={hexPath(x, y)} />
            </g>
          );
        })}
        {view.explorers.map((e, k) => {
          const [x, y] = center(e.pos);
          const px = x + (k - 1.5) * 9;
          return (
            <g key={k}>
              <image className="ed-pawn" href={PAWN_ART[k]} x={px - 11} y={y - 11} width={22} height={22} />
              <circle data-seat={k} data-hex={e.pos} cx={px} cy={y} r={11} fill="none" pointerEvents="none" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type Hint = { type: string; card?: number; to?: number; key?: string } | null;

/** Stable ids for the hand (cards leave from anywhere, draws append): consecutive hands are aligned by LCS. */
function useQueueIds(list: readonly string[], prefix: string): string[] {
  const r = useRef<{ list: readonly string[]; ids: string[]; n: number } | null>(null);
  if (!r.current) r.current = { list, ids: list.map((_, i) => `${prefix}${i}`), n: list.length };
  else if (r.current.list.join() !== list.join()) {
    const a = r.current.list, oi = r.current.ids;
    let n = r.current.n;
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(list.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = list.length - 1; j >= 0; j--) dp[i]![j] = a[i] === list[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    const ids = new Array<string>(list.length);
    for (let i = 0, j = 0; j < list.length;) {
      if (i < a.length && dp[i + 1]![j] === dp[i]![j]) i++;
      else if (i < a.length && a[i] === list[j]) ids[j++] = oi[i++]!;
      else ids[j++] = `${prefix}${n++}`;
    }
    r.current = { list, ids, n };
  }
  return r.current.ids;
}

/** My queued move / buy shown at once (pawn on the hex, spent cards gone, bought card on its way); nothing random. */
function preview(v: EdView, me: number | null, q: GameRendererProps<EdView>['queued']): EdView {
  if (!q || me === null || !v.hand) return v;
  const drop = (xs: number[]) => v.hand!.filter((_, i) => !xs.includes(i));
  if (q.type === 'move') {
    const spent = q.pay ? (q.pay as number[]) : (q.card as number) >= 0 ? [q.card as number] : [];
    return { ...v, hand: drop(spent), explorers: v.explorers.map((e, k) => (k === me ? { ...e, pos: q.to as number } : e)) };
  }
  if (q.type === 'buy') {
    const key = q.key as string;
    return { ...v, hand: drop(q.pay as number[]), market: { ...v.market, [key]: (v.market[key] ?? 1) - 1 }, last: { seat: me, kind: 'buy', card: key }, seq: v.seq + 1 };
  }
  return v;
}

export default function ElDoradoRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<EdView>) {
  const hint = expected as unknown as Hint;
  // Undo window: my move or buy shows at once; undo clears `queued` and everything glides back.
  const view = preview(served, mySeat, queued);
  const hand = view.hand ?? [];
  // Hand cards glide in from the deck and a bought card flies from the market to its buyer; the pawn slides hex to hex (CSS transition).
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const handIds = useQueueIds(hand, 'h');
  const [sel, setSel] = useState<number | null>(null);
  const [pay, setPay] = useState<number[]>([]);
  useEffect(() => { setSel(null); setPay([]); }, [view.seq, hand.length]);
  const moves = legalActions.filter((a) => a.type === 'move') as unknown as { to: number; card?: number; discardCards?: number }[];
  const myTurn = legalActions.some((a) => a.type === 'endTurn');
  const canBuy = legalActions.some((a) => a.type === 'buy');
  const usable = new Set(legalActions.filter((a) => a.type === 'use').map((a) => a.card as number));
  const chosen = sel ?? (view.active ? -1 : null);
  const targets = new Set(moves.filter((m) => (m.discardCards !== undefined ? pay.length === m.discardCards : m.card === chosen)).map((m) => m.to));
  const rubble = moves.filter((m) => m.discardCards !== undefined);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const pick = (to: number) => {
    const hex = MAP[to]!;
    if (hex.kind === 'r' || hex.kind === 'c') onAction({ type: 'move', to, card: -1, pay });
    else onAction({ type: 'move', to, card: chosen!, ...(chosen !== null && chosen >= 0 && TYPE[hand[chosen]!]!.sym === 'any' && hex.kind !== 'E' ? { as: hex.kind } : {}) });
  };
  /** Pays with coin cards first (largest first), then half-coin cards, dropping any card the price does not need. */
  const autoPay = (cost: number) => {
    const order = hand.map((k, i) => ({ i, v: coinValue([k]) })).sort((a, b) => b.v - a.v);
    const out: { i: number; v: number }[] = [];
    for (const c of order) { if (out.reduce((n, x) => n + x.v, 0) >= cost) break; out.push(c); }
    return out.filter((c, _, all) => all.reduce((n, x) => n + x.v, 0) - c.v < cost).map((c) => c.i);
  };
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: chosen === null ? 'کارتی برای حرکت انتخاب کنید، بخرید یا نوبت را تمام کنید' : 'یک خانهٔ روشن را انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const coins = coinValue(hand);
  const framed = useInFrame() !== null;

  return (
    <div className={framed ? 'ed ed--framed' : 'ed'} ref={root} data-seq={view.seq}>
      {framed && <RailSlot>{status && <p><b>{status.text}</b></p>}<p>کارت را بازی کنید تا خانه‌های قابل رفتن روشن شوند؛ عدد هر خانه هزینهٔ ورود است. آوار و اردوگاه با دور ریختن کارت باز می‌شوند.</p></RailSlot>}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!framed && <ul className="ed-crew" aria-label="گروه‌ها">
        {view.explorers.map((e, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={`ed-crew__p ${k === view.current && !view.outcome ? 'is-now' : ''}`} style={{ ['--pawn' as string]: PAWN[k] }}>
            <i className="ed-dot" /><bdi>{who(k)}</bdi>
            <small>{e.arrived ? 'رسید ★' : `دسته ${fa(e.deck)}، دورریز ${fa(e.discard)}`}</small>
            {view.last?.kind === 'buy' && view.last.seat === k && view.last.card && <span className="ed-chip" data-flip={`buy-${view.seq}`} data-flip-from={`mk-${view.last.card}`}>{TYPE[view.last.card]?.name}</span>}
          </li>
        ))}
      </ul>}

      <div className="ed-board">
        <MapSvg view={view} targets={myTurn ? targets : undefined} onPick={busy ? undefined : pick} hint={hint?.type === 'move' ? hint.to : undefined} />
      </div>

      {view.hand && !view.outcome && (
        <section className="ed-me" aria-label="دست شما">
          {view.active && myTurn && (
            <button type="button" className={`ed-active ${chosen === -1 ? 'is-on' : ''}`} onClick={() => { setSel(null); setPay([]); }}>
              ادامه با {TYPE[view.active.key]!.name}: {fa(view.active.left)} {SYM_FA[view.active.sym]} مانده
            </button>
          )}
          <div className="ed-hand">
            {hand.map((k, i) => {
              const t = TYPE[k]!;
              const onHint = hint?.type === 'move' && hint.card === i && sel !== i;
              return (
                <span key={handIds[i]} className="ed-slot" data-flip={handIds[i]} data-flip-from={`seat-${mySeat ?? 0}`} data-flip-exit={`seat-${mySeat ?? 0}`}>
                  <button type="button" disabled={busy || !myTurn} aria-pressed={sel === i || pay.includes(i)}
                    className={['ed-pick', sel === i ? 'is-on' : '', pay.includes(i) ? 'is-pay' : '', onHint ? 'ed-hint' : ''].join(' ')}
                    onClick={() => { if (rubble.length && sel === null && pay.length) setPay(pay.includes(i) ? pay.filter((x) => x !== i) : [...pay, i]); else { setSel(sel === i ? null : i); } }}>
                    <EdCard t={t} />
                  </button>
                  {usable.has(i) && <button type="button" className="ed-mini" disabled={busy} onClick={() => onAction({ type: 'use', card: i })}>استفاده</button>}
                  {rubble.length > 0 && <button type="button" className="ed-mini" disabled={busy} aria-pressed={pay.includes(i)} onClick={() => { setSel(null); setPay(pay.includes(i) ? pay.filter((x) => x !== i) : [...pay, i]); }}>{pay.includes(i) ? 'برای آوار ✓' : 'برای آوار'}</button>}
                </span>
              );
            })}
          </div>
          {myTurn && (
            <div className="ed-bar">
              <DockSlot><Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'endTurn' ? 'ed-hint' : ''} onClick={() => onAction({ type: 'endTurn', discard: [] })}>پایان نوبت</Button></DockSlot>
              {hand.length > 0 && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'endTurn', discard: hand.map((_, i) => i) })}>پایان نوبت و دور ریختن دست</Button></DockSlot>}
            </div>
          )}
        </section>
      )}

      {!view.outcome && (
        <section className="ed-market" aria-label="بازار">
          <p className="ed-market__title">بازار {canBuy && myTurn ? `، ${fa(coins)} سکه در دست` : view.bought ? '، این نوبت خرید شد' : ''}</p>
          <div className="ed-market__row">
            {Object.entries(view.market).map(([k, n]) => {
              const t = TYPE[k]!;
              const can = myTurn && canBuy && n > 0 && coins >= t.cost;
              return (
                <button key={k} type="button" data-flip-anchor={`mk-${k}`} disabled={busy || !can} onClick={() => onAction({ type: 'buy', key: k, pay: autoPay(t.cost) })}
                  className={['ed-buy', can ? 'is-can' : '', hint?.type === 'buy' && hint.key === k ? 'ed-hint' : ''].join(' ')}>
                  <EdCard t={t} size="sm" /><small key={n} className="bg-pop">×{fa(n)}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
