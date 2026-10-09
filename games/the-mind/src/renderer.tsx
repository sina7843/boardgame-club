// هم‌فکر renderer: a quiet night table. The pile's top card glows in the middle, lives and throwing stars sit above,
// teammates show only how many cards they still hold; your cards are at the bottom with one big "play" button.
import './renderer.css';
import { useRef } from 'react';
import { TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import cardBack from './art/card-back.webp';
import heart from './art/heart.webp';
import star from './art/star.webp';
import type { TheMindView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');

// Art is cut from a generated sprite sheet (see DECISIONS.md).
const Heart = ({ on }: { on: boolean }) => <img src={heart} alt="" className={`tm-ico tm-ico--life ${on ? 'on' : ''}`} aria-hidden="true" />;
const Star = ({ on }: { on: boolean }) => <img src={star} alt="" className={`tm-ico tm-ico--star ${on ? 'on' : ''}`} aria-hidden="true" />;

export function Num({ n, size = 'md', flip, flipFrom }: { n: number; size?: 'sm' | 'md' | 'lg'; flip?: string; flipFrom?: string }) {
  return <span className={['tm-card', `tm-card--${size}`].join(' ')} data-flip={flip} data-flip-from={flipFrom} style={{ ['--h' as string]: Math.round(220 + n * 1.3) }}><b>{fa(n)}</b></span>;
}

export default function TheMindRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<TheMindView>) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const play = legalActions.find((a) => a.type === 'play') as { card: number } | undefined;
  const star = legalActions.find((a) => a.type === 'star') as { on: boolean } | undefined;
  const hint = expected as unknown as { type: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const top = view.pile.at(-1);
  const last = view.last;
  const others = view.handCount.map((_, k) => k).filter((k) => k !== mySeat);
  const voting = view.votes.some(Boolean);
  const status = view.outcome ? null
    : play ? { tone: 'mine' as const, text: 'وقتی حس کردید نوبت کارت شماست، بگذارید' }
      : { tone: 'wait' as const, text: 'کارت‌هایتان تمام شد؛ منتظر هم‌تیمی‌ها' };

  return (
    <div ref={root} className={`tm ${last?.kind === 'mistake' ? 'tm--oops' : ''}`} data-seq={view.seq} key={last?.kind === 'mistake' ? `oops-${view.seq}` : 'tm'}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="tm__hud">
        <span className="tm__level">مرحله <b key={view.level} className="bg-pop">{fa(view.level)}</b> از {fa(view.levels)}</span>
        <span className={last?.kind === 'mistake' ? 'tm__lives bg-hit' : 'tm__lives'} key={`l${view.lives}`} aria-label={`${fa(view.lives)} جان`}>{Array.from({ length: Math.max(5, view.lives) }, (_, k) => <Heart key={k} on={k < view.lives} />)}</span>
        <span className="tm__stars bg-pop" key={`s${view.stars}`} aria-label={`${fa(view.stars)} ستاره`}>{Array.from({ length: 3 }, (_, k) => <Star key={k} on={k < view.stars} />)}</span>
      </div>

      <section className="tm__center" aria-label="کارت‌های زمین">
        <div className="tm__pile" data-flip-anchor="deck">
          {top !== undefined ? <Num n={top} size="lg" key={top} flip={`c-${top}`} flipFrom={last?.card === top && last.seat !== undefined && last.seat !== mySeat ? `seat-${last.seat}` : 'deck'} /> : <span className="tm__empty">{view.level > 1 && last?.kind === 'level' ? `مرحلهٔ ${fa(view.level)} شروع شد` : 'هنوز کارتی زمین نیامده'}</span>}
          {view.pile.length > 1 && <span className="tm__under">{view.pile.slice(-6, -1).map((n) => fa(n)).join(' ، ')}</span>}
        </div>
        {last && (last.kind === 'mistake' || last.kind === 'star') && (
          <p className={`tm__note tm__note--${last.kind}`} role="status" key={view.seq}>
            {last.kind === 'mistake' ? <>اشتباه! <bdi>{who(last.seat!)}</bdi> {fa(last.card!)} را گذاشت؛ یک جان از دست رفت. کنار رفت: </> : <>ستاره پرتاب شد: </>}
            {last.lost!.map((x, i) => <span key={i} className="tm__lost"><bdi>{who(x.seat)}</bdi> {fa(x.card)}</span>)}
          </p>
        )}
      </section>

      <ul className="tm__team" aria-label="هم‌تیمی‌ها">
        {others.map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={`tm-mate ${view.handCount[s] ? '' : 'tm-mate--done'}`}>
            <bdi className="tm-mate__name">{who(s)}</bdi>
            <span className="tm-mate__cards" aria-label={`${fa(view.handCount[s]!)} کارت`}>
              {Array.from({ length: view.handCount[s]! }, (_, k) => <img key={k} src={cardBack} alt="" aria-hidden="true" />)}{!view.handCount[s] && 'تمام'}
            </span>
            {view.votes[s] && <span className="tm-mate__vote"><Star on /> موافق ستاره</span>}
          </li>
        ))}
      </ul>

      {view.hand && !view.outcome && (
        <section className="tm__me" aria-label="کارت‌های شما">
          <div className="tm__hand">{view.hand.map((n, i) => <Num key={n} n={n} size={i === 0 ? 'md' : 'sm'} flip={`c-${n}`} flipFrom="deck" />)}{!view.hand.length && <span className="tm__empty">کارتی ندارید</span>}</div>
          <div className="tm__actions">
            {play && <button type="button" data-card={play.card} className={`tm-play ${hint?.type === 'play' ? 'tm-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'play' })}>بگذار <b>{fa(play.card)}</b></button>}
            {star && <button type="button" className={`tm-star ${!star.on ? 'tm-star--on' : ''}`} disabled={busy} aria-pressed={!star.on} onClick={() => onAction({ type: 'star', on: star.on })}>
              <Star on /> {star.on ? (voting ? 'من هم موافقم' : 'پیشنهاد ستاره پرتابی') : 'پس گرفتن موافقت'}
            </button>}
          </div>
        </section>
      )}
    </div>
  );
}
