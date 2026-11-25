// اشرافی renderer: an art-deco salon. The card up for auction sits on a velvet easel with the four red-frame lamps
// beside it; rivals show their open bids as banknote chips and their collection; your banknotes are a fan to tap
// into a bid.
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps, type Term, DockSlot } from '@bg/ui';
const GC = import.meta.glob<string>('./art/gc/high-society-*.png', { eager: true, import: 'default' });
const gc = (n: string | number) => GC[`./art/gc/high-society-${n}.png`];
import luxuryArt from './art/luxury.webp';
import prestigeArt from './art/prestige.webp';
import disgraceArt from './art/disgrace.webp';
import { terms } from './terms.ts';
import { isDisgrace, isRed, lux, status, type HighSocietyView, type StatusCard } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const LUX = ['', 'گلاب‌پاش', 'کلاه', 'دستکش', 'عطر', 'شامپاین', 'تابلو', 'پیانو', 'اسب', 'قایق', 'کاخ ییلاقی'];
const SPECIAL: Record<string, { big: string; name: Term }> = {
  prestige: { big: '×۲', name: terms.prestige }, passe: { big: '−۵', name: terms.passe }, scandal: { big: '½', name: terms.scandal }, faux: { big: '✕', name: terms.faux }
};
// Painted art cut from a generated sheet (see DECISIONS.md), chosen by card type.
const ART = { lux: luxuryArt, good: prestigeArt, bad: disgraceArt };
const fmtStatus = (v: number) => (Number.isInteger(v) ? fa(v) : v.toLocaleString('fa-IR', { maximumFractionDigits: 2 }));

export function Card({ c, size = 'md', flip, flipFrom, exit }: { c: StatusCard; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; exit?: string }) {
  const v = lux(c);
  const sp = SPECIAL[c];
  const kind = v ? 'lux' : isDisgrace(c) ? 'bad' : 'good';
  const face = gc(v ? `l${v}` : c);
  if (face) return <span className={['hs-card', 'hs-card--img', `hs-card--${size}`, isRed(c) ? 'hs-card--red' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} aria-label={v ? `${LUX[v]} (${fa(v)})` : tx(sp!.name)}><img className="hs-card__face" src={face} alt="" draggable={false} /></span>;
  return (
    <span className={['hs-card', `hs-card--${size}`, `hs-card--${kind}`, isRed(c) ? 'hs-card--red' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit}
      aria-label={v ? `${LUX[v]} (${fa(v)})` : tx(sp!.name)}>
      <img className="hs-card__art" src={ART[kind]} alt="" draggable={false} />
      <span className="hs-card__big">{v ? fa(v) : sp!.big}</span>
      <span className="hs-card__name">{v ? LUX[v] : tx(sp!.name)}</span>
    </span>
  );
}

const Note = ({ v, size = 'md', flip, flipFrom, exit }: { v: number; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; exit?: string }) => {
  const img = gc(`money-${v}`); // money-6 and money-12 are not delivered: CSS banknote fallback
  return <span className={`hs-note hs-note--${size} ${img ? 'hs-note--img' : ''}`} data-v={v} aria-label={img ? fa(v) : undefined} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit}>{img ? <img src={img} alt="" draggable={false} /> : null}{!img && <b>{fa(v)}</b>}</span>;
};

/** My queued bid / pass applied to the view: banknotes move between hand and bid row (all known to me). */
function preview(v: HighSocietyView, q: { type: string; cards?: number[] } | null | undefined, me: number | null): HighSocietyView {
  if (!q || me === null || !v.hand) return v;
  const bids = v.bids.slice(), passed = v.passed.slice();
  if (q.type === 'bid' && q.cards) {
    const rest = v.hand.slice();
    for (const c of q.cards) rest.splice(rest.indexOf(c), 1);
    bids[me] = [...bids[me]!, ...q.cards];
    return { ...v, hand: rest, bids };
  }
  if (q.type === 'pass') {
    passed[me] = true;
    // Passing on a luxury takes the open bid back; on a disgrace the server decides what happens to the money.
    if (v.card && isDisgrace(v.card)) return { ...v, passed };
    const hand = [...v.hand, ...bids[me]!].sort((a, b) => a - b);
    bids[me] = [];
    return { ...v, hand, bids, passed };
  }
  return v;
}

export default function HighSocietyRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<HighSocietyView>) {
  useTermsLang(); // re-render when the terms language changes
  const q = queued as { type: string; cards?: number[] } | null | undefined;
  const view = preview(served, q, mySeat);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q ? JSON.stringify(q) : ''}`);
  const bidHint = legalActions.find((a) => a.type === 'bid') as { need: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { setSel([]); }, [view.seq, queued]);
  const hint = expected as unknown as { type: string; cards?: number[] } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const order = mySeat === null ? view.passed.map((_, k) => k) : [...view.passed.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const chosen = sel.map((i) => view.hand![i]!);
  const total = chosen.reduce((a, b) => a + b, 0);
  const myBid = mySeat === null ? 0 : view.bids[mySeat]!.reduce((a, b) => a + b, 0);
  const disgrace = view.card ? isDisgrace(view.card) : false;
  const myTurn = !!bidHint || canPass;
  const status_ = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: disgrace ? `پول بگذارید یا کنار بکشید و ${tx(terms.disgrace)} را بپذیرید` : `${tx(terms.bid)} بالاتر بدهید یا کنار بکشید` }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const last = view.last;
  const framed = useInFrame() !== null; // the shell draws seats, scores, whose-turn and the events log

  return (
    <div className="hs" ref={root} data-seq={view.seq}>
      {!framed && status_ && <TurnIndicator tone={status_.tone}>{status_.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status_ && <p><b>{status_.text}</b></p>}
          <p>{disgrace ? 'کارت بد برعکس مزایده می‌شود: اولین کسی که کنار بکشد کارت را می‌گیرد و پولش را پس می‌گیرد.' : 'اسکناس‌ها خرد نمی‌شوند؛ جمع پیشنهادتان باید از بالاترین پیشنهاد بیشتر شود. با چهارمین کارت قاب‌قرمز بازی تمام می‌شود و کم‌پول‌ترین کنار می‌رود.'}</p>
        </RailSlot>
      )}

      {!view.outcome && view.card && (
        <section data-flip-anchor="stage" className={`hs__stage ${disgrace ? 'hs__stage--bad' : ''}`} aria-label="کارت مزایده">
          <div className="hs__lamps" title="با چهارمین کارت قاب‌قرمز بازی تمام می‌شود">{[0, 1, 2, 3].map((k) => <i key={`${k}${k < view.red}`} className={k < view.red ? 'on bg-pop' : ''} />)}<span>قاب قرمز: {fa(view.red)} از ۴</span></div>
          <Card c={view.card} key={view.seq + view.card} flip={`c-${view.card === 'prestige' ? 'prestige.stage' : view.card}`} flipFrom="deck" />
          <div className="hs__terms">
            {disgrace ? <><T t={terms.disgrace} />: <b>اولین کسی که کنار بکشد</b> آن را می‌گیرد؛ بقیه پولشان را از دست می‌دهند</> : <>آخرین نفر باقی‌مانده می‌خرد</>}
            {view.high > 0 && <>، بالاترین <T t={terms.bid} /> <b className="hs__high bg-pop" key={view.high}>{fa(view.high)}</b></>}
          </div>
          <span className="hs__deck" data-flip-anchor="deck"><span key={view.deckCount} className="bg-pop">{fa(view.deckCount)}</span> کارت در دسته</span>
        </section>
      )}

      {!framed && last && !view.outcome && (
        <p className="hs__last" role="status" key={view.seq}>
          <bdi>{who(last.seat)}</bdi> «{lux(last.card) ? LUX[lux(last.card)] : tx(SPECIAL[last.card]!.name)}» را {isDisgrace(last.card) ? 'گرفت' : 'برد'}{last.paid ? ` (${fa(last.paid)} داد)` : ''}{last.lost ? ` و «${LUX[lux(last.lost)]}» را از دست داد` : ''}
        </p>
      )}

      <ul className="hs__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          const poorest = view.money ? view.money[s] === Math.min(...view.money) && new Set(view.money).size > 1 : false;
          // In the frame the seat plates carry name, money and flags: a band with no bid and no card would be empty (QA round 2).
          if (framed && !view.outcome && !view.bids[s]!.length && !view.won[s]!.length) return null;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['hs-pl', view.current === s ? 'hs-pl--turn' : '', view.passed[s] ? 'hs-pl--passed' : '', s === mySeat ? 'hs-pl--me' : '', place === 1 ? 'hs-pl--win' : ''].join(' ')}>
              {framed ? <bdi className="hs-pl__name">{who(s)}</bdi> : <div className="hs-pl__head">
                {place && <b className="hs-pl__place">{fa(place)}</b>}
                <bdi className="hs-pl__name">{who(s)}</bdi>
                <span className="hs-pl__status" title="امتیاز">★ {fmtStatus(status(view.won[s]!))}</span>
                {view.money ? <span key={view.money[s]} className={`hs-pl__money bg-pop ${poorest ? 'hs-pl__money--out' : ''}`}>{fa(view.money[s]!)} پول{poorest ? '، کم‌پول‌ترین' : ''}</span>
                  : <span className="hs-pl__meta">{fa(view.handCount[s]!)} اسکناس</span>}
                {view.faux[s] && <span className="hs-pl__flag"><T t={terms.faux} /> در انتظار</span>}
                {!view.outcome && view.passed[s] && <span className="hs-pl__flag">کنار کشید</span>}
              </div>}
              {!view.outcome && view.bids[s]!.length > 0 && <div className="hs-pl__bid">{view.bids[s]!.map((v) => <Note key={v} v={v} size="sm" flip={`n-${s}-${v}`} flipFrom={`seat-${s}`} exit="drop" />)}</div>}
              {view.won[s]!.length > 0 && <div className="hs-pl__won">{view.won[s]!.map((c, i) => <Card key={i} c={c} size="sm" flip={c === 'prestige' ? `w${s}-prestige.${view.won[s]!.slice(0, i).filter((x) => x === c).length}` : `c-${c}`} flipFrom={last?.card === c && last.seat === s ? 'stage' : undefined} exit="drop" />)}</div>}
            </li>
          );
        })}
      </ul>

      {view.hand && !view.outcome && (
        <section className="hs__me" aria-label="اسکناس‌های شما">
          <div className="hs__fan" role="group" aria-label="اسکناس‌ها" style={{ '--n': view.hand.length, '--cols': Math.ceil(view.hand.length / 2) } as CSSProperties}>
            {view.hand.map((v, i) => (
              <button key={`${v}-${i}`} type="button" aria-pressed={sel.includes(i)} disabled={busy || !bidHint}
                className={['hs-pick', sel.includes(i) ? 'hs-pick--on' : '', hint?.type === 'bid' && hint.cards?.includes(v) && !sel.includes(i) ? 'hs-hint' : ''].join(' ')}
                onClick={() => setSel(sel.includes(i) ? sel.filter((k) => k !== i) : [...sel, i])}><Note v={v} flip={`n-${mySeat}-${v}`} /></button>
            ))}
          </div>
          {myTurn && (
            <div className="hs__actions" data-need={bidHint?.need ?? ''}>
              {bidHint && <Button size="sm" disabled={busy || total < bidHint.need} className={hint?.type === 'bid' && total >= bidHint.need ? 'hs-hint' : ''}
                onClick={() => onAction({ type: 'bid', cards: chosen })}><T t={terms.bid} /> {fa(myBid + total)}{total < bidHint.need ? ` (حداقل ${fa(myBid + bidHint.need)})` : ''}</Button>}
              {canPass && <DockSlot><Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'pass' ? 'hs-hint' : ''} onClick={() => onAction({ type: 'pass' })}>{disgrace ? 'کنار می‌کشم (کارت را می‌گیرم)' : 'کنار می‌کشم'}</Button></DockSlot>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
