// sealed-bids renderer: private hand, sealed submit, public round/score, accessible reveal.
import './renderer.css';
// Shows only what the projection contains; opponents' bids appear only in revealed history.
import { useMemo, useRef } from 'react';
import { ActionBar, Hand, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps } from '@bg/ui';
import { terms } from './terms.ts';
import { CHIP, ENVELOPE, PLAQUE } from './art.ts';
import { ROUNDS, type SealedBidsView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');

const Chip = ({ n }: { n: number }) => <img className="sb-chip__img" src={CHIP[n]} alt="" draggable={false} />;

export default function SealedBidsRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, queued }: GameRendererProps<SealedBidsView>) {
  const lang = useTermsLang();
  // Undo-window preview: the tapped token is already sealed in the envelope (only you see your own bid); undo returns it.
  const bid = queued?.type === 'bid' && mySeat !== null && real.myHand ? (queued.token as number) : null;
  const view = useMemo((): SealedBidsView => (bid === null || mySeat === null ? real
    : { ...real, myBid: bid, myHand: real.myHand!.filter((t) => t !== bid), submitted: real.submitted.map((x, s) => x || s === mySeat) }), [real, bid, mySeat]);
  const framed = useInFrame() !== null;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.round}|${view.history.length}|${view.submitted.join()}|${bid ?? ''}`);
  const playable = new Set(legalActions.filter((a) => a.type === 'bid').map((a) => a.token as number));
  const seats = Array.from({ length: view.players }, (_, i) => i);
  // Derived from the latest revealed round, not from an effect: a remount or a missed update cannot lose the message.
  const announce = useMemo(() => {
    const r = view.history[view.history.length - 1];
    if (!r) return '';
    const bids = r.bids.map((b, s) => `${seatName(s)} ${fa(b)}`).join('، ');
    return `${tx(terms.round)} ${fa(r.round)} ${tx(terms.revealed)}: ${bids}. ${r.winner === null ? tx(terms.tieNoPoints) : `${seatName(r.winner)} ${fa(r.prize)} امتیاز گرفت.`}`;
  }, [view.history, seatName, lang]); // eslint-disable-line react-hooks/exhaustive-deps -- lang re-runs tx()

  const iSubmitted = mySeat !== null && view.submitted[mySeat];
  const status = view.outcome ? null
    : queued ? 'حرکت شما در حال ثبت است…'
    : playable.size > 0 ? `${tx(terms.round)} ${fa(view.round)}: ${tx(terms.placeBid)}`
      : iSubmitted ? `${tx(terms.bidSealed)} ${fa(view.submitted.filter((s, i) => !s && !view.resigned[i]).length)} بازیکن دیگر`
        : `${tx(terms.round)} ${fa(view.round)} در جریان است`;

  return (
    <div className="sb-bids" ref={root}>
      {framed && status && <RailSlot><p><b>{status}</b></p><p>هر <T t={terms.round} /> همه هم‌زمان یک <T t={terms.chip} /> را پنهانی <T t={terms.seal} /> می‌کنند؛ بالاترین <T t={terms.bid} /> یکتا امتیاز <T t={terms.round} /> را می‌برد و <T t={terms.bid} /> برابر هیچ‌کس را برنده نمی‌کند. هر <T t={terms.chip} /> یک بار مصرف می‌شود.</p></RailSlot>}
      <div className="sb__round">
        <div className="sb__prize" aria-label={`${tx(terms.round)} ${fa(view.round)} از ${fa(ROUNDS)}، ${tx(terms.prize)} ${fa(view.prize ?? 0)} امتیاز`}>
          <span className="muted"><T t={terms.round} /> {fa(view.round)} از {fa(ROUNDS)}</span>
          {view.prize !== null && (framed
            ? <span className="visually-hidden"><T t={terms.prize} /> {fa(view.prize)} امتیاز</span>
            : <strong key={view.round} className="bg-land"><T t={terms.prize} /> {fa(view.prize)} امتیاز</strong>)}
        </div>
        {!framed && status && <TurnIndicator tone={queued ? 'wait' : playable.size > 0 ? 'mine' : iSubmitted ? 'done' : 'wait'}>{status}</TurnIndicator>}
      </div>

      {framed && (
        <ol className="sb-prizes" aria-label={tx(terms.prizes5)}>
          {Array.from({ length: ROUNDS }, (_, i) => i + 1).map((r) => {
            const done = view.history.find((h) => h.round === r);
            const now = !view.outcome && r === view.round;
            return (
              <li key={r} className={['sb-prize', now ? 'sb-prize--now' : '', done ? 'sb-prize--done' : ''].join(' ')} aria-current={now ? 'step' : undefined}>
                <img className={now ? 'sb-plaque bg-land' : 'sb-plaque'} src={PLAQUE[r]} alt={`${tx(terms.round)} ${fa(r)}، ${tx(terms.prize)} ${fa(r)} امتیاز`} draggable={false} />
                <span className="sb-prize__cap">{now ? tx(terms.now) : done ? (done.winner === null ? tx(terms.tieShort) : <bdi>{done.winner === mySeat ? 'شما' : seatName(done.winner)}</bdi>) : tx(terms.next)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {framed && (
        <ul className="sb-seats" aria-label={tx(terms.bidStatus)}>
          {seats.map((s) => (
            <li key={s} className="sb-seat">
              <bdi>{s === mySeat ? 'شما' : seatName(s)}</bdi>
              {!view.outcome && view.submitted[s] && !view.resigned[s] ? <img className="sb-seat__env bg-land" src={ENVELOPE} alt="" /> : <span className="sb-seat__empty" aria-hidden="true" />}
              <span className="visually-hidden">{view.outcome ? '' : view.resigned[s] ? 'انصراف (ثبت خودکار)' : view.submitted[s] ? tx(terms.sealedMark) : tx(terms.waitingMark)}</span>
            </li>
          ))}
        </ul>
      )}
      {!framed && <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden"><T t={terms.scoreAndBidStatus} /></caption>
          <thead><tr><th scope="col">بازیکن</th><th scope="col">امتیاز</th><th scope="col"><T t={terms.thisRound} /></th></tr></thead>
          <tbody>
            {seats.map((s) => (
              <tr key={s}>
                <th scope="row" style={{ fontWeight: s === mySeat ? 800 : 600 }}><bdi>{seatName(s)}</bdi>{s === mySeat ? ' (شما)' : ''}</th>
                <td className="num"><span key={view.scores[s] ?? 0} className="bg-pop">{fa(view.scores[s] ?? 0)}</span></td>
                <td>
                                    {view.outcome ? '-' : view.resigned[s] ? 'انصراف (ثبت خودکار)' : view.submitted[s] ? tx(terms.sealedMark) : tx(terms.waitingMark)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      <p className="visually-hidden" role="status" aria-live="assertive">{announce}</p>
      {view.history.length > 0 && (
        <div key={view.history.length} className="sb-reveal" aria-hidden="true">
          {view.history[view.history.length - 1]!.bids.map((b, s) => (
            <span key={s} data-flip={s === mySeat ? `env-${view.history[view.history.length - 1]!.round}` : undefined} className={`sb-chip bg-flip-in sb-chip--${b}${view.history[view.history.length - 1]!.winner === s ? ' sb-chip--win' : ''}`} style={{ ['--i' as string]: s }} aria-label={fa(b)}><Chip n={b} />{view.history[view.history.length - 1]!.winner === s && <span className="sb-chip__star">★</span>}</span>
          ))}
        </div>
      )}
      {!framed && view.history.length > 0 && (
        <details className="sb__history" open={view.history.length <= 2 || !!view.outcome}>
          <summary><T t={terms.revealedRounds} /> ({fa(view.history.length)})</summary>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden"><T t={terms.revealedBids} /></caption>
              <thead><tr><th scope="col"><T t={terms.round} /></th>{seats.map((s) => <th key={s} scope="col"><bdi>{seatName(s)}</bdi></th>)}<th scope="col">برنده</th></tr></thead>
              <tbody>
                {view.history.map((h) => (
                  <tr key={h.round}>
                    <th scope="row">{fa(h.round)} <span className="muted">({fa(h.prize)} امتیاز)</span></th>
                    {h.bids.map((b, s) => <td key={s} className="num" style={{ fontWeight: h.winner === s ? 800 : 400 }}>{fa(b)}</td>)}
                    <td>{h.winner === null ? tx(terms.tie) : <bdi>{seatName(h.winner)}</bdi>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {view.myHand && !view.outcome && (
        <ActionBar label={tx(terms.yourHand)}>
          {/* The tokens stay on the bar (spent ones greyed), so a sealed token visibly flies from its place into the envelope. */}
          <Hand label={tx(terms.yourChips)}>
            {[1, 2, 3, 4, 5].map((t) => (
              <span key={t} className="sb-slot" data-flip-anchor={`tok-${t}`}><button type="button" className="sb-tok" disabled={view.myBid !== null || !playable.has(t) || busy}
                aria-label={`${tx(terms.chip)} ${fa(t)}${view.myHand!.includes(t) ? '' : ` ${tx(terms.spent)}`}`}
                onClick={() => { if (view.myBid === null && playable.has(t) && !busy) onAction({ type: 'bid', token: t }); }}><Chip n={t} /></button></span>
            ))}
          </Hand>
          {view.myBid !== null ? (
            <>
              <span className="sb-env" aria-hidden="true" data-flip={`env-${view.round}`} data-flip-from={`tok-${view.myBid}`} data-flip-exit={bid !== null ? `tok-${bid}` : 'drop'}><img src={ENVELOPE} alt="" draggable={false} /></span>
              <span><T t={terms.yourSealedBid} />: <strong className="num">{fa(view.myBid)}</strong>؛ تا پایان <T t={terms.round} /> قابل تغییر نیست.</span>
            </>
          ) : <span className="muted"><T t={terms.tapChip} /></span>}
        </ActionBar>
      )}
    </div>
  );
}
