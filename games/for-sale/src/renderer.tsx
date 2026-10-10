// بنگاه renderer: an estate agent's desk. Property cards climb from a cottage (۱) to a floating castle (۳۰); cheques are
// banknote-green slips. Players sit along the top with coins, bids and cards in hand; the market is in the middle and
// your hand (and bid stepper) at the bottom.
import './renderer.css';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import type { ForSaleView } from './rules.ts';
import cottage from './art/prop-cottage.webp';
import castle from './art/prop-castle.webp';

const fa = (n: number) => n.toLocaleString('fa-IR');
const TIER = ['کپر', 'کلبه', 'خانه', 'آپارتمان', 'برج', 'کاخ'];
// Painted art cut from a generated sheet (see DECISIONS.md): cottage for 1-15, castle for 16-30.
const tier = (v: number) => Math.min(5, Math.floor((v - 1) / 5));

export function Prop({ v, size = 'md', flip, flipFrom, flipExit }: { v: number; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; flipExit?: string }) {
  const clip = useId();
  return (
    <span className={['fs-card', 'fs-card--prop', `fs-card--${size}`].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={flipExit} aria-label={`ملک ${fa(v)} (${TIER[tier(v)]})`}>
      <svg viewBox="-45 -62 90 124" aria-hidden="true" direction="ltr">
        <clipPath id={clip}><rect x="-43" y="-60" width="86" height="120" rx="8" /></clipPath>
        <rect x="-43" y="-60" width="86" height="120" rx="8" className="fs-card__bg" />
        <image href={v > 15 ? castle : cottage} x="-43" y="-60" width="86" height="120" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        <rect x="-43" y="-60" width="86" height="120" rx="8" className="fs-card__shade" />
        <text x="-36" y="-34" className="fs-card__num">{fa(v)}</text>
        <text x="0" y="54" textAnchor="middle" className="fs-card__label">{TIER[tier(v)]}</text>
      </svg>
    </span>
  );
}

export function Cheque({ v, size = 'md', flip, flipFrom, flipExit }: { v: number; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; flipExit?: string }) {
  return (
    <span className={['fs-card', 'fs-card--cheque', `fs-card--${size}`, v === 0 ? 'fs-card--void' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={flipExit} aria-label={v ? `چک ${fa(v)} هزار` : 'چک صفر'}>
      <svg viewBox="-62 -36 124 72" aria-hidden="true" direction="ltr">
        <rect x="-60" y="-34" width="120" height="68" rx="6" className="fs-card__bg" />
        <rect x="-53" y="-27" width="106" height="54" rx="3" fill="none" className="fs-cheque__guil" />
        <circle cx="-34" cy="0" r="15" className="fs-cheque__seal" />
        <text x="-34" y="6" textAnchor="middle" className="fs-cheque__seal-t">{v ? '﷼' : '×'}</text>
        <text x="40" y="8" textAnchor="end" className="fs-cheque__amt">{v ? fa(v) : 'باطل'}</text>
        <text x="40" y="22" textAnchor="end" className="fs-cheque__unit">{v ? 'هزار' : ''}</text>
      </svg>
    </span>
  );
}

/** A number that bumps when it changes (never on first render). */
function Pop({ v, className = '' }: { v: number; className?: string }) {
  const pop = usePop(v);
  return <b key={v} className={`${className} ${pop}`}>{fa(v)}</b>;
}
const Coins = ({ n }: { n: number }) => <span className="fs-coins" aria-label={`${fa(n)} سکه`}><i aria-hidden="true" /><Pop v={n} /></span>;
const chequeId = (market: number[], i: number) => `q-${market[i]}-${market.slice(0, i).filter((x) => x === market[i]).length}`;

export default function ForSaleRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<ForSaleView>) {
  // Undo-window preview from what the client knows: a bid shows as yours, a pass takes the cheapest property and the
  // refund, a sale marks the chosen property. Nothing hidden is revealed.
  const q = queued as { type: string; amount?: number; card?: number } | null | undefined;
  const me = mySeat ?? -1;
  const view: ForSaleView = !q || me < 0 ? real
    : q.type === 'bid' && q.amount ? { ...real, bids: real.bids.map((b, k) => (k === me ? q.amount! : b)), high: q.amount }
      : q.type === 'pass' && real.market.length ? {
        ...real, market: real.market.slice(1), passed: real.passed.map((x, k) => x || k === me),
        owned: real.owned.map((o, k) => (k === me ? [...o, real.market[0]!].sort((a, b) => a - b) : o)), ownedCount: real.ownedCount.map((n, k) => (k === me ? n + 1 : n)),
        coins: real.coins.map((c, k) => (k === me ? c - (real.bids[me]! - Math.floor(real.bids[me]! / 2)) : c)), bids: real.bids.map((b, k) => (k === me ? 0 : b))
      }
        : q.type === 'sell' && q.card ? { ...real, chosen: real.chosen.map((c, k) => (k === me ? q.card! : c)) }
          : real;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${real.seq}|${q ? JSON.stringify(q) : ''}`);
  const bidHint = legalActions.find((a) => a.type === 'bid') as { min: number; max: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const sellable = new Set(legalActions.filter((a) => a.type === 'sell').map((a) => a.card as number));
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(() => { setAmount(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; amount?: number; card?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const bid = bidHint ? Math.min(bidHint.max, Math.max(bidHint.min, amount ?? hint?.amount ?? bidHint.min)) : 0;
  const order = mySeat === null ? view.coins.map((_, k) => k) : [...view.coins.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const buying = view.phase === 'buy';
  const myTurn = !q && (!!bidHint || canPass || sellable.size > 0);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: buying ? 'پیشنهاد بالاتر بدهید یا کنار بکشید' : 'یک ملک برای فروش انتخاب کنید' }
      : { tone: 'wait' as const, text: buying ? `نوبت ${view.current === null ? '' : who(view.current)}` : 'منتظر انتخاب بقیه' };
  const last = view.last;
  // What a seat just received with the latest change (a property taken or a cheque won), so it can fly to that seat.
  const marketBefore = useRef<{ seq: number; market: number[]; prev: number[] }>({ seq: real.seq, market: real.market, prev: real.market });
  if (marketBefore.current.seq !== real.seq) marketBefore.current = { seq: real.seq, market: real.market, prev: marketBefore.current.market };
  const got = (s: number): string[] => {
    if (!last) return [];
    if (last.kind === 'take') return last.seat === s ? [`p-${last.card}`] : [];
    const prev = marketBefore.current.prev, x = last.pairs.find((p) => p.seat === s);
    const i = x ? prev.indexOf(x.cheque) : -1;
    return i >= 0 ? [chequeId(prev, i)] : [];
  };
  const refund = me >= 0 ? view.bids[me]! - Math.floor(view.bids[me]! / 2) : 0;

  return (
    <div className="fs" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {!view.outcome && <ul className="fs__players" aria-label="بازیکنان">
        {order.map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['fs-pl', view.current === s && !view.outcome ? 'fs-pl--turn' : '', view.passed[s] && buying ? 'fs-pl--passed' : '', s === mySeat ? 'fs-pl--me' : ''].join(' ')}>
            <bdi className="fs-pl__name">{who(s)}</bdi>
            {s !== mySeat && got(s).map((id) => <i key={id} className="fs-pl__got" data-flip-anchor={`got-${id}`} aria-hidden="true" />)}
            <Coins n={view.coins[s]!} />
            <span className="fs-pl__meta">{buying ? `${fa(view.ownedCount[s]!)} ملک` : `${fa(view.wonCount[s]!)} چک`}</span>
            {buying && view.bids[s]! > 0 && !view.passed[s] && <Pop v={view.bids[s]!} className="fs-pl__bid" />}
            {buying && view.passed[s] && <span className="fs-pl__flag">کنار کشید</span>}
            {!buying && !view.outcome && <span className={`fs-pl__flag ${view.chosen[s] ? 'fs-pl__flag--ok' : ''}`}>{view.chosen[s] ? 'انتخاب کرد' : 'در فکر…'}</span>}
          </li>
        ))}
      </ul>}

      {!view.outcome && (
        <section className={`fs__market fs__market--${view.phase}`} aria-label={buying ? 'املاک روی میز' : 'چک‌های روی میز'}>
          <div className="fs__deck" data-flip-anchor="deck">{buying ? `مرحله خرید، ${fa(view.propsLeft)} ملک در دسته` : `مرحله فروش، ${fa(view.chequesLeft)} چک در دسته`}{buying && view.high > 0 && <>، بالاترین پیشنهاد <Pop v={view.high} /></>}</div>
          <div className="fs__row" data-flip-anchor="market">
            {view.market.map((v, i) => (buying ? <Prop key={v} v={v} flip={`p-${v}`} flipFrom="deck" flipExit={`got-p-${v}`} /> : <Cheque key={i} v={v} flip={chequeId(view.market, i)} flipFrom="deck" flipExit={`got-${chequeId(view.market, i)}`} />))}
          </div>
        </section>
      )}

      {last && !view.outcome && (
        <p className="fs__last" role="status" key={view.seq}>
          {last.kind === 'take'
            ? <><bdi>{who(last.seat)}</bdi> ملک <b>{fa(last.card)}</b> را برداشت{last.paid ? <> و {fa(last.paid)} سکه داد</> : ' (رایگان)'}</>
            : last.pairs.map((x) => <span key={x.seat} className="fs__pair"><bdi>{who(x.seat)}</bdi>: {fa(x.prop)} ← {x.cheque ? `${fa(x.cheque)} هزار` : 'صفر'}</span>)}
        </p>
      )}

      {view.outcome && (
        <ul className="fs__final" aria-label="حساب آخر">
          {view.outcome.placements.map(({ seat: s, place }) => (
            <li key={s} className={place === 1 ? 'fs__win' : ''}><b className="fs__place">{fa(place)}</b><bdi className="fs-pl__name">{who(s)}</bdi>
              <span className="fs__cheques">{(view.won?.[s] ?? []).slice().sort((a, b) => b - a).map((v, i) => <Cheque key={i} v={v} size="sm" />)}</span>
              <span className="fs__sum">{fa((view.won?.[s] ?? []).reduce((a, c) => a + c, 0))} + {fa(view.coins[s]!)} سکه = <b>{fa((view.won?.[s] ?? []).reduce((a, c) => a + c, view.coins[s]!))}</b></span></li>
          ))}
        </ul>
      )}

      {mySeat !== null && !view.outcome && (
        <section className="fs__me" aria-label="دست شما">
          {bidHint && (
            <div className="fs-bid" role="group" aria-label="پیشنهاد">
              <button type="button" className="fs-bid__step" disabled={bid <= bidHint.min} onClick={() => setAmount(bid - 1)} aria-label="کمتر">−</button>
              <output className="fs-bid__val bg-pop" key={bid}>{fa(bid)}</output>
              <button type="button" className="fs-bid__step" disabled={bid >= bidHint.max} onClick={() => setAmount(bid + 1)} aria-label="بیشتر">+</button>
              <Button size="sm" disabled={busy} className={hint?.type === 'bid' ? 'fs-hint' : ''} onClick={() => onAction({ type: 'bid', amount: bid })}>پیشنهاد {fa(bid)}</Button>
            </div>
          )}
          {canPass && (
            <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'pass' ? 'fs-hint' : ''} onClick={() => onAction({ type: 'pass' })}>
              کنار می‌کشم (ملک {fa(view.market[0]!)}{refund ? `، ${fa(refund)} سکه` : ''})
            </Button>
          )}
          <div className="fs__hand" role="group" aria-label="املاک شما">
            {view.owned[me]!.length === 0 && <span className="fs__empty">هنوز ملکی ندارید</span>}
            {view.owned[me]!.map((v) => sellable.has(v)
              ? <button key={v} type="button" className={['fs-sell', hint?.type === 'sell' && hint.card === v ? 'fs-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'sell', card: v })} aria-label={`فروش ملک ${fa(v)}`}><Prop v={v} size="sm" flip={`p-${v}`} flipFrom="market" flipExit="market" /></button>
              : <span key={v} className={view.chosen[me] === v ? 'fs-sell fs-sell--chosen' : 'fs-sell'}><Prop v={v} size="sm" flip={`p-${v}`} flipFrom="market" flipExit="market" /></span>)}
          </div>
          {view.won && view.won[me]!.length > 0 && (
            <div className="fs__mywon">{got(me).map((id) => <i key={id} className="fs-pl__got" data-flip-anchor={`got-${id}`} aria-hidden="true" />)}<span>چک‌های شما: {fa(view.won[me]!.reduce((a, c) => a + c, 0))} هزار</span>
              <span className="fs__cheques">{view.won[me]!.map((v, i) => { const occ = view.won![me]!.slice(0, i).filter((x) => x === v).length; return <Cheque key={i} v={v} size="sm" flip={`q-${v}-w${occ}`} />; })}</span></div>
          )}
        </section>
      )}
    </div>
  );
}
