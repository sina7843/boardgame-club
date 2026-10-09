// مسابقهٔ شترها renderer: the race course as a loop of sixteen sand tiles around the pyramid, on a painted desert.
// Camel stacks lean on their tiles (top camel drawn highest); oasis and mirage tiles sit on the sand. The pyramid in the
// middle shows the five dice: rolled ones beside it with their value, the rest still inside. Leg-bet tiles are stacked
// per camel, the secret overall bets and the spectators' purses follow.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import camelBlue from './art/camel-blue.webp';
import camelGreen from './art/camel-green.webp';
import camelOrange from './art/camel-orange.webp';
import camelYellow from './art/camel-yellow.webp';
import camelWhite from './art/camel-white.webp';
import pyramid from './art/pyramid.webp';
import { CAMELS, TRACK, type Camel, type CamelView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CAMEL_FA: Record<Camel, string> = { blue: 'آبی', green: 'سبز', orange: 'نارنجی', yellow: 'زرد', white: 'سفید' };

// Painted camels and pyramid are cut from a generated sheet (see DECISIONS.md).
const CAMEL_ART: Record<Camel, string> = { blue: camelBlue, green: camelGreen, orange: camelOrange, yellow: camelYellow, white: camelWhite };

export function CamelIcon({ c, size = 1.6, flip }: { c: Camel; size?: number; flip?: boolean }) {
  return <img {...(flip ? { 'data-flip': `camel-${c}` } : {})} src={CAMEL_ART[c]} alt={`شتر ${CAMEL_FA[c]}`} draggable={false} className={`cu-camel cu-c--${c}`} style={{ inlineSize: `${size}rem`, blockSize: `${size}rem` }} />;
}

/** Loop geometry on a 6×4 grid (literal, LTR): start bottom-left, run right, up, back along the top, down to the finish. */
function cell(sp: number): [number, number] {
  if (sp <= 6) return [sp, 4];
  if (sp <= 9) return [6, 10 - sp];
  if (sp <= 14) return [15 - sp, 1];
  return [1, sp - 13];
}

const PIPS: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]] };
function Die({ c, v, roll }: { c: Camel; v?: number; roll?: boolean }) {
  return (
    <svg className={`cu-die cu-c--${c} ${v ? '' : 'cu-die--in'} ${roll ? 'bg-roll' : ''}`} viewBox="-12 -12 24 24" aria-hidden="true">
      <rect x="-11" y="-11" width="22" height="22" rx="5" className="cu-die__body" />
      {v && PIPS[v]!.map(([x, y], k) => <circle key={k} cx={x * 5.5} cy={y * 5.5} r="2.4" className="cu-die__pip" />)}
    </svg>
  );
}

export default function CamelRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CamelView>) {
  const me = mySeat ?? -1;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, view.seq);
  const myTurn = legalActions.some((a) => a.type === 'roll');
  const legs = new Map(legalActions.filter((a) => a.type === 'leg').map((a) => [a.camel as Camel, a.value as number]));
  const desert = legalActions.find((a) => a.type === 'desert') as { spaces: number[] } | undefined;
  const overall = legalActions.find((a) => a.type === 'overall') as { cards: Camel[] } | undefined;
  const [placing, setPlacing] = useState<null | 'oasis' | 'mirage'>(null);
  useEffect(() => { setPlacing(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; camel?: Camel; which?: string } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: placing ? 'خانهٔ کاشی را روی مسیر بزنید' : 'شرط ببندید، کاشی بگذارید یا تاس بیندازید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const last = view.last;
  const lastRoll = view.rolled.at(-1);
  const rolled = new Map(view.rolled.map((r) => [r.camel, r.value]));

  return (
    <div className="cu" data-seq={view.seq} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section className="cu__track" aria-label="مسیر مسابقه">
        {Array.from({ length: TRACK }, (_, i) => i + 1).map((sp) => {
          const stack = view.spaces[sp] ?? [];
          const tile = view.desert.findIndex((d) => d?.space === sp);
          const can = !!placing && !!desert?.spaces.includes(sp) && !busy;
          const [col, row] = cell(sp);
          const cls = ['cu-sp', can ? 'cu-sp--can' : '', sp === TRACK ? 'cu-sp--last' : '', sp === 1 ? 'cu-sp--first' : ''].join(' ');
          const inner = (
            <>
              <small className="cu-sp__n">{fa(sp)}</small>
              {tile >= 0 && <span data-flip={`tile-${tile}`} className={`cu-tile ${view.desert[tile]!.oasis ? 'cu-tile--oasis' : 'cu-tile--mirage'}`} title={who(tile)}>{view.desert[tile]!.oasis ? '+۱' : '−۱'}</span>}
              <span className="cu-stack" style={{ ['--n' as string]: stack.length }}>{stack.slice().reverse().map((c) => <CamelIcon key={c} c={c} flip />)}</span>
            </>
          );
          const style = { gridColumn: col, gridRow: row };
          return can
            ? <button key={sp} type="button" className={cls} style={style} onClick={() => onAction({ type: 'desert', space: sp, oasis: placing === 'oasis' })} aria-label={`گذاشتن کاشی روی خانهٔ ${fa(sp)}`}>{inner}</button>
            : <div key={sp} className={cls} style={style}>{inner}</div>;
        })}
        <div className="cu-centre">
          <img src={pyramid} alt="" className="cu-centre__pyr" draggable={false} />
          <div className="cu-centre__dice" aria-label={`تاس‌های مانده در هرم: ${fa(view.diceLeft)}`}>
            {CAMELS.map((c) => { const fresh = last?.kind === 'roll' && lastRoll?.camel === c; return <Die key={fresh ? `${c}-${view.seq}` : c} c={c} v={rolled.get(c)} roll={fresh} />; })}
          </div>
          {lastRoll && (
            <p className="cu__roll" role="status" key={view.seq}>
              {last?.kind === 'roll' ? <bdi>{who(last.seat)}</bdi> : 'آخرین تاس'} <CamelIcon c={lastRoll.camel} size={1.2} /> <b>{fa(lastRoll.value)}</b>
            </p>
          )}
          <small className="cu-centre__leg">مرحلهٔ {fa(view.leg)}</small>
        </div>
      </section>

      {!view.outcome && (
        <section className="cu__bets" aria-label="شرط مرحله">
          {CAMELS.map((c) => {
            const v = view.legTiles[c][0];
            const left = view.legTiles[c].length;
            return (
              <button key={c} type="button" data-flip-anchor={`leg-${c}`} className={['cu-legtile', `cu-c--${c}`, hint?.type === 'leg' && hint.camel === c ? 'cu-hint' : ''].join(' ')} style={{ ['--left' as string]: left }}
                disabled={!legs.has(c) || busy} onClick={() => onAction({ type: 'leg', camel: c })} aria-label={`شرط مرحله روی ${CAMEL_FA[c]}${v ? `، ${fa(v)} سکه` : '، تمام شده'}`}>
                <CamelIcon c={c} size={1.9} /><b>{v ? fa(v) : '—'}</b>
              </button>
            );
          })}
        </section>
      )}

      {myTurn && (
        <div className="cu__actions">
          <Button size="sm" disabled={busy} className={['cu-rollbtn', hint?.type === 'roll' ? 'cu-hint' : ''].join(' ')} onClick={() => onAction({ type: 'roll' })}><img src={pyramid} alt="" className="cu-pyramid" draggable={false} />تاس از هرم (+۱ سکه)</Button>
          {desert && <Button size="sm" variant="secondary" className={placing === 'oasis' ? 'cu-on' : ''} onClick={() => setPlacing(placing === 'oasis' ? null : 'oasis')}>واحه +۱</Button>}
          {desert && <Button size="sm" variant="secondary" className={placing === 'mirage' ? 'cu-on' : ''} onClick={() => setPlacing(placing === 'mirage' ? null : 'mirage')}>سراب −۱</Button>}
        </div>
      )}

      {myTurn && overall && (
        <section className="cu__overall" aria-label="شرط نهایی">
          <h3>شرط مخفی نهایی <small>برنده {fa(view.winnerCount)} · بازنده {fa(view.loserCount)}</small></h3>
          <div className="cu__ovlist">
            {overall.cards.map((c) => (
              <span key={c} className={`cu-ov cu-c--${c}`}>
                <CamelIcon c={c} size={1.5} />
                <button type="button" className={hint?.type === 'overall' && hint.camel === c && hint.which === 'win' ? 'cu-hint' : ''} disabled={busy} onClick={() => onAction({ type: 'overall', camel: c, which: 'win' })}>برنده</button>
                <button type="button" disabled={busy} onClick={() => onAction({ type: 'overall', camel: c, which: 'lose' })}>بازنده</button>
              </span>
            ))}
          </div>
        </section>
      )}

      <ul className="cu__players" aria-label="تماشاگران">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.coins.map((_, k) => k)).map((s) => (
          <li key={s} className={['cu-pl', view.current === s && !view.outcome ? 'cu-pl--turn' : '', s === me ? 'cu-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'cu-pl--win' : ''].join(' ')}>
            <bdi className="cu-pl__name">{who(s)}</bdi>
            <span className="cu-pl__coins bg-pop" key={view.coins[s]}>{fa(view.coins[s]!)}</span>
            <span className="cu-pl__bets">
              {view.legBets[s]!.map((b, i) => <span key={i} data-flip={`chip-${s}-${i}`} data-flip-from={`leg-${b.camel}`} className={`cu-chip cu-c--${b.camel}`}>{fa(b.value)}</span>)}
              {view.pyramid[s]! > 0 && <span className="cu-pyr bg-pop" key={view.pyramid[s]} title="تاس از هرم"><img src={pyramid} alt="هرم" draggable={false} />×{fa(view.pyramid[s]!)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {view.myOverall.length > 0 && !view.outcome && <p className="cu__mine">شرط‌های نهایی شما: {view.myOverall.map((b) => `${CAMEL_FA[b.camel]} (${b.which === 'win' ? 'برنده' : 'بازنده'})`).join('، ')}</p>}
      {view.log.length > 0 && <p className="cu__log">آخرین مرحله: {view.log.at(-1)!.gains.map((g, k) => `${who(k)} ${g >= 0 ? '+' : '−'}${fa(Math.abs(g))}`).join('، ')}</p>}
    </div>
  );
}
