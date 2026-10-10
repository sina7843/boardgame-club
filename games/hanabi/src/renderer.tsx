// آتش‌بازی renderer: a night sky. Five firework stacks burst as they grow; clue tokens and fuses glow at the top;
// teammates' cards are visible with the clues they hold; your own cards show only what you have been told. Tap a
// teammate's card to give a colour or number clue, or one of your cards to play or discard it.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import fwR from './art/fw-red.webp';
import fwY from './art/fw-yellow.webp';
import fwG from './art/fw-green.webp';
import fwB from './art/fw-blue.webp';
import fwW from './art/fw-white.webp';
import fuse from './art/fuse.webp';
import clue from './art/clue.webp';
import { CARDS, COLORS, type Color, type HanabiView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
// Art is cut from a generated sprite sheet (see DECISIONS.md).
const BURST: Record<Color, string> = { r: fwR, y: fwY, g: fwG, b: fwB, w: fwW };
export const COLOR_FA: Record<Color, string> = { r: 'قرمز', y: 'زرد', g: 'سبز', b: 'آبی', w: 'سفید' };

export function Firework({ c, n, size = 'md' }: { c: Color; n: number | null; size?: 'sm' | 'md' }) {
  return (
    <span className={`hb-card hb-card--${size} hb-c--${c}`} aria-label={`${COLOR_FA[c]} ${n ? fa(n) : ''}`}>
      <img src={BURST[c]} alt="" aria-hidden="true" />
      {n !== null && <b>{fa(n)}</b>}
    </span>
  );
}

export default function HanabiRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction: send, expected, queued }: GameRendererProps<HanabiView>) {
  const me = mySeat ?? -1;
  // My card being played or discarded (undo window, or sent and not answered yet) leaves my hand face down at once;
  // whether it fits a firework is only known from the server's answer. Undo brings it back.
  const [asked, setAsked] = useState<{ index: number; seq: number } | null>(null);
  const lastIdx = useRef<number | null>(null);
  useEffect(() => { if (!busy) setAsked(null); }, [busy]);
  const pendingIdx = queued?.type === 'play' || queued?.type === 'discard' ? queued.index as number
    : busy && asked?.seq === served.seq ? asked.index : null;
  const onAction = (a: GameAction) => {
    if (a.type === 'play' || a.type === 'discard') setAsked({ index: a.index as number, seq: served.seq });
    setMine(null); setTarget(null);
    send(a);
  };
  // A clue is fully known (I see the teammate's cards): preview it — a clue token spent, the touched cards marked.
  const view: HanabiView = (() => {
    if (queued?.type !== 'clue' || me < 0) return served;
    const hand = served.hands[queued.to as number] ?? [];
    const touched = hand.flatMap((h, i) => (h.card && (queued.color ? h.card.c === queued.color : h.card.r === queued.rank) ? [i] : []));
    return { ...served, clues: served.clues - 1, last: { seat: me, kind: 'clue', to: queued.to as number, ...(queued.color ? { color: queued.color as Color } : { rank: queued.rank as number }), touched } };
  })();
  // My own cards carry no id in the view: keep a local id per slot. A played/discarded slot drops out and the refill
  // is a new card at the end (it flies in from the deck); the others keep their ids, so they slide along.
  const ids = useRef<{ seq: number; list: string[]; n: number } | null>(null);
  const myLen = me >= 0 ? served.hands[me]?.length ?? 0 : 0;
  if (!ids.current) ids.current = { seq: served.seq, list: Array.from({ length: myLen }, (_, i) => `m${i}`), n: myLen };
  else if (ids.current.seq !== served.seq) {
    const r = ids.current;
    const list = r.list.slice();
    if (served.last?.seat === me && served.last.kind !== 'clue') { list.splice(lastIdx.current ?? 0, 1); lastIdx.current = null; }
    while (list.length < myLen) list.push(`m${r.n++}`);
    list.length = Math.min(list.length, myLen);
    ids.current = { seq: served.seq, list, n: r.n };
  }
  const myIds = ids.current.list;
  if (pendingIdx !== null) lastIdx.current = pendingIdx;
  const canPlay = legalActions.some((a) => a.type === 'play');
  const canDiscard = legalActions.some((a) => a.type === 'discard');
  const canClue = legalActions.some((a) => a.type === 'clue');
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}|${pendingIdx ?? ''}`);
  const cluePop = usePop(view.clues);
  const [mine, setMine] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => { setMine(null); setTarget(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; to?: number; rank?: number; color?: Color; index?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = canPlay;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: view.finalLeft !== null ? `دسته تمام شد: ${fa(view.finalLeft)} نوبت مانده` : 'سرنخ بدهید، کارت بازی کنید یا دور بیندازید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const last = view.last;
  // My played card was waiting face down in the pending spot: it is revealed from there.
  const lastFrom = last ? (last.seat === me ? 'pending' : `seat-${last.seat}`) : undefined;
  const others = view.hands.map((_, k) => k).filter((k) => k !== me);
  const tHand = target !== null ? view.hands[target]! : [];
  const clueColors = COLORS.filter((c) => tHand.some((h) => h.card?.c === c));
  const clueRanks = [1, 2, 3, 4, 5].filter((r) => tHand.some((h) => h.card?.r === r));

  return (
    <div className="hb" ref={root} data-seq={served.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="hb__sky" aria-label="آتش‌بازی‌ها">
        <div className="hb__tokens">
          <span className={`hb__clues ${cluePop}`} key={`c${view.clues}`} aria-label={`${fa(view.clues)} ژتون سرنخ`}>{Array.from({ length: 8 }, (_, i) => <img key={i} src={clue} alt="" className={i < view.clues ? 'on' : ''} />)}</span>
          <span className={last?.kind === 'play' && !last.ok ? 'hb__fuses bg-hit' : 'hb__fuses'} key={`f${view.fuses}`} aria-label={`${fa(view.fuses)} فیوز`}>{Array.from({ length: 3 }, (_, i) => <img key={i} src={fuse} alt="" className={i < view.fuses ? 'on' : ''} />)}</span>
          <span data-flip-anchor="deck">دسته: <b key={view.deckCount} className="bg-pop">{fa(view.deckCount)}</b></span>
          <span className="hb__pending" data-flip-anchor="pending">
            {pendingIdx !== null && myIds[pendingIdx] && <span data-flip={myIds[pendingIdx]} className="hb-mine hb-mine--pending" aria-label="کارت شما در راه"><span className="hb-mine__face">?</span></span>}
          </span>
          <span className="hb__score">امتیاز <b key={view.score} className="bg-pop">{fa(view.score)}</b> از ۲۵</span>
        </div>
        <div className="hb__stacks">
          {COLORS.map((c) => (
            <span key={c} className={`hb-stack hb-c--${c} ${view.stacks[c] ? 'hb-stack--lit' : ''}`}>
              <img className="hb-stack__burst" key={view.stacks[c]} src={BURST[c]} alt="" aria-hidden="true" />
              <b key={view.stacks[c]} className="bg-pop" data-flip={last?.kind === 'play' && last.ok && CARDS[last.card!]!.c === c ? `c-${last.card}` : undefined} data-flip-from={lastFrom}>{view.stacks[c] ? fa(view.stacks[c]) : '–'}</b>
              <small>{COLOR_FA[c]}</small>
            </span>
          ))}
        </div>
        {last && (
          <p className="hb__last" role="status" key={view.seq}>
            <bdi>{who(last.seat)}</bdi>{' '}
            {last.kind === 'clue' ? <>به <bdi>{who(last.to!)}</bdi> سرنخ داد: «{last.color ? COLOR_FA[last.color] : fa(last.rank!)}»</>
              : last.kind === 'discard' ? 'یک کارت دور انداخت' : last.ok ? 'یک کارت درست بازی کرد ✨' : 'کارت اشتباه بازی کرد و یک فیوز سوخت'}
          </p>
        )}
      </section>

      <ul className="hb__team" aria-label="هم‌تیمی‌ها">
        {others.map((k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={['hb-mate', view.current === k && !view.outcome ? 'hb-mate--turn' : '', target === k ? 'hb-mate--on' : ''].join(' ')}>
            <div className="hb-mate__head">
              <bdi className="hb-mate__name">{who(k)}</bdi>
              {canClue && !busy && <button type="button" className={`hb-clueBtn ${hint?.type === 'clue' && hint.to === k && target !== k ? 'hb-hint' : ''}`} onClick={() => { setTarget(target === k ? null : k); setMine(null); }}>سرنخ بده</button>}
            </div>
            <div className="hb-mate__hand">
              {view.hands[k]!.map((h, i) => (
                <span key={h.id} data-flip={`c-${h.id}`} data-flip-from="deck" className={`hb-slot ${last?.kind === 'clue' && last.to === k && last.touched?.includes(i) ? 'hb-slot--touched' : ''}`}>
                  {h.card ? <Firework c={h.card.c} n={h.card.r} /> : null}
                  <small className="hb-know">{h.color ? COLOR_FA[h.color] : ''}{h.rank ? ` ${fa(h.rank)}` : ''}</small>
                </span>
              ))}
            </div>
            {target === k && (
              <div className="hb-clues" role="group" aria-label="سرنخ">
                {clueColors.map((c) => <button key={c} type="button" className={`hb-cl hb-c--${c} ${hint?.color === c ? 'hb-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'clue', to: k, color: c })}>{COLOR_FA[c]}</button>)}
                {clueRanks.map((r) => <button key={r} type="button" className={`hb-cl hb-cl--n ${hint?.rank === r ? 'hb-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'clue', to: k, rank: r })}>{fa(r)}</button>)}
              </div>
            )}
          </li>
        ))}
      </ul>

      {me >= 0 && !view.outcome && (
        <section className="hb__me" data-flip-anchor="hand-me" aria-label="کارت‌های شما">
          <div className="hb__hand">
            {view.hands[me]!.map((h, i) => (i === pendingIdx ? null :
              <button key={myIds[i] ?? i} type="button" data-flip={myIds[i]} data-flip-from="deck" className={['hb-mine', mine === i ? 'hb-mine--on' : '', h.color ? `hb-c--${h.color}` : '', hint?.type === 'play' && hint.index === i && mine !== i ? 'hb-hint' : ''].join(' ')}
                disabled={!myTurn || busy} aria-pressed={mine === i} onClick={() => { setMine(mine === i ? null : i); setTarget(null); }} aria-label={`کارت ${fa(i + 1)} شما`}>
                <span className="hb-mine__face">{h.rank ? fa(h.rank) : '?'}</span>
                <small>{h.color ? COLOR_FA[h.color] : 'رنگ؟'}</small>
                {(h.notColors.length > 0 || h.notRanks.length > 0) && <small className="hb-mine__not">نه: {[...h.notColors.map((c) => COLOR_FA[c]), ...h.notRanks.map(fa)].join('، ')}</small>}
              </button>
            ))}
          </div>
          {mine !== null && (
            <div className="hb__bar">
              <Button size="sm" disabled={busy} className={hint?.type === 'play' ? 'hb-hint' : ''} onClick={() => onAction({ type: 'play', index: mine })}>بازی</Button>
              <Button size="sm" variant="secondary" disabled={busy || !canDiscard} onClick={() => onAction({ type: 'discard', index: mine })}>دور انداختن</Button>
            </div>
          )}
        </section>
      )}

      {view.outcome && (
        <div className="hb__final">{view.hands.map((h, k) => <div key={k} className="hb__finalHand"><bdi>{who(k)}</bdi>{h.map((x, i) => x.card ? <Firework key={i} c={x.card.c} n={x.card.r} size="sm" /> : null)}</div>)}</div>
      )}
      {view.discard.length > 0 && <div className="hb__discard" aria-label="دورریخته‌ها"><small>دورریخته:</small>{view.discard.map((id) => <span key={id} data-flip={`c-${id}`} data-flip-from={last?.card === id ? lastFrom : 'deck'} className="hb-dc"><Firework c={CARDS[id]!.c} n={CARDS[id]!.r} size="sm" /></span>)}</div>}
    </div>
  );
}
