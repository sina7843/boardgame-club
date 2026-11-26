// مسابقهٔ شترها renderer: the race course as a loop of sixteen sand tiles around the pyramid, on a painted desert.
// Camel stacks lean on their tiles (top camel drawn highest); oasis and mirage tiles sit on the sand. The pyramid in the
// middle shows the five dice: rolled ones beside it with their value, the rest still inside. Leg-bet tiles are stacked
// per camel, the secret overall bets and the spectators' purses follow.
import './renderer.css';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Icon, MOTION, RailSlot, T, TurnIndicator, tx, useInFrame, motionOff, useFlip, usePop, useTermsLang, type GameRendererProps, DockSlot } from '@bg/ui';
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
import { terms } from './terms.ts';
import { CAMELS, TRACK, type Camel, type CamelView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const CAMEL_FA: Record<Camel, string> = { blue: 'آبی', green: 'سبز', orange: 'نارنجی', yellow: 'زرد', white: 'سفید' };

const CAMEL_ART: Record<Camel, string> = { blue: camelBlue, green: camelGreen, orange: camelOrange, yellow: camelYellow, white: camelWhite };

export function CamelIcon({ c, size = 1.6, walk }: { c: Camel; size?: number; walk?: boolean }) {
  useTermsLang();
  return <img {...(walk ? { 'data-camel': c } : {})} src={CAMEL_ART[c]} alt={`${tx(terms.camel)} ${CAMEL_FA[c]}`} draggable={false} className={`cu-camel cu-c--${c}`} style={{ inlineSize: `${size}rem`, blockSize: `${size}rem` }} />;
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
  useTermsLang(); // re-render when the terms language changes (module-level helpers read it through tx)
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
  // Phone: the bar shows three buttons; «کاشی» and «شرط نهایی» open their choices in a row under them.
  const [phoneOpen, setPhoneOpen] = useState<null | 'desert' | 'final'>(null);
  useEffect(() => { setPlacing(null); setOvWhich(null); setPhoneOpen(null); }, [view.seq]);
  const togglePhone = (g: 'desert' | 'final') => { setPhoneOpen(phoneOpen === g ? null : g); setPlacing(null); setOvWhich(null); };
  // Race order, leader first: furthest space, and on a stack the top camel (last in the list) leads.
  const order = Object.entries(view.spaces).sort(([a], [b]) => Number(b) - Number(a)).flatMap(([, st]) => st.slice().reverse());
  const hint = expected as unknown as { type: string; camel?: Camel; which?: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: placing ? `خانهٔ ${tx(terms.tile)} را روی مسیر بزنید` : `${tx(terms.bet)} ببندید، ${tx(terms.tile)} بگذارید یا ${tx(terms.die)} بیندازید` }
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
          <section className="cu-rail" aria-label={tx(terms.thisLeg)}>
            <h3><T t={terms.thisLeg} /><span className="cu-rail__note">{fa(view.diceLeft)} <T t={terms.diceInPyramid} /></span></h3>
            <div className="cu-rail__rank"><span>ترتیب:</span>{order.map((c) => <CamelIcon key={c} c={c} size={1.8} />)}</div>
            <div className="cu-rail__pills">
              <span className="bgv-chip"><T t={terms.overallBet} /> <T t={terms.winner} />: {fa(view.winnerCount)}</span>
              <span className="bgv-chip"><T t={terms.loser} />:{fa(view.loserCount)}</span>
            </div>
          </section>
          <p className="cu-rail__tip"><Icon name="book" size={18} />
            <span>{placing ? <><T t={terms.oasis} /> یک خانه جلو می‌برد و <T t={terms.mirage} /> یک خانه عقب؛ <T t={terms.tile} /> فقط روی خانه‌های خط‌چین می‌نشیند.</> : <>هر <T t={terms.pyramidDie} /> <T t={terms.camel} /> همان رنگ را ۱ تا ۳ خانه جلو می‌برد و <T t={terms.camelsEz} /> روی پشتش را هم می‌برد. آخر <T t={terms.leg} /> <T t={terms.camelCard} /> اول عددش را می‌دهد، <T t={terms.camel} /> دوم ۱ سکه و بقیه ۱ سکه جریمه دارند.</>}</span>
          </p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="cu__track" aria-label={tx(terms.track)}>
        {Array.from({ length: TRACK }, (_, i) => i + 1).map((sp) => {
          const stack = sp < TRACK ? view.spaces[sp] ?? [] : Object.entries(view.spaces).filter(([k]) => Number(k) >= TRACK).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([, st]) => st);
          const tile = view.desert.findIndex((d) => d?.space === sp);
          const can = !!placing && !!desert?.spaces.includes(sp) && !busy;
          const [col, row] = cell(sp);
          const legal = myTurn && !queued && !placing && !!desert?.spaces.includes(sp);
          const cls = ['cu-sp', can ? 'cu-sp--can' : '', legal ? 'cu-sp--legal' : '', sp === TRACK ? 'cu-sp--last' : '', sp === 1 ? 'cu-sp--first' : ''].join(' ');
          const inner = (
            <>
              <small className="cu-sp__n">{fa(sp)}</small>
              {tile >= 0 && <span data-flip={`tile-${tile}`} data-flip-from={`seat-${tile}`} data-flip-exit={`seat-${tile}`} className={`cu-tile ${view.desert[tile]!.oasis ? 'cu-tile--oasis' : 'cu-tile--mirage'}`} title={who(tile)}><img src={view.desert[tile]!.oasis ? oasisArt : mirageArt} alt={view.desert[tile]!.oasis ? `${tx(terms.oasis)} +۱` : `${tx(terms.mirage)} −۱`} draggable={false} /></span>}
              <span className="cu-stack" style={{ ['--n' as string]: stack.length }}>{stack.slice().reverse().map((c) => <CamelIcon key={c} c={c} walk />)}</span>
            </>
          );
          const style = { gridColumn: col, gridRow: row };
          return can
            ? <button key={sp} data-sp={sp} type="button" className={cls} style={style} onClick={() => onAction({ type: 'desert', space: sp, oasis: placing === 'oasis' })} aria-label={`گذاشتن ${tx(terms.tile)} روی خانهٔ ${fa(sp)}`}>{inner}</button>
            : <div key={sp} data-sp={sp} className={cls} style={style}>{inner}</div>;
        })}
        <div className="cu-centre">
          <div className="cu-centre__dice" aria-label={`${tx(terms.diceLeftInPyramid)}: ${fa(view.diceLeft)}`}>
            {CAMELS.filter((c) => rolled.has(c)).map((c) => { const fresh = freshRoll && last?.camel === c; return <Die key={fresh ? `${c}-${view.seq}` : c} c={c} v={rolled.get(c)} roll={fresh} />; })}
            {rollPending && <Die c={null} />}
          </div>
          {lastRoll && !rollPending && (
            <p className="cu__roll" role="status" key={view.seq}>
              {last?.kind === 'roll' ? <bdi>{who(last.seat)}</bdi> : <T t={terms.lastDie} />} <CamelIcon c={lastRoll.camel} size={1.2} /> <b>{fa(lastRoll.value)}</b>
            </p>
          )}
          {!framed && <small className="cu-centre__leg"><T t={terms.legEz} /> {fa(view.leg)}</small>}
          {myTurn && <span className="cu-centre__left"><T t={terms.diceInPyramid} /> {fa(view.diceLeft)}</span>}
        </div>
      </section>

      {(() => {
        // One action bar (design §1/§3): leg bet | desert tile | pyramid die | final bet; in the frame it is the dock row.
        // The final bet picks «برنده»/«بازنده» first, then one of your camel cards (§4).
        const ovOpen = myTurn && overall ? (ovWhich ?? (hint?.type === 'overall' ? (hint.which as 'win' | 'lose') : null)) : null;
        const bar = (
          <div className={framed ? 'cu__bar cu__bar--framed' : 'cu__bar'} data-open={phoneOpen ?? undefined} role="group" aria-label="کارهای نوبت">
            {!view.outcome && (
              <section className="cu__bets cu__grp" aria-label={tx(terms.legBet)}>
                <h3 className="cu__cap"><T t={terms.legBet} /></h3>
                <div className="cu__grpbody">
                  {CAMELS.map((c) => {
                    const v = view.legTiles[c][0];
                    const left = view.legTiles[c].length;
                    return (
                      <button key={c} type="button" data-flip-anchor={`leg-${c}`} className={['cu-legtile', `cu-c--${c}`, hint?.type === 'leg' && hint.camel === c ? 'cu-hint' : ''].join(' ')} style={{ ['--left' as string]: left }}
                        disabled={!legs.has(c) || busy} onClick={() => onAction({ type: 'leg', camel: c })} aria-label={`${tx(terms.legBet)} روی ${CAMEL_FA[c]}${v ? `، ${fa(v)} سکه` : '، تمام شده'}`}>
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
            {myTurn && framed && (
              <div className="cu__phonebtns">
                <Button size="sm" variant="secondary" aria-expanded={phoneOpen === 'desert'} disabled={!desert} className={phoneOpen === 'desert' ? 'cu-on' : ''} onClick={() => togglePhone('desert')}><img src={oasisArt} alt="" className="cu-pyramid" draggable={false} /><T t={terms.tile} /></Button>
                <Button size="sm" variant="secondary" disabled={busy} aria-label={`${tx(terms.rollFromPyramid)} (+۱ سکه)`} onClick={() => { setRollSent(real.seq); onAction({ type: 'roll' }); }}><img src={pyramid} alt="" className="cu-pyramid" draggable={false} /><T t={terms.rollFromPyramid} /></Button>
                <Button size="sm" variant="secondary" aria-expanded={phoneOpen === 'final'} disabled={!overall} className={phoneOpen === 'final' ? 'cu-on' : ''} onClick={() => togglePhone('final')}><CamelIcon c={order[0] ?? 'green'} size={1.3} /><T t={terms.overallBet} /></Button>
              </div>
            )}
            {myTurn && (
              <>
                <section className="cu__actions cu__grp" aria-label={tx(terms.desertTile)}>
                  <h3 className="cu__cap"><T t={terms.desertTile} /></h3>
                  <div className="cu__grpbody">
                    {desert && <Button size="sm" variant="secondary" aria-pressed={placing === 'oasis'} className={placing === 'oasis' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} onClick={() => setPlacing(placing === 'oasis' ? null : 'oasis')}><img src={oasisArt} alt="" className="cu-pyramid" draggable={false} /><T t={terms.oasis} /> +۱</Button>}
                    {desert && <Button size="sm" variant="secondary" aria-pressed={placing === 'mirage'} className={placing === 'mirage' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} onClick={() => setPlacing(placing === 'mirage' ? null : 'mirage')}><img src={mirageArt} alt="" className="cu-pyramid" draggable={false} /><T t={terms.mirage} /> −۱</Button>}
                    {!desert && <small><T t={terms.tile} /> شما روی مسیر است</small>}
                  </div>
                </section>
                <section className="cu__grp cu__rollgrp" aria-label={tx(terms.rollFromPyramid)}>
                  <h3 className="cu__cap"><T t={terms.rollFromPyramid} /> <small>{fa(view.diceLeft)} مانده</small></h3>
                  <div className="cu__grpbody">
                    <Button size="sm" variant="secondary" disabled={busy} aria-label={`${tx(terms.rollFromPyramid)} (+۱ سکه)`} className={['cu-tilebtn', 'cu-rollbtn', hint?.type === 'roll' ? 'cu-hint' : ''].join(' ')} onClick={() => { setRollSent(real.seq); onAction({ type: 'roll' }); }}><img src={pyramid} alt="" className="cu-pyramid" draggable={false} />+۱ سکه</Button>
                  </div>
                </section>
                {overall && (
                  <section className="cu__overall cu__grp" aria-label={tx(terms.overallBet)}>
                    <h3 className="cu__cap"><T t={terms.overallBet} /></h3>
                    <div className="cu__grpbody">
                      <Button size="sm" variant="secondary" icon="crown" aria-pressed={ovOpen === 'win'} className={ovOpen === 'win' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} disabled={busy} onClick={() => setOvWhich(ovOpen === 'win' ? null : 'win')}><T t={terms.winner} /></Button>
                      <Button size="sm" variant="secondary" aria-pressed={ovOpen === 'lose'} className={ovOpen === 'lose' ? 'cu-tilebtn cu-on' : 'cu-tilebtn'} disabled={busy} onClick={() => setOvWhich(ovOpen === 'lose' ? null : 'lose')}><T t={terms.loser} /></Button>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        );
        const pick = ovOpen && overall ? (
              <section className="cu__ovpick" aria-label={`${tx(terms.camelCard)} برای ${tx(terms.bet)} ${tx(ovOpen === 'win' ? terms.winner : terms.loser)}`}>
                <p className="cu__cap"><T t={terms.camelCard} /> را برای <T t={ovOpen === 'win' ? terms.overallWinnerBet : terms.overallLoserBet} /> انتخاب کنید <small><T t={terms.winner} /> {fa(view.winnerCount)} مانده، <T t={terms.loser} /> {fa(view.loserCount)} مانده</small></p>
                <div className="cu__ovlist">
                  {CAMELS.map((c) => {
                    const ok = overall.cards.includes(c) && !(q?.type === 'overall' && q.camel === c);
                    return (
                      <span key={c} className={`cu-ov cu-c--${c}`}>
                        <button type="button" className={hint?.type === 'overall' && hint.camel === c && hint.which === ovOpen ? 'cu-hint' : ''} disabled={busy || !ok}
                          onClick={() => { setOvWhich(null); onAction({ type: 'overall', camel: c, which: ovOpen }); }} aria-label={`${tx(terms.camel)} ${CAMEL_FA[c]}${ok ? '' : '، کارت مصرف شده'}`}>
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
              {view.pyramid[s]! > 0 && <Pop v={view.pyramid[s]!} className="cu-pyr"><img src={pyramid} alt={tx(terms.pyramid)} title={tx(terms.rollFromPyramid)} draggable={false} />×{fa(view.pyramid[s]!)}</Pop>}
            </span>
          </li>
        ))}
      </ul>}
      {view.myOverall.length > 0 && !view.outcome && <p className="cu__mine"><T t={terms.overallBets} /> شما: {view.myOverall.map((b) => `${CAMEL_FA[b.camel]} (${tx(b.which === 'win' ? terms.winner : terms.loser)})`).join('، ')}</p>}
      {!framed && view.log.length > 0 && <p className="cu__log"><T t={terms.lastLeg} />: {view.log.at(-1)!.gains.map((g, k) => <span key={k}>{k > 0 && '، '}<bdi>{who(k)}</bdi> {g >= 0 ? '+' : '−'}{fa(Math.abs(g))}</span>)}</p>}
    </div>
  );
}
