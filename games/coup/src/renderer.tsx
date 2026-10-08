// کودتا renderer: a palace intrigue table. Each courtier shows coins and two influence cards (backs until lost), the
// pending claim sits in a gilded banner, and your hand has the action board, the response buttons, the "which card do
// you lose" choice and the Ambassador's exchange.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import duke from './art/coup-duke.webp';
import assassin from './art/coup-assassin.webp';
import captain from './art/coup-captain.webp';
import ambassador from './art/coup-ambassador.webp';
import contessa from './art/coup-contessa.webp';
import { ACT_FA, CLAIM, ROLE_FA, type Act, type CoupView, type Role } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const ACTS: Act[] = ['income', 'foreignAid', 'tax', 'steal', 'exchange', 'assassinate', 'coup'];
const ACT_NOTE: Record<Act, string> = { income: '+۱ سکه', foreignAid: '+۲ سکه', coup: '۷ سکه', tax: '+۳ سکه', assassinate: '۳ سکه', steal: '۲ سکه از حریف', exchange: '۲ کارت از دسته' };

// Portraits are cut from a generated sheet (see DECISIONS.md); decorative, the role name stays as text.
const ART: Record<Role, string> = { duke, assassin, captain, ambassador, contessa };

function Card({ role, lost, size = 'md', fresh }: { role: Role | null; lost?: boolean; size?: 'sm' | 'md'; fresh?: boolean }) {
  return (
    <span className={['cp-card', `cp-card--${size}`, role ? `cp-card--${role}` : 'cp-card--back', lost ? 'cp-card--lost' : '', fresh ? 'cp-card--fresh' : ''].join(' ')}>
      <svg viewBox="-35 -50 70 100" aria-hidden="true">
        <rect x="-33" y="-48" width="66" height="96" rx="7" className="cp-card__bg" />
        {role && <image href={ART[role]} x="-28" y="-43" width="56" height="56" preserveAspectRatio="xMidYMid slice" />}
        <rect x="-28" y="-43" width="56" height="86" rx="4" fill="none" className="cp-card__frame" />
        {role ? <rect x="-28" y="13" width="56" height="1.6" className="cp-card__frame" fill="var(--gold)" />
          : <path d="M0 -26 L20 0 L0 26 L-20 0 Z M0 -14 L10 0 L0 14 L-10 0 Z" className="cp-card__mark" fillRule="evenodd" />}
      </svg>
      {role && <span className="cp-card__name">{ROLE_FA[role]}</span>}
      {lost && <span className="cp-card__x" aria-hidden="true" />}
    </span>
  );
}

const Thumb = ({ role }: { role: Role }) => <img className="cp-thumb" src={ART[role]} alt="" aria-hidden="true" />;

const Coins = ({ n }: { n: number }) => (
  <span className="cp-coins" aria-label={`${fa(n)} سکه`}><span className="cp-coin" aria-hidden="true" /><b key={n}>{fa(n)}</b></span>
);

export default function CoupRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CoupView>) {
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
    : mine ? {
      tone: 'mine' as const,
      text: view.phase === 'lose' ? 'یک نفوذ از دست می‌دهید: کارتی را که رو می‌شود انتخاب کنید'
        : view.phase === 'exchange' ? `${fa(keepHint?.keep ?? 1)} کارت نگه دارید`
          : view.phase === 'respond' ? (p!.stage === 'blockRespond' ? 'جلوگیری را قبول می‌کنید یا چالش؟' : 'قبول، چالش یا جلوگیری؟')
            : aim ? `هدف «${ACT_FA[aim]}» را انتخاب کنید` : 'نوبت شماست: یک کار انتخاب کنید'
    }
      : { tone: 'wait' as const, text: `منتظر ${waitingOn.map(who).join('، ')}` };

  const banner = p && view.phase !== 'action' && !view.outcome ? (
    <div className="cp-claim" role="status" key={`${p.actor}-${p.act}-${p.block?.by ?? ''}`}>
      <span className="cp-claim__who"><bdi>{who(p.actor)}</bdi></span>
      {p.claim ? <> ادعای <b className={`cp-tag cp-tag--${p.claim}`}><Thumb role={p.claim} />{ROLE_FA[p.claim]}</b> — </> : ' '}
      <b>{ACT_FA[p.act]}</b>{p.target !== null && <> روی <bdi>{who(p.target)}</bdi></>}
      {p.block && <span className="cp-claim__block"><bdi>{who(p.block.by)}</bdi> با ادعای <b className={`cp-tag cp-tag--${p.block.role}`}><Thumb role={p.block.role} />{ROLE_FA[p.block.role]}</b> جلویش را گرفت</span>}
    </div>
  ) : null;

  return (
    <div className="cp" data-seq={lastSeq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {banner}

      <ul className="cp__court" aria-label="درباریان">
        {order.filter((s) => s !== mySeat).map((s) => {
          const c = view.cards[s]!;
          const out = c.hidden === 0;
          const canAim = targets.includes(s) && !busy;
          const body = (
            <>
              <div className="cp-pl__head"><bdi className="cp-pl__name">{who(s)}</bdi><Coins n={view.coins[s]!} />{out && <span className="cp-pl__out">بیرون</span>}</div>
              <div className="cp-pl__cards">
                {Array.from({ length: c.hidden }, (_, k) => <Card key={`h${k}`} role={null} size="sm" />)}
                {c.revealed.map((r, k) => <Card key={`r${k}`} role={r} lost size="sm" fresh={lastReveal?.seat === s && k === c.revealed.length - 1} />)}
              </div>
            </>
          );
          return (
            <li key={s} className={['cp-pl', waitingOn.includes(s) && !view.outcome ? 'cp-pl--turn' : '', out ? 'cp-pl--out' : '', p?.target === s && view.phase === 'respond' ? 'cp-pl--target' : ''].join(' ')}>
              {canAim
                ? <button type="button" className={['cp-pl__aim', hint?.type === 'act' && hint.target === s ? 'cp-hint' : ''].join(' ')} onClick={() => onAction({ type: 'act', act: aim!, target: s })} aria-label={`${ACT_FA[aim!]}: ${who(s)}`}>{body}</button>
                : body}
            </li>
          );
        })}
      </ul>

      {mySeat !== null && view.myCards && (
        <section className="cp__me" aria-label="دست شما">
          <div className="cp-me__head"><bdi className="cp-pl__name">شما</bdi><Coins n={view.coins[mySeat]!} /><span className="cp-me__deck">دسته دربار: {fa(view.deckCount)}</span></div>
          <div className="cp-me__cards" role="group" aria-label="کارت‌های نفوذ شما">
            {view.myCards.map((c, i) => loseCards.has(i)
              ? <button key={i} type="button" className="cp-lose" disabled={busy} onClick={() => onAction({ type: 'lose', card: i })} aria-label={`از دست دادن ${ROLE_FA[c.role]}`}><Card role={c.role} /><span className="cp-lose__cta">رو کن</span></button>
              : <Card key={i} role={c.role} lost={c.revealed} fresh={c.revealed && lastReveal?.seat === mySeat && lastReveal.role === c.role} />)}
          </div>

          {keepHint && (
            <div className="cp-ex" role="group" aria-label="مبادله">
              <div className="cp-ex__cards">
                {keepHint.options.map((r, i) => (
                  <button key={i} type="button" aria-pressed={keep.includes(i)} className={['cp-ex__card', keep.includes(i) ? 'cp-ex__card--on' : ''].join(' ')}
                    onClick={() => setKeep(keep.includes(i) ? keep.filter((k) => k !== i) : [...keep, i].slice(-keepHint.keep))}><Card role={r} size="sm" /></button>
                ))}
              </div>
              <Button size="sm" disabled={busy || keep.length !== keepHint.keep} onClick={() => onAction({ type: 'keep', roles: keep.map((i) => keepHint.options[i]!) })}>نگه داشتن {fa(keep.length)} از {fa(keepHint.keep)}</Button>
            </div>
          )}

          {(canChallenge || blocks.length > 0 || canPass) && (
            <div className="cp-resp" role="group" aria-label="پاسخ">
              {canChallenge && <button type="button" className={['cp-resp__btn cp-resp__btn--challenge', hint?.type === 'challenge' ? 'cp-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'challenge' })}>چالش! «دروغ می‌گویی»</button>}
              {blocks.map((r) => <button key={r} type="button" className={['cp-resp__btn cp-resp__btn--block', `cp-tag--${r}`, hint?.type === 'block' && hint.role === r ? 'cp-hint' : ''].join(' ')} disabled={busy} onClick={() => onAction({ type: 'block', role: r })}><Thumb role={r} />جلوگیری با {ROLE_FA[r]}</button>)}
              {canPass && <button type="button" className="cp-resp__btn cp-resp__btn--pass" disabled={busy} onClick={() => onAction({ type: 'pass' })}>قبول</button>}
            </div>
          )}

          {acts.size > 0 && (
            <div className="cp-acts" role="group" aria-label="کارها">
              {ACTS.map((a) => {
                const ok = acts.has(a);
                const claim = CLAIM[a];
                return (
                  <button key={a} type="button" disabled={busy || !ok} aria-pressed={aim === a}
                    className={['cp-act', `cp-act--${a}`, claim ? `cp-tag--${claim}` : 'cp-act--plain', aim === a ? 'cp-act--on' : '', hint?.type === 'act' && hint.act === a ? 'cp-hint' : ''].join(' ')} onClick={() => pick(a)}>
                    <span className="cp-act__name">{ACT_FA[a]}</span>
                    <span className="cp-act__note">{claim ? `${ROLE_FA[claim]}، ` : ''}{ACT_NOTE[a]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {view.log.length > 0 && (
        <ol className="cp-log" aria-label="رویدادها">
          {view.log.filter((e) => e.t !== 'resolve').slice(-5).reverse().map((e) => <li key={e.seq}>{line(e, who)}</li>)}
        </ol>
      )}
    </div>
  );
}

function line(e: CoupView['log'][number], who: (s: number) => string) {
  const r = (x: unknown) => ROLE_FA[x as Role];
  switch (e.t) {
    case 'act': return <><bdi>{who(e.seat)}</bdi>: {ACT_FA[e.act as Act]}{e.claim ? ` (ادعای ${r(e.claim)})` : ''}{e.target !== null && e.target !== undefined ? <> ← <bdi>{who(e.target as number)}</bdi></> : null}</>;
    case 'challenge': return <><bdi>{who(e.seat)}</bdi> ادعای {r(e.role)} <bdi>{who(e.of as number)}</bdi> را به چالش کشید — {e.truthful ? 'راست بود!' : 'بلوف بود!'}</>;
    case 'block': return <><bdi>{who(e.seat)}</bdi> با ادعای {r(e.role)} جلوی کار را گرفت</>;
    case 'blocked': return <>کار متوقف شد</>;
    case 'reveal': return <><bdi>{who(e.seat)}</bdi> «{r(e.role)}» را از دست داد</>;
    case 'eliminated': return <><bdi>{who(e.seat)}</bdi> از بازی بیرون رفت</>;
    case 'exchanged': return <><bdi>{who(e.seat)}</bdi> کارت‌هایش را با دسته عوض کرد</>;
    case 'resolve': return <>{ACT_FA[e.act as Act]} انجام شد</>;
    default: return null;
  }
}
