// بلوف حشره‌ها renderer: a smoky card room. The card in play sits in the middle with the claim in a speech bubble and
// the path it has travelled; each player's face-up creatures are grouped with danger at three. Give: pick a card, a
// player and a claim. Respond: «راست می‌گوید» / «دروغ می‌گوید», or look at it and pass it on with a new claim.
import './renderer.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import cockroach from './art/cockroach.webp';
import bat from './art/bat.webp';
import fly from './art/fly.webp';
import toad from './art/toad.webp';
import rat from './art/rat.webp';
import scorpion from './art/scorpion.webp';
import spider from './art/spider.webp';
import stinkbug from './art/stinkbug.webp';
import { CREATURES, type CockroachView, type Creature } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CREATURE_FA: Record<Creature, string> = { cockroach: 'سوسک', bat: 'خفاش', fly: 'مگس', toad: 'وزغ', rat: 'موش', scorpion: 'عقرب', spider: 'عنکبوت', stinkbug: 'سن' };

// Creature art is cut from a generated sprite sheet (see DECISIONS.md).
const ART: Record<Creature, string> = { cockroach, bat, fly, toad, rat, scorpion, spider, stinkbug };

export function CritterCard({ c, size = 'md', back, flip, flipFrom, cls = '' }: { c?: Creature | null; size?: 'sm' | 'md' | 'lg'; back?: boolean; flip?: string; flipFrom?: string; cls?: string }) {
  if (back || !c) return <span className={`cr-card cr-card--${size} cr-card--back ${cls}`} data-flip={flip} data-flip-from={flipFrom} aria-label="کارت پشت‌ورو" />;
  return (
    <span className={`cr-card cr-card--${size} cr-c--${c} ${cls}`} data-flip={flip} data-flip-from={flipFrom} aria-label={CREATURE_FA[c]}>
      <img src={ART[c]} alt="" aria-hidden="true" draggable={false} />
      {size !== 'sm' && <span className="cr-card__n">{CREATURE_FA[c]}</span>}
    </span>
  );
}

/** A count that bumps only when it changed (the key remounts it so the animation replays). */
function Bump({ v, className = '', children }: { v: unknown; className?: string; children: ReactNode }) {
  const pop = usePop(v);
  return <span key={String(v)} className={`${className} ${pop}`}>{children}</span>;
}

export default function CockroachRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CockroachView>) {
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
      : canCall || pass ? { tone: 'mine' as const, text: ch?.peeked ? 'کارت را دیدید؛ با ادعای تازه رد کنید' : `ادعا: «${CREATURE_FA[ch!.claim]}» — راست است یا دروغ؟` }
        : { tone: 'wait' as const, text: `نوبت ${who(ch ? ch.to : view.current)}` };
  const order = mySeat === null ? view.table.map((_, k) => k) : [...view.table.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const last = view.last;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${served.seq}|${queued ? JSON.stringify(queued) : ''}`);
  const loser = view.outcome?.placements.find((x) => x.place === 2)?.seat;

  return (
    <div className="cr" ref={root} data-seq={served.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {ch && !view.outcome && (
        <section className="cr__play" data-flip-anchor="play" aria-label="کارت در جریان">
          <CritterCard key={`${ch.from}-${ch.to}-${ch.seen.length}`} c={ch.card} back={!ch.card} size="lg" flip={`play-${ch.from}-${ch.to}-${ch.seen.length}`} flipFrom={ch.from === mySeat ? 'hand' : `seat-${ch.from}`} />
          <div className="cr__bubble"><bdi>{who(ch.from)}</bdi> به <bdi>{who(ch.to)}</bdi>: «این یک <b>{CREATURE_FA[ch.claim]}</b> است»</div>
          {ch.seen.length > 1 && <div className="cr__path">دیده‌اند: {ch.seen.map((k) => who(k)).join('، ')}</div>}
        </section>
      )}
      {last?.kind === 'call' && !ch && (
        <p className="cr__last" data-flip-anchor="play" role="status" key={view.seq}>
          <CritterCard c={last.card} size="sm" cls="bg-flip-in" />{' '}
          <bdi>{who(last.seat)}</bdi> گفت «{last.truth ? 'راست' : 'دروغ'}». کارت {CREATURE_FA[last.card]} بود ({last.card === last.claim ? 'راست' : 'بلوف'}) و جلوی <bdi>{who(last.taker)}</bdi> ماند.
        </p>
      )}

      <ul className="cr__players" aria-label="بازیکنان">
        {order.map((s) => {
          const groups = CREATURES.map((c) => ({ c, n: view.table[s]!.filter((x) => x === c).length })).filter((g) => g.n);
          const canTarget = targets.includes(s) && !busy;
          return (
            <li key={s} data-flip-anchor={`seat-${s}`} className={['cr-pl', last?.kind === 'call' && !ch && last.taker === s ? 'bg-hit' : '', (ch ? ch.to : view.current) === s && !view.outcome ? 'cr-pl--turn' : '', s === mySeat ? 'cr-pl--me' : '', loser === s ? 'cr-pl--lost' : ''].join(' ')}>
              <div className="cr-pl__head">
                <bdi className="cr-pl__name">{who(s)}</bdi>
                <Bump v={view.handCount[s]} className="cr-pl__hand">{fa(view.handCount[s]!)} کارت</Bump>
                {loser === s && <span className="cr-pl__out">باخت</span>}
                {canTarget && (
                  <button type="button" className={['cr-target', to === s ? 'cr-target--on' : '', hint?.to === s && to !== s ? 'cr-hint' : ''].join(' ')} onClick={() => setTo(to === s ? null : s)} aria-pressed={to === s}>
                    {give ? 'به او بده' : 'به او رد کن'}
                  </button>
                )}
              </div>
              <div className="cr-pl__table">
                {groups.map((g) => <span key={g.c} className={`cr-stack ${g.n >= 3 ? 'cr-stack--danger' : ''}`}><CritterCard key={g.n} c={g.c} size="sm" flip={`tb-${s}-${g.c}-${g.n}`} flipFrom="play" /><Bump v={g.n} className="cr-stack__n">×{fa(g.n)}</Bump></span>)}
                {!groups.length && <span className="cr-empty">—</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {view.hand && !view.outcome && (
        <section className="cr__me" aria-label="دست شما">
          {(canCall || canPeek) && (
            <div className="cr__respond">
              {canCall && <Button size="sm" disabled={busy} className={hint?.type === 'call' && hint.truth ? 'cr-hint' : ''} onClick={() => onAction({ type: 'call', truth: true })}>راست می‌گوید</Button>}
              {canCall && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'call' && hint.truth === false ? 'cr-hint' : ''} onClick={() => onAction({ type: 'call', truth: false })}>دروغ می‌گوید</Button>}
              {canPeek && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'peek' })}>نگاه کن و رد کن</Button>}
            </div>
          )}
          {(give || passing) && (
            <div className="cr__claims" role="group" aria-label="ادعا">
              <span>ادعا:</span>
              {CREATURES.map((c) => (
                <button key={c} type="button" className={['cr-claim', claim === c ? 'cr-claim--on' : '', hint?.claim === c && claim !== c ? 'cr-hint' : ''].join(' ')} aria-pressed={claim === c} onClick={() => setClaim(claim === c ? null : c)}>
                  <CritterCard c={c} size="sm" /><small>{CREATURE_FA[c]}</small>
                </button>
              ))}
            </div>
          )}
          {(give || passing) && (
            <Button size="sm" disabled={!ready || busy} className={hint && (hint.type === 'give' || hint.type === 'pass') && ready ? 'cr-hint' : ''}
              onClick={() => onAction(give ? { type: 'give', card: card!, to: to!, claim: claim! } : { type: 'pass', to: to!, claim: claim! })}>
              {give ? 'دادن کارت' : 'رد کردن کارت'}
            </Button>
          )}
          <div className="cr__hand" data-flip-anchor="hand" role="group" aria-label="کارت‌های دست">
            {CREATURES.map((c) => {
              const n = view.hand!.filter((x) => x === c).length;
              if (!n) return null;
              return give
                ? <button key={c} type="button" data-flip={`hand-${c}`} className={['cr-pick', card === c ? 'cr-pick--on' : '', hint?.card === c && card !== c ? 'cr-hint' : ''].join(' ')} aria-pressed={card === c} onClick={() => setCard(card === c ? null : c)}><CritterCard c={c} /><b>×{fa(n)}</b></button>
                : <span key={c} data-flip={`hand-${c}`} className="cr-pick"><CritterCard c={c} /><b>×{fa(n)}</b></span>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
