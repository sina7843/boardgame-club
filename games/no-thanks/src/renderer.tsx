// نه، مرسی! renderer: the card in the middle with its pile of chips, every player's cards grouped in runs (only the
// lowest of a run scores), and two big buttons. Others' chip counts are secret until the end.
import './renderer.css';
import { useMemo, useRef } from 'react';
import { TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { cardPoints, runs, type NoThanksView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
/** Warm-to-hot card colours: low cards cool, high cards red. */
const hue = (c: number) => 200 - ((c - 3) / 32) * 200;

export default function NoThanksRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<NoThanksView>) {
  // Undo-window preview: a taken card already lies in your row with its chips counted, a refusal already put your chip
  // on the card; undo returns them. The next card from the deck only comes with the server's answer.
  const pending = mySeat !== null && real.card !== null && (queued?.type === 'take' || queued?.type === 'pass') ? queued.type : null;
  const view = useMemo((): NoThanksView => {
    if (!pending || mySeat === null) return real;
    const chips = real.chips.map((c, s) => (s === mySeat && c !== null ? c + (pending === 'take' ? real.pot : -1) : c));
    return pending === 'take'
      ? { ...real, chips, card: null, pot: 0, cards: real.cards.map((cs, s) => (s === mySeat ? [...cs, real.card!].sort((a, b) => a - b) : cs)) }
      : { ...real, chips, pot: real.pot + 1 };
  }, [real, pending, mySeat]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.log.at(-1)?.seq ?? 0}|${pending ?? ''}`);
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const myTurn = has('take');
  const hint = expected?.type;
  const last = view.log.at(-1);
  const passer = pending === 'pass' ? mySeat : last?.t === 'pass' ? last.seat : null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myCards = mySeat !== null ? view.cards[mySeat]! : [];
  const withCard = view.card !== null && myTurn ? cardPoints([...myCards, view.card]) - cardPoints(myCards) : null;
  const order = mySeat === null ? view.cards.map((_, k) => k) : [mySeat, ...view.cards.map((_, k) => k).filter((k) => k !== mySeat)];

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: 'نوبت شما: بردارید یا رد کنید' }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : seatName(view.current)}` };

  return (
    <div className="nt" ref={root} data-seq={last?.seq ?? 0}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="nt__middle">
        <div className="nt-deck" data-flip-anchor="deck" aria-label={`${fa(view.deckCount)} کارت در دسته`}>
          {Array.from({ length: Math.min(5, view.deckCount) }, (_, k) => <span key={k} className="nt-deck__card" style={{ ['--k' as string]: k }} />)}
          <span className="nt-deck__n">{fa(view.deckCount)}</span>
        </div>
        {view.card !== null ? (
          <div key={view.card} data-flip={`c-${view.card}`} data-flip-from="deck" className="nt-card nt-card--big" style={{ ['--h' as string]: hue(view.card) }} aria-label={`کارت ${fa(view.card)} با ${fa(view.pot)} ژتون رویش`}>
            <span className="nt-card__corner">{fa(view.card)}</span>
            <strong className="nt-card__n">{fa(view.card)}</strong>
            <span className="nt-pot" aria-hidden="true">
              {Array.from({ length: Math.min(view.pot, 12) }, (_, k) => <i key={k} style={{ ['--k' as string]: k }} data-flip={`chip-${k}`}
                data-flip-from={passer !== null && k === view.pot - 1 ? `seat-${passer}` : undefined} data-flip-exit={view.current === null ? 'drop' : `seat-${view.current}`} />)}
              {view.pot > 0 && <b key={view.pot} className="bg-pop">{fa(view.pot)}</b>}
            </span>
          </div>
        ) : <div className="nt-card nt-card--empty">{pending ? '' : 'پایان'}</div>}
      </div>

      {myTurn && (
        <div className="nt__actions">
          <button type="button" className={['nt-btn nt-btn--take', hint === 'take' ? 'nt-btn--hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'take' })}>
            برمی‌دارم{view.pot ? ` (+${fa(view.pot)} ژتون)` : ''}
            {withCard !== null && <small>{withCard > 0 ? `امتیاز منفی +${fa(withCard)}` : 'به رشته‌تان می‌چسبد'}</small>}
          </button>
          <button type="button" className={['nt-btn nt-btn--pass', hint === 'pass' ? 'nt-btn--hint' : ''].join(' ')} disabled={busy || !has('pass')} onClick={() => onAction({ type: 'pass' })}>
            نه، مرسی!<small>{has('pass') ? '۱ ژتون می‌دهید' : 'ژتون ندارید'}</small>
          </button>
        </div>
      )}

      <ul className="nt__players" aria-label="بازیکنان">
        {order.map((s) => {
          const cs = view.cards[s]!;
          const pts = cardPoints(cs);
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['nt-pl', s === view.current && !view.outcome ? 'nt-pl--turn' : '', view.active[s] ? '' : 'nt-pl--out', s === mySeat ? 'nt-pl--me' : ''].join(' ')}>
              <div className="nt-pl__head">
                <bdi className="nt-pl__name">{who(s)}</bdi>
                <span className="nt-pl__chips bg-pop" key={`h${view.chips[s]}`} aria-label={view.chips[s] === null ? 'ژتون‌ها مخفی' : `${fa(view.chips[s]!)} ژتون`}><i aria-hidden="true" />{view.chips[s] === null ? '؟' : fa(view.chips[s]!)}</span>
                <span className="nt-pl__pts">امتیاز کارت‌ها {fa(pts)}</span>
                {view.scores && <strong className="nt-pl__score">نهایی {fa(view.scores[s]!)}</strong>}
              </div>
              <div className="nt-pl__runs">
                {runs(cs).map((run) => (
                  <span key={run[0]} className="nt-run">
                    {run.map((c, k) => (
                      <span key={c} className={['nt-card', 'nt-card--small', k === 0 ? 'nt-card--counts' : ''].join(' ')} data-flip={`c-${c}`} style={{ ['--h' as string]: hue(c) }}>{fa(c)}</span>
                    ))}
                  </span>
                ))}
                {!cs.length && <span className="nt-pl__none">هنوز کارتی ندارد</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {last && !view.outcome && <p className="nt__last" role="status">{last.t === 'take' ? `${who(last.seat)} ${fa(last.card!)} را برداشت` : last.t === 'pass' || last.t === 'timeout' ? `${who(last.seat)}: «نه، مرسی!»` : `${who(last.seat)} کنار رفت`}</p>}
    </div>
  );
}
