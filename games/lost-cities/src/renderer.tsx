// کاوشگران renderer: an explorer's map table. Five expedition columns — the rival's cards above, the discard piles on
// the map in the middle, yours below — each with its running score; the hand underneath. Tap a card, then "play" or
// "discard"; then draw from the deck or a pile.
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, DockSlot, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps } from '@bg/ui';
import cardsArt from './art/cards.webp';
import { terms } from './terms.ts';

const GC = import.meta.glob<string>('./art/gc/lost-cities-*.png', { eager: true, import: 'default' });
const gc = (n: string) => GC[`./art/gc/lost-cities-${n}.png`];
const SYM: Record<Color, string> = { y: gc('symbol-1')!, b: gc('symbol-2')!, w: gc('symbol-3')!, g: gc('symbol-4')!, r: gc('symbol-5')! };
import { COLORS, canPlay, color, expScore, value, type CardId, type Color, type LostCitiesView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const COLOR_FA: Record<Color, string> = { y: 'صحرا', b: 'دریا', w: 'ویرانه', g: 'جنگل', r: 'دره' };
/** cards.webp (BGA Lost Cities client art): 10 × 6 cells of 113 × 176 px, rows y b w g r, columns 2..10 then the wager; back at row 5. */
const ROW: Record<Color, number> = { y: 0, b: 1, w: 2, g: 3, r: 4 };
const art = (col: number, row: number) => ({ backgroundImage: `url(${cardsArt})`, backgroundPosition: `${(col / 9) * 100}% ${row * 19.977}%` });

function Glyph({ c }: { c: Color }) { return <image href={SYM[c]} x="-16" y="-16" width="32" height="32" />; }

export function Card({ id, size = 'md', back, flip, flipFrom, exit }: { id?: CardId; size?: 'sm' | 'md'; back?: boolean; flip?: string; flipFrom?: string; exit?: string }) {
  useTermsLang();
  if (back || !id) return <span className={`lc-card lc-card--${size} lc-card--back`} aria-hidden="true"><i className="lc-card__art" style={gc('back') ? { backgroundImage: `url(${gc('back')})`, backgroundSize: '100% 100%' } : art(0, 5)} /></span>;
  const c = color(id);
  const v = value(id);
  const face = gc(`${id}`);
  return (
    <span className={['lc-card', `lc-card--${size}`, `lc-c--${c}`, v ? '' : 'lc-card--wager'].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} aria-label={`${COLOR_FA[c]} ${v ? fa(v) : tx(terms.wager)}`}>
      <i className="lc-card__art" style={face ? { backgroundImage: `url(${face})`, backgroundSize: '100% 100%', backgroundPosition: 'center' } : art(v ? v - 2 : 9, ROW[c])} />
      <span className="lc-card__v">{v ? fa(v) : '×'}</span>
      {v ? <svg viewBox="-20 -20 40 40" aria-hidden="true" className="lc-card__g"><Glyph c={c} /></svg> : null}
      {size === 'md' && <span className="lc-card__n">{v ? COLOR_FA[c] : tx(terms.wager)}</span>}
    </span>
  );
}

export default function LostCitiesRenderer({ view: real, legalActions: realLegal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<LostCitiesView>) {
  useTermsLang(); // re-render when the terms language changes
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
    : placing ? { tone: 'mine' as const, text: sel ? `روی ${tx(terms.expedition)} ${tx(terms.playV)} یا ${tx(terms.discardV)}` : `یک ${tx(terms.card)} از ${tx(terms.handYour)} انتخاب کنید` }
      : draws.size ? { tone: 'mine' as const, text: `یک ${tx(terms.card)} ${tx(terms.drawV)}: از ${tx(terms.deck)} یا ${tx(terms.piles)}` }
        : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const last = view.last;
  const framed = useInFrame() !== null; // the shell draws seats, scores, whose-turn and the events log
  // Motion ids: a card keeps one id in every zone. The three identical wagers per colour get a copy number
  // (hand: by position; expedition: counted from the top so a played wager keeps the id of the hand copy it came from).
  const expId = (own: boolean, id: CardId, j: number) => (value(id) ? `c-${id}` : `${own ? 'c' : 'o'}-${id}.${2 - j}`);
  const handId = (hand: CardId[], i: number) => `c-${hand[i]}${value(hand[i]!) ? '' : `.${hand.slice(0, i).filter((x) => x === hand[i]).length}`}`;
  const lastSeat = last ? (last.seat === me ? 'hand-me' : 'seat-opp') : undefined;
  const fromPile = last?.kind === 'draw' && last.from !== 'deck' ? last.card : null;

  return (
    <div className="lc" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p><T t={terms.cardsEz} /> هر <T t={terms.expedition} /> باید از <T t={terms.card} /> قبلی بزرگ‌تر باشند و «<T t={terms.wager} />» فقط پیش از اولین عدد می‌آید. هر <T t={terms.expeditionEz} /> شروع‌شده ۲۰ امتیاز خرج دارد؛ هشت <T t={terms.card} /> در یک <T t={terms.expedition} /> ۲۰ امتیاز <T t={terms.bonus} /> دارد.</p>
        </RailSlot>
      )}
      {!framed && <p className="lc__score" data-flip-anchor="seat-opp">
        <T t={terms.round} /> {fa(view.round)} از {fa(view.rounds)}، <bdi>{who(opp)}</bdi> <b key={view.scores[opp]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(view.exp[opp]![c]), 0))} className="bg-pop">{fa(view.scores[opp]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(view.exp[opp]![c]), 0)))}</b>
        {' '}— شما <b key={view.scores[me]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(myExp[c]), 0))} className="bg-pop">{fa(view.scores[me]! + (view.outcome ? 0 : COLORS.reduce((a, c) => a + expScore(myExp[c]), 0)))}</b>
      </p>}

      <div className="lc__board" role="group" aria-label={tx(terms.expeditions)}>
        {COLORS.map((c) => {
          const top = view.discard[c].at(-1);
          const canDraw = draws.has(c) && !busy;
          return (
            <div key={c} className={`lc-col lc-c--${c}`}>
              <div className="lc-col__exp lc-col__exp--opp" aria-label={`${tx(terms.expedition)} ${COLOR_FA[c]} ${who(opp)}`}>
                {view.exp[opp]![c].length > 0 && <span className="lc-col__pts">{fa(expScore(view.exp[opp]![c]))}</span>}
                {view.exp[opp]![c].map((id, i) => <Card key={i} id={id} size="sm" flip={expId(false, id, i)} flipFrom="seat-opp" />)}
              </div>
              <button type="button" data-flip-anchor={`pile-${c}`} className={['lc-pile', canDraw ? 'lc-pile--can' : '', placing && sel && color(sel) === c ? 'lc-pile--target' : '', hint?.type === 'draw' && hint.from === c ? 'lc-hint' : ''].join(' ')}
                disabled={!(canDraw || (placing && sel && color(sel) === c)) || busy}
                onClick={() => (canDraw ? onAction({ type: 'draw', from: c }) : sel && onAction({ type: 'discard', card: sel }))}
                aria-label={canDraw ? `${tx(terms.drawN)} از ${tx(terms.pileEz)} ${COLOR_FA[c]}` : `${tx(terms.discardPileEz)} ${COLOR_FA[c]}`}>
                {!top && <svg viewBox="-20 -20 40 40" className="lc-pile__g" aria-hidden="true"><Glyph c={c} /></svg>}
                {top ? <Card id={top} key={top + view.discard[c].length} flip={value(top) ? `c-${top}` : `c-${top}.p${view.discard[c].length}`} flipFrom={lastSeat} exit="seat-opp" /> : <span className="lc-pile__name">{COLOR_FA[c]}</span>}
                {view.discard[c].length > 1 && <span className="lc-pile__n bg-pop" key={view.discard[c].length}>{fa(view.discard[c].length)}</span>}
              </button>
              <div className="lc-col__exp lc-col__exp--me" aria-label={`${tx(terms.expedition)} ${COLOR_FA[c]} شما`}>
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
            <Card back size="sm" /><span key={view.deckCount} className="bg-pop"><T t={terms.deck} />: {fa(view.deckCount)} <T t={terms.card} /></span>
          </button>
          {!framed && last && <span className="lc__last" key={view.seq}><bdi>{who(last.seat)}</bdi> {last.kind === 'play' ? `روی ${tx(terms.expedition)} گذاشت` : last.kind === 'discard' ? tx(terms.discardP) : last.from === 'deck' ? `از ${tx(terms.deck)} برداشت` : `از ${tx(terms.pileEz)} ${COLOR_FA[last.from as Color]} برداشت`}{last.card && last.kind !== 'draw' ? `: ${COLOR_FA[color(last.card)]} ${value(last.card) ? fa(value(last.card)) : tx(terms.wager)}` : ''}</span>}
        </div>
      )}

      {!framed && view.roundScores.length > 0 && (
        <table className="lc__rounds"><thead><tr><th scope="col"><T t={terms.round} /></th><th scope="col"><bdi>{who(me)}</bdi></th><th scope="col"><bdi>{who(opp)}</bdi></th></tr></thead>
          <tbody>{view.roundScores.map((r, i) => <tr key={i}><th scope="row">{fa(i + 1)}</th><td>{fa(r[me]!)}</td><td>{fa(r[opp]!)}</td></tr>)}</tbody></table>
      )}

      {view.hand && !view.outcome && (
        <section className="lc__me" aria-label={`${tx(terms.hand)} شما`}>
          <div className="lc__hand" data-flip-anchor="hand-me" role="group" aria-label={`${tx(terms.cardsEz)} ${tx(terms.hand)}`} style={{ '--n': view.hand.length } as CSSProperties}>
            {view.hand.map((id, i) => (
              <button key={`${id}-${i}`} type="button" aria-pressed={sel === id} disabled={!placing || busy}
                className={['lc-pick', sel === id ? 'lc-pick--on' : '', hint?.card === id && sel !== id ? 'lc-hint' : '', placing && !canPlay(myExp, id) ? 'lc-pick--dead' : ''].join(' ')}
                onClick={() => setSel(sel === id ? null : id)}><Card id={id} flip={handId(view.hand!, i)} flipFrom={fromPile === id ? `pile-${color(id)}` : 'deck'} /></button>
            ))}
          </div>
          {placing && sel && (() => {
            const btns = (
              <>
                <Button size="sm" disabled={busy || !canPlay(myExp, sel)} className={hint?.type === 'play' ? 'lc-hint' : ''} onClick={() => onAction({ type: 'play', card: sel })}>روی <T t={terms.expedition} /> {COLOR_FA[color(sel)]}</Button>
                <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'discard' ? 'lc-hint' : ''} onClick={() => onAction({ type: 'discard', card: sel })}><T t={terms.discardImp} /></Button>
              </>
            );
            return framed ? <DockSlot>{btns}</DockSlot> : <div className="lc__actions">{btns}</div>;
          })()}
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
