// یاتزی renderer: a walnut dice tray lined with green felt (five pip dice, tap to keep between rolls, a leather cup
// beside the roll button) above a paper score sheet with one column per player. Open boxes of the active player show
// the points the current dice would score; a box is chosen and then confirmed with «ثبت».
import './renderer.css';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { CATS, UPPER, UPPER_TARGET, isYahtzee, type Cat, type YahtzeeView } from './rules.ts';
import cup from './art/cup.webp';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CAT_FA: Record<Cat, string> = {
  ones: 'یک‌ها', twos: 'دوها', threes: 'سه‌ها', fours: 'چهارها', fives: 'پنج‌ها', sixes: 'شش‌ها',
  threeKind: 'سه‌تایی', fourKind: 'چهارتایی', fullHouse: 'فول‌هاوس', smallStraight: 'ردیف کوچک', largeStraight: 'ردیف بزرگ', yahtzee: 'یاتزی', chance: 'شانس'
};
const CAT_HINT: Record<Cat, string> = {
  ones: 'جمع ۱ها', twos: 'جمع ۲ها', threes: 'جمع ۳ها', fours: 'جمع ۴ها', fives: 'جمع ۵ها', sixes: 'جمع ۶ها',
  threeKind: '۳ یکسان: جمع تاس‌ها', fourKind: '۴ یکسان: جمع تاس‌ها', fullHouse: '۳+۲: ۲۵', smallStraight: '۴ پشت سر هم: ۳۰', largeStraight: '۵ پشت سر هم: ۴۰', yahtzee: '۵ یکسان: ۵۰', chance: 'جمع تاس‌ها'
};
// Pip positions on a 3×3 grid (0–8) for each face.
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Die({ v }: { v: number }) {
  return (
    <svg viewBox="0 0 60 60" className="yz-die" role="img" aria-label={`تاس ${fa(v)}`}>
      <rect x="2" y="2" width="56" height="56" rx="11" className="yz-die__body" />
      {PIPS[v]!.map((p) => <circle key={p} cx={14 + (p % 3) * 16} cy={14 + Math.floor(p / 3) * 16} r="5.4" className="yz-die__pip" />)}
    </svg>
  );
}

export default function YahtzeeRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<YahtzeeView>) {
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
    : myTurn ? { tone: 'mine' as const, text: view.rolls === 0 ? 'نوبت شماست: تاس بریزید' : view.rolls < 3 ? `تاس‌هایی را که می‌خواهید نگه دارید و دوباره بریزید (${fa(3 - view.rolls)} بار مانده) یا یک خانه را پر کنید` : 'یک خانه از جدول را پر کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)} (${fa(view.rolls)} از ۳ ریختن)` };
  const round = Math.min(13, Object.keys(view.sheets[view.current] ?? {}).length + 1);
  const last = view.last;

  return (
    <div className="yz" data-seq={view.seq} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="yz__live" aria-live="polite">
        {!view.outcome && <span>دور {fa(round)} از ۱۳</span>}
        {last && <span key={view.seq}><bdi>{who(last.seat)}</bdi> در «{CAT_FA[last.cat]}» {fa(last.points)} امتیاز نوشت{last.bonus ? ' و ۱۰۰ امتیاز پاداش یاتزی گرفت' : ''}.</span>}
      </p>

      <section className="yz__tray" aria-label="تاس‌ها">
        <div className="yz__felt">
          {view.dice.length === 0 && !rollingKeep
            ? <span className="yz__empty">هنوز تاسی ریخته نشده</span>
            : (rollingKeep ? Array.from({ length: 5 }, (_, i) => view.dice[i] ?? 1) : view.dice).map((v, i) => (tumbling(i)
              ? <span key={`t${i}`} className="yz-keep" style={{ ['--i' as string]: i }} role="img" aria-label="در حال چرخیدن"><span className="bg-tumble yz-keep__die" aria-hidden="true"><Die v={v} /></span></span>
              : canKeep
              ? <button key={`${i}-${at[i]}`} type="button" style={{ ['--i' as string]: i }} disabled={busy || !!rollingKeep}
                  className={['yz-keep', keep[i] ? 'yz-keep--on' : '', keepHint && keepHint[i] !== keep[i] ? 'yz-hint' : ''].join(' ')}
                  aria-pressed={keep[i]} aria-label={`تاس ${fa(v)}${keep[i] ? '، نگه داشته شده' : ''}`}
                  onClick={() => setKeep(keep.map((x, j) => (j === i ? !x : x)))}>
                  <span className="bg-roll yz-keep__die"><Die v={v} /></span>
                  {keep[i] && <small aria-hidden="true">نگه‌دار</small>}
                </button>
              : <span key={`${i}-${at[i]}`} className="yz-keep" style={{ ['--i' as string]: i }}><span className="bg-roll yz-keep__die"><Die v={v} /></span></span>))}
        </div>
        {canRoll && (
          <div className="yz__roll">
            <img src={cup} alt="" aria-hidden="true" className="yz__cup" draggable={false} />
            <Button size="sm" disabled={busy || !!queued} className={hint?.type === 'roll' && keepDone ? 'yz-hint' : ''}
              onClick={() => roll(view.rolls ? keep : [false, false, false, false, false])}>
              {view.rolls ? 'دوباره بریز' : 'بریز'} ({fa(view.rolls + 1)} از ۳)
            </Button>
          </div>
        )}
      </section>

      <div className="yz__sheetwrap">
        <table className="yz__sheet">
          <caption><span className="yz__padtitle">یاتزی</span> جدول امتیاز</caption>
          <thead>
            <tr>
              <th scope="col">خانه</th>
              {view.sheets.map((_, k) => (
                <th scope="col" key={k} className={[view.current === k && !view.outcome ? 'yz-col--turn' : '', k === me ? 'yz-col--me' : ''].join(' ')}><bdi title={who(k)}>{who(k)}</bdi></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATS.map((cat) => (
              <Fragment key={cat}>
              {(cat === 'ones' || cat === 'threeKind') && (
                <tr className="yz-row--section"><th scope="rowgroup" colSpan={view.sheets.length + 1}>{cat === 'ones' ? 'بخش بالا' : 'بخش پایین'}</th></tr>
              )}
              <tr className={cat === 'threeKind' ? 'yz-row--split' : ''}>
                <th scope="row"><span>{CAT_FA[cat]}</span><small>{CAT_HINT[cat]}</small></th>
                {view.sheets.map((sheet, k) => {
                  const v = sheet[cat];
                  const fresh = last && last.seat === k && last.cat === cat;
                  if (k === me && pendingCat === cat && v === undefined) return <td key={k} className="yz-cell--fresh"><b className="bg-pop">{fa(options.get(cat) ?? 0)}</b></td>;
                  if (v !== undefined) return <td key={k} className={fresh ? 'yz-cell--fresh' : ''}><b key={fresh ? view.seq : 0} className={fresh ? 'bg-pop' : ''}>{fa(v)}</b></td>;
                  if (k === me && options.has(cat)) {
                    const pts = options.get(cat)!;
                    return (
                      <td key={k}>
                        <button type="button" disabled={busy || !!queued} aria-pressed={pick === cat} aria-label={`${CAT_FA[cat]}: ${fa(pts)} امتیاز`}
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
            <tr><th scope="row">جمع بالا</th>{view.totals.map((t, k) => <td key={k}>{fa(t.upper)}<small> / {fa(UPPER_TARGET)}</small></td>)}</tr>
            <tr><th scope="row">پاداش بالا (۳۵)</th>{view.totals.map((t, k) => <td key={k}>{t.upperBonus ? <b className="yz-ok">✓ {fa(t.upperBonus)}</b> : UPPER.every((c) => view.sheets[k]![c] !== undefined) ? '۰' : '…'}</td>)}</tr>
            <tr><th scope="row">جمع پایین</th>{view.totals.map((t, k) => <td key={k}>{fa(t.lower)}</td>)}</tr>
            <tr><th scope="row">پاداش یاتزی</th>{view.totals.map((t, k) => <td key={k}>{t.yahtzeeBonus ? <b className="yz-ok" key={t.yahtzeeBonus}>+{fa(t.yahtzeeBonus)}</b> : '۰'}</td>)}</tr>
            <tr className="yz-row--total"><th scope="row">امتیاز کل</th>{view.totals.map((t, k) => <td key={k}><b key={t.total} className="bg-pop">{fa(t.total)}</b></td>)}</tr>
          </tfoot>
        </table>
      </div>

      {myTurn && view.rolls > 0 && isYahtzee(view.dice) && view.sheets[me]?.yahtzee !== undefined && (
        <p className="yz__joker" role="note">
          یاتزی اضافه{view.sheets[me]!.yahtzee === 50 ? ' (+۱۰۰ پاداش)' : ''}؛ قانون جوکر: فقط خانه‌هایی که امتیازشان نمایش داده شده مجازند.
        </p>
      )}
      {myTurn && options.size > 0 && (
        <div className="yz__bar">
          <Button size="sm" disabled={busy || !pick || !!queued} className={pick && hint?.type === 'score' && hint.cat === pick ? 'yz-hint yz-submit' : 'yz-submit'}
            onClick={() => pick && onAction({ type: 'score', cat: pick })}>
            {pick ? `ثبت ${fa(options.get(pick) ?? 0)} در «${CAT_FA[pick]}»` : 'یک خانه را انتخاب کنید'}
          </Button>
        </div>
      )}
    </div>
  );
}
