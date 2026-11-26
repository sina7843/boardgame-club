// کاروان renderer: a caravanserai market. Goods token stacks along the top, the five market cards on a carpet, the
// rival's stall (cards in hand, camels, earnings) and your hand with your herd. Select market and/or hand cards and
// the action bar offers what the selection means: take, exchange or sell; camels have their own button.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, usePieceIds, useTermsLang, type GameRendererProps, type Term } from '@bg/ui';
import coinsArt from './art/coins.webp';
import deckBack from './art/gc/jaipur-back.png';
import { terms } from './terms.ts';
import { GOODS, PRECIOUS, type Card, type Good, type JaipurView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const CARD_T: Record<Card, Term> = { diamond: terms.diamond, gold: terms.gold, silver: terms.silver, cloth: terms.cloth, spice: terms.spice, leather: terms.leather, camel: terms.camel };
const cardFa = (c: Card) => tx(CARD_T[c]);

// Card pictures and goods coins are the BGA Jaipur client art (see DECISIONS.md).
const GC = import.meta.glob<string>('./art/gc/jaipur-*.png', { eager: true, import: 'default' });
const gc = (n: string) => GC[`./art/gc/jaipur-${n}.png`]!;
const ART: Record<Card, string> = { diamond: gc('diamonds'), gold: gc('gold'), silver: gc('silver'), cloth: gc('cloth'), spice: gc('spice'), leather: gc('leather'), camel: gc('camel') };
/** tokens.webp: 24 coins in a row; the printed coin for each good and value. */
const COIN_AT: Record<Good, Record<number, number>> = {
  leather: { 1: 1, 2: 2, 3: 3, 4: 4 }, spice: { 1: 5, 2: 6, 3: 7, 5: 8 }, cloth: { 1: 9, 2: 10, 3: 11, 5: 12 },
  silver: { 5: 13 }, gold: { 5: 14, 6: 15 }, diamond: { 5: 16, 7: 17 }
};
const coinArt = (g: Good, v: number | undefined) => {
  const at = COIN_AT[g], i = (v !== undefined ? at[v] : undefined) ?? Object.values(at)[0]!;
  return { backgroundImage: `url(${coinsArt})`, backgroundPosition: `${(i / 23) * 100}% 0` };
};

export function GoodCard({ c, size = 'md', flip, flipFrom, exit }: { c: Card; size?: 'sm' | 'md'; flip?: string; flipFrom?: string; exit?: string }) {
  useTermsLang();
  return (
    <span className={['jp-card', `jp-card--${size}`, `jp-c--${c}`].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={exit} aria-label={cardFa(c)}>
      <img src={ART[c]} alt="" draggable={false} />
      {size === 'md' && <span className="jp-card__n">{cardFa(c)}</span>}
    </span>
  );
}

const HAND = 7;
const without = <T,>(xs: T[], out: T[]) => { const r = xs.slice(); for (const x of out) { const i = r.indexOf(x); if (i >= 0) r.splice(i, 1); } return r; };
const sorted = (h: Good[]) => h.slice().sort((x, y) => GOODS.indexOf(x) - GOODS.indexOf(y));

/** The own move during the undo window, applied like the server does except the hidden refill from the deck and the tokens. */
function preview(v: JaipurView, q: Record<string, unknown> | null | undefined, me: number): JaipurView {
  if (!q || !v.hand) return v;
  const herds = v.herds.slice();
  if (q.type === 'take') return { ...v, market: without(v.market, [q.good as Good]), hand: sorted([...v.hand, q.good as Good]) };
  if (q.type === 'camels') { herds[me] = herds[me]! + v.market.filter((c) => c === 'camel').length; return { ...v, market: v.market.filter((c) => c !== 'camel'), herds }; }
  if (q.type === 'exchange') {
    const take = q.take as Good[], give = q.give as Card[];
    herds[me] = herds[me]! - give.filter((c) => c === 'camel').length;
    return { ...v, herds, market: [...without(v.market, take), ...give], hand: sorted([...without(v.hand, give.filter((c) => c !== 'camel') as Good[]), ...take]) };
  }
  if (q.type === 'sell') return { ...v, hand: without(v.hand, Array<Good>(q.count as number).fill(q.good as Good)) };
  return v;
}

type Mode = 'take' | 'camels' | 'exchange' | 'sell';
const MODES: [Mode, Term][] = [['take', terms.takeOne], ['camels', terms.camels], ['exchange', terms.exchange], ['sell', terms.sell]];

export default function JaipurRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<JaipurView>) {
  useTermsLang(); // re-render when the terms language changes
  const me = mySeat ?? 0;
  // Undo-window preview: taken cards are already in the hand, camels in the herd, sold cards gone; undo returns them.
  const view = useMemo(() => preview(real, queued, me), [real, queued, me]);
  const opp = 1 - me;
  const myTurn = legalActions.some((a) => a.type !== 'resign');
  const canCamels = legalActions.some((a) => a.type === 'camels');
  const [mk, setMk] = useState<number[]>([]);
  const [hd, setHd] = useState<number[]>([]);
  const [cam, setCam] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => { setMk([]); setHd([]); setCam(0); setMode(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; good?: Good; count?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const hand = view.hand ?? [];
  const takeG = mk.map((i) => view.market[i]!).filter((c) => c !== 'camel') as Good[];
  const give = hd.map((i) => hand[i]!);
  const sellGood = give.length && !mk.length && !cam && give.every((g) => g === give[0]) ? give[0]! : null;
  const action = (() => {
    if (!myTurn) return null;
    if (mk.length === 1 && !hd.length && !cam && takeG.length === 1) return hand.length < 7 ? { label: `${tx(terms.takeN)} ${cardFa(takeG[0]!)}`, a: { type: 'take', good: takeG[0] } } : null;
    if (mk.length >= 2 && takeG.length === mk.length && give.length + cam === mk.length && !give.some((g) => takeG.includes(g)) && hand.length + cam <= 7)
      return { label: `${tx(terms.exchangeEz)} ${fa(mk.length)} ${tx(terms.card)}`, a: { type: 'exchange', take: takeG, give: [...give, ...Array<Card>(cam).fill('camel')] } };
    if (sellGood && (!PRECIOUS.has(sellGood) || give.length >= 2)) return { label: `${tx(terms.sell)} ${fa(give.length)} ${cardFa(sellGood)}`, a: { type: 'sell', good: sellGood, count: give.length } };
    return null;
  })();
  // Action row (reference §1): a mode chip, a short summary and one «تأیید». The chip follows the selection unless picked.
  const shownMode: Mode | null = mode ?? (action?.a.type as Mode | undefined) ?? null;
  const confirm = mode === 'camels' ? (canCamels ? { type: 'camels' } : null) : action && (!mode || action.a.type === mode) ? action.a : null;
  const summary = mode === 'camels' ? `همهٔ ${tx(terms.marketCamels)} (${fa(view.market.filter((c) => c === 'camel').length)})`
    : confirm?.type === 'exchange' ? `${takeG.map((g) => cardFa(g)).join(' و ')} ← ${[...give.map((g) => cardFa(g)), ...Array<string>(cam).fill(cardFa('camel'))].join(' و ')}`
      : action?.label ?? '';
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: `${tx(terms.card)} انتخاب کنید: ${tx(terms.takeN)}، ${tx(terms.exchange)} یا ${tx(terms.sell)}` }
      : { tone: 'wait' as const, text: `نوبت ${view.current === null ? '' : who(view.current)}` };
  const camelsInMarket = view.market.filter((c) => c === 'camel').length;
  const earned = (k: number) => view.goods[k]!.reduce((a, b) => a + b, 0) + (Array.isArray(view.bonuses[k]) ? (view.bonuses[k] as number[]).reduce((a, b) => a + b, 0) : 0);
  const last = view.last;
  const framed = useInFrame() !== null; // the shell draws seats, scores, rounds, whose-turn and the events log
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  // Where a new market card comes from: an exchange brings it from the mover (my camels from my herd), else the deck.
  const mineMove = !!queued || last?.seat === me;
  const arriveFrom = (c: Card) => (!queued && last?.kind !== 'exchange' ? 'deck' : mineMove ? (c === 'camel' ? 'herd-me' : 'hand-me') : `seat-${opp}`);
  // One id per physical card across hand and market, so a taken card flies from its market slot into the hand and an
  // exchanged one back; market cards that leave go to whoever moves next (camels to the herd), sold cards to the tokens.
  const ids = usePieceIds([...Array.from({ length: HAND }, (_, i) => hand[i] ?? null), ...view.market]);
  const leaveTo = (c: Card) => (view.current !== me ? `seat-${opp}` : c === 'camel' ? 'herd-me' : 'hand-me');

  return (
    <div className="jp" ref={root} data-seq={view.seq}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>هر نوبت فقط یک <T t={terms.action} />: یک <T t={terms.good} /> <T t={terms.takeN} />، همهٔ <T t={terms.camels} />، <T t={terms.exchangeEz} /> دست‌کم دو <T t={terms.card} />، یا <T t={terms.sell} /> یک نوع <T t={terms.good} />. <T t={terms.hand} /> بیشتر از هفت <T t={terms.card} /> نمی‌شود؛ <T t={terms.gold} />، <T t={terms.silver} /> و <T t={terms.diamond} /> را دست‌کم دوتایی می‌فروشید.</p>
        </RailSlot>
      )}
      {!framed && <p className="jp__round"><T t={terms.round} /> {fa(view.round)}{view.best3 ? ' از ۳' : ''}، <T t={terms.seals} />: <bdi>{who(me)}</bdi> {'★'.repeat(view.seals[me]!) || '—'} / <bdi>{who(opp)}</bdi> {'★'.repeat(view.seals[opp]!) || '—'}</p>}

      <section className="jp__tokens" data-flip-anchor="tokens" aria-label={tx(terms.tokensGood)}>
        {GOODS.map((g) => (
          <span key={g} className={`jp-stack jp-c--${g} ${view.tokens[g].length ? '' : 'jp-stack--out'}`} aria-label={`${cardFa(g)}: ${fa(view.tokens[g].length)} ${tx(terms.token)}`}>
            <i className="jp-coin" style={coinArt(g, view.tokens[g][0])} aria-hidden="true" />
            <small className="bg-pop" key={view.tokens[g].length}>{fa(view.tokens[g].length)}</small>
          </span>
        ))}
        {/* The three bonus stacks (3, 4 and 5 cards sold) with their printed tokens (QA round 3). */}
        {([3, 4, 5] as const).map((b, i) => (
          <span key={b} className={['jp-stack', i === 0 ? 'jp-stack--first-bonus' : '', view.bonusLeft[b] ? '' : 'jp-stack--out'].join(' ')} aria-label={`${tx(terms.bonus)} ${fa(b)} ${tx(terms.card)}: ${fa(view.bonusLeft[b])} ${tx(terms.token)}`}>
            <img className="jp-coin" src={gc(`bonus-${b}`)} alt="" draggable={false} />
            <small className="bg-pop" key={view.bonusLeft[b]}>{fa(view.bonusLeft[b])}</small>
          </span>
        ))}
      </section>

      {(framed ? [] : view.outcome ? [me, opp] : [opp]).map((k) => (
        <section key={k} data-flip-anchor={k === me ? 'hand' : `seat-${k}`} className="jp-stall" aria-label={`غرفهٔ ${who(k)}`}>
          <bdi className="jp-stall__name">{who(k)}</bdi>
          {!view.outcome && <span className="jp-stall__hand">{Array.from({ length: view.handCount[k]! }, (_, i) => <i key={i} />)}</span>}
          <span className="jp-stall__herd"><GoodCard c="camel" size="sm" /> ×<b className="bg-pop" key={view.herds[k]}>{fa(view.herds[k]!)}</b></span>
          <span className="jp-stall__coins bg-pop" key={`${view.goods[k]!.length}-${view.herds[k]}`}>{fa(view.goods[k]!.reduce((a, b) => a + b, 0))} + {Array.isArray(view.bonuses[k]) ? fa((view.bonuses[k] as number[]).reduce((a, b) => a + b, 0)) : `${fa(view.bonuses[k] as number)} ${tx(terms.bonus)}`}</span>
        </section>
      ))}

      {!view.outcome && (
        <section className="jp__market" aria-label={tx(terms.market)}>
          <div className="jp__carpet" data-flip-anchor="market">
            {view.market.map((c, i) => (
              <button key={ids[HAND + i]} type="button" className={['jp-pick', mk.includes(i) ? 'jp-pick--on' : '', hint?.type === 'take' && hint.good === c && !mk.length && view.market.indexOf(c) === i ? 'jp-hint' : ''].join(' ')}
                disabled={!myTurn || busy || c === 'camel'} aria-pressed={mk.includes(i)} onClick={() => setMk(mk.includes(i) ? mk.filter((x) => x !== i) : [...mk, i])}><GoodCard c={c} flip={`c-${ids[HAND + i]}`} flipFrom={arriveFrom(c)} exit={leaveTo(c)} /></button>
            ))}
          </div>
          <span className="jp__deck" data-flip-anchor="deck"><img src={deckBack} alt="" draggable={false} /><T t={terms.deck} />: {fa(view.deckCount)}</span>
        </section>
      )}

      {!framed && last && !view.outcome && (
        <p className="jp__last" role="status" key={view.seq}>
          <bdi>{who(last.seat)}</bdi>{' '}
          {last.kind === 'take' ? `${cardFa(last.cards![0]!)} برداشت` : last.kind === 'camels' ? `${fa(last.count!)} ${tx(terms.camel)} برداشت`
            : last.kind === 'exchange' ? `${last.cards!.map((c) => cardFa(c)).join('، ')} را با ${last.give!.map((c) => cardFa(c)).join('، ')} عوض کرد`
              : `${fa(last.count!)} ${cardFa(last.good!)} فروخت (+${fa(last.earned!)})`}
        </p>
      )}

      {!framed && view.roundResults.length > 0 && (
        <ul className="jp__results">{view.roundResults.map((r, i) => <li key={i}><T t={terms.round} /> {fa(i + 1)}: {r.winner === null ? 'مساوی' : <><bdi>{who(r.winner)}</bdi> برد</>} ({fa(r.rupees[me]!)} – {fa(r.rupees[opp]!)}{r.camelBonus !== null ? `، ${tx(terms.camels)}: ${who(r.camelBonus)}` : ''})</li>)}</ul>
      )}

      {view.hand && !view.outcome && (
        <section className="jp__me" aria-label={`${tx(terms.hand)} شما`}>
          <div className="jp__hand" data-flip-anchor="hand-me" style={{ '--n': hand.length } as CSSProperties}>
            {hand.map((g, i) => (
              <button key={ids[i]} type="button" className={['jp-pick', hd.includes(i) ? 'jp-pick--on' : '', hint?.type === 'sell' && hint.good === g && !hd.includes(i) ? 'jp-hint' : ''].join(' ')}
                disabled={!myTurn || busy} aria-pressed={hd.includes(i)} onClick={() => setHd(hd.includes(i) ? hd.filter((x) => x !== i) : [...hd, i])}><GoodCard c={g} flip={`c-${ids[i]}`} flipFrom="market" exit="tokens" /></button>
            ))}
            {!hand.length && <span className="jp__empty"><T t={terms.handYour} /> خالی است</span>}
          </div>
          <div className="jp__herd" data-flip-anchor="herd-me">
            <GoodCard c="camel" size="sm" /> <T t={terms.herd} /> شما: <b className="bg-pop" key={view.herds[me]}>{fa(view.herds[me]!)}</b>
            {myTurn && mk.length >= 2 && view.herds[me]! > 0 && (
              <span className="jp__camgive"><T t={terms.camel} /> برای معاوضه:
                <button type="button" onClick={() => setCam(Math.max(0, cam - 1))} disabled={!cam}>−</button><b>{fa(cam)}</b>
                <button type="button" onClick={() => setCam(Math.min(view.herds[me]!, cam + 1))} disabled={cam >= view.herds[me]!}>+</button>
              </span>
            )}
            <span className="jp__earn">درآمد: <b className="bg-pop" key={earned(me)}>{fa(earned(me))}</b></span>
          </div>
          {myTurn && (
            <div className="jp__actions" role="group" aria-label={`${tx(terms.action)} این نوبت`}>
              {MODES.map(([m, label]) => (
                <button key={m} type="button" className="jp-mode" aria-pressed={shownMode === m} disabled={busy || (m === 'camels' && !canCamels)}
                  onClick={() => { setMode(mode === m ? null : m); if (m === 'camels') { setMk([]); setHd([]); setCam(0); } }}>
                  {m === 'camels' ? `${tx(label)} (${fa(camelsInMarket)})` : tx(label)}
                </button>
              ))}
              {summary && <span className="jp__summary">{summary}</span>}
              <Button size="sm" disabled={busy || !confirm} className={['jp-confirm', hint && confirm && hint.type === confirm.type ? 'jp-hint' : ''].join(' ')} onClick={() => confirm && onAction(confirm)}>تأیید</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
