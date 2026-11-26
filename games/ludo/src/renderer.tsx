// Ludo (منچ) renderer: classic cross board on an 11×11 grid. Pieces carry their colour, a number and a text label;
// movable pieces are buttons and their landing square is outlined. Board coordinates are literal (ltr).
// Visuals: wooden frame, painted carpet under a semi-opaque printed board, vector squares and yards, painted pawns
// (WebP cut from a generated sheet, see DECISIONS.md).
import './renderer.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Icon, MOTION, RailSlot, T, TurnIndicator, ZoomBoard, motionOff, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps, DockSlot } from '@bg/ui';
import board from './art/board.png';
import dieArt from './art/die-6.png';
import pawnRed from './art/pawn-red.png';
import pawnGreen from './art/pawn-green.png';
import pawnYellow from './art/pawn-yellow.png';
import pawnBlue from './art/pawn-blue.png';
import { terms } from './terms.ts';
import { FINAL, TRACK, trackSquare, type LogEntry, type LudoView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const C = 50;
export const SLOT_COLORS = ['#d62f35', '#23843f', '#e0a400', '#1c63c9'];
const PAWN_ART = [pawnRed, pawnGreen, pawnYellow, pawnBlue]; // same order as SLOT_COLORS
export const SLOT_FA = ['قرمز', 'سبز', 'زرد', 'آبی'];
// 15x15 BGA board (art/board.png): 52-square loop, clockwise from red's start; slot s starts at index 13·s.
const TRACK_XY: [number, number][] = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6],
  [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12],
  [8, 13], [8, 14], [7, 14], [6, 14]
];
const GOAL_XY: [number, number][][] = [
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
];
const YARD_XY: [number, number][][] = [
  [[2, 11], [3, 11], [2, 12], [3, 12]], [[2, 2], [3, 2], [2, 3], [3, 3]], [[11, 2], [12, 2], [11, 3], [12, 3]], [[11, 11], [12, 11], [11, 12], [12, 12]]
];
// pieces that reached the centre sit in their own corner of the middle triangle
const CENTRE_XY: [number, number][][] = [
  [[6.7, 7.6], [7.1, 7.9], [6.7, 7.9], [7.1, 7.6]], [[6.4, 6.7], [6.4, 7.1], [6.7, 6.9], [6.4, 7.3]],
  [[7.6, 6.4], [7.2, 6.4], [7.4, 6.7], [7.8, 6.4]], [[7.9, 7.3], [7.9, 6.9], [7.6, 7.3], [7.9, 7.6]]
];
const px = ([x, y]: [number, number]): [number, number] => [x * C + C / 2, y * C + C / 2];

/** Board position of a piece. */
function where(slot: number, piece: number, progress: number): [number, number] {
  if (progress < 0) return px(YARD_XY[slot]![piece]!);
  if (progress >= FINAL) return px(CENTRE_XY[slot]![piece]!);
  if (progress >= TRACK) return px(GOAL_XY[slot]![progress - TRACK]!);
  return px(TRACK_XY[trackSquare(slot, progress)]!);
}
/** Board points a piece passes through from one progress to another: square by square along its track. */
function path(slot: number, piece: number, from: number, to: number): [number, number][] {
  if (to < 0 || from === to) return [where(slot, piece, from), where(slot, piece, to)]; // captured: straight back to the yard
  const pts: [number, number][] = [];
  if (from < 0) { pts.push(where(slot, piece, -1)); from = 0; }
  const d = to > from ? 1 : -1;
  for (let p = from; p !== to + d; p += d) pts.push(where(slot, piece, p));
  return pts;
}
const placeFa = (p: number) => (p < 0 ? `در ${tx(terms.base)}` : p >= FINAL ? `در ${tx(terms.home)}` : p >= TRACK ? `در ${tx(terms.homeColumn)} (${fa(p - TRACK + 1)})` : `${fa(p + 1)} خانه از ${tx(terms.start)}`);

function describe(e: LogEntry, name: (s: number) => string) {
  switch (e.t) {
    case 'roll': return `${name(e.seat)} ${fa(e.die)} آورد.`;
    case 'move': return `${name(e.seat)} ${tx(terms.token)} ${fa(e.piece + 1)} را ${e.from < 0 ? `از ${tx(terms.base)} بیرون آورد` : e.to >= FINAL ? `به ${tx(terms.home)} برد` : e.to >= TRACK ? `وارد ${tx(terms.homeColumn)} کرد` : 'جلو برد'}${e.captured ? ` و ${tx(terms.token)} ${name(e.captured.seat)} را زد!` : ''}.`;
    case 'noMove': return `${name(e.seat)} حرکتی نداشت.`;
    case 'again': return `${name(e.seat)} ۶ آورد و دوباره ${tx(terms.die)} می‌ریزد.`;
    case 'finished': return `${name(e.seat)} همه ${tx(terms.tokensOwn)} را ${tx(terms.toHome)} رساند!`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد؛ نوبتش خودکار بازی شد.`;
  }
}

function Die({ value, rolling, pending }: { value: number | null; rolling?: boolean; pending?: boolean }) {
  useTermsLang();
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
  };
  return (
    <svg className={pending ? 'ld-die bg-tumble' : rolling ? 'ld-die bg-roll' : 'ld-die'} viewBox="0 0 48 48" role="img" aria-label={value ? `${tx(terms.die)}: ${fa(value)}` : tx(terms.die)}>
      <defs>
        <linearGradient id="ldd-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#f6efdc" /><stop offset="1" stopColor="#d8cdb0" /></linearGradient>
        <radialGradient id="ldd-pip" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#5a4a3c" /><stop offset="1" stopColor="#120c06" /></radialGradient>
        <filter id="ldd-shadow" x="-30%" y="-30%" width="170%" height="170%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <rect x="6" y="8" width="38" height="38" rx="9" fill="#000" opacity="0.35" filter="url(#ldd-shadow)" aria-hidden="true" />
      <rect className="ld-die__body" x="4" y="4" width="38" height="38" rx="9" fill="url(#ldd-face)" />
      <rect x="6" y="6" width="34" height="34" rx="7" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" aria-hidden="true" />
      {(value ? pips[value]! : []).map(([x, y], i) => <circle key={i} cx={x * 10 + 2} cy={y * 10 + 2} r="3.7" fill="url(#ldd-pip)" />)}
    </svg>
  );
}

/** Painted pawn, centred on the origin (aria-hidden: the piece group carries the label). */
function Pawn({ slot }: { slot: number }) {
  // Plain disc (~30px) in a dark ring, as the design shows; the piece number stays in the accessible label only.
  return (
    <g className="ld-pawn" aria-hidden="true">
      <image href={PAWN_ART[slot]} x="-20" y="-20" width="40" height="40" />
      <circle r="18.5" className="ld-pawn__ring" />
    </g>
  );
}

export default function LudoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<LudoView>) {
  useTermsLang();
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const moves = legalActions.filter((a) => a.type === 'move') as unknown as { piece: number; to: number }[];
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${latest?.seq ?? 0}|${queued?.type ?? ''}`);
  const lastRoll = [...view.log].reverse().find((e) => e.t === 'roll');
  // The die: tumbles without pips while the own roll waits in the undo window or for the server; thrown when the result lands.
  const [rollSent, setRollSent] = useState(-1);
  const rollPending = queued?.type === 'roll' || (busy && rollSent === (latest?.seq ?? 0));
  const firstRoll = useRef(lastRoll?.seq);
  // Undo-window preview of an own move: the piece already walks to its target; undo walks it back.
  const pendingMove = queued?.type === 'move' ? moves.find((m) => m.piece === queued.piece) ?? null : null;
  const shown = view.pieces.map((ps, seat) => ps.map((p, i) => (seat === mySeat && pendingMove?.piece === i ? pendingMove.to : p)));
  const shownSig = JSON.stringify(shown);
  const before = useRef({ shown, roll: lastRoll?.seq });
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = { shown, roll: lastRoll?.seq };
    const host = root.current;
    if (!host || motionOff()) return;
    const wait = prev.roll !== lastRoll?.seq ? MOTION.roll * 0.8 : 0; // let the die land before the piece walks
    shown.forEach((ps, seat) => ps.forEach((p, i) => {
      const o = prev.shown[seat]?.[i];
      const el = host.querySelector<SVGGElement>(`[data-pawn="${seat}-${i}"]`);
      if (o === undefined || o === p || !el) return;
      const pts = path(view.slots[seat]!, i, o, p), [fx, fy] = pts.at(-1)!;
      el.animate(pts.map(([x, y], k) => ({ transform: `translate(${x - fx}px, ${y - fy}px) scale(${k && k < pts.length - 1 ? 1.08 : 1})` })),
        { duration: Math.min(320 + pts.length * 170, 2400), delay: p < o && p < 0 ? wait + 500 : wait, easing: 'linear', fill: 'backwards' });
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownSig]);

  const framed = useInFrame() !== null;
  const dieNow = view.die ?? (lastRoll && lastRoll.t === 'roll' ? lastRoll.die : null);
  const mine = mySeat !== null ? view.slots[mySeat]! : null;
  const status = view.outcome ? null : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' } : canRoll
    ? { tone: 'mine' as const, text: view.tries > 1 ? `نوبت شماست: ${tx(terms.rollPrompt)} (${fa(view.tries)} فرصت برای ۶)` : `نوبت شماست: ${tx(terms.rollPrompt)}` }
    : moves.length ? { tone: 'mine' as const, text: `${fa(view.die ?? 0)} آوردید: ${tx(terms.tokenAny)} را که می‌خواهید حرکت دهید بزنید` }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)} (${SLOT_FA[view.slots[view.current]!]})` };

  return (
    <div className="ld" ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {framed && (
        <RailSlot>
          {mySeat !== null && mine !== null && (
            <section className="ld-rail" aria-label={`${tx(terms.tokensEz)} شما`}>
              <h3><T t={terms.tokensEz} /> شما<span className="ld-rail__note">{SLOT_FA[mine]}</span></h3>
              <div className="ld-rail__pills">
                <span className="bgv-chip">در <T t={terms.homeWord} />: {fa(view.pieces[mySeat]!.filter((p) => p >= FINAL).length)} از ۴</span>
                <span className="bgv-chip">در <T t={terms.base} />: {fa(view.pieces[mySeat]!.filter((p) => p < 0).length)}</span>
                {moves.length > 0 && <span className="bgv-chip">{fa(moves.length)} حرکت ممکن</span>}
              </div>
            </section>
          )}
          <p className="ld-rail__tip"><Icon name="book" size={18} />
            <span>{moves.length ? <><T t={terms.tokenEz} /> روی صفحه یا یکی از دکمه‌ها را بزنید؛ اگر دقیقاً روی <T t={terms.tokenEz} /> حریف بنشینید، به <T t={terms.baseOwn} /> برمی‌گردد.</> : <><T t={terms.tokenEz} /> <T t={terms.base} /> فقط با ۶ بیرون می‌آید و ۶ یک <T t={terms.die} /> <T t={terms.bonus} /> دارد.</>} ورود به <T t={terms.homeColumn} /> با عدد دقیق است.</span>
          </p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="ld-main">
        <ZoomBoard label={tx(terms.board)}>
        <svg className="ld-board" viewBox="0 0 750 750" role="group" aria-label={tx(terms.board)} style={{ direction: 'ltr' }}>
          {/* The printed board art has transparent track cells: they sit on white card stock, as the design shows. */}
          <rect width="750" height="750" fill="#fff" aria-hidden="true" />
          <image href={board} width="750" height="750" aria-hidden="true" />
          {YARD_XY.map((_, slot) => {
            const turn = !view.outcome && view.slots[view.current] === slot;
            const [x, y] = px(YARD_XY[slot]![0]!);
            return turn ? <rect key={slot} x={x - C / 2 - 3} y={y - C / 2 - 3} width={2 * C + 6} height={2 * C + 6} className="ld-yard ld-yard--turn" aria-hidden="true" /> : null;
          })}
          {!pendingMove && moves.map((m) => { const [x, y] = where(mine!, m.piece, m.to); return <circle key={`t${m.piece}`} cx={x} cy={y} r="22" className="ld-target" />; })}
          {view.pieces.flatMap((ps, seat) => !view.active[seat] ? [] : ps.map((p, i) => {
            const slot = view.slots[seat]!;
            const [x, y] = where(slot, i, shown[seat]![i]!);
            const move = seat === mySeat && !pendingMove ? moves.find((m) => m.piece === i) : undefined;
            const label = `${tx(terms.token)} ${fa(i + 1)} ${SLOT_FA[slot]} (${seatName(seat)})، ${placeFa(p)}${move ? '، حرکت دادن' : ''}`;
            const hint = expected?.type === 'move' && expected.piece === i && seat === mySeat;
            const act = () => !busy && onAction({ type: 'move', piece: i });
            return (
              <g key={`${seat}-${i}`} style={{ transform: `translate(${x}px, ${y}px)` }}><g data-pawn={`${seat}-${i}`} className={['ld-piece', move ? 'ld-piece--movable' : '', hint ? 'ld-piece--hint' : ''].join(' ')}
                {...(move ? { role: 'button', tabIndex: 0, 'aria-label': label, onClick: act, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } } } : { role: 'img', 'aria-label': label })}>
                <circle r="24" className="ld-piece__ring" />
                <Pawn slot={slot} />
              </g></g>
            );
          }))}
        </svg>
        </ZoomBoard>

        <div className="ld-side">
          {framed ? (
            // Frame: one turn card in the dock row (die, what to do, roll or the movable pieces); no blank die before a roll.
            (rollPending || canRoll || moves.length > 0 || !!dieNow) && (
              <DockSlot>
                <div className="ld-turn">
                  {rollPending ? <Die key="pending" value={null} pending />
                    : dieNow ? <Die key={lastRoll?.seq} value={dieNow} rolling={!!lastRoll && lastRoll.seq !== firstRoll.current} /> : null}
                  <p className="ld-turn__t">{status?.text ?? (lastRoll ? describe(lastRoll, seatName) : '')}</p>
                  {canRoll && <Button disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { setRollSent(latest?.seq ?? 0); onAction({ type: 'roll' }); }}><img className="ld-btn-die" src={dieArt} alt="" aria-hidden="true" /><T t={terms.rollBtn} /></Button>}
                  {moves.length > 0 && (
                    <div className="ld-choices" role="group" aria-label={`${tx(terms.tokensEz)} قابل حرکت`}>
                      {moves.map((m) => <Button key={m.piece} variant="secondary" disabled={busy} onClick={() => onAction({ type: 'move', piece: m.piece })}><T t={terms.token} /> {fa(m.piece + 1)}:{placeFa(view.pieces[mySeat!]![m.piece]!)} ← {placeFa(m.to)}</Button>)}
                    </div>
                  )}
                </div>
              </DockSlot>
            )
          ) : (
            <>
            <div className="ld-roll">
              {rollPending
                ? <Die key="pending" value={null} pending />
                : <Die key={lastRoll?.seq} value={view.die ?? (lastRoll && lastRoll.t === 'roll' ? lastRoll.die : null)} rolling={!!lastRoll && lastRoll.seq !== firstRoll.current} />}
              {canRoll && <DockSlot><Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { setRollSent(latest?.seq ?? 0); onAction({ type: 'roll' }); }}><img className="ld-btn-die" src={dieArt} alt="" aria-hidden="true" /><T t={terms.rollBtn} /></Button></DockSlot>}
            </div>
            {moves.length > 0 && (
              <div className="ld-choices" role="group" aria-label={`${tx(terms.tokensEz)} قابل حرکت`}>
                {moves.map((m) => <Button key={m.piece} variant="secondary" disabled={busy} onClick={() => onAction({ type: 'move', piece: m.piece })}><T t={terms.token} /> {fa(m.piece + 1)}:{placeFa(view.pieces[mySeat!]![m.piece]!)} ← {placeFa(m.to)}</Button>)}
              </div>
            )}
            </>
          )}
          {!framed && <ul className="ld-players" aria-label="بازیکنان">
            {view.slots.map((slot, seat) => (
              <li key={seat} className={[view.current === seat && !view.outcome ? 'ld-player--turn' : '', view.active[seat] ? '' : 'ld-player--out'].join(' ')}>
                <span className="ld-dot" style={{ background: SLOT_COLORS[slot] }} aria-hidden="true" />
                <bdi>{seatName(seat)}</bdi>{seat === mySeat ? ' (شما)' : ''}
                <span className="ld-players__info">{SLOT_FA[slot]}، در <T t={terms.homeWord} /> {fa(view.pieces[seat]!.filter((p) => p >= FINAL).length)}/۴{view.active[seat] ? '' : '، بیرون'}</span>
              </li>
            ))}
          </ul>}
          {!framed && <details className="ld-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>}
        </div>
      </div>
    </div>
  );
}
