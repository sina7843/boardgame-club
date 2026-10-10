// راه ادویه renderer: a caravanserai on the spice road. Orders along the top (the first two carry gold and silver
// coins), the merchant market with spices left on its cards, and your caravan, hand and played pile. Tap a card to
// play it (trades take a count, upgrades the spices to raise), tap a market card to hire it (the cheapest spices are
// paid along the row), tap an order to deliver it.
import './renderer.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import spiceY from './art/spice-y.webp';
import spiceR from './art/spice-r.webp';
import spiceG from './art/spice-g.webp';
import spiceB from './art/spice-b.webp';
import { MERCHANTS, ORDERS, SPICES, scoreOf, upgrade, type Bag, type CenturyView, type Spice } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const SPICE_FA: Record<Spice, string> = { y: 'زردچوبه', r: 'زعفران', g: 'هل', b: 'دارچین' };

// Spice art is cut from a generated sheet (see DECISIONS.md). Tiny (sm) glyphs stay coloured cubes.
const ART: Record<Spice, string> = { y: spiceY, r: spiceR, g: spiceG, b: spiceB };

/**
 * `fid` makes each cube a motion piece (id = fid + spice + index); `from` is the anchor a newly added cube flies in from,
 * `exit` where a cube that is spent goes.
 */
export function Cubes({ bag, size = 'md', fid, from, exit }: { bag: Bag; size?: 'sm' | 'md'; fid?: string; from?: string; exit?: string }) {
  return (
    <span className={`ct-cubes ct-cubes--${size}`}>
      {SPICES.flatMap((s) => Array.from({ length: bag[s] }, (_, i) => size === 'sm'
        ? <i key={`${s}${i}`} className={`ct-cube ct-s--${s}`} title={SPICE_FA[s]} data-flip={fid ? `${fid}-${s}${i}` : undefined} data-flip-from={from} data-flip-exit={exit} />
        : <img key={`${s}${i}`} className="ct-spice" src={ART[s]} alt={SPICE_FA[s]} title={SPICE_FA[s]} draggable={false} data-flip={fid ? `${fid}-${s}${i}` : undefined} data-flip-from={from} data-flip-exit={exit} />))}
    </span>
  );
}

/**
 * The caravan card as printed: ten cube slots in two rows; cubes fill them cheapest first, empty slots stay dashed.
 * Cubes keep the same motion ids as `Cubes` (fid + spice + index).
 */
function Caravan({ bag, fid }: { bag: Bag; fid: string }) {
  const list = SPICES.flatMap((s) => Array.from({ length: bag[s] }, (_, i) => [s, i] as const));
  const label = SPICES.filter((s) => bag[s] > 0).map((s) => `${fa(bag[s])} ${SPICE_FA[s]}`).join('، ') || 'خالی';
  return (
    <span className="ct-cv" role="img" aria-label={`کاروان: ${label} (${fa(list.length)} از ۱۰)`}>
      {Array.from({ length: Math.max(10, list.length) }, (_, k) => {
        const c = list[k];
        return (
          <span key={k} className={k >= 10 ? 'ct-cv__slot ct-cv__slot--over' : 'ct-cv__slot'}>
            {c && <img className="ct-spice" src={ART[c[0]]} alt="" draggable={false} data-flip={`${fid}-${c[0]}${c[1]}`} data-flip-exit="drop" />}
          </span>
        );
      })}
    </span>
  );
}

export function MerchantCard({ id }: { id: number }) {
  const m = MERCHANTS[id]!;
  return (
    <span className={`ct-card ct-card--${m.kind}`}>
      {m.kind === 'spice' && <><small>ادویه</small><Cubes bag={m.gain} /></>}
      {m.kind === 'upgrade' && <><small>ارتقا</small><b className="ct-up">{'▲'.repeat(m.n)}</b></>}
      {m.kind === 'trade' && <><small>معاوضه</small><span className="ct-trade"><Cubes bag={m.give} size="sm" /><b>⇣</b><Cubes bag={m.gain} size="sm" /></span></>}
    </span>
  );
}

export function OrderCard({ id }: { id: number }) {
  const o = ORDERS[id]!;
  return <span className="ct-order"><b className="ct-order__pts">{fa(o.points)}</b><Cubes bag={o.need} /></span>;
}

/**
 * Undo-window preview: my move applied to the view with what the client already knows (the same arithmetic as the
 * rules). Hidden refills (the next merchant or order from the decks) wait for the server.
 */
function preview(v: CenturyView, me: number, q: GameAction | null | undefined): CenturyView {
  if (!q || me < 0) return v;
  const cubes = v.cubes.map((b) => ({ ...b })), c = cubes[me]!;
  const hands = v.hands.map((h) => h.slice()), played = v.played.map((h) => h.slice());
  const won = v.won.map((w) => w.slice()), coins = v.coins.map((x) => ({ ...x }));
  let { market, orders, gold, silver } = v;
  switch (q.type) {
    case 'play': {
      const m = MERCHANTS[q.card as number]!;
      if (m.kind === 'spice') for (const x of SPICES) c[x] += m.gain[x];
      else if (m.kind === 'trade') for (const x of SPICES) c[x] += (m.gain[x] - m.give[x]) * ((q.times as number | undefined) ?? 1);
      else Object.assign(c, upgrade(c, q.upgrades as Spice[]) ?? {});
      hands[me] = hands[me]!.filter((x) => x !== q.card);
      played[me]!.push(q.card as number);
      break;
    }
    case 'rest': hands[me]!.push(...played[me]!); played[me] = []; break;
    case 'acquire': {
      market = v.market.map((x) => ({ card: x.card, cubes: { ...x.cubes } }));
      (q.pay as Spice[]).forEach((x, i) => { c[x] -= 1; market[i]!.cubes[x] += 1; });
      const [slot] = market.splice(q.slot as number, 1);
      if (slot) { for (const x of SPICES) c[x] += slot.cubes[x]; hands[me]!.push(slot.card); }
      break;
    }
    case 'claim': {
      const id = v.orders[q.slot as number];
      if (id === undefined) break;
      orders = v.orders.filter((_, i) => i !== q.slot);
      for (const x of SPICES) c[x] -= ORDERS[id]!.need[x];
      won[me]!.push(id);
      if (q.slot === 0 && gold > 0) { gold -= 1; coins[me]!.gold += 1; }
      else if ((q.slot === 0 || (q.slot === 1 && gold > 0)) && silver > 0) { silver -= 1; coins[me]!.silver += 1; }
      break;
    }
    case 'discard': for (const x of q.cubes as Spice[]) c[x] -= 1; break;
    default: return v;
  }
  return { ...v, cubes, hands, played, won, coins, market, orders, gold, silver, scores: cubes.map((_, k) => scoreOf({ won, coins, cubes }, k)) };
}

/** A number that bumps only when it changed (the key remounts it so the animation replays). */
function Bump({ v, className, children }: { v: unknown; className: string; children: ReactNode }) {
  return <span key={String(v)} className={`${className} ${usePop(v)}`}>{children}</span>;
}

const cheapest = (bag: Bag, n: number) => { const b = { ...bag }; const out: Spice[] = []; for (let k = 0; k < n; k++) { const s = SPICES.find((x) => b[x] > 0); if (!s) break; b[s] -= 1; out.push(s); } return out; };

export default function CenturyRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction: send, expected, queued }: GameRendererProps<CenturyView>) {
  const me = mySeat ?? -1;
  const view = preview(served, me, queued);
  // Cards glide market → hand → played pile and back on rest; spice cubes fly onto market cards from the paying caravan.
  // My own move is previewed in the undo window (and animates back on undo).
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const plays = new Map(legalActions.filter((a) => a.type === 'play').map((a) => [a.card as number, a]));
  const acquire = new Set(legalActions.filter((a) => a.type === 'acquire').map((a) => a.slot as number));
  const claims = new Set(legalActions.filter((a) => a.type === 'claim').map((a) => a.slot as number));
  const canRest = legalActions.some((a) => a.type === 'rest');
  const disc = legalActions.find((a) => a.type === 'discard') as { count: number } | undefined;
  const [pick, setPick] = useState<number | null>(null);
  const [times, setTimes] = useState(1);
  const [ups, setUps] = useState<Spice[]>([]);
  useEffect(() => { setPick(null); setTimes(1); setUps([]); }, [view.seq]);
  const onAction = (a: GameAction) => { setPick(null); send(a); };
  const hint = expected as unknown as { type: string; card?: number; slot?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myCubes = me >= 0 ? view.cubes[me]! : null;
  const myTurn = plays.size > 0 || acquire.size > 0 || canRest || claims.size > 0 || !!disc;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : disc ? { tone: 'mine' as const, text: `کاروان پر است: ${fa(disc.count)} ادویه کنار بگذارید` }
      : myTurn ? { tone: 'mine' as const, text: view.ending ? 'دور آخر! کارت بازی کنید، تاجر بگیرید، استراحت کنید یا سفارش تحویل دهید' : 'کارت بازی کنید، تاجر بگیرید، استراحت کنید یا سفارش تحویل دهید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const tapHand = (id: number) => {
    const h = plays.get(id);
    if (!h || busy) return;
    const mc = MERCHANTS[id]!;
    if (mc.kind === 'spice') { onAction({ type: 'play', card: id }); return; }
    setPick(pick === id ? null : id); setTimes(1); setUps([]);
  };
  // The selection can outlive a state change for one render (the reset runs in an effect): only use it while legal.
  const pickHint = pick !== null ? plays.get(pick) : undefined;
  const pickM = pickHint ? MERCHANTS[pick!]! : null;
  const maxTimes = (pickHint?.max as number | undefined) ?? 1;
  const upPreview = myCubes && ups.length ? upgrade(myCubes, ups) : null;

  return (
    <div className="ct" ref={root} data-seq={served.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {!view.outcome && (
        <>
          <section className="ct__orders" aria-label="سفارش‌ها">
            {view.orders.map((id, i) => (
              <button key={id} type="button" data-flip={`o${id}`} data-flip-exit={`seat-${view.current}`} className={['ct-slot', claims.has(i) ? 'ct-slot--can' : '', hint?.type === 'claim' && hint.slot === i ? 'ct-hint' : ''].join(' ')}
                disabled={!claims.has(i) || busy} onClick={() => onAction({ type: 'claim', slot: i })} aria-label={`تحویل سفارش ${fa(ORDERS[id]!.points)} امتیازی`}>
                <OrderCard id={id} />
                {i === 0 && view.gold > 0 && <span className="ct-coin ct-coin--gold bg-pop" key={view.gold}>{fa(view.gold)}</span>}
                {i === (view.gold > 0 ? 1 : 0) && view.silver > 0 && <span className="ct-coin ct-coin--silver bg-pop" key={view.silver}>{fa(view.silver)}</span>}
              </button>
            ))}
          </section>
          <section className="ct__market" aria-label="تاجرها">
            {view.market.map((x, i) => (
              <button key={x.card} type="button" data-flip={`m${x.card}`} data-flip-exit={`seat-${view.current}`} className={['ct-slot', acquire.has(i) ? 'ct-slot--can' : ''].join(' ')} disabled={!acquire.has(i) || busy}
                onClick={() => myCubes && onAction({ type: 'acquire', slot: i, pay: cheapest(myCubes, i) })} aria-label={`استخدام تاجر ${fa(i + 1)}`}>
                <MerchantCard id={x.card} />
                {x.cubes.y + x.cubes.r + x.cubes.g + x.cubes.b > 0 && <span className="ct-on"><Cubes bag={x.cubes} size="sm" fid={`mk${x.card}`} from={view.last?.kind === 'acquire' ? `seat-${view.last.seat}` : undefined} /></span>}
                {i > 0 && <small className="ct-cost">{fa(i)} ادویه</small>}
              </button>
            ))}
          </section>
        </>
      )}

      <ul className="ct__players" aria-label="کاروان‌ها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.cubes.map((_, k) => k)).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['ct-pl', view.current === s && !view.outcome ? 'ct-pl--turn' : '', s === mySeat ? 'ct-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'ct-pl--win' : ''].join(' ')}>
            <div className="ct-pl__head">
              <bdi className="ct-pl__name">{who(s)}</bdi>
              <Bump className="ct-pl__score" v={view.scores[s]}>{fa(view.scores[s]!)} امتیاز</Bump>
            </div>
            <div className="ct-pl__board">
              <div className="ct-pl__card">
                <small className="ct-pl__cap">کاروان <Bump className="ct-caravan__n" v={view.cubes[s]!.y + view.cubes[s]!.r + view.cubes[s]!.g + view.cubes[s]!.b}>{fa(view.cubes[s]!.y + view.cubes[s]!.r + view.cubes[s]!.g + view.cubes[s]!.b)}/۱۰</Bump></small>
                <Caravan bag={view.cubes[s]!} fid={`cv${s}`} />
              </div>
              <div className="ct-pl__side">
                <span className="ct-pl__orders" title="سفارش‌های تحویل‌شده"><b>{fa(view.won[s]!.length)}</b> سفارش · {fa(view.won[s]!.reduce((a, id) => a + ORDERS[id]!.points, 0))} امتیاز</span>
                <span className="ct-pl__coins">
                  <Bump className="ct-coin ct-coin--gold" v={view.coins[s]!.gold}>{fa(view.coins[s]!.gold)}</Bump><small>طلا</small>
                  <Bump className="ct-coin ct-coin--silver" v={view.coins[s]!.silver}>{fa(view.coins[s]!.silver)}</Bump><small>نقره</small>
                </span>
                <span className="ct-pl__cards">{fa(view.hands[s]!.length)} در دست · {fa(view.played[s]!.length)} بازی‌شده</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {me >= 0 && !view.outcome && (
        <section className="ct__me" aria-label="دست شما">
          <div className="ct__hand" role="group" aria-label="کارت‌های دست">
            {view.hands[me]!.map((id) => (
              <button key={id} type="button" data-flip={`m${id}`} data-flip-from={`seat-${me}`} className={['ct-slot', plays.has(id) ? 'ct-slot--can' : '', pick === id ? 'ct-slot--on' : '', hint?.type === 'play' && hint.card === id ? 'ct-hint' : ''].join(' ')}
                disabled={!plays.has(id) || busy} onClick={() => tapHand(id)} aria-pressed={pick === id}><MerchantCard id={id} /></button>
            ))}
          </div>
          {pickM?.kind === 'trade' && (
            <div className="ct__tool">
              <span>چند بار؟</span>
              <button type="button" onClick={() => setTimes(Math.max(1, times - 1))} disabled={times <= 1}>−</button><b>{fa(times)}</b>
              <button type="button" onClick={() => setTimes(Math.min(maxTimes, times + 1))} disabled={times >= maxTimes}>+</button>
              <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'play', card: pick!, times })}>معاوضه</Button>
            </div>
          )}
          {pickM?.kind === 'upgrade' && (
            <div className="ct__tool">
              <span>ارتقا ({fa(ups.length)} از {fa(pickM.n)}):</span>
              {(['y', 'r', 'g'] as Spice[]).map((x) => (
                <button key={x} type="button" className="ct-cube--btn" title={SPICE_FA[x]} aria-label={`ارتقای ${SPICE_FA[x]}`}
                  disabled={ups.length >= pickM.n || !upgrade(myCubes!, [...ups, x])} onClick={() => setUps([...ups, x])}><img src={ART[x]} alt="" draggable={false} /></button>
              ))}
              {upPreview && <span className="ct__preview">← <Cubes bag={upPreview} size="sm" /></span>}
              <Button size="sm" variant="secondary" onClick={() => setUps([])} disabled={!ups.length}>از نو</Button>
              <Button size="sm" disabled={!ups.length || busy} onClick={() => onAction({ type: 'play', card: pick!, upgrades: ups })}>ارتقا</Button>
            </div>
          )}
          <div className="ct__actions">
            {canRest && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'rest' ? 'ct-hint' : ''} onClick={() => onAction({ type: 'rest' })}>استراحت ({fa(view.played[me]!.length)} کارت برمی‌گردد)</Button>}
            {disc && myCubes && <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'discard', cubes: cheapest(myCubes, disc.count) })}>کنار گذاشتن {fa(disc.count)} ادویهٔ ارزان</Button>}
          </div>
          {view.played[me]!.length > 0 && <div className="ct__played"><small>بازی‌شده:</small>{view.played[me]!.map((id) => <span key={id} data-flip={`m${id}`}><MerchantCard id={id} /></span>)}</div>}
        </section>
      )}
    </div>
  );
}
