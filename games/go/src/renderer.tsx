// گو renderer: kaya wood board with ink lines and star points; slate and shell stones (SVG, LTR geometry).
// Play: tap an intersection. Scoring: tap a group to mark it dead/alive; territory and the running score are shown.
import './renderer.css';
import { useSyncExternalStore } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useInFrame, usePop, useTermsLang, tx, type GameRendererProps, DockSlot } from '@bg/ui';
import { terms } from './terms.ts';
import stoneB from './art/go-black.png';
import stoneW from './art/go-white.png';
import boardArt9 from './art/go-board-9.png';
import boardArt13 from './art/go-board-13c.png';
import boardArt19 from './art/go-board-19.png';
import lastArt from './art/go-last.png';
import koArt from './art/go-ko.png';
import terrB from './art/go-terr-black.png';
import terrW from './art/go-terr-white.png';
import { areaScore, play, type GoView, type Stone } from './rules.ts';

// Stones and the kaya wood are cut from a generated sheet (see DECISIONS.md).
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const COLS = 'ABCDEFGHJKLMNOPQRST';
const BOARD_ART: Record<number, string> = { 9: boardArt9, 13: boardArt13, 19: boardArt19 };
/** Desktop (≥900): game buttons sit in the rail; on phones the rail is folded away, so they go to the dock. */
const WIDE = '(min-width: 900px)';
const useWide = () => useSyncExternalStore((f) => { const q = matchMedia(WIDE); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, () => matchMedia(WIDE).matches, () => true);

export default function GoRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<GoView>) {
  useTermsLang(); // re-render when the terms language changes
  const framed = useInFrame() !== null; // the shell draws players, captures, score and whose-turn
  const wide = useWide();
  const n = real.size;
  // Undo-window preview: the own stone is already on its point and the stones it captures fade away (the client can
  // play the move out itself); undo puts everything back.
  const pv = queued?.type === 'place' && real.phase === 'play' ? play(real.board, n, queued.at as number, real.turn, []) : null;
  const view: GoView = pv && !('error' in pv)
    ? { ...real, board: pv.board, turn: real.turn === 'b' ? 'w' : 'b', last: { seat: mySeat ?? 0, at: queued!.at as number, captured: pv.captured }, captures: { ...real.captures, [real.turn]: real.captures[real.turn] + pv.captured.length }, ko: null }
    : real;
  // The board PNGs are stretched to a square; the n×n grid of cells sits at inset 8.58 % 8.57 % 8.58 % 8.70 % (intersection = cell centre).
  const SIZE = 1000, G = 827.5 / n, M = 86.4 + G / 2;
  const pos = (i: number) => ({ x: M + (i % n) * G, y: M + Math.floor(i / n) * G });
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const canPlace = has('place') && !busy && !queued;
  const scoring = view.phase === 'scoring';
  const myColor: Stone = mySeat === null ? 'b' : view.colors[mySeat]!;
  const hint = expected?.type === 'place' ? (expected.at as number) : null;
  const live = scoring ? areaScore(view.board, n, view.dead, view.komi) : null;
  const territory = scoring ? live!.territory : view.score?.territory ?? null;
  const dead = new Set(view.dead);
  const last = view.last;
  const seatOf = (c: Stone) => (view.colors[0] === c ? 0 : 1);
  const who = (c: Stone) => (seatOf(c) === mySeat ? 'شما' : seatName(seatOf(c)));
  const legalAt = (i: number) => canPlace && view.board[i] === null && i !== view.ko && !('error' in play(view.board, n, i, view.turn, []));

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : scoring ? { tone: (mySeat !== null && !view.accepted[mySeat] ? 'mine' : 'wait') as 'mine' | 'wait', text: mySeat !== null && !view.accepted[mySeat] ? 'شمارش: گروه‌های مرده را بزنید و تأیید کنید' : 'منتظر تأیید حریف' }
      : canPlace ? { tone: 'mine' as const, text: view.passes ? `حریف ${tx(terms.pass)} داد؛ بگذارید یا ${tx(terms.pass)} بدهید` : 'نوبت شما: روی یک تقاطع بگذارید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  const passBtn = has('pass') ? <Button key="pass" className="go-passbtn" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>{tx(terms.pass)}</Button> : null;
  const acceptBtn = has('accept') ? <Button key="acc" disabled={busy} onClick={() => onAction({ type: 'accept' })}>تأیید شمارش</Button> : null;
  const resumeBtn = has('resume') ? <Button key="res" variant="ghost" disabled={busy} onClick={() => onAction({ type: 'resume' })}>ادامه بازی</Button> : null;

  return (
    <div className="go" data-moves={view.history.length} data-phase={view.phase}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          {scoring && (['b', 'w'] as Stone[]).map((c) => view.accepted[seatOf(c)] && <p key={c} className="go-side__ok"><bdi>{who(c)}</bdi> شمارش را تأیید کرد</p>)}
          <p className="go-pts"><span>{tx(terms.komi)} سفید <b>{fa(view.komi)}</b></span><span>{tx(terms.capture)} <b>{fa(view.captures.b)}</b> سیاه<span className="go-sep" aria-hidden />{fa(view.captures.w)} سفید</span></p>
          <p>{scoring ? `سنگ‌های مرده را با زدن روی گروهشان علامت بزنید؛ ${tx(terms.territory)} و امتیاز با ${tx(terms.komi)} همین حالا شمرده می‌شود. هر دو باید تأیید کنند.` : `سنگ یا گروهی که آخرین ${tx(terms.liberty)}‌اش پر شود گرفته می‌شود. نمی‌شود وضعیت قبلی صفحه را تکرار کرد (${tx(terms.ko)}). دو ${tx(terms.pass)} پشت‌سرهم شمارش را شروع می‌کند.`}</p>
          <section className="go-ml" aria-label="حرکت‌ها">
            <h3>حرکت‌ها<span className="go-ml__note">ستون {COLS[0]} تا {COLS[n - 1]} (بدون I)، ردیف ۱ تا {fa(n)}</span></h3>
            <div className="go-ml__grid" role="list">
              <span className="go-ml__h">#</span><span className="go-ml__h">سیاه</span><span className="go-ml__h">سفید</span>
              {Array.from({ length: Math.ceil(real.history.length / 2) }, (_, r) => [
                <span key={`n${r}`} className="go-ml__n">{fa(r + 1)}.</span>,
                ...[0, 1].map((k) => {
                  const h = real.history[r * 2 + k];
                  const text = !h ? '' : h.at === null ? tx(terms.pass) : `${COLS[h.at % n]}${n - Math.floor(h.at / n)}`;
                  return <bdi key={`${r}-${k}`} role="listitem" dir={h?.at === null ? 'rtl' : 'ltr'} className={r * 2 + k === real.history.length - 1 ? 'go-ml__m is-cur' : 'go-ml__m'}>{text}</bdi>;
                })
              ]).flat().slice(-90)}
            </div>
            {!real.history.length && <p className="go-ml__note">هنوز حرکتی ثبت نشده است.</p>}
          </section>
          {wide && passBtn}
        </RailSlot>
      )}
      {framed && <DockSlot>{!wide && passBtn}{acceptBtn}{resumeBtn}</DockSlot>}
      {!framed && <div className="go__bar">
        {(['b', 'w'] as Stone[]).map((c) => (
          <div key={c} className={['go-side', view.turn === c && view.phase === 'play' && !view.outcome ? 'go-side--turn' : ''].join(' ')}>
            <span className={`go-side__stone go-side__stone--${c}`} aria-hidden="true" />
            <bdi className="go-side__name">{who(c)}</bdi>
            <Pop n={view.captures[c]} className="go-side__stat">{tx(terms.capture)} {fa(view.captures[c])}{c === 'w' ? `، ${tx(terms.komi)} ${fa(view.komi)}` : ''}</Pop>
            {(live || view.score) && <Pop n={(live ?? view.score!)[c]} as="strong" className="go-side__score">{fa((live ?? view.score!)[c])}</Pop>}
            {scoring && view.accepted[seatOf(c)] && <span className="go-side__ok">تأیید کرد</span>}
          </div>
        ))}
      </div>}

      <ZoomBoard label="صفحه گو">
        <svg className="go-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label={`صفحه گو ${fa(n)}×${fa(n)}`} style={{ direction: 'ltr' }}>
          <defs>
            <filter id="go-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="2" dy="4" stdDeviation="2.5" floodOpacity=".45" /></filter>
          </defs>
          <image href={BOARD_ART[n]} width={SIZE} height={SIZE} preserveAspectRatio="none" />

          {territory?.map((t, i) => t && (view.board[i] === null || dead.has(i)) && (
            <image key={`t${i}`} href={t === 'b' ? terrB : terrW} x={pos(i).x - G * 0.21} y={pos(i).y - G * 0.21} width={G * 0.42} height={G * 0.42} pointerEvents="none" />
          ))}

          {view.board.map((s, i) => {
            const { x, y } = pos(i);
            const ok = legalAt(i);
            const markable = scoring && !!s && !busy && mySeat !== null;
            const captured = last?.captured.includes(i);
            return (
              <g key={i} role="gridcell" tabIndex={ok || markable ? 0 : -1}
                aria-label={`${COLS[i % n]}${n - Math.floor(i / n)}: ${s ? `${s === myColor ? 'سنگ شما' : 'سنگ حریف'}${dead.has(i) ? ' (مرده)' : ''}` : ok ? 'خالی، می‌توانید بگذارید' : 'خالی'}`}
                className={['go-pt', ok ? 'go-pt--ok' : '', markable ? 'go-pt--mark' : '', hint === i ? 'go-pt--hint' : ''].join(' ')}
                onClick={() => { if (ok) onAction({ type: 'place', at: i }); else if (markable) onAction({ type: 'mark', at: i }); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ok) onAction({ type: 'place', at: i }); else if (markable) onAction({ type: 'mark', at: i }); } }}>
                <rect x={x - G / 2} y={y - G / 2} width={G} height={G} fill="transparent" />
                {ok && <image href={myColor === 'b' ? stoneB : stoneW} x={x - G * 0.47} y={y - G * 0.47} width={G * 0.94} height={G * 0.94} className="go-ghost" />}
                {captured && !s && <g className="go-gone" pointerEvents="none"><StoneShape x={x} y={y} c={view.turn} r={G * 0.47} /></g>}
                {s && (
                  <g key={`${i}-${s}`} className={['go-stone', last?.at === i ? 'bg-land' : '', dead.has(i) ? 'go-stone--dead' : ''].join(' ')} pointerEvents="none">
                    <StoneShape x={x} y={y} c={s} r={G * 0.47} />
                    {last?.at === i && <image href={lastArt} x={x - G * 0.28} y={y - G * 0.28} width={G * 0.56} height={G * 0.56} />}
                  </g>
                )}
                {view.ko === i && <image href={koArt} x={x - G * 0.22} y={y - G * 0.22} width={G * 0.44} height={G * 0.44} />}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      {!framed && <div className="go__actions">{passBtn}{acceptBtn}{resumeBtn}</div>}
      {!framed && view.score && view.outcome && (
        <p className="go__end" role="status">سیاه {fa(view.score.b)} — سفید {fa(view.score.w)} (با {tx(terms.komi)})</p>
      )}
    </div>
  );
}

// A number that bumps whenever it changes.
function Pop({ n, className, as: Tag = 'span', children }: { n: number; className: string; as?: 'span' | 'strong'; children: React.ReactNode }) {
  return <Tag key={n} className={`${className} ${usePop(n)}`}>{children}</Tag>;
}

function StoneShape({ x, y, c, r }: { x: number; y: number; c: Stone; r: number }) {
  return <image href={c === 'b' ? stoneB : stoneW} x={x - r} y={y - r} width={2 * r} height={2 * r} filter="url(#go-shadow)" />;
}
