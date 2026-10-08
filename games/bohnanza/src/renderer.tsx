// لوبیاکاری renderer: a market-garden table. Bean cards are tall seed packets (colour, bean, beanometer); your fields
// are furrowed plots where cards stack; the trade cloth in the middle holds the two face-up cards. The active player
// builds offers (cards to give, beans wanted, partner) and the partner answers in a small offer slip.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { BEANS, BEAN_INFO, payout, type Bean, type BeanView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const SEED: Record<Bean, string> = {
  coffee: '#6b4226', wax: '#e9cf5b', blue: '#3f6fb5', chili: '#c8321f', stink: '#8a9a3a',
  green: '#4caf50', soy: '#d9b26a', blackeye: '#f2ede0', red: '#a8202a', garden: '#c77fa8'
};

export function BeanIcon({ b }: { b: Bean }) {
  return (
    <svg viewBox="0 0 40 28" className="bn-bean" aria-hidden>
      <path d="M6 16C2 8 10 1 19 4c5 2 7 0 11-1 7-1 10 7 6 13-4 7-14 10-22 9C9 24 8 20 6 16Z" fill={SEED[b]} stroke="rgb(0 0 0 / 0.45)" strokeWidth="1.5" />
      <path d="M12 9c3-2 7-2 9 0" stroke="rgb(255 255 255 / 0.55)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {b === 'blackeye' && <ellipse cx="22" cy="15" rx="4" ry="3" fill="#1c1410" />}
    </svg>
  );
}

export function BeanCard({ b, size = 'md', count }: { b: Bean; size?: 'sm' | 'md'; count?: number }) {
  const info = BEAN_INFO[b];
  return (
    <span className={`bn-card bn-card--${size}`} style={{ ['--seed' as string]: SEED[b] }} aria-label={`لوبیای ${info.name}${count ? `، ${fa(count)} عدد` : ''}`}>
      <span className="bn-card__name">{info.name}</span>
      <BeanIcon b={b} />
      {size === 'md' && (
        <span className="bn-card__meter" aria-hidden>
          {info.meter.map((t, i) => <span key={i} className={t === null ? 'is-off' : count !== undefined && count >= t ? 'is-on' : ''}>{t === null ? '·' : fa(t)}</span>)}
        </span>
      )}
      {count !== undefined && <b className="bn-card__count" key={count}>{fa(count)}</b>}
    </span>
  );
}

type Hint = { type: string; field?: number; to?: number; faceUp?: number[]; card?: number } | null;

export default function BohnanzaRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<BeanView>) {
  const me = mySeat ?? -1;
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
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const others = view.coins.map((_, k) => k).filter((k) => k !== me);
  const target = to !== null && to !== me && to < view.players ? to : others[0] ?? 0;
  const offering = has('offer');
  const toggle = (xs: number[], i: number, set: (v: number[]) => void) => set(xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]);
  const myPending = view.pending[me] ?? [];
  const pickCard = card !== null && myPending[card] ? card : pendingTo[0]?.card ?? 0;

  const mustPlant = !view.outcome && view.current === me && view.phase === 'plant' && view.planted === 0 && !!view.hand?.length;
  const blocked = (mustPlant && !plantTo.size) || (myPending.length > 0 && !pendingTo.length);
  const status = view.outcome ? null
    : blocked ? { tone: 'mine' as const, text: 'جایی برای کاشتن نیست: اول یک مزرعه را برداشت کنید' }
    : has('accept') || has('decline') ? { tone: 'mine' as const, text: `${seatName(view.offer!.from)} به شما پیشنهاد داده` }
      : mustPlant ? { tone: 'mine' as const, text: 'کارت اول دستتان را بکارید' }
        : has('flip') ? { tone: 'mine' as const, text: 'کارت دوم را هم بکارید یا دو کارت رو کنید' }
          : offering ? { tone: 'mine' as const, text: 'معامله کنید یا ببخشید، بعد معامله را تمام کنید' }
            : pendingTo.length || myPending.length ? { tone: 'mine' as const, text: 'کارت‌های گرفته‌شده را بکارید' }
              : { tone: 'wait' as const, text: view.phase === 'settle' ? 'دیگران در حال کاشتن…' : view.offer ? `منتظر پاسخ ${seatName(view.offer.to)}` : `نوبت ${seatName(view.current)}` };

  const fieldsOf = (s: number, mine: boolean) => (
    <div className={`bn-fields ${mine ? 'bn-fields--mine' : ''}`}>
      {view.fields[s]!.map((f, i) => {
        const canPlant = mine && (plantTo.has(i) || pendingTo.some((x) => x.card === pickCard && x.field === i));
        const plantAction = plantTo.has(i) ? { type: 'plant', field: i } : { type: 'plantPending', card: pickCard, field: i };
        return (
          <div key={i} className={`bn-field ${canPlant ? 'bn-field--open' : ''}`}>
            {f.bean ? <BeanCard b={f.bean} count={f.n} size={mine ? 'md' : 'sm'} /> : <span className={`bn-plot bn-plot--${mine ? 'md' : 'sm'}`}>خالی</span>}
            {mine && (
              <span className="bn-field__acts">
                {canPlant && <Button size="sm" disabled={busy} className={hint && hint.type !== 'offer' && hint.field === i && (hint.type === 'plant' || hint.card === pickCard) ? 'bn-hint' : ''} onClick={() => onAction(plantAction)}>کاشتن اینجا</Button>}
                {harvestable.has(i) && <button type="button" className="bn-link" disabled={busy} onClick={() => onAction({ type: 'harvest', field: i })}>برداشت ({fa(payout(f.bean!, f.n))} سکه)</button>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bn" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="bn__rivals" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : others).map((s) => (
          <li key={s} className={['bn-rival', s === view.current && !view.outcome ? 'bn-rival--now' : '', view.outcome?.placements[0]?.seat === s ? 'bn-rival--win' : ''].join(' ')}>
            <div className="bn-rival__head">
              <bdi className="bn-rival__name">{who(s)}</bdi>
              <span className="bn-coin" key={view.coins[s]}>{fa(view.coins[s]!)}</span>
              <span className="bn-rival__hand">{fa(view.handCounts[s]!)} کارت</span>
            </div>
            {fieldsOf(s, false)}
            {view.pending[s]!.length > 0 && <small className="bn-rival__pending">باید بکارد: {view.pending[s]!.map((b) => BEAN_INFO[b].name).join('، ')}</small>}
          </li>
        ))}
      </ul>

      <section className="bn__market" aria-label="میز معامله">
        <span className="bn-deck"><b>{fa(view.deckCount)}</b><small>دسته</small></span>
        <div className="bn__faceup">
          {view.faceUp.length ? view.faceUp.map((b, i) => (
            offering ? (
              <button key={i} type="button" className={`bn-pick ${giveUp.includes(i) ? 'bn-pick--on' : ''} ${hint?.type === 'offer' && hint.faceUp?.includes(i) && !giveUp.includes(i) ? 'bn-hint' : ''}`} aria-pressed={giveUp.includes(i)} onClick={() => toggle(giveUp, i, setGiveUp)}><BeanCard b={b} /></button>
            ) : <span key={i} className="bn-pick bn-flip"><BeanCard b={b} /></span>
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
            می‌دهید: {giveUp.length + giveHand.length ? [...giveUp.map((i) => view.faceUp[i]!), ...giveHand.map((i) => view.hand![i]!)].map((b) => BEAN_INFO[b].name).join('، ') : 'هیچ'} — می‌خواهید: {want.length ? want.map((b) => BEAN_INFO[b].name).join('، ') : 'هیچ (بخشش)'}
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
        <section className="bn__me" aria-label="مزرعه‌ها و دست شما">
          <div className="bn__me-head">
            <bdi>{who(me)}</bdi>
            <span className="bn-coin bn-coin--lg" key={view.coins[me]}>{fa(view.coins[me]!)}</span>
            {has('buyField') && <button type="button" className="bn-link" disabled={busy} onClick={() => onAction({ type: 'buyField' })}>خرید مزرعهٔ سوم (۳ سکه)</button>}
          </div>
          {myPending.length > 0 && (
            <div className="bn__row bn__pending" role="group" aria-label="باید کاشته شود">
              <small>باید بکارید:</small>
              {myPending.map((b, i) => <button key={i} type="button" className={`bn-pick ${pickCard === i ? 'bn-pick--on' : ''}`} aria-pressed={pickCard === i} onClick={() => setCard(i)}><BeanCard b={b} size="sm" /></button>)}
            </div>
          )}
          {fieldsOf(me, true)}
          {has('flip') && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'flip' ? 'bn-hint' : ''} onClick={() => onAction({ type: 'flip' })}>رو کردن دو کارت</Button>}
          <div className="bn__hand" aria-label="دست شما (به ترتیب)">
            {view.hand.map((b, i) => (
              offering ? (
                <button key={i} type="button" className={`bn-pick ${giveHand.includes(i) ? 'bn-pick--on' : ''}`} aria-pressed={giveHand.includes(i)} onClick={() => toggle(giveHand, i, setGiveHand)}><BeanCard b={b} size="sm" /></button>
              ) : <span key={i} className={`bn-pick ${i === 0 ? 'bn-pick--first' : ''}`}><BeanCard b={b} size="sm" /></span>
            ))}
            {!view.hand.length && <small>دستتان خالی است</small>}
          </div>
        </section>
      )}
    </div>
  );
}
