// تاک renderer: walnut board, birch and ebony stones drawn as stacks (SVG, LTR geometry).
// Place: pick flat / wall / capstone and tap an empty square. Move: tap your stack, choose how many to lift, then tap
// squares along one line — tap the current square again to drop another stone there; the move is sent when the
// hand is empty.
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { allMoves, step, type Color, type Dir, type Kind, type Stone, type TakView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const S = 130, M = 36;
const KIND_FA: Record<Kind, string> = { F: 'سنگ تخت', S: 'دیوار', C: 'سرستون' };

export default function TakRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<TakView>) {
  const n = view.size;
  const SIZE = n * S + 2 * M;
  const me = mySeat ?? 0;
  const myColor: Color = view.colors[me]!;
  const flip = myColor === 'b';
  const xy = (i: number) => {
    const r = Math.floor(i / n), c = i % n;
    return { x: M + (flip ? n - 1 - c : c) * S + S / 2, y: M + (flip ? r : n - 1 - r) * S + S / 2 };
  };
  const canPlace = legalActions.some((a) => a.type === 'place') && !busy;
  const canMove = legalActions.some((a) => a.type === 'move') && !busy;
  const opening = view.ply < 2;
  const reserve = view.reserve[opening ? (myColor === 'w' ? 'b' : 'w') : myColor];
  const [kind, setKind] = useState<Kind>('F');
  const [sel, setSel] = useState<{ from: number; lift: number; dir: Dir | null; drops: number[] } | null>(null);
  const plyKey = view.ply;
  useEffect(() => { setSel(null); }, [plyKey]);
  const hint = expected?.type === 'place' ? (expected as unknown as { at: number; kind: Kind }) : null;
  useEffect(() => { if (hint) setKind(hint.kind); }, [hint?.at, hint?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if ((kind === 'C' && !reserve.caps) || (kind !== 'C' && !reserve.stones)) setKind(reserve.stones ? 'F' : 'C'); }, [reserve.caps, reserve.stones, kind]);

  const moves = useMemo(() => (canMove ? allMoves(view, myColor) : []), [canMove, view, myColor]);
  const movable = new Set(moves.map((m) => m.from));
  const cands = sel ? moves.filter((m) => m.from === sel.from && m.drops.reduce((a, b) => a + b, 0) === sel.lift && (!sel.dir || m.dir === sel.dir)) : [];
  const fits = (drops: number[], dir: Dir) => cands.some((m) => m.dir === dir && drops.every((d, k) => (k < drops.length - 1 ? m.drops[k] === d : (m.drops[k] ?? 0) >= d)));
  // Squares that continue the current move.
  const cursor = sel ? sel.drops.reduce((at) => step(at, sel.dir!, n)!, sel.from) : null;
  const moveTargets = new Map<number, () => void>();
  if (sel) {
    if (!sel.dir) {
      for (const d of ['n', 's', 'e', 'w'] as Dir[]) {
        const j = step(sel.from, d, n);
        if (j !== null && fits([1], d)) moveTargets.set(j, () => drop(d, [1]));
      }
    } else {
      const here = [...sel.drops.slice(0, -1), sel.drops.at(-1)! + 1];
      if (fits(here, sel.dir) && sel.drops.reduce((a, b) => a + b, 0) < sel.lift) moveTargets.set(cursor!, () => drop(sel.dir!, here));
      const nxt = step(cursor!, sel.dir, n);
      if (nxt !== null && fits([...sel.drops, 1], sel.dir) && sel.drops.reduce((a, b) => a + b, 0) < sel.lift) moveTargets.set(nxt, () => drop(sel.dir!, [...sel.drops, 1]));
    }
  }
  function drop(dir: Dir, drops: number[]) {
    if (!sel) return;
    if (drops.reduce((a, b) => a + b, 0) === sel.lift) { onAction({ type: 'move', from: sel.from, dir, drops }); setSel(null); return; }
    setSel({ ...sel, dir, drops });
  }

  const tap = (i: number) => {
    if (busy) return;
    const target = moveTargets.get(i);
    if (target) return target();
    if (sel && i === sel.from) return setSel(null);
    if (canMove && movable.has(i) && !sel) return setSel({ from: i, lift: 1, dir: null, drops: [] });
    if (canPlace && !view.board[i]!.length && !sel) onAction({ type: 'place', at: i, kind: opening ? 'F' : kind });
  };

  const road = new Set(view.end?.road ?? []);
  const last = view.history.at(-1);
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const status = view.outcome ? null
    : canPlace ? { tone: 'mine' as const, text: opening ? 'اولین نوبت: یک سنگ تخت حریف را بگذارید' : sel ? (sel.dir ? `${fa(sel.lift - sel.drops.reduce((a, b) => a + b, 0))} سنگ در دست؛ خانه بعدی را بزنید` : 'تعداد را انتخاب کنید و جهت را بزنید') : 'نوبت شما: بگذارید یا پشته‌ای را جابه‌جا کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="tak" data-ply={view.ply}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="tak__bar">
        {(['w', 'b'] as Color[]).map((c) => (
          <div key={c} className={['tak-side', view.turn === c && !view.outcome ? 'tak-side--turn' : ''].join(' ')}>
            <span className={`tak-side__chip tak-side__chip--${c}`} aria-hidden="true" />
            <bdi className="tak-side__name">{who(c)}</bdi>
            <span className="tak-side__stat">{fa(view.reserve[c].stones)} سنگ{view.reserve[c].caps ? ` · ${fa(view.reserve[c].caps)} سرستون` : ''}</span>
          </div>
        ))}
      </div>

      <ZoomBoard label="صفحه تاک">
        <svg className="tak-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه تاک" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="tak-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b3a1e" /><stop offset="1" stopColor="#2b190c" /></linearGradient>
            <linearGradient id="tak-sq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a33" /><stop offset="1" stopColor="#6b4223" /></linearGradient>
            <linearGradient id="tak-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf1dc" /><stop offset="1" stopColor="#d9c39a" /></linearGradient>
            <linearGradient id="tak-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4038" /><stop offset="1" stopColor="#15110d" /></linearGradient>
            <filter id="tak-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".45" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="20" fill="url(#tak-frame)" />
          {view.board.map((stack, i) => {
            const { x, y } = xy(i);
            const lit = moveTargets.has(i) || (!sel && ((canPlace && !stack.length) || (canMove && movable.has(i))));
            const isHint = hint?.at === i;
            return (
              <g key={i} role="gridcell" tabIndex={lit ? 0 : -1}
                aria-label={`${'abcdef'[i % n]}${Math.floor(i / n) + 1}: ${stack.length ? `${fa(stack.length)} سنگ، بالایی ${KIND_FA[stack.at(-1)!.t]} ${stack.at(-1)!.c === myColor ? 'شما' : 'حریف'}` : 'خالی'}${moveTargets.has(i) ? '، گذاشتن سنگ اینجا' : ''}`}
                className={['tak-sq', lit ? 'tak-sq--lit' : '', moveTargets.has(i) ? 'tak-sq--drop' : '', sel?.from === i ? 'tak-sq--sel' : '', road.has(i) ? 'tak-sq--road' : '', isHint ? 'tak-sq--hint' : '',
                  last && ((last.t === 'place' && last.at === i) || (last.t === 'move' && last.from === i)) ? 'tak-sq--last' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2 + 5} y={y - S / 2 + 5} width={S - 10} height={S - 10} rx="10" fill="url(#tak-sq)" className="tak-sq__bg" />
                <StackShape x={x} y={y} stack={stack} lifted={sel?.from === i ? sel.lift : 0} />
                {stack.length > 1 && <text x={x + S / 2 - 18} y={y + S / 2 - 14} className="tak-height">{fa(stack.length)}</text>}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      <div className="tak__tools">
        {sel ? (
          <>
            {!sel.dir && (
              <span className="tak__lift" role="group" aria-label="تعداد سنگ برای برداشتن">
                برداشتن:
                {Array.from({ length: Math.min(view.board[sel.from]!.length, n) }, (_, k) => k + 1).filter((k) => moves.some((m) => m.from === sel.from && m.drops.reduce((a, b) => a + b, 0) === k)).map((k) => (
                  <button key={k} type="button" aria-pressed={sel.lift === k} onClick={() => setSel({ ...sel, lift: k })}>{fa(k)}</button>
                ))}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSel(null)}>انصراف</Button>
          </>
        ) : canPlace && !opening && (
          <span className="tak__kinds" role="group" aria-label="نوع سنگ">
            {(['F', 'S', 'C'] as Kind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} disabled={k === 'C' ? !reserve.caps : !reserve.stones} onClick={() => setKind(k)}>
                <span className={`tak-kind tak-kind--${k} tak-kind--${myColor}`} aria-hidden="true" />{KIND_FA[k]}
              </button>
            ))}
          </span>
        )}
      </div>
      {view.end && <p className="tak__end" role="status">{view.end.kind === 'road' ? 'جاده کامل شد!' : view.end.kind === 'flats' ? `شمارش سنگ‌های تخت: سفید ${fa(view.end.flats!.w)} — سیاه ${fa(view.end.flats!.b)}` : view.end.kind === 'resign' ? 'انصراف' : 'اتمام زمان'}</p>}
    </div>
  );
}

function StackShape({ x, y, stack, lifted }: { x: number; y: number; stack: Stone[]; lifted: number }) {
  if (!stack.length) return null;
  const shown = stack.slice(-7);
  const base = stack.length - shown.length;
  return (
    <g filter="url(#tak-shadow)" pointerEvents="none">
      {shown.map((st, k) => {
        const idx = base + k;
        // Each layer is a square tile seen from above, lifted a little so the stack reads as a pile.
        const up = k * 8 + (idx >= stack.length - lifted ? 18 : 0);
        const cy = y + 10 - up;
        const fill = st.c === 'w' ? 'url(#tak-w)' : 'url(#tak-b)';
        const edge = st.c === 'w' ? '#b49a6d' : '#000';
        const isTop = k === shown.length - 1;
        if (isTop && st.t === 'S') return <g key={k}><rect x={x - 14} y={cy - 40} width="28" height="62" rx="5" fill={edge} transform={`rotate(-22 ${x} ${cy - 9})`} /><rect x={x - 14} y={cy - 46} width="28" height="62" rx="5" fill={fill} stroke={edge} strokeWidth="2" transform={`rotate(-22 ${x} ${cy - 15})`} /></g>;
        if (isTop && st.t === 'C') return <g key={k}><circle cx={x} cy={cy - 2} r="30" fill={edge} /><circle cx={x} cy={cy - 8} r="30" fill={fill} stroke={edge} strokeWidth="2" /><circle cx={x - 9} cy={cy - 18} r="9" fill="#fff" opacity={st.c === 'w' ? 0.55 : 0.15} /></g>;
        return <g key={k}><rect x={x - 36} y={cy - 30} width="72" height="66" rx="10" fill={edge} /><rect x={x - 36} y={cy - 36} width="72" height="66" rx="10" fill={fill} stroke={edge} strokeWidth="1.5" /></g>;
      })}
    </g>
  );
}
