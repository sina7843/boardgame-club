// جمجمه renderer: a dark tavern table; each player's stack of face-down coasters with their colour on the back, roses
// and skulls revealed with a flip, your discs to place, a bid strip, and opponents' stacks to turn in the reveal.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import rose from './art/disc-rose.webp';
import skull from './art/disc-skull.webp';
import type { Disc, SkullView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const SEAT = ['#d1495b', '#2f80c9', '#3fa34d', '#e0a526', '#8e5bd1', '#e07a2f'];

// Revealed faces are cut from a generated sprite sheet (see DECISIONS.md); backs stay vector in the seat colour.
function Coaster({ face, color, size = 'md', flip }: { face: Disc | 'back'; color: string; size?: 'sm' | 'md'; flip?: boolean }) {
  return (
    <span className={['sk-disc', `sk-disc--${size}`, flip ? 'sk-disc--flip' : ''].join(' ')} style={{ ['--seat' as string]: color }}>
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

export default function SkullRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SkullView>) {
  const placeable = new Set(legalActions.filter((a) => a.type === 'place').map((a) => a.disc as Disc));
  const bidHint = legalActions.find((a) => a.type === 'bid') as { min: number; max: number } | undefined;
  const canPass = legalActions.some((a) => a.type === 'pass');
  const flippable = new Set(legalActions.filter((a) => a.type === 'flip').map((a) => a.seat as number));
  const lastSeq = view.log.at(-1)?.seq ?? 0;
  const [bid, setBid] = useState<number | null>(null);
  useEffect(() => { setBid(null); }, [lastSeq]);
  const hint = expected as unknown as { type: string; disc?: Disc; n?: number; seat?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const me = mySeat ?? 0;
  const order = mySeat === null ? view.owned.map((_, k) => k) : [...view.owned.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const chosenBid = bid ?? bidHint?.min ?? 1;

  const myTurn = placeable.size > 0 || !!bidHint || canPass || flippable.size > 0;
  const status = view.outcome ? null
    : view.phase === 'reveal' ? (myTurn ? { tone: 'mine' as const, text: `${fa(view.bid!.n - view.turned.length)} دیسک دیگر رو کنید` } : { tone: 'wait' as const, text: `${who(view.bid!.seat)} دیسک‌ها را رو می‌کند` })
      : myTurn ? { tone: 'mine' as const, text: view.phase === 'first' ? 'یک دیسک رو به پایین بگذارید' : view.phase === 'bid' ? 'عدد بالاتر بگویید یا کنار بکشید' : 'دیسک بگذارید یا پیشنهاد بدهید' }
        : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };

  const lastLose = [...view.log].reverse().find((e) => e.t === 'lose-disc' && e.seq === lastSeq);

  return (
    <div className="sk" data-seq={lastSeq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {view.bid && view.phase !== 'first' && (
        <p className="sk__bid" role="status">پیشنهاد <bdi>{who(view.bid.seat)}</bdi>: <strong>{fa(view.bid.n)}</strong> از {fa(view.maxBid)} دیسک</p>
      )}

      <ul className="sk__table" aria-label="بازیکنان">
        {order.map((s) => {
          const turned = view.turned.filter((t) => t.seat === s);
          const stack = view.stackCounts[s]!;
          const canFlip = flippable.has(s) && !busy;
          const body = (
            <>
              <div className="sk-pl__head">
                <span className="sk-pl__mat" aria-label={`${fa(view.points[s]!)} امتیاز از ۲`}>{[0, 1].map((k) => <i key={k} className={k < view.points[s]! ? 'on' : ''} />)}</span>
                <bdi className="sk-pl__name">{who(s)}</bdi>
                {view.owned[s] === 0 ? <span className="sk-pl__out">بیرون</span> : <span className="sk-pl__owned">{fa(view.owned[s]!)} دیسک</span>}
                {view.phase === 'bid' && view.passed[s] && <span className="sk-pl__pass">کنار کشید</span>}
              </div>
              <div className="sk-pl__stack" aria-label={`${fa(stack)} دیسک روی میز`}>
                {Array.from({ length: stack }, (_, k) => {
                  const fromTop = stack - 1 - k;
                  const shown = turned[fromTop];
                  const own = s === mySeat && view.myStack ? view.myStack[k] : null;
                  return (
                    <span key={k} className="sk-pl__slot" style={{ ['--k' as string]: k }}>
                      <Coaster face={shown ? shown.disc : 'back'} color={SEAT[s % SEAT.length]!} flip={!!shown} />
                      {own && !shown && <span className={`sk-peek sk-peek--${own}`} title="فقط شما می‌بینید">{own === 'skull' ? 'جمجمه' : 'گل'}</span>}
                    </span>
                  );
                })}
                {!stack && <span className="sk-pl__empty">—</span>}
              </div>
            </>
          );
          return (
            <li key={s} className={['sk-pl', s === view.current && !view.outcome ? 'sk-pl--turn' : '', s === mySeat ? 'sk-pl--me' : ''].join(' ')}>
              {canFlip
                ? <button type="button" className={['sk-pl__flip', hint?.type === 'flip' && hint.seat === s ? 'sk-hint' : ''].join(' ')} onClick={() => onAction({ type: 'flip', seat: s })} aria-label={`رو کردن دیسک بالایی ${who(s)}`}>{body}<span className="sk-pl__cta">رو کن</span></button>
                : body}
            </li>
          );
        })}
      </ul>

      {view.hand && view.owned[me] && !view.outcome ? (
        <div className="sk__mine">
          <div className="sk__hand" role="group" aria-label="دیسک‌های دست شما">
            {view.hand.map((d, k) => (
              <button key={k} type="button" className={['sk-handdisc', hint?.type === 'place' && hint.disc === d ? 'sk-hint' : ''].join(' ')} disabled={busy || !placeable.has(d)}
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
