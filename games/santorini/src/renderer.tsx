// سانتورینی renderer: a whitewashed island in an Aegean sea (SVG). Towers are drawn as stacked tiers with a blue dome.
// Setup: tap a free square. Turn: tap your worker → tap a lit square to move → tap a lit square to build (a winning
// climb is sent at once). The choice is sent as one action.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { buildTargets, moveTargets, type SantoriniView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const S = 130, M = 40, SIZE = 5 * S + 2 * M;
const SEAT = ['#f3efe6', '#3d4f9e'];

export default function SantoriniRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SantoriniView>) {
  const me = mySeat ?? 0;
  const flip = me === 1;
  const xy = (i: number) => {
    const r = Math.floor(i / 5), c = i % 5;
    return { x: M + (flip ? 4 - c : c) * S + S / 2, y: M + (flip ? r : 4 - r) * S + S / 2 };
  };
  const placing = legalActions.some((a) => a.type === 'place') && !busy;
  const playing = legalActions.some((a) => a.type === 'turn') && !busy;
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const turnNo = view.history.length;
  useEffect(() => { setFrom(null); setTo(null); }, [turnNo]);
  const hint = expected?.type === 'turn' ? (expected as unknown as { from: number; to: number; build?: number }) : null;
  const occupied = (i: number) => view.workers[0].includes(i) || view.workers[1].includes(i);

  // Board as it looks after the chosen move (for build targets and drawing the ghost).
  const moved = from !== null && to !== null ? { ...view, workers: view.workers.map((ws, k) => (k === me ? ws.map((w) => (w === from ? to : w)) : ws)) as [number[], number[]] } : view;
  const lit = new Set<number>(
    placing ? Array.from({ length: 25 }, (_, i) => i).filter((i) => !occupied(i))
      : !playing ? []
        : from === null ? view.workers[me as 0 | 1].filter((w) => moveTargets(view, w).length)
          : to === null ? moveTargets(view, from)
            : buildTargets(view, from, to)
  );
  const stage = placing ? 'place' : from === null ? 'worker' : to === null ? 'move' : 'build';
  const hintSq = hint ? (stage === 'worker' ? hint.from : stage === 'move' ? hint.to : hint.build ?? null) : null;

  const tap = (i: number) => {
    if (busy) return;
    if (placing) { if (lit.has(i)) onAction({ type: 'place', at: i }); return; }
    if (!playing) return;
    if (view.workers[me as 0 | 1].includes(i) && to === null) { setFrom(from === i ? null : i); return; }
    if (!lit.has(i)) return;
    if (stage === 'move') {
      if (view.height[i] === 3 && view.height[from!] === 2) { onAction({ type: 'turn', from: from!, to: i }); return; }
      setTo(i);
    } else if (stage === 'build') onAction({ type: 'turn', from: from!, to: to!, build: i });
  };

  const last = view.history.at(-1);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    : placing ? { tone: 'mine' as const, text: `کارگر ${fa(view.workers[me as 0 | 1].length + 1)} را روی یک خانه بگذارید` }
      : playing ? { tone: 'mine' as const, text: stage === 'worker' ? 'نوبت شما: یک کارگر را بزنید' : stage === 'move' ? 'کجا برود؟' : 'کجا بسازد؟' }
        : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  return (
    <div className="sto" data-turn={turnNo} data-stage={stage}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="sto__bar">
        {[0, 1].map((s) => (
          <div key={s} className={['sto-side', view.current === s && !view.outcome ? 'sto-side--turn' : ''].join(' ')}>
            <span className="sto-side__pawn" style={{ background: SEAT[s] }} aria-hidden="true" />
            <bdi className="sto-side__name">{who(s)}</bdi>
          </div>
        ))}
        <span className="sto__supply">بلوک‌ها: {fa(view.supply[1])} · {fa(view.supply[2])} · {fa(view.supply[3])} · گنبد {fa(view.supply.dome)}</span>
      </div>

      <ZoomBoard label="جزیره سانتورینی">
        <svg className="sto-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="جزیره سانتورینی" style={{ direction: 'ltr' }}>
          <defs>
            <radialGradient id="sto-sea" cx=".5" cy=".5" r=".75"><stop offset="0" stopColor="#3aa0c8" /><stop offset="1" stopColor="#1b5f8c" /></radialGradient>
            <linearGradient id="sto-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9cc56a" /><stop offset="1" stopColor="#6f9f45" /></linearGradient>
            <linearGradient id="sto-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9d4c8" /></linearGradient>
            <radialGradient id="sto-dome" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#5d8bd8" /><stop offset=".6" stopColor="#2457b0" /><stop offset="1" stopColor="#173a7a" /></radialGradient>
            <filter id="sto-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".4" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="26" fill="url(#sto-sea)" />
          <path d={`M${M - 14} ${M + 40} Q${M - 24} ${M - 10} ${M + 50} ${M - 16} L${SIZE - M - 50} ${M - 16} Q${SIZE - M + 24} ${M - 10} ${SIZE - M + 14} ${M + 40} L${SIZE - M + 14} ${SIZE - M - 40} Q${SIZE - M + 24} ${SIZE - M + 10} ${SIZE - M - 50} ${SIZE - M + 16} L${M + 50} ${SIZE - M + 16} Q${M - 24} ${SIZE - M + 10} ${M - 14} ${SIZE - M - 40} Z`} fill="#e9dcc0" />
          <rect x={M} y={M} width={5 * S} height={5 * S} rx="10" fill="url(#sto-grass)" />

          {Array.from({ length: 25 }, (_, i) => {
            const { x, y } = xy(i);
            const isLit = lit.has(i);
            const tappable = isLit || (playing && view.workers[me as 0 | 1].includes(i));
            return (
              <g key={i} role="gridcell" tabIndex={tappable ? 0 : -1}
                aria-label={`${'abcde'[i % 5]}${Math.floor(i / 5) + 1}: ${view.height[i] === 4 ? 'گنبد' : view.height[i] ? `طبقه ${fa(view.height[i]!)}` : 'زمین'}${occupied(i) ? `، کارگر ${view.workers[me as 0 | 1].includes(i) ? 'شما' : 'حریف'}` : ''}${isLit ? '، قابل انتخاب' : ''}`}
                className={['sto-sq', isLit ? `sto-sq--lit sto-sq--${stage}` : '', from === i ? 'sto-sq--sel' : '', hintSq === i ? 'sto-sq--hint' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2 + 4} y={y - S / 2 + 4} width={S - 8} height={S - 8} rx="8" className="sto-tile" />
                <Tower x={x} y={y} h={view.height[i]!} fresh={last?.build === i} />
                {view.height[i]! > 0 && view.height[i]! < 4 && (
                  <g className="sto-level" pointerEvents="none">
                    <circle cx={x + S / 2 - 22} cy={y + S / 2 - 22} r="15" />
                    <text x={x + S / 2 - 22} y={y + S / 2 - 16}>{fa(view.height[i]!)}</text>
                  </g>
                )}
                {isLit &&<rect x={x - S / 2 + 6} y={y - S / 2 + 6} width={S - 12} height={S - 12} rx="8" className="sto-litmark" />}
              </g>
            );
          })}

          {[0, 1].flatMap((seat) => moved.workers[seat as 0 | 1].map((w, k) => {
            const { x, y } = xy(w);
            const lift = Math.min(view.height[w]!, 3) * 13;
            const ghost = seat === me && to !== null && w === to;
            const slid = last && last.to === w && last.from !== null && last.seat === seat ? xy(last.from) : null;
            return (
              <g key={`${seat}-${k}-${slid ? turnNo : 0}`} pointerEvents="none" className={['sto-worker', ghost ? 'sto-worker--ghost' : '', slid ? 'sto-worker--moved' : ''].join(' ')}
                style={slid ? { ['--dx' as string]: `${slid.x - x}px`, ['--dy' as string]: `${slid.y - y}px` } : undefined}>
                <g transform={`translate(${x} ${y - 6 - lift}) scale(1.3)`} filter="url(#sto-shadow)">
                  <ellipse cx="0" cy="26" rx="20" ry="7" fill="rgb(0 0 0 / .25)" />
                  <path d="M-16 24 Q-18 4 -8 -2 A12 12 0 1 1 8 -2 Q18 4 16 24 Z" fill={SEAT[seat]} stroke={seat === 0 ? '#9a917e' : '#1f2b66'} strokeWidth="2.5" />
                  <ellipse cx="-4" cy="-16" rx="4" ry="2.5" fill="#fff" opacity=".55" />
                </g>
              </g>
            );
          }))}
        </svg>
      </ZoomBoard>

      <div className="sto__actions">
        {(from !== null || to !== null) && !busy && <Button size="sm" variant="ghost" onClick={() => { setFrom(null); setTo(null); }}>انتخاب دوباره</Button>}
      </div>
      {view.end && <p className="sto__end" role="status">{{ climb: 'به طبقه سوم رسید!', stuck: 'حریف حرکتی نداشت', resign: 'انصراف', timeout: 'اتمام زمان' }[view.end.kind]}</p>}
    </div>
  );
}

/** Stacked tiers: each level smaller and lifted; level 3 has columns; a dome caps it. */
function Tower({ x, y, h, fresh }: { x: number; y: number; h: number; fresh: boolean }) {
  if (!h) return null;
  const tiers = Math.min(h, 3);
  return (
    <g className={fresh ? 'sto-tower sto-tower--fresh' : 'sto-tower'} filter="url(#sto-shadow)" pointerEvents="none">
      {Array.from({ length: tiers }, (_, k) => {
        const w = 104 - k * 22;
        const ty = y - k * 13;
        return (
          <g key={k}>
            <rect x={x - w / 2} y={ty - w / 2 + 8} width={w} height={w} rx="6" fill="#bdb6a6" />
            <rect x={x - w / 2} y={ty - w / 2} width={w} height={w} rx="6" fill="url(#sto-stone)" stroke="#b9b2a3" strokeWidth="2" />
            {k === 2 && [-1, 1].flatMap((sx) => [-1, 1].map((sy) => <rect key={`${sx}${sy}`} x={x + sx * 20 - 4} y={ty + sy * 20 - 4} width="8" height="8" rx="2" fill="#cfc8b8" />))}
          </g>
        );
      })}
      {h === 4 && <circle cx={x} cy={y - 34} r="24" fill="url(#sto-dome)" stroke="#173a7a" strokeWidth="2" />}
    </g>
  );
}
