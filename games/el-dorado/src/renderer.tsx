// راه الدورادو renderer: an explorer's map. The hex jungle is drawn in SVG from the start camps (bottom) to the
// golden city (top): jungle green, river blue, village ochre, rubble grey, base camps rust, mountains dark. Pick a
// card from your hand to light up the hexes it can enter (or continue with the points left on the active card);
// rubble and camps ask which cards to give up. The market lists every card with price and stock.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { COLS, MAP, ROWS, TYPE, coinValue, type CardType, type EdView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const PAWN = ['#e0473c', '#2f7de1', '#f2c230', '#9b59d0'];
const KIND_FA: Record<string, string> = { g: 'جنگل', b: 'آب', y: 'روستا', r: 'آوار', c: 'اردوگاه', m: 'کوه', s: 'شروع', E: 'الدورادو' };
const SYM_FA: Record<string, string> = { g: 'قمه', b: 'پارو', y: 'سکه', any: 'همه‌کاره' };
const R = 18, W = Math.sqrt(3) * R;
const center = (i: number) => { const r = Math.floor(i / COLS), c = i % COLS; return [W / 2 + c * W + (r % 2 ? W / 2 : 0) + 2, (ROWS - 1 - r) * R * 1.5 + R + 2] as const; };
const hexPath = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 180 * (60 * k - 30); return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`; }).join(' ');

export function EdCard({ t, size = 'md' }: { t: CardType; size?: 'sm' | 'md' }) {
  return (
    <span className={`ed-card ed-card--${size} ed-s--${t.sym} ed-a--${t.key}`} aria-label={`${t.name}: ${t.pts ? `${fa(t.pts)} ${SYM_FA[t.sym]}` : t.draw ? `${fa(t.draw)} کارت بکش` : 'حرکت آزاد'}${t.once ? '، یک‌بار مصرف' : ''}`}>
      <b className="ed-card__pts">{t.pts ? fa(t.pts) : t.native ? '➜' : `+${fa(t.draw!)}`}</b>
      <span className="ed-card__name">{t.name}</span>
      {size === 'md' && <small>{t.pts ? SYM_FA[t.sym] : t.native ? 'یک خانه، بی‌هزینه' : t.trash ? 'کشیدن و حذف' : 'کشیدن کارت'}{t.once ? ' · یک‌بار' : ''}</small>}
    </span>
  );
}

export function MapSvg({ view, targets, onPick, hint }: { view: Pick<EdView, 'explorers'>; targets?: Set<number>; onPick?: (hex: number) => void; hint?: number }) {
  return (
    <svg className="ed-map" viewBox={`0 0 ${COLS * W + W / 2 + 4} ${(ROWS - 1) * R * 1.5 + 2 * R + 4}`} role="img" aria-label="نقشه">
      {MAP.map((h, i) => {
        const [x, y] = center(i);
        const can = targets?.has(i);
        return (
          <g key={i} data-hex={i} className={`ed-hex ed-k--${h.kind} ${can ? 'ed-hex--can' : ''} ${can && hint === i ? 'ed-hint' : ''}`} onClick={can && onPick ? () => onPick(i) : undefined}
            role={can ? 'button' : undefined} aria-label={can ? `رفتن به ${KIND_FA[h.kind]}${h.cost ? ` ${fa(h.cost)}` : ''}` : undefined} tabIndex={can ? 0 : undefined}
            onKeyDown={can && onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onPick(i); } : undefined}>
            <polygon points={hexPath(x, y)} />
            {h.cost > 0 && <text x={x} y={y + 4} textAnchor="middle">{fa(h.cost)}</text>}
            {h.kind === 'E' && <text x={x} y={y + 5} textAnchor="middle" className="ed-star">★</text>}
          </g>
        );
      })}
      {view.explorers.map((e, k) => { const [x, y] = center(e.pos); return <circle key={k} data-seat={k} data-hex={e.pos} className="ed-pawn" cx={x} cy={y - 7} r={6} fill={PAWN[k]} style={{ transform: 'none' }} />; })}
    </svg>
  );
}

type Hint = { type: string; card?: number; to?: number; key?: string } | null;

export default function ElDoradoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<EdView>) {
  const hint = expected as unknown as Hint;
  const hand = view.hand ?? [];
  // Hand cards glide in from the deck and a bought card flies from the market to its buyer; the pawn slides hex to hex (CSS transition).
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const nth = new Map<string, number>();
  const handIds = hand.map((k) => { const n = nth.get(k) ?? 0; nth.set(k, n + 1); return `h-${k}-${n}`; });
  const [sel, setSel] = useState<number | null>(null);
  const [pay, setPay] = useState<number[]>([]);
  useEffect(() => { setSel(null); setPay([]); }, [view.seq]);
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
    : myTurn ? { tone: 'mine' as const, text: chosen === null ? 'کارتی برای حرکت انتخاب کنید، بخرید یا نوبت را تمام کنید' : 'یک خانهٔ روشن را انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const coins = coinValue(hand);

  return (
    <div className="ed" ref={root} data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <ul className="ed-crew" aria-label="گروه‌ها">
        {view.explorers.map((e, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={`ed-crew__p ${k === view.current && !view.outcome ? 'is-now' : ''}`} style={{ ['--pawn' as string]: PAWN[k] }}>
            <i className="ed-dot" /><bdi>{who(k)}</bdi>
            <small>{e.arrived ? 'رسید ★' : `دسته ${fa(e.deck)} · دورریز ${fa(e.discard)}`}</small>
            {view.last?.kind === 'buy' && view.last.seat === k && view.last.card && <span className="ed-chip" data-flip={`buy-${view.seq}`} data-flip-from={`mk-${view.last.card}`}>{TYPE[view.last.card]?.name}</span>}
          </li>
        ))}
      </ul>

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
                <span key={`${i}-${k}`} className="ed-slot" data-flip={handIds[i]} data-flip-from={`seat-${mySeat ?? 0}`}>
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
              <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'endTurn' ? 'ed-hint' : ''} onClick={() => onAction({ type: 'endTurn', discard: [] })}>پایان نوبت</Button>
              {hand.length > 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'endTurn', discard: hand.map((_, i) => i) })}>پایان نوبت و دور ریختن دست</Button>}
            </div>
          )}
        </section>
      )}

      {!view.outcome && (
        <section className="ed-market" aria-label="بازار">
          <p className="ed-market__title">بازار {canBuy && myTurn ? `· ${fa(coins)} سکه در دست` : view.bought ? '· این نوبت خرید شد' : ''}</p>
          <div className="ed-market__row">
            {Object.entries(view.market).map(([k, n]) => {
              const t = TYPE[k]!;
              const can = myTurn && canBuy && n > 0 && coins >= t.cost;
              return (
                <button key={k} type="button" data-flip-anchor={`mk-${k}`} disabled={busy || !can} onClick={() => onAction({ type: 'buy', key: k, pay: autoPay(t.cost) })}
                  className={['ed-buy', can ? 'is-can' : '', hint?.type === 'buy' && hint.key === k ? 'ed-hint' : ''].join(' ')}>
                  <EdCard t={t} size="sm" /><i className="ed-buy__cost">{fa(t.cost)}</i><small key={n} className="bg-pop">×{fa(n)}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
