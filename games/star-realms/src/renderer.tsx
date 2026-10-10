// نبرد ستاره‌ها renderer: a starfield bridge. Cards have faction-coloured frames (federation blue, blob green, cult
// red, empire gold), their effects as small icon rows (primary, ally ⟡, scrap ♻). Opponent and your own authority sit
// at either end; the trade row runs through the middle; played ships and bases form your fleet line.
import './renderer.css';
import { useRef } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import fed from './art/fac-fed.webp';
import blob from './art/fac-blob.webp';
import cult from './art/fac-cult.webp';
import emp from './art/fac-emp.webp';
import { TYPE, type Faction, type Fx, type SrView } from './rules.ts';

// Faction emblems are cut from a generated sprite sheet (see DECISIONS.md); 'none' keeps the plain glyph.
const EMBLEM: Partial<Record<Faction, string>> = { fed, blob, cult, emp };

const fa = (n: number) => n.toLocaleString('fa-IR');
const FACTION_FA = { fed: 'فدراسیون', blob: 'هیولاها', cult: 'ماشین‌پرستان', emp: 'امپراتوری', none: '' } as const;

export function fxText(fx: Fx | undefined) {
  if (!fx) return '';
  return [fx.trade ? `◈${fa(fx.trade)}` : '', fx.combat ? `✸${fa(fx.combat)}` : '', fx.authority ? `♥${fa(fx.authority)}` : '', fx.draw ? `+${fa(fx.draw)} کارت` : '',
    fx.scrap ? `اسقاط ${fa(fx.scrap)}` : '', fx.scrapRow ? 'پاک‌سازی بازار' : '', fx.oppDiscard ? 'حریف −۱ کارت' : ''].filter(Boolean).join(' ');
}

export function SrCard({ k, size = 'md' }: { k: string; size?: 'sm' | 'md' }) {
  const t = TYPE[k]!;
  return (
    <span className={`sr-card sr-card--${size} sr-f--${t.faction} ${t.base ? 'sr-card--base' : ''}`} aria-label={`${t.name}${t.base ? `، پایگاه ${fa(t.base.defense)}${t.base.outpost ? ' (پاسگاه)' : ''}` : ''}: ${fxText(t.fx)}`}>
      {EMBLEM[t.faction] && <img className="sr-card__emb" src={EMBLEM[t.faction]} alt="" aria-hidden="true" />}
      {t.cost > 0 && <b className="sr-card__cost">{fa(t.cost)}</b>}
      <span className="sr-card__name">{t.name}</span>
      <span className="sr-card__fx">{fxText(t.fx)}</span>
      {size === 'md' && t.ally && <span className="sr-card__ally">⟡ {fxText(t.ally)}</span>}
      {size === 'md' && t.scrapSelf && <span className="sr-card__scrap">♻ {fxText(t.scrapSelf)}</span>}
      {t.base && <i className={`sr-card__def ${t.base.outpost ? 'is-outpost' : ''}`}>{fa(t.base.defense)}</i>}
    </span>
  );
}

type Hint = { type: string; index?: number; base?: number } | null;
type Queued = { type: string; index?: number; slot?: number; base?: number; card?: number; from?: string };

/** A counter that pops only when it changed (and shakes when authority dropped). */
function Num({ n, hit, className = '' }: { n: number; hit?: boolean; className?: string }) {
  const last = useRef({ n, down: false });
  if (last.current.n !== n) last.current = { n, down: n < last.current.n };
  const pop = usePop(n);
  return <b key={n} className={`${className} ${hit && last.current.down ? 'bg-hit' : pop}`}>{fa(Math.max(0, n))}</b>;
}

/**
 * My queued move shown at once with what I already know: a played card moves to the fleet, a bought card to my
 * header chip (its slot stays empty — the replacement is a hidden draw), an end of turn clears hand and fleet to the
 * discard (the new hand is drawn by the server), an attack lowers authority or removes the base, scraps leave.
 */
function preview(v: SrView, q: Queued | null | undefined, me: number): { view: SrView; bought: number | null } {
  if (!q || !v.hand) return { view: v, bought: null };
  const hand = v.hand;
  switch (q.type) {
    case 'play': return { view: { ...v, hand: hand.filter((_, i) => i !== q.index), inPlay: [...v.inPlay, hand[q.index!]!] }, bought: null };
    case 'playAll': return { view: { ...v, hand: [], inPlay: [...v.inPlay, ...hand] }, bought: null };
    case 'buy': {
      const id = q.slot !== undefined && q.slot < 5 ? v.row[q.slot] : null;
      return id === null || id === undefined ? { view: v, bought: null } : { view: { ...v, row: v.row.map((x, i) => (i === q.slot ? null : x)) }, bought: id };
    }
    case 'endTurn': return { view: { ...v, hand: [], inPlay: [] }, bought: null };
    case 'discard': case 'scrapCard': return q.from === 'discard' ? { view: v, bought: null } : { view: { ...v, hand: hand.filter((_, i) => i !== q.index) }, bought: null };
    case 'scrapSelf': return { view: { ...v, inPlay: v.inPlay.filter((x) => x !== q.card), sides: v.sides.map((sd) => ({ ...sd, bases: sd.bases.filter((x) => x !== q.card) })) }, bought: null };
    case 'attack': return {
      view: { ...v, sides: v.sides.map((sd, s) => (s === me ? sd : q.base === -1 ? { ...sd, authority: sd.authority - v.pool.combat } : { ...sd, bases: sd.bases.filter((x) => x !== q.base) })) },
      bought: null
    };
    default: return { view: v, bought: null };
  }
}

export default function StarRealmsRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SrView>) {
  const me = mySeat ?? 0;
  const q = queued as Queued | null | undefined;
  const { view, bought } = preview(served, q, me);
  // Cards glide: market → buyer's header chip, trade deck → market, hand → fleet/bases, opponent's plays from their
  // side, the draw pile → hand; cards that go to a discard pile fly there, scrapped market cards drop.
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${q ? JSON.stringify(q) : ''}`);
  const opp = 1 - me;
  const hint = expected as unknown as Hint;
  const has = (t: string) => legalActions.some((a) => a.type === t);
  const attackable = new Set(legalActions.filter((a) => a.type === 'attack').map((a) => a.base as number));
  const buyable = new Set(legalActions.filter((a) => a.type === 'buy').map((a) => a.slot as number));
  const scrapSelf = new Set(legalActions.filter((a) => a.type === 'scrapSelf').map((a) => a.card as number));
  const discarding = has('discard');
  const myTurn = view.current === me && !view.outcome;
  const k = (id: number) => view.cards[id]!;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const mine = view.sides[me]!;
  const theirs = view.sides[opp]!;
  // The card a side just bought (or lost to a destroyed base) lands in a chip in its header: it is the visible discard.
  const chip = (seat: number) => {
    if (seat === me && bought !== null) return <span className="sr-chip" data-flip={`c${bought}`} data-flip-exit={`discard-${seat}`}>{TYPE[k(bought)]!.name}</span>;
    const l = view.last;
    if (!l || l.card === undefined) return null;
    const got = l.kind === 'buy' ? l.seat === seat : l.kind === 'destroy' ? l.seat !== seat : false;
    if (!got) return null;
    const t = TYPE[k(l.card)]!;
    return <span className="sr-chip" data-flip={`c${l.card}`} data-flip-from={t.key === 'explorer' ? 'explorer' : undefined} data-flip-exit={`discard-${seat}`}>{t.name}</span>;
  };

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : discarding ? { tone: 'mine' as const, text: 'حریف شما را مجبور کرده یک کارت دور بریزید' }
      : myTurn ? { tone: 'mine' as const, text: view.hand?.length ? 'کارت‌ها را بازی کنید، بخرید و حمله کنید' : 'بخرید، حمله کنید یا نوبت را تمام کنید' }
        : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  const Bases = ({ seat }: { seat: number }) => (
    <div className="sr-bases">
      {view.sides[seat]!.bases.map((b) => {
        const atk = seat === opp && attackable.has(b);
        const scrap = seat === me && scrapSelf.has(b);
        return (
          <span key={b} className="sr-slot" data-flip={`c${b}`} data-flip-from={`seat-${seat}`} data-flip-exit={`discard-${seat}`}>
            {atk ? <button type="button" className={`sr-pick sr-pick--atk ${hint?.type === 'attack' && hint.base === b ? 'sr-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'attack', base: b })} aria-label={`نابود کردن ${TYPE[k(b)]!.name}`}><SrCard k={k(b)} /></button> : <SrCard k={k(b)} />}
            {scrap && <button type="button" className="sr-mini" disabled={busy} onClick={() => onAction({ type: 'scrapSelf', card: b })}>♻ اسقاط</button>}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="sr" ref={root} data-seq={view.seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <section data-flip-anchor={`seat-${opp}`} className={`sr-side sr-side--opp ${view.current === opp && !view.outcome ? 'sr-side--now' : ''}`} aria-label={`ناوگان ${who(opp)}`}>
        <div className="sr-side__head">
          <bdi className="sr-side__name">{who(opp)}</bdi>
          <Num n={theirs.authority} hit className="sr-auth" />
          <small>دسته <Num n={theirs.deck} /> · دست <Num n={theirs.hand} /> · <span data-flip-anchor={`discard-${opp}`}>دورریز <Num n={theirs.discard} /></span></small>
          {chip(opp)}
          {attackable.has(-1) && <Button size="sm" disabled={busy} className={hint?.type === 'attack' && hint.base === -1 ? 'sr-hint' : ''} onClick={() => onAction({ type: 'attack', base: -1 })}>حمله ({fa(view.pool.combat)})</Button>}
        </div>
        {theirs.bases.length > 0 && <Bases seat={opp} />}
      </section>

      <section className="sr-row" aria-label="ردیف بازار">
        {view.row.map((id, slot) => {
          if (id === null) return <span key={slot} className="sr-empty" />;
          const can = buyable.has(slot);
          return (
            <span key={`${slot}-${id}`} className="sr-slot sr-slot--row">
              <button type="button" data-flip={`c${id}`} data-flip-from="trade-deck" data-flip-exit="drop" className={`sr-pick ${can ? 'sr-pick--can' : ''}`} disabled={busy || !can} onClick={() => onAction({ type: 'buy', slot })}><SrCard k={k(id)} /></button>
              {view.pool.scrapRow > 0 && myTurn && <button type="button" className="sr-mini" disabled={busy} onClick={() => onAction({ type: 'scrapRow', slot })}>♻ پاک کردن</button>}
            </span>
          );
        })}
        <span className="sr-slot sr-slot--row">
          <button type="button" data-flip-anchor="explorer" className={`sr-pick ${buyable.has(5) ? 'sr-pick--can' : ''}`} disabled={busy || !buyable.has(5)} onClick={() => onAction({ type: 'buy', slot: 5 })}><SrCard k="explorer" /></button>
          <small className="sr-deckcount" data-flip-anchor="trade-deck">بازار <Num n={view.tradeDeckCount} /></small>
        </span>
      </section>

      {myTurn && (
        <div className="sr-pool">
          <span className="sr-pool__trade">◈ <Num n={view.pool.trade} /> تجارت</span>
          <span className="sr-pool__combat">✸ <Num n={view.pool.combat} /> حمله</span>
        </div>
      )}

      {view.inPlay.length > 0 && (
        <div className="sr-fleet" aria-label="ناوهای بازی‌شده">
          {view.inPlay.map((id) => (
            <span key={id} className="sr-slot sr-slot--play" data-flip={`c${id}`} data-flip-from={`seat-${view.current}`} data-flip-exit={`discard-${view.current}`}>
              <SrCard k={k(id)} size="sm" />
              {myTurn && scrapSelf.has(id) && <button type="button" className="sr-mini" disabled={busy} onClick={() => onAction({ type: 'scrapSelf', card: id })}>♻ {fxText(TYPE[k(id)]!.scrapSelf)}</button>}
            </span>
          ))}
        </div>
      )}

      {myTurn && view.pool.scrap > 0 && view.hand && (
        <div className="sr-scrap" role="group" aria-label="اسقاط کارت">
          <small>اسقاط یک کارت ({fa(view.pool.scrap)}):</small>
          {view.hand.map((id, index) => <button key={`h${id}`} type="button" className="sr-mini" disabled={busy} onClick={() => onAction({ type: 'scrapCard', from: 'hand', index })}>{TYPE[k(id)]!.name} (دست)</button>)}
          {legalActions.filter((a) => a.type === 'scrapCard' && a.from === 'discard').length > 0 && <small>یا از دورریز ({fa(mine.discard)} کارت):</small>}
          {legalActions.filter((a) => a.type === 'scrapCard' && a.from === 'discard').slice(0, 1).map((a) => <button key="d" type="button" className="sr-mini" disabled={busy} onClick={() => onAction({ type: 'scrapCard', from: 'discard', index: a.index as number })}>کارت رویی دورریز{mine.top !== null ? ` (${TYPE[k(mine.top)]!.name})` : ''}</button>)}
        </div>
      )}

      <section data-flip-anchor={`seat-${me}`} className={`sr-side sr-side--me ${myTurn ? 'sr-side--now' : ''}`} aria-label="ناوگان شما">
        {mine.bases.length > 0 && <Bases seat={me} />}
        <div className="sr-side__head">
          <bdi className="sr-side__name">{who(me)}</bdi>
          <Num n={mine.authority} hit className="sr-auth sr-auth--me" />
          <small><span data-flip-anchor={`deck-${me}`}>دسته <Num n={mine.deck} /></span> · <span data-flip-anchor={`discard-${me}`}>دورریز <Num n={mine.discard} /></span></small>
          {chip(me)}
        </div>
        {view.hand && !view.outcome && (
          <div className="sr-hand">
            {view.hand.map((id, index) => (
              <button key={id} type="button" data-flip={`c${id}`} data-flip-from={`deck-${me}`} data-flip-exit={`discard-${me}`} disabled={busy || !myTurn} onClick={() => onAction(discarding ? { type: 'discard', index } : { type: 'play', index })}
                className={['sr-pick', myTurn ? 'sr-pick--can' : '', discarding ? 'sr-pick--drop' : '', hint?.type === 'play' && hint.index === index ? 'sr-hint' : ''].join(' ')}
                aria-label={`${discarding ? 'دور ریختن' : 'بازی'} ${TYPE[k(id)]!.name}`}><SrCard k={k(id)} /></button>
            ))}
          </div>
        )}
        {myTurn && !discarding && (
          <div className="sr-bar">
            {has('playAll') && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'playAll' ? 'sr-hint' : ''} onClick={() => onAction({ type: 'playAll' })}>بازی همه</Button>}
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'endTurn' })}>پایان نوبت</Button>
          </div>
        )}
      </section>
      {view.last && (
        <p className="sr-last" key={view.seq}><bdi>{who(view.last.seat)}</bdi>: {view.last.kind === 'hit' ? `${fa(view.last.amount!)} ضربه` : view.last.kind === 'destroy' ? `نابودی ${TYPE[k(view.last.card!)]!.name}` : view.last.kind === 'buy' ? `خرید ${TYPE[k(view.last.card!)]!.name}` : view.last.kind === 'play' ? `بازی ${TYPE[k(view.last.card!)]!.name}` : view.last.kind === 'scrapSelf' ? `اسقاط ${TYPE[k(view.last.card!)]!.name}` : view.last.kind === 'end' ? 'پایان نوبت' : 'بازی همه'}{view.last.kind === 'buy' && TYPE[k(view.last.card!)]!.faction !== 'none' ? ` (${FACTION_FA[TYPE[k(view.last.card!)]!.faction]})` : ''}</p>
      )}
    </div>
  );
}
