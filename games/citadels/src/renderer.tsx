// ارگ‌ها renderer: an illuminated city chronicle. The character track (1–8) shows who has been called, killed or
// robbed; the draft pool appears only to the picker; your hand of districts sits under your city; each ability has
// its own small panel during your character's turn.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import { CHARACTERS, DISTRICTS, type CitadelsView } from './rules.ts';
// Paintings are cut from a generated sheet (see DECISIONS.md).
import assassin from './art/ch-assassin.webp';
import thief from './art/ch-thief.webp';
import magician from './art/ch-magician.webp';
import king from './art/ch-king.webp';
import bishop from './art/ch-bishop.webp';
import merchant from './art/ch-merchant.webp';
import architect from './art/ch-architect.webp';
import warlord from './art/ch-warlord.webp';
import yellow from './art/d-yellow.webp';
import blue from './art/d-blue.webp';
import green from './art/d-green.webp';
import red from './art/d-red.webp';
import crown from './art/crown.webp';
import coin from './art/coin.webp';

const PORTRAIT = [assassin, thief, magician, king, bishop, merchant, architect, warlord]; // CHARACTERS index 1..8
const DISTRICT_ART: Record<string, string> = { yellow, blue, green, red };

const fa = (n: number) => n.toLocaleString('fa-IR');

export function DistrictCard({ id, size = 'md', from, exit }: { id: number; size?: 'sm' | 'md'; from?: string; exit?: string }) {
  const d = DISTRICTS[id]!;
  return (
    <span className={`ct2-d ct2-d--${size} ct2-c--${d.color}`} data-flip={from ? `d-${id}` : undefined} data-flip-from={from} data-flip-exit={exit} aria-label={`${d.name}، ${fa(d.cost)} طلا`}>
      <b className="ct2-d__cost">{fa(d.cost)}</b>
      <img className="ct2-d__art" src={DISTRICT_ART[d.color]} alt="" draggable={false} />
      <span className="ct2-d__name">{d.name}</span>
    </span>
  );
}

const Thumb = ({ c }: { c: number }) => <img className="ct2-thumb" src={PORTRAIT[c - 1]} alt="" draggable={false} />;

export function CharToken({ c, state, from }: { c: number; state?: string; from?: string }) {
  return <span className={`ct2-ch ct2-ch--${c} ${state ?? ''}`} data-flip={from ? `pk-${c}` : undefined} data-flip-from={from}><img className="ct2-ch__art" src={PORTRAIT[c - 1]} alt="" draggable={false} /><b>{fa(c)}</b><small>{CHARACTERS[c]}</small></span>;
}

export default function CitadelsRenderer({ view: real, legalActions: realLegal, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CitadelsView>) {
  const me = mySeat ?? -1;
  // Undo-window preview of an own pick, keep or build, from what this client already knows: the character joins your
  // picks, the kept card joins your hand, the built district leaves the hand for your city (and its cost leaves your gold).
  const q = queued as { type: string; char?: number; card?: number } | null | undefined;
  const view = preview(real, me, q);
  const legalActions = q ? [] : realLegal;
  const pick = legalActions.find((a) => a.type === 'pick') as { chars: number[] } | undefined;
  const income = legalActions.some((a) => a.type === 'income');
  const keep = legalActions.find((a) => a.type === 'keep') as { cards: number[] } | undefined;
  const builds = new Set(legalActions.filter((a) => a.type === 'build').map((a) => a.card as number));
  const canEnd = legalActions.some((a) => a.type === 'end');
  const ability = legalActions.find((a) => a.type === 'ability') as { char: number } | undefined;
  const [redraw, setRedraw] = useState<number[]>([]);
  useEffect(() => { setRedraw([]); }, [view.seq]);
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q?.type ?? ''}`);
  const hint = expected as unknown as { type: string; take?: string; card?: number; char?: number } | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const others = view.cities.map((_, k) => k).filter((k) => k !== me);
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : pick ? { tone: 'mine' as const, text: 'یک شخصیت مخفیانه انتخاب کنید' }
      : income ? { tone: 'mine' as const, text: `نوبت ${CHARACTERS[view.calling]} شما: ۲ طلا یا دو کارت؟` }
        : keep ? { tone: 'mine' as const, text: 'یکی از دو کارت را نگه دارید' }
          : canEnd ? { tone: 'mine' as const, text: `محله بسازید${ability ? ' یا از توانایی استفاده کنید' : ''}، بعد نوبت را تمام کنید` }
            : { tone: 'wait' as const, text: view.phase === 'draft' ? 'انتخاب شخصیت‌ها…' : `${CHARACTERS[view.calling]} بازی می‌کند` };
  const charState = (c: number) => (view.faceUp.includes(c) ? 'is-out' : c === view.killed ? 'is-dead' : view.calling === c && view.phase !== 'draft' ? 'is-now' : view.revealed.includes(c) ? 'is-done' : '');

  return (
    <div className="ct2" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <p className="ct2__round" data-flip-anchor="deck">دور {fa(view.round)}، تاج: <bdi>{who(view.crown)}</bdi>، دسته: {fa(view.deckCount)}</p>

      <section className="ct2__track" aria-label="شخصیت‌ها">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
          <span key={c} className={c === view.killed ? 'ct2-slot bg-hit' : 'ct2-slot'}>
            <CharToken c={c} state={charState(c)} />
            {view.holders[c] !== undefined && view.holders[c]! >= 0 && <bdi className="ct2-slot__who">{who(view.holders[c]!)}</bdi>}
            {view.robbed?.char === c && <small className="ct2-slot__tag">دزدیده</small>}
          </span>
        ))}
      </section>

      {pick && view.pool && (
        <div className="ct2__pool" data-flip-anchor="pool" role="group" aria-label="انتخاب شخصیت">
          {view.pool.map((c) => <button key={c} type="button" className={`ct2-pick ${hint?.char === c ? 'ct2-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'pick', char: c })}><CharToken c={c} from="deck" /></button>)}
        </div>
      )}
      {income && (
        <div className="ct2__bar">
          <Button size="sm" disabled={busy} className={hint?.take === 'gold' ? 'ct2-hint' : ''} onClick={() => onAction({ type: 'income', take: 'gold' })}>۲ طلا</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'income', take: 'cards' })}>دو کارت</Button>
        </div>
      )}
      {keep && view.drawn && (
        <div className="ct2__bar">{view.drawn.map((id) => <button key={id} type="button" className="ct2-pick" disabled={busy} onClick={() => onAction({ type: 'keep', card: id })}><DistrictCard id={id} from="deck" exit="deck" /></button>)}</div>
      )}

      {ability && (
        <section className="ct2__ability" aria-label="توانایی">
          <small>توانایی {CHARACTERS[ability.char]}:</small>
          {ability.char === 1 && [2, 3, 4, 5, 6, 7, 8].map((c) => <button key={c} type="button" disabled={busy} onClick={() => onAction({ type: 'kill', char: c })}><Thumb c={c} />کشتن {CHARACTERS[c]}</button>)}
          {ability.char === 2 && [3, 4, 5, 6, 7, 8].filter((c) => c !== view.killed).map((c) => <button key={c} type="button" disabled={busy} onClick={() => onAction({ type: 'rob', char: c })}><Thumb c={c} />دزدی از {CHARACTERS[c]}</button>)}
          {ability.char === 3 && <>
            {others.map((k) => <button key={k} type="button" disabled={busy} onClick={() => onAction({ type: 'swap', target: k })}>عوض کردن دست با <bdi>{who(k)}</bdi></button>)}
            <button type="button" disabled={busy || !redraw.length} onClick={() => onAction({ type: 'redraw', cards: redraw })}>کشیدن دوبارهٔ {fa(redraw.length)} کارت انتخابی</button>
          </>}
          {ability.char === 8 && view.phase === 'act' && others.flatMap((k) => (view.cities[k]!.length >= 8 ? [] : view.cities[k]!.map((id) => (
            <button key={`${k}-${id}`} type="button" disabled={busy || view.gold[me]! < DISTRICTS[id]!.cost - 1} onClick={() => onAction({ type: 'destroy', target: k, card: id })}>تخریب {DISTRICTS[id]!.name} <bdi>{who(k)}</bdi> ({fa(DISTRICTS[id]!.cost - 1)})</button>
          ))))}
          {[4, 5, 6, 7].includes(ability.char) && <span>(خودکار اعمال شده)</span>}
        </section>
      )}

      <ul className="ct2__cities" aria-label="شهرها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.cities.map((_, k) => k)).map((s) => (
          <li key={s} data-flip-anchor={s === me ? 'hand' : `seat-${s}`} className={['ct2-city', s === me ? 'ct2-city--me' : '', view.outcome?.placements[0]?.seat === s ? 'ct2-city--win' : ''].join(' ')}>
            <div className="ct2-city__head">
              {view.crown === s && <img className="ct2-crown" src={crown} alt="تاج" title="تاج" />}
              <bdi className="ct2-city__name">{who(s)}</bdi>
              <Pop n={view.gold[s]!} className="ct2-gold"><img src={coin} alt="" />{fa(view.gold[s]!)} طلا</Pop>
              <Pop n={view.handCount[s]!}>{fa(view.handCount[s]!)} کارت</Pop>
              <Pop n={view.scores[s]!} className="ct2-score">{fa(view.scores[s]!)} امتیاز</Pop>
              <span>{fa(view.cities[s]!.length)}/۸</span>
            </div>
            <div className="ct2-city__row">{view.cities[s]!.map((id) => <DistrictCard key={id} id={id} size="sm" from={s === me ? 'hand' : `seat-${s}`} exit="drop" />)}{!view.cities[s]!.length && <small>هنوز محله‌ای نیست</small>}</div>
          </li>
        ))}
      </ul>

      {view.hand && !view.outcome && (
        <section className="ct2__me" aria-label="دست شما">
          {view.myPicks.length > 0 && <div className="ct2__mine">شخصیت‌های شما: {view.myPicks.map((c) => <CharToken key={c} c={c} from="pool" />)}</div>}
          <div className="ct2__hand" data-flip-anchor="hand">
            {view.hand.map((id) => {
              const selecting = ability?.char === 3;
              return builds.has(id) && !selecting
                ? <button key={id} type="button" className={`ct2-pick ct2-pick--can ${hint?.card === id ? 'ct2-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'build', card: id })} aria-label={`ساختن ${DISTRICTS[id]!.name}`}><DistrictCard id={id} from="deck" exit="deck" /></button>
                : selecting ? <button key={id} type="button" className={`ct2-pick ${redraw.includes(id) ? 'ct2-pick--on' : ''}`} aria-pressed={redraw.includes(id)} onClick={() => setRedraw(redraw.includes(id) ? redraw.filter((x) => x !== id) : [...redraw, id])}><DistrictCard id={id} from="deck" exit="deck" /></button>
                  : <span key={id} className="ct2-pick"><DistrictCard id={id} from="deck" exit="deck" /></span>;
            })}
          </div>
          {canEnd && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'end' ? 'ct2-hint' : ''} onClick={() => onAction({ type: 'end' })}>پایان نوبت</Button>}
        </section>
      )}
    </div>
  );
}

/** The view as it will look after the own queued pick / keep / build (only facts the client already holds). */
function preview(v: CitadelsView, me: number, q: { type: string; char?: number; card?: number } | null | undefined): CitadelsView {
  if (!q || me < 0 || !v.hand) return v;
  if (q.type === 'pick' && q.char !== undefined && v.pool?.includes(q.char)) return { ...v, pool: v.pool.filter((c) => c !== q.char), myPicks: [...v.myPicks, q.char] };
  if (q.type === 'keep' && q.card !== undefined && v.drawn?.includes(q.card)) return { ...v, drawn: null, hand: [...v.hand, q.card], handCount: v.handCount.map((n, k) => (k === me ? n + 1 : n)) };
  if (q.type === 'build' && q.card !== undefined && v.hand.includes(q.card)) {
    const at = <T,>(xs: T[], f: (x: T) => T) => xs.map((x, k) => (k === me ? f(x) : x));
    return { ...v, hand: v.hand.filter((x) => x !== q.card), handCount: at(v.handCount, (n) => n - 1), gold: at(v.gold, (g) => g - DISTRICTS[q.card!]!.cost), cities: at(v.cities, (c) => [...c, q.card!]) };
  }
  return v;
}

// A number that bumps whenever it changes.
function Pop({ n, className = '', children }: { n: number; className?: string; children: React.ReactNode }) {
  return <span key={n} className={`${className} ${usePop(n)}`}>{children}</span>;
}
