// قلمرو renderer: a royal ledger table. The supply is a grid of card piles (cost seal, name, coloured type band,
// pile count); your hand fans below with the turn's actions/buys/coins. Playing Cellar, Workshop, Remodel or Mine opens
// a small choice tray (pick cards from hand and/or a supply pile) before the play is sent.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, type GameRendererProps } from '@bg/ui';
import { CARDS, KINGDOM, type CardId, type DomView } from './rules.ts';

// Art is cut from a generated sprite sheet (see DECISIONS.md).
import copperArt from './art/copper.webp';
import silverArt from './art/silver.webp';
import goldArt from './art/gold.webp';
import estateArt from './art/estate.webp';
import duchyArt from './art/duchy.webp';
import provinceArt from './art/province.webp';
import cellarArt from './art/cellar.webp';
import moatArt from './art/moat.webp';
import merchantArt from './art/merchant.webp';
import villageArt from './art/village.webp';
import workshopArt from './art/workshop.webp';
import militiaArt from './art/militia.webp';
import remodelArt from './art/remodel.webp';
import smithyArt from './art/smithy.webp';
import marketArt from './art/market.webp';
import mineArt from './art/mine.webp';
import cardBack from './art/card-back.webp';
import coin from './art/coin.webp';
import vp from './art/vp.webp';

const fa = (n: number) => n.toLocaleString('fa-IR');

const ART: Record<CardId, string> = { copper: copperArt, silver: silverArt, gold: goldArt, estate: estateArt, duchy: duchyArt, province: provinceArt, cellar: cellarArt, moat: moatArt, merchant: merchantArt, village: villageArt, workshop: workshopArt, militia: militiaArt, remodel: remodelArt, smithy: smithyArt, market: marketArt, mine: mineArt };

export function DomCard({ c, size = 'md', count }: { c: CardId; size?: 'sm' | 'md'; count?: number }) {
  const info = CARDS[c];
  const kind = info.attack ? 'attack' : info.reaction ? 'reaction' : info.kind;
  return (
    <span className={`dm-card dm-card--${size} dm-k--${kind}`} aria-label={`${info.name}، قیمت ${fa(info.cost)}${count !== undefined ? `، ${fa(count)} مانده` : ''}`}>
      <b className="dm-card__cost">{fa(info.cost)}</b>
      <img className="dm-card__art" src={ART[c]} alt="" draggable={false} />
      <span className="dm-card__name">{info.name}</span>
      {size === 'md' && <span className="dm-card__text">{info.kind === 'treasure' ? `${fa(info.coins!)} سکه` : info.kind === 'victory' ? `${fa(info.vp!)} امتیاز` : info.text}</span>}
      {count !== undefined && <i key={count} className="dm-card__count bg-pop">{fa(count)}</i>}
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
    : militia ? { tone: 'mine' as const, text: `سپاه محلی: ${fa(militia.count)} کارت دور بریزید` }
      : mode ? { tone: 'mine' as const, text: mode.card === 'cellar' ? 'کارت‌هایی را که می‌خواهید دور بریزید انتخاب کنید' : mode.card === 'workshop' ? 'کارتی تا قیمت ۴ از بازار انتخاب کنید' : 'کارتی از دست برای نابودی و کارتی از بازار انتخاب کنید' }
        : myTurn && view.militia.some((n) => n > 0) ? { tone: 'wait' as const, text: 'دیگران کارت دور می‌ریزند…' }
          : myTurn ? { tone: 'mine' as const, text: view.phase === 'action' && playable.size ? 'کارت کنش بازی کنید یا گنج‌ها را رو کنید' : 'خرید کنید یا نوبت را تمام کنید' }
            : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const piles: CardId[][] = [['copper', 'silver', 'gold', 'estate', 'duchy', 'province'], KINGDOM];

  return (
    <div className="dm" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="dm__players" aria-label="بازیکنان">
        {view.others.map((o, k) => (
          <li key={k} data-flip-anchor={`seat-${k}`} className={['dm-player', k === view.current && !view.outcome ? 'dm-player--now' : '', k === me ? 'dm-player--me' : ''].join(' ')}>
            <bdi className="dm-player__name">{who(k)}</bdi>
            <span><img className="dm-ico dm-ico--back" src={cardBack} alt="" draggable={false} />دسته <b key={o.deck} className="bg-pop">{fa(o.deck)}</b></span><span>دست <b key={o.hand} className="bg-pop">{fa(o.hand)}</b></span><span><img className="dm-ico dm-ico--back" src={cardBack} alt="" draggable={false} />دورریز <b key={o.discard} className="bg-pop">{fa(o.discard)}</b></span>
            {o.top && (view.last?.kind === 'buy' && view.last.seat === k && view.last.card === o.top
              ? <span className="dm-player__top" data-flip={`gain-${k}-${o.discard}`} data-flip-from={`pile-${o.top}`}>{CARDS[o.top].name}</span>
              : <span className="dm-player__top">{CARDS[o.top].name}</span>)}
            {view.vp && <b key={view.vp[k]} className="dm-player__vp bg-pop"><img className="dm-ico" src={vp} alt="" draggable={false} />{fa(view.vp[k]!)} امتیاز</b>}
          </li>
        ))}
      </ul>

      <section className="dm__supply" aria-label="بازار">
        {piles.map((row, r) => (
          <div key={r} className={`dm__row dm__row--${r ? 'kingdom' : 'base'}`}>
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
      </section>

      {view.inPlay.length > 0 && (
        <div className="dm__play" aria-label="کارت‌های بازی‌شده">{view.inPlay.map((c, i) => {
          const mine = view.current === me;
          const id = flipId(mine ? `me${gen(me)}-` : `p${view.current}t${gen(view.current)}-`, c);
          return <span key={i} className="dm__play-card" data-flip={id} data-flip-from={mine ? undefined : `seat-${view.current}`} data-flip-exit={`seat-${view.current}`}><DomCard c={c} size="sm" /></span>;
        })}</div>
      )}

      {view.hand && !view.outcome && (
        <section className="dm__me" aria-label="دست شما">
          {myTurn && <p className="dm__tally"><span>کنش {fa(view.actions)}</span><span>خرید {fa(view.buys)}</span><span className="dm-coins bg-pop" key={view.coins}><img className="dm-ico" src={coin} alt="" draggable={false} />{fa(view.coins)} سکه</span></p>}
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
            {!hand.length && <small>دستتان خالی است</small>}
          </div>
          <div className="dm__bar">
            {militia && <Button size="sm" disabled={busy || picked.length !== militia.count} onClick={() => onAction({ type: 'militiaDiscard', discard: picked })}>دور ریختن {fa(picked.length)} از {fa(militia.count)}</Button>}
            {mode && <>
              <Button size="sm" disabled={busy || !ready} onClick={send}>بازی {CARDS[mode.card].name}</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setMode(null); setPicked([]); setGain(null); }}>انصراف</Button>
            </>}
            {!mode && !militia && canTreasures && <Button size="sm" disabled={busy} className={hint?.type === 'treasures' ? 'dm-hint' : ''} onClick={() => onAction({ type: 'treasures' })}>رو کردن گنج‌ها</Button>}
            {!mode && !militia && canEnd && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'endTurn' ? 'dm-hint' : ''} onClick={() => onAction({ type: 'endTurn' })}>پایان نوبت</Button>}
          </div>
        </section>
      )}
    </div>
  );
}

