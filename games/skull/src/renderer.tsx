// جمجمه renderer: a dark tavern table; each player's stack of face-down coasters with their colour on the back, roses
// and skulls revealed with a flip, your discs to place, a bid strip, and opponents' stacks to turn in the reveal.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import rose from './art/disc-rose.webp';
import skull from './art/disc-skull.webp';
import type { Disc, SkullView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const SEAT = ['#d1495b', '#2f80c9', '#3fa34d', '#e0a526', '#8e5bd1', '#e07a2f'];

// Revealed faces are cut from a generated sprite sheet (see DECISIONS.md); backs stay vector in the seat colour.
function Coaster({ face, color, size = 'md', flip }: { face: Disc | 'back'; color: string; size?: 'sm' | 'md'; flip?: boolean }) {
  return (
    <span className={['sk-disc', `sk-disc--${size}`, flip ? 'bg-flip-in' : ''].join(' ')} style={{ ['--seat' as string]: color }}>
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        {face === 'back' ? (
          <>
            <circle r="47" className="sk-disc__back" />
            <circle r="40" fill="none" stroke="rgb(255 255 255 / .35)" strokeWidth="3" strokeDasharray="6 6" />
            <path d="M0 -22 L19 11 L-19 11 Z M0 22 L-19 -11 L19 -11 Z" fill="rgb(255 255 255 / .28)" />
          </>
        ) : <image href={face === 'rose' ? rose : skull} x="-50" y="-50" width="100" height="100" />}
      </svg>
    </span>
  );
}

/** A number that bumps when it changes (never on first render). */
function Pop({ v }: { v: number }) {
  const pop = usePop(v);
  return <strong key={v} className={pop}>{fa(v)}</strong>;
}
/** Won points: the newly lit one bumps. */
function Points({ n }: { n: number }) {
  const pop = usePop(n);
  return <>{[0, 1].map((k) => <i key={k} className={k < n ? `on ${k === n - 1 ? pop : ''}` : ''} />)}</>;
}

type Queued = { type: string; disc?: Disc; n?: number; seat?: number } | null | undefined;
/** The own move shown at once in the undo window, from what this player already knows (never an opponent's disc). */
function withQueued(view: SkullView, me: number | null, q: Queued): SkullView {
  if (!q || me === null) return view;
  if (q.type === 'place' && q.disc && view.hand && view.myStack) {
    const k = view.hand.indexOf(q.disc);
    if (k < 0) return view;
    return { ...view, hand: view.hand.filter((_, i) => i !== k), myStack: [...view.myStack, q.disc], stackCounts: view.stackCounts.map((c, s) => (s === me ? c + 1 : c)), handCounts: view.handCounts.map((c, s) => (s === me ? c - 1 : c)) };
  }
  if (q.type === 'bid' && q.n) return { ...view, bid: { seat: me, n: q.n }, phase: 'bid' };
  if (q.type === 'pass') return { ...view, passed: view.passed.map((x, s) => x || s === me) };
  if (q.type === 'flip' && q.seat === me && view.myStack) {
    // Your own stack: you know its discs, so the top unturned one can be turned at once.
    const t = view.turned.filter((x) => x.seat === me).length, disc = view.myStack[view.stackCounts[me]! - 1 - t];
    return disc ? { ...view, turned: [...view.turned, { seat: me, disc }] } : view;
  }
  return view;
}

export default function SkullRenderer({ view: real, legalActions: allActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SkullView>) {
  const q = queued as Queued;
  const view = withQueued(real, mySeat, q);
  const legalActions = q ? [] : allActions;
  const placeable = new Set(legalActions.filter((a) => a.type === 'place').map((a) => a.disc as Disc));
  const bidHint = legalActions.find((a) => a.type === 'bid') as { min: number; max: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const flippable = new Set(legalActions.filter((a) => a.type === 'flip').map((a) => a.seat as number));
  const lastSeq = view.log.at(-1)?.seq ?? 0;
  const qKey = q ? JSON.stringify(q) : '';
  const [bid, setBid] = useState<number | null>(null);
  useEffect(() => { setBid(null); }, [lastSeq]);
  const hint = expected as unknown as { type: string; disc?: Disc; n?: number; seat?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const me = mySeat ?? 0;
  const order = mySeat === null ? view.owned.map((_, k) => k) : [...view.owned.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const chosenBid = bid ?? bidHint?.min ?? 1;

  const myTurn = placeable.size > 0 || !!bidHint || canPass || flippable.size > 0;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : view.phase === 'reveal' ? (myTurn ? { tone: 'mine' as const, text: `${fa(view.bid!.n - view.turned.length)} دیسک دیگر رو کنید` } : { tone: 'wait' as const, text: `${who(view.bid!.seat)} دیسک‌ها را رو می‌کند` })
      : myTurn ? { tone: 'mine' as const, text: view.phase === 'first' ? 'یک دیسک رو به پایین بگذارید' : view.phase === 'bid' ? 'عدد بالاتر بگویید یا کنار بکشید' : 'دیسک بگذارید یا پیشنهاد بدهید' }
        : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };

  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${lastSeq}|${qKey}`);
  const lastLose = [...view.log].reverse().find((e) => e.t === 'lose-disc' && e.seq === lastSeq);
  const hitSeat = view.log.at(-1)?.t === 'lose-disc' ? (view.log.at(-1) as { seat?: number }).seat : undefined;

  return (
    <div className="sk" ref={root} data-seq={lastSeq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {view.bid && view.phase !== 'first' && (
        <p className="sk__bid" role="status">پیشنهاد <bdi>{who(view.bid.seat)}</bdi>: <Pop v={view.bid.n} /> از {fa(view.maxBid)} دیسک</p>
      )}

      <ul className="sk__table" aria-label="بازیکنان">
        {order.map((s) => {
          const turned = view.turned.filter((t) => t.seat === s);
          const stack = view.stackCounts[s]!;
          const canFlip = flippable.has(s) && !busy;
          const won = view.points[s]!;
          const owned = view.owned[s]!;
          const color = SEAT[s % SEAT.length]!;
          // The player mat as printed: a round coaster mat in the seat colour, plain side up until the first won
          // challenge flips it to the point side; the placed stack sits on it, the owned discs and points beside it.
          const body = (
            <>
              <div className="sk-pl__head">
                <bdi className="sk-pl__name">{who(s)}</bdi>
                {owned === 0 ? <span className="sk-pl__out">بیرون</span> : null}
                {view.phase === 'bid' && view.passed[s] && <span className="sk-pl__pass">کنار کشید</span>}
              </div>
              <div className={['sk-mat', won > 0 ? 'sk-mat--won' : ''].join(' ')} style={{ ['--seat' as string]: color }}>
                <span className="sk-mat__side">{won > 0 ? 'سمت امتیاز' : 'سمت ساده'}</span>
                <div className="sk-pl__stack" aria-label={`${fa(stack)} دیسک روی میز`}>
                  {Array.from({ length: stack }, (_, k) => {
                    const fromTop = stack - 1 - k;
                    const shown = turned[fromTop];
                    const own = s === mySeat && view.myStack ? view.myStack[k] : null;
                    return (
                      <span key={k} className="sk-pl__slot" data-flip={`st-${s}-${k}`} data-flip-from={s === mySeat ? 'hand' : `seat-${s}`} data-flip-exit={s === mySeat ? 'hand' : `seat-${s}`} style={{ ['--k' as string]: k }}>
                        <Coaster face={shown ? shown.disc : 'back'} color={color} flip={!!shown} />
                        {own && !shown && <span className={`sk-peek sk-peek--${own}`} title="فقط شما می‌بینید">{own === 'skull' ? 'جمجمه' : 'گل'}</span>}
                      </span>
                    );
                  })}
                  {!stack && <span className="sk-pl__empty">بدون دیسک</span>}
                </div>
              </div>
              <div className="sk-pl__foot">
                <span className="sk-pl__mat" aria-label={`${fa(won)} امتیاز از ۲`}><Points n={won} /><small>{fa(won)}/۲ امتیاز</small></span>
                <span className={s === hitSeat ? 'sk-pl__owned bg-hit' : 'sk-pl__owned'} key={`${owned}-${s === hitSeat ? lastSeq : ''}`} aria-label={`${fa(owned)} دیسک از ۴`}>
                  <span className="sk-own" aria-hidden="true">{[0, 1, 2, 3].map((k) => <i key={k} className={k < owned ? 'on' : ''} />)}</span>
                  {fa(owned)} دیسک · {fa(view.handCounts[s] ?? 0)} در دست
                </span>
              </div>
            </>
          );
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['sk-pl', s === hitSeat ? 'bg-hit' : '', s === view.current && !view.outcome ? 'sk-pl--turn' : '', s === mySeat ? 'sk-pl--me' : ''].join(' ')}>
              {canFlip
                ? <button type="button" className={['sk-pl__flip', hint?.type === 'flip' && hint.seat === s ? 'sk-hint' : ''].join(' ')} onClick={() => onAction({ type: 'flip', seat: s })} aria-label={`رو کردن دیسک بالایی ${who(s)}`}>{body}<span className="sk-pl__cta">رو کن</span></button>
                : body}
            </li>
          );
        })}
      </ul>

      {view.hand && view.owned[me] && !view.outcome ? (
        <div className="sk__mine">
          <div className="sk__hand" data-flip-anchor="hand" role="group" aria-label="دیسک‌های دست شما">
            {view.hand.map((d, k) => (
              <button key={k} type="button" data-flip={`hd-${d}-${view.hand!.slice(0, k).filter((x) => x === d).length}`} className={['sk-handdisc', hint?.type === 'place' && hint.disc === d ? 'sk-hint' : ''].join(' ')} disabled={busy || !placeable.has(d)}
                onClick={() => onAction({ type: 'place', disc: d })} aria-label={d === 'skull' ? 'گذاشتن جمجمه' : 'گذاشتن گل'}>
                <Coaster face={d} color={SEAT[me % SEAT.length]!} />
              </button>
            ))}
          </div>
          {bidHint && (
            <div className="sk__bidbar" role="group" aria-label="پیشنهاد">
              {Array.from({ length: bidHint.max - bidHint.min + 1 }, (_, k) => bidHint.min + k).map((n) => (
                <button key={n} type="button" className={['sk-num', chosenBid === n ? 'sk-num--on' : '', hint?.type === 'bid' && hint.n === n ? 'sk-hint' : ''].join(' ')} onClick={() => setBid(n)}>{fa(n)}</button>
              ))}
              <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'bid', n: chosenBid })}>پیشنهاد {fa(chosenBid)}</Button>
            </div>
          )}
          {canPass && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>کنار می‌کشم</Button>}
        </div>
      ) : null}
      {view.lostLast && lastLose && lastLose.seat === mySeat && <p className="sk__lost" role="status">یک {view.lostLast === 'skull' ? 'جمجمه' : 'گل'} از دست دادید (فقط شما می‌دانید).</p>}
    </div>
  );
}
