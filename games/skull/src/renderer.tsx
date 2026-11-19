// جمجمه renderer: round mats in the seat's colour, stacks of face-down coasters, your own discs to place, the bid strip.
// Art is the handoff set (design/games/group-c/art/skull). The set is incomplete: a missing mat, back or face renders a
// plain labelled placeholder (listed in the delivery report), never a drawn substitute.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, DockSlot, RailSlot, TurnIndicator, useFlip, useInFrame, usePop, type GameRendererProps } from '@bg/ui';
import p1m0 from './art/skull-player-1-points-0.png';
import p1m1 from './art/skull-player-1-points-1.png';
import p1rose from './art/skull-player-1-rose.png';
import p1skull from './art/skull-player-1-skull.png';
import p2back from './art/skull-player-2-back.png';
import p2m0 from './art/skull-player-2-points-0.png';
import p2rose from './art/skull-player-2-rose.png';
import p3back from './art/skull-player-3-back.png';
import p3m1 from './art/skull-player-3-points-1.png';
import p3rose from './art/skull-player-3-rose.png';
import p4back from './art/skull-player-4-back.png';
import p4m0 from './art/skull-player-4-points-0.png';
import p4skull from './art/skull-player-4-skull.png';
import type { Disc, SkullView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// Key = kind-(seat + 1). Art exists for players 1–4 only; seats 5–6 get placeholders.
const ART: Record<string, string | undefined> = {
  'back-2': p2back, 'back-3': p3back, 'back-4': p4back,
  'rose-1': p1rose, 'rose-2': p2rose, 'rose-3': p3rose, 'skull-1': p1skull, 'skull-4': p4skull,
  'mat0-1': p1m0, 'mat0-2': p2m0, 'mat0-4': p4m0, 'mat1-1': p1m1, 'mat1-3': p3m1
};
type Face = Disc | 'back';
const TXT: Record<Face, string> = { rose: 'گل', skull: 'جمجمه', back: 'دیسک' };

function Coaster({ face, seat, size = 'md', flip }: { face: Face; seat: number; size?: 'sm' | 'md'; flip?: boolean }) {
  const src = ART[`${face}-${seat + 1}`];
  return src
    ? <img className={['sk-disc', `sk-disc--${size}`, flip ? 'bg-flip-in' : ''].join(' ')} src={src} alt="" draggable={false} />
    : <span className={['sk-disc', 'sk-ph', `sk-disc--${size}`].join(' ')} aria-hidden="true">{TXT[face]}</span>;
}

/** A number that bumps when it changes (never on first render). */
function Pop({ v }: { v: number }) {
  const pop = usePop(v);
  return <strong key={v} className={pop}>{fa(v)}</strong>;
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
  const framed = useInFrame() !== null;

  const myTurn = placeable.size > 0 || !!bidHint || canPass || flippable.size > 0;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : view.phase === 'reveal' ? (myTurn ? { tone: 'mine' as const, text: `${fa(view.bid!.n - view.turned.length)} دیسک دیگر رو کنید` } : { tone: 'wait' as const, text: `${who(view.bid!.seat)} دیسک‌ها را رو می‌کند` })
      : myTurn ? { tone: 'mine' as const, text: view.phase === 'first' ? 'یک دیسک رو به پایین بگذارید' : view.phase === 'bid' ? 'عدد بالاتر بگویید یا کنار بکشید' : 'دیسک بگذارید یا پیشنهاد بدهید' }
        : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const rule = view.phase === 'reveal'
    ? 'اول دیسک‌های خودتان رو می‌شود؛ از هر دستهٔ دیگر فقط دیسک بالایی را رو کنید. به جمجمه که برسید یک دیسک از دست می‌دهید.'
    : 'دیسک‌ها رو به پایین‌اند. پیشنهاد یعنی قول می‌دهید این تعداد دیسک را بدون رسیدن به جمجمه رو کنید.';

  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${lastSeq}|${qKey}`);
  const lastLose = [...view.log].reverse().find((e) => e.t === 'lose-disc' && e.seq === lastSeq);
  const hitSeat = view.log.at(-1)?.t === 'lose-disc' ? (view.log.at(-1) as { seat?: number }).seat : undefined;

  return (
    <div className="sk" ref={root} data-seq={lastSeq} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && <RailSlot><p>{rule}</p></RailSlot>}
      {view.bid && view.phase !== 'first' && (
        <p className="sk-banner" role="status"><span className="sk-banner__n"><Pop v={view.bid.n} /></span><span><b>پیشنهاد <bdi>{who(view.bid.seat)}</bdi></b><br /><small>{fa(view.maxBid)} دیسک روی میز است</small></span></p>
      )}

      <ul className="sk-mats" aria-label="بازیکنان">
        {order.map((s) => {
          const turned = view.turned.filter((t) => t.seat === s);
          const stack = view.stackCounts[s]!;
          const canFlip = flippable.has(s) && !busy;
          const won = view.points[s]!;
          const owned = view.owned[s]!;
          // A player's mat: the matching side if delivered, else that player's other printed side (never a placeholder when the player's art exists).
          const mat = ART[`mat${won > 0 ? 1 : 0}-${s + 1}`] ?? ART[`mat${won > 0 ? 0 : 1}-${s + 1}`];
          const body = (
            <>
              <span className="sk-mat__bg">
                {mat ? <img className="sk-mat__img" src={mat} alt={won > 0 ? 'زیرانداز (یک امتیاز)' : 'زیرانداز'} /> : <span className="sk-mat__img sk-ph" aria-hidden="true">زیرانداز</span>}
                <span className="sk-stack" role="img" aria-label={`${fa(stack)} دیسک روی میز`}>
                  {Array.from({ length: stack }, (_, k) => {
                    const shown = turned[stack - 1 - k];
                    const own = s === mySeat && view.myStack ? view.myStack[k] : null;
                    return (
                      <span key={k} className="sk-slot" data-flip={`st-${s}-${k}`} data-flip-from={s === mySeat ? 'hand' : `seat-${s}`} data-flip-exit={s === mySeat ? 'hand' : `seat-${s}`} style={{ ['--k' as string]: k }}>
                        <Coaster face={shown ? shown.disc : own ?? 'back'} seat={s} flip={!!shown} />
                      </span>
                    );
                  })}
                </span>
              </span>
              <span className="sk-mat__l">
                <b><bdi>{who(s)}</bdi></b> {fa(owned)} دیسک
                {owned === 0 ? <><span className="bgv-sep" /><em>بیرون</em></> : null}
                {view.phase === 'bid' && view.passed[s] ? <><span className="bgv-sep" />پاس</> : null}
                {view.bid?.seat === s && !view.outcome && view.phase !== 'first' ? <><span className="bgv-sep" /><em>پیشنهاد {fa(view.bid.n)}</em></> : null}
              </span>
            </>
          );
          const cls = ['sk-mat', s === mySeat ? 'is-me' : '', s === view.current && !view.outcome ? 'is-turn' : '', view.passed[s] && view.phase === 'bid' ? 'is-pass' : '', s === hitSeat ? 'bg-hit' : '', canFlip ? 'is-click' : ''].join(' ');
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={cls}>
              {canFlip
                ? <button type="button" className={['sk-mat__btn', hint?.type === 'flip' && hint.seat === s ? 'sk-hint' : ''].join(' ')} onClick={() => onAction({ type: 'flip', seat: s })} aria-label={`رو کردن دیسک بالایی ${who(s)}`}>{body}<span className="sk-mat__cta">رو کن</span></button>
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
                <Coaster face={d} seat={me} size="sm" />
              </button>
            ))}
          </div>
          {bidHint && (
            <div className="sk-bid" role="group" aria-label="پیشنهاد">
              {Array.from({ length: bidHint.max - bidHint.min + 1 }, (_, k) => bidHint.min + k).map((n) => (
                <button key={n} type="button" aria-pressed={chosenBid === n} className={['sk-n sk-num', chosenBid === n ? 'is-sel' : '', hint?.type === 'bid' && hint.n === n ? 'sk-hint' : ''].join(' ')} onClick={() => setBid(n)}>{fa(n)}</button>
              ))}
              <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'bid', n: chosenBid })}>پیشنهاد {fa(chosenBid)}</Button>
            </div>
          )}
          {canPass && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>کنار می‌کشم</Button></DockSlot>}
        </div>
      ) : null}
      {view.lostLast && lastLose && lastLose.seat === mySeat && <p className="sk__lost" role="status">یک {view.lostLast === 'skull' ? 'جمجمه' : 'گل'} از دست دادید (فقط شما می‌دانید).</p>}
    </div>
  );
}
