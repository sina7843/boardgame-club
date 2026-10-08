// بنگاه renderer: an estate agent's desk. Property cards climb from a reed hut (۱) to a domed palace (۳۰); cheques are
// banknote-green slips. Players sit along the top with coins, bids and cards in hand; the market is in the middle and
// your hand (and bid stepper) at the bottom.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import type { ForSaleView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const TIER = ['کپر', 'کلبه', 'خانه', 'آپارتمان', 'برج', 'کاخ'];
const tier = (v: number) => Math.min(5, Math.floor((v - 1) / 5));

function Building({ v }: { v: number }) {
  const t = tier(v);
  return (
    <g className={`fs-bld fs-bld--${t}`}>
      <rect x="-40" y="30" width="80" height="4" rx="2" className="fs-bld__ground" />
      {t === 0 && <path d="M-22 30 L0 2 L22 30 Z M-4 30 V20 H4 V30 Z" />}
      {t === 1 && <><path d="M-22 30 V10 H22 V30 Z" /><path d="M-27 11 L0 -10 L27 11 Z" className="fs-bld__roof" /><rect x="-4" y="18" width="8" height="12" className="fs-bld__win" /></>}
      {t === 2 && <><path d="M-28 30 V4 H28 V30 Z" /><path d="M-33 5 L0 -18 L33 5 Z" className="fs-bld__roof" /><rect x="-20" y="10" width="9" height="8" className="fs-bld__win" /><rect x="11" y="10" width="9" height="8" className="fs-bld__win" /><rect x="-5" y="17" width="10" height="13" className="fs-bld__win" /></>}
      {t === 3 && <><path d="M-24 30 V-22 H24 V30 Z" />{[-14, 0, 14].flatMap((x) => [-14, -2, 10].map((y) => <rect key={`${x}${y}`} x={x - 4} y={y} width="8" height="7" className="fs-bld__win" />))}</>}
      {t === 4 && <><path d="M-30 30 V-6 H-12 V30 Z M-10 30 V-34 H12 V30 Z M14 30 V-16 H30 V30 Z" />{[-26, -2, 0, 18].map((y, i) => <rect key={i} x="-5" y={y} width="10" height="6" className="fs-bld__win" />)}<rect x="-25" y="2" width="8" height="5" className="fs-bld__win" /><rect x="18" y="-8" width="8" height="5" className="fs-bld__win" /></>}
      {t === 5 && <><path d="M-34 30 V0 H34 V30 Z" /><path d="M-16 0 Q-16 -30 0 -32 Q16 -30 16 0 Z" className="fs-bld__dome" /><path d="M0 -32 V-40" stroke="currentColor" strokeWidth="2" /><path d="M-30 0 V-14 H-24 V0 Z M24 0 V-14 H30 V0 Z" className="fs-bld__roof" /><path d="M-7 30 V16 Q0 8 7 16 V30 Z" className="fs-bld__win" /><path d="M-26 22 V14 Q-22 9 -18 14 V22 Z M18 22 V14 Q22 9 26 14 V22 Z" className="fs-bld__win" /></>}
    </g>
  );
}

export function Prop({ v, size = 'md', fresh }: { v: number; size?: 'sm' | 'md'; fresh?: boolean }) {
  return (
    <span className={['fs-card', 'fs-card--prop', `fs-card--${size}`, `fs-tier-${tier(v)}`, fresh ? 'fs-card--fresh' : ''].join(' ')} aria-label={`ملک ${fa(v)} (${TIER[tier(v)]})`}>
      <svg viewBox="-45 -62 90 124" aria-hidden="true" direction="ltr">
        <rect x="-43" y="-60" width="86" height="120" rx="8" className="fs-card__bg" />
        <text x="-36" y="-42" className="fs-card__num">{fa(v)}</text>
        <g transform="translate(0 6)"><Building v={v} /></g>
        <text x="0" y="54" textAnchor="middle" className="fs-card__label">{TIER[tier(v)]}</text>
      </svg>
    </span>
  );
}

export function Cheque({ v, size = 'md', fresh }: { v: number; size?: 'sm' | 'md'; fresh?: boolean }) {
  return (
    <span className={['fs-card', 'fs-card--cheque', `fs-card--${size}`, v === 0 ? 'fs-card--void' : '', fresh ? 'fs-card--fresh' : ''].join(' ')} aria-label={v ? `چک ${fa(v)} هزار` : 'چک صفر'}>
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

const Coins = ({ n }: { n: number }) => <span className="fs-coins" aria-label={`${fa(n)} سکه`}><i aria-hidden="true" /><b key={n}>{fa(n)}</b></span>;

export default function ForSaleRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<ForSaleView>) {
  const bidHint = legalActions.find((a) => a.type === 'bid') as { min: number; max: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const sellable = new Set(legalActions.filter((a) => a.type === 'sell').map((a) => a.card as number));
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(() => { setAmount(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; amount?: number; card?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const me = mySeat ?? -1;
  const bid = bidHint ? Math.min(bidHint.max, Math.max(bidHint.min, amount ?? hint?.amount ?? bidHint.min)) : 0;
  const order = mySeat === null ? view.coins.map((_, k) => k) : [...view.coins.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const buying = view.phase === 'buy';
  const myTurn = !!bidHint || canPass || sellable.size > 0;
  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: buying ? 'پیشنهاد بالاتر بدهید یا کنار بکشید' : 'یک ملک برای فروش انتخاب کنید' }
      : { tone: 'wait' as const, text: buying ? `نوبت ${view.current === null ? '' : who(view.current)}` : 'منتظر انتخاب بقیه' };
  const last = view.last;
  const refund = me >= 0 ? view.bids[me]! - Math.floor(view.bids[me]! / 2) : 0;

  return (
    <div className="fs" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {!view.outcome && <ul className="fs__players" aria-label="بازیکنان">
        {order.map((s) => (
          <li key={s} className={['fs-pl', view.current === s && !view.outcome ? 'fs-pl--turn' : '', view.passed[s] && buying ? 'fs-pl--passed' : '', s === mySeat ? 'fs-pl--me' : ''].join(' ')}>
            <bdi className="fs-pl__name">{who(s)}</bdi>
            <Coins n={view.coins[s]!} />
            <span className="fs-pl__meta">{buying ? `${fa(view.ownedCount[s]!)} ملک` : `${fa(view.wonCount[s]!)} چک`}</span>
            {buying && view.bids[s]! > 0 && !view.passed[s] && <span className="fs-pl__bid" key={view.bids[s]}>{fa(view.bids[s]!)}</span>}
            {buying && view.passed[s] && <span className="fs-pl__flag">کنار کشید</span>}
            {!buying && !view.outcome && <span className={`fs-pl__flag ${view.chosen[s] ? 'fs-pl__flag--ok' : ''}`}>{view.chosen[s] ? 'انتخاب کرد' : 'در فکر…'}</span>}
          </li>
        ))}
      </ul>}

      {!view.outcome && (
        <section className={`fs__market fs__market--${view.phase}`} aria-label={buying ? 'املاک روی میز' : 'چک‌های روی میز'}>
          <div className="fs__deck">{buying ? `مرحله خرید · ${fa(view.propsLeft)} ملک در دسته` : `مرحله فروش · ${fa(view.chequesLeft)} چک در دسته`}{buying && view.high > 0 && <> · بالاترین پیشنهاد <b>{fa(view.high)}</b></>}</div>
          <div className="fs__row">
            {view.market.map((v, i) => (buying ? <Prop key={`${view.seq}-${v}`} v={v} fresh /> : <Cheque key={`${view.seq}-${i}`} v={v} fresh />))}
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
              <output className="fs-bid__val" key={bid}>{fa(bid)}</output>
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
              ? <button key={v} type="button" className={['fs-sell', hint?.type === 'sell' && hint.card === v ? 'fs-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'sell', card: v })} aria-label={`فروش ملک ${fa(v)}`}><Prop v={v} size="sm" /></button>
              : <span key={v} className={view.chosen[me] === v ? 'fs-sell fs-sell--chosen' : 'fs-sell'}><Prop v={v} size="sm" /></span>)}
          </div>
          {view.won && view.won[me]!.length > 0 && (
            <div className="fs__mywon"><span>چک‌های شما: {fa(view.won[me]!.reduce((a, c) => a + c, 0))} هزار</span>
              <span className="fs__cheques">{view.won[me]!.map((v, i) => <Cheque key={i} v={v} size="sm" />)}</span></div>
          )}
        </section>
      )}
    </div>
  );
}
