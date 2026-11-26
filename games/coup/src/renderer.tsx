// کودتا renderer: a palace intrigue table. Each courtier shows coins and two influence cards (backs until lost), the
// pending claim sits in a gilded banner, and your hand has the action board, the response buttons, the "which card do
// you lose" choice and the Ambassador's exchange.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, T, TurnIndicator, tx, useFlip, useInFrame, usePop, useTermsLang, type GameRendererProps, type Term } from '@bg/ui';
import duke from './art/coup-duke.png';
import assassin from './art/coup-assassin.png';
import captain from './art/coup-captain.png';
import ambassador from './art/coup-ambassador.png';
import contessa from './art/coup-contessa.png';
import cardBack from './art/coup-back.png';
import { terms } from './terms.ts';
import { CLAIM, type Act, type Card as Influence, type CoupView, type Role } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const ACTS: Act[] = ['income', 'foreignAid', 'tax', 'steal', 'exchange', 'assassinate', 'coup'];
const ROLE_T: Record<Role, Term> = { duke: terms.duke, assassin: terms.assassin, captain: terms.captain, ambassador: terms.ambassador, contessa: terms.contessa };
const ACT_T: Record<Act, Term> = { income: terms.income, foreignAid: terms.foreignAid, coup: terms.coup, tax: terms.tax, assassinate: terms.assassinate, steal: terms.steal, exchange: terms.exchange };
const roleFa = (r: Role) => tx(ROLE_T[r]);
const actFa = (a: Act) => tx(ACT_T[a]);
const actNote = (a: Act): string => {
  const c = tx(terms.coin);
  return { income: `+۱ ${c}`, foreignAid: `+۲ ${c}`, coup: `۷ ${c}`, tax: `+۳ ${c}`, assassinate: `۳ ${c}`, steal: `۲ ${c} از حریف`, exchange: `۲ ${tx(terms.card)} از ${tx(terms.deck)}` }[a];
};

// Printed cards from design/games/group-c/art/coup (the whole card, back included).
const ART: Record<Role, string> = { duke, assassin, captain, ambassador, contessa };

function Card({ role, lost, size = 'md', fresh, flip, flipFrom, exit }: { role: Role | null; lost?: boolean; size?: 'sm' | 'md'; fresh?: boolean; flip?: string; flipFrom?: string; exit?: string }) {
  useTermsLang();
  return (
    <span className={['cp-card', `cp-card--${size}`, role ? `cp-card--${role}` : 'cp-card--back', lost ? 'cp-card--lost' : '', fresh ? 'bg-flip-in' : ''].join(' ')} data-flip={flip} data-flip-from={flipFrom} data-flip-exit={flip && exit ? exit : undefined}>
      <img className="cp-card__img" src={role ? ART[role] : cardBack} alt={role ? roleFa(role) : `${tx(terms.card)} ${tx(terms.facedown)}`} draggable={false} />
      {lost && <span className="cp-card__x" aria-hidden="true" />}
    </span>
  );
}

const Thumb = ({ role }: { role: Role }) => <img className="cp-thumb" src={ART[role]} alt="" aria-hidden="true" />;

function Coins({ n }: { n: number }) {
  useTermsLang();
  const pop = usePop(n);
  return <span className="cp-coins" aria-label={`${fa(n)} ${tx(terms.coin)}`}><span className="cp-coin" aria-hidden="true" /><b key={n} className={pop}>{fa(n)}</b></span>;
}

type Queued = { type: string; act?: Act; target?: number; card?: number; roles?: Role[]; role?: Role };

export default function CoupRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CoupView>) {
  useTermsLang(); // re-render when the terms language changes
  // Undo-window preview of my own move, from what I already know: the claim banner, income/coup coins, the card I
  // turn face up, the block I announce and the cards I keep. Undo drops `queued` and everything returns.
  const q = queued as Queued | null | undefined;
  const view = preview(served, q, mySeat);
  const acts = new Map(legalActions.filter((a) => a.type === 'act').map((a) => [a.act as Act, (a.targets as number[] | undefined) ?? null]));
  const canChallenge = legalActions.some((a) => a.type === 'challenge');
  const blocks = legalActions.filter((a) => a.type === 'block').map((a) => a.role as Role);
  const canPass = legalActions.some((a) => a.type === 'pass');
  const loseCards = new Set(legalActions.filter((a) => a.type === 'lose').map((a) => a.card as number));
  const keepHint = legalActions.find((a) => a.type === 'keep') as { options: Role[]; keep: number } | undefined;
  const lastSeq = view.log.at(-1)?.seq ?? 0;
  const [aim, setAim] = useState<Act | null>(null);
  const [keep, setKeep] = useState<number[]>([]);
  useEffect(() => { setAim(null); setKeep([]); }, [lastSeq, view.phase]);
  const hint = expected as unknown as { type: string; act?: Act; target?: number; role?: Role } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const order = mySeat === null ? view.coins.map((_, k) => k) : [...view.coins.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const targets = aim ? acts.get(aim) ?? [] : [];
  const p = view.pending;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${lastSeq}|${q ? JSON.stringify(q) : ''}`);
  const framed = useInFrame() !== null;
  const lastReveal = view.log.at(-1)?.t === 'reveal' ? view.log.at(-1) : null;

  const pick = (a: Act) => {
    const t = acts.get(a);
    if (t && t.length === 1) onAction({ type: 'act', act: a, target: t[0]! });
    else if (t) setAim(aim === a ? null : a);
    else onAction({ type: 'act', act: a });
  };

  const waitingOn = view.phase === 'respond' ? p!.responders : view.phase === 'lose' ? [view.lose!.seat] : view.phase === 'exchange' ? [view.exchange!.seat] : view.current === null ? [] : [view.current];
  const mine = legalActions.some((a) => a.type !== 'resign');
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : mine ? {
      tone: 'mine' as const,
      text: view.phase === 'lose' ? `یک ${tx(terms.influence)} ${tx(terms.loseV)}: ${tx(terms.cardYi)} را که ${tx(terms.revealV)} انتخاب کنید`
        : view.phase === 'exchange' ? `${fa(keepHint?.keep ?? 1)} ${tx(terms.card)} ${tx(terms.keep)}`
          : view.phase === 'respond' ? (p!.stage === 'blockRespond' ? `${tx(terms.block)} را ${tx(terms.allowQ)} یا ${tx(terms.challenge)}؟` : `${tx(terms.allow)}، ${tx(terms.challenge)} یا ${tx(terms.block)}؟`)
            : aim ? `${tx(terms.target)} «${actFa(aim)}» را انتخاب کنید` : `نوبت شماست: یک ${tx(terms.action)} انتخاب کنید`
    }
      : { tone: 'wait' as const, text: `منتظر ${waitingOn.map(who).join('، ')}` };

  const banner = p && view.phase !== 'action' && !view.outcome ? (
    <div className="cp-claim" role="status" key={`${p.actor}-${p.act}-${p.block?.by ?? ''}`}>
      <span className="cp-claim__who"><bdi>{who(p.actor)}</bdi></span>
      {p.claim ? <> <T t={terms.claimEz} /> <b className={`cp-tag cp-tag--${p.claim}`}><Thumb role={p.claim} />{roleFa(p.claim)}</b> — </> : ' '}
      <b>{actFa(p.act)}</b>{p.target !== null && <> روی <bdi>{who(p.target)}</bdi></>}
      {p.block && <span className="cp-claim__block"><bdi>{who(p.block.by)}</bdi> با <T t={terms.claimEz} /> <b className={`cp-tag cp-tag--${p.block.role}`}><Thumb role={p.block.role} />{roleFa(p.block.role)}</b> <T t={terms.blockedIt} /></span>}
    </div>
  ) : null;

  return (
    <div className="cp" ref={root} data-seq={lastSeq} data-phase={view.phase}>
      {framed && (
        <RailSlot>
          <p>هر <T t={terms.claim} /> را می‌شود به <T t={terms.challenge} /> کشید؛ <T t={terms.claimEz} /> دروغ یک <T t={terms.influence} /> هزینه دارد. با ۱۰ سکه <T t={terms.coup} /> اجباری است.</p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <div className="cp-center" aria-label="میز">
          <div className="cp-treasury"><span className="cp-treasury__coin" aria-hidden="true" /><b>{fa(Math.max(0, 50 - view.coins.reduce((a, b) => a + b, 0)))}</b><span><T t={terms.treasuryCoin} /></span></div>
          <div className="cp-deck"><img className="cp-deck__img" src={cardBack} alt="" draggable={false} /><span><T t={terms.court} /><span className="bgv-sep" />{fa(view.deckCount)} <T t={terms.card} /></span></div>
        </div>
      )}
      {banner}
      {framed && aim && targets.length > 0 && (
        <div className="cp-resp" role="group" aria-label={`${tx(terms.target)} ${actFa(aim)}`}>
          {targets.map((s) => <button key={s} type="button" className={['cp-resp__btn', hint?.type === 'act' && hint.target === s ? 'cp-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'act', act: aim, target: s })}><bdi>{who(s)}</bdi></button>)}
        </div>
      )}

      {!framed && <ul className="cp__court" aria-label="درباریان">
        {order.filter((s) => s !== mySeat).map((s) => {
          const c = view.cards[s]!;
          const out = c.hidden === 0;
          const canAim = targets.includes(s) && !busy;
          const body = (
            <>
              <div className="cp-pl__head"><bdi className="cp-pl__name">{who(s)}</bdi><Coins n={view.coins[s]!} />{out && <span className="cp-pl__out">بیرون</span>}</div>
              <div className={['cp-pl__cards', lastReveal?.seat === s ? 'bg-hit' : ''].join(' ')} key={lastReveal?.seat === s ? lastSeq : 'c'}>
                {Array.from({ length: c.hidden }, (_, k) => <Card key={`h${k}`} role={null} size="sm" />)}
                {c.revealed.map((r, k) => <Card key={`r${k}`} role={r} lost size="sm" fresh={lastReveal?.seat === s && k === c.revealed.length - 1} />)}
              </div>
            </>
          );
          return (
            <li key={s} className={['cp-pl', waitingOn.includes(s) && !view.outcome ? 'cp-pl--turn' : '', out ? 'cp-pl--out' : '', p?.target === s && view.phase === 'respond' ? 'cp-pl--target' : ''].join(' ')}>
              {canAim
                ? <button type="button" className={['cp-pl__aim', hint?.type === 'act' && hint.target === s ? 'cp-hint' : ''].join(' ')} onClick={() => onAction({ type: 'act', act: aim!, target: s })} aria-label={`${actFa(aim!)}: ${who(s)}`}>{body}</button>
                : body}
            </li>
          );
        })}
      </ul>}

      {mySeat !== null && view.myCards && (
        <section className="cp__me" aria-label={`${tx(terms.hand)} شما`}>
          <div className="cp-me__head" data-flip-anchor="deck" hidden={framed}><bdi className="cp-pl__name">شما</bdi><Coins n={view.coins[mySeat]!} /><span className="cp-me__deck"><T t={terms.deck} /> <T t={terms.court} />: {fa(view.deckCount)}</span></div>
          {keepHint && q?.type !== 'keep' && (
            <div className="cp-ex" role="group" aria-label={tx(terms.exchange)}>
              <div className="cp-ex__cards">
                {keepHint.options.map((r, i) => (
                  <button key={i} type="button" aria-pressed={keep.includes(i)} className={['cp-ex__card', keep.includes(i) ? 'cp-ex__card--on' : ''].join(' ')}
                    onClick={() => setKeep(keep.includes(i) ? keep.filter((k) => k !== i) : [...keep, i].slice(-keepHint.keep))}><Card role={r} size="sm" flip={`ex-${i}`} flipFrom="deck" exit="deck" /></button>
                ))}
              </div>
              <Button size="sm" disabled={busy || keep.length !== keepHint.keep} onClick={() => onAction({ type: 'keep', roles: keep.map((i) => keepHint.options[i]!) })}><T t={terms.keepN} /> {fa(keep.length)} از {fa(keepHint.keep)}</Button>
            </div>
          )}

          {(canChallenge || blocks.length > 0 || canPass) && (
            <div className="cp-resp" role="group" aria-label={tx(terms.response)}>
              {canChallenge && <button type="button" className={['cp-resp__btn cp-resp__btn--challenge', hint?.type === 'challenge' ? 'cp-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'challenge' })}><T t={terms.challenge} />! «<T t={terms.liar} />»</button>}
              {blocks.map((r) => <button key={r} type="button" className={['cp-resp__btn cp-resp__btn--block', `cp-tag--${r}`, hint?.type === 'block' && hint.role === r ? 'cp-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'block', role: r })}><Thumb role={r} /><T t={terms.block} /> با {roleFa(r)}</button>)}
              {canPass && <button type="button" className="cp-resp__btn cp-resp__btn--pass" disabled={busy} onClick={() => onAction({ type: 'pass' })}><T t={terms.allow} /></button>}
            </div>
          )}

          {acts.size > 0 && (
            <div className="cp-acts" role="group" aria-label={tx(terms.actions)}>
              {ACTS.map((a) => {
                const ok = acts.has(a);
                const claim = CLAIM[a];
                return (
                  <button key={a} type="button" disabled={busy || !ok} aria-pressed={aim === a}
                    className={['cp-act', `cp-act--${a}`, claim ? `cp-tag--${claim}` : 'cp-act--plain', aim === a ? 'cp-act--on' : '', hint?.type === 'act' && hint.act === a ? 'cp-hint' : ''].join(' ')} onClick={() => pick(a)}>
                    <span className="cp-act__name">{actFa(a)}</span>
                    <span className="cp-act__note">{claim ? `${roleFa(claim)}، ` : ''}{actNote(a)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {/* Own influence cards sit under the actions, as in the reference (QA round 2). */}
          <div className={['cp-me__cards', lastReveal?.seat === mySeat ? 'bg-hit' : ''].join(' ')} key={lastReveal?.seat === mySeat ? lastSeq : 'm'} role="group" aria-label={`${tx(terms.cardsEz)} ${tx(terms.influence)} شما`}>
            {view.myCards.map((c, i) => loseCards.has(i)
              ? <button key={i} type="button" className="cp-lose" disabled={busy} onClick={() => onAction({ type: 'lose', card: i })} aria-label={`${tx(terms.loseN)} ${roleFa(c.role)}`}><Card role={c.role} /><span className="cp-lose__cta"><T t={terms.revealImp} /></span></button>
              : <Card key={i} role={c.role} lost={c.revealed} flip={c.flip} fresh={c.revealed && ((lastReveal?.seat === mySeat && lastReveal.role === c.role) || (q?.type === 'lose' && q.card === i))} />)}
          </div>

        </section>
      )}

      {!framed && view.log.length > 0 && (
        <ol className="cp-log" aria-label={tx(terms.log)}>
          {view.log.filter((e) => e.t !== 'resolve').slice(-5).reverse().map((e) => <li key={e.seq}>{line(e, who)}</li>)}
        </ol>
      )}
    </div>
  );
}

type Shown = Omit<CoupView, 'myCards'> & { myCards: (Influence & { flip?: string })[] | null };

/** The view with my queued move applied (only what I already know; nothing hidden or random). */
function preview(v: CoupView, q: Queued | null | undefined, me: number | null): Shown {
  if (!q || me === null) return v;
  const coins = v.coins.slice();
  if (q.type === 'act' && q.act) {
    if (q.act === 'income') coins[me]! += 1;
    if (q.act === 'coup') coins[me]! -= 7;
    const pending = q.act === 'income' || q.act === 'coup' ? v.pending
      : { act: q.act, actor: me, target: q.target ?? null, claim: CLAIM[q.act] ?? null, stage: 'respond' as const, block: null, responders: [] };
    return { ...v, coins, pending, phase: pending ? 'respond' : v.phase };
  }
  if (q.type === 'block' && q.role && v.pending) return { ...v, pending: { ...v.pending, block: { by: me, role: q.role } } };
  if (q.type === 'lose' && v.myCards) {
    const role = v.myCards[q.card!]?.role;
    return { ...v, myCards: v.myCards.map((c, i) => (i === q.card ? { ...c, revealed: true } : c)),
      cards: v.cards.map((c, s) => (s === me && role ? { hidden: c.hidden - 1, revealed: [...c.revealed, role] } : c)) };
  }
  if (q.type === 'keep' && q.roles && v.myCards && v.exchange) {
    // The kept options fly from the exchange row into the hand; the rest fly back to the deck.
    const opts = v.exchange.options, used = new Set<number>();
    const kept = q.roles.map((r) => { const i = opts.findIndex((o, k) => o === r && !used.has(k)); used.add(i); return { role: r, revealed: false, flip: `ex-${i}` }; });
    return { ...v, myCards: [...v.myCards.filter((c) => c.revealed), ...kept] };
  }
  return v;
}

function line(e: CoupView['log'][number], who: (s: number) => string) {
  const r = (x: unknown) => roleFa(x as Role);
  switch (e.t) {
    case 'act': return <><bdi>{who(e.seat)}</bdi>: {actFa(e.act as Act)}{e.claim ? ` (${tx(terms.claimEz)} ${r(e.claim)})` : ''}{e.target !== null && e.target !== undefined ? <> ← <bdi>{who(e.target as number)}</bdi></> : null}</>;
    case 'challenge': return <><bdi>{who(e.seat)}</bdi> <T t={terms.claimEz} /> {r(e.role)} <bdi>{who(e.of as number)}</bdi> را به <T t={terms.challenge} /> کشید — {e.truthful ? tx(terms.truth) : tx(terms.bluff)} بود!</>;
    case 'block': return <><bdi>{who(e.seat)}</bdi> با <T t={terms.claimEz} /> {r(e.role)} جلوی <T t={terms.action} /> را گرفت</>;
    case 'blocked': return <><T t={terms.action} /> متوقف شد</>;
    case 'reveal': return <><bdi>{who(e.seat)}</bdi> «{r(e.role)}» را از دست داد</>;
    case 'eliminated': return <><bdi>{who(e.seat)}</bdi> از بازی بیرون رفت</>;
    case 'exchanged': return <><bdi>{who(e.seat)}</bdi> <T t={terms.cardsPos} /> را با <T t={terms.deck} /> عوض کرد</>;
    case 'resolve': return <>{actFa(e.act as Act)} انجام شد</>;
    default: return null;
  }
}
