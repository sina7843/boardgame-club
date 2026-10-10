// sealed-bids renderer: private hand, sealed submit, public round/score, accessible reveal.
import './renderer.css';
// Shows only what the projection contains; opponents' bids appear only in revealed history.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionBar, Hand, Token, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { ROUNDS, type SealedBidsView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');

export default function SealedBidsRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, queued }: GameRendererProps<SealedBidsView>) {
  // Undo-window preview: the tapped token is already sealed in the envelope (only you see your own bid); undo returns it.
  const bid = queued?.type === 'bid' && mySeat !== null && real.myHand ? (queued.token as number) : null;
  const view = useMemo((): SealedBidsView => (bid === null || mySeat === null ? real
    : { ...real, myBid: bid, myHand: real.myHand!.filter((t) => t !== bid), submitted: real.submitted.map((x, s) => x || s === mySeat) }), [real, bid, mySeat]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.round}|${view.history.length}|${view.submitted.join()}|${bid ?? ''}`);
  const playable = new Set(legalActions.filter((a) => a.type === 'bid').map((a) => a.token as number));
  const seats = Array.from({ length: view.players }, (_, i) => i);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(view.history.length);

  useEffect(() => {
    if (view.history.length > seen.current) {
      const r = view.history[view.history.length - 1]!;
      const bids = r.bids.map((b, s) => `${seatName(s)} ${fa(b)}`).join('، ');
      setAnnounce(`دور ${fa(r.round)} آشکار شد: ${bids}. ${r.winner === null ? 'تساوی؛ امتیازی داده نشد.' : `${seatName(r.winner)} ${fa(r.prize)} امتیاز گرفت.`}`);
    }
    seen.current = view.history.length;
  }, [view.history, seatName]);

  const iSubmitted = mySeat !== null && view.submitted[mySeat];
  const status = view.outcome ? null
    : queued ? 'حرکت شما در حال ثبت است…'
    : playable.size > 0 ? `دور ${fa(view.round)}: پیشنهاد پنهان خود را ثبت کنید`
      : iSubmitted ? `پیشنهاد شما مهر شد؛ منتظر ${fa(view.submitted.filter((s, i) => !s && !view.resigned[i]).length)} بازیکن دیگر`
        : `دور ${fa(view.round)} در جریان است`;

  return (
    <div className="sb" ref={root}>
      <div className="sb__round">
        <div className="sb__prize" aria-label={`دور ${fa(view.round)} از ${fa(ROUNDS)}، جایزه ${fa(view.prize ?? 0)} امتیاز`}>
          <span className="muted">دور {fa(view.round)} از {fa(ROUNDS)}</span>
          {view.prize !== null && <strong key={view.round} className="bg-land">جایزه {fa(view.prize)} امتیاز</strong>}
        </div>
        {status && <TurnIndicator tone={queued ? 'wait' : playable.size > 0 ? 'mine' : iSubmitted ? 'done' : 'wait'}>{status}</TurnIndicator>}
      </div>

      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">امتیاز و وضعیت ثبت پیشنهاد</caption>
          <thead><tr><th scope="col">بازیکن</th><th scope="col">امتیاز</th><th scope="col">این دور</th></tr></thead>
          <tbody>
            {seats.map((s) => (
              <tr key={s}>
                <th scope="row" style={{ fontWeight: s === mySeat ? 800 : 600 }}><bdi>{seatName(s)}</bdi>{s === mySeat ? ' (شما)' : ''}</th>
                <td className="num"><span key={view.scores[s] ?? 0} className="bg-pop">{fa(view.scores[s] ?? 0)}</span></td>
                <td>
                  {!view.outcome && view.submitted[s] && !view.resigned[s] && <span className="sb-wax sb-wax--sm bg-land" aria-hidden="true" />}
                  {view.outcome ? '-' : view.resigned[s] ? 'انصراف (ثبت خودکار)' : view.submitted[s] ? '✓ مهر شد' : '… در انتظار'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="visually-hidden" role="status" aria-live="assertive">{announce}</p>
      {view.history.length > 0 && (
        <div key={view.history.length} className="sb-reveal" aria-hidden="true">
          {view.history[view.history.length - 1]!.bids.map((b, s) => (
            <span key={s} data-flip={s === mySeat ? `env-${view.history[view.history.length - 1]!.round}` : undefined} className={`sb-chip bg-flip-in sb-chip--${b}${view.history[view.history.length - 1]!.winner === s ? ' sb-chip--win' : ''}`} style={{ ['--i' as string]: s }}>{fa(b)}{view.history[view.history.length - 1]!.winner === s && <span className="sb-chip__star">★</span>}</span>
          ))}
        </div>
      )}
      {view.history.length > 0 && (
        <details className="sb__history" open={view.history.length <= 2 || !!view.outcome}>
          <summary>دورهای آشکارشده ({fa(view.history.length)})</summary>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">پیشنهادهای آشکارشده</caption>
              <thead><tr><th scope="col">دور</th>{seats.map((s) => <th key={s} scope="col"><bdi>{seatName(s)}</bdi></th>)}<th scope="col">برنده</th></tr></thead>
              <tbody>
                {view.history.map((h) => (
                  <tr key={h.round}>
                    <th scope="row">{fa(h.round)} <span className="muted">({fa(h.prize)} امتیاز)</span></th>
                    {h.bids.map((b, s) => <td key={s} className="num" style={{ fontWeight: h.winner === s ? 800 : 400 }}>{fa(b)}</td>)}
                    <td>{h.winner === null ? 'تساوی' : <bdi>{seatName(h.winner)}</bdi>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {view.myHand && !view.outcome && (
        <ActionBar label="دست شما">
          {/* The tokens stay on the bar (spent ones greyed), so a sealed token visibly flies from its place into the envelope. */}
          <Hand label="ژتون‌های شما">
            {[1, 2, 3, 4, 5].map((t) => (
              <span key={t} className="sb-slot" data-flip-anchor={`tok-${t}`}><Token value={t} disabled={view.myBid !== null || !playable.has(t) || busy}
                label={`ژتون ${fa(t)}${view.myHand!.includes(t) ? '' : ' (مصرف‌شده)'}`}
                onSelect={() => { if (view.myBid === null && playable.has(t) && !busy) onAction({ type: 'bid', token: t }); }} /></span>
            ))}
          </Hand>
          {view.myBid !== null ? (
            <>
              <span className="sb-env" aria-hidden="true" data-flip={`env-${view.round}`} data-flip-from={`tok-${view.myBid}`} data-flip-exit={bid !== null ? `tok-${bid}` : 'drop'}><span className="sb-wax" /></span>
              <span>پیشنهاد مهرشده شما: <strong className="num">{fa(view.myBid)}</strong>؛ تا پایان دور قابل تغییر نیست.</span>
            </>
          ) : <span className="muted">ژتون پیشنهادتان را بزنید تا مهر شود.</span>}
        </ActionBar>
      )}
    </div>
  );
}
