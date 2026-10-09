// گاو شش renderer: four rows of numbered cards (bull heads show the penalty), a fan of your cards to tap, the
// revealed choices in order, and rows that become buttons when you must take one.
import './renderer.css';
import { useRef } from 'react';
import { TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import bull from './art/bull.webp';
import { bullheads, type SixNimmtView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const tier = (c: number) => ({ 1: 't1', 2: 't2', 3: 't3', 5: 't5', 7: 't7' }[bullheads(c)] ?? 't1');

// Bull head art is cut from a generated sprite sheet (see DECISIONS.md).
function Bull() {
  return <img src={bull} className="sn-bull" alt="" aria-hidden="true" draggable={false} />;
}

function Card({ c, small, onClick, state, hint, flip, flipFrom }: { flip?: string; flipFrom?: string; c: number; small?: boolean; onClick?: () => void; state?: 'take' | 'up'; hint?: boolean }) {
  const b = bullheads(c);
  const body = (
    <>
      <img src={bull} className="sn-card__bg" alt="" aria-hidden="true" draggable={false} />
      <span className="sn-card__heads" aria-hidden="true">{Array.from({ length: b }, (_, k) => <Bull key={k} />)}</span>
      <strong className="sn-card__n">{fa(c)}</strong>
    </>
  );
  const cls = ['sn-card', `sn-card--${tier(c)}`, small ? 'sn-card--small' : '', state ? `sn-card--${state}` : '', hint ? 'sn-card--hint' : ''].join(' ');
  return onClick
    ? <button type="button" className={cls} data-flip={flip} data-flip-from={flipFrom} onClick={onClick} aria-label={`کارت ${fa(c)}، ${fa(b)} گاو`}>{body}</button>
    : <span className={cls} data-flip={flip} data-flip-from={flipFrom} aria-label={`کارت ${fa(c)}، ${fa(b)} گاو`}>{body}</span>;
}

export default function SixNimmtRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SixNimmtView>) {
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const playable = new Set(legalActions.filter((a) => a.type === 'play').map((a) => a.card as number));
  const mustTake = legalActions.some((a) => a.type === 'takeRow');
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myChoice = mySeat !== null ? view.chosen[mySeat] : false;
  const hintCard = expected?.type === 'play' ? (expected.card as number) : null;
  const hintRow = expected?.type === 'takeRow' ? (expected.row as number) : null;
  const playedBy = new Map(view.reveal.map((r) => [r.card, r.seat]));

  const waitingFor = view.chosen.map((c, k) => (c === false ? k : -1)).filter((k) => k >= 0 && k !== mySeat);
  const status = view.outcome ? null
    : mustTake ? { tone: 'mine' as const, text: `کارت ${fa(view.pendingCard!)} از همه ردیف‌ها کوچک‌تر است: یک ردیف را بردارید` }
      : playable.size ? { tone: 'mine' as const, text: 'یک کارت انتخاب کنید (مخفی می‌ماند تا همه انتخاب کنند)' }
        : view.phase === 'takeRow' ? { tone: 'wait' as const, text: `${who(view.waitingRow!)} ردیف برمی‌دارد` }
          : { tone: 'wait' as const, text: waitingFor.length ? `منتظر ${waitingFor.map(who).join('، ')}` : 'منتظر بقیه' };

  return (
    <div className="sn" ref={root} data-seq={view.seq} data-phase={view.phase} data-chosen={String(myChoice)}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="sn__scores" aria-label="امتیازها">
        {view.totals.map((t, s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['sn-score', view.chosen[s] !== false ? 'sn-score--ready' : '', view.waitingRow === s ? 'sn-score--turn' : ''].join(' ')}>
            <bdi>{who(s)}</bdi>
            <span className="sn-score__n"><Bull /><b key={t} className="bg-pop">{fa(t)}</b>{s === mySeat && view.myRound ? <small> (+{fa(view.myRound)})</small> : null}</span>
            {!view.outcome && view.phase === 'choose' && <span className="sn-score__state">{view.chosen[s] !== false ? '✓' : '…'}</span>}
          </li>
        ))}
      </ul>

      <div className="sn__rows" data-flip-anchor="deck" role="group" aria-label="ردیف‌ها">
        {view.rows.map((r, k) => {
          const heads = r.reduce((a, c) => a + bullheads(c), 0);
          const take = mustTake && !busy;
          const content = (
            <>
              {r.map((c) => <Card key={c} c={c} small flip={`c-${c}`} flipFrom={playedBy.has(c) ? `seat-${playedBy.get(c)}` : undefined} />)}
              {Array.from({ length: 5 - r.length }, (_, i) => <span key={`e${i}`} className="sn-slot" />)}
              <span className="sn-slot sn-slot--danger" aria-hidden="true">۶</span>
              <span className="sn-row__heads"><Bull />{fa(heads)}</span>
            </>
          );
          return take
            ? <button key={k} type="button" className={['sn-row', 'sn-row--take', hintRow === k ? 'sn-row--hint' : ''].join(' ')} onClick={() => onAction({ type: 'takeRow', row: k })} aria-label={`برداشتن ردیف ${fa(k + 1)} با ${fa(heads)} گاو`}>{content}</button>
            : <div key={k} className="sn-row" aria-label={`ردیف ${fa(k + 1)}: ${r.map(fa).join('، ')}`}>{content}</div>;
        })}
      </div>

      {(view.reveal.length > 0 || view.upcoming.length > 0) && (
        <div className="sn__reveal" aria-label="کارت‌های رو شده این نوبت">
          {[...view.reveal.map((r) => ({ ...r, done: true })), ...view.upcoming.map((u) => ({ ...u, took: null, done: false }))].map((r, i) => (
            <span key={r.card} style={{ ['--i' as string]: i }} className={['sn-rev', r.done ? 'bg-flip-in' : 'sn-rev--waiting', r.took ? 'sn-rev--took' : ''].join(' ')}>
              <bdi>{who(r.seat)}</bdi><Card c={r.card} small />
              {r.took && <span className="sn-rev__took">{r.took.map((c) => <Card key={c} c={c} small flip={`c-${c}`} />)}</span>}
              {r.took && <small>{fa(r.took.reduce((a, c) => a + bullheads(c), 0))} گاو برداشت</small>}
            </span>
          ))}
        </div>
      )}

      {view.hand && !view.outcome && (
        <div className="sn__hand" role="group" aria-label="دست شما">
          {view.hand.map((c) => (
            <Card key={c} c={c} flip={`c-${c}`} flipFrom="deck" state={myChoice === c ? 'up' : undefined} hint={hintCard === c}
              onClick={playable.has(c) && !busy ? () => onAction({ type: 'play', card: c }) : undefined} />
          ))}
          {typeof myChoice === 'number' && !view.hand.includes(myChoice) && <Card c={myChoice} state="up" flip={`c-${myChoice}`} />}
        </div>
      )}
      <p className="sn__meta">{view.oneRound ? 'یک دست' : `دست ${fa(view.round)} — تا ۶۶ گاو`}</p>
    </div>
  );
}
