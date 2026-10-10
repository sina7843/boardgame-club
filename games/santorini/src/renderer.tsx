// سانتورینی renderer: a whitewashed island in an Aegean sea (SVG). Towers are stacked tiers with a painted blue dome (art cut from a generated sheet, see DECISIONS.md).
// Setup: tap a free square. Turn: tap your worker → tap a lit square to move → tap a lit square to build (a winning
// climb is sent at once). The choice is sent as one action.
import './renderer.css';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFlip, type GameRendererProps } from '@bg/ui';
import { DOME, SEA, STONE, WORKER_SRC } from './pieces.ts';
import { buildTargets, moveTargets, type SantoriniView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const S = 130, M = 40, SIZE = 5 * S + 2 * M;

type Queued = { type: string; at?: number; from?: number; to?: number; build?: number };

/** My queued placement / move + build applied at once (nothing hidden in Santorini). */
function preview(v: SantoriniView, q: Queued | null | undefined, me: number): SantoriniView {
  if (!q || me < 0) return v;
  const seat = me as 0 | 1;
  if (q.type === 'place' && q.at !== undefined) return { ...v, workers: v.workers.map((ws, k) => (k === seat ? [...ws, q.at!] : ws)) as [number[], number[]] };
  if (q.type !== 'turn' || q.from === undefined || q.to === undefined) return v;
  const workers = v.workers.map((ws, k) => (k === seat ? ws.map((w) => (w === q.from ? q.to! : w)) : ws)) as [number[], number[]];
  if (q.build === undefined) return { ...v, workers };
  const h = v.height[q.build]!, supply = { ...v.supply };
  if (h === 3) supply.dome -= 1; else supply[(h + 1) as 1 | 2 | 3] -= 1;
  return { ...v, workers, supply, height: v.height.map((x, i) => (i === q.build ? x + 1 : x)) };
}

export default function SantoriniRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SantoriniView>) {
  const me = mySeat ?? 0;
  const q = queued as Queued | null | undefined;
  const view = preview(served, q, mySeat ?? -1);
  const uid = useId();
  const seaId = `sto-sea-${uid}`, stoneId = `sto-plaster-${uid}`;
  const flip = me === 1;
  const xy = (i: number) => {
    const r = Math.floor(i / 5), c = i % 5;
    return { x: M + (flip ? 4 - c : c) * S + S / 2, y: M + (flip ? r : 4 - r) * S + S / 2 };
  };
  const placing = legalActions.some((a) => a.type === 'place') && !busy;
  const playing = legalActions.some((a) => a.type === 'turn') && !busy;
  const [from, setFrom] = useState<number | null>(null);
  const [picked, setTo] = useState<number | null>(null);
  const to = q ? null : picked; // while my move is queued the board already shows it, not the half-made selection
  const turnNo = view.history.length;
  useEffect(() => { setFrom(null); setTo(null); }, [turnNo]);
  // Workers keep their motion id (seat + index) as they move, so moves glide square to square (the chosen square
  // before building, my queued move at once, undo back); new workers come in from their player's badge.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${turnNo}|${q ? JSON.stringify(q) : ''}|${to}`);
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
  const built = q?.type === 'turn' ? q.build : last?.build;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : placing ? { tone: 'mine' as const, text: `کارگر ${fa(view.workers[me as 0 | 1].length + 1)} را روی یک خانه بگذارید` }
      : playing ? { tone: 'mine' as const, text: stage === 'worker' ? 'نوبت شما: یک کارگر را بزنید' : stage === 'move' ? 'کجا برود؟' : 'کجا بسازد؟' }
        : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  return (
    <div className="sto" data-turn={turnNo} data-stage={stage} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="sto__bar">
        {[0, 1].map((s) => (
          <div key={s} data-flip-anchor={`side-${s}`} className={['sto-side', view.current === s && !view.outcome ? 'sto-side--turn' : ''].join(' ')}>
            <img className="sto-side__pawn" src={WORKER_SRC[s]} alt="" />
            <bdi className="sto-side__name">{who(s)}</bdi>
          </div>
        ))}
        <span className="sto__supply">بلوک‌ها: {fa(view.supply[1])} · {fa(view.supply[2])} · {fa(view.supply[3])} · گنبد {fa(view.supply.dome)}</span>
      </div>

      <ZoomBoard label="جزیره سانتورینی">
        <svg className="sto-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="جزیره سانتورینی" style={{ direction: 'ltr' }}>
          <defs>
            <pattern id={seaId} patternUnits="userSpaceOnUse" width="390" height="390"><image href={SEA} width="390" height="390" preserveAspectRatio="none" /></pattern>
            <pattern id={stoneId} patternUnits="userSpaceOnUse" width="130" height="130"><image href={STONE} width="130" height="130" preserveAspectRatio="none" /></pattern>
            <linearGradient id="sto-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9cc56a" /><stop offset="1" stopColor="#6f9f45" /></linearGradient>
            <linearGradient id="sto-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9d4c8" /></linearGradient>
            <filter id="sto-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity=".4" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="26" fill={`url(#${seaId})`} />
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
                <rect x={x - S / 2 + 4} y={y - S / 2 + 4} width={S - 8} height={S - 8} rx="8" fill={`url(#${stoneId})`} />
                <rect x={x - S / 2 + 4} y={y - S / 2 + 4} width={S - 8} height={S - 8} rx="8" className="sto-tile" />
                <Tower x={x} y={y} h={view.height[i]!} fresh={built === i} />
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
            return (
              <g key={`${seat}-${k}`} pointerEvents="none" data-flip={`w${seat}-${k}`} data-flip-from={`side-${seat}`} className={['sto-worker', ghost ? 'sto-worker--ghost' : ''].join(' ')}>
                <image href={WORKER_SRC[seat]} x={x - 48} y={y - 64 - lift} width="96" height="96" filter="url(#sto-shadow)" />
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
    <g className="sto-tower" filter="url(#sto-shadow)" pointerEvents="none">
      {Array.from({ length: tiers }, (_, k) => {
        const w = 104 - k * 22;
        const ty = y - k * 13;
        return (
          <g key={k} className={fresh && h < 4 && k === tiers - 1 ? 'bg-land' : undefined}>
            <rect x={x - w / 2} y={ty - w / 2 + 8} width={w} height={w} rx="6" fill="#bdb6a6" />
            <rect x={x - w / 2} y={ty - w / 2} width={w} height={w} rx="6" fill="url(#sto-stone)" stroke="#b9b2a3" strokeWidth="2" />
            {k === 2 && [-1, 1].flatMap((sx) => [-1, 1].map((sy) => <rect key={`${sx}${sy}`} x={x + sx * 20 - 4} y={ty + sy * 20 - 4} width="8" height="8" rx="2" fill="#cfc8b8" />))}
          </g>
        );
      })}
      {h === 4 && <image href={DOME} x={x - 50} y={y - 78} width="100" height="100" className={fresh ? 'bg-land' : undefined} />}
    </g>
  );
}
