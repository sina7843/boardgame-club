// نبرد تاس renderer: an arena. Two hero banners face off with health bars, combat-point gems and status badges;
// the dice tray shows each die as the hero's symbol (tap to keep); the ability board lists every combo with its
// effect and lights up the ones your dice make. The defender gets a single «دفاع» roll.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, useFlip, usePop, type GameRendererProps } from '@bg/ui';
import warrior from './art/hero-warrior.webp';
import shadow from './art/hero-shadow.webp';
import pyro from './art/hero-pyro.webp';
import paladin from './art/hero-paladin.webp';
import { HEROES, MAX_HP, abilityEffect, symOf, type Ability, type DtView, type Effect, type Hero } from './rules.ts';

// Hero portraits are cut from a generated sprite sheet (see DECISIONS.md).
export const PORTRAIT: Record<string, string> = { warrior, shadow, pyro, paladin };
const fa = (n: number) => n.toLocaleString('fa-IR');
export const effText = (e: Effect) => [e.dmg ? `${fa(e.dmg)} آسیب` : '', e.heal ? `+${fa(e.heal)} جان` : '', e.cp ? `+${fa(e.cp)} CP` : '', e.steal ? `دزدی ${fa(e.steal)} CP` : '',
  e.wound ? `زخم ${fa(e.wound)}` : '', e.stun ? 'گیجی' : '', e.shield ? 'سپر' : '', e.undefendable ? 'دفاع‌ناپذیر' : ''].filter(Boolean).join('، ');
const needText = (h: Hero, a: Ability) => (a.need.sym ? `${a.need.counts!.map(fa).join('/')}× ${h.symFa[a.need.sym]}` : a.need.combo ? Object.entries(a.need.combo).map(([s, c]) => `${fa(c)}× ${h.symFa[s]}`).join(' + ') : a.need.straight === 5 ? 'ردیف بلند (۵)' : 'ردیف کوتاه (۴)');

export function DieFace({ hero, n, kept, rolling, tumble }: { hero: Hero; n: number; kept?: boolean; rolling?: boolean; tumble?: boolean }) {
  const sym = symOf(hero, n);
  // tumble: the server has not rolled yet — the faces are hidden (bg-tumble hides [data-pip]) and not announced.
  return (
    <span className={`dt-die dt-h--${hero.key} ${kept ? 'is-kept' : ''} ${rolling ? 'bg-roll' : ''} ${tumble ? 'bg-tumble' : ''}`} aria-label={tumble ? 'در حال ریختن' : `تاس ${fa(n)}: ${hero.symFa[sym]}`}>
      <b data-pip>{hero.symFa[sym]}</b><small data-pip>{fa(n)}</small>
    </span>
  );
}

type Hint = { type: string; keep?: boolean[]; ability?: number; hero?: number } | null;

const wideScreen = () => (typeof matchMedia === 'function' ? matchMedia('(min-width: 720px)').matches : true);
const STATUS = [
  { key: 'wound', icon: '🩸', fa: 'زخم' },
  { key: 'stun', icon: '💫', fa: 'گیجی' },
  { key: 'shield', icon: '🛡', fa: 'سپر' }
] as const;

/** A round dial like the printed HP / CP wheels: a ring filled to value/max with the number in the window. */
function Dial({ value, max, label, kind }: { value: number; max: number; label: string; kind: 'hp' | 'cp' }) {
  const v = Math.max(0, value), pop = usePop(v);
  const C = 2 * Math.PI * 42;
  return (
    <div className={`dt-dial dt-dial--${kind}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="dt-dial__track" />
        <circle cx="50" cy="50" r="42" className="dt-dial__fill" strokeDasharray={`${(Math.min(v, max) / max) * C} ${C}`} transform="rotate(-90 50 50)" />
        {Array.from({ length: max }, (_, i) => {
          const a = (i / max) * 2 * Math.PI - Math.PI / 2, r = i % 5 ? 46 : 44;
          return <line key={i} x1={50 + Math.cos(a) * 49} y1={50 + Math.sin(a) * 49} x2={50 + Math.cos(a) * r} y2={50 + Math.sin(a) * r} className="dt-dial__tick" />;
        })}
      </svg>
      <b className={`dt-dial__n ${pop}`} key={v}>{fa(v)}</b>
      <small className="dt-dial__label">{kind === 'hp' ? '♥ جان' : '◆ CP'}</small>
    </div>
  );
}

const needChips = (h: Hero, a: Ability): string[] => (a.need.sym ? Array.from({ length: a.need.counts![0]! }, () => h.symFa[a.need.sym!]!)
  : a.need.combo ? Object.entries(a.need.combo).flatMap(([s, c]) => Array.from({ length: c }, () => h.symFa[s]!))
    : Array.from({ length: a.need.straight! }, (_, i) => fa(i + 1)));

interface AbCtx { attacks: Set<number>; busy: boolean; hint: Hint; onAction: GameRendererProps<DtView>['onAction']; view: DtView }

/** The hero board as printed: portrait and defence box, the ability table (combos, tiers, ultimate) and the HP / CP
 *  dials with status token slots. Opponents get the same board, compact and (on phones) folded. */
function HeroBoard({ seat, label, active, mine, ctx }: { seat: number; label: string; active: boolean; mine: boolean; ctx: AbCtx }) {
  const { view } = ctx;
  const f = view.fighters[seat]!;
  const hero = f.hero !== null ? HEROES[f.hero]! : null;
  // Shake the plate when health dropped (stamp = seq of the drop, used as the retrigger key).
  const hit = useRef({ hp: f.hp, at: 0 });
  if (f.hp < hit.current.hp) hit.current.at = view.seq;
  hit.current.hp = f.hp;
  const [open] = useState(wideScreen);
  // The attacker's combos light up on their own board as the dice make them.
  const attacking = view.current === seat && view.phase !== 'pick' && view.rolled;
  const plate = (
    <div key={hit.current.at} className={`${hit.current.at ? 'bg-hit ' : ''}dt-board__plate`}>
      <div className="dt-board__id">
        {hero && <img className="dt-portrait" src={PORTRAIT[hero.key]} alt="" aria-hidden="true" />}
        <bdi className="dt-banner__name">{label}</bdi>
        {hero ? <span className="dt-banner__hero">{hero.name}</span> : <small>بدون قهرمان</small>}
        {hero && (
          <div className="dt-defense" aria-label="توانایی دفاع">
            <b>🛡 دفاع · {fa(hero.defense.dice)} تاس</b>
            {Object.entries(hero.defense.per).filter(([, e]) => effText(e)).map(([s, e]) => <span key={s}><i aria-hidden="true">{hero.symFa[s]}</i> {effText(e)}</span>)}
          </div>
        )}
      </div>
      {hero && (
        <ul className="dt-abilities" aria-label={`توانایی‌های ${hero.name}`}>
          {hero.abilities.map((a, i) => {
            const met = attacking && !!abilityEffect(hero, a, view.dice);
            const can = mine && ctx.attacks.has(i);
            const cls = ['dt-ab', met ? 'dt-ab--met' : '', can ? 'dt-ab--can' : '', i === 4 ? 'dt-ab--ult' : '', mine && ctx.hint?.type === 'attack' && ctx.hint.ability === i ? 'dt-hint' : ''].join(' ');
            const body = (
              <>
                <b>{i === 4 && <span aria-hidden="true">★ </span>}{a.name}</b>
                <span className="dt-ab__chips" aria-hidden="true">{needChips(hero, a).map((c, k) => <i key={k}>{c}</i>)}</span>
                <span className="dt-ab__need">{needText(hero, a)}</span>
                <small>{a.tiers.map(effText).join(' | ')}</small>
                {met && <span className="dt-ab__ok">✓ جور است</span>}
              </>
            );
            return (
              <li key={i}>
                {mine ? <button type="button" disabled={ctx.busy || !can} onClick={() => ctx.onAction({ type: 'attack', ability: i })} className={cls}>{body}</button>
                  : <span className={cls}>{body}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="dt-board__dials">
        <Dial value={f.hp} max={MAX_HP} label="جان" kind="hp" />
        <Dial value={f.cp} max={15} label="امتیاز رزم" kind="cp" />
        <div className="dt-status" aria-label="نشانه‌های وضعیت">
          {STATUS.map((t) => {
            const n = t.key === 'wound' ? f.wound : f[t.key] ? 1 : 0;
            return (
              <span key={t.key} className={`dt-token dt-token--${t.key} ${n ? 'is-on' : ''}`} aria-label={`${t.fa}: ${n ? (t.key === 'wound' ? fa(n) : 'دارد') : 'ندارد'}`}>
                <i aria-hidden="true">{t.icon}</i><small>{t.fa}</small>{t.key === 'wound' && n > 0 && <b>×{fa(n)}</b>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
  return (
    <section className={`dt-banner dt-board ${mine ? 'dt-board--mine' : 'dt-board--opp'} ${hero ? `dt-h--${hero.key}` : ''} ${active ? 'dt-banner--now' : ''}`} aria-label={`صفحهٔ ${label}${hero ? `، ${hero.name}` : ''}`}>
      {mine ? plate : (
        <details className="dt-fold" open={open}>
          <summary>
            <bdi>{label}</bdi>{hero && <span className="dt-banner__hero">{hero.name}</span>}
            <span className="dt-glance">♥ {fa(Math.max(0, f.hp))} · ◆ {fa(f.cp)} CP{f.wound ? ` · 🩸${fa(f.wound)}` : ''}{f.stun ? ' · 💫' : ''}{f.shield ? ' · 🛡' : ''}</span>
          </summary>
          {plate}
        </details>
      )}
    </section>
  );
}

export default function DiceThroneRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<DtView>) {
  const me = mySeat ?? 0;
  // My roll / defence waiting in the undo window or for the server: those dice tumble with no face until the result.
  type Sent = { type: string; keep?: boolean[] };
  const sent = useRef<Sent | null>(null);
  if (queued) sent.current = queued as Sent;
  const pending = queued ? (queued as Sent) : busy ? sent.current : null;
  const rolling = pending?.type === 'roll' ? pending.keep ?? [] : null;
  const defending = pending?.type === 'defend';
  // A die is thrown again on every roll that rerolled it: a face change, or a die my own last roll did not keep.
  // The stamp (seq of that roll) is its key, so the remounted .bg-roll element is thrown on the top layer.
  const dieMem = useRef<{ dice: number[]; at: number[]; seq: number }>({ dice: [], at: [], seq: -1 });
  if (dieMem.current.seq !== view.seq) {
    const m = dieMem.current;
    const mine = m.seq >= 0 && sent.current?.type === 'roll' ? sent.current.keep : undefined;
    const at = view.dice.map((d, i) => (m.dice[i] === d && !(mine && !mine[i]) ? m.at[i] ?? 0 : m.seq < 0 ? 0 : view.seq));
    dieMem.current = { dice: view.dice, at, seq: view.seq };
  }
  if (!busy && !queued) sent.current = null;
  const dieAt = dieMem.current.at;
  const defSig = view.defenseDice.join();
  const defMem = useRef({ sig: defSig, at: 0 });
  if (defMem.current.sig !== defSig) defMem.current = { sig: defSig, at: view.seq };
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.seq}|${pending ? JSON.stringify(pending) : ''}`);
  const opp = 1 - me;
  const hint = expected as unknown as Hint;
  const [keep, setKeep] = useState([false, false, false, false, false]);
  useEffect(() => { setKeep([false, false, false, false, false]); }, [view.turn]);
  useEffect(() => { if (hint?.type === 'roll' && hint.keep) setKeep(hint.keep); }, [hint?.type, hint?.keep?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const roll = legalActions.find((a) => a.type === 'roll') as { extra: boolean } | undefined;
  const attacks = new Set(legalActions.filter((a) => a.type === 'attack').map((a) => a.ability as number));
  const picks = legalActions.filter((a) => a.type === 'pickHero').map((a) => a.hero as number);
  const canDefend = legalActions.some((a) => a.type === 'defend');
  const canPass = legalActions.some((a) => a.type === 'pass');
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const attacker = view.fighters[view.current]!;
  const atkHero = attacker.hero !== null ? HEROES[attacker.hero]! : null;
  const defHero = view.fighters[1 - view.current]!.hero !== null ? HEROES[view.fighters[1 - view.current]!.hero!]! : null;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : picks.length ? { tone: 'mine' as const, text: 'قهرمانتان را انتخاب کنید' }
      : canDefend ? { tone: 'mine' as const, text: `${atkHero?.abilities[view.pending!.ability]!.name}: دفاع کنید` }
        : view.phase === 'offense' && view.current === me ? { tone: 'mine' as const, text: view.rolled ? 'تاس نگه دارید و دوباره بریزید یا حمله کنید' : 'تاس‌ها را بریزید' }
          : { tone: 'wait' as const, text: view.phase === 'pick' ? `${seatName(view.current)} قهرمان انتخاب می‌کند` : view.phase === 'defense' ? `${seatName(1 - view.current)} دفاع می‌کند` : `نوبت ${seatName(view.current)}` };

  const ctx: AbCtx = { attacks, busy, hint, onAction, view };

  return (
    <div className="dt" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <HeroBoard seat={opp} label={who(opp)} active={view.current === opp && !view.outcome} mine={false} ctx={ctx} />

      {view.phase === 'pick' ? (
        <section className="dt-heroes" aria-label="قهرمان‌ها">
          {HEROES.map((h, i) => {
            const can = picks.includes(i);
            const taken = view.fighters.some((f) => f.hero === i) || (queued?.type === 'pickHero' && queued.hero === i);
            return (
              <button key={h.key} type="button" disabled={busy || !can} onClick={() => onAction({ type: 'pickHero', hero: i })} className={`dt-hero dt-h--${h.key} ${taken ? 'is-taken' : ''}`}>
                <img className="dt-portrait dt-portrait--lg" src={PORTRAIT[h.key]} alt="" aria-hidden="true" />
                <b>{h.name}</b>
                <span className="dt-hero__faces">{[...new Set(h.faces)].map((s) => h.symFa[s]).join(' ')}</span>
                <small>{h.abilities.map((a) => a.name).join('، ')}</small>
              </button>
            );
          })}
        </section>
      ) : atkHero && (
        <section className="dt-tray" aria-label="تاس‌ها">
          <div className="dt-dice">
            {view.dice.map((d, i) => {
              const mine = view.current === me && view.phase === 'offense' && view.rolled && !busy && !rolling;
              if (rolling && !rolling[i]) return <span key={`t${i}`} className="dt-dslot" style={{ ['--i' as string]: i }}><DieFace hero={atkHero} n={d} tumble /></span>;
              return (
                <span key={`${i}-${dieAt[i]}`} className={`dt-dslot ${dieAt[i] ? 'bg-roll' : ''}`} style={{ ['--i' as string]: i }}>
                  {mine
                    ? <button type="button" className="dt-dbtn" aria-pressed={keep[i]} onClick={() => setKeep(keep.map((k, j) => (j === i ? !k : k)))}><DieFace hero={atkHero} n={d} kept={keep[i]} /></button>
                    : <DieFace hero={atkHero} n={d} />}
                </span>
              );
            })}
          </div>
          {view.phase === 'offense' && <small className="dt-rolls">{view.rolled ? `${fa(view.rollsLeft)} ریختن مانده` : 'هنوز نریخته'}</small>}
          {defending && defHero ? (
            <div className="dt-defdice"><small>دفاع:</small>{Array.from({ length: defHero.defense.dice }, (_, i) => <DieFace key={`t${i}`} hero={defHero} n={1} tumble />)}</div>
          ) : view.defenseDice.length > 0 && defHero && view.phase !== 'defense' && (
            <div className="dt-defdice"><small>دفاع:</small>{view.defenseDice.map((d, i) => (
              <span key={`${i}-${defMem.current.at}`} className="dt-dslot bg-roll" style={{ ['--i' as string]: i }}><DieFace hero={defHero} n={d} /></span>
            ))}</div>
          )}
          <div className="dt-bar">
            {roll && <Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'dt-hint' : ''} onClick={() => onAction({ type: 'roll', keep: view.rolled ? keep : [false, false, false, false, false] })}>{roll.extra ? 'ریختن اضافه (۲ CP)' : view.rolled ? 'ریختن دوباره' : 'ریختن تاس‌ها'}</Button>}
            {canPass && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>بدون حمله</Button>}
            {canDefend && <Button size="sm" disabled={busy} className="dt-defend" onClick={() => onAction({ type: 'defend' })}>دفاع ({fa(defHero?.defense.dice ?? 0)} تاس)</Button>}
          </div>
        </section>
      )}

      <HeroBoard seat={me} label={who(me)} active={view.current === me && !view.outcome} mine ctx={ctx} />
      {view.log.length > 0 && <ol className="dt-log" aria-label="رویدادها">{view.log.slice(-3).map((l, i) => <li key={`${view.seq}-${i}`}><bdi>{who(l.seat)}</bdi>: {l.text}</li>)}</ol>}
    </div>
  );
}
