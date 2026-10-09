// کاروان renderer: a caravanserai market. Goods token stacks along the top, the five market cards on a carpet, the
// rival's stall (cards in hand, camels, earnings) and your hand with your herd. Select market and/or hand cards and
// the action bar offers what the selection means: take, exchange or sell; camels have their own button.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import diamond from './art/diamond.webp';
import gold from './art/gold.webp';
import silver from './art/silver.webp';
import cloth from './art/cloth.webp';
import spice from './art/spice.webp';
import leather from './art/leather.webp';
import camel from './art/camel.webp';
import { GOODS, PRECIOUS, type Card, type Good, type JaipurView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CARD_FA: Record<Card, string> = { diamond: 'الماس', gold: 'طلا', silver: 'نقره', cloth: 'پارچه', spice: 'ادویه', leather: 'چرم', camel: 'شتر' };

// Goods art is cut from a generated sheet (see DECISIONS.md).
const ART: Record<Card, string> = { diamond, gold, silver, cloth, spice, leather, camel };

export function GoodCard({ c, size = 'md' }: { c: Card; size?: 'sm' | 'md' }) {
  return (
    <span className={['jp-card', `jp-card--${size}`, `jp-c--${c}`].join(' ')} aria-label={CARD_FA[c]}>
      <img src={ART[c]} alt="" draggable={false} />
      {size === 'md' && <span className="jp-card__n">{CARD_FA[c]}</span>}
    </span>
  );
}

export default function JaipurRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<JaipurView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  const myTurn = legalActions.some((a) => a.type !== 'resign');
  const canCamels = legalActions.some((a) => a.type === 'camels');
  const [mk, setMk] = useState<number[]>([]);
  const [hd, setHd] = useState<number[]>([]);
  const [cam, setCam] = useState(0);
  useEffect(() => { setMk([]); setHd([]); setCam(0); }, [view.seq]);
  const hint = expected as unknown as { type: string; good?: Good; count?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const hand = view.hand ?? [];
  const takeG = mk.map((i) => view.market[i]!).filter((c) => c !== 'camel') as Good[];
  const give = hd.map((i) => hand[i]!);
  const sellGood = give.length && !mk.length && !cam && give.every((g) => g === give[0]) ? give[0]! : null;
  const action = (() => {
    if (!myTurn) return null;
    if (mk.length === 1 && !hd.length && !cam && takeG.length === 1) return hand.length < 7 ? { label: `برداشتن ${CARD_FA[takeG[0]!]}`, a: { type: 'take', good: takeG[0] } } : null;
    if (mk.length >= 2 && takeG.length === mk.length && give.length + cam === mk.length && !give.some((g) => takeG.includes(g)) && hand.length + cam <= 7)
      return { label: `معاوضهٔ ${fa(mk.length)} کارت`, a: { type: 'exchange', take: takeG, give: [...give, ...Array<Card>(cam).fill('camel')] } };
    if (sellGood && (!PRECIOUS.has(sellGood) || give.length >= 2)) return { label: `فروش ${fa(give.length)} ${CARD_FA[sellGood]}`, a: { type: 'sell', good: sellGood, count: give.length } };
    return null;
  })();
  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: 'کارت انتخاب کنید: برداشتن، معاوضه یا فروش' }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const camelsInMarket = view.market.filter((c) => c === 'camel').length;
  const earned = (k: number) => view.goods[k]!.reduce((a, b) => a + b, 0) + (Array.isArray(view.bonuses[k]) ? (view.bonuses[k] as number[]).reduce((a, b) => a + b, 0) : 0);
  const last = view.last;

  return (
    <div className="jp" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="jp__round">دست {fa(view.round)}{view.best3 ? ' از ۳' : ''}، نشان‌ها: <bdi>{who(me)}</bdi> {'★'.repeat(view.seals[me]!) || '—'} / <bdi>{who(opp)}</bdi> {'★'.repeat(view.seals[opp]!) || '—'}</p>

      <section className="jp__tokens" aria-label="سکه‌های کالا">
        {GOODS.map((g) => (
          <span key={g} className={`jp-stack jp-c--${g} ${view.tokens[g].length ? '' : 'jp-stack--out'}`} aria-label={`${CARD_FA[g]}: ${fa(view.tokens[g].length)} سکه`}>
            <img src={ART[g]} alt="" draggable={false} />
            <b>{view.tokens[g].length ? fa(view.tokens[g][0]!) : '×'}</b>
            <small>{fa(view.tokens[g].length)}</small>
          </span>
        ))}
        <span className="jp-stack jp-stack--bonus" aria-label="سکه‌های پاداش">پاداش ۳/۴/۵: {fa(view.bonusLeft[3])}/{fa(view.bonusLeft[4])}/{fa(view.bonusLeft[5])}</span>
      </section>

      {(view.outcome ? [me, opp] : [opp]).map((k) => (
        <section key={k} className="jp-stall" aria-label={`غرفهٔ ${who(k)}`}>
          <bdi className="jp-stall__name">{who(k)}</bdi>
          {!view.outcome && <span className="jp-stall__hand">{Array.from({ length: view.handCount[k]! }, (_, i) => <i key={i} />)}</span>}
          <span className="jp-stall__herd"><GoodCard c="camel" size="sm" /> ×{fa(view.herds[k]!)}</span>
          <span className="jp-stall__coins">{fa(view.goods[k]!.reduce((a, b) => a + b, 0))} + {Array.isArray(view.bonuses[k]) ? fa((view.bonuses[k] as number[]).reduce((a, b) => a + b, 0)) : `${fa(view.bonuses[k] as number)} پاداش`}</span>
        </section>
      ))}

      {!view.outcome && (
        <section className="jp__market" aria-label="بازار">
          <div className="jp__carpet">
            {view.market.map((c, i) => (
              <button key={`${view.seq}-${i}`} type="button" className={['jp-pick', mk.includes(i) ? 'jp-pick--on' : '', hint?.type === 'take' && hint.good === c && !mk.length && view.market.indexOf(c) === i ? 'jp-hint' : ''].join(' ')}
                disabled={!myTurn || busy || c === 'camel'} aria-pressed={mk.includes(i)} onClick={() => setMk(mk.includes(i) ? mk.filter((x) => x !== i) : [...mk, i])}><GoodCard c={c} /></button>
            ))}
          </div>
          <span className="jp__deck">دسته: {fa(view.deckCount)}</span>
        </section>
      )}

      {last && !view.outcome && (
        <p className="jp__last" role="status" key={view.seq}>
          <bdi>{who(last.seat)}</bdi>{' '}
          {last.kind === 'take' ? `${CARD_FA[last.cards![0]!]} برداشت` : last.kind === 'camels' ? `${fa(last.count!)} شتر برداشت`
            : last.kind === 'exchange' ? `${last.cards!.map((c) => CARD_FA[c]).join('، ')} را با ${last.give!.map((c) => CARD_FA[c]).join('، ')} عوض کرد`
              : `${fa(last.count!)} ${CARD_FA[last.good!]} فروخت (+${fa(last.earned!)})`}
        </p>
      )}

      {view.roundResults.length > 0 && (
        <ul className="jp__results">{view.roundResults.map((r, i) => <li key={i}>دست {fa(i + 1)}: {r.winner === null ? 'مساوی' : <><bdi>{who(r.winner)}</bdi> برد</>} ({fa(r.rupees[me]!)} – {fa(r.rupees[opp]!)}{r.camelBonus !== null ? `، شترها: ${who(r.camelBonus)}` : ''})</li>)}</ul>
      )}

      {view.hand && !view.outcome && (
        <section className="jp__me" aria-label="دست شما">
          <div className="jp__hand">
            {hand.map((g, i) => (
              <button key={`${g}-${i}`} type="button" className={['jp-pick', hd.includes(i) ? 'jp-pick--on' : '', hint?.type === 'sell' && hint.good === g && !hd.includes(i) ? 'jp-hint' : ''].join(' ')}
                disabled={!myTurn || busy} aria-pressed={hd.includes(i)} onClick={() => setHd(hd.includes(i) ? hd.filter((x) => x !== i) : [...hd, i])}><GoodCard c={g} /></button>
            ))}
            {!hand.length && <span className="jp__empty">دستتان خالی است</span>}
          </div>
          <div className="jp__herd">
            <GoodCard c="camel" size="sm" /> گلهٔ شما: <b>{fa(view.herds[me]!)}</b>
            {myTurn && mk.length >= 2 && view.herds[me]! > 0 && (
              <span className="jp__camgive">شتر برای معاوضه:
                <button type="button" onClick={() => setCam(Math.max(0, cam - 1))} disabled={!cam}>−</button><b>{fa(cam)}</b>
                <button type="button" onClick={() => setCam(Math.min(view.herds[me]!, cam + 1))} disabled={cam >= view.herds[me]!}>+</button>
              </span>
            )}
            <span className="jp__earn">درآمد: <b>{fa(earned(me))}</b></span>
          </div>
          {myTurn && (
            <div className="jp__actions">
              {action && <Button size="sm" disabled={busy} className={hint && hint.type === action.a.type ? 'jp-hint' : ''} onClick={() => onAction(action.a)}>{action.label}</Button>}
              {canCamels && <Button size="sm" variant="secondary" disabled={busy || mk.length > 0 || hd.length > 0} onClick={() => onAction({ type: 'camels' })}>همهٔ شترها ({fa(camelsInMarket)})</Button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
