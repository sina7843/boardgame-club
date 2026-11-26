// یاتزی renderer: a walnut dice tray lined with green felt (five pip dice, tap to keep between rolls, a leather cup
// beside the roll button) above a paper score sheet with one column per player. Open boxes of the active player show
// the points the current dice would score; a box is chosen and then confirmed with «ثبت».
import './renderer.css';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Button, DockSlot, Icon, RailSlot, T, TurnIndicator, tx, useInFrame, useFlip, useTermsLang, type GameRendererProps, type Term } from '@bg/ui';
import { LOWER, UPPER, UPPER_TARGET, isYahtzee, type Cat, type YahtzeeView } from './rules.ts';
import { terms } from './terms.ts';
import cup from './art/cup.webp';
import die1 from './art/yahtzee-die-1.png';
import die3 from './art/yahtzee-die-3.png';
import die4 from './art/yahtzee-die-4.png';
import die5 from './art/yahtzee-die-5.png';
import die6 from './art/yahtzee-die-6.png';
// The handoff art has no face 2: that face keeps the SVG die below.
const DIE_ART: Record<number, string> = { 1: die1, 3: die3, 4: die4, 5: die5, 6: die6 };

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const CAT_T: Record<Cat, Term> = {
  ones: terms.ones, twos: terms.twos, threes: terms.threes, fours: terms.fours, fives: terms.fives, sixes: terms.sixes,
  threeKind: terms.threeKind, fourKind: terms.fourKind, fullHouse: terms.fullHouse, smallStraight: terms.smallStraight, largeStraight: terms.largeStraight, yahtzee: terms.yahtzee, chance: terms.chance
};
const catName = (c: Cat) => tx(CAT_T[c]);
const H = (fa: string, bg: string): Term => ({ fa, bg });
const CAT_HINT: Record<Cat, Term> = {
  ones: H('جمع ۱ها', 'Sum of 1s'), twos: H('جمع ۲ها', 'Sum of 2s'), threes: H('جمع ۳ها', 'Sum of 3s'), fours: H('جمع ۴ها', 'Sum of 4s'), fives: H('جمع ۵ها', 'Sum of 5s'), sixes: H('جمع ۶ها', 'Sum of 6s'),
  threeKind: H('۳ یکسان: جمع تاس‌ها', '3 alike: sum of dice'), fourKind: H('۴ یکسان: جمع تاس‌ها', '4 alike: sum of dice'), fullHouse: H('۳+۲: ۲۵', '3+2: 25'),
  smallStraight: H('۴ پشت سر هم: ۳۰', '4 in a row: 30'), largeStraight: H('۵ پشت سر هم: ۴۰', '5 in a row: 40'), yahtzee: H('۵ یکسان: ۵۰', '5 alike: 50'), chance: H('جمع تاس‌ها', 'Sum of dice')
};
// Pip positions on a 3×3 grid (0–8) for each face.
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ v }: { v: number }) {
  useTermsLang();
  if (DIE_ART[v]) return <img src={DIE_ART[v]} className="yz-die yz-die--art" role="img" aria-label={`${tx(terms.die)} ${fa(v)}`} draggable={false} />;
  return (
    <svg viewBox="0 0 60 60" className="yz-die" role="img" aria-label={`${tx(terms.die)} ${fa(v)}`}>
      <rect x="2" y="2" width="56" height="56" rx="11" className="yz-die__body" />
      {PIPS[v]!.map((p) => <circle key={p} cx={14 + (p % 3) * 16} cy={14 + Math.floor(p / 3) * 16} r="5.4" className="yz-die__pip" />)}
    </svg>
  );
}

export default function YahtzeeRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<YahtzeeView>) {
  useTermsLang(); // re-render when the terms language changes (module-level helpers read it through tx)
  const me = mySeat ?? -1;
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const options = new Map(legalActions.filter((a) => a.type === 'score').map((a) => [a.cat as Cat, a.points as number]));
  const myTurn = view.current === me && !view.outcome;
  const [keep, setKeep] = useState<boolean[]>([false, false, false, false, false]);
  const [pick, setPick] = useState<Cat | null>(null);
  const turnKey = `${view.current}-${view.rolls === 0}`;
  useEffect(() => { setKeep([false, false, false, false, false]); }, [turnKey]);
  useEffect(() => { setPick(null); }, [view.seq]);
  const root = useRef<HTMLDivElement>(null);
  // My roll in the undo window or waiting for the server: the dice I did not keep tumble with their pips hidden.
  const [asked, setAsked] = useState<boolean[] | null>(null);
  useEffect(() => { if (!busy) setAsked(null); }, [busy]);
  const rollingKeep = queued?.type === 'roll' ? (queued.keep as boolean[]) : busy ? asked : null;
  const tumbling = (i: number) => !!rollingKeep && !(view.rolls > 0 && rollingKeep[i]);
  // Writing a box: the points (already shown on the button) are written at once during the undo window.
  const pendingCat = queued?.type === 'score' ? (queued.cat as Cat) : null;
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}|${!!rollingKeep}`);
  // A die is thrown again when it was rerolled: every die not kept on a new roll (others' rolls: a changed face).
  const prev = useRef<{ dice: number[]; rolls: number; at: number[]; keep: boolean[] | null }>({ dice: [], rolls: 0, at: [], keep: null });
  const rolled = view.rolls !== prev.current.rolls && view.rolls > 0;
  const lastKeep = view.current === me ? prev.current.keep : null;
  const at = view.dice.map((v, i) => (rolled && (view.rolls === 1 || (lastKeep ? !lastKeep[i] : prev.current.dice[i] !== v)) ? view.seq : prev.current.dice[i] === v ? prev.current.at[i]! : view.seq));
  prev.current = { dice: view.dice, rolls: view.rolls, at, keep: rollingKeep ?? (rolled ? null : prev.current.keep) };
  const roll = (k: boolean[]) => { setAsked(k); onAction({ type: 'roll', keep: k }); };

  const hint = expected as unknown as { type: string; keep?: boolean[]; cat?: Cat } | null;
  const keepHint = hint?.type === 'roll' && view.rolls > 0 ? hint.keep! : null;
  const keepDone = !keepHint || keepHint.every((k, i) => k === keep[i]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const canKeep = myTurn && view.rolls > 0 && view.rolls < 3;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: view.rolls === 0 ? `نوبت شماست: ${tx(terms.rollPrompt)}` : view.rolls < 3 ? `${tx(terms.diceThat)} را که می‌خواهید نگه دارید و دوباره بریزید (${fa(3 - view.rolls)} بار مانده) یا یک ${tx(terms.box)} را پر کنید` : `یک ${tx(terms.box)} از جدول را پر کنید` }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)} (${fa(view.rolls)} از ۳ ${tx(terms.rolls)})` };
  const head = view.sheets.map((_, k) => (
    <th scope="col" key={k} className={[view.current === k && !view.outcome ? 'yz-col--turn' : '', k === me ? 'yz-col--me' : ''].join(' ')}><i className="yz-seatdot" style={{ background: `var(--seat-${k + 1})` }} aria-hidden="true" /><bdi title={who(k)}>{who(k)}</bdi></th>
  ));
  const round = Math.min(13, Object.keys(view.sheets[view.current] ?? {}).length + 1);
  const last = view.last;
  const framed = useInFrame() !== null;

  return (
    <div className={framed ? 'yz yz--framed' : 'yz'} data-seq={view.seq} ref={root}>
      {framed && (
        <RailSlot>
          {mySeat !== null && view.totals[mySeat] && (
            <section className="yz-rail" aria-label={tx(terms.upperBonus)}>
              <h3><T t={terms.upperBonus} /></h3>
              <div className="yz-rail__pills">
                <span className="bgv-chip"><T t={terms.upperTotal} />: {fa(view.totals[mySeat]!.upper)} از {fa(UPPER_TARGET)}</span>
                <span className="bgv-chip">{view.totals[mySeat]!.upperBonus ? `${tx(terms.bonus)} گرفتید` : `${fa(Math.max(0, UPPER_TARGET - view.totals[mySeat]!.upper))} تا ${tx(terms.bonus)}`}</span>
              </div>
            </section>
          )}
          <p className="yz-rail__tip"><Icon name="book" size={18} />
            <span>{myTurn && view.rolls > 0 && view.rolls < 3 ? <><T t={terms.diceThat} /> را که می‌خواهید نگه دارید و بقیه را دوباره بریزید، یا همین حالا یک <T t={terms.box} /> را پر کنید.</> : <>هر نوبت تا ۳ بار می‌ریزید و با پر کردن یک <T t={terms.box} /> نوبت تمام می‌شود.</>} جمع بالای ۶۳ یعنی ۳۵ امتیاز <T t={terms.bonus} />.</span>
          </p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!framed && (
      <p className="yz__live" aria-live="polite">
        {!view.outcome && <span><T t={terms.round} /> {fa(round)} از ۱۳</span>}
        {last && <span key={view.seq}><bdi>{who(last.seat)}</bdi> در «{catName(last.cat)}» {fa(last.points)} امتیاز نوشت{last.bonus ? ` و ۱۰۰ امتیاز ${tx(terms.bonus)} ${tx(terms.yahtzee)} گرفت` : ''}.</span>}
      </p>
      )}


      <div className="yz__sheets">
        <div className="yz__sheetwrap">
          <table className="yz__sheet">
            <caption className="visually-hidden"><T t={terms.upperSection} /></caption>
            <colgroup><col />{view.sheets.map((_, k) => <col key={k} className={k === me ? 'yz-colbg--me' : undefined} />)}</colgroup>
            <thead><tr className="yz-row--names"><th scope="col"><span className="yz-homelabel"><T t={terms.box} /></span></th>{head}</tr></thead>
            <tbody>
              <tr className="yz-row--section"><th scope="colgroup" colSpan={view.sheets.length + 1}><T t={terms.upperSection} /></th></tr>
              {UPPER.map((cat) => (
                <Fragment key={cat}>
              <tr >
                <th scope="row"><span>{catName(cat)}</span><small>{tx(CAT_HINT[cat])}</small></th>
                {view.sheets.map((sheet, k) => {
                  const v = sheet[cat];
                  const fresh = last && last.seat === k && last.cat === cat;
                  if (k === me && pendingCat === cat && v === undefined) return <td key={k} className="yz-cell--fresh"><b className="bg-pop">{fa(options.get(cat) ?? 0)}</b></td>;
                  if (v !== undefined) return <td key={k} className={fresh ? 'yz-cell--fresh' : ''}><b key={fresh ? view.seq : 0} className={fresh ? 'bg-pop' : ''}>{fa(v)}</b></td>;
                  if (k === me && options.has(cat)) {
                    const pts = options.get(cat)!;
                    return (
                      <td key={k}>
                        <button type="button" disabled={busy || !!queued} aria-pressed={pick === cat} aria-label={`${catName(cat)}: ${fa(pts)} امتیاز`}
                          className={['yz-opt', pick === cat ? 'yz-opt--on' : '', pts === 0 ? 'yz-opt--zero' : '', hint?.type === 'score' && hint.cat === cat && pick !== cat ? 'yz-hint' : ''].join(' ')}
                          onClick={() => setPick(pick === cat ? null : cat)}>{fa(pts)}</button>
                      </td>
                    );
                  }
                  return <td key={k} className="yz-cell--open" aria-label="خالی">–</td>;
                })}
              </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row"><T t={terms.upperTotal} /></th>{view.totals.map((t, k) => <td key={k}>{fa(t.upper)}<small> / {fa(UPPER_TARGET)}</small></td>)}</tr>
              <tr className="yz-row--bonus"><th scope="row"><T t={terms.bonus} /> (۳۵)</th>{view.totals.map((t, k) => <td key={k}>{t.upperBonus ? <b className="yz-ok">✓ {fa(t.upperBonus)}</b> : UPPER.every((c) => view.sheets[k]![c] !== undefined) ? '۰' : '…'}</td>)}</tr>
            </tfoot>
          </table>
        </div>
        <div className="yz__sheetwrap">
          <table className="yz__sheet">
            <caption className="visually-hidden"><T t={terms.lowerSection} /></caption>
            <colgroup><col />{view.sheets.map((_, k) => <col key={k} className={k === me ? 'yz-colbg--me' : undefined} />)}</colgroup>
            <thead><tr className="yz-row--names"><th scope="col"><span className="yz-homelabel"><T t={terms.box} /></span></th>{head}</tr></thead>
            <tbody>
              <tr className="yz-row--section"><th scope="colgroup" colSpan={view.sheets.length + 1}><T t={terms.lowerSection} /></th></tr>
              {LOWER.map((cat) => (
                <Fragment key={cat}>
              <tr >
                <th scope="row"><span>{catName(cat)}</span><small>{tx(CAT_HINT[cat])}</small></th>
                {view.sheets.map((sheet, k) => {
                  const v = sheet[cat];
                  const fresh = last && last.seat === k && last.cat === cat;
                  if (k === me && pendingCat === cat && v === undefined) return <td key={k} className="yz-cell--fresh"><b className="bg-pop">{fa(options.get(cat) ?? 0)}</b></td>;
                  if (v !== undefined) return <td key={k} className={fresh ? 'yz-cell--fresh' : ''}><b key={fresh ? view.seq : 0} className={fresh ? 'bg-pop' : ''}>{fa(v)}</b></td>;
                  if (k === me && options.has(cat)) {
                    const pts = options.get(cat)!;
                    return (
                      <td key={k}>
                        <button type="button" disabled={busy || !!queued} aria-pressed={pick === cat} aria-label={`${catName(cat)}: ${fa(pts)} امتیاز`}
                          className={['yz-opt', pick === cat ? 'yz-opt--on' : '', pts === 0 ? 'yz-opt--zero' : '', hint?.type === 'score' && hint.cat === cat && pick !== cat ? 'yz-hint' : ''].join(' ')}
                          onClick={() => setPick(pick === cat ? null : cat)}>{fa(pts)}</button>
                      </td>
                    );
                  }
                  return <td key={k} className="yz-cell--open" aria-label="خالی">–</td>;
                })}
              </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="yz-row--bonus"><th scope="row"><T t={terms.bonus} /> <T t={terms.yahtzee} /></th>{view.totals.map((t, k) => <td key={k}>{t.yahtzeeBonus ? <b className="yz-ok" key={t.yahtzeeBonus}>+{fa(t.yahtzeeBonus)}</b> : '۰'}</td>)}</tr>
              <tr className="yz-row--total"><th scope="row"><T t={terms.grandTotal} /></th>{view.totals.map((t, k) => <td key={k}><b key={t.total} className="bg-pop">{fa(t.total)}</b></td>)}</tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Frame: the dice tray with the roll / record buttons is the dock row under the score sheets (design §1/§3). */}
      {(() => { const trayEl = (
      <section className={framed ? 'yz__tray yz__tray--dock' : 'yz__tray'} aria-label={tx(terms.dice)}>
        <div className="yz__felt">
          {view.dice.length === 0 && !rollingKeep
            ? <span className="yz__empty">هنوز <T t={terms.dieAny} /> ریخته نشده</span>
            : (rollingKeep ? Array.from({ length: 5 }, (_, i) => view.dice[i] ?? 1) : view.dice).map((v, i) => (tumbling(i)
              ? <span key={`t${i}`} className="yz-keep" style={{ ['--i' as string]: i }} role="img" aria-label="در حال چرخیدن"><span className="bg-tumble yz-keep__die" aria-hidden="true"><Die v={v} /></span></span>
              : canKeep
              ? <button key={`${i}-${at[i]}`} type="button" style={{ ['--i' as string]: i }} disabled={busy || !!rollingKeep}
                  className={['yz-keep', keep[i] ? 'yz-keep--on' : '', keepHint && keepHint[i] !== keep[i] ? 'yz-hint' : ''].join(' ')}
                  aria-pressed={keep[i]} aria-label={`${tx(terms.die)} ${fa(v)}${keep[i] ? `، ${tx(terms.kept)}` : ''}`}
                  onClick={() => setKeep(keep.map((x, j) => (j === i ? !x : x)))}>
                  <span className="bg-roll yz-keep__die"><Die v={v} /></span>
                  {keep[i] && <small aria-hidden="true"><T t={terms.keep} /></small>}
                </button>
              : <span key={`${i}-${at[i]}`} className="yz-keep" style={{ ['--i' as string]: i }}><span className="bg-roll yz-keep__die"><Die v={v} /></span></span>))}
        </div>
        <div className="yz__roll">
          {canRoll && (<>
            <img src={cup} alt="" aria-hidden="true" className="yz__cup" draggable={false} />
            <Button icon="turn" disabled={busy || !!queued} className={hint?.type === 'roll' && keepDone ? 'yz-hint yz-rollbtn' : 'yz-rollbtn'}
              onClick={() => roll(view.rolls ? keep : [false, false, false, false, false])}>
              {view.rolls ? <T t={terms.rerollBtn} /> : <T t={terms.rollBtn} />} ({fa(view.rolls + 1)} از ۳)
            </Button></>)}
          {myTurn && (
            <Button size="sm" variant={canRoll ? 'secondary' : 'primary'} disabled={busy || !pick || !!queued || options.size === 0} className={pick && hint?.type === 'score' && hint.cat === pick ? 'yz-hint yz-submit' : 'yz-submit'}
              onClick={() => pick && onAction({ type: 'score', cat: pick })}>
              {pick ? `${tx(terms.scoreBtn)}: ${fa(options.get(pick) ?? 0)} در «${catName(pick)}»` : options.size ? `${tx(terms.scoreBtn)} (یک ${tx(terms.box)} را انتخاب کنید)` : tx(terms.scoreBtn)}
            </Button>
          )}
        </div>
      </section>
      ); return framed ? <DockSlot>{trayEl}</DockSlot> : trayEl; })()}


      {myTurn && view.rolls > 0 && isYahtzee(view.dice) && view.sheets[me]?.yahtzee !== undefined && (
        <p className="yz__joker" role="note">
          <T t={terms.yahtzee} /> اضافه{view.sheets[me]!.yahtzee === 50 ? ` (+۱۰۰ ${tx(terms.bonus)})` : ''}؛ <T t={terms.jokerRule} />: فقط <T t={terms.boxesThat} /> که امتیازشان نمایش داده شده مجازند.
        </p>
      )}
    </div>
  );
}
