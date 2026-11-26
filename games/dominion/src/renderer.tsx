// قلمرو renderer: a royal ledger table. The supply is a grid of card piles (cost seal, name, coloured type band,
// pile count); your hand fans below with the turn's actions/buys/coins. Playing Cellar, Workshop, Remodel or Mine opens
// a small choice tray (pick cards from hand and/or a supply pile) before the play is sent.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, useTermsLang, type GameRendererProps, DockSlot } from '@bg/ui';
import { CARD_EN, terms } from './terms.ts';
import { CARDS, KINGDOM, type CardId, type DomView } from './rules.ts';

// Card art: design/games/group-d/art/dominion (full card faces, text is part of the image).
import copperArt from './art/dominion-copper.png';
import silverArt from './art/dominion-silver.png';
import goldArt from './art/dominion-gold.png';
import estateArt from './art/dominion-estate.png';
import duchyArt from './art/dominion-duchy.png';
import provinceArt from './art/dominion-province.png';
import cellarArt from './art/dominion-cellar.png';
import moatArt from './art/dominion-moat.png';
import merchantArt from './art/dominion-merchant.png';
import villageArt from './art/dominion-village.png';
import workshopArt from './art/dominion-workshop.png';
import militiaArt from './art/dominion-militia.png';
import remodelArt from './art/dominion-remodel.png';
import smithyArt from './art/dominion-smithy.png';
import marketArt from './art/dominion-market.png';
import mineArt from './art/dominion-mine.png';
import cardBack from './art/dominion-back.png';
import coin from './art/dominion-coin.png';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const cardName = (c: CardId) => tx({ fa: CARDS[c].name, bg: CARD_EN[c]! });

const ART: Record<CardId, string> = { copper: copperArt, silver: silverArt, gold: goldArt, estate: estateArt, duchy: duchyArt, province: provinceArt, cellar: cellarArt, moat: moatArt, merchant: merchantArt, village: villageArt, workshop: workshopArt, militia: militiaArt, remodel: remodelArt, smithy: smithyArt, market: marketArt, mine: mineArt };

export function DomCard({ c, size = 'md', count }: { c: CardId; size?: 'sm' | 'md'; count?: number }) {
  useTermsLang();
  const info = CARDS[c];
  return (
    <span className={`dm-p dm-p--${size}`} aria-label={`${cardName(c)}، ${tx(terms.cost)} ${fa(info.cost)}${count !== undefined ? `، ${fa(count)} مانده` : ''}`}>
      <img src={ART[c]} alt="" draggable={false} />
      <span className="visually-hidden">{cardName(c)}</span>
      {count !== undefined && <b key={count} className="bg-pop">{fa(count)}</b>}
    </span>
  );
}

type Hint = { type: string; index?: number; card?: string } | null;
type Mode = { index: number; card: CardId } | null;

/** The own move while it waits in the undo window, applied with what the client already knows: a played card (or all
 *  treasures) moves to the play area, a bought card leaves its pile for the discard, Militia discards leave the hand.
 *  What a card then does (draws, coins, gains) only comes from the server. */
function preview(v: DomView, q: Record<string, unknown> | null | undefined, me: number): DomView {
  const hand = v.hand;
  if (!q || !hand || me < 0) return v;
  if (q.type === 'play' && typeof q.index === 'number' && hand[q.index]) return { ...v, hand: hand.filter((_, i) => i !== q.index), inPlay: [...v.inPlay, hand[q.index]!] };
  if (q.type === 'treasures') return { ...v, hand: hand.filter((c) => CARDS[c].kind !== 'treasure'), inPlay: [...v.inPlay, ...hand.filter((c) => CARDS[c].kind === 'treasure')] };
  if (q.type === 'buy') {
    const c = q.card as CardId;
    return { ...v, supply: { ...v.supply, [c]: v.supply[c] - 1 }, coins: v.coins - CARDS[c].cost, buys: v.buys - 1, last: { seat: me, kind: 'buy', card: c },
      others: v.others.map((o, k) => (k === me ? { ...o, top: c, discard: o.discard + 1 } : o)) };
  }
  if (q.type === 'militiaDiscard' && Array.isArray(q.discard)) {
    const out = q.discard as number[];
    return { ...v, hand: hand.filter((_, i) => !out.includes(i)), others: v.others.map((o, k) => (k === me ? { ...o, top: hand[out.at(-1)!] ?? o.top, hand: o.hand - out.length, discard: o.discard + out.length } : o)) };
  }
  return v;
}

export default function DominionRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<DomView>) {
  useTermsLang(); // re-render when the terms language changes
  const me = mySeat ?? -1;
  const view = useMemo(() => preview(real, queued, me), [real, queued, me]);
  // Cards glide: supply → discard, deck → hand, hand → play area. Identical copies get ids by type + nth copy; the play area
  // continues the owner's hand numbering so a played copy keeps its id while it crosses zones.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${queued ? JSON.stringify(queued) : ''}`);
  // Ids carry the owner's turn count, so at cleanup the old hand and play area leave for the discard and the new hand is dealt.
  const gen = (s: number) => view.turns[s] ?? 0;
  const nth = new Map<string, number>();
  const flipId = (pre: string, c: CardId) => { const n = nth.get(pre + c) ?? 0; nth.set(pre + c, n + 1); return `${pre}${c}-${n}`; };
  const hint = expected as unknown as Hint;
  const playable = new Set(legalActions.filter((a) => a.type === 'play').map((a) => a.index as number));
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.card as CardId));
  const canTreasures = legalActions.some((a) => a.type === 'treasures');
  const canEnd = legalActions.some((a) => a.type === 'endTurn');
  const militia = legalActions.find((a) => a.type === 'militiaDiscard') as { count: number } | undefined;
  const [mode, setMode] = useState<Mode>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [gain, setGain] = useState<CardId | null>(null);
  const handKey = `${view.current}:${view.actions}:${view.coins}:${(view.hand ?? []).join()}`;
  useEffect(() => { setMode(null); setPicked([]); setGain(null); }, [handKey]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const hand = view.hand ?? [];
  const handIds = hand.map((c) => flipId(`me${gen(me)}-`, c));
  const toggle = (i: number) => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]);

  const trashCard = mode && picked[0] !== undefined ? hand[picked[0]] : undefined;
  const gainLimit = !mode ? -1 : mode.card === 'workshop' ? 4 : trashCard ? CARDS[trashCard].cost + (mode.card === 'mine' ? 3 : 2) : -1;
  const canGain = (c: CardId) => view.supply[c] > 0 && CARDS[c].cost <= gainLimit && (mode?.card !== 'mine' || CARDS[c].kind === 'treasure');
  const needsGain = mode && (mode.card === 'workshop' || ((mode.card === 'remodel' || mode.card === 'mine') && hand.length > 1));
  const ready = mode && (!needsGain || (gain && canGain(gain)));
  const clickHand = (i: number) => {
    if (militia) return toggle(i);
    if (mode) {
      if (i === mode.index) return;
      if (mode.card === 'cellar') return toggle(i);
      if (mode.card === 'remodel' || (mode.card === 'mine' && CARDS[hand[i]!].kind === 'treasure')) { setPicked([i]); setGain(null); }
      return;
    }
    if (!playable.has(i)) return;
    const c = hand[i]!;
    if (['cellar', 'workshop', 'remodel', 'mine'].includes(c)) { setMode({ index: i, card: c }); setPicked([]); setGain(null); }
    else onAction({ type: 'play', index: i });
  };
  const send = () => {
    if (!mode) return;
    const a: Record<string, unknown> = { type: 'play', index: mode.index };
    if (mode.card === 'cellar') a.discard = picked;
    if (mode.card === 'remodel' || mode.card === 'mine') { if (picked[0] !== undefined) { a.trash = picked[0]; a.gain = gain; } }
    if (mode.card === 'workshop') a.gain = gain;
    onAction(a as never);
  };

  const myTurn = view.current === me && !view.outcome;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : militia ? { tone: 'mine' as const, text: `${cardName('militia')}: ${fa(militia.count)} ${tx(terms.card)} ${tx(terms.discardImp)}` }
      : mode ? { tone: 'mine' as const, text: mode.card === 'cellar' ? `${tx(terms.cardsYi)} را که می‌خواهید ${tx(terms.discardImp)} انتخاب کنید` : mode.card === 'workshop' ? `${tx(terms.cardOne)} تا ${tx(terms.cost)} ۴ از ${tx(terms.supply)} انتخاب کنید` : `${tx(terms.cardOne)} از ${tx(terms.hand)} برای ${tx(terms.trash)} و ${tx(terms.cardOne)} از ${tx(terms.supply)} انتخاب کنید` }
        : myTurn && view.militia.some((n) => n > 0) ? { tone: 'wait' as const, text: `دیگران ${tx(terms.card)} ${tx(terms.discardPl)}…` }
          : myTurn ? { tone: 'mine' as const, text: view.phase === 'action' && playable.size ? `${tx(terms.card)} ${tx(terms.action)} ${tx(terms.playImp)} یا ${tx(terms.treasures)} را رو کنید` : 'خرید کنید یا نوبت را تمام کنید' }
            : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const piles: CardId[][] = [['copper', 'silver', 'gold', 'estate', 'duchy', 'province'], KINGDOM];
  const framed = useInFrame() !== null;

  return (
    <div className="dm" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>هر نوبت: یک <T t={terms.action} />، رو کردن <T t={terms.treasures} /> و یک <T t={terms.buy} />. بازی با خالی شدن <T t={terms.pileEz} /> <T t={terms.province} /> یا سه <T t={terms.pile} /> از <T t={terms.supply} /> تمام می‌شود.</p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {!framed && <ul className="dm__players" aria-label="بازیکنان">
        {view.others.map((o, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={['dm-player', k === view.current && !view.outcome ? 'dm-player--now' : '', k === me ? 'dm-player--me' : ''].join(' ')}>
            <bdi className="dm-player__name">{who(k)}</bdi>
            <span><img className="dm-ico dm-ico--back" src={cardBack} alt="" draggable={false} /><T t={terms.deck} /> <b key={o.deck} className="bg-pop">{fa(o.deck)}</b></span><span><T t={terms.hand} /> <b key={o.hand} className="bg-pop">{fa(o.hand)}</b></span><span><img className="dm-ico dm-ico--back" src={cardBack} alt="" draggable={false} /><T t={terms.discard} /> <b key={o.discard} className="bg-pop">{fa(o.discard)}</b></span>
            {o.top && (view.last?.kind === 'buy' && view.last.seat === k && view.last.card === o.top
              ? <span className="dm-player__top" data-flip={`gain-${k}-${o.discard}`} data-flip-from={`pile-${o.top}`}>{cardName(o.top)}</span>
              : <span className="dm-player__top">{cardName(o.top)}</span>)}
            {view.vp && <b key={view.vp[k]} className="dm-player__vp bg-pop">{fa(view.vp[k]!)} امتیاز</b>}
          </li>
        ))}
      </ul>}

      <div className="dm__top">
      <section className="dm__supply" aria-label={tx(terms.supply)}>
        <div className="dm-sup">
        {piles.map((row, r) => (
          <div key={r} className={r ? 'dm-king' : 'dm-base'}>
            {row.map((c) => {
              const forGain = mode && needsGain && canGain(c);
              const can = forGain || (!mode && !militia && buyable.has(c));
              return (
                <button key={c} type="button" data-flip-anchor={`pile-${c}`} disabled={busy || !can} aria-pressed={gain === c}
                  className={['dm-pile', can ? 'dm-pile--can' : '', gain === c ? 'dm-pile--on' : '', view.supply[c] === 0 ? 'dm-pile--empty' : '', hint?.type === 'buy' && hint.card === c ? 'dm-hint' : ''].join(' ')}
                  onClick={() => (mode ? setGain(c) : onAction({ type: 'buy', card: c }))}>
                  <DomCard c={c} count={view.supply[c]} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      </section>
      {/* Reference: opponents' deck / hand / discard panels beside the supply (the seat strip only shows names and clocks). */}
      {framed && view.others.length > 1 && (
        <ul className="dm__opps" aria-label="حریف‌ها">
          {view.others.map((o, k) => k === me ? null : (
            <li key={k} data-flip-anchor={`seat-${k}`} className={['dm-opp', k === view.current && !view.outcome ? 'dm-opp--now' : ''].join(' ')}>
              <bdi className="dm-player__name">{who(k)}</bdi>
              <span><img className="dm-ico dm-ico--back" src={cardBack} alt="" draggable={false} />{fa(o.deck)} <T t={terms.deck} /></span>
              <span>{fa(o.hand)} <T t={terms.hand} /></span>
              <span>{o.top ? <img className="dm-ico dm-ico--back" src={ART[o.top]} alt={cardName(o.top)} draggable={false} /> : null}{fa(o.discard)} <T t={terms.discarded} /></span>
            </li>
          ))}
        </ul>
      )}
      </div>

      {(framed || view.inPlay.length > 0) && (
        <div className={view.inPlay.length ? 'dm__play' : 'dm__play dm__play--empty'} aria-label={`${tx(terms.cardsEz)} بازی‌شده`}>{framed && <small className="dm__play-label"><T t={terms.inPlay} /></small>}{!view.inPlay.length && <small>هنوز <T t={terms.cardOne} /> بازی نشده</small>}{view.inPlay.map((c, i) => {
          const mine = view.current === me;
          const id = flipId(mine ? `me${gen(me)}-` : `p${view.current}t${gen(view.current)}-`, c);
          return <span key={i} className="dm__play-card" data-flip={id} data-flip-from={mine ? undefined : `seat-${view.current}`} data-flip-exit={`seat-${view.current}`}><DomCard c={c} size="sm" /></span>;
        })}</div>
      )}

      {view.hand && !view.outcome && (
        <section className="dm__me" aria-label={`${tx(terms.hand)} شما`}>
          {(myTurn || framed) && (
            <div className="dm__row">
              <p className="dm__tally"><span><T t={terms.actions} /> {fa(view.actions)}</span><span><T t={terms.buys} /> {fa(view.buys)}</span><span className="dm-coins bg-pop" key={view.coins}><img className="dm-ico" src={coin} alt="" draggable={false} />{fa(view.coins)} <T t={terms.coins} /></span></p>
              {framed && me >= 0 && view.others[me] && (
                <p className="dm__mine" data-flip-anchor={`seat-${me}`}>
                  <span className="dm__pile-mini" aria-label={`${tx(terms.deck)} شما: ${fa(view.others[me]!.deck)} ${tx(terms.card)}`}><img src={cardBack} alt="" draggable={false} /><b>{fa(view.others[me]!.deck)}</b></span>
                  <span className="dm__pile-mini" aria-label={`${tx(terms.discarded)} شما: ${fa(view.others[me]!.discard)} ${tx(terms.card)}`}>{view.others[me]!.top ? <img src={ART[view.others[me]!.top!]} alt="" draggable={false} /> : <i />}<b>{fa(view.others[me]!.discard)}</b></span>
                </p>
              )}
            </div>
          )}
          <div className="dm__hand">
            {hand.map((c, i) => {
              const sel = picked.includes(i) || mode?.index === i;
              const can = militia || (mode ? i !== mode.index : playable.has(i));
              return (
                <button key={`${i}-${c}`} type="button" data-flip={handIds[i]} data-flip-from={`seat-${me}`}
                  data-flip-exit={(mode?.card === 'remodel' || mode?.card === 'mine') && picked[0] === i ? 'drop' : `seat-${me}`} disabled={busy || !can} aria-pressed={sel} onClick={() => clickHand(i)}
                  className={['dm-hand', can && !mode && !militia ? 'dm-hand--can' : '', sel ? 'dm-hand--on' : '', hint?.type === 'play' && hint.index === i ? 'dm-hint' : ''].join(' ')}>
                  <DomCard c={c} />
                </button>
              );
            })}
            {!hand.length && <small><T t={terms.handYour} /> خالی است</small>}
          </div>
          <div className="dm__bar">
            {militia && <Button size="sm" disabled={busy || picked.length !== militia.count} onClick={() => onAction({ type: 'militiaDiscard', discard: picked })}><T t={terms.discardV} /> {fa(picked.length)} از {fa(militia.count)}</Button>}
            {mode && <>
              <Button size="sm" disabled={busy || !ready} onClick={send}><T t={terms.playV} /> {cardName(mode.card)}</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setMode(null); setPicked([]); setGain(null); }}>انصراف</Button>
            </>}
            {!mode && !militia && canTreasures && <DockSlot><Button size="sm" disabled={busy} className={hint?.type === 'treasures' ? 'dm-hint' : ''} onClick={() => onAction({ type: 'treasures' })}>رو کردن <T t={terms.treasures} /></Button></DockSlot>}
            {!mode && !militia && canEnd && <DockSlot><Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'endTurn' ? 'dm-hint' : ''} onClick={() => onAction({ type: 'endTurn' })}><T t={terms.endTurn} /></Button></DockSlot>}
          </div>
        </section>
      )}
    </div>
  );
}

