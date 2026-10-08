// تخته‌نرد renderer: an inlaid walnut board (SVG, LTR geometry), ivory/ebony checkers, rolling dice.
// A turn is built locally step by step (tap a checker → it moves; two possible landings → tap the landing) and sent
// as one `play` once the dice are used up; the table shell then holds it for the undo window.
import ivoryImg from './art/checker-ivory.webp';
import redImg from './art/checker-red.webp';
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { CHECKERS, nextSteps, pipCount, step as applyStep, target, type BgView, type From, type LogEntry, type Pos, type Step } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const W = 1000, H = 720, F = 34, TRAY = 74, BAR = 62;
const PW = (W - 2 * F - TRAY - BAR) / 12;
const BAR_L = F + 6 * PW, BAR_R = BAR_L + BAR;
const PH = 286, R = PW / 2 - 3.5;
const RIGHT = W - F - TRAY;

/** Point centre x and whether it is on the bottom row, in the viewer's orientation (v 0 = viewer's 1-point). */
function geo(v: number) {
  if (v < 12) return { x: v < 6 ? RIGHT - (v + 0.5) * PW : BAR_L - (v - 6 + 0.5) * PW, bottom: true };
  const k = v - 12;
  return { x: k < 6 ? F + (k + 0.5) * PW : BAR_R + (k - 6 + 0.5) * PW, bottom: false };
}
/** Centre of the n-th checker (0-based) on a point; five are drawn, the fifth carries the count for taller stacks. */
function slot(v: number, n: number) {
  const g = geo(v);
  // Slightly overlapped so a full stack of five stays clear of the dice in the middle.
  const d = Math.min(n, 4) * 1.84 * R;
  return { x: g.x, y: g.bottom ? H - F - R - 2 - d : F + R + 2 + d };
}

type Sel = { from: From; options: Step[] } | null;

export default function BackgammonRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<BgView>) {
  const me = mySeat ?? 0;
  const flip = me === 1;
  const vOf = (i: number) => (flip ? 23 - i : i);
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const myMove = has('play') && !!view.dice;
  const lastSeq = view.log.at(-1)?.seq ?? 0;

  const [steps, setSteps] = useState<Step[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => { setSteps([]); setSel(null); setSent(false); }, [lastSeq]);
  // Cancelled in the undo window (or rejected): the finished play stays on the board and can be sent or changed.
  useEffect(() => { if (!busy) setSent(false); }, [busy]);

  // Local position after the steps taken so far this turn.
  const local = useMemo(() => {
    let pos: Pos = { pts: view.pts, bar: view.bar, off: view.off };
    const played = [] as ReturnType<typeof applyStep>['played'][];
    for (const s of steps) { const r = applyStep(pos, me, s); pos = r.pos; played.push(r.played); }
    return { pos, played };
  }, [view.pts, view.bar, view.off, steps, me]);
  const hintStep = expected?.type === 'play' ? (expected.moves as Step[])[steps.length] : undefined;
  const legalNext = useMemo(() => (myMove ? nextSteps(view, me, view.dice!, steps) : []), [myMove, view, me, steps]);
  // Tutorial: only the scripted step is offered, so the play is built in the expected order.
  const next = hintStep ? legalNext.filter((s) => s.from === hintStep.from && s.die === hintStep.die) : legalNext;
  const complete = myMove && legalNext.length === 0 && steps.length > 0;

  const send = (all: Step[]) => { setSent(true); onAction({ type: 'play', moves: all }); };
  const take = (s: Step) => {
    const all = [...steps, s];
    setSteps(all);
    setSel(null);
    if (!nextSteps(view, me, view.dice!, all).length) send(all);
  };
  const tapSource = (f: From) => {
    if (busy || sent) return;
    const opts = next.filter((s) => s.from === f);
    if (!opts.length) { setSel(null); return; }
    const landings = new Set(opts.map((s) => String(target(local.pos, me, s.from, s.die))));
    // One possible landing: move at once.
    if (landings.size === 1) take(opts[0]!);
    else setSel(sel?.from === f ? null : { from: f, options: opts });
  };
  const tapLanding = (to: number | 'off') => {
    if (!sel) return;
    const s = sel.options.find((o) => target(local.pos, me, o.from, o.die) === to);
    if (s) take(s);
  };
  const undoStep = () => { setSteps(steps.slice(0, -1)); setSel(null); setSent(false); };

  const sources = new Set(next.map((s) => String(s.from)));
  const landings = new Map<string, number>();
  for (const o of sel?.options ?? []) landings.set(String(target(local.pos, me, o.from, o.die)), o.die);

  // Dice: which of the rolled dice are used by the local steps.
  const diceList = view.dice ? (view.dice[0] === view.dice[1] ? [view.dice[0], view.dice[0], view.dice[0], view.dice[0]] : [...view.dice]) : [];
  const used = [...steps.map((s) => s.die)];
  const diceUsed = diceList.map((d) => { const k = used.indexOf(d); if (k >= 0) { used.splice(k, 1); return true; } return false; });
  const rollSeq = [...view.log].reverse().find((e) => e.t === 'roll' || e.t === 'opening')?.seq ?? 0;

  // Last move by the opponent (shown as trails), or the local steps for me.
  const lastPlay = [...view.log].reverse().find((e) => e.t === 'play') as Extract<LogEntry, { t: 'play' }> | undefined;
  const trails = myMove && steps.length ? local.played : lastPlay && lastPlay.seat !== me ? lastPlay.moves : [];
  const lastPass = view.log.at(-1)?.t === 'pass' ? (view.log.at(-1) as Extract<LogEntry, { t: 'pass' }>) : null;

  const pos = myMove ? local.pos : view;
  const pips: [number, number] = [pipCount(pos, 0), pipCount(pos, 1)];
  const name = (s: number) => (s === mySeat ? 'شما' : seatName(s));

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    const waiting = view.phase === 'cube' ? 1 - view.current : view.current;
    if (waiting === mySeat) {
      status = { tone: 'mine', text: view.phase === 'cube' ? `حریف بازی را دو برابر کرد (${fa(view.cube.value * 2)} امتیاز)` : view.phase === 'roll' ? 'نوبت شماست: تاس بریزید یا دوبل کنید' : complete ? 'حرکت کامل شد' : view.bar[me]! > 0 && !steps.length ? 'اول مهره زده‌شده را از بار وارد کنید' : 'نوبت شماست: یک مهره را بزنید' };
    } else status = { tone: 'wait', text: view.phase === 'cube' ? `${seatName(waiting)} درباره دوبل تصمیم می‌گیرد` : `نوبت ${seatName(waiting)}` };
  }

  const pointLabel = (i: number) => `خانه ${fa(me === 0 ? i + 1 : 24 - i)}`;
  const describePoint = (i: number) => {
    const n = pos.pts[i]!;
    const who = n > 0 ? 0 : 1;
    return `${pointLabel(i)}: ${n === 0 ? 'خالی' : `${fa(Math.abs(n))} مهره ${who === me ? 'شما' : 'حریف'}`}${sources.has(String(i)) ? '، قابل حرکت' : ''}${landings.has(String(i)) ? '، مقصد' : ''}`;
  };

  return (
    <div className="bgm" data-seq={lastSeq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="bgm__players">
        {[me, 1 - me].map((s) => (
          <div key={s} className={['bgm-pl', s === view.current && !view.outcome ? 'bgm-pl--turn' : ''].join(' ')}>
            <span className={`bgm-pl__chip bgm-pl__chip--${s === 0 ? 'ivory' : 'ebony'}`} aria-hidden="true" />
            <bdi className="bgm-pl__name">{name(s)}</bdi>
            <span className="bgm-pl__stat" title="مجموع فاصله تا بیرون بردن">پیپ {fa(pips[s]!)}</span>
            <span className="bgm-pl__stat">بیرون {fa(pos.off[s]!)} از {fa(CHECKERS)}</span>
          </div>
        ))}
        {view.rules.cube && (
          <div className="bgm-cube" aria-label={`کیوب ${fa(view.cube.value)}${view.cube.owner === null ? '، وسط' : view.cube.owner === me ? '، دست شما' : '، دست حریف'}`}>
            <span className="bgm-cube__face" aria-hidden="true">{fa(view.cube.value === 1 ? 64 : view.cube.value)}</span>
            <small>{view.cube.owner === null ? 'کیوب وسط' : view.cube.owner === me ? 'کیوب دست شما' : 'کیوب دست حریف'}</small>
          </div>
        )}
      </div>

      <ZoomBoard label="صفحه تخته‌نرد">
        <svg className="bgm-board" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="صفحه تخته‌نرد" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="bgm-wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5a2c1b" /><stop offset=".5" stopColor="#3a1b10" /><stop offset="1" stopColor="#4a2316" />
            </linearGradient>
            <radialGradient id="bgm-field" cx=".5" cy=".5" r=".75">
              <stop offset="0" stopColor="#1d4468" /><stop offset=".7" stopColor="#12304c" /><stop offset="1" stopColor="#0a1d33" />
            </radialGradient>
            <linearGradient id="bgm-tq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#35b5ac" /><stop offset=".55" stopColor="#1f8a86" /><stop offset="1" stopColor="#146461" /></linearGradient>
            <linearGradient id="bgm-sf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2c36b" /><stop offset=".55" stopColor="#d9983a" /><stop offset="1" stopColor="#a8701f" /></linearGradient>
            <pattern id="bgm-khatam" width="22" height="22" patternUnits="userSpaceOnUse">
              <rect width="22" height="22" fill="#2d140c" />
              <path d="M11 1 L14 8 L21 11 L14 14 L11 21 L8 14 L1 11 L8 8 Z" fill="#e6d4a6" />
              <path d="M11 5 L13.5 11 L11 17 L8.5 11 Z" fill="#1f8a86" />
              <circle cx="11" cy="11" r="1.7" fill="#d9983a" />
            </pattern>
            <pattern id="bgm-arab" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z" fill="none" stroke="#9fd8e8" strokeWidth="1" />
              <circle cx="0" cy="0" r="5" fill="none" stroke="#9fd8e8" strokeWidth=".8" /><circle cx="48" cy="48" r="5" fill="none" stroke="#9fd8e8" strokeWidth=".8" />
              <circle cx="48" cy="0" r="5" fill="none" stroke="#9fd8e8" strokeWidth=".8" /><circle cx="0" cy="48" r="5" fill="none" stroke="#9fd8e8" strokeWidth=".8" />
            </pattern>
            <filter id="bgm-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity=".55" /></filter>
          </defs>

          {/* Rosewood frame with khatam inlay, lapis field with arabesque, brass fillets, bar and tray. */}
          <rect x="0" y="0" width={W} height={H} rx="22" fill="url(#bgm-wood)" />
          <rect x="8" y="8" width={W - 16} height={H - 16} rx="16" fill="none" stroke="url(#bgm-khatam)" strokeWidth="14" />
          <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="21" fill="none" stroke="#d9983a" strokeOpacity=".7" strokeWidth="1.5" />
          <rect x={F} y={F} width={RIGHT - F} height={H - 2 * F} fill="url(#bgm-field)" />
          <rect x={F} y={F} width={RIGHT - F} height={H - 2 * F} fill="url(#bgm-arab)" opacity=".1" />
          <rect x={F - 2} y={F - 2} width={RIGHT - F + 4} height={H - 2 * F + 4} fill="none" stroke="#d9983a" strokeWidth="2" />
          <rect x={BAR_L} y={F} width={BAR} height={H - 2 * F} fill="url(#bgm-wood)" />
          <rect x={BAR_L + 8} y={F} width={BAR - 16} height={H - 2 * F} fill="url(#bgm-khatam)" opacity=".8" />
          <rect x={RIGHT + 8} y={F} width={TRAY - 16} height={H - 2 * F} rx="8" fill="#170a05" stroke="#d9983a" strokeOpacity=".5" />

          {/* Points. */}
          {Array.from({ length: 24 }, (_, i) => {
            const v = vOf(i);
            const g = geo(v);
            const tip = g.bottom ? H - F - PH : F + PH;
            const base = g.bottom ? H - F : F;
            const dark = v % 2 === 0;
            const isSrc = sources.has(String(i)) && !busy && !sent;
            const isLand = landings.has(String(i));
            const hint = hintStep && hintStep.from === i;
            return (
              <g key={i} className={['bgm-pt', isSrc ? 'bgm-pt--src' : '', isLand ? 'bgm-pt--land' : '', sel?.from === i ? 'bgm-pt--sel' : '', hint ? 'bgm-pt--hint' : ''].join(' ')}
                role="button" tabIndex={isSrc || isLand ? 0 : -1} aria-label={describePoint(i)}
                onClick={() => (isLand ? tapLanding(i) : tapSource(i))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isLand) tapLanding(i); else tapSource(i); } }}>
                <rect x={g.x - PW / 2} y={g.bottom ? H - F - PH - 20 : F} width={PW} height={PH + 20} fill="transparent" />
                <path d={`M${g.x - PW / 2 + 2} ${base} L${g.x} ${tip} L${g.x + PW / 2 - 2} ${base} Z`} className={dark ? 'bgm-tri bgm-tri--dark' : 'bgm-tri bgm-tri--light'} />
                <text x={g.x} y={g.bottom ? H - 12 : 25} className="bgm-num">{fa(me === 0 ? i + 1 : 24 - i)}</text>
                {isLand && <circle cx={g.x} cy={slot(v, Math.abs(pos.pts[i]!) > 0 && Math.sign(pos.pts[i]!) === (me === 0 ? 1 : -1) ? Math.abs(pos.pts[i]!) : 0).y} r={R * 0.75} className="bgm-landing" />}
              </g>
            );
          })}

          {/* Move trails (last opponent play, or my steps this turn). */}
          {trails.map((t, k) => {
            const fromXY = t.from === 'bar' ? { x: (BAR_L + BAR_R) / 2, y: H / 2 } : slot(vOf(t.from), 0);
            const toXY = t.to === 'off' ? { x: RIGHT + TRAY / 2, y: H / 2 } : slot(vOf(t.to), 0);
            return <line key={`${lastSeq}-${k}`} x1={fromXY.x} y1={fromXY.y} x2={toXY.x} y2={toXY.y} className="bgm-trail" style={{ ['--k' as string]: k }} />;
          })}

          {/* Checkers on points. */}
          {Array.from({ length: 24 }, (_, i) => {
            const n = pos.pts[i]!;
            if (!n) return null;
            const seat = n > 0 ? 0 : 1;
            const count = Math.abs(n);
            const v = vOf(i);
            const landed = trails.some((t) => t.to === i);
            const movable = sources.has(String(i)) && !busy && !sent;
            return Array.from({ length: Math.min(count, 5) }, (_, k) => {
              const c = slot(v, k);
              const top = k === Math.min(count, 5) - 1;
              return (
                <g key={`${i}-${k}`} className={['bgm-ck', top && landed ? 'bgm-ck--landed' : ''].join(' ')} pointerEvents="none">
                  <Checker x={c.x} y={c.y} seat={seat} />
                  {top && count > 5 && <text x={c.x} y={c.y + 7} className={`bgm-count bgm-count--${seat === 0 ? 'ivory' : 'ebony'}`}>{fa(count)}</text>}
                  {top && movable && <circle cx={c.x} cy={c.y} r={R + 4} className={sel?.from === i ? 'bgm-ring bgm-ring--sel' : 'bgm-ring'} />}
                </g>
              );
            });
          })}

          {/* Bar: my checkers on my side (bottom half), the opponent's on top. */}
          {[me, 1 - me].map((seat) => {
            const n = pos.bar[seat]!;
            if (!n) return null;
            const bottom = seat === me;
            const isSrc = seat === me && sources.has('bar') && !busy && !sent;
            return (
              <g key={`bar${seat}`} className={['bgm-bar', isSrc ? 'bgm-bar--src' : ''].join(' ')} role="button" tabIndex={isSrc ? 0 : -1}
                aria-label={`بار: ${fa(n)} مهره ${seat === me ? 'شما' : 'حریف'}${isSrc ? '، اول این را وارد کنید' : ''}`}
                onClick={() => seat === me && tapSource('bar')} onKeyDown={(e) => { if (seat === me && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapSource('bar'); } }}>
                {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                  <Checker key={k} x={(BAR_L + BAR_R) / 2} y={bottom ? H / 2 + 46 + k * 2 * R * 0.9 : H / 2 - 46 - k * 2 * R * 0.9} seat={seat} />
                ))}
                {n > 1 && <text x={(BAR_L + BAR_R) / 2} y={bottom ? H / 2 + 26 : H / 2 - 16} className="bgm-barcount">{fa(n)}</text>}
              </g>
            );
          })}

          {/* Bear-off tray: slabs per checker borne off. */}
          {[me, 1 - me].map((seat) => {
            const n = pos.off[seat]!;
            const bottom = seat === me;
            const land = seat === me && landings.has('off');
            return (
              <g key={`off${seat}`} className={['bgm-tray', land ? 'bgm-tray--land' : ''].join(' ')} role={land ? 'button' : undefined} tabIndex={land ? 0 : -1}
                aria-label={`بیرون‌برده: ${fa(n)} مهره ${seat === me ? 'شما' : 'حریف'}${land ? '، بزنید تا بیرون ببرید' : ''}`}
                onClick={() => land && tapLanding('off')} onKeyDown={(e) => { if (land && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapLanding('off'); } }}>
                <rect x={RIGHT + 8} y={bottom ? H / 2 + 6 : F} width={TRAY - 16} height={H / 2 - F - 6} rx="8" fill="transparent" />
                {Array.from({ length: n }, (_, k) => (
                  <rect key={k} x={RIGHT + 14} y={bottom ? H - F - 6 - (k + 1) * 17 : F + 6 + k * 17} width={TRAY - 28} height={14} rx="4"
                    className={`bgm-slab bgm-slab--${seat === 0 ? 'ivory' : 'ebony'}`} />
                ))}
                {land && <rect x={RIGHT + 10} y={bottom ? H / 2 + 8 : F + 2} width={TRAY - 20} height={H / 2 - F - 10} rx="8" className="bgm-tray__glow" />}
              </g>
            );
          })}

          {/* Dice in the viewer's right half. */}
          {diceList.length > 0 && (
            <g key={rollSeq} className="bgm-dice" transform={`translate(${(BAR_R + RIGHT) / 2} ${H / 2})`}>
              {diceList.map((d, k) => (
                <g key={k} className={['bgm-die', diceUsed[k] ? 'bgm-die--used' : ''].join(' ')} style={{ ['--k' as string]: k }}
                  transform={`translate(${(k - (diceList.length - 1) / 2) * 72} 0) scale(1.2)`}>
                  <g className="bgm-die__spin"><Die value={d} light={view.current === 0} /></g>
                </g>
              ))}
            </g>
          )}
          {lastPass && !myMove && (
            <text x={(BAR_R + RIGHT) / 2} y={H / 2 + 60} className="bgm-passnote">{lastPass.seat === me ? 'حرکتی ممکن نبود' : `${seatName(lastPass.seat)} حرکتی نداشت`}</text>
          )}
        </svg>
      </ZoomBoard>

      <div className="bgm__actions">
        {myMove && steps.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={undoStep}>برگرداندن حرکت</Button>}
        {complete && !busy && !sent && <Button size="sm" onClick={() => send(steps)}>ثبت حرکت</Button>}
        {has('roll') && <Button disabled={busy} onClick={() => onAction({ type: 'roll' })}>تاس بریز</Button>}
        {has('double') && <Button variant="secondary" disabled={busy} onClick={() => onAction({ type: 'double' })}>دوبل (×۲)</Button>}
        {has('take') && <Button disabled={busy} onClick={() => onAction({ type: 'take' })}>قبول ({fa(view.cube.value * 2)} امتیاز)</Button>}
        {has('drop') && <Button variant="secondary" disabled={busy} onClick={() => onAction({ type: 'drop' })}>واگذار ({fa(view.cube.value)} امتیاز)</Button>}
        {myMove && !steps.length && <p className="bgm__help">مهره‌ای را بزنید تا حرکت کند؛ اگر دو مقصد داشته باشد، مقصد روشن را بزنید.</p>}
      </div>

      {view.win && (
        <p className="bgm__win" role="status">
          {view.win.seat === mySeat ? 'بردید' : <><bdi>{seatName(view.win.seat)}</bdi> برد</>}
          {view.win.kind === 'backgammon' ? ' — مارس ترکی' : view.win.kind === 'gammon' ? ' — مارس' : ''}: {fa(view.win.points)} امتیاز
        </p>
      )}
    </div>
  );
}

/** Painted bone (seat 0) or crimson-lacquer (seat 1) checker; art cut from a generated sheet (see DECISIONS.md). */
function Checker({ x, y, seat }: { x: number; y: number; seat: number }) {
  return (
    <g filter="url(#bgm-shadow)">
      <image href={seat === 0 ? ivoryImg : redImg} x={x - R} y={y - R} width={2 * R} height={2 * R} />
    </g>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
};
function Die({ value, light }: { value: number; light: boolean }) {
  return (
    <g>
      <rect x="-25" y="-25" width="50" height="50" rx="10" className={light ? 'bgm-dieface bgm-dieface--ivory' : 'bgm-dieface bgm-dieface--ebony'} />
      {PIPS[value]!.map(([dx, dy], k) => <circle key={k} cx={dx * 13} cy={dy * 13} r="5" className={light ? 'bgm-pip' : 'bgm-pip bgm-pip--light'} />)}
    </g>
  );
}
