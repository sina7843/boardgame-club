// کندو renderer: hexagonal tiles with drawn bugs on a felt table; the view fits the hive as it grows.
// Place: tap a bug in your reserve, then a lit spot. Move: tap one of your pieces, then a lit destination.
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import { TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { DIRS, START_RESERVE, destinations, key, parse, placements, type Bug, type Color, type Hex, type HiveView, type Piece } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const R = 46;
const BUG_FA: Record<Bug, string> = { Q: 'ملکه زنبور', S: 'عنکبوت', B: 'سوسک', G: 'ملخ', A: 'مورچه' };
const BUG_COLOR: Record<Bug, string> = { Q: '#e0a526', S: '#8a5a2b', B: '#7d4fb0', G: '#3fa34d', A: '#2f80c9' };
const px = ([q, r]: Hex) => ({ x: R * Math.sqrt(3) * (q + r / 2), y: R * 1.5 * r });
const hexPoints = (x: number, y: number, rr: number) => Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
}).join(' ');

export default function HiveRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<HiveView>) {
  const me = mySeat ?? 0;
  const myColor: Color = view.colors[me]!;
  const canPlace = legalActions.some((a) => a.type === 'place') && !busy;
  const canMove = legalActions.some((a) => a.type === 'move') && !busy;
  const [bug, setBug] = useState<Bug | null>(null);
  const [from, setFrom] = useState<Hex | null>(null);
  useEffect(() => { setBug(null); setFrom(null); }, [view.turnNo, view.history.length]);
  const mustQueen = view.reserve[myColor].Q > 0 && view.placed[myColor] === 3;
  const hint = expected as unknown as ({ type: 'place'; bug: Bug; to: Hex } | { type: 'move'; from: Hex; to: Hex }) | null;
  useEffect(() => { if (hint?.type === 'place') setBug(hint.bug); }, [hint?.type === 'place' ? hint.bug : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const spots = useMemo(() => (canPlace && bug ? placements(view, myColor) : []), [canPlace, bug, view, myColor]);
  const dests = useMemo(() => (canMove && from ? destinations(view, from) : []), [canMove, from, view]);
  const targets = new Map<string, Hex>([...spots, ...dests].map((h) => [key(h), h]));

  // Fit the view: every occupied hex, every target, and one ring around.
  const cells = Object.keys(view.stacks).map(parse);
  const all = [...cells, ...targets.values(), ...cells.flatMap((c) => DIRS.map(([dq, dr]) => [c[0] + dq, c[1] + dr] as Hex))];
  if (!all.length) all.push([0, 0]);
  const pts = all.map(px);
  const minX = Math.min(...pts.map((p) => p.x)) - R * 1.4, maxX = Math.max(...pts.map((p) => p.x)) + R * 1.4;
  const minY = Math.min(...pts.map((p) => p.y)) - R * 1.4, maxY = Math.max(...pts.map((p) => p.y)) + R * 1.4;
  const w = Math.max(maxX - minX, R * 8), h = Math.max(maxY - minY, R * 6);
  const vb = `${(minX + maxX) / 2 - w / 2} ${(minY + maxY) / 2 - h / 2} ${w} ${h}`;

  const tapCell = (hx: Hex) => {
    if (busy) return;
    const t = targets.get(key(hx));
    if (t) {
      if (bug && spots.some((s) => key(s) === key(hx))) onAction({ type: 'place', bug, to: hx });
      else if (from) onAction({ type: 'move', from, to: hx });
      return;
    }
    const topPiece = view.stacks[key(hx)]?.at(-1);
    if (canMove && topPiece?.c === myColor) { setBug(null); setFrom(from && key(from) === key(hx) ? null : hx); }
  };

  const last = view.history.at(-1);
  const lastTo = last && last.t !== 'pass' ? key(last.to) : null;
  const lastFrom = last?.t === 'move' ? px(last.from) : null;
  const surrounded = new Set(view.end?.surrounded ?? []);
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const lastPass = last?.t === 'pass' ? last : null;
  const status = view.outcome ? null
    : canPlace || canMove ? { tone: 'mine' as const, text: mustQueen ? 'نوبت چهارم: باید ملکه را بگذارید' : bug ? `جای ${BUG_FA[bug]} را انتخاب کنید` : from ? 'مقصد را بزنید' : 'نوبت شما: بگذارید یا حرکت دهید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="hv" data-turn={view.turnNo}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <Reserve view={view} color={myColor === 'w' ? 'b' : 'w'} label={`ذخیره ${who(myColor === 'w' ? 'b' : 'w')}`} small />

      <ZoomBoard label="کندو">
        <svg className="hv-board" viewBox={vb} role="grid" aria-label="کندو" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="hv-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#ddd2bc" /></linearGradient>
            <linearGradient id="hv-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3c3833" /><stop offset="1" stopColor="#141210" /></linearGradient>
            <filter id="hv-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".5" /></filter>
          </defs>
          {[...targets.values()].map((hx) => {
            const { x, y } = px(hx);
            const isHint = hint && key(hint.to) === key(hx);
            return (
              <g key={`t${key(hx)}`} role="button" tabIndex={0} aria-label={`خانه ${key(hx)}، ${bug ? 'جای گذاشتن' : 'مقصد'}`}
                className={isHint ? 'hv-target hv-target--hint' : 'hv-target'} onClick={() => tapCell(hx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                <polygon points={hexPoints(x, y, R * 0.92)} />
              </g>
            );
          })}
          {Object.entries(view.stacks).map(([k, stack]) => {
            const hx = parse(k);
            const { x, y } = px(hx);
            const topPiece = stack.at(-1)!;
            const mine = topPiece.c === myColor && canMove;
            const isSel = from && key(from) === k;
            const isHint = hint?.type === 'move' && !from && key(hint.from) === k;
            const slide = lastTo === k && lastFrom ? { ['--dx' as string]: `${lastFrom.x - x}px`, ['--dy' as string]: `${lastFrom.y - y}px` } : undefined;
            return (
              <g key={`${k}-${lastTo === k ? view.history.length : 0}`} role="gridcell" tabIndex={mine ? 0 : -1}
                aria-label={`${BUG_FA[topPiece.t]} ${topPiece.c === myColor ? 'شما' : 'حریف'}${stack.length > 1 ? `، ${fa(stack.length)} مهره روی هم` : ''}${isSel ? '، انتخاب‌شده' : ''}`}
                className={['hv-cell', mine ? 'hv-cell--mine' : '', isSel ? 'hv-cell--sel' : '', isHint ? 'hv-cell--hint' : '', lastTo === k ? (slide ? 'hv-cell--moved' : 'hv-cell--placed') : '',
                  topPiece.t === 'Q' && surrounded.has(topPiece.c) ? 'hv-cell--trapped' : ''].join(' ')}
                style={slide} onClick={() => tapCell(hx)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                {stack.length > 1 && <polygon points={hexPoints(x + 5, y + 7, R * 0.9)} className={`hv-under hv-under--${stack.at(-2)!.c}`} />}
                <Tile x={x} y={y} p={topPiece} />
                {stack.length > 1 && <text x={x + R * 0.55} y={y - R * 0.45} className="hv-height">{fa(stack.length)}</text>}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      <Reserve view={view} color={myColor} label="ذخیره شما" selected={bug} onPick={canPlace ? (b) => { setFrom(null); setBug(bug === b ? null : b); } : undefined}
        only={mustQueen ? 'Q' : undefined} hint={hint?.type === 'place' ? hint.bug : undefined} />
      {lastPass && !view.outcome && <p className="hv__note" role="status">{lastPass.seat === mySeat ? 'کاری نداشتید؛ نوبتتان رد شد' : `${seatName(lastPass.seat)} کاری نداشت و نوبتش رد شد`}</p>}
      {view.end && <p className="hv__end" role="status">{{ queen: 'ملکه محاصره شد!', draw: 'مساوی', resign: 'انصراف', timeout: 'اتمام زمان', limit: '۳۰۰ نوبت بدون نتیجه — مساوی' }[view.end.kind]}</p>}
    </div>
  );
}

function Reserve({ view, color, label, selected, onPick, only, hint, small }: { view: HiveView; color: Color; label: string; selected?: Bug | null; onPick?: (b: Bug) => void; only?: Bug; hint?: Bug; small?: boolean }) {
  return (
    <div className={small ? 'hv-reserve hv-reserve--small' : 'hv-reserve'} role="group" aria-label={label}>
      {(Object.keys(START_RESERVE) as Bug[]).map((b) => {
        const n = view.reserve[color][b];
        const enabled = !!onPick && n > 0 && (!only || only === b);
        const body = (
          <>
            <svg viewBox="-50 -50 100 100" aria-hidden="true"><Tile x={0} y={0} p={{ c: color, t: b }} /></svg>
            <span className="hv-reserve__n">{fa(n)}</span>
          </>
        );
        return onPick
          ? <button key={b} type="button" disabled={!enabled} aria-pressed={selected === b} aria-label={`${BUG_FA[b]}، ${fa(n)} عدد`} className={['hv-reserve__item', hint === b ? 'hv-reserve__item--hint' : ''].join(' ')} onClick={() => onPick(b)}>{body}</button>
          : <span key={b} className="hv-reserve__item" aria-label={`${BUG_FA[b]}، ${fa(n)} عدد`}>{body}</span>;
      })}
    </div>
  );
}

function Tile({ x, y, p }: { x: number; y: number; p: Piece }) {
  const ink = BUG_COLOR[p.t];
  return (
    <g filter="url(#hv-shadow)">
      <polygon points={hexPoints(x, y, R * 0.9)} fill={p.c === 'w' ? 'url(#hv-w)' : 'url(#hv-b)'} stroke={p.c === 'w' ? '#a99b80' : '#000'} strokeWidth="2.5" strokeLinejoin="round" />
      <g transform={`translate(${x} ${y})`} fill={ink} stroke={ink}><BugIcon t={p.t} /></g>
    </g>
  );
}

/** Simple drawn insects, centred at 0,0, about 50 units tall. */
function BugIcon({ t }: { t: Bug }) {
  switch (t) {
    case 'Q': return (
      <g strokeWidth="0">
        <ellipse cx="-12" cy="-10" rx="11" ry="7" opacity=".45" transform="rotate(-25 -12 -10)" /><ellipse cx="12" cy="-10" rx="11" ry="7" opacity=".45" transform="rotate(25 12 -10)" />
        <ellipse cx="0" cy="6" rx="10" ry="16" /><circle cx="0" cy="-14" r="7" />
        <rect x="-10" y="2" width="20" height="4" fill="#2a1d0e" /><rect x="-9" y="10" width="18" height="4" fill="#2a1d0e" />
      </g>
    );
    case 'A': return (
      <g strokeWidth="3" strokeLinecap="round">
        <circle cx="0" cy="-16" r="6" stroke="none" /><ellipse cx="0" cy="-3" rx="6" ry="7" stroke="none" /><ellipse cx="0" cy="15" rx="9" ry="11" stroke="none" />
        {[-1, 1].map((sx) => <g key={sx}><path d={`M0 -4 L${sx * 16} -14`} fill="none" /><path d={`M0 -2 L${sx * 18} 0`} fill="none" /><path d={`M0 0 L${sx * 16} 12`} fill="none" /></g>)}
      </g>
    );
    case 'S': return (
      <g>
        <g strokeWidth="3" strokeLinecap="round" fill="none">
          {[-1, 1].map((sx) => [-14, -6, 4, 12].map((dy, k) => <path key={`${sx}${k}`} d={`M0 0 Q${sx * 14} ${dy - 6} ${sx * 22} ${dy + 4}`} />))}
        </g>
        <circle cx="0" cy="6" r="10" stroke="none" /><circle cx="0" cy="-9" r="6" stroke="none" />
      </g>
    );
    case 'G': return (
      <g strokeWidth="3" strokeLinecap="round">
        <ellipse cx="0" cy="2" rx="7" ry="20" stroke="none" /><circle cx="0" cy="-20" r="6" stroke="none" />
        {[-1, 1].map((sx) => <g key={sx} fill="none"><path d={`M0 8 L${sx * 18} -2 L${sx * 14} 22`} /><path d={`M0 -6 L${sx * 12} -14`} /></g>)}
      </g>
    );
    case 'B': return (
      <g strokeWidth="0">
        <circle cx="0" cy="-17" r="6" /><ellipse cx="0" cy="4" rx="16" ry="19" />
        <path d="M0 -14 L0 22" stroke="#140f0a" strokeWidth="2.5" /><ellipse cx="-6" cy="-4" rx="4" ry="7" fill="#fff" opacity=".35" />
      </g>
    );
  }
}
