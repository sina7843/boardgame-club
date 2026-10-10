// سیرک renderer: a circus ring. Cards show their top number big and the other number upside down at the bottom;
// the show in the ring belongs to its owner; your hand keeps its order. Show: tap the first and last card of a run
// of neighbours. Scout: tap an end card of the ring's show (flip it if you like), then the gap where it goes.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { down, type HandCard, type ScoutView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');

export function Act({ c, size = 'md', flipped, flip, flipFrom, exit }: { c: HandCard; size?: 'sm' | 'md'; flipped?: boolean; flip?: string; flipFrom?: string; exit?: string }) {
  const top = flipped ? down(c) : c.up;
  const bot = flipped ? c.up : down(c);
  return (
    <span className={`sc-card sc-card--${size} sc-v--${top}`} aria-label={`${fa(top)} (پشت: ${fa(bot)})`} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit}>
      <b className="sc-card__top">{fa(top)}</b>
      <span className="sc-card__star" aria-hidden="true">★</span>
      <small className="sc-card__bot">{fa(bot)}</small>
    </span>
  );
}

export default function ScoutRenderer({ view, legalActions, mySeat, seatName, busy: sending, onAction, expected, queued }: GameRendererProps<ScoutView>) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const isQueued = !!queued;
  const busy = sending || isQueued;
  const orient = legalActions.some((a) => a.type === 'orient');
  const showHint = legalActions.find((a) => a.type === 'show') as { options: { from: number; count: number }[] } | undefined;
  const scoutHint = legalActions.find((a) => a.type === 'scout') as { canShow: boolean } | undefined;
  const [range, setRange] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<'first' | 'last' | null>(null);
  const [flip, setFlip] = useState(false);
  const [andShow, setAndShow] = useState(false);
  useEffect(() => { setRange(null); setEnd(null); setFlip(false); setAndShow(false); }, [view.seq, isQueued]);
  const hint = expected as unknown as { type: string; flip?: boolean; from?: number; count?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  // Undo window: my show / scout is shown at once from what I already hold (the cards and the ring); undo puts it back.
  let hand = view.hand ?? [];
  let t = view.table;
  if (queued?.type === 'show' && mySeat !== null) {
    const from = queued.from as number, count = queued.count as number;
    t = { cards: hand.slice(from, from + count), owner: mySeat };
    hand = [...hand.slice(0, from), ...hand.slice(from + count)];
  } else if (queued?.type === 'scout' && t?.cards.length) {
    const first = queued.end === 'first';
    const card = first ? t.cards[0]! : t.cards.at(-1)!;
    hand = [...hand];
    hand.splice(queued.at as number, 0, queued.flip ? { id: card.id, up: down(card) } : card);
    t = { cards: first ? t.cards.slice(1) : t.cards.slice(0, -1), owner: t.owner };
    if (!t.cards.length) t = null;
  }
  const sel = range ? { from: Math.min(...range), count: Math.abs(range[1] - range[0]) + 1 } : null;
  const showOk = !!sel && !!showHint?.options.some((o) => o.from === sel.from && o.count === sel.count);
  const tapHand = (i: number) => {
    if (!showHint || busy || end) return;
    if (!range) setRange([i, i]);
    else if (range[0] === i && range[1] === i) setRange(null);
    else setRange([range[0], i]);
  };
  const myTurn = !!showHint || !!scoutHint;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : orient ? { tone: 'mine' as const, text: 'دستتان را همین‌طور نگه می‌دارید یا برمی‌گردانید؟' }
      : view.phase === 'orient' ? { tone: 'wait' as const, text: 'منتظر انتخاب جهت دست بقیه' }
        : myTurn ? { tone: 'mine' as const, text: view.phase === 'show' ? 'حالا نمایش بدهید' : end ? 'جای کارت را در دستتان بزنید' : 'نمایش بدهید یا از نمایش وسط دیدبانی کنید' }
          : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const order = mySeat === null ? view.scores.map((_, k) => k) : [...view.scores.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const inRange = (i: number) => !!sel && i >= sel.from && i < sel.from + sel.count;
  const hintRange = (i: number) => hint?.type === 'show' && !range && i >= hint.from! && i < hint.from! + hint.count!;

  return (
    <div className="sc" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="sc__round">دست {fa(view.round)} از {fa(view.rounds)}</p>

      <ul className="sc__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['sc-pl', view.current === s && view.phase !== 'orient' && !view.outcome ? 'sc-pl--turn' : '', s === mySeat ? 'sc-pl--me' : '', view.outcome?.placements.find((x) => x.seat === s)?.place === 1 ? 'sc-pl--win' : ''].join(' ')}>
            <bdi className="sc-pl__name">{who(s)}</bdi>
            <span className="sc-pl__score bg-pop" key={view.scores[s]}>{fa(view.scores[s]!)}</span>
            <span>{fa(view.handCount[s]!)} کارت</span>
            <span key={`c${view.captured[s]}`} className="bg-pop">برده {fa(view.captured[s]!)}</span>
            <span className="sc-pl__chips bg-pop" key={`h${view.chips[s]}`}>ژتون {fa(view.chips[s]!)}</span>
            {!view.usedSS[s] && <span className="sc-pl__ss" title="دیدبانی و نمایش هنوز مانده">د+ن</span>}
          </li>
        ))}
      </ul>

      {!view.outcome && (
        <section className="sc__ring" data-flip-anchor="deck" aria-label="نمایش وسط">
          {t ? (
            <>
              <span className="sc__owner">نمایش <bdi>{who(t.owner)}</bdi></span>
              <div className="sc__show">
                {t.cards.map((c, i) => {
                  const e = i === 0 ? 'first' : i === t.cards.length - 1 ? 'last' : null;
                  const can = !!scoutHint && view.phase === 'play' && !!e && !busy && !range;
                  return can
                    ? <button key={i} type="button" className={`sc-end ${end === e ? 'sc-end--on' : ''}`} onClick={() => { setEnd(end === e ? null : e); setFlip(false); }} aria-pressed={end === e} aria-label={e === 'first' ? 'دیدبانی کارت اول' : 'دیدبانی کارت آخر'}>
                      <Act c={c} flipped={end === e && flip} flip={`c-${c.id}`} flipFrom={`seat-${t.owner}`} exit={`seat-${view.current}`} /></button>
                    : <Act key={i} c={c} flip={`c-${c.id}`} flipFrom={`seat-${t.owner}`} exit={`seat-${view.current}`} />;
                })}
              </div>
            </>
          ) : <span className="sc__empty">حلقه خالی است: هر نمایشی قبول است</span>}
        </section>
      )}

      {myTurn && end && (
        <div className="sc__bar">
          <Button size="sm" variant="secondary" onClick={() => setFlip(!flip)}>برگرداندن کارت ⇅</Button>
          {scoutHint?.canShow && <label className="sc__ss"><input type="checkbox" checked={andShow} onChange={(e) => setAndShow(e.target.checked)} /> دیدبانی و نمایش</label>}
          <Button size="sm" variant="secondary" onClick={() => setEnd(null)}>لغو</Button>
        </div>
      )}

      {view.hand && !view.outcome && (
        <section className="sc__me" aria-label="دست شما">
          {orient && (
            <div className="sc__orient">
              <div className="sc__hand">{hand.map((c, i) => <Act key={i} c={c} />)}</div>
              <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'orient' && hint.flip === false ? 'sc-hint' : ''} onClick={() => onAction({ type: 'orient', flip: false })}>همین‌طور</Button>
              <div className="sc__hand">{hand.slice().reverse().map((c, i) => <Act key={i} c={c} flipped />)}</div>
              <Button size="sm" disabled={busy} className={hint?.type === 'orient' && hint.flip ? 'sc-hint' : ''} onClick={() => onAction({ type: 'orient', flip: true })}>برگرداندن دست</Button>
            </div>
          )}
          {!orient && (
            <div className="sc__hand sc__hand--play" role="group" aria-label="کارت‌های دست" data-shows={showHint ? showHint.options.map((o) => `${o.from}:${o.count}`).join(' ') : undefined}>
              {hand.map((c, i) => (
                <span key={`${c.id}`} className="sc-slot">
                  {end && <button type="button" className="sc-gap" disabled={busy} onClick={() => onAction({ type: 'scout', end, flip, at: i, ...(andShow ? { andShow: true } : {}) })} aria-label={`گذاشتن قبل از کارت ${fa(i + 1)}`}>+</button>}
                  <button type="button" className={['sc-pick', inRange(i) ? 'sc-pick--on' : '', hintRange(i) ? 'sc-hint' : ''].join(' ')} disabled={!showHint || busy || !!end} onClick={() => tapHand(i)} aria-pressed={inRange(i)}><Act c={c} flip={`c-${c.id}`} flipFrom="deck" /></button>
                </span>
              ))}
              {end && <button type="button" className="sc-gap" disabled={busy} onClick={() => onAction({ type: 'scout', end, flip, at: hand.length, ...(andShow ? { andShow: true } : {}) })} aria-label="گذاشتن در آخر">+</button>}
            </div>
          )}
          {showHint && !end && !orient && (
            <Button size="sm" disabled={!showOk || busy} className={hint?.type === 'show' && showOk ? 'sc-hint' : ''} onClick={() => sel && onAction({ type: 'show', from: sel.from, count: sel.count })}>
              نمایش {sel ? fa(sel.count) : ''} کارت
            </Button>
          )}
        </section>
      )}

      {view.roundLog.length > 0 && (
        <table className="sc__log"><thead><tr><th scope="col">دست</th>{view.scores.map((_, k) => <th key={k} scope="col"><bdi>{who(k)}</bdi></th>)}</tr></thead>
          <tbody>{view.roundLog.map((r, i) => <tr key={i}><th scope="row">{fa(i + 1)}</th>{r.map((v, k) => <td key={k}>{fa(v)}</td>)}</tr>)}</tbody></table>
      )}
    </div>
  );
}
