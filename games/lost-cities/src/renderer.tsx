// کاوشگران renderer: an explorer's map table. Five expedition columns — the rival's cards above, the discard piles on
// the map in the middle, yours below — each with its running score; the hand underneath. Tap a card, then "play" or
// "discard"; then draw from the deck or a pile.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { COLORS, canPlay, color, expScore, value, type CardId, type Color, type LostCitiesView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const COLOR_FA: Record<Color, string> = { y: 'صحرا', b: 'دریا', w: 'کوهستان', g: 'جنگل', r: 'آتشفشان' };

function Glyph({ c }: { c: Color }) {
  switch (c) {
    case 'y': return <path d="M-14 8 L-4 -6 L2 2 L8 -4 L16 8 Z M6 -12 a4 4 0 1 0 0.1 0" />;
    case 'b': return <path d="M-16 2 Q-12 -4 -8 2 T0 2 T8 2 T16 2 V6 Q12 0 8 6 T0 6 T-8 6 T-16 6 Z M-16 -6 Q-12 -12 -8 -6 T0 -6 T8 -6 T16 -6 V-2 Q12 -8 8 -2 T0 -2 T-8 -2 T-16 -2 Z" />;
    case 'w': return <path d="M-16 10 L-4 -10 L2 0 L6 -6 L16 10 Z" />;
    case 'g': return <path d="M0 -14 L10 0 H5 L12 10 H-12 L-5 0 H-10 Z" />;
    case 'r': return <path d="M-14 10 L-6 -4 H6 L14 10 Z M-4 -6 Q-8 -12 -2 -14 Q0 -20 4 -14 Q10 -12 4 -6 Z" />;
  }
}

export function Card({ id, size = 'md', back, flip, flipFrom, exit }: { id?: CardId; size?: 'sm' | 'md'; back?: boolean; flip?: string; flipFrom?: string; exit?: string }) {
  if (back || !id) return <span className={`lc-card lc-card--${size} lc-card--back`} aria-hidden="true" />;
  const c = color(id);
  const v = value(id);
  return (
    <span className={['lc-card', `lc-card--${size}`, `lc-c--${c}`, v ? '' : 'lc-card--wager'].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} aria-label={`${COLOR_FA[c]} ${v ? fa(v) : 'شرط'}`}>
      <span className="lc-card__v">{v ? fa(v) : '×'}</span>
      <svg viewBox="-20 -20 40 40" aria-hidden="true" className="lc-card__g">{v ? <Glyph c={c} /> : <path d="M-12 -2 Q-6 -10 0 -4 Q6 -10 12 -2 L4 8 Q0 12 -4 8 Z" />}</svg>
      {size === 'md' && <span className="lc-card__n">{v ? COLOR_FA[c] : 'شرط'}</span>}
    </span>
  );
}

export default function LostCitiesRenderer({ view: real, legalActions: realLegal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<LostCitiesView>) {
  const me = mySeat ?? 0;
  // Undo-window preview: a played / discarded card already lies on its expedition / pile, a card taken from a pile is
  // already in the hand. A deck draw is hidden information and waits for the server.
  const view = preview(real, me, queued as { type: string; card?: CardId; from?: string } | null | undefined);
  const legalActions = view === real ? realLegal : [];
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${view === real}`);
  const opp = 1 - me;
  const placing = legalActions.some((a) => a.type === 'discard');
  const draws = new Set(legalActions.filter((a) => a.type === 'draw').map((a) => a.from as string));
  const [sel, setSel] = useState<CardId | null>(null);
  useEffect(() => { setSel(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; card?: CardId; from?: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myExp = view.exp[me]!;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : placing ? { tone: 'mine' as const, text: sel ? 'روی سفر بگذارید یا دور بیندازید' : 'یک کارت از دستتان انتخاب کنید' }
      : draws.size ? { tone: 'mine' as const, text: 'یک کارت بردارید: از دسته یا کپه‌ها' }
        : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const last = view.last;
  // Motion ids: a card keeps one id in every zone. The three identical wagers per colour get a copy number
  // (hand: by position; expedition: counted from the top so a played wager keeps the id of the hand copy it came from).
  const expId = (own: boolean, id: CardId, j: number) => (value(id) ? `c-${id}` : `${own ? 'c' : 'o'}-${id}.${2 - j}`);
  const handId = (hand: CardId[], i: number) => `c-${hand[i]}${value(hand[i]!) ? '' : `.${hand.slice(0, i).filter((x) => x === hand[i]).length}`}`;
  const lastSeat = last ? (last.seat === me ? 'hand-me' : 'seat-opp') : undefined;
  const fromPile = last?.kind === 'draw' && last.from !== 'deck' ? last.card : null;

  return (
    <div className="lc" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="lc__score" data-flip-anchor="seat-opp">
        دست {fa(view.round)} از {fa(view.rounds)}، <bdi>{who(opp)}</bdi> <b key={view.scores[opp]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(view.exp[opp]![c]), 0))} className="bg-pop">{fa(view.scores[opp]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(view.exp[opp]![c]), 0)))}</b>
        {' '}— شما <b key={view.scores[me]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(myExp[c]), 0))} className="bg-pop">{fa(view.scores[me]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(myExp[c]), 0)))}</b>
      </p>

      <div className="lc__board" role="group" aria-label="سفرها">
        {COLORS.map((c) => {
          const top = view.discard[c].at(-1);
          const canDraw = draws.has(c) && !busy;
          return (
            <div key={c} className={`lc-col lc-c--${c}`}>
              <div className="lc-col__exp lc-col__exp--opp" aria-label={`سفر ${COLOR_FA[c]} ${who(opp)}`}>
                {view.exp[opp]![c].length > 0 && <span className="lc-col__pts">{fa(expScore(view.exp[opp]![c]))}</span>}
                {view.exp[opp]![c].map((id, i) => <Card key={i} id={id} size="sm" flip={expId(false, id, i)} flipFrom="seat-opp" />)}
              </div>
              <button type="button" data-flip-anchor={`pile-${c}`} className={['lc-pile', canDraw ? 'lc-pile--can' : '', placing && sel && color(sel) === c ? 'lc-pile--target' : '', hint?.type === 'draw' && hint.from === c ? 'lc-hint' : ''].join(' ')}
                disabled={!(canDraw || (placing && sel && color(sel) === c)) || busy}
                onClick={() => (canDraw ? onAction({ type: 'draw', from: c }) : sel && onAction({ type: 'discard', card: sel }))}
                aria-label={canDraw ? `برداشتن از کپهٔ ${COLOR_FA[c]}` : `کپهٔ دور ریختهٔ ${COLOR_FA[c]}`}>
                <svg viewBox="-20 -20 40 40" className="lc-pile__g" aria-hidden="true"><Glyph c={c} /></svg>
                {top ? <Card id={top} size="sm" key={top + view.discard[c].length} flip={value(top) ? `c-${top}` : `c-${top}.p${view.discard[c].length}`} flipFrom={lastSeat} exit="seat-opp" /> : <span className="lc-pile__name">{COLOR_FA[c]}</span>}
                {view.discard[c].length > 1 && <span className="lc-pile__n bg-pop" key={view.discard[c].length}>{fa(view.discard[c].length)}</span>}
              </button>
              <div className="lc-col__exp lc-col__exp--me" aria-label={`سفر ${COLOR_FA[c]} شما`}>
                {myExp[c].map((id, i) => <Card key={i} id={id} size="sm" flip={expId(true, id, i)} flipFrom="hand-me" />)}
                {myExp[c].length > 0 && <span className="lc-col__pts">{fa(expScore(myExp[c]))}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!view.outcome && (
        <div className="lc__deckrow">
          <button type="button" data-flip-anchor="deck" className={['lc-deck', draws.has('deck') ? 'lc-deck--can' : '', hint?.type === 'draw' && hint.from === 'deck' ? 'lc-hint' : ''].join(' ')}
            disabled={!draws.has('deck') || busy} onClick={() => onAction({ type: 'draw', from: 'deck' })}>
            <Card back size="sm" /><span key={view.deckCount} className="bg-pop">دسته: {fa(view.deckCount)} کارت</span>
          </button>
          {last && <span className="lc__last" key={view.seq}><bdi>{who(last.seat)}</bdi> {last.kind === 'play' ? 'روی سفر گذاشت' : last.kind === 'discard' ? 'دور انداخت' : last.from === 'deck' ? 'از دسته برداشت' : `از کپهٔ ${COLOR_FA[last.from as Color]} برداشت`}{last.card && last.kind !== 'draw' ? `: ${COLOR_FA[color(last.card)]} ${value(last.card) ? fa(value(last.card)) : 'شرط'}` : ''}</span>}
        </div>
      )}

      {view.roundScores.length > 0 && (
        <table className="lc__rounds"><thead><tr><th scope="col">دست</th><th scope="col"><bdi>{who(me)}</bdi></th><th scope="col"><bdi>{who(opp)}</bdi></th></tr></thead>
          <tbody>{view.roundScores.map((r, i) => <tr key={i}><th scope="row">{fa(i + 1)}</th><td>{fa(r[me]!)}</td><td>{fa(r[opp]!)}</td></tr>)}</tbody></table>
      )}

      {view.hand && !view.outcome && (
        <section className="lc__me" aria-label="دست شما">
          <div className="lc__hand" data-flip-anchor="hand-me" role="group" aria-label="کارت‌های دست">
            {view.hand.map((id, i) => (
              <button key={`${id}-${i}`} type="button" aria-pressed={sel === id} disabled={!placing || busy}
                className={['lc-pick', sel === id ? 'lc-pick--on' : '', hint?.card === id && sel !== id ? 'lc-hint' : '', placing && !canPlay(myExp, id) ? 'lc-pick--dead' : ''].join(' ')}
                onClick={() => setSel(sel === id ? null : id)}><Card id={id} flip={handId(view.hand!, i)} flipFrom={fromPile === id ? `pile-${color(id)}` : 'deck'} /></button>
            ))}
          </div>
          {placing && sel && (
            <div className="lc__actions">
              <Button size="sm" disabled={busy || !canPlay(myExp, sel)} className={hint?.type === 'play' ? 'lc-hint' : ''} onClick={() => onAction({ type: 'play', card: sel })}>روی سفر {COLOR_FA[color(sel)]}</Button>
              <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'discard' ? 'lc-hint' : ''} onClick={() => onAction({ type: 'discard', card: sel })}>دور بینداز</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function preview(v: LostCitiesView, me: number, q: { type: string; card?: CardId; from?: string } | null | undefined): LostCitiesView {
  if (!q || !v.hand) return v;
  const without = (h: CardId[], c: CardId) => { const i = h.indexOf(c); return h.slice(0, i).concat(h.slice(i + 1)); };
  if ((q.type === 'play' || q.type === 'discard') && q.card && v.hand.includes(q.card)) {
    const c = color(q.card), hand = without(v.hand, q.card);
    return q.type === 'play'
      ? { ...v, hand, exp: v.exp.map((e, k) => (k === me ? { ...e, [c]: [...e[c], q.card!] } : e)) }
      : { ...v, hand, discard: { ...v.discard, [c]: [...v.discard[c], q.card] } };
  }
  if (q.type === 'draw' && q.from && q.from !== 'deck') {
    const pile = v.discard[q.from as Color], top = pile.at(-1);
    if (top) return { ...v, hand: [...v.hand, top], discard: { ...v.discard, [q.from]: pile.slice(0, -1) } };
  }
  return v;
}
