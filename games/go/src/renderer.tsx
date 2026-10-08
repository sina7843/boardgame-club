// گو renderer: kaya wood board with ink lines and star points; slate and shell stones (SVG, LTR geometry).
// Play: tap an intersection. Scoring: tap a group to mark it dead/alive; territory and the running score are shown.
import './renderer.css';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { areaScore, play, type GoView, type Stone } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const COLS = 'ABCDEFGHJKLMNOPQRST';
const STARS: Record<number, number[]> = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };

export default function GoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<GoView>) {
  const n = view.size;
  const G = 60, M = 74, SIZE = (n - 1) * G + 2 * M;
  const pos = (i: number) => ({ x: M + (i % n) * G, y: M + Math.floor(i / n) * G });
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const canPlace = has('place') && !busy;
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
            <span className="go-side__stat">اسیر {fa(view.captures[c])}{c === 'w' ? ` · کومی ${fa(view.komi)}` : ''}</span>
            {(live || view.score) && <strong className="go-side__score">{fa((live ?? view.score!)[c])}</strong>}
            {scoring && view.accepted[seatOf(c)] && <span className="go-side__ok">تأیید کرد</span>}
          </div>
        ))}
      </div>

      <ZoomBoard label="صفحه گو">
        <svg className="go-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label={`صفحه گو ${fa(n)}×${fa(n)}`} style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="go-kaya" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9c27a" /><stop offset=".5" stopColor="#dcae62" /><stop offset="1" stopColor="#c99848" /></linearGradient>
            <pattern id="go-grain" width="220" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 10 Q55 4 110 12 T220 10 M0 28 Q60 22 120 30 T220 27" fill="none" stroke="#b9873b" strokeWidth="2" opacity=".25" />
            </pattern>
            <radialGradient id="go-b" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#6b6e73" /><stop offset=".4" stopColor="#25272a" /><stop offset="1" stopColor="#050506" /></radialGradient>
            <radialGradient id="go-w" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".65" stopColor="#efede6" /><stop offset="1" stopColor="#c3bfb3" /></radialGradient>
            <filter id="go-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="2" dy="4" stdDeviation="2.5" floodOpacity=".45" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="14" fill="url(#go-kaya)" />
          <rect width={SIZE} height={SIZE} rx="14" fill="url(#go-grain)" />
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
                {ok && <circle cx={x} cy={y} r={G * 0.45} className={`go-ghost go-ghost--${myColor}`} />}
                {captured && !s && <g className="go-gone" pointerEvents="none"><StoneShape x={x} y={y} c={view.turn} r={G * 0.47} /></g>}
                {s && (
                  <g key={`${i}-${s}`} className={['go-stone', last?.at === i ? 'go-stone--new' : '', dead.has(i) ? 'go-stone--dead' : ''].join(' ')} pointerEvents="none">
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

function StoneShape({ x, y, c, r }: { x: number; y: number; c: Stone; r: number }) {
  return (
    <g filter="url(#go-shadow)">
      <circle cx={x} cy={y} r={r} fill={c === 'b' ? 'url(#go-b)' : 'url(#go-w)'} />
      {c === 'w' && <path d={`M${x - r * 0.7} ${y - r * 0.2} Q${x} ${y - r * 0.45} ${x + r * 0.7} ${y - r * 0.2} M${x - r * 0.75} ${y + r * 0.15} Q${x} ${y - r * 0.08} ${x + r * 0.75} ${y + r * 0.15}`} fill="none" stroke="#d8d3c5" strokeWidth="1.5" opacity=".7" />}
      <ellipse cx={x - r * 0.32} cy={y - r * 0.38} rx={r * 0.3} ry={r * 0.14} fill="#fff" opacity={c === 'b' ? 0.18 : 0.6} transform={`rotate(-30 ${x - r * 0.32} ${y - r * 0.38})`} />
    </g>
  );
}
