// لوبیاکاری renderer: a market-garden table. Bean cards are tall seed packets (colour, bean, beanometer); your fields
// are furrowed plots where cards stack; the trade cloth in the middle holds the two face-up cards. The active player
// builds offers (cards to give, beans wanted, partner) and the partner answers in a small offer slip.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePrevious, type GameRendererProps } from '@bg/ui';
import coffee from './art/coffee.webp';
import wax from './art/wax.webp';
import blue from './art/blue.webp';
import chili from './art/chili.webp';
import stink from './art/stink.webp';
import green from './art/green.webp';
import soy from './art/soy.webp';
import blackeye from './art/blackeye.webp';
import red from './art/red.webp';
import garden from './art/garden.webp';
import { BEANS, BEAN_INFO, payout, type Bean, type BeanView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const SEED: Record<Bean, string> = {
  coffee: '#6b4226', wax: '#e9cf5b', blue: '#3f6fb5', chili: '#c8321f', stink: '#8a9a3a',
  green: '#4caf50', soy: '#d9b26a', blackeye: '#f2ede0', red: '#a8202a', garden: '#c77fa8'
};

// Bean art is cut from a generated sprite sheet (see DECISIONS.md).
const ART: Record<Bean, string> = { coffee, wax, blue, chili, stink, green, soy, blackeye, red, garden };

/**
 * Stable ids for an ordered list of cards (a hand is a queue: planted from the front, drawn at the back, traded from
 * anywhere). Consecutive lists are aligned by LCS, preferring to drop earlier cards, so a card keeps its id while it
 * slides and only cards that really left or arrived change.
 */
function useQueueIds(list: readonly string[], prefix: string): string[] {
  const r = useRef<{ list: readonly string[]; ids: string[]; n: number } | null>(null);
  if (!r.current) r.current = { list, ids: list.map((_, i) => `${prefix}${i}`), n: list.length };
  else if (r.current.list.join() !== list.join()) {
    const a = r.current.list, oi = r.current.ids;
    let n = r.current.n;
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(list.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = list.length - 1; j >= 0; j--) dp[i]![j] = a[i] === list[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    const ids = new Array<string>(list.length);
    for (let i = 0, j = 0; j < list.length;) {
      if (i < a.length && dp[i + 1]![j] === dp[i]![j]) i++;
      else if (i < a.length && a[i] === list[j]) ids[j++] = oi[i++]!;
      else ids[j++] = `${prefix}${n++}`;
    }
    r.current = { list, ids, n };
  }
  return r.current.ids;
}

export function BeanCard({ b, size = 'md', count, flip, flipFrom, flipExit }: { b: Bean; size?: 'sm' | 'md'; count?: number; flip?: string; flipFrom?: string; flipExit?: string }) {
  const info = BEAN_INFO[b];
  return (
    <span className={`bn-card bn-card--${size}`} style={{ ['--seed' as string]: SEED[b] }} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={flipExit} aria-label={`لوبیای ${info.name}${count ? `، ${fa(count)} عدد` : ''}`}>
      <span className="bn-card__name">{info.name}</span>
      <img src={ART[b]} className="bn-bean" alt="" aria-hidden="true" draggable={false} />
      {size === 'md' && (
        <span className="bn-card__meter" aria-hidden>
          {info.meter.map((t, i) => <span key={i} className={t === null ? 'is-off' : count !== undefined && count >= t ? 'is-on' : ''}>{t === null ? '·' : fa(t)}</span>)}
        </span>
      )}
      {count !== undefined && <b className="bn-card__count bg-pop" key={count}>{fa(count)}</b>}
    </span>
  );
}

type Hint = { type: string; field?: number; to?: number; faceUp?: number[]; card?: number } | null;

export default function BohnanzaRenderer({ view: served, legalActions: servedLegal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<BeanView>) {
  const me = mySeat ?? -1;
  // Undo window: my plant / harvest shows at once from what I already know (the front hand card, the picked pending
  // card, the field's payout); undo clears `queued` and the card flies back.
  const view = preview(served, me, queued);
  // While my own move is queued or in flight the served legal actions are stale: it is not my turn until the result.
  const legalActions = queued ? [] : servedLegal;
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const plantTo = new Set(legalActions.filter((a) => a.type === 'plant').map((a) => a.field as number));
  const harvestable = new Set(legalActions.filter((a) => a.type === 'harvest').map((a) => a.field as number));
  const pendingTo = legalActions.filter((a) => a.type === 'plantPending') as unknown as { card: number; field: number }[];
  const hint = expected as unknown as Hint;
  const [giveUp, setGiveUp] = useState<number[]>([]);
  const [giveHand, setGiveHand] = useState<number[]>([]);
  const [want, setWant] = useState<Bean[]>([]);
  const [to, setTo] = useState<number | null>(null);
  const [card, setCard] = useState<number | null>(null);
  useEffect(() => { setGiveUp([]); setGiveHand([]); setWant([]); setCard(null); }, [view.seq]);
  const root = useRef<HTMLDivElement>(null);
  const flipKey = `${view.seq}|${queued ? JSON.stringify(queued) : ''}`;
  useFlip(root, flipKey);
  // A card that left my hand / pending row flies to the field that just grew; an undone one flies back from it.
  const myFields = view.fields[me] ?? [];
  const before = usePrevious(flipKey, myFields) ?? myFields;
  const grew = myFields.findIndex((f, i) => f.n > (before[i]?.bean === f.bean ? before[i]!.n : 0));
  const shrank = myFields.findIndex((f, i) => (before[i]?.n ?? 0) > (before[i]?.bean === f.bean ? f.n : 0));
  const handIds = useQueueIds(view.hand ?? [], 'h');
  const faceIds = useQueueIds(view.faceUp, 'u');
  const pendIds = useQueueIds(view.pending[me] ?? [], 'p');
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const others = view.coins.map((_, k) => k).filter((k) => k !== me);
  const target = to !== null && to !== me && to < view.players ? to : others[0] ?? 0;
  const offering = has('offer');
  const toggle = (xs: number[], i: number, set: (v: number[]) => void) => set(xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]);
  const myPending = view.pending[me] ?? [];
  const pickCard = card !== null && myPending[card] ? card : pendingTo[0]?.card ?? 0;

  const mustPlant = !view.outcome && view.current === me && view.phase === 'plant' && view.planted === 0 && !!view.hand?.length;
  const blocked = !queued && ((mustPlant && !plantTo.size) || (myPending.length > 0 && !pendingTo.length));
  const status = view.outcome ? null
    : blocked ? { tone: 'mine' as const, text: 'جایی برای کاشتن نیست: اول یک مزرعه را برداشت کنید' }
    : has('accept') || has('decline') ? { tone: 'mine' as const, text: `${seatName(view.offer!.from)} به شما پیشنهاد داده` }
      : mustPlant ? { tone: 'mine' as const, text: 'کارت اول دستتان را بکارید' }
        : has('flip') ? { tone: 'mine' as const, text: 'کارت دوم را هم بکارید یا دو کارت رو کنید' }
          : offering ? { tone: 'mine' as const, text: 'معامله کنید یا ببخشید، بعد معامله را تمام کنید' }
            : pendingTo.length || myPending.length ? { tone: 'mine' as const, text: 'کارت‌های گرفته‌شده را بکارید' }
              : { tone: 'wait' as const, text: view.phase === 'settle' ? 'دیگران در حال کاشتن…' : view.offer ? `منتظر پاسخ ${seatName(view.offer.to)}` : `نوبت ${seatName(view.current)}` };

  // Face-up cards go to the offer's partner, or (trade over) to the active player's planting row.
  const faceExit = (i: number) => `seat-${view.offer?.faceUp.includes(i) ? view.offer.to : view.current}`;

  const fieldsOf = (s: number, mine: boolean) => (
    <div className={`bn-fields ${mine ? 'bn-fields--mine' : ''}`}>
      {view.fields[s]!.map((f, i) => {
        const canPlant = mine && (plantTo.has(i) || pendingTo.some((x) => x.card === pickCard && x.field === i));
        const plantAction = plantTo.has(i) ? { type: 'plant', field: i } : { type: 'plantPending', card: pickCard, field: i };
        return (
          <div key={i} className={`bn-field ${canPlant ? 'bn-field--open' : ''}`} data-flip-anchor={mine && i === grew ? 'bn-planted' : mine && i === shrank ? 'bn-unplant' : undefined}>
            <small className="bn-field__label">مزرعهٔ {fa(i + 1)}</small>
            {f.bean ? <BeanCard b={f.bean} count={f.n} size={mine ? 'md' : 'sm'} flip={`f-${s}-${i}-${f.bean}`} flipFrom={mine ? undefined : `seat-${s}`} flipExit={`coins-${s}`} /> : <span className={`bn-plot bn-plot--${mine ? 'md' : 'sm'}`}>خالی</span>}
            {mine && (
              <span className="bn-field__acts">
                {canPlant && <Button size="sm" disabled={busy} className={hint && hint.type !== 'offer' && hint.field === i && (hint.type === 'plant' || hint.card === pickCard) ? 'bn-hint' : ''} onClick={() => onAction(plantAction)}>کاشتن اینجا</Button>}
                {harvestable.has(i) && f.bean && <button type="button" className="bn-link" disabled={busy} onClick={() => onAction({ type: 'harvest', field: i })}>برداشت ({fa(payout(f.bean!, f.n))} سکه)</button>}
              </span>
            )}
          </div>
        );
      })}
      {/* The third field is a card you buy: until then its slot on the mat stays locked. */}
      {view.fields[s]!.length < 3 && (
        <div className="bn-field bn-field--locked">
          <small className="bn-field__label">مزرعهٔ ۳</small>
          {mine && has('buyField')
            ? <button type="button" className={`bn-plot bn-plot--${mine ? 'md' : 'sm'} bn-plot--buy`} disabled={busy} onClick={() => onAction({ type: 'buyField' })}><span aria-hidden="true">🔒</span>خرید مزرعهٔ سوم (۳ سکه)</button>
            : <span className={`bn-plot bn-plot--${mine ? 'md' : 'sm'}`}><span aria-hidden="true">🔒</span>{mine ? 'بسته — ۳ سکه' : 'بسته'}</span>}
        </div>
      )}
    </div>
  );

  // The treasury: harvested bean cards turned over as coins, stacked on the mat.
  const treasury = (s: number, lg: boolean) => (
    <span className={`bn-treasury ${lg ? 'bn-treasury--lg' : ''}`} role="img" aria-label={`خزانه: ${fa(view.coins[s]!)} سکه`}>
      <span className="bn-treasury__stack" aria-hidden="true">{Array.from({ length: Math.min(view.coins[s]!, 8) }, (_, i) => <i key={i} />)}</span>
      <span className={`bn-coin ${lg ? 'bn-coin--lg' : ''} bg-pop`} key={view.coins[s]} data-flip-anchor={`coins-${s}`}>{fa(view.coins[s]!)}</span>
      <small>سکه</small>
    </span>
  );

  return (
    <div className="bn" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="bn__rivals" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : others).map((s) => (
          <li key={s} data-flip-anchor={`seat-${s}`} className={['bn-rival', s === view.current && !view.outcome ? 'bn-rival--now' : '', view.outcome?.placements[0]?.seat === s ? 'bn-rival--win' : ''].join(' ')}>
            <div className="bn-rival__head">
              <bdi className="bn-rival__name">{who(s)}</bdi>
              <span className="bn-rival__hand" role="img" aria-label={`${fa(view.handCounts[s]!)} کارت در دست`}><i aria-hidden="true" />{fa(view.handCounts[s]!)} کارت</span>
            </div>
            <div className="bn-mat bn-mat--sm">
              {fieldsOf(s, false)}
              {treasury(s, false)}
            </div>
            {view.pending[s]!.length > 0 && <small className="bn-rival__pending">باید بکارد: {view.pending[s]!.map((b) => BEAN_INFO[b].name).join('، ')}</small>}
          </li>
        ))}
      </ul>

      <section className="bn__market" data-flip-anchor="market" aria-label="میز معامله">
        <span className="bn-deck" data-flip-anchor="deck"><b>{fa(view.deckCount)}</b><small>دسته</small></span>
        <div className="bn__faceup">
          {view.faceUp.length ? view.faceUp.map((b, i) => (
            offering ? (
              <button key={i} type="button" className={`bn-pick ${giveUp.includes(i) ? 'bn-pick--on' : ''} ${hint?.type === 'offer' && hint.faceUp?.includes(i) && !giveUp.includes(i) ? 'bn-hint' : ''}`} aria-pressed={giveUp.includes(i)} onClick={() => toggle(giveUp, i, setGiveUp)}><BeanCard b={b} flip={faceIds[i]} flipFrom="deck" flipExit={faceExit(i)} /></button>
            ) : <span key={i} className="bn-pick"><BeanCard b={b} flip={faceIds[i]} flipFrom="deck" flipExit={faceExit(i)} /></span>
          )) : <small className="bn__cloth">{view.phase === 'plant' ? 'کارت‌ها بعد از کاشتن رو می‌شوند' : 'میز معامله خالی است'}</small>}
        </div>
        {view.last && <small className="bn__last" key={view.seq}><bdi>{who(view.last.seat)}</bdi> {view.last.kind === 'harvest' ? `برداشت کرد: ${view.last.detail.replace(/\d+/g, (d) => fa(Number(d)))}` : view.last.kind === 'trade' ? 'معامله را پذیرفت' : view.last.kind === 'decline' ? 'پیشنهاد را رد کرد' : 'مزرعهٔ سوم خرید'}</small>}
      </section>

      {offering && (
        <section className="bn__offer" aria-label="ساختن پیشنهاد">
          <div className="bn__row"><small>به:</small>{others.map((k) => <button key={k} type="button" className={`bn-chip ${target === k ? 'bn-chip--on' : ''}`} aria-pressed={target === k} onClick={() => setTo(k)}><bdi>{who(k)}</bdi></button>)}</div>
          <div className="bn__row"><small>در عوض می‌خواهم:</small>
            {BEANS.map((b) => <button key={b} type="button" className="bn-chip bn-chip--bean" style={{ ['--seed' as string]: SEED[b] }} onClick={() => setWant([...want, b])}>{BEAN_INFO[b].name}</button>)}
          </div>
          <p className="bn__summary">
            می‌دهید: {giveUp.length + giveHand.length ? [...giveUp.map((i) => view.faceUp[i]), ...giveHand.map((i) => view.hand?.[i])].filter((b) => b !== undefined).map((b) => BEAN_INFO[b].name).join('، ') : 'هیچ'} — می‌خواهید: {want.length ? want.map((b) => BEAN_INFO[b].name).join('، ') : 'هیچ (بخشش)'}
            {want.length > 0 && <button type="button" className="bn-link" onClick={() => setWant([])}>پاک کردن</button>}
          </p>
          <div className="bn__row">
            <Button size="sm" disabled={busy || !(giveUp.length + giveHand.length + want.length)} className={hint?.type === 'offer' && giveUp.length ? 'bn-hint' : ''}
              onClick={() => onAction({ type: 'offer', to: target, faceUp: giveUp, hand: giveHand, want })}>{want.length ? 'پیشنهاد معامله' : 'بخشیدن'}</Button>
            <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'endTrade' ? 'bn-hint' : ''} onClick={() => onAction({ type: 'endTrade' })}>پایان معامله</Button>
          </div>
        </section>
      )}

      {view.offer && (view.offer.to === me || view.offer.from === me) && (
        <section className="bn__slip" aria-label="پیشنهاد">
          <p><bdi>{who(view.offer.from)}</bdi> ← <bdi>{who(view.offer.to)}</bdi></p>
          <div className="bn__row"><small>می‌دهد:</small>{[...view.offer.faceUp.map((i) => view.faceUp[i]!), ...(view.offer.from === me ? view.offer.hand.map((i) => view.hand![i]!) : [])].map((b, i) => <BeanCard key={i} b={b} size="sm" />)}{view.offer.from !== me && view.offer.hand.length > 0 && <small>+ {fa(view.offer.hand.length)} کارت از دست</small>}</div>
          <div className="bn__row"><small>می‌خواهد:</small>{view.offer.want.length ? view.offer.want.map((b, i) => <BeanCard key={i} b={b} size="sm" />) : <small>هیچ (هدیه)</small>}</div>
          {view.offer.to === me && (
            <div className="bn__row">
              <Button size="sm" disabled={busy || !has('accept')} onClick={() => onAction({ type: 'accept' })}>پذیرفتن</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'decline' })}>رد کردن</Button>
            </div>
          )}
        </section>
      )}

      {view.hand && !view.outcome && (
        <section className="bn__me" data-flip-anchor={myPending.length ? undefined : `seat-${me}`} aria-label="مزرعه‌ها و دست شما">
          <div className="bn-mat">
            <div className="bn__me-head"><bdi>{who(me)}</bdi><small>مزرعه‌های شما</small></div>
            {fieldsOf(me, true)}
            {treasury(me, true)}
          </div>
          {myPending.length > 0 && (
            <div className="bn__row bn__pending" data-flip-anchor={`seat-${me}`} role="group" aria-label="باید کاشته شود">
              <small>باید بکارید:</small>
              {myPending.map((b, i) => <button key={i} type="button" className={`bn-pick ${pickCard === i ? 'bn-pick--on' : ''}`} aria-pressed={pickCard === i} onClick={() => setCard(i)}><BeanCard b={b} size="sm" flip={pendIds[i]} flipFrom={shrank >= 0 ? 'bn-unplant' : undefined} flipExit="bn-planted" /></button>)}
            </div>
          )}
          {has('flip') && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'flip' ? 'bn-hint' : ''} onClick={() => onAction({ type: 'flip' })}>رو کردن دو کارت</Button>}
          <div className="bn__hand" data-flip-anchor="hand" aria-label="دست شما (به ترتیب)">
            {view.hand.map((b, i) => {
              const hid = handIds[i]!;
              const exit = view.offer?.from === me && view.offer.hand.includes(i) ? `seat-${view.offer.to}` : 'bn-planted';
              const from = shrank >= 0 ? 'bn-unplant' : 'deck';
              return (
              offering ? (
                <button key={i} type="button" className={`bn-pick ${giveHand.includes(i) ? 'bn-pick--on' : ''}`} aria-pressed={giveHand.includes(i)} onClick={() => toggle(giveHand, i, setGiveHand)}><BeanCard b={b} size="sm" flip={hid} flipFrom={from} flipExit={exit} /></button>
              ) : <span key={i} className={`bn-pick ${i === 0 ? 'bn-pick--first' : ''}`}><BeanCard b={b} size="sm" flip={hid} flipFrom={from} flipExit={exit} /></span>
              );
            })}
            {!view.hand.length && <small>دستتان خالی است</small>}
          </div>
        </section>
      )}
    </div>
  );
}

/** The served view with my queued plant / harvest applied (only information I already hold). */
function preview(v: BeanView, me: number, q: GameRendererProps<BeanView>['queued']): BeanView {
  if (!q || me < 0) return v;
  const fields = v.fields.map((fs) => fs.map((f) => ({ ...f })));
  const f = fields[me]?.[q.field as number];
  if (!f) return v;
  let bean: Bean | undefined;
  let hand = v.hand, pending = v.pending;
  if (q.type === 'plant' && v.hand?.length) { bean = v.hand[0]; hand = v.hand.slice(1); }
  else if (q.type === 'plantPending') {
    bean = v.pending[me]?.[q.card as number];
    pending = v.pending.map((p, s) => (s === me ? p.filter((_, i) => i !== q.card) : p));
  } else if (q.type === 'harvest' && f.bean) {
    const coins = v.coins.map((c, s) => (s === me ? c + payout(f.bean!, f.n) : c));
    fields[me]![q.field as number] = { bean: null, n: 0 };
    return { ...v, fields, coins };
  }
  if (!bean || (f.bean && f.bean !== bean)) return v;
  fields[me]![q.field as number] = { bean, n: f.n + 1 };
  return { ...v, fields, hand, pending };
}
