// تخته‌نرد renderer: an inlaid walnut board (SVG, LTR geometry), ivory/ebony checkers, rolling dice.
// A turn is built locally step by step (tap a checker → it moves; two possible landings → tap the landing) and sent
// as one `play` once the dice are used up; the table shell then holds it for the undo window.
import ivoryImg from './art/backgammon-checker-white.png';
import redImg from './art/backgammon-checker-red.png';
import boardArt from './art/backgammon-board.png';
import nums1 from './art/backgammon-numbers-1to12.png';
import nums2 from './art/backgammon-numbers-13to24.png';
import possibleArt from './art/backgammon-possible.png';
import offWhite from './art/backgammon-off-white.png';
import offRed from './art/backgammon-off-red.png';
import cube1 from './art/backgammon-cube-1.png';
import cube2 from './art/backgammon-cube-2.png';
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useFlip, useInFrame, usePieceIds, usePop, useTermsLang, tx, type GameRendererProps, DockSlot } from '@bg/ui';
import { terms } from './terms.ts';
import { CHECKERS, nextSteps, pipCount, step as applyStep, target, type BgView, type From, type LogEntry, type Pos, type Step } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// Geometry of the handoff board art: the PNG (806 x 700) is shown cropped by 40 px, leaving 726 x 536; a point is 5.785 % wide.
const W = 726, H = 536, F = 12, TRAY = 30, PH = 235;
const PW = 0.05785 * W, R = PW / 2;
const BARX = 0.4986 * W, BAR_L = BARX - 20, BAR_R = BARX + 20;
const RIGHT = 0.9477 * W - TRAY / 2;
const PT_X = [0.8678, 0.4187]; // x of the first point of the right / left half on the bottom row

/** Point centre x and whether it is on the bottom row, in the viewer's orientation (v 0 = viewer's 1-point). */
function geo(v: number) {
  if (v < 12) return { x: (v < 6 ? PT_X[0]! - v * 0.05785 : PT_X[1]! - (v - 6) * 0.05785) * W, bottom: true };
  const k = v - 12;
  return { x: (k < 6 ? 0.1295 + k * 0.05785 : 0.5785 + (k - 6) * 0.05785) * W, bottom: false };
}
/** Centre of the n-th checker (0-based) on a point; five are drawn, the fifth carries the count for taller stacks. */
function slot(v: number, n: number) {
  const g = geo(v);
  const d = Math.min(n, 4) * 2 * R;
  return { x: g.x, y: g.bottom ? H - F - R - 2 - d : F + R + 2 + d };
}

type Sel = { from: From; options: Step[] } | null;

// Stable checker ids: every checker is a cell (15 slots per point, bar and tray per seat), matched move to move by
// board distance, so a moved checker keeps its identity and glides instead of every stack renumbering.
const SLOTS = 15, BAR0 = 24 * SLOTS, OFF0 = BAR0 + 2 * SLOTS;
const cellOf = { pt: (i: number, k: number) => i * SLOTS + k, bar: (s: number, k: number) => BAR0 + s * SLOTS + k, off: (s: number, k: number) => OFF0 + s * SLOTS + k };
/** Where a cell lies along the track (seat 0 enters at 24 and bears off below 0; seat 1 the other way). */
function loc(c: number) {
  if (c < BAR0) return Math.floor(c / SLOTS);
  const s = Math.floor((c - (c < OFF0 ? BAR0 : OFF0)) / SLOTS);
  return (c < OFF0) === (s === 0) ? 24 : -1;
}
const cellDist = (a: number, b: number) => Math.abs(loc(a) - loc(b)) + Math.abs((a % SLOTS) - (b % SLOTS)) * 0.01;
function cells(p: Pos): string[] {
  const out: string[] = new Array<string>(OFF0 + 2 * SLOTS).fill('');
  p.pts.forEach((n, i) => { for (let k = 0; k < Math.abs(n); k++) out[cellOf.pt(i, k)] = n > 0 ? '0' : '1'; });
  for (const s of [0, 1]) {
    for (let k = 0; k < p.bar[s]!; k++) out[cellOf.bar(s, k)] = String(s);
    for (let k = 0; k < p.off[s]!; k++) out[cellOf.off(s, k)] = String(s);
  }
  return out;
}

export default function BackgammonRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<BgView>) {
  useTermsLang(); // re-render when the terms language changes
  const framed = useInFrame() !== null; // the shell draws players, pips, cube and whose-turn
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
  // My roll is waiting in the undo window or for the server: the dice tumble without a value until the result arrives.
  const [rollAsked, setRollAsked] = useState(false);
  useEffect(() => { if (!busy) setRollAsked(false); }, [busy]);
  const rolling = !view.dice && (queued?.type === 'roll' || (busy && rollAsked));

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
  // A roll without any legal move (pass) still shows its dice, all spent.
  const lastPass = view.log.at(-1)?.t === 'pass' ? (view.log.at(-1) as Extract<LogEntry, { t: 'pass' }>) : null;
  const shown = rolling ? null : view.dice ?? lastPass?.dice ?? null;
  const diceList = shown ? (shown[0] === shown[1] ? [shown[0], shown[0], shown[0], shown[0]] : [...shown]) : [];
  const used = [...steps.map((s) => s.die)];
  const diceUsed = diceList.map((d) => { if (!view.dice) return true; const k = used.indexOf(d); if (k >= 0) { used.splice(k, 1); return true; } return false; });
  const rollSeq = [...view.log].reverse().find((e) => e.t === 'roll' || e.t === 'opening' || e.t === 'pass')?.seq ?? 0;

  // Last move by the opponent (shown as trails), or the local steps for me.
  const lastPlay = [...view.log].reverse().find((e) => e.t === 'play') as Extract<LogEntry, { t: 'play' }> | undefined;
  const trails = myMove && steps.length ? local.played : lastPlay && lastPlay.seat !== me ? lastPlay.moves : [];

  const pos = myMove ? local.pos : view;
  // Checkers glide point to point (stable ids), hits go to the bar, bear-offs to the tray; keyed on every local step,
  // the undo window and a pending roll too.
  const ids = usePieceIds(cells(pos), cellDist);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${lastSeq}-${steps.length}-${!!queued}-${rolling}`);
  const offPop = [usePop(pos.off[0]), usePop(pos.off[1])];
  const cubePop = usePop(view.cube.value);
  const trailSeat = myMove && steps.length ? me : 1 - me;
  const offTrail = trails.find((t) => t.to === 'off');
  const pips: [number, number] = [pipCount(pos, 0), pipCount(pos, 1)];
  const name = (s: number) => (s === mySeat ? 'شما' : seatName(s));

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    const waiting = view.phase === 'cube' ? 1 - view.current : view.current;
    if (queued) status = { tone: 'wait', text: 'حرکت شما در حال ثبت است…' };
    else if (waiting === mySeat) {
      status = { tone: 'mine', text: view.phase === 'cube' ? `حریف بازی را دو برابر کرد (${fa(view.cube.value * 2)} امتیاز)` : view.phase === 'roll' ? `نوبت شماست: تاس بریزید یا ${tx(terms.double)} کنید` : complete ? 'حرکت کامل شد' : view.bar[me]! > 0 && !steps.length ? `اول مهره زده‌شده را از ${tx(terms.bar)} وارد کنید` : 'نوبت شماست: یک مهره را بزنید' };
    } else status = { tone: 'wait', text: view.phase === 'cube' ? `${seatName(waiting)} درباره ${tx(terms.double)} تصمیم می‌گیرد` : `نوبت ${seatName(waiting)}` };
  }

  const pointLabel = (i: number) => `خانه ${fa(me === 0 ? i + 1 : 24 - i)}`;
  const describePoint = (i: number) => {
    const n = pos.pts[i]!;
    const who = n > 0 ? 0 : 1;
    return `${pointLabel(i)}: ${n === 0 ? 'خالی' : `${fa(Math.abs(n))} مهره ${who === me ? 'شما' : 'حریف'}`}${sources.has(String(i)) ? '، قابل حرکت' : ''}${landings.has(String(i)) ? '، مقصد' : ''}`;
  };

  return (
    <div className="bgm" data-seq={lastSeq} ref={root}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>{view.phase === 'cube' ? `قبول یعنی بازی با ${tx(terms.cube)} دو برابر ادامه می‌یابد؛ واگذار یعنی همین حالا یک امتیاز می‌دهید.` : `هر عدد تاس یک حرکت جدا است. اگر مهره‌ای روی ${tx(terms.bar)} دارید، اول باید آن را وارد کنید. ${tx(terms.bearOff)} فقط وقتی همهٔ مهره‌ها در خانهٔ شما باشند.`}</p>
        </RailSlot>
      )}
      {!framed && <div className="bgm__players">
        {[me, 1 - me].map((s) => (
          <div key={s} className={['bgm-pl', s === view.current && !view.outcome ? 'bgm-pl--turn' : ''].join(' ')}>
            <span className={`bgm-pl__chip bgm-pl__chip--${s === 0 ? 'ivory' : 'ebony'}`} aria-hidden="true" />
            <bdi className="bgm-pl__name">{name(s)}</bdi>
            <span className="bgm-pl__stat" title={`مجموع فاصله تا ${tx(terms.bearOff)}`}>{tx(terms.pip)} {fa(pips[s]!)}</span>
            <span key={pos.off[s]} className={`bgm-pl__stat ${offPop[s]}`}>بیرون {fa(pos.off[s]!)} از {fa(CHECKERS)}</span>
          </div>
        ))}
        {view.rules.cube && (
          <div className="bgm-cube" aria-label={`${tx(terms.cube)} ${fa(view.cube.value)}${view.cube.owner === null ? '، وسط' : view.cube.owner === me ? '، دست شما' : '، دست حریف'}`}>
            <span key={view.cube.value} className={`bgm-cube__face ${cubePop}`} aria-hidden="true">{fa(view.cube.value === 1 ? 64 : view.cube.value)}</span>
            <small>{view.cube.owner === null ? `${tx(terms.cube)} وسط` : view.cube.owner === me ? `${tx(terms.cube)} دست شما` : `${tx(terms.cube)} دست حریف`}</small>
          </div>
        )}
      </div>}

      <ZoomBoard label="صفحه تخته‌نرد">
        <svg className="bgm-board" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="صفحه تخته‌نرد" style={{ direction: 'ltr' }}>
          <defs>
            <filter id="bgm-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity=".5" /></filter>
          </defs>
          <image href={boardArt} x="-40" y="-40" width="806" height="700" />
          <image href={nums2} x={0.1088 * W} y={0.4104 * H} width={0.781 * W} height={(0.781 * W * 33) / 567} pointerEvents="none" />
          <image href={nums1} x={0.1088 * W} y={0.5261 * H} width={0.7741 * W} height={(0.7741 * W * 33) / 562} pointerEvents="none" />

          <rect x={BAR_L} y={H / 2 - 10} width={BAR_R - BAR_L} height={20} fill="transparent" pointerEvents="none" data-flip-anchor="bar" />
          {/* Points. */}
          {Array.from({ length: 24 }, (_, i) => {
            const v = vOf(i);
            const g = geo(v);
            const isSrc = sources.has(String(i)) && !busy && !sent;
            const isLand = landings.has(String(i));
            const hint = hintStep && hintStep.from === i;
            return (
              <g key={i} className={['bgm-pt', isSrc ? 'bgm-pt--src' : '', isLand ? 'bgm-pt--land' : '', sel?.from === i ? 'bgm-pt--sel' : '', hint ? 'bgm-pt--hint' : ''].join(' ')}
                role="button" tabIndex={isSrc || isLand ? 0 : -1} aria-label={describePoint(i)}
                onClick={() => (isLand ? tapLanding(i) : tapSource(i))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isLand) tapLanding(i); else tapSource(i); } }}>
                <rect x={g.x - PW / 2} y={g.bottom ? H - F - PH : F} width={PW} height={PH} fill="transparent" data-flip-anchor={`pt-${v}`} />
                {isLand && <image href={possibleArt} x={g.x - 12.5} y={slot(v, Math.abs(pos.pts[i]!) > 0 && Math.sign(pos.pts[i]!) === (me === 0 ? 1 : -1) ? Math.abs(pos.pts[i]!) : 0).y - 12.5} width="25" height="25" className="bgm-landing" />}
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
            const landTrail = trails.find((t) => t.to === i);
            const movable = sources.has(String(i)) && !busy && !sent;
            return Array.from({ length: Math.min(count, 5) }, (_, k) => {
              const c = slot(v, k);
              const top = k === Math.min(count, 5) - 1;
              return (
                <g key={ids[cellOf.pt(i, k)]} className="bgm-ck" pointerEvents="none" data-flip={`ck-${ids[cellOf.pt(i, k)]}`}
                  {...(top && landTrail ? { 'data-flip-from': landTrail.from === 'bar' ? 'bar' : `pt-${vOf(landTrail.from)}` } : {})}>
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
                aria-label={`${tx(terms.bar)}: ${fa(n)} مهره ${seat === me ? 'شما' : 'حریف'}${isSrc ? '، اول این را وارد کنید' : ''}`}
                onClick={() => seat === me && tapSource('bar')} onKeyDown={(e) => { if (seat === me && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapSource('bar'); } }}>
                {Array.from({ length: Math.min(n, 3) }, (_, k) => (
                  <g key={ids[cellOf.bar(seat, k)]} data-flip={`ck-${ids[cellOf.bar(seat, k)]}`}><Checker x={BARX} y={bottom ? H / 2 + 58 + k * 2 * R * 0.9 : H / 2 - 58 - k * 2 * R * 0.9} seat={seat} /></g>
                ))}
                {n > 1 && <text x={BARX} y={bottom ? H / 2 + 28 : H / 2 - 18} className="bgm-barcount">{fa(n)}</text>}
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
                <rect x={RIGHT - 6} y={bottom ? H / 2 + 6 : F} width={TRAY + 12} height={H / 2 - F - 6} fill="transparent" />
                {Array.from({ length: n }, (_, k) => (
                  <image key={ids[cellOf.off(seat, k)]} data-flip={`ck-${ids[cellOf.off(seat, k)]}`} {...(offTrail && trailSeat === seat && k === n - 1 ? { 'data-flip-from': `pt-${vOf(offTrail.from as number)}` } : {})} href={seat === 0 ? offWhite : offRed} x={RIGHT} y={bottom ? H - F - (k + 1) * 11 : F + k * 11} width={TRAY} height={10} preserveAspectRatio="none" />
                ))}
                {land && <rect x={RIGHT - 4} y={bottom ? H / 2 + 8 : F + 2} width={TRAY + 8} height={H / 2 - F - 10} rx="6" className="bgm-tray__glow" />}
              </g>
            );
          })}

          {view.rules.cube && (() => {
            const v = view.cube.value, y = view.cube.owner === null ? H / 2 : view.cube.owner === me ? H - F - R - 2 - 4 * 2 * R - 8 : F + R + 2 + 4 * 2 * R + 8;
            const art = v === 1 ? cube1 : v === 2 ? cube2 : null;
            return (
              <g className="bgm-cubeart" role="img" aria-label={`${tx(terms.cube)} ${fa(v)}${view.cube.owner === null ? '، وسط' : view.cube.owner === me ? '، دست شما' : '، دست حریف'}`}>
                {art
                  ? <image href={art} x={BARX - 22} y={y - 22} width="44" height="44" filter="url(#bgm-shadow)" />
                  /* art exists only for the faces 1 (64) and 2; higher faces keep a plain numbered square until the art ships. */
                  : <g><rect x={BARX - 22} y={y - 22} width="44" height="44" rx="6" className="bgm-cubeface" /><text x={BARX} y={y + 7} className="bgm-cubenum">{fa(v)}</text></g>}
              </g>
            );
          })()}

          {/* Dice in the viewer's right half. */}
          {diceList.length > 0 && (
            <g key={rollSeq} className="bgm-dice" transform={`translate(${(BAR_R + RIGHT) / 2} ${H / 2})`}>
              {diceList.map((d, k) => (
                <g key={k} className={['bgm-die', diceUsed[k] ? 'bgm-die--used' : ''].join(' ')} style={{ ['--k' as string]: k }}
                  transform={`translate(${(k - (diceList.length - 1) / 2) * 43} 0) scale(0.76)`}>
                  <g className="bg-roll" style={{ ['--i' as string]: k }}><Die value={d} light={view.current === 0} /></g>
                </g>
              ))}
            </g>
          )}
          {rolling && (
            <g className="bgm-dice" transform={`translate(${(BAR_R + RIGHT) / 2} ${H / 2})`} aria-label="تاس‌ها در حال چرخیدن">
              {[0, 1].map((k) => (
                <g key={k} className="bgm-die" transform={`translate(${(k - 0.5) * 43} 0) scale(0.76)`}>
                  <g className="bg-tumble" style={{ ['--i' as string]: k }}><Die value={6} light={view.current === 0} /></g>
                </g>
              ))}
            </g>
          )}
          {lastPass && !myMove && (
            <text x={(BAR_R + RIGHT) / 2} y={H / 2 + 44} className="bgm-passnote">{lastPass.seat === me ? 'حرکتی ممکن نبود' : `${seatName(lastPass.seat)} حرکتی نداشت`}</text>
          )}
        </svg>
      </ZoomBoard>

      {/* Turn buttons go to the frame's dock row (they used to push the board below the stage); outside the frame they stay here. */}
      <div className="bgm__actions">
        <DockSlot>
          {myMove && steps.length > 0 && !busy && <Button key="undo" size="sm" variant="ghost" onClick={undoStep}>برگرداندن حرکت</Button>}
          {complete && !busy && !sent && <Button key="send" size="sm" onClick={() => send(steps)}>ثبت حرکت</Button>}
          {has('roll') && <Button key="roll" disabled={busy} onClick={() => { setRollAsked(true); onAction({ type: 'roll' }); }}>تاس بریز</Button>}
          {has('double') && <Button key="double" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'double' })}>{tx(terms.double)} (×۲)</Button>}
          {has('take') && <Button key="take" disabled={busy} onClick={() => onAction({ type: 'take' })}>قبول ({fa(view.cube.value * 2)} امتیاز)</Button>}
          {has('drop') && <Button key="drop" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'drop' })}>واگذار ({fa(view.cube.value)} امتیاز)</Button>}
        </DockSlot>
        {!framed && myMove && !steps.length && <p className="bgm__help">مهره‌ای را بزنید تا حرکت کند؛ اگر دو مقصد داشته باشد، مقصد روشن را بزنید.</p>}
      </div>

      {view.win && (
        <p className="bgm__win" role="status">
          {view.win.seat === mySeat ? 'بردید' : <><bdi>{seatName(view.win.seat)}</bdi> برد</>}
          {view.win.kind === 'backgammon' ? ` — ${tx(terms.backgammon)}` : view.win.kind === 'gammon' ? ` — ${tx(terms.gammon)}` : ''}: {fa(view.win.points)} امتیاز
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
