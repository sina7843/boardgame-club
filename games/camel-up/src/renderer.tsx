// مسابقهٔ شترها renderer: the race course as a loop of sixteen sand tiles around the pyramid, on a painted desert.
// Camel stacks lean on their tiles (top camel drawn highest); oasis and mirage tiles sit on the sand. The pyramid in the
// middle shows the five dice: rolled ones beside it with their value, the rest still inside. Leg-bet tiles are stacked
// per camel, the secret overall bets and the spectators' purses follow.
import './renderer.css';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, MOTION, RailSlot, TurnIndicator, useInFrame, motionOff, useFlip, usePop, type GameRendererProps, DockSlot } from '@bg/ui';
import camelBlue from './art/camel-up-camel-blue.png';
import camelGreen from './art/camel-up-camel-green.png';
import camelOrange from './art/camel-up-camel-orange.png';
import camelYellow from './art/camel-up-camel-yellow.png';
import camelWhite from './art/camel-up-camel-white.png';
import pyramid from './art/camel-up-pyramid.png';
import oasisArt from './art/camel-up-oasis.png';
import mirageArt from './art/camel-up-mirage.png';
import dieBlue1 from './art/camel-up-die-blue-1.png';
import dieBlue2 from './art/camel-up-die-blue-2.png';
import dieBlue3 from './art/camel-up-die-blue-3.png';
import bet_blue_3 from './art/camel-up-bet-blue-3.png';
import bet_blue_5 from './art/camel-up-bet-blue-5.png';
import bet_green_2 from './art/camel-up-bet-green-2.png';
import bet_green_3 from './art/camel-up-bet-green-3.png';
import bet_green_5 from './art/camel-up-bet-green-5.png';
import bet_orange_3 from './art/camel-up-bet-orange-3.png';
import bet_orange_5 from './art/camel-up-bet-orange-5.png';
import bet_white_5 from './art/camel-up-bet-white-5.png';
import bet_yellow_5 from './art/camel-up-bet-yellow-5.png';

// Leg-bet tile art exists only for these colour/value pairs; the rest keep the CSS tile.
const BET_ART: Record<string, string> = { 'blue-3': bet_blue_3, 'blue-5': bet_blue_5, 'green-2': bet_green_2, 'green-3': bet_green_3, 'green-5': bet_green_5, 'orange-3': bet_orange_3, 'orange-5': bet_orange_5, 'white-5': bet_white_5, 'yellow-5': bet_yellow_5 };
const DIE_BLUE: Record<number, string> = { 1: dieBlue1, 2: dieBlue2, 3: dieBlue3 };
import { CAMELS, TRACK, type Camel, type CamelView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const CAMEL_FA: Record<Camel, string> = { blue: 'آبی', green: 'سبز', orange: 'نارنجی', yellow: 'زرد', white: 'سفید' };

const CAMEL_ART: Record<Camel, string> = { blue: camelBlue, green: camelGreen, orange: camelOrange, yellow: camelYellow, white: camelWhite };

export function CamelIcon({ c, size = 1.6, walk }: { c: Camel; size?: number; walk?: boolean }) {
  return <img {...(walk ? { 'data-camel': c } : {})} src={CAMEL_ART[c]} alt={`شتر ${CAMEL_FA[c]}`} draggable={false} className={`cu-camel cu-c--${c}`} style={{ inlineSize: `${size}rem`, blockSize: `${size}rem` }} />;
}

/** Loop geometry on a 6×4 grid (literal, LTR): start bottom-left, run right, up, back along the top, down to the finish. */
function cell(sp: number): [number, number] {
  if (sp <= 6) return [sp, 4];
  if (sp <= 9) return [6, 10 - sp];
  if (sp <= 14) return [15 - sp, 1];
  return [1, sp - 13];
}

const PIPS: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]] };
function Die({ c, v, roll }: { c: Camel | null; v?: number; roll?: boolean }) {
  if (c === 'blue' && v) return <img src={DIE_BLUE[v]} alt="" draggable={false} className={`cu-die cu-die--art ${roll ? 'bg-roll' : ''}`} aria-hidden="true" />;
  return (
    <svg className={c ? `cu-die cu-c--${c} ${v ? '' : 'cu-die--in'} ${roll ? 'bg-roll' : ''}` : 'cu-die cu-die--pending bg-tumble'} viewBox="-12 -12 24 24" aria-hidden="true">
      <rect x="-11" y="-11" width="22" height="22" rx="5" className="cu-die__body" />
      {v && PIPS[v]!.map(([x, y], k) => <circle key={k} cx={x * 5.5} cy={y * 5.5} r="2.4" className="cu-die__pip" />)}
    </svg>
  );
}

/** A number that bumps when it changes (never on first render). */
function Pop({ v, className, children }: { v: number; className: string; children?: ReactNode }) {
  const pop = usePop(v);
  return <span key={v} className={`${className} ${pop}`}>{children ?? fa(v)}</span>;
}

/** Board position of each camel (camels past the finish are drawn on the last space). */
const posOf = (spaces: CamelView['spaces']) => Object.fromEntries(Object.entries(spaces).flatMap(([k, st]) => st.map((c) => [c, Math.min(Number(k), TRACK)]))) as Record<Camel, number>;

export default function CamelRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CamelView>) {
  const me = mySeat ?? -1;
  // Undo-window preview: a bet, overall bet or desert tile shows at once from what the client knows; a roll only tumbles.
  const q = queued as { type: string; camel?: Camel; which?: 'win' | 'lose'; space?: number; oasis?: boolean } | null | undefined;
  const view: CamelView = !q || me < 0 ? real
    : q.type === 'leg' && q.camel && real.legTiles[q.camel].length ? {
      ...real, legTiles: { ...real.legTiles, [q.camel]: real.legTiles[q.camel].slice(1) },
      legBets: real.legBets.map((b, k) => (k === me ? [...b, { camel: q.camel!, value: real.legTiles[q.camel!][0]! }] : b))
    }
      : q.type === 'desert' && q.space ? { ...real, desert: real.desert.map((d, k) => (k === me ? { space: q.space!, oasis: !!q.oasis } : d)) }
        : q.type === 'overall' && q.camel && q.which ? { ...real, myOverall: [...real.myOverall, { camel: q.camel, which: q.which }] }
          : real;
  const [rollSent, setRollSent] = useState(-1);
  const rollPending = q?.type === 'roll' || (busy && rollSent === real.seq);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${real.seq}|${q ? JSON.stringify(q) : ''}`);
  const firstSeq = useRef(real.seq);

  // Camels walk space by space (a stack carries its riders); a rolled camel starts once its die has landed.
  const spacesSig = JSON.stringify(view.spaces);
  const walk = useRef<{ pos: Record<Camel, number>; off: Map<Camel, [number, number]>; seq: number } | null>(null);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const pos = posOf(view.spaces);
    const centre = (r: DOMRect): [number, number] => [r.left + r.width / 2, r.top + r.height / 2];
    const cellAt = (sp: number) => centre(host.querySelector(`[data-sp="${sp}"]`)!.getBoundingClientRect());
    const off = new Map<Camel, [number, number]>();
    for (const c of CAMELS) {
      const el = host.querySelector(`[data-camel="${c}"]`);
      if (!el || !pos[c]) continue;
      const [x, y] = centre(el.getBoundingClientRect()), [cx, cy] = cellAt(pos[c]);
      off.set(c, [x - cx, y - cy]);
    }
    const prev = walk.current;
    walk.current = { pos, off, seq: real.seq };
    if (!prev || motionOff()) return;
    const wait = real.last?.kind === 'roll' && prev.seq !== real.seq ? MOTION.roll * 0.8 : 0;
    for (const c of CAMELS) {
      const a = prev.pos[c], b = pos[c], el = host.querySelector<HTMLElement>(`[data-camel="${c}"]`);
      const o0 = prev.off.get(c), o1 = off.get(c);
      if (!a || !b || a === b || !el || !o0 || !o1) continue;
      const d = b > a ? 1 : -1;
      const pts: [number, number][] = [];
      for (let sp = a; sp !== b + d; sp += d) { const [x, y] = cellAt(sp), o = sp === a ? o0 : o1; pts.push([x + o[0], y + o[1]]); }
      const [fx, fy] = pts.at(-1)!;
      const stack = el.closest<HTMLElement>('.cu-stack');
      if (stack) stack.style.zIndex = '3'; // walk above the other stacks
      const anim = el.animate(pts.map(([x, y], k) => ({ transform: `translate(${x - fx}px, ${y - fy}px) translateY(${k && k < pts.length - 1 ? -8 : 0}px)` })),
        { duration: 360 + (pts.length - 1) * 300, delay: wait, easing: 'ease-in-out', fill: 'backwards' });
      const done = () => { if (stack) stack.style.zIndex = ''; };
      anim.finished.then(done, done);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacesSig]);
  const framed = useInFrame() !== null;
  const myTurn = legalActions.some((a) => a.type === 'roll');
  const legs = new Map(legalActions.filter((a) => a.type === 'leg').map((a) => [a.camel as Camel, a.value as number]));
  const desert = legalActions.find((a) => a.type === 'desert') as { spaces: number[] } | undefined;
  const overall = legalActions.find((a) => a.type === 'overall') as { cards: Camel[] } | undefined;
  const [placing, setPlacing] = useState<null | 'oasis' | 'mirage'>(null);
  const [ovWhich, setOvWhich] = useState<null | 'win' | 'lose'>(null);
  useEffect(() => { setPlacing(null); setOvWhich(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; camel?: Camel; which?: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: placing ? 'خانهٔ کاشی را روی مسیر بزنید' : 'شرط ببندید، کاشی بگذارید یا تاس بیندازید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const last = view.last;
  // The die that ended a leg is gone from `rolled` (new leg); `last` still names it, so it is thrown and shown too.
  const lastRoll = view.rolled.at(-1) ?? (last?.kind === 'roll' && last.camel ? { camel: last.camel, value: last.value! } : undefined);
  const rolled = new Map(view.rolled.map((r) => [r.camel, r.value]));
  if (last?.kind === 'roll' && last.camel) rolled.set(last.camel, last.value!);
  const freshRoll = last?.kind === 'roll' && real.seq !== firstSeq.current && !rollPending;

  return (
    <div className="cu" data-seq={view.seq} ref={root}>
      {framed && (
        <RailSlot>
          {placing ? <p><b>واحه یک خانه جلو می‌برد و سراب یک خانه عقب؛ نه روی خانهٔ ۱، نه کنار کاشی دیگر.</b></p>
            : <p><b>در هر نوبت فقط یکی از چهار کار: شرط مرحله، کاشی بیابان، تاس از هرم یا شرط نهایی.</b></p>}
          <p>شرط مرحله برای شتر اول ۵، ۳ یا ۲ سکه است، برای دوم ۱ و برای بقیه ۱− سکه. شرط نهایی تا پایان بازی مخفی می‌ماند.</p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="cu__track" aria-label="مسیر مسابقه">
        {Array.from({ length: TRACK }, (_, i) => i + 1).map((sp) => {
          const stack = sp < TRACK ? view.spaces[sp] ?? [] : Object.entries(view.spaces).filter(([k]) => Number(k) >= TRACK).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([, st]) => st);
          const tile = view.desert.findIndex((d) => d?.space === sp);
          const can = !!placing && !!desert?.spaces.includes(sp) && !busy;
          const [col, row] = cell(sp);
          const cls = ['cu-sp', can ? 'cu-sp--can' : '', sp === TRACK ? 'cu-sp--last' : '', sp === 1 ? 'cu-sp--first' : ''].join(' ');
          const inner = (
            <>
              <small className="cu-sp__n">{fa(sp)}</small>
              {tile >= 0 && <span data-flip={`tile-${tile}`} data-flip-from={`seat-${tile}`} data-flip-exit={`seat-${tile}`} className={`cu-tile ${view.desert[tile]!.oasis ? 'cu-tile--oasis' : 'cu-tile--mirage'}`} title={who(tile)}><img src={view.desert[tile]!.oasis ? oasisArt : mirageArt} alt={view.desert[tile]!.oasis ? 'واحه +۱' : 'سراب −۱'} draggable={false} /></span>}
              <span className="cu-stack" style={{ ['--n' as string]: stack.length }}>{stack.slice().reverse().map((c) => <CamelIcon key={c} c={c} walk />)}</span>
            </>
          );
          const style = { gridColumn: col, gridRow: row };
          return can
            ? <button key={sp} data-sp={sp} type="button" className={cls} style={style} onClick={() => onAction({ type: 'desert', space: sp, oasis: placing === 'oasis' })} aria-label={`گذاشتن کاشی روی خانهٔ ${fa(sp)}`}>{inner}</button>
            : <div key={sp} data-sp={sp} className={cls} style={style}>{inner}</div>;
        })}
        <div className="cu-centre">
          <div className="cu-centre__dice" aria-label={`تاس‌های مانده در هرم: ${fa(view.diceLeft)}`}>
            {CAMELS.filter((c) => rolled.has(c)).map((c) => { const fresh = freshRoll && last?.camel === c; return <Die key={fresh ? `${c}-${view.seq}` : c} c={c} v={rolled.get(c)} roll={fresh} />; })}
            {rollPending && <Die c={null} />}
          </div>
          {lastRoll && !rollPending && (
            <p className="cu__roll" role="status" key={view.seq}>
              {last?.kind === 'roll' ? <bdi>{who(last.seat)}</bdi> : 'آخرین تاس'} <CamelIcon c={lastRoll.camel} size={1.2} /> <b>{fa(lastRoll.value)}</b>
            </p>
          )}
          {!framed && <small className="cu-centre__leg">مرحلهٔ {fa(view.leg)}</small>}
        </div>
      </section>

      {(() => {
        // One action bar (design §1/§3): leg bet | desert tile | pyramid die | final bet; in the frame it is the dock row.
        // The final bet picks «برنده»/«بازنده» first, then one of your camel cards (§4).
        const ovOpen = myTurn && overall ? (ovWhich ?? (hint?.type === 'overall' ? (hint.which as 'win' | 'lose') : null)) : null;
        const bar = (
          <div className="cu__bar" role="group" aria-label="کارهای نوبت">
            {!view.outcome && (
              <section className="cu__bets cu__grp" aria-label="شرط مرحله">
                <h3 className="cu__cap">شرط مرحله</h3>
                <div className="cu__grpbody">
                  {CAMELS.map((c) => {
                    const v = view.legTiles[c][0];
                    const left = view.legTiles[c].length;
                    return (
                      <button key={c} type="button" data-flip-anchor={`leg-${c}`} className={['cu-legtile', `cu-c--${c}`, hint?.type === 'leg' && hint.camel === c ? 'cu-hint' : ''].join(' ')} style={{ ['--left' as string]: left }}
                        disabled={!legs.has(c) || busy} onClick={() => onAction({ type: 'leg', camel: c })} aria-label={`شرط مرحله روی ${CAMEL_FA[c]}${v ? `، ${fa(v)} سکه` : '، تمام شده'}`}>
                        <span className="cu-legtile__face">
                          {v && BET_ART[`${c}-${v}`] ? <img src={BET_ART[`${c}-${v}`]} alt="" className="cu-legtile__art" draggable={false} /> : <><CamelIcon c={c} size={1.5} /><b>{v ? fa(v) : '—'}</b></>}
                        </span>
                        <small className="cu-legtile__left">{fa(left)} مانده</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {myTurn && (
              <>
                <section className="cu__actions cu__grp" aria-label="کاشی بیابان">
                  <h3 className="cu__cap">کاشی بیابان</h3>
                  <div className="cu__grpbody">
                    {desert && <Button size="sm" variant="secondary" aria-pressed={placing === 'oasis'} className={placing === 'oasis' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} onClick={() => setPlacing(placing === 'oasis' ? null : 'oasis')}><img src={oasisArt} alt="" className="cu-pyramid" draggable={false} />واحه +۱</Button>}
                    {desert && <Button size="sm" variant="secondary" aria-pressed={placing === 'mirage'} className={placing === 'mirage' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} onClick={() => setPlacing(placing === 'mirage' ? null : 'mirage')}><img src={mirageArt} alt="" className="cu-pyramid" draggable={false} />سراب −۱</Button>}
                    {!desert && <small>کاشی شما روی مسیر است</small>}
                  </div>
                </section>
                <section className="cu__grp" aria-label="تاس از هرم">
                  <h3 className="cu__cap">تاس از هرم <small>{fa(view.diceLeft)} مانده</small></h3>
                  <div className="cu__grpbody">
                    <Button size="sm" variant="secondary" disabled={busy} aria-label="تاس از هرم (+۱ سکه)" className={['cu-tilebtn', 'cu-rollbtn', hint?.type === 'roll' ? 'cu-hint' : ''].join(' ')} onClick={() => { setRollSent(real.seq); onAction({ type: 'roll' }); }}><img src={pyramid} alt="" className="cu-pyramid" draggable={false} />+۱ سکه</Button>
                  </div>
                </section>
                {overall && (
                  <section className="cu__overall cu__grp" aria-label="شرط نهایی">
                    <h3 className="cu__cap">شرط نهایی</h3>
                    <div className="cu__grpbody">
                      <Button size="sm" variant="secondary" icon="crown" aria-pressed={ovOpen === 'win'} className={ovOpen === 'win' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} disabled={busy} onClick={() => setOvWhich(ovOpen === 'win' ? null : 'win')}>برنده</Button>
                      <Button size="sm" variant="secondary" aria-pressed={ovOpen === 'lose'} className={ovOpen === 'lose' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} disabled={busy} onClick={() => setOvWhich(ovOpen === 'lose' ? null : 'lose')}>بازنده</Button>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        );
        const pick = ovOpen && overall ? (
              <section className="cu__ovpick" aria-label={`کارت شتر برای شرط ${ovOpen === 'win' ? 'برنده' : 'بازنده'}`}>
                <p className="cu__cap">کارت شتر را برای شرط {ovOpen === 'win' ? 'برندهٔ' : 'بازندهٔ'} نهایی انتخاب کنید <small>برنده {fa(view.winnerCount)} مانده، بازنده {fa(view.loserCount)} مانده</small></p>
                <div className="cu__ovlist">
                  {CAMELS.map((c) => {
                    const ok = overall.cards.includes(c) && !(q?.type === 'overall' && q.camel === c);
                    return (
                      <span key={c} className={`cu-ov cu-c--${c}`}>
                        <button type="button" className={hint?.type === 'overall' && hint.camel === c && hint.which === ovOpen ? 'cu-hint' : ''} disabled={busy || !ok}
                          onClick={() => { setOvWhich(null); onAction({ type: 'overall', camel: c, which: ovOpen }); }} aria-label={`شتر ${CAMEL_FA[c]}${ok ? '' : '، کارت مصرف شده'}`}>
                          <CamelIcon c={c} size={1.8} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </section>
        ) : null;
        return framed ? (myTurn || !view.outcome ? <DockSlot>{bar}{pick}</DockSlot> : null) : <>{bar}{pick}</>;
      })()}

      {!framed && <ul className="cu__players" aria-label="تماشاگران">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.coins.map((_, k) => k)).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['cu-pl', view.current === s && !view.outcome ? 'cu-pl--turn' : '', s === me ? 'cu-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'cu-pl--win' : ''].join(' ')}>
            <bdi className="cu-pl__name">{who(s)}</bdi>
            <Pop v={view.coins[s]!} className="cu-pl__coins" />
            <span className="cu-pl__bets">
              {view.legBets[s]!.map((b, i) => <span key={i} data-flip={`chip-${s}-${i}`} data-flip-from={`leg-${b.camel}`} data-flip-exit={`leg-${b.camel}`} className={`cu-chip cu-c--${b.camel}`}>{fa(b.value)}</span>)}
              {view.pyramid[s]! > 0 && <Pop v={view.pyramid[s]!} className="cu-pyr"><img src={pyramid} alt="هرم" title="تاس از هرم" draggable={false} />×{fa(view.pyramid[s]!)}</Pop>}
            </span>
          </li>
        ))}
      </ul>}
      {view.myOverall.length > 0 && !view.outcome && <p className="cu__mine">شرط‌های نهایی شما: {view.myOverall.map((b) => `${CAMEL_FA[b.camel]} (${b.which === 'win' ? 'برنده' : 'بازنده'})`).join('، ')}</p>}
      {!framed && view.log.length > 0 && <p className="cu__log">آخرین مرحله: {view.log.at(-1)!.gains.map((g, k) => <span key={k}>{k > 0 && '، '}<bdi>{who(k)}</bdi> {g >= 0 ? '+' : '−'}{fa(Math.abs(g))}</span>)}</p>}
    </div>
  );
}
