// شهر تاس renderer: a toy-town board. Dice tumble in the middle; the supply row shows every establishment with its
// numbers, colour and price; each player's street lists their cards, coins and the four landmarks (lit when built).
// Building pictures are the printed Machi Koro card art (from github.com/Color-Kat/machicoro, see DECISIONS.md).
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, T, tx, type Term, useTermsLang, useFlip, useInFrame, usePop, type GameRendererProps, DockSlot } from '@bg/ui';
import { terms } from './terms.ts';
import { CARD_DEFS, DEF, LANDMARKS, type CardKey, type Landmark, type MachiView } from './rules.ts';

// Art: design/games/group-d/art/machi-koro (printed card faces already carry number, name and effect).
import wheatArt from './art/machi-koro-wheat.png';
import ranchArt from './art/machi-koro-ranch.png';
import bakeryArt from './art/machi-koro-bakery.png';
import cafeArt from './art/machi-koro-cafe.png';
import storeArt from './art/machi-koro-store.png';
import forestArt from './art/machi-koro-forest.png';
import stadiumArt from './art/machi-koro-stadium.png';
import tvArt from './art/machi-koro-tv.png';
import businessArt from './art/machi-koro-business.png';
import cheeseArt from './art/machi-koro-cheese.png';
import furnitureArt from './art/machi-koro-furniture.png';
import mineArt from './art/machi-koro-mine.png';
import restaurantArt from './art/machi-koro-restaurant.png';
import orchardArt from './art/machi-koro-orchard.png';
import marketArt from './art/machi-koro-market.png';
import stationOn from './art/machi-koro-station-built.png';
import stationOff from './art/machi-koro-station-unbuilt.png';
import mallOn from './art/machi-koro-mall-built.png';
import mallOff from './art/machi-koro-mall-unbuilt.png';
import parkOn from './art/machi-koro-park-built.png';
import parkOff from './art/machi-koro-park-unbuilt.png';
import radioOn from './art/machi-koro-radio-built.png';
import radioOff from './art/machi-koro-radio-unbuilt.png';
import coins from './art/machi-koro-coin.png';
import die2 from './art/machi-koro-die-2.png';
import die3 from './art/machi-koro-die-3.png';
import die4 from './art/machi-koro-die-4.png';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const ART: Record<CardKey, string> = { wheat: wheatArt, ranch: ranchArt, bakery: bakeryArt, cafe: cafeArt, store: storeArt, forest: forestArt, stadium: stadiumArt, tv: tvArt, business: businessArt, cheese: cheeseArt, furniture: furnitureArt, mine: mineArt, restaurant: restaurantArt, orchard: orchardArt, market: marketArt };
const LM_ART: Record<Landmark, [string, string]> = { station: [stationOff, stationOn], mall: [mallOff, mallOn], park: [parkOff, parkOn], radio: [radioOff, radioOn] };
// The art ships only dice 2 to 4; faces 1, 5, 6 stay the plain SVG placeholder until the art arrives (not drawn anew).
const DIE_ART: Record<number, string> = { 2: die2, 3: die3, 4: die4 };
const CARD_T: Record<CardKey, Term> = {
  wheat: terms.wheat, ranch: terms.ranch, bakery: terms.bakery, cafe: terms.cafe, store: terms.store, forest: terms.forest, stadium: terms.stadium, tv: terms.tv,
  business: terms.business, cheese: terms.cheese, furniture: terms.furniture, mine: terms.mine, restaurant: terms.restaurant, orchard: terms.orchard, market: terms.market
};
const LM_T: Record<Landmark, Term> = { station: terms.station, mall: terms.mall, park: terms.park, radio: terms.radio };
export const cardName = (k: CardKey) => tx(CARD_T[k]);
export const landmarkName = (k: Landmark) => tx(LM_T[k]);
const effectOf = (k: CardKey): string => ({
  wheat: '+۱', ranch: '+۱', bakery: '+۱', cafe: '۱ از تاس‌انداز', store: '+۳', forest: '+۱', stadium: '۲ از هر نفر', tv: '۵ از یک نفر', business: 'جابه‌جایی کارت',
  cheese: `+۳ هر ${tx(terms.ranch)}`, furniture: `+۳ هر ${tx(terms.forest)}/${tx(terms.mine)}`, mine: '+۵', restaurant: '۲ از تاس‌انداز', orchard: '+۳', market: `+۲ هر ${tx(terms.wheat)}/باغ`
} as Record<CardKey, string>)[k];

const Die = ({ v, i, tumble }: { v: number; i: number; tumble?: boolean }) => {
  const pips: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  if (!tumble && DIE_ART[v]) return <img src={DIE_ART[v]} className="mk-die bg-roll" style={{ ['--i' as string]: i }} alt={`تاس ${fa(v)}`} draggable={false} />;
  return <svg viewBox="-12 -12 24 24" className={`mk-die ${tumble ? 'bg-tumble' : 'bg-roll'}`} style={{ ['--i' as string]: i }} aria-label={tumble ? 'در حال ریختن' : `تاس ${fa(v)}`}><rect x="-11" y="-11" width="22" height="22" rx="4" />{pips[v]!.map(([x, y], i) => <circle key={i} cx={x * 6} cy={y * 6} r="2.2" />)}</svg>;
};

export function TownCard({ k, count, flip }: { k: CardKey; count?: number; flip?: { id: string; from?: string; exit?: string } }) {
  useTermsLang();
  const d = DEF[k];
  const pop = usePop(count);
  return (
    <span className={`mk-card mk-col--${d.color}`} title={cardName(k)} {...(flip ? { 'data-flip': flip.id, ...(flip.from ? { 'data-flip-from': flip.from } : {}), ...(flip.exit ? { 'data-flip-exit': flip.exit } : {}) } : {})}>
      <img className="mk-card__art" src={ART[k]} alt={`${cardName(k)}، عدد ${d.rolls.map(fa).join(' یا ')}، ${effectOf(k)}`} draggable={false} />
      {count !== undefined && <i className={`mk-card__count ${pop}`} key={count}>×{fa(count)}</i>}
    </span>
  );
}

function Coins({ n }: { n: number }) {
  const pop = usePop(n);
  return <span className={`mk-pl__coins ${pop}`} key={n}><img src={coins} alt="" draggable={false} />{fa(n)} سکه</span>;
}

type Queued = { type: string; dice?: number; card?: CardKey; landmark?: Landmark; target?: number };

/** My queued build / landmark / TV applied to the view (known costs and effects only; dice stay with the server). */
function preview(v: MachiView, q: Queued | null | undefined, me: number): MachiView {
  if (!q || me < 0) return v;
  const coins = v.coins.slice();
  const card = q.card, lm = q.landmark;
  if (q.type === 'build' && card) {
    coins[me]! -= DEF[card].cost;
    return { ...v, coins, supply: { ...v.supply, [card]: v.supply[card] - 1 }, cards: v.cards.map((c, s) => (s === me ? { ...c, [card]: c[card] + 1 } : c)) };
  }
  if (q.type === 'build' && lm) {
    coins[me]! -= LANDMARKS.find((l) => l.key === lm)!.cost;
    return { ...v, coins, landmarks: v.landmarks.map((l, s) => (s === me ? { ...l, [lm]: true } : l)) };
  }
  if (q.type === 'tv' && q.target !== undefined) {
    const n = Math.min(5, coins[q.target]!);
    coins[q.target]! -= n; coins[me]! += n;
    return { ...v, coins };
  }
  return v;
}

export default function MachiRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<MachiView>) {
  useTermsLang();
  const me = mySeat ?? -1;
  const q = queued as Queued | null | undefined;
  const view = preview(served, q, me);
  // My roll in the undo window or waiting for the server: the dice tumble with no pips until the result arrives.
  const sent = useRef<Queued | null>(null);
  if (q) sent.current = q;
  else if (!busy) sent.current = null;
  const pend = q ?? (busy ? sent.current : null);
  const rolling = pend?.type === 'roll' ? pend.dice ?? 1 : 0;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q ? JSON.stringify(q) : ''}|${rolling}`);
  const rollAt = useRef(0); // seq of the latest roll: retriggers the dice tumble only for real rolls
  if (view.last?.kind === 'roll') rollAt.current = view.seq;
  const seq0 = useRef(view.seq);
  const rolls = legalActions.filter((a) => a.type === 'roll').map((a) => a.dice as number);
  const canKeep = legalActions.some((a) => a.type === 'keep');
  const builds = new Set(legalActions.filter((a) => a.type === 'build' && a.card).map((a) => a.card as CardKey));
  const lms = new Set(legalActions.filter((a) => a.type === 'build' && a.landmark).map((a) => a.landmark as Landmark));
  const canPass = legalActions.some((a) => a.type === 'pass');
  const [give, setGive] = useState<CardKey | ''>('');
  const [target, setTarget] = useState<number>(-1);
  const [take, setTake] = useState<CardKey | ''>('');
  useEffect(() => { setGive(''); setTarget(-1); setTake(''); }, [view.seq]);
  const hint = expected as unknown as { type: string; dice?: number; landmark?: Landmark; card?: CardKey } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = view.current === me && !view.outcome;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? {
      tone: 'mine' as const,
      text: view.phase === 'roll' ? 'تاس بریزید' : view.phase === 'reroll' ? 'دوباره می‌ریزید یا همین را نگه می‌دارید؟' : view.phase === 'tv' ? 'از چه کسی ۵ سکه می‌گیرید؟' : view.phase === 'swap' ? 'یک کارت را عوض می‌کنید؟' : `یک مغازه یا ${tx(terms.landmark)} بسازید`
    }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const others = view.coins.map((_, k) => k).filter((k) => k !== me);
  // A built card flies in from its supply slot (also my queued build); undoing a first copy flies it back there.
  const flipOf = (s: number, k: CardKey) => {
    const queuedHere = s === me && q?.type === 'build' && q.card === k;
    const fresh = (view.last?.kind === 'build' && view.last.seat === s && view.last.card === k) || queuedHere;
    return { id: `card-${s}-${k}`, ...(fresh ? { from: `buy-${k}` } : {}), ...(queuedHere && !served.cards[s]![k] ? { exit: `buy-${k}` } : {}) };
  };
  const swapOk = give && take && target >= 0;
  const framed = useInFrame() !== null; // the shell draws turn text, coins and the seat strip; the hint goes to the rail card

  const city = (s: number) => (
          <li key={s} className={['mk-pl', view.current === s && !view.outcome ? 'mk-pl--turn' : '', s === me ? 'mk-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'mk-pl--win' : ''].join(' ')}>
            <div className="mk-pl__head"><bdi className="mk-pl__name">{s === me ? 'شهر شما' : who(s)}</bdi><Coins n={view.coins[s]!} /></div>
            <div className="mk-pl__lms">{LANDMARKS.map((l) => <span key={`${l.key}-${view.landmarks[s]![l.key]}`} className={`mk-lm ${view.landmarks[s]![l.key] ? `mk-lm--on${view.seq !== seq0.current ? ' bg-land' : ''}` : ''}`} title={landmarkName(l.key)}><img src={LM_ART[l.key][view.landmarks[s]![l.key] ? 1 : 0]} alt={`${landmarkName(l.key)}${view.landmarks[s]![l.key] ? '، ساخته شده' : ''}`} draggable={false} /></span>)}</div>
            <div className="mk-pl__cards">{CARD_DEFS.filter((d) => view.cards[s]![d.key]).map((d) => <TownCard key={d.key} k={d.key} count={view.cards[s]![d.key]} flip={flipOf(s, d.key)} />)}</div>
          </li>
  );
  // Desktop frame (reference): rivals' cities stand in a column beside the market; yours stays below it.
  const side = framed && !view.outcome && others.length > 0 && typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

  return (
    <div className={framed ? 'mk mk--framed' : 'mk'} data-seq={view.seq} data-phase={view.phase} ref={root}>
      {framed && <RailSlot>{status && <p><b>{status.text}</b></p>}<p>تاس بریزید، درآمد کارت‌ها پرداخت می‌شود، بعد یک کارت یا <T t={terms.landmark} /> بسازید. اولین نفری که هر چهار بنا را بسازد می‌برد.</p></RailSlot>}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="mk__dice" aria-label="تاس‌ها">
        {rolling
          ? <span className="mk__diceRow" key="tumble">{Array.from({ length: rolling }, (_, i) => <Die key={i} v={1} i={i} tumble />)}</span>
          : <span className="mk__diceRow" key={rollAt.current}>{view.dice.length ? view.dice.map((v, i) => <Die key={i} v={v} i={i} />) : null}</span>}
        {view.dice.length > 0 && !rolling && <b className="mk__sum">{fa(view.dice.reduce((a, b) => a + b, 0))}</b>}
        {view.dice.length > 0 && !rolling && <span className="mk__income">{view.income.map((g, k) => (g ? <span key={k} className={g > 0 ? 'up' : 'down'}><bdi>{who(k)}</bdi> {g > 0 ? '+' : '−'}{fa(Math.abs(g))}</span> : null))}</span>}
      </section>

      {myTurn && (rolls.length > 0 || canKeep) && (
        <div className="mk__bar">
          {rolls.map((n) => <DockSlot key={n}><Button size="sm" disabled={busy} className={hint?.type === 'roll' && hint.dice === n ? 'mk-hint' : ''} onClick={() => onAction({ type: 'roll', dice: n })}>{view.phase === 'reroll' ? 'دوباره' : 'ریختن'} {fa(n)} تاس</Button></DockSlot>)}
          {canKeep && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'keep' })}>همین را نگه دار</Button></DockSlot>}
        </div>
      )}
      {myTurn && view.phase === 'tv' && (
        <div className="mk__bar">{others.map((k) => <DockSlot key={k}><Button size="sm" disabled={busy} onClick={() => onAction({ type: 'tv', target: k })}>از <bdi>{who(k)}</bdi> ({fa(view.coins[k]!)} سکه)</Button></DockSlot>)}</div>
      )}
      {myTurn && view.phase === 'swap' && (
        <div className="mk__bar mk__swap">
          <select value={give} onChange={(e) => setGive(e.target.value as CardKey)} aria-label="کارتی که می‌دهید"><option value="">کارت شما…</option>{CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[me]![d.key]).map((d) => <option key={d.key} value={d.key}>{cardName(d.key)}</option>)}</select>
          <select value={target} onChange={(e) => { setTarget(Number(e.target.value)); setTake(''); }} aria-label="بازیکن"><option value={-1}>با…</option>{others.map((k) => <option key={k} value={k}>{who(k)}</option>)}</select>
          <select value={take} onChange={(e) => setTake(e.target.value as CardKey)} aria-label="کارتی که می‌گیرید" disabled={target < 0}><option value="">کارت او…</option>{target >= 0 && CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[target]![d.key]).map((d) => <option key={d.key} value={d.key}>{cardName(d.key)}</option>)}</select>
          <DockSlot><Button size="sm" disabled={!swapOk || busy} onClick={() => onAction({ type: 'swap', give: give as CardKey, target, take: take as CardKey })}>عوض کن</Button></DockSlot>
          <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'noSwap' })}>نه</Button></DockSlot>
        </div>
      )}

      <div className="mk__top">
      {!view.outcome && (
        <section className="mk__supply" aria-label="بازار ساخت">
          {CARD_DEFS.map((d) => (
            <button key={d.key} type="button" data-flip-anchor={`buy-${d.key}`} className={['mk-buy', hint?.card === d.key ? 'mk-hint' : ''].join(' ')} disabled={!builds.has(d.key) || busy}
              onClick={() => onAction({ type: 'build', card: d.key })} aria-label={`ساختن ${cardName(d.key)} به قیمت ${fa(d.cost)}، ${fa(view.supply[d.key])} مانده`}>
              <TownCard k={d.key} />
              {/* Reference: the pile count is a corner badge on the card (the cost is printed on the art). */}
              <i className="mk-buy__left" aria-hidden="true">{fa(view.supply[d.key])}</i>
              {!framed && <span className="mk-buy__cost"><img src={coins} alt="" draggable={false} />{fa(d.cost)}</span>}
            </button>
          ))}
        </section>
      )}
      {side && <ul className="mk__players mk__players--side" aria-label="شهر حریف‌ها">{others.map(city)}</ul>}
      </div>
      {myTurn && view.phase === 'build' && (
        <div className="mk__bar">
          {LANDMARKS.filter((l) => !view.landmarks[me]![l.key]).map((l) => (
            <DockSlot key={l.key}><Button size="sm" disabled={!lms.has(l.key) || busy} className={hint?.landmark === l.key ? 'mk-hint' : ''} onClick={() => onAction({ type: 'build', landmark: l.key })}>{landmarkName(l.key)} ({fa(l.cost)})</Button></DockSlot>
          ))}
          {canPass && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>چیزی نمی‌سازم</Button></DockSlot>}
        </div>
      )}

      <ul className="mk__players" aria-label="شهرها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : side ? (me >= 0 ? [me] : []) : [...others, ...(me >= 0 ? [me] : [])]).map(city)}
      </ul>
    </div>
  );
}
