// بلوف حشره‌ها renderer: a smoky card room. The card in play sits in the middle with the claim in a speech bubble and
// the path it has travelled; each player's face-up creatures are grouped with danger at three. Give: pick a card, a
// player and a claim. Respond: «راست می‌گوید» / «دروغ می‌گوید», or look at it and pass it on with a new claim.
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, RailSlot, TurnIndicator, tx, useFlip, useInFrame, usePop, useTermsLang, type GameRendererProps, type Term } from '@bg/ui';
import cockroach from './art/cockroach-poker-cockroach.png';
import bat from './art/cockroach-poker-bat.png';
import fly from './art/cockroach-poker-fly.png';
import toad from './art/cockroach-poker-toad.png';
import rat from './art/cockroach-poker-rat.png';
import scorpion from './art/cockroach-poker-scorpion.png';
import spider from './art/cockroach-poker-spider.png';
import stinkbug from './art/cockroach-poker-stinkbug.png';
import backArt from './art/cockroach-poker-back.png';
import { terms } from './terms.ts';
import { CREATURES, type CockroachView, type Creature } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const CREATURE_T: Record<Creature, Term> = { cockroach: terms.cockroach, bat: terms.bat, fly: terms.fly, toad: terms.toad, rat: terms.rat, scorpion: terms.scorpion, spider: terms.spider, stinkbug: terms.stinkbug };
const creatureFa = (c: Creature) => tx(CREATURE_T[c]);

// Printed card faces and back from design/games/group-c/art/cockroach-poker; the whole picture is the card.
const ART: Record<Creature, string> = { cockroach, bat, fly, toad, rat, scorpion, spider, stinkbug };

export function CritterCard({ c, size = 'md', back, flip, flipFrom, cls = '' }: { c?: Creature | null; size?: 'sm' | 'md' | 'lg'; back?: boolean; flip?: string; flipFrom?: string; cls?: string }) {
  if (back || !c) return <span className={`crp-card crp-card--art crp-card--${size} ${cls}`} data-flip={flip} data-flip-from={flipFrom} aria-label="کارت پشت‌ورو"><img src={backArt} alt="" aria-hidden="true" draggable={false} /></span>;
  return (
    <span className={`crp-card crp-card--art crp-card--${size} crp-c--${c} ${cls}`} data-flip={flip} data-flip-from={flipFrom} aria-label={creatureFa(c)}>
      <img src={ART[c]} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
}

/** A count that bumps only when it changed (the key remounts it so the animation replays). */
function Bump({ v, className = '', children }: { v: unknown; className?: string; children: ReactNode }) {
  const pop = usePop(v);
  return <span key={String(v)} className={`${className} ${pop}`}>{children}</span>;
}

export default function CockroachRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CockroachView>) {
  useTermsLang(); // re-render when the terms language changes
  // Undo-window preview: my give or pass already travels to the chosen player with its claim (the card is one I know).
  // A call or a peek is not previewed: what the card is, and who keeps it, only comes with the server's answer.
  const me = mySeat ?? -1;
  const view: CockroachView = (() => {
    if (me < 0 || !queued) return served;
    if (queued.type === 'give' && served.hand) {
      const card = queued.card as Creature, i = served.hand.indexOf(card);
      return { ...served, hand: served.hand.filter((_, k) => k !== i), handCount: served.handCount.map((n, k) => (k === me ? n - 1 : n)),
        chain: { card, from: me, to: queued.to as number, claim: queued.claim as Creature, seen: [me], peeked: false } };
    }
    if (queued.type === 'pass' && served.chain) {
      const c = served.chain;
      return { ...served, chain: { ...c, from: me, to: queued.to as number, claim: queued.claim as Creature, seen: c.seen.includes(me) ? c.seen : [...c.seen, me], peeked: false } };
    }
    return served;
  })();
  const give = legalActions.find((a) => a.type === 'give') as { targets: number[] } | undefined;
  const canCall = legalActions.some((a) => a.type === 'call');
  const canPeek = legalActions.some((a) => a.type === 'peek');
  const pass = legalActions.find((a) => a.type === 'pass') as { targets: number[] } | undefined;
  const [card, setCard] = useState<Creature | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [claim, setClaim] = useState<Creature | null>(null);
  useEffect(() => { setCard(null); setTo(null); setClaim(null); }, [view.seq]);
  const hint = expected as unknown as { type: string; card?: Creature; to?: number; claim?: Creature; truth?: boolean } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const ch = view.chain;
  const passing = !!pass && (!canCall || !!ch?.card);
  const targets = give?.targets ?? (passing ? pass!.targets : []);
  const ready = (give ? card !== null : passing) && to !== null && claim !== null;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : give ? { tone: 'mine' as const, text: 'یک کارت، یک نفر و یک ادعا انتخاب کنید' }
      : canCall || pass ? { tone: 'mine' as const, text: ch?.peeked ? 'کارت را دیدید؛ با ادعای تازه رد کنید' : `ادعا: «${creatureFa(ch!.claim)}» — راست است یا دروغ؟` }
        : { tone: 'wait' as const, text: `نوبت ${who(ch ? ch.to : view.current)}` };
  const order = mySeat === null ? view.table.map((_, k) => k) : [...view.table.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const last = view.last;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const framed = useInFrame() !== null;
  const loser = view.outcome?.placements.find((x) => x.place === 2)?.seat;

  return (
    <div className="crp" ref={root} data-seq={served.seq}>
      {framed && (
        <RailSlot>
          <p>{ch?.peeked ? 'کارت را دیده‌اید؛ باید با ادعای تازه به کسی که ندیده رد کنید.' : 'گیرنده حدس می‌زند ادعا راست است یا دروغ؛ حدس درست کارت را جلوی دهنده می‌گذارد. چهار کارت هم‌نوع جلوی خود یعنی باخت.'}</p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {ch && !view.outcome && (
        <section className="crp__play" data-flip-anchor="play" aria-label="کارت در جریان">
          <CritterCard key={`${ch.from}-${ch.to}-${ch.seen.length}`} c={ch.card} back={!ch.card} size="lg" flip={`play-${ch.from}-${ch.to}-${ch.seen.length}`} flipFrom={ch.from === mySeat ? 'hand' : `seat-${ch.from}`} />
          <div className="crp__bubble"><bdi>{who(ch.from)}</bdi> به <bdi>{who(ch.to)}</bdi>: «این یک <b>{creatureFa(ch.claim)}</b> است»</div>
          {ch.seen.length > 1 && <div className="crp__path">دیده‌اند: {ch.seen.map((k) => who(k)).join('، ')}</div>}
        </section>
      )}
      {!framed && last?.kind === 'call' && !ch && (
        <p className="crp__last" data-flip-anchor="play" role="status" key={view.seq}>
          <CritterCard c={last.card} size="sm" cls="bg-flip-in" />{' '}
          <bdi>{who(last.seat)}</bdi> گفت «{last.truth ? 'راست' : 'دروغ'}». کارت {creatureFa(last.card)} بود ({last.card === last.claim ? 'راست' : 'بلوف'}) و جلوی <bdi>{who(last.taker)}</bdi> ماند.
        </p>
      )}

      <ul className="crp__players" aria-label="بازیکنان">
        {order.map((s) => {
          const groups = CREATURES.map((c) => ({ c, n: view.table[s]!.filter((x) => x === c).length })).filter((g) => g.n);
          const canTarget = targets.includes(s) && !busy;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['crp-pl', last?.kind === 'call' && !ch && last.taker === s ? 'bg-hit' : '', (ch ? ch.to : view.current) === s && !view.outcome ? 'crp-pl--turn' : '', s === mySeat ? 'crp-pl--me' : '', loser === s ? 'crp-pl--lost' : ''].join(' ')}>
              <div className="crp-pl__head">
                <bdi className="crp-pl__name">{who(s)}</bdi>
                <Bump v={view.handCount[s]} className="crp-pl__hand">{fa(view.handCount[s]!)} کارت</Bump>
                {loser === s && <span className="crp-pl__out">باخت</span>}
                {canTarget && (
                  <button type="button" className={['crp-target', to === s ? 'crp-target--on' : '', hint?.to === s && to !== s ? 'crp-hint' : ''].join(' ')} onClick={() => setTo(to === s ? null : s)} aria-pressed={to === s}>
                    {give ? 'به او بده' : 'به او رد کن'}
                  </button>
                )}
              </div>
              {groups.length > 0 && (
                <div className="crp-pl__table">
                  {groups.map((g) => <span key={g.c} className={`crp-stack ${g.n >= 3 ? 'crp-stack--danger' : ''}`}><CritterCard key={g.n} c={g.c} size="sm" flip={`tb-${s}-${g.c}-${g.n}`} flipFrom="play" /><Bump v={g.n} className="crp-stack__n">×{fa(g.n)}</Bump></span>)}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {view.hand && !view.outcome && (
        <section className="crp__me" aria-label="دست شما">
          {(canCall || canPeek) && (
            <div className="crp__respond">
              {canCall && <Button size="sm" disabled={busy} className={hint?.type === 'call' && hint.truth ? 'crp-hint' : ''} onClick={() => onAction({ type: 'call', truth: true })}>راست می‌گوید</Button>}
              {canCall && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'call' && hint.truth === false ? 'crp-hint' : ''} onClick={() => onAction({ type: 'call', truth: false })}>دروغ می‌گوید</Button>}
              {canPeek && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'peek' })}>نگاه کن و رد کن</Button>}
            </div>
          )}
          {(give || passing) && (
            <div className="crp__claims" role="group" aria-label="ادعا">
              <span>ادعا:</span>
              {CREATURES.map((c) => (
                <button key={c} type="button" className={['crp-claim', claim === c ? 'crp-claim--on' : '', hint?.claim === c && claim !== c ? 'crp-hint' : ''].join(' ')} aria-pressed={claim === c} onClick={() => setClaim(claim === c ? null : c)}>
                  <CritterCard c={c} size="sm" /><small>{creatureFa(c)}</small>
                </button>
              ))}
            </div>
          )}
          {(give || passing) && (
            <Button size="sm" disabled={!ready || busy} className={hint && (hint.type === 'give' || hint.type === 'pass') && ready ? 'crp-hint' : ''}
              onClick={() => onAction(give ? { type: 'give', card: card!, to: to!, claim: claim! } : { type: 'pass', to: to!, claim: claim! })}>
              {give ? 'دادن کارت' : 'رد کردن کارت'}
            </Button>
          )}
          {/* Overlapping fan, one card per card held, grouped by creature; the picked card rises (QA round 2). */}
          <div className="crp__hand" data-flip-anchor="hand" role="group" aria-label="کارت‌های دست" style={{ '--n': view.hand.length } as CSSProperties}>
            {CREATURES.flatMap((c) => view.hand!.filter((x) => x === c).map((_, k) => {
              const on = card === c && k === 0, label = <span className="visually-hidden">{creatureFa(c)}</span>;
              return give
                ? <button key={`${c}-${k}`} type="button" data-flip={`hand-${c}-${k}`} className={['crp-pick', on ? 'crp-pick--on' : '', hint?.card === c && card !== c && k === 0 ? 'crp-hint' : ''].join(' ')} aria-pressed={card === c} onClick={() => setCard(card === c ? null : c)}><CritterCard c={c} />{label}</button>
                : <span key={`${c}-${k}`} data-flip={`hand-${c}-${k}`} className="crp-pick"><CritterCard c={c} />{label}</span>;
            }))}
          </div>
        </section>
      )}
    </div>
  );
}
