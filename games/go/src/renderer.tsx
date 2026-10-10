// گو renderer: kaya wood board with ink lines and star points; slate and shell stones (SVG, LTR geometry).
// Play: tap an intersection. Scoring: tap a group to mark it dead/alive; territory and the running score are shown.
import './renderer.css';
import { useId } from 'react';
import { Button, TurnIndicator, ZoomBoard, usePop, type GameRendererProps } from '@bg/ui';
import stoneB from './art/stone-b.webp';
import stoneW from './art/stone-w.webp';
import texKaya from './art/tex-kaya.webp';
import { areaScore, play, type GoView, type Stone } from './rules.ts';

// Stones and the kaya wood are cut from a generated sheet (see DECISIONS.md).
const fa = (n: number) => n.toLocaleString('fa-IR');
const COLS = 'ABCDEFGHJKLMNOPQRST';
const STARS: Record<number, number[]> = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };

export default function GoRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<GoView>) {
  const n = real.size;
  // Undo-window preview: the own stone is already on its point and the stones it captures fade away (the client can
  // play the move out itself); undo puts everything back.
  const pv = queued?.type === 'place' && real.phase === 'play' ? play(real.board, n, queued.at as number, real.turn, []) : null;
  const view: GoView = pv && !('error' in pv)
    ? { ...real, board: pv.board, turn: real.turn === 'b' ? 'w' : 'b', last: { seat: mySeat ?? 0, at: queued!.at as number, captured: pv.captured }, captures: { ...real.captures, [real.turn]: real.captures[real.turn] + pv.captured.length }, ko: null }
    : real;
  const kaya = `go-kaya-${useId().replace(/:/g, '')}`;
  const G = 60, M = 74, SIZE = (n - 1) * G + 2 * M;
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
      : canPlace ? { tone: 'mine' as const, text: view.passes ? 'حریف پاس داد؛ بگذارید یا پاس بدهید' : 'نوبت شما: روی یک تقاطع بگذارید' }
        : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="go" data-moves={view.history.length} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="go__bar">
        {(['b', 'w'] as Stone[]).map((c) => (
          <div key={c} className={['go-side', view.turn === c && view.phase === 'play' && !view.outcome ? 'go-side--turn' : ''].join(' ')}>
            <span className={`go-side__stone go-side__stone--${c}`} aria-hidden="true" />
            <bdi className="go-side__name">{who(c)}</bdi>
            <Pop n={view.captures[c]} className="go-side__stat">اسیر {fa(view.captures[c])}{c === 'w' ? ` · کومی ${fa(view.komi)}` : ''}</Pop>
            {(live || view.score) && <Pop n={(live ?? view.score!)[c]} as="strong" className="go-side__score">{fa((live ?? view.score!)[c])}</Pop>}
            {scoring && view.accepted[seatOf(c)] && <span className="go-side__ok">تأیید کرد</span>}
          </div>
        ))}
      </div>

      <ZoomBoard label="صفحه گو">
        <svg className="go-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label={`صفحه گو ${fa(n)}×${fa(n)}`} style={{ direction: 'ltr' }}>
          <defs>
            <pattern id={kaya} width="400" height="400" patternUnits="userSpaceOnUse"><image href={texKaya} width="400" height="400" preserveAspectRatio="xMidYMid slice" /></pattern>
            <filter id="go-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="2" dy="4" stdDeviation="2.5" floodOpacity=".45" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="14" fill={`url(#${kaya})`} />
          {Array.from({ length: n }, (_, k) => (
            <g key={k} className="go-line">
              <line x1={M} y1={M + k * G} x2={M + (n - 1) * G} y2={M + k * G} />
              <line x1={M + k * G} y1={M} x2={M + k * G} y2={M + (n - 1) * G} />
              <text x={M + k * G} y={M - 42} className="go-coord">{COLS[k]}</text>
              <text x={M - 50} y={M + k * G + 7} className="go-coord">{n - k}</text>
            </g>
          ))}
          <rect x={M} y={M} width={(n - 1) * G} height={(n - 1) * G} className="go-edge" />
          {STARS[n]!.flatMap((x) => STARS[n]!.map((y) => <circle key={`${x}-${y}`} cx={M + x * G} cy={M + y * G} r="7" className="go-star" />))}

          {territory?.map((t, i) => t && (view.board[i] === null || dead.has(i)) && (
            <rect key={`t${i}`} x={pos(i).x - 11} y={pos(i).y - 11} width="22" height="22" rx="3" className={`go-terr go-terr--${t}`} />
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
                    {last?.at === i && <circle cx={x} cy={y} r={G * 0.2} className={`go-lastmark go-lastmark--${s}`} />}
                    {dead.has(i) && <path d={`M${x - 12} ${y - 12} L${x + 12} ${y + 12} M${x + 12} ${y - 12} L${x - 12} ${y + 12}`} className="go-deadmark" />}
                  </g>
                )}
                {view.ko === i && <rect x={x - 10} y={y - 10} width="20" height="20" className="go-ko" />}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      <div className="go__actions">
        {has('pass') && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>پاس</Button>}
        {has('accept') && <Button size="sm" disabled={busy} onClick={() => onAction({ type: 'accept' })}>تأیید شمارش</Button>}
        {has('resume') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction({ type: 'resume' })}>ادامه بازی</Button>}
      </div>
      {view.score && view.outcome && (
        <p className="go__end" role="status">سیاه {fa(view.score.b)} — سفید {fa(view.score.w)} (با کومی)</p>
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
