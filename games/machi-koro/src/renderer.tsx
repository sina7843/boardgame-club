// شهر تاس renderer: a toy-town board. Dice tumble in the middle; the supply row shows every establishment with its
// numbers, colour and price; each player's street lists their cards, coins and the four landmarks (lit when built).
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import { CARD_DEFS, DEF, LANDMARKS, type CardKey, type Landmark, type MachiView } from './rules.ts';

// Art is cut from a generated sprite sheet (see DECISIONS.md).
import wheatArt from './art/wheat.webp';
import ranchArt from './art/ranch.webp';
import bakeryArt from './art/bakery.webp';
import cafeArt from './art/cafe.webp';
import storeArt from './art/store.webp';
import forestArt from './art/forest.webp';
import stadiumArt from './art/stadium.webp';
import tvArt from './art/tv.webp';
import businessArt from './art/business.webp';
import cheeseArt from './art/cheese.webp';
import furnitureArt from './art/furniture.webp';
import mineArt from './art/mine.webp';
import restaurantArt from './art/restaurant.webp';
import orchardArt from './art/orchard.webp';
import marketArt from './art/market.webp';
import lmstationArt from './art/lm-station.webp';
import lmmallArt from './art/lm-mall.webp';
import lmparkArt from './art/lm-park.webp';
import lmradioArt from './art/lm-radio.webp';
import coins from './art/coins.webp';

const fa = (n: number) => n.toLocaleString('fa-IR');
const ART: Record<CardKey, string> = { wheat: wheatArt, ranch: ranchArt, bakery: bakeryArt, cafe: cafeArt, store: storeArt, forest: forestArt, stadium: stadiumArt, tv: tvArt, business: businessArt, cheese: cheeseArt, furniture: furnitureArt, mine: mineArt, restaurant: restaurantArt, orchard: orchardArt, market: marketArt };
const LM_ART: Record<Landmark, string> = { station: lmstationArt, mall: lmmallArt, park: lmparkArt, radio: lmradioArt };
export const CARD_FA: Record<CardKey, string> = {
  wheat: 'گندم‌زار', ranch: 'دامداری', bakery: 'نانوایی', cafe: 'قهوه‌خانه', store: 'بقالی', forest: 'جنگل', stadium: 'ورزشگاه', tv: 'ایستگاه تلویزیون',
  business: 'مرکز تجاری', cheese: 'پنیرسازی', furniture: 'مبل‌سازی', mine: 'معدن', restaurant: 'رستوران', orchard: 'باغ میوه', market: 'بازار میوه'
};
export const LANDMARK_FA: Record<Landmark, string> = { station: 'ایستگاه قطار', mall: 'مرکز خرید', park: 'شهربازی', radio: 'برج رادیو' };
const EFFECT: Record<CardKey, string> = {
  wheat: '+۱', ranch: '+۱', bakery: '+۱', cafe: '۱ از تاس‌انداز', store: '+۳', forest: '+۱', stadium: '۲ از هر نفر', tv: '۵ از یک نفر', business: 'جابه‌جایی کارت',
  cheese: '+۳ هر دامداری', furniture: '+۳ هر جنگل/معدن', mine: '+۵', restaurant: '۲ از تاس‌انداز', orchard: '+۳', market: '+۲ هر گندم/باغ'
};

const Die = ({ v, i, tumble }: { v: number; i: number; tumble?: boolean }) => {
  const pips: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  return <svg viewBox="-12 -12 24 24" className={`mk-die ${tumble ? 'bg-tumble' : 'bg-roll'}`} style={{ ['--i' as string]: i }} aria-label={tumble ? 'در حال ریختن' : `تاس ${fa(v)}`}><rect x="-11" y="-11" width="22" height="22" rx="4" />{pips[v]!.map(([x, y], i) => <circle key={i} cx={x * 6} cy={y * 6} r="2.2" />)}</svg>;
};

export function TownCard({ k, count, flip }: { k: CardKey; count?: number; flip?: { id: string; from?: string; exit?: string } }) {
  const d = DEF[k];
  const pop = usePop(count);
  return (
    <span className={`mk-card mk-col--${d.color}`} {...(flip ? { 'data-flip': flip.id, ...(flip.from ? { 'data-flip-from': flip.from } : {}), ...(flip.exit ? { 'data-flip-exit': flip.exit } : {}) } : {})}>
      <b className="mk-card__rolls">{d.rolls.map(fa).join('–')}</b>
      <img className="mk-card__art" src={ART[k]} alt="" draggable={false} />
      <span className="mk-card__name">{CARD_FA[k]}</span>
      <small>{EFFECT[k]}</small>
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
      text: view.phase === 'roll' ? 'تاس بریزید' : view.phase === 'reroll' ? 'دوباره می‌ریزید یا همین را نگه می‌دارید؟' : view.phase === 'tv' ? 'از چه کسی ۵ سکه می‌گیرید؟' : view.phase === 'swap' ? 'یک کارت را عوض می‌کنید؟' : 'یک مغازه یا بنای بزرگ بسازید'
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

  return (
    <div className="mk" data-seq={view.seq} data-phase={view.phase} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="mk__dice" aria-label="تاس‌ها">
        {rolling
          ? <span className="mk__diceRow" key="tumble">{Array.from({ length: rolling }, (_, i) => <Die key={i} v={1} i={i} tumble />)}</span>
          : <span className="mk__diceRow" key={rollAt.current}>{view.dice.length ? view.dice.map((v, i) => <Die key={i} v={v} i={i} />) : <span className="mk__noDice">—</span>}</span>}
        {view.dice.length > 0 && !rolling && <b className="mk__sum">{fa(view.dice.reduce((a, b) => a + b, 0))}</b>}
        {view.dice.length > 0 && !rolling && <span className="mk__income">{view.income.map((g, k) => (g ? <span key={k} className={g > 0 ? 'up' : 'down'}><bdi>{who(k)}</bdi> {g > 0 ? '+' : '−'}{fa(Math.abs(g))}</span> : null))}</span>}
      </section>

      {myTurn && (rolls.length > 0 || canKeep) && (
        <div className="mk__bar">
          {rolls.map((n) => <Button key={n} size="sm" disabled={busy} className={hint?.type === 'roll' && hint.dice === n ? 'mk-hint' : ''} onClick={() => onAction({ type: 'roll', dice: n })}>{view.phase === 'reroll' ? 'دوباره' : 'ریختن'} {fa(n)} تاس</Button>)}
          {canKeep && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'keep' })}>همین را نگه دار</Button>}
        </div>
      )}
      {myTurn && view.phase === 'tv' && (
        <div className="mk__bar">{others.map((k) => <Button key={k} size="sm" disabled={busy} onClick={() => onAction({ type: 'tv', target: k })}>از <bdi>{who(k)}</bdi> ({fa(view.coins[k]!)} سکه)</Button>)}</div>
      )}
      {myTurn && view.phase === 'swap' && (
        <div className="mk__bar mk__swap">
          <select value={give} onChange={(e) => setGive(e.target.value as CardKey)} aria-label="کارتی که می‌دهید"><option value="">کارت شما…</option>{CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[me]![d.key]).map((d) => <option key={d.key} value={d.key}>{CARD_FA[d.key]}</option>)}</select>
          <select value={target} onChange={(e) => { setTarget(Number(e.target.value)); setTake(''); }} aria-label="بازیکن"><option value={-1}>با…</option>{others.map((k) => <option key={k} value={k}>{who(k)}</option>)}</select>
          <select value={take} onChange={(e) => setTake(e.target.value as CardKey)} aria-label="کارتی که می‌گیرید" disabled={target < 0}><option value="">کارت او…</option>{target >= 0 && CARD_DEFS.filter((d) => d.color !== 'purple' && view.cards[target]![d.key]).map((d) => <option key={d.key} value={d.key}>{CARD_FA[d.key]}</option>)}</select>
          <Button size="sm" disabled={!swapOk || busy} onClick={() => onAction({ type: 'swap', give: give as CardKey, target, take: take as CardKey })}>عوض کن</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'noSwap' })}>نه</Button>
        </div>
      )}

      {!view.outcome && (
        <section className="mk__supply" aria-label="بازار ساخت">
          {CARD_DEFS.map((d) => (
            <button key={d.key} type="button" data-flip-anchor={`buy-${d.key}`} className={['mk-buy', hint?.card === d.key ? 'mk-hint' : ''].join(' ')} disabled={!builds.has(d.key) || busy}
              onClick={() => onAction({ type: 'build', card: d.key })} aria-label={`ساختن ${CARD_FA[d.key]} به قیمت ${fa(d.cost)}`}>
              <TownCard k={d.key} /><span className="mk-buy__cost"><img src={coins} alt="" draggable={false} />{fa(d.cost)} سکه، {fa(view.supply[d.key])} مانده</span>
            </button>
          ))}
        </section>
      )}
      {myTurn && view.phase === 'build' && (
        <div className="mk__bar">
          {LANDMARKS.filter((l) => !view.landmarks[me]![l.key]).map((l) => (
            <Button key={l.key} size="sm" disabled={!lms.has(l.key) || busy} className={hint?.landmark === l.key ? 'mk-hint' : ''} onClick={() => onAction({ type: 'build', landmark: l.key })}>{LANDMARK_FA[l.key]} ({fa(l.cost)})</Button>
          ))}
          {canPass && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>چیزی نمی‌سازم</Button>}
        </div>
      )}

      <ul className="mk__players" aria-label="شهرها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.coins.map((_, k) => k)).map((s) => (
          <li key={s} className={['mk-pl', view.current === s && !view.outcome ? 'mk-pl--turn' : '', s === me ? 'mk-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'mk-pl--win' : ''].join(' ')}>
            <div className="mk-pl__head"><bdi className="mk-pl__name">{who(s)}</bdi><Coins n={view.coins[s]!} /></div>
            <div className="mk-pl__lms">{LANDMARKS.map((l) => <span key={`${l.key}-${view.landmarks[s]![l.key]}`} className={`mk-lm ${view.landmarks[s]![l.key] ? `mk-lm--on${view.seq !== seq0.current ? ' bg-land' : ''}` : ''}`} title={LANDMARK_FA[l.key]}><img src={LM_ART[l.key]} alt="" draggable={false} />{LANDMARK_FA[l.key]}</span>)}</div>
            <div className="mk-pl__cards">{CARD_DEFS.filter((d) => view.cards[s]![d.key]).map((d) => <TownCard key={d.key} k={d.key} count={view.cards[s]![d.key]} flip={flipOf(s, d.key)} />)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
