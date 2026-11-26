// هم‌فکر renderer: a quiet night table. The pile's top card glows in the middle, lives and throwing stars sit above,
// teammates show only how many cards they still hold; your cards are at the bottom with one big "play" button.
import './renderer.css';
import { useRef, type ReactNode } from 'react';
import { DockSlot, RailSlot, T, TurnIndicator, tx, useTermsLang, useFlip, useInFrame, type GameRendererProps } from '@bg/ui';
import cardBack from './art/the-mind-back.png';
import blank from './art/the-mind-blank.png';
import lifeOn from './art/the-mind-life-active.png';
import lifeOff from './art/the-mind-life-inactive.png';
import starOn from './art/the-mind-star-active.png';
import starOff from './art/the-mind-star-inactive.png';
import { terms } from './terms.ts';
import type { TheMindView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');

const Heart = ({ on }: { on: boolean }) => <img src={on ? lifeOn : lifeOff} alt="" className="tmd-ico" aria-hidden="true" />;
const Star = ({ on }: { on: boolean }) => <img src={on ? starOn : starOff} alt="" className="tmd-ico" aria-hidden="true" />;

/** A card: the delivered blank card with the number as text (four corners and the middle). */
export function Num({ n, size = 'md', flip, flipFrom, exit }: { n: number; size?: 'sm' | 'md' | 'lg'; flip?: string; flipFrom?: string; exit?: string }) {
  const t = fa(n);
  return (
    <span className={['tmd-card', `tmd-card--${size}`].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} role="img" aria-label={t}>
      <img src={blank} alt="" draggable={false} />
      <b>{t}</b>
      {['a', 'b', 'c', 'd'].map((k) => <i key={k} className={`tmd-k tmd-k--${k}`}>{t}</i>)}
    </span>
  );
}

function Acts({ framed, children }: { framed: boolean; children: ReactNode }) {
  return framed ? <DockSlot><div className="tmd__actions">{children}</div></DockSlot> : <div className="tmd__actions">{children}</div>;
}

export default function TheMindRenderer({ view, legalActions, mySeat, seatName, busy: sending, onAction, expected, queued }: GameRendererProps<TheMindView>) {
  useTermsLang();
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued?.type ?? ''}`);
  const busy = sending || !!queued;
  const play = legalActions.find((a) => a.type === 'play') as { card: number } | undefined;
  const star = legalActions.find((a) => a.type === 'star') as { on: boolean } | undefined;
  const hint = expected as unknown as { type: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  // Undo window: my lowest card (the one «بگذار» plays) lies on the pile at once; undo takes it back to the hand.
  const pending = queued?.type === 'play' ? play?.card : undefined;
  const hand = view.hand?.filter((n) => n !== pending) ?? null;
  const pile = pending === undefined ? view.pile : [...view.pile, pending];
  const top = pile.at(-1);
  const last = view.last;
  const others = view.handCount.map((_, k) => k).filter((k) => k !== mySeat);
  const framed = useInFrame() !== null;
  const voting = view.votes.some(Boolean);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : play ? { tone: 'mine' as const, text: tx(terms.playPrompt) }
      : { tone: 'wait' as const, text: tx(terms.outOfCards) };

  return (
    <div ref={root} className={`tmd ${last?.kind === 'mistake' ? 'tmd--oops' : ''}`} data-seq={view.seq} key={last?.kind === 'mistake' ? `oops-${view.seq}` : 'tmd'}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && <RailSlot><p><T t={terms.rail} /></p></RailSlot>}

      {/* Pile and the level / lives / stars board side by side, as in the reference (QA round 2: the strip broke). */}
      <section className="tmd__center" aria-label={tx(terms.playedCards)}>
        <div className="tmd__hud">
          <span className="tmd__level"><small><T t={terms.level} /></small><b key={view.level} className="bg-pop">{fa(view.level)}</b><small>از {fa(view.levels)}</small></span>
          <span className={last?.kind === 'mistake' ? 'tmd__lives bg-hit' : 'tmd__lives'} key={`l${view.lives}`} aria-label={`${fa(view.lives)} ${tx(terms.life)}`}>{Array.from({ length: Math.max(5, view.lives) }, (_, k) => <Heart key={k} on={k < view.lives} />)}</span>
          <small aria-hidden="true"><T t={terms.life} /></small>
          <span className="tmd__stars bg-pop" key={`s${view.stars}`} aria-label={`${fa(view.stars)} ${tx(terms.shuriken)}`}>{Array.from({ length: 3 }, (_, k) => <Star key={k} on={k < view.stars} />)}</span>
          <small aria-hidden="true"><T t={terms.shuriken} /></small>
        </div>
        <div className="tmd__pile" data-flip-anchor="deck">
          {top !== undefined ? <Num n={top} size="lg" key={top} flip={`c-${top}`} flipFrom={last?.card === top && last.seat !== undefined && last.seat !== mySeat ? `seat-${last.seat}` : 'deck'} /> : <span className="tmd__empty">{view.level > 1 && last?.kind === 'level' ? `${tx(terms.levelEz)} ${fa(view.level)} ${tx(terms.started)}` : tx(terms.noCardYet)}</span>}
          {pile.length > 1 && <span className="tmd__under">{pile.slice(-6, -1).map((n) => fa(n)).join(' ، ')}</span>}
        </div>
        {last && (last.kind === 'mistake' || last.kind === 'star') && (
          <p className={`tmd__note tmd__note--${last.kind}`} role="status" key={view.seq}>
            {last.kind === 'mistake' ? <><T t={terms.mistake} /> <bdi>{who(last.seat!)}</bdi> {fa(last.card!)} <T t={terms.mistakeRest} /> </> : <><T t={terms.shurikenThrown} /> </>}
            {last.lost!.map((x, i) => <span key={i} className="tmd__lost"><bdi>{who(x.seat)}</bdi> {fa(x.card)}</span>)}
          </p>
        )}
      </section>

      {!framed && <ul className="tmd__team" aria-label={tx(terms.teammates)}>
        {others.map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={`tmd-mate ${view.handCount[s] ? '' : 'tmd-mate--done'}`}>
            <bdi className="tmd-mate__name">{who(s)}</bdi>
            <span className="tmd-mate__cards" aria-label={`${fa(view.handCount[s]!)} ${tx(terms.cards)}`}>
              {Array.from({ length: view.handCount[s]! }, (_, k) => <img key={k} src={cardBack} alt="" aria-hidden="true" />)}{!view.handCount[s] && 'تمام'}
            </span>
            {view.votes[s] && <span className="tmd-mate__vote"><Star on /> <T t={terms.agreeStar} /></span>}
          </li>
        ))}
      </ul>}

      {hand && !view.outcome && (
        <section className="tmd__me" aria-label={tx(terms.yourCards)}>
          <div className="tmd__hand">{hand.map((n, i) => <Num key={n} n={n} size={i === 0 ? 'md' : 'sm'} flip={`c-${n}`} flipFrom="deck" exit="drop" />)}{!hand.length && <span className="tmd__empty"><T t={terms.noCards} /></span>}</div>
          <Acts framed={framed}>
            {play && pending === undefined && <button type="button" data-card={play.card} className={`bgv-btn bgv-btn--primary tmd-play ${hint?.type === 'play' ? 'tmd-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'play' })}><T t={terms.play} /> <b>{fa(play.card)}</b></button>}
            {star && <button type="button" className="bgv-btn bgv-btn--secondary tmd-star" disabled={busy} aria-pressed={!star.on} onClick={() => onAction({ type: 'star', on: star.on })}>
              <Star on /> {star.on ? (voting ? tx(terms.agreeToo) : tx(terms.proposeStar)) : tx(terms.withdraw)}
            </button>}
          </Acts>
        </section>
      )}
    </div>
  );
}
