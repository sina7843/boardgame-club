// UNO renderer: opponents rail, felt table with draw/discard piles and active-colour halo, decision panels,
// own hand within thumb reach. Shows only the projection; other hands are counts, never cards.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, RailSlot, T, TurnIndicator, tx, useTermsLang, useFlip, useInFrame, type GameRendererProps, DockSlot } from '@bg/ui';
import { terms } from './terms.ts';
import { COLORS, type Card, type Color, type LogEntry, type UnoView } from './rules.ts';
import { CardBack, CardFace, cardLabel, COLOR_FA } from './cards.tsx';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
type Hint = { type: string; card?: unknown; seat?: unknown; needsColor?: unknown; color?: unknown };

function describe(e: LogEntry, name: (s: number) => string): string {
  switch (e.t) {
    case 'start': return `${tx(terms.hand)} ${fa(e.hand)} ${tx(terms.startedSemi)} ${tx(terms.topCard)}: ${cardLabel(e.top)}.`;
    case 'play': return `${name(e.seat)} ${cardLabel(e.card)} ${tx(terms.playedV)}${e.card.color ? '' : `${tx(terms.andColor)}${COLOR_FA[e.color]}${tx(terms.chosenEnd)}`}${e.uno ? `${tx(terms.andSaid)} «${tx(terms.uno)}!»` : ''}.`;
    case 'draw': {
      const why = { turn: '', d2: ' (+۲)', wd4: ' (+۴)', start: tx(terms.whyStart), penalty: tx(terms.whyPenalty), challenge: tx(terms.whyChallenge) }[e.reason];
      return e.n === 0 ? `${name(e.seat)} ${tx(terms.noDraw)}` : `${name(e.seat)} ${fa(e.n)} ${tx(terms.drewTail)}${why}.`;
    }
    case 'pass': return `${name(e.seat)} نوبتش را تمام کرد.`;
    case 'skip': return `${tx(terms.turnOf)} ${name(e.seat)} ${tx(terms.burnt)}`;
    case 'uno': return `${name(e.seat)} ${tx(terms.said)} «${tx(terms.uno)}!»`;
    case 'caught': return `${name(e.by)} ${name(e.seat)} ${tx(terms.caughtA)} «${tx(terms.uno)}» ${tx(terms.caughtB)} ${fa(e.n)} ${tx(terms.caughtC)}`;
    case 'challenge': return `${name(e.by)} ${tx(terms.challengeA)} ${name(e.seat)} ${tx(terms.challengeB)} ${e.guilty ? tx(terms.challengerRight) : tx(terms.playLegal)}.`;
    case 'color': return `${name(e.seat)}${tx(terms.chosenA)}${COLOR_FA[e.color]}${tx(terms.chosenEnd)}.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد.`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'handEnd': return `${name(e.winner)} ${tx(terms.handWon)} ${fa(e.points)} امتیاز گرفت.`;
  }
}

export default function UnoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<UnoView>) {
  useTermsLang();
  const hints = legalActions as Hint[];
  const myTurn = mySeat !== null && view.current === mySeat && !view.outcome;
  const playableIds = useMemo(() => new Set(hints.filter((h) => h.type === 'play').map((h) => h.card as string)), [hints]);
  const canDraw = hints.some((h) => h.type === 'draw');
  const catchSeat = hints.find((h) => h.type === 'catch')?.seat as number | undefined;
  const canCallUno = hints.some((h) => h.type === 'callUno');
  const [picked, setPicked] = useState<string | null>(null);
  const [unoArmed, setUnoArmed] = useState(false);
  // Undo-window preview: the card being played already leaves the hand and lies on the pile; undo brings it back.
  const pendingPlay = queued?.type === 'play' ? (view.myHand ?? []).find((c) => c.id === queued.card) ?? null : null;
  const hand = (view.myHand ?? []).filter((c) => c.id !== pendingPlay?.id);
  const selected = picked && playableIds.has(picked) ? hand.find((c) => c.id === picked) ?? null : null;
  const exp = expected as { type: string; card?: string; color?: Color; uno?: boolean } | null;

  // New turn / new state: drop stale selection and the UNO toggle.
  const turnSeat = view.current;
  useEffect(() => { setPicked(null); setUnoArmed(false); }, [turnSeat, view.phase, view.hand, hand.length]);

  const lastPlay = [...view.log].reverse().find((e) => e.t === 'play' || e.t === 'start');
  const lastPlaySeq = lastPlay?.seq ?? 0;
  const lastPlayer = lastPlay?.t === 'play' ? lastPlay.seat : null;
  // Cards glide: hand → discard, deck → hand, an opponent's play flies in from their seat.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.log.at(-1)?.seq ?? 0}|${pendingPlay?.id ?? ''}`);
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const play = (c: Card, color?: Color) => {
    if (busy) return;
    onAction({ type: 'play', card: c.id, ...(color ? { color } : {}), ...(unoArmed && hand.length === 2 ? { uno: true } : {}) });
    setPicked(null);
    setUnoArmed(false);
  };
  const tap = (c: Card) => {
    if (!playableIds.has(c.id) || busy) return;
    if (picked === c.id && c.color) play(c);
    else setPicked(c.id);
  };

  const others = Array.from({ length: view.players }, (_, s) => s).filter((s) => s !== mySeat);
  const colorClass = view.color ? `uno-table--${view.color}` : '';
  const needsUno = myTurn && hand.length === 2 && (view.phase === 'play' || view.phase === 'drawn');

  let status: { tone: 'mine' | 'wait' | 'done'; text: string } | null;
  if (view.outcome) status = null;
  else if (queued) status = { tone: 'wait', text: 'حرکت شما در حال ثبت است…' };
  else if (myTurn && view.phase === 'wd4') status = { tone: 'mine', text: `${seatName(view.wd4!.offender)} برای شما +۴ گذاشت؛ تصمیم بگیرید` };
  else if (myTurn && view.phase === 'chooseColor') status = { tone: 'mine', text: `${tx(terms.startCard)} «${tx(terms.wild)}» ${tx(terms.chooseColorSuffix)}` };
  else if (myTurn && view.phase === 'drawn') status = { tone: 'mine', text: tx(terms.drawnPlayable) };
  else if (myTurn) status = { tone: 'mine', text: playableIds.size ? tx(terms.yourTurnMatch) : tx(terms.noPlayable) };
  else status = { tone: 'wait', text: `نوبت ${seatName(view.current)}${view.phase === 'wd4' ? '، تصمیم درباره +۴' : ''}` };

  // Inside the shared table frame the shell draws the seat strip, scores, events and whose-turn; the hint goes to the rail's guide card.
  const framed = useInFrame() !== null;

  return (
    <div className={framed ? 'uno uno--framed' : 'uno'} ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>

      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p><T t={terms.railMatch} /> «<T t={terms.wild} />» و «+۴» <T t={terms.alwaysOk} />{view.color ? ` ${tx(terms.activeColor)} ${COLOR_FA[view.color]}.` : ''} {view.direction === 1 ? tx(terms.dirNormal) : tx(terms.dirReverse)}، <T t={terms.hand} /> {fa(view.hand)}{view.target ? `، ${tx(terms.target)} ${fa(view.target)} امتیاز` : ''}.</p>
        </RailSlot>
      )}
      {framed && catchSeat !== undefined && (
        <DockSlot><Button variant="danger" disabled={busy} onClick={() => onAction({ type: 'catch', seat: catchSeat })}>{tx(terms.uno)} {tx(terms.notSaid)} {tx(terms.catchV)}: {seatName(catchSeat)}</Button></DockSlot>
      )}

      {!framed && <div className="uno__meta">
        <span><T t={terms.hand} /> {fa(view.hand)}{view.target ? `، ${tx(terms.target)} ${fa(view.target)} امتیاز` : `، ${tx(terms.oneHand)}`}</span>
        {view.color && <span className={`uno-pill uno-pill--${view.color}`}><T t={terms.colorLbl} /> {COLOR_FA[view.color]}</span>}
        <span className="uno-dir" aria-label={tx(view.direction === 1 ? terms.dirAriaNormal : terms.dirAriaReverse)}>
          <span aria-hidden="true" className={view.direction === 1 ? 'uno-dir__icon' : 'uno-dir__icon uno-dir__icon--rev'}>↻</span>
          {view.direction === 1 ? tx(terms.dirNormal) : tx(terms.dirReverse)}
        </span>
      </div>}

      {!framed && <ul className="uno-rail" aria-label="بازیکنان دیگر">
        {others.map((s) => {
          const active = view.current === s && !view.outcome;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['uno-opp', active ? 'uno-opp--turn' : '', view.active[s] ? '' : 'uno-opp--out'].join(' ')}>
              <span className="uno-opp__fan" aria-hidden="true">
                {Array.from({ length: Math.min(view.handCounts[s] ?? 0, 5) }, (_, i) => <span key={i} className="uno-opp__back" style={{ ['--i' as string]: i }} />)}
              </span>
              <span className="uno-opp__body">
                <bdi className="uno-opp__name">{seatName(s)}</bdi>
                <span className="uno-opp__count">{view.active[s] ? `${fa(view.handCounts[s] ?? 0)} ${tx(terms.cards)}` : 'کنار رفته'}{view.target ? `، ${fa(view.scores[s] ?? 0)} امتیاز` : ''}</span>
              </span>
              {active && <span className="uno-badge">نوبت</span>}
              {view.called[s] && view.handCounts[s] === 1 && <span className="uno-badge uno-badge--uno">{tx(terms.uno)}!</span>}
              {catchSeat === s && <Button size="sm" variant="danger" disabled={busy} onClick={() => onAction({ type: 'catch', seat: s })}>{tx(terms.uno)} {tx(terms.notSaid)} {tx(terms.catchV)}</Button>}
            </li>
          );
        })}
      </ul>}

      <div className={`uno-table ${colorClass}`}>
        <button type="button" data-flip-anchor="deck" className="uno-pile uno-pile--draw" onClick={() => canDraw && !busy && onAction({ type: 'draw' })}
          aria-disabled={!canDraw || busy || undefined} aria-label={`${tx(terms.drawPileAria)}، ${fa(view.drawCount)} ${tx(terms.cards)}${canDraw ? `؛ ${tx(terms.drawACard)}` : ''}`}>
          <span className="uno-stack" aria-hidden="true"><span /><span /><span /></span>
          <CardBack size="lg" />
          <span className="uno-pile__count">{fa(view.drawCount)}</span>
          {canDraw && <span className="uno-pile__cta"><T t={terms.drawCta} /></span>}
        </button>
        <div className="uno-pile uno-pile--discard">
          <span className="uno-halo" aria-hidden="true" />
          <span className={view.direction === 1 ? 'uno-ring' : 'uno-ring uno-ring--rev'} aria-hidden="true">
            <svg viewBox="0 0 200 200" className="uno-ring__spin">
              <circle cx="100" cy="100" r="88" className="uno-ring__arc" strokeDasharray="226 51" />
              {[151, 331].map((a) => <polygon key={a} points="179,96 197,96 188,116" transform={`rotate(${a} 100 100)`} className="uno-ring__head" />)}
            </svg>
          </span>
          <span className="uno-under" aria-hidden="true"><span /><span /></span>
          {view.top && <span key={lastPlaySeq} className="uno-pile__top" style={{ ['--rot' as string]: `${((lastPlaySeq * 37) % 17) - 8}deg` }}><CardFace card={view.top} size="lg" flip={`c-${view.top.id}`} flipFrom={lastPlayer !== null && lastPlayer !== mySeat ? `seat-${lastPlayer}` : 'deck'} /></span>}
          {pendingPlay && <span className="uno-pile__top" style={{ ['--rot' as string]: '3deg' }}><CardFace card={pendingPlay} size="lg" flip={`c-${pendingPlay.id}`} /></span>}
          <span className="uno-pile__label">
            {/* Small direction mark instead of the big arc (QA round 3). */}
            <span className={view.direction === 1 ? 'uno-dir__icon' : 'uno-dir__icon uno-dir__icon--rev'} role="img" aria-label={tx(view.direction === 1 ? terms.dirAriaNormal : terms.dirAriaReverse)}>↻</span>
            {view.color ? `${tx(terms.activeColor)} ${COLOR_FA[view.color]}` : tx(terms.noColor)}
          </span>
        </div>
      </div>

      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {canCallUno && (
        <div className="uno-alert" role="alert">
          <span><T t={terms.lastA} /> «<T t={terms.uno} />» <T t={terms.lastB} /></span>
          <Button disabled={busy} onClick={() => onAction({ type: 'callUno' })}>{tx(terms.uno)}!</Button>
        </div>
      )}

      {view.reveal && (
        <section className="uno-panel" aria-labelledby="uno-reveal-h">
          <h3 id="uno-reveal-h"><T t={terms.hand} /> <bdi>{seatName(view.reveal.seat)}</bdi> <T t={terms.revealTail} /></h3>
          <div className="uno-mini">{view.reveal.cards.map((c) => <CardFace key={c.id} card={c} size="sm" />)}</div>
        </section>
      )}

      {myTurn && view.phase === 'wd4' && (
        <section className="uno-panel uno-panel--decide" aria-labelledby="uno-wd4-h">
          <h3 id="uno-wd4-h">+۴ از <bdi>{seatName(view.wd4!.offender)}</bdi></h3>
          <p><T t={terms.wd4Rule} /></p>
          <div className="row">
            <Button disabled={busy} onClick={() => onAction({ type: 'accept' })}><T t={terms.acceptDraw4} /></Button>
            <DockSlot><Button variant="secondary" disabled={busy} onClick={() => onAction({ type: 'challenge' })}><T t={terms.challenge} /></Button></DockSlot>
          </div>
        </section>
      )}

      {myTurn && view.phase === 'chooseColor' && <ColorPicker title={tx(terms.chooseStartColor)} busy={busy} onPick={(color) => onAction({ type: 'chooseColor', color })} />}

      {selected && !selected.color && (
        <ColorPicker title={`${cardLabel(selected)}: ${tx(terms.chooseNextColor)}`} busy={busy} hint={exp?.color} onPick={(color) => play(selected, color)} onCancel={() => setPicked(null)} />
      )}

      {view.myHand && !view.outcome && (
        <section className="uno-hand" aria-label={`${tx(terms.yourHand)}، ${fa(hand.length)} ${tx(terms.cards)}`}>
          <div className="uno-hand__bar">
            <strong><T t={terms.yourHand} /> ({fa(hand.length)})</strong>
            {needsUno && (
              <button type="button" className={unoArmed ? 'uno-call uno-call--on' : 'uno-call'} aria-pressed={unoArmed} onClick={() => setUnoArmed(!unoArmed)}>
                {unoArmed ? `✓ ${tx(terms.uno)}!` : `${tx(terms.uno)}!`}
              </button>
            )}
            {myTurn && view.phase === 'drawn' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'keep' })}><T t={terms.keepEnd} /></Button>}
            {selected?.color && <Button size="sm" disabled={busy} onClick={() => play(selected)}><T t={terms.play} /> {cardLabel(selected)}</Button>}
          </div>
          {needsUno && !unoArmed && <p className="uno-hand__tip">{tx(terms.tipA)}{tx(terms.uno)}{tx(terms.tipB)}</p>}
          <div className="uno-hand__cards" style={{ ['--n' as string]: hand.length }}>
            {hand.map((c) => {
              const ok = playableIds.has(c.id) && !busy;
              return (
                <CardFace key={c.id} card={c} onClick={() => tap(c)} disabled={!ok} flip={`c-${c.id}`} flipFrom="deck"
                  state={picked === c.id ? 'selected' : ok ? 'playable' : myTurn ? 'dim' : undefined}
                  hint={exp?.type === 'play' && exp.card === c.id} />
              );
            })}
          </div>
        </section>
      )}

      {!framed && view.target && (
        <details className="uno-scores">
          <summary>امتیازها</summary>
          <table className="table">
            <caption className="visually-hidden">امتیاز بازیکنان</caption>
            <thead><tr><th scope="col">بازیکن</th><th scope="col">امتیاز</th></tr></thead>
            <tbody>{Array.from({ length: view.players }, (_, s) => (
              <tr key={s}><th scope="row"><bdi>{seatName(s)}</bdi>{s === mySeat ? ' (شما)' : ''}</th><td className="num">{fa(view.scores[s] ?? 0)}</td></tr>
            ))}</tbody>
          </table>
        </details>
      )}

      {!framed && <details className="uno-log" open>
        <summary>رویدادها</summary>
        <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
      </details>}
    </div>
  );
}

function ColorPicker({ title, busy, onPick, onCancel, hint }: { title: string; busy: boolean; onPick: (c: Color) => void; onCancel?: () => void; hint?: Color }) {
  useTermsLang();
  return (
    <section className="uno-panel uno-panel--decide" aria-label={title}>
      <h3>{title}</h3>
      <div className="uno-colors">
        {COLORS.map((c) => (
          <button key={c} type="button" className={`uno-color uno-color--${c}${hint === c ? ' uno-color--hint' : ''}`} disabled={busy} onClick={() => onPick(c)}>
            {COLOR_FA[c]}
          </button>
        ))}
      </div>
      {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>انصراف</Button>}
    </section>
  );
}
