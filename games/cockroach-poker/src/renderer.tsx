// بلوف حشره‌ها renderer: a smoky card room. The card in play sits in the middle with the claim in a speech bubble and
// the path it has travelled; each player's face-up creatures are grouped with danger at three. Give: pick a card, a
// player and a claim. Respond: «راست می‌گوید» / «دروغ می‌گوید», or look at it and pass it on with a new claim.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CREATURES, type CockroachView, type Creature } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const CREATURE_FA: Record<Creature, string> = { cockroach: 'سوسک', bat: 'خفاش', fly: 'مگس', toad: 'وزغ', rat: 'موش', scorpion: 'عقرب', spider: 'عنکبوت', stinkbug: 'سن' };

function Bug({ c }: { c: Creature }) {
  switch (c) {
    case 'cockroach': return <g><ellipse rx="5" ry="8" /><path d="M-4 -3 L-10 -6 M-5 1 L-11 1 M-4 5 L-10 8 M4 -3 L10 -6 M5 1 L11 1 M4 5 L10 8 M-1 -8 L-5 -13 M1 -8 L5 -13" strokeWidth="1.2" fill="none" /></g>;
    case 'bat': return <path d="M0 -3 Q-4 -9 -11 -6 Q-8 -2 -11 3 Q-6 1 -4 5 Q-2 2 0 4 Q2 2 4 5 Q6 1 11 3 Q8 -2 11 -6 Q4 -9 0 -3 Z" />;
    case 'fly': return <g><ellipse rx="4" ry="6" cy="2" /><ellipse rx="5" ry="3" cx="-5" cy="-4" opacity=".6" /><ellipse rx="5" ry="3" cx="5" cy="-4" opacity=".6" /><circle r="2.5" cy="-5" /></g>;
    case 'toad': return <g><ellipse rx="9" ry="6" cy="2" /><circle cx="-4" cy="-4" r="2.5" /><circle cx="4" cy="-4" r="2.5" /></g>;
    case 'rat': return <g><ellipse rx="7" ry="4.5" cx="1" /><circle cx="-7" cy="-1" r="3" /><path d="M8 1 Q12 5 10 9" strokeWidth="1.2" fill="none" /><circle cx="-8" cy="-4" r="1.6" /></g>;
    case 'scorpion': return <g><ellipse rx="4" ry="5" cy="3" /><path d="M0 -2 Q-1 -8 3 -10 Q6 -11 6 -7" strokeWidth="2" fill="none" /><path d="M-3 6 L-9 9 M3 6 L9 9 M-4 1 L-10 -1 M4 1 L10 -1" strokeWidth="1.2" fill="none" /></g>;
    case 'spider': return <g><circle r="4" cy="2" /><circle r="2.5" cy="-3" /><path d="M-3 0 L-9 -6 M-3 2 L-10 1 M-3 4 L-9 8 M3 0 L9 -6 M3 2 L10 1 M3 4 L9 8" strokeWidth="1.2" fill="none" /></g>;
    case 'stinkbug': return <g><path d="M0 -6 L7 -1 L5 8 L-5 8 L-7 -1 Z" /><path d="M-2 -6 L-5 -10 M2 -6 L5 -10" strokeWidth="1.2" fill="none" /></g>;
  }
}

export function CritterCard({ c, size = 'md', back }: { c?: Creature | null; size?: 'sm' | 'md' | 'lg'; back?: boolean }) {
  if (back || !c) return <span className={`cr-card cr-card--${size} cr-card--back`} aria-label="کارت پشت‌ورو" />;
  return (
    <span className={`cr-card cr-card--${size} cr-c--${c}`} aria-label={CREATURE_FA[c]}>
      <svg viewBox="-14 -14 28 28" aria-hidden="true"><Bug c={c} /></svg>
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
