// اشرافی renderer: an art-deco salon. The card up for auction sits on a velvet easel with the four red-frame lamps
// beside it; rivals show their open bids as banknote chips and their collection; your banknotes are a fan to tap
// into a bid.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import luxuryArt from './art/luxury.webp';
import prestigeArt from './art/prestige.webp';
import disgraceArt from './art/disgrace.webp';
import { isDisgrace, isRed, lux, status, type HighSocietyView, type StatusCard } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const LUX = ['', 'گلاب‌پاش', 'کلاه', 'دستکش', 'عطر', 'شامپاین', 'تابلو', 'پیانو', 'اسب', 'قایق', 'کاخ ییلاقی'];
const SPECIAL: Record<string, { big: string; name: string }> = {
  prestige: { big: '×۲', name: 'افتخار' }, passe: { big: '−۵', name: 'از مد افتاده' }, scandal: { big: '½', name: 'رسوایی' }, faux: { big: '✕', name: 'گاف' }
};
// Painted art cut from a generated sheet (see DECISIONS.md), chosen by card type.
const ART = { lux: luxuryArt, good: prestigeArt, bad: disgraceArt };
const fmtStatus = (v: number) => (Number.isInteger(v) ? fa(v) : v.toLocaleString('fa-IR', { maximumFractionDigits: 2 }));

export function Card({ c, size = 'md', flip, flipFrom }: { c: StatusCard; size?: 'sm' | 'md'; flip?: string; flipFrom?: string }) {
  const v = lux(c);
  const sp = SPECIAL[c];
  const kind = v ? 'lux' : isDisgrace(c) ? 'bad' : 'good';
  return (
    <span className={['hs-card', `hs-card--${size}`, `hs-card--${kind}`, isRed(c) ? 'hs-card--red' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom}
      aria-label={v ? `${LUX[v]} (${fa(v)})` : sp!.name}>
      <img className="hs-card__art" src={ART[kind]} alt="" draggable={false} />
      <span className="hs-card__big">{v ? fa(v) : sp!.big}</span>
      <span className="hs-card__name">{v ? LUX[v] : sp!.name}</span>
    </span>
  );
}

const Note = ({ v, size = 'md', flip, flipFrom }: { v: number; size?: 'sm' | 'md'; flip?: string; flipFrom?: string }) => <span className={`hs-note hs-note--${size}`} data-v={v} data-flip={flip} data-flip-from={flipFrom}><b>{fa(v)}</b></span>;

export default function HighSocietyRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<HighSocietyView>) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const bidHint = legalActions.find((a) => a.type === 'bid') as { need: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { setSel([]); }, [view.seq]);
  const hint = expected as unknown as { type: string; cards?: number[] } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const order = mySeat === null ? view.passed.map((_, k) => k) : [...view.passed.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const chosen = sel.map((i) => view.hand![i]!);
  const total = chosen.reduce((a, b) => a + b, 0);
  const myBid = mySeat === null ? 0 : view.bids[mySeat]!.reduce((a, b) => a + b, 0);
  const disgrace = view.card ? isDisgrace(view.card) : false;
  const myTurn = !!bidHint || canPass;
  const status_ = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: disgrace ? 'پول بگذارید یا کنار بکشید و رسوایی را بپذیرید' : 'پیشنهاد بالاتر بدهید یا کنار بکشید' }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const last = view.last;

  return (
    <div className="hs" ref={root} data-seq={view.seq}>
      {status_ && <TurnIndicator tone={status_.tone}>{status_.text}</TurnIndicator>}

      {!view.outcome && view.card && (
        <section data-flip-anchor="stage" className={`hs__stage ${disgrace ? 'hs__stage--bad' : ''}`} aria-label="کارت مزایده">
          <div className="hs__lamps" title="با چهارمین کارت قاب‌قرمز بازی تمام می‌شود">{[0, 1, 2, 3].map((k) => <i key={`${k}${k < view.red}`} className={k < view.red ? 'on bg-pop' : ''} />)}<span>قاب قرمز: {fa(view.red)} از ۴</span></div>
          <Card c={view.card} key={view.seq + view.card} flip={`c-${view.card === 'prestige' ? 'prestige.stage' : view.card}`} flipFrom="deck" />
          <div className="hs__terms">
            {disgrace ? <>رسوایی: <b>اولین کسی که کنار بکشد</b> آن را می‌گیرد؛ بقیه پولشان را از دست می‌دهند</> : <>آخرین نفر باقی‌مانده می‌خرد</>}
            {view.high > 0 && <>، بالاترین پیشنهاد <b className="hs__high bg-pop" key={view.high}>{fa(view.high)}</b></>}
          </div>
          <span className="hs__deck" data-flip-anchor="deck"><span key={view.deckCount} className="bg-pop">{fa(view.deckCount)}</span> کارت در دسته</span>
        </section>
      )}

      {last && !view.outcome && (
        <p className="hs__last" role="status" key={view.seq}>
          <bdi>{who(last.seat)}</bdi> «{lux(last.card) ? LUX[lux(last.card)] : SPECIAL[last.card]!.name}» را {isDisgrace(last.card) ? 'گرفت' : 'برد'}{last.paid ? ` (${fa(last.paid)} داد)` : ''}{last.lost ? ` و «${LUX[lux(last.lost)]}» را از دست داد` : ''}
        </p>
      )}

      <ul className="hs__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          const poorest = view.money ? view.money[s] === Math.min(...view.money) && new Set(view.money).size > 1 : false;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['hs-pl', view.current === s ? 'hs-pl--turn' : '', view.passed[s] ? 'hs-pl--passed' : '', s === mySeat ? 'hs-pl--me' : '', place === 1 ? 'hs-pl--win' : ''].join(' ')}>
              <div className="hs-pl__head">
                {place && <b className="hs-pl__place">{fa(place)}</b>}
                <bdi className="hs-pl__name">{who(s)}</bdi>
                <span className="hs-pl__status" title="امتیاز">★ {fmtStatus(status(view.won[s]!))}</span>
                {view.money ? <span key={view.money[s]} className={`hs-pl__money bg-pop ${poorest ? 'hs-pl__money--out' : ''}`}>{fa(view.money[s]!)} پول{poorest ? '، کم‌پول‌ترین' : ''}</span>
                  : <span className="hs-pl__meta">{fa(view.handCount[s]!)} اسکناس</span>}
                {view.faux[s] && <span className="hs-pl__flag">گاف در انتظار</span>}
                {!view.outcome && view.passed[s] && <span className="hs-pl__flag">کنار کشید</span>}
              </div>
              {!view.outcome && view.bids[s]!.length > 0 && <div className="hs-pl__bid">{view.bids[s]!.map((v) => <Note key={v} v={v} size="sm" flip={`n-${s}-${v}`} flipFrom={`seat-${s}`} />)}</div>}
              {view.won[s]!.length > 0 && <div className="hs-pl__won">{view.won[s]!.map((c, i) => <Card key={i} c={c} size="sm" flip={c === 'prestige' ? `w${s}-prestige.${view.won[s]!.slice(0, i).filter((x) => x === c).length}` : `c-${c}`} flipFrom={last?.card === c && last.seat === s ? 'stage' : undefined} />)}</div>}
            </li>
          );
        })}
      </ul>

      {view.hand && !view.outcome && (
        <section className="hs__me" aria-label="اسکناس‌های شما">
          <div className="hs__fan" role="group" aria-label="اسکناس‌ها">
            {view.hand.map((v, i) => (
              <button key={`${v}-${i}`} type="button" aria-pressed={sel.includes(i)} disabled={busy || !bidHint}
                className={['hs-pick', sel.includes(i) ? 'hs-pick--on' : '', hint?.type === 'bid' && hint.cards?.includes(v) && !sel.includes(i) ? 'hs-hint' : ''].join(' ')}
                onClick={() => setSel(sel.includes(i) ? sel.filter((k) => k !== i) : [...sel, i])}><Note v={v} flip={`n-${mySeat}-${v}`} /></button>
            ))}
          </div>
          {myTurn && (
            <div className="hs__actions" data-need={bidHint?.need ?? ''}>
              {bidHint && <Button size="sm" disabled={busy || total < bidHint.need} className={hint?.type === 'bid' && total >= bidHint.need ? 'hs-hint' : ''}
                onClick={() => onAction({ type: 'bid', cards: chosen })}>پیشنهاد {fa(myBid + total)}{total < bidHint.need ? ` (حداقل ${fa(myBid + bidHint.need)})` : ''}</Button>}
              {canPass && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'pass' ? 'hs-hint' : ''} onClick={() => onAction({ type: 'pass' })}>{disgrace ? 'کنار می‌کشم (کارت را می‌گیرم)' : 'کنار می‌کشم'}</Button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
