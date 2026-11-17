// سانتورینی renderer: a whitewashed island in an Aegean sea (SVG). Towers are stacked tiers with a painted blue dome (art cut from a generated sheet, see DECISIONS.md).
// Setup: tap a free square. Turn: tap your worker → tap a lit square to move → tap a lit square to build (a winning
// climb is sent at once). The choice is sent as one action.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useFlip, useInFrame, type GameRendererProps } from '@bg/ui';
import { ISLAND, TOWER, WORKER_SRC } from './pieces.ts';
import { buildTargets, moveTargets, type SantoriniView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// Geometry in the island art's own pixels (712x742): the 5x5 grid sits at 45,60 with 124.4px squares.
const W = 712, H = 742, X0 = 45, Y0 = 60, S = 124.4;

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
  const framed = useInFrame() !== null; // the shell draws players, turn and the move log
  const flip = me === 1;
  const xy = (i: number) => {
    const r = Math.floor(i / 5), c = i % 5;
    return { x: X0 + (flip ? 4 - c : c) * S + S / 2, y: Y0 + (flip ? r : 4 - r) * S + S / 2 };
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
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!framed && (
        <div className="sto__bar">
          {[0, 1].map((s) => (
            <div key={s} data-flip-anchor={`side-${s}`} className={['sto-side', view.current === s && !view.outcome ? 'sto-side--turn' : ''].join(' ')}>
              <img className="sto-side__pawn" src={WORKER_SRC[s]} alt="" />
              <bdi className="sto-side__name">{who(s)}</bdi>
            </div>
          ))}
        </div>
      )}
      {framed ? (
        <RailSlot>
          <p>{stage === 'place' ? <>کارگرها را روی <b>خانه‌های خالی</b> بگذارید.</>
            : stage === 'build' ? <>حالا روی یکی از خانه‌های کنار کارگر <b>بسازید</b>؛ طبقهٔ چهارم گنبد است.</>
              : <>اول <b>حرکت</b> (یک خانه، حداکثر یک طبقه بالاتر)، بعد <b>ساخت</b>. رسیدن به طبقهٔ سوم یعنی برد.</>}</p>
          <p>قطعه‌های مانده: طبقهٔ اول {fa(view.supply[1])}، دوم {fa(view.supply[2])}، سوم {fa(view.supply[3])}، گنبد {fa(view.supply.dome)}</p>
        </RailSlot>
      ) : <span className="sto__supply">بلوک‌ها: {fa(view.supply[1])}<span className="bgv-sep" />{fa(view.supply[2])}<span className="bgv-sep" />{fa(view.supply[3])}<span className="bgv-sep" />گنبد {fa(view.supply.dome)}</span>}

      <ZoomBoard label="جزیره سانتورینی">
        <svg className="sto-board" viewBox={`0 0 ${W} ${H}`} role="grid" aria-label="جزیره سانتورینی" style={{ direction: 'ltr' }}>
          <image href={ISLAND} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />

          {Array.from({ length: 25 }, (_, i) => {
            const { x, y } = xy(i);
            const isLit = lit.has(i);
            const tappable = isLit || (playing && view.workers[me as 0 | 1].includes(i));
            return (
              <g key={i} role="gridcell" tabIndex={tappable ? 0 : -1}
                aria-label={`${'abcde'[i % 5]}${Math.floor(i / 5) + 1}: ${view.height[i] === 4 ? 'گنبد' : view.height[i] ? `طبقه ${fa(view.height[i]!)}` : 'زمین'}${occupied(i) ? `، کارگر ${view.workers[me as 0 | 1].includes(i) ? 'شما' : 'حریف'}` : ''}${isLit ? '، قابل انتخاب' : ''}`}
                className={['sto-sq', isLit ? `sto-sq--lit sto-sq--${stage}` : '', from === i ? 'sto-sq--sel' : '', hintSq === i ? 'sto-sq--hint' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2} y={y - S / 2} width={S} height={S} className="sto-tile" />
                <Tower x={x} y={y} h={view.height[i]!} fresh={built === i} />
                {view.height[i]! > 0 && view.height[i]! < 4 && (
                  <g className="sto-level" pointerEvents="none">
                    <circle cx={x - S / 2 + 18} cy={y - S / 2 + 18} r="12" />
                    <text x={x - S / 2 + 18} y={y - S / 2 + 23}>{fa(view.height[i]!)}</text>
                  </g>
                )}
                {isLit && <circle cx={x} cy={y} r={stage === 'build' ? S * 0.16 : S * 0.15} className={stage === 'build' ? 'sto-litmark sto-litmark--build' : 'sto-litmark'} />}
              </g>
            );
          })}

          {[0, 1].flatMap((seat) => moved.workers[seat as 0 | 1].map((w, k) => {
            const { x, y } = xy(w);
            const lift = (0.16 + Math.min(view.height[w]!, 3) * 0.08) * S;
            const ghost = seat === me && to !== null && w === to;
            return (
              <g key={`${seat}-${k}`} pointerEvents="none" data-flip={`w${seat}-${k}`} data-flip-from={`side-${seat}`} className={['sto-worker', ghost ? 'sto-worker--ghost' : ''].join(' ')}>
                <image href={WORKER_SRC[seat]} x={x - 0.33 * S} y={y + S / 2 - lift - 0.66 * S} width={0.66 * S} height={0.66 * S} className="sto-worker__img" />
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

/** The design's tower art for this level (4 = domed), standing on the square. */
function Tower({ x, y, h, fresh }: { x: number; y: number; h: number; fresh: boolean }) {
  const src = TOWER[h];
  if (!src) return null;
  const w = 1.18 * S, ht = (w * 352) / 312;
  return <image href={src} x={x - w / 2} y={y + S / 2 - 0.02 * S - ht} width={w} height={ht} className={fresh ? 'sto-tower bg-land' : 'sto-tower'} pointerEvents="none" />;
}
