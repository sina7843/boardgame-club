// بلوف حشره‌ها renderer: a smoky card room. The card in play sits in the middle with the claim in a speech bubble and
// the path it has travelled; each player's face-up creatures are grouped with danger at three. Give: pick a card, a
// player and a claim. Respond: «راست می‌گوید» / «دروغ می‌گوید», or look at it and pass it on with a new claim.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
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

export function CritterCard({ c, size = 'md', back }: { c?: Creature | null; size?: 'sm' | 'md' | 'lg'; back?: boolean }) {
  if (back || !c) return <span className={`cr-card cr-card--${size} cr-card--back`} aria-label="کارت پشت‌ورو" />;
  return (
    <span className={`cr-card cr-card--${size} cr-c--${c}`} aria-label={CREATURE_FA[c]}>
      <img src={ART[c]} alt="" aria-hidden="true" draggable={false} />
      {size !== 'sm' && <span className="cr-card__n">{CREATURE_FA[c]}</span>}
    </span>
  );
}

export default function CockroachRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CockroachView>) {
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
    : give ? { tone: 'mine' as const, text: 'یک کارت، یک نفر و یک ادعا انتخاب کنید' }
      : canCall || pass ? { tone: 'mine' as const, text: ch?.peeked ? 'کارت را دیدید؛ با ادعای تازه رد کنید' : `ادعا: «${CREATURE_FA[ch!.claim]}» — راست است یا دروغ؟` }
        : { tone: 'wait' as const, text: `نوبت ${who(ch ? ch.to : view.current)}` };
  const order = mySeat === null ? view.table.map((_, k) => k) : [...view.table.map((_, k) => k).filter((k) => k !== mySeat), mySeat];
  const last = view.last;
  const loser = view.outcome?.placements.find((x) => x.place === 2)?.seat;

  return (
    <div className="cr" data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      {ch && !view.outcome && (
        <section className="cr__play" aria-label="کارت در جریان" key={`${view.seq}-${ch.to}`}>
          <CritterCard c={ch.card} back={!ch.card} size="lg" />
          <div className="cr__bubble"><bdi>{who(ch.from)}</bdi> به <bdi>{who(ch.to)}</bdi>: «این یک <b>{CREATURE_FA[ch.claim]}</b> است»</div>
          {ch.seen.length > 1 && <div className="cr__path">دیده‌اند: {ch.seen.map((k) => who(k)).join('، ')}</div>}
        </section>
      )}
      {last?.kind === 'call' && !ch && (
        <p className="cr__last" role="status" key={view.seq}>
          <bdi>{who(last.seat)}</bdi> گفت «{last.truth ? 'راست' : 'دروغ'}». کارت {CREATURE_FA[last.card]} بود ({last.card === last.claim ? 'راست' : 'بلوف'}) و جلوی <bdi>{who(last.taker)}</bdi> ماند.
        </p>
      )}

      <ul className="cr__players" aria-label="بازیکنان">
        {order.map((s) => {
          const groups = CREATURES.map((c) => ({ c, n: view.table[s]!.filter((x) => x === c).length })).filter((g) => g.n);
          const canTarget = targets.includes(s) && !busy;
          return (
            <li key={s} className={['cr-pl', (ch ? ch.to : view.current) === s && !view.outcome ? 'cr-pl--turn' : '', s === mySeat ? 'cr-pl--me' : '', loser === s ? 'cr-pl--lost' : ''].join(' ')}>
              <div className="cr-pl__head">
                <bdi className="cr-pl__name">{who(s)}</bdi>
                <span className="cr-pl__hand">{fa(view.handCount[s]!)} کارت</span>
                {loser === s && <span className="cr-pl__out">باخت</span>}
                {canTarget && (
                  <button type="button" className={['cr-target', to === s ? 'cr-target--on' : '', hint?.to === s && to !== s ? 'cr-hint' : ''].join(' ')} onClick={() => setTo(to === s ? null : s)} aria-pressed={to === s}>
                    {give ? 'به او بده' : 'به او رد کن'}
                  </button>
                )}
              </div>
              <div className="cr-pl__table">
                {groups.map((g) => <span key={g.c} className={`cr-stack ${g.n >= 3 ? 'cr-stack--danger' : ''}`}><CritterCard c={g.c} size="sm" /><b>×{fa(g.n)}</b></span>)}
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
          <div className="cr__hand" role="group" aria-label="کارت‌های دست">
            {CREATURES.map((c) => {
              const n = view.hand!.filter((x) => x === c).length;
              if (!n) return null;
              return give
                ? <button key={c} type="button" className={['cr-pick', card === c ? 'cr-pick--on' : '', hint?.card === c && card !== c ? 'cr-hint' : ''].join(' ')} aria-pressed={card === c} onClick={() => setCard(card === c ? null : c)}><CritterCard c={c} /><b>×{fa(n)}</b></button>
                : <span key={c} className="cr-pick"><CritterCard c={c} /><b>×{fa(n)}</b></span>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
