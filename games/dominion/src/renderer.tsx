// قلمرو renderer: a royal ledger table. The supply is a grid of card piles (cost seal, name, coloured type band,
// pile count); your hand fans below with the turn's actions/buys/coins. Playing Cellar, Workshop, Remodel or Mine opens
// a small choice tray (pick cards from hand and/or a supply pile) before the play is sent.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARDS, KINGDOM, type CardId, type DomView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');

export function DomCard({ c, size = 'md', count }: { c: CardId; size?: 'sm' | 'md'; count?: number }) {
  const info = CARDS[c];
  const kind = info.attack ? 'attack' : info.reaction ? 'reaction' : info.kind;
  return (
    <span className={`dm-card dm-card--${size} dm-k--${kind}`} aria-label={`${info.name}، قیمت ${fa(info.cost)}${count !== undefined ? `، ${fa(count)} مانده` : ''}`}>
      <b className="dm-card__cost">{fa(info.cost)}</b>
      <span className="dm-card__name">{info.name}</span>
      {size === 'md' && <span className="dm-card__text">{info.kind === 'treasure' ? `${fa(info.coins!)} سکه` : info.kind === 'victory' ? `${fa(info.vp!)} امتیاز` : info.text}</span>}
      {count !== undefined && <i className="dm-card__count">{fa(count)}</i>}
    </span>
  );
}

type Hint = { type: string; index?: number; card?: string } | null;
type Mode = { index: number; card: CardId } | null;

export default function DominionRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<DomView>) {
  const me = mySeat ?? -1;
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
    : militia ? { tone: 'mine' as const, text: `سپاه محلی: ${fa(militia.count)} کارت دور بریزید` }
      : mode ? { tone: 'mine' as const, text: mode.card === 'cellar' ? 'کارت‌هایی را که می‌خواهید دور بریزید انتخاب کنید' : mode.card === 'workshop' ? 'کارتی تا قیمت ۴ از بازار انتخاب کنید' : 'کارتی از دست برای نابودی و کارتی از بازار انتخاب کنید' }
        : myTurn && view.militia.some((n) => n > 0) ? { tone: 'wait' as const, text: 'دیگران کارت دور می‌ریزند…' }
          : myTurn ? { tone: 'mine' as const, text: view.phase === 'action' && playable.size ? 'کارت کنش بازی کنید یا گنج‌ها را رو کنید' : 'خرید کنید یا نوبت را تمام کنید' }
            : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const piles: CardId[][] = [['copper', 'silver', 'gold', 'estate', 'duchy', 'province'], KINGDOM];

  return (
    <div className="dm" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="dm__players" aria-label="بازیکنان">
        {view.others.map((o, k) => (
          <li key={k} className={['dm-player', k === view.current && !view.outcome ? 'dm-player--now' : '', k === me ? 'dm-player--me' : ''].join(' ')}>
            <bdi className="dm-player__name">{who(k)}</bdi>
            <span>دسته {fa(o.deck)}</span><span>دست {fa(o.hand)}</span><span>دورریز {fa(o.discard)}</span>
            {o.top && <span className="dm-player__top">{CARDS[o.top].name}</span>}
            {view.vp && <b className="dm-player__vp">{fa(view.vp[k]!)} امتیاز</b>}
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
                <button key={c} type="button" disabled={busy || !can} aria-pressed={gain === c}
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
        <div className="dm__play" aria-label="کارت‌های بازی‌شده">{view.inPlay.map((c, i) => <DomCard key={i} c={c} size="sm" />)}</div>
      )}

      {view.hand && !view.outcome && (
        <section className="dm__me" aria-label="دست شما">
          {myTurn && <p className="dm__tally"><span>کنش {fa(view.actions)}</span><span>خرید {fa(view.buys)}</span><span className="dm-coins" key={view.coins}>{fa(view.coins)} سکه</span></p>}
          <div className="dm__hand">
            {hand.map((c, i) => {
              const sel = picked.includes(i) || mode?.index === i;
              const can = militia || (mode ? i !== mode.index : playable.has(i));
              return (
                <button key={`${i}-${c}`} type="button" disabled={busy || !can} aria-pressed={sel} onClick={() => clickHand(i)}
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

