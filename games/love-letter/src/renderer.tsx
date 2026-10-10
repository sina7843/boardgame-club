// نامه عاشقانه renderer: parchment cards with a wax seal and a drawn emblem per role; opponents with their tokens,
// protection and discards; your two cards — tap one, then (if needed) a target and, for the Guard, a guess.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import guard from './art/ll-guard.webp';
import priest from './art/ll-priest.webp';
import baron from './art/ll-baron.webp';
import handmaid from './art/ll-handmaid.webp';
import prince from './art/ll-prince.webp';
import king from './art/ll-king.webp';
import countess from './art/ll-countess.webp';
import princess from './art/ll-princess.webp';
import { CARD_FA, type LogEntry, type LoveLetterView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const EFFECT_FA: Record<number, string> = {
  1: 'کارت یک نفر را حدس بزنید', 2: 'دست یک نفر را ببینید', 3: 'دست‌ها را مقایسه کنید', 4: 'تا نوبت بعد در امانید',
  5: 'یک نفر کارتش را عوض کند', 6: 'دست‌تان را عوض کنید', 7: 'با شاه یا شاهزاده باید بازی شود', 8: 'دور بیندازید، می‌بازید'
};

// Portraits are cut from a generated sheet (see DECISIONS.md); decorative, the card name and value stay as text.
const ART: Record<number, string> = { 1: guard, 2: priest, 3: baron, 4: handmaid, 5: prince, 6: king, 7: countess, 8: princess };

function LLCard({ v, size = 'md', onClick, selected, hint, disabled, flip, flipFrom }: { flip?: string; flipFrom?: string; v: number; size?: 'sm' | 'md'; onClick?: () => void; selected?: boolean; hint?: boolean; disabled?: boolean }) {
  const body = (
    <>
      <span className="ll-card__v">{fa(v)}</span>
      <img className="ll-card__art" src={ART[v] ?? princess} alt="" aria-hidden="true" />
      <strong className="ll-card__name">{CARD_FA[v]}</strong>
      {size === 'md' && <small className="ll-card__fx">{EFFECT_FA[v]}</small>}
      <span className="ll-card__seal" aria-hidden="true" />
    </>
  );
  const cls = ['ll-card', `ll-card--${size}`, `ll-card--v${v}`, selected ? 'll-card--sel' : '', hint ? 'll-card--hint' : ''].join(' ');
  return onClick
    ? <button type="button" className={cls} data-flip={flip} data-flip-from={flipFrom} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={`${CARD_FA[v]} (${fa(v)}): ${EFFECT_FA[v]}`}>{body}</button>
    : <span className={cls} data-flip={flip} data-flip-from={flipFrom} aria-label={`${CARD_FA[v]} (${fa(v)})`}>{body}</span>;
}

/** Hand card id: round, value and which copy of that value it is in the hand. */
const handId = (round: number, hand: number[], k: number) => `h-${round}-${hand[k]}-${hand.slice(0, k).filter((x) => x === hand[k]).length}`;

export default function LoveLetterRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<LoveLetterView>) {
  const me = mySeat ?? -1;
  // Undo-window preview: the card I play leaves my hand for my discard pile at once (its effect waits for the server).
  // The discarded copy keeps the hand card's id, so it flies there, flies back on undo, and stays put once confirmed.
  const alias = useRef<{ round: number; map: Map<string, { id: string; v: number }> }>({ round: served.round, map: new Map() });
  if (alias.current.round !== served.round) alias.current = { round: served.round, map: new Map() };
  const view: LoveLetterView = (() => {
    if (queued?.type !== 'play' || !served.hand || me < 0) return served;
    const k = served.hand.lastIndexOf(queued.card as number);
    if (k < 0) return served;
    alias.current.map.set(`d-${served.round}-${me}-${served.discards[me]!.length}`, { id: handId(served.round, served.hand, k), v: served.hand[k]! });
    return { ...served, hand: served.hand.filter((_, i) => i !== k), discards: served.discards.map((d, s) => (s === me ? [...d, served.hand![k]!] : d)) };
  })();
  const handIds = view.hand ? view.hand.map((_, k) => handId(view.round, view.hand!, k)) : [];
  const discardId = (s: number, k: number) => {
    const id = `d-${view.round}-${s}-${k}`, a = s === me ? alias.current.map.get(id) : undefined;
    return a && a.v === view.discards[s]![k] && !handIds.includes(a.id) ? a.id : id;
  };
  const plays = legalActions.filter((a) => a.type === 'play') as unknown as { card: number; targets: number[] }[];
  const myTurn = plays.length > 0;
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const lastSeq = served.log.at(-1)?.seq ?? 0;
  useEffect(() => { setCard(null); setTarget(null); }, [lastSeq, view.round]);
  const hint = expected?.type === 'play' ? (expected as unknown as { card: number; target?: number; guess?: number }) : null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${lastSeq}|${queued ? JSON.stringify(queued) : ''}`);
  const lastEnd = view.log.at(-1);
  const knocked = lastEnd?.t === 'out' ? lastEnd.seat : -1;
  const chosen = plays.find((p) => p.card === card);

  const send = (c: number, t?: number, g?: number) => {
    onAction({ type: 'play', card: c, ...(t !== undefined ? { target: t } : {}), ...(g !== undefined ? { guess: g } : {}) });
    setCard(null); setTarget(null);
  };
  const pickCard = (c: number) => {
    const opt = plays.find((p) => p.card === c)!;
    if (!opt.targets.length) return send(c); // no target needed (or nobody can be targeted)
    setCard(c); setTarget(null);
  };
  const pickTarget = (t: number) => { if (card === 1) setTarget(t); else send(card!, t); };

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: card === null ? 'یک کارت را بازی کنید' : target === null ? 'هدف را انتخاب کنید' : 'کارت او را حدس بزنید' }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : seatName(view.current)}` };

  const describe = (e: LogEntry) => {
    if (e.t === 'play') {
      const base = `${who(e.seat)} «${CARD_FA[e.card]}» بازی کرد${e.target !== null ? ` روی ${who(e.target)}` : ''}`;
      if (e.card === 1 && e.guess) return `${base} و «${CARD_FA[e.guess]}» گفت — ${e.result === 'out' ? 'درست بود!' : 'اشتباه بود'}`;
      if (e.result === 'tie') return `${base}: مساوی`;
      return base;
    }
    if (e.t === 'out') return `${who(e.seat)} با «${CARD_FA[e.card]}» از دور بیرون رفت`;
    if (e.t === 'round') return `دور ${fa(e.round)} را ${e.winners.map(who).join(' و ')} برد`;
    if (e.t === 'timeout') return `زمان ${who(e.seat)} تمام شد`;
    return `${who(e.seat)} کنار رفت`;
  };

  return (
    <div className="ll" ref={root} data-seq={lastSeq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="ll__players" aria-label="بازیکنان">
        {view.tokens.map((t, s) => {
          const targetable = card !== null && chosen?.targets.includes(s) && target === null;
          return (
            <li key={s} data-flip-anchor={s === mySeat ? 'hand' : `seat-${s}`} className={['ll-pl', s === knocked ? 'bg-hit' : '', s === view.current && !view.outcome ? 'll-pl--turn' : '', view.inRound[s] ? '' : 'll-pl--out', s === mySeat ? 'll-pl--me' : ''].join(' ')}>
              <div className="ll-pl__head">
                <bdi className="ll-pl__name">{who(s)}</bdi>
                {view.protectedSeats[s] && <span className="ll-pl__shield" title="در امان">🛡</span>}
                {!view.inRound[s] && view.active[s] && <span className="ll-pl__state">بیرون از دور</span>}
                <span className="ll-pl__tokens" aria-label={`${fa(t)} نشان از ${fa(view.goal)}`}>
                  {Array.from({ length: view.goal }, (_, k) => <i key={`${k}-${k < t}`} className={k < t ? 'on bg-pop' : ''} />)}
                </span>
              </div>
              <div className="ll-pl__discards">{view.discards[s]!.map((c, k) => <LLCard key={k} v={c} size="sm" flip={discardId(s, k)} flipFrom={s === mySeat ? 'hand' : `seat-${s}`} />)}</div>
              {targetable && (
                <Button size="sm" className={hint?.target === s ? 'll-target--hint' : ''} disabled={busy} onClick={() => pickTarget(s)}>
                  {card === 5 && s === mySeat ? 'خودم' : `انتخاب ${who(s)}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="ll__table">
        <div className="ll-deck" data-flip-anchor="deck" aria-label={`${fa(view.deckCount)} کارت در دسته`}>
          <span className="ll-deck__back" /><span className="ll-deck__n">{fa(view.deckCount)}</span>
        </div>
        {view.faceUp.length > 0 && <div className="ll__faceup" aria-label="کارت‌های رو کنار گذاشته">{view.faceUp.map((c, k) => <LLCard key={k} v={c} size="sm" flip={`f-${view.round}-${k}`} flipFrom="deck" />)}</div>}
      </div>

      {view.seen && (
        <p key={view.seen.seq} className="ll__seen" role="status">
          فقط شما می‌بینید: کارت <bdi>{who(view.seen.seat)}</bdi> «{CARD_FA[view.seen.card]}» است.
        </p>
      )}

      {card === 1 && target !== null && (
        <div className="ll__guess" role="group" aria-label="حدس کارت">
          {[2, 3, 4, 5, 6, 7, 8].map((g) => (
            <button key={g} type="button" className={hint?.guess === g ? 'll-guess ll-guess--hint' : 'll-guess'} disabled={busy} onClick={() => send(1, target, g)}>
              {fa(g)} {CARD_FA[g]}
            </button>
          ))}
        </div>
      )}

      {view.hand && view.inRound[mySeat ?? 0] && !view.outcome && (
        <div className="ll__hand" data-flip-anchor="hand" role="group" aria-label="دست شما">
          {view.hand.map((c, k) => (
            <LLCard key={handIds[k]} flip={handIds[k]} flipFrom="deck" v={c} onClick={myTurn && plays.some((p) => p.card === c) && !busy ? () => pickCard(c) : undefined}
              selected={card === c} hint={hint?.card === c && card === null} />
          ))}
          {card !== null && <Button size="sm" variant="ghost" onClick={() => { setCard(null); setTarget(null); }}>انتخاب دوباره</Button>}
        </div>
      )}

      <ol className="ll__log" aria-label="رویدادها">{view.log.slice(-4).map((e) => <li key={e.seq}>{describe(e)}</li>)}</ol>
    </div>
  );
}
