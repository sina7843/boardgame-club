// مسابقهٔ شترها renderer: a desert race course. Sixteen sand tiles in two rows with camel stacks (top camel drawn
// highest), oasis and mirage tiles, the pyramid with its remaining dice, leg-bet tiles per camel and your secret
// overall-bet cards. The last die and who moved are announced.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
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

export function CamelIcon({ c, size = 1.6 }: { c: Camel; size?: number }) {
  return <img src={CAMEL_ART[c]} alt={`شتر ${CAMEL_FA[c]}`} draggable={false} className={`cu-camel cu-c--${c}`} style={{ inlineSize: `${size}rem`, blockSize: `${size * 0.72}rem` }} />;
}

export default function CamelRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CamelView>) {
  const me = mySeat ?? -1;
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

  return (
    <div className="cu" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="cu__leg">مرحلهٔ {fa(view.leg)}، تاس‌های مانده در هرم: {fa(view.diceLeft)}، شرط‌های نهایی: برنده {fa(view.winnerCount)} / بازنده {fa(view.loserCount)}</p>

      <section className="cu__track" aria-label="مسیر مسابقه">
        {Array.from({ length: TRACK }, (_, i) => i + 1).map((sp) => {
          const stack = view.spaces[sp] ?? [];
          const tile = view.desert.findIndex((d) => d?.space === sp);
          const can = !!placing && !!desert?.spaces.includes(sp) && !busy;
          const inner = (
            <>
              <small className="cu-sp__n">{fa(sp)}</small>{sp === TRACK && <small className="cu-finish">پایان</small>}
              {tile >= 0 && <span className={`cu-tile ${view.desert[tile]!.oasis ? 'cu-tile--oasis' : 'cu-tile--mirage'}`} title={who(tile)}>{view.desert[tile]!.oasis ? '+۱' : '−۱'}</span>}
              <span className="cu-stack">{stack.slice().reverse().map((c) => <CamelIcon key={c} c={c} />)}</span>
            </>
          );
          return can
            ? <button key={sp} type="button" className="cu-sp cu-sp--can" onClick={() => onAction({ type: 'desert', space: sp, oasis: placing === 'oasis' })} aria-label={`گذاشتن کاشی روی خانهٔ ${fa(sp)}`}>{inner}</button>
            : <div key={sp} className={`cu-sp ${sp === TRACK ? 'cu-sp--last' : ''}`}>{inner}</div>;
        })}
      </section>

      {lastRoll && (
        <p className="cu__roll" role="status" key={view.seq}>
          {last?.kind === 'roll' ? <><bdi>{who(last.seat)}</bdi> تاس </> : 'آخرین تاس '}
          <CamelIcon c={lastRoll.camel} size={1.3} /> <b>{fa(lastRoll.value)}</b>
        </p>
      )}

      {!view.outcome && (
        <section className="cu__bets" aria-label="شرط مرحله">
          {CAMELS.map((c) => {
            const v = view.legTiles[c][0];
            return (
              <button key={c} type="button" className={['cu-legtile', `cu-c--${c}`, hint?.type === 'leg' && hint.camel === c ? 'cu-hint' : ''].join(' ')}
                disabled={!legs.has(c) || busy} onClick={() => onAction({ type: 'leg', camel: c })} aria-label={`شرط مرحله روی ${CAMEL_FA[c]}`}>
                <CamelIcon c={c} size={1.3} /><b>{v ? fa(v) : '—'}</b>
              </button>
            );
          })}
        </section>
      )}

      {myTurn && (
        <div className="cu__actions">
          <Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'cu-hint' : ''} onClick={() => onAction({ type: 'roll' })}><img src={pyramid} alt="" className="cu-pyramid" draggable={false} />تاس از هرم (+۱ سکه)</Button>
          {desert && <Button size="sm" variant="secondary" className={placing === 'oasis' ? 'cu-on' : ''} onClick={() => setPlacing(placing === 'oasis' ? null : 'oasis')}>واحه +۱</Button>}
          {desert && <Button size="sm" variant="secondary" className={placing === 'mirage' ? 'cu-on' : ''} onClick={() => setPlacing(placing === 'mirage' ? null : 'mirage')}>سراب −۱</Button>}
        </div>
      )}

      {myTurn && overall && (
        <section className="cu__overall" aria-label="شرط نهایی">
          <small>شرط مخفی نهایی:</small>
          {overall.cards.map((c) => (
            <span key={c} className="cu-ov">
              <CamelIcon c={c} size={1.2} />
              <button type="button" className={hint?.type === 'overall' && hint.camel === c && hint.which === 'win' ? 'cu-hint' : ''} disabled={busy} onClick={() => onAction({ type: 'overall', camel: c, which: 'win' })}>برنده</button>
              <button type="button" disabled={busy} onClick={() => onAction({ type: 'overall', camel: c, which: 'lose' })}>بازنده</button>
            </span>
          ))}
        </section>
      )}

      <ul className="cu__players" aria-label="تماشاگران">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.coins.map((_, k) => k)).map((s) => (
          <li key={s} className={['cu-pl', view.current === s && !view.outcome ? 'cu-pl--turn' : '', s === me ? 'cu-pl--me' : '', view.outcome?.placements[0]?.seat === s ? 'cu-pl--win' : ''].join(' ')}>
            <bdi className="cu-pl__name">{who(s)}</bdi>
            <span className="cu-pl__coins" key={view.coins[s]}>{fa(view.coins[s]!)} سکه</span>
            {view.legBets[s]!.map((b, i) => <span key={i} className={`cu-chip cu-c--${b.camel}`}>{fa(b.value)}</span>)}
            {view.pyramid[s]! > 0 && <span className="cu-pyr">▲×{fa(view.pyramid[s]!)}</span>}
          </li>
        ))}
      </ul>
      {view.myOverall.length > 0 && !view.outcome && <p className="cu__mine">شرط‌های نهایی شما: {view.myOverall.map((b) => `${CAMEL_FA[b.camel]} (${b.which === 'win' ? 'برنده' : 'بازنده'})`).join('، ')}</p>}
      {view.log.length > 0 && <p className="cu__log">آخرین مرحله: {view.log.at(-1)!.gains.map((g, k) => `${who(k)} ${g >= 0 ? '+' : '−'}${fa(Math.abs(g))}`).join('، ')}</p>}
    </div>
  );
}
