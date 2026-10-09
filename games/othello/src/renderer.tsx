// اتللو renderer: a green baize board with brass lines (SVG, LTR geometry). One tap on a dotted square places a disc;
// the outflanked discs turn over one after another, rippling out from the new disc.
import './renderer.css';
import { Fragment, useId } from 'react';
import { TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import discB from './art/disc-b.webp';
import discW from './art/disc-w.webp';
import texBaize from './art/tex-baize.webp';
import { flips, type Disc, type OthelloView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const S = 100, M = 34, SIZE = 8 * S + 2 * M;
// Disc and baize art are cut from a generated sheet (see DECISIONS.md).
const DISC = { b: discB, w: discW };
const FILES = 'abcdefgh';
const name = (i: number) => `${FILES[i % 8]}${Math.floor(i / 8) + 1}`;

export default function OthelloRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<OthelloView>) {
  const felt = `${useId()}-felt`;
  const myDisc: Disc = mySeat === null ? 'b' : view.colors[mySeat]!;
  const legal = new Set(legalActions.filter((a) => a.type === 'place').map((a) => a.sq as number));
  const myTurn = legal.size > 0;
  const hint = expected?.type === 'place' ? (expected.sq as number) : null;
  const xy = (i: number) => ({ x: M + (i % 8) * S + S / 2, y: M + (7 - Math.floor(i / 8)) * S + S / 2 });
  const last = view.last;
  const flipped = new Map((last?.flipped ?? []).map((i) => {
    const a = xy(i), b = xy(last!.sq);
    return [i, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / S] as const;
  }));
  const seatOf = (d: Disc) => (view.colors[0] === d ? 0 : 1);
  const who = (d: Disc) => (seatOf(d) === mySeat ? 'شما' : seatName(seatOf(d)));
  const total = view.counts.b + view.counts.w;
  const lastPass = view.passes.at(-1);
  const passNote = lastPass && lastPass.after === view.history.length && !view.outcome
    ? (lastPass.seat === mySeat ? 'حرکتی نداشتید؛ نوبت شما رد شد' : `${seatName(lastPass.seat)} حرکتی نداشت؛ نوبت دوباره با ${who(view.turn)}`)
    : null;

  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: 'نوبت شما: روی یک نقطه بگذارید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="oth" data-moves={view.history.length}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="oth__score" role="group" aria-label={`سیاه ${fa(view.counts.b)}، سفید ${fa(view.counts.w)}`}>
        {(['b', 'w'] as Disc[]).map((d) => (
          <div key={d} className={['oth-side', `oth-side--${d}`, view.turn === d && !view.outcome ? 'oth-side--turn' : ''].join(' ')}>
            <img className="oth-side__disc" src={DISC[d]} alt="" aria-hidden="true" />
            <bdi className="oth-side__name">{who(d)}</bdi>
            <strong key={view.counts[d]} className="oth-side__count">{fa(view.counts[d])}</strong>
          </div>
        ))}
        <div className="oth__bar" aria-hidden="true"><span style={{ inlineSize: `${(view.counts.b / Math.max(1, total)) * 100}%` }} /></div>
      </div>

      <ZoomBoard label="صفحه اتللو">
        <svg className="oth-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه اتللو" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="oth-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b2a1a" /><stop offset="1" stopColor="#1d140b" /></linearGradient>
            <pattern id={felt} patternUnits="userSpaceOnUse" x={M} y={M} width="256" height="256"><image href={texBaize} width="256" height="256" /></pattern>
            <filter id="oth-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".55" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="22" fill="url(#oth-frame)" />
          <rect x={M} y={M} width={8 * S} height={8 * S} fill={`url(#${felt})`} />
          {Array.from({ length: 9 }, (_, k) => (
            <Fragment key={k}>
              <line x1={M + k * S} y1={M} x2={M + k * S} y2={M + 8 * S} className="oth-line" />
              <line x1={M} y1={M + k * S} x2={M + 8 * S} y2={M + k * S} className="oth-line" />
            </Fragment>
          ))}
          {[[2, 2], [6, 2], [2, 6], [6, 6]].map(([c, r]) => <circle key={`${c}${r}`} cx={M + c! * S} cy={M + r! * S} r="7" className="oth-star" />)}
          {Array.from({ length: 8 }, (_, k) => (
            <g key={k} className="oth-coord">
              <text x={M + k * S + S / 2} y={SIZE - 9}>{FILES[k]}</text>
              <text x={15} y={M + k * S + S / 2 + 6}>{8 - k}</text>
            </g>
          ))}

          {Array.from({ length: 64 }, (_, i) => {
            const { x, y } = xy(i);
            const d = view.board[i];
            const isLegal = legal.has(i) && !busy;
            const gain = isLegal ? flips(view.board, i, myDisc).length : 0;
            return (
              <g key={i} role="gridcell" tabIndex={isLegal ? 0 : -1}
                aria-label={`${name(i)}: ${d ? (d === myDisc ? 'مهره شما' : 'مهره حریف') : isLegal ? `خالی، می‌توانید بگذارید (${fa(gain)} مهره برمی‌گردد)` : 'خالی'}`}
                className={['oth-sq', isLegal ? 'oth-sq--legal' : '', hint === i ? 'oth-sq--hint' : ''].join(' ')}
                onClick={() => { if (isLegal) onAction({ type: 'place', sq: i }); }}
                onKeyDown={(e) => { if (isLegal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAction({ type: 'place', sq: i }); } }}>
                <rect x={x - S / 2} y={y - S / 2} width={S} height={S} fill="transparent" />
                {last?.sq === i && <rect x={x - S / 2 + 3} y={y - S / 2 + 3} width={S - 6} height={S - 6} rx="6" className="oth-last" />}
                {isLegal && !d && (
                  <>
                    <circle cx={x} cy={y} r={S * 0.13} className={`oth-dot oth-dot--${myDisc}`} />
                    <circle cx={x} cy={y} r={S * 0.4} className={`oth-ghost oth-ghost--${myDisc}`} />
                  </>
                )}
              </g>
            );
          })}

          {view.board.map((d, i) => {
            if (!d) return null;
            const { x, y } = xy(i);
            const isNew = last?.sq === i;
            const delay = flipped.get(i);
            const key = `${i}-${isNew || delay !== undefined ? view.history.length : 0}`;
            if (delay !== undefined) {
              return (
                <g key={key} className="oth-flip" style={{ ['--d' as string]: `${0.1 + delay * 0.09}s` }} pointerEvents="none">
                  <g className="oth-flip__old"><DiscShape x={x} y={y} d={d === 'b' ? 'w' : 'b'} /></g>
                  <g className="oth-flip__new"><DiscShape x={x} y={y} d={d} /></g>
                </g>
              );
            }
            return <g key={key} className={isNew ? 'oth-drop' : undefined} pointerEvents="none"><DiscShape x={x} y={y} d={d} /></g>;
          })}
        </svg>
      </ZoomBoard>

      {passNote && <p className="oth__note" role="status">{passNote}</p>}
      {view.end?.kind === 'board' && view.end.score && (
        <p className="oth__end" role="status">نتیجه نهایی (خانه‌های خالی به برنده می‌رسد): <bdi>{seatName(0)}</bdi> {fa(view.end.score[0])} — <bdi>{seatName(1)}</bdi> {fa(view.end.score[1])}</p>
      )}
    </div>
  );
}

function DiscShape({ x, y, d }: { x: number; y: number; d: Disc }) {
  const r = 44;
  return <image href={DISC[d]} x={x - r} y={y - r} width={2 * r} height={2 * r} filter="url(#oth-shadow)" />;
}
