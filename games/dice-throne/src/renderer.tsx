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

function Banner({ view, seat, label, active }: { view: DtView; seat: number; label: string; active: boolean }) {
  const f = view.fighters[seat]!;
  const hero = f.hero !== null ? HEROES[f.hero]! : null;
  // Shake the banner when health dropped (stamp = seq of the drop, used as the retrigger key).
  const hit = useRef({ hp: f.hp, at: 0 });
  if (f.hp < hit.current.hp) hit.current.at = view.seq;
  hit.current.hp = f.hp;
  const cpPop = usePop(f.cp), hpPop = usePop(f.hp);
  return (
    <section key={hit.current.at} className={`${hit.current.at ? 'bg-hit ' : ''}dt-banner ${hero ? `dt-h--${hero.key}` : ''} ${active ? 'dt-banner--now' : ''}`} aria-label={`${label}${hero ? `، ${hero.name}` : ''}`}>
      <div className="dt-banner__top">
        {hero && <img className="dt-portrait" src={PORTRAIT[hero.key]} alt="" aria-hidden="true" />}
        <bdi className="dt-banner__name">{label}</bdi>
        {hero && <span className="dt-banner__hero">{hero.name}</span>}
        <span className={`dt-cp ${cpPop}`} key={f.cp} title="امتیاز رزم">{fa(f.cp)} CP</span>
      </div>
      <div className="dt-hp" role="meter" aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={Math.max(0, f.hp)} aria-label="جان">
        <span className="dt-hp__fill" style={{ inlineSize: `${Math.max(0, f.hp) / MAX_HP * 100}%` }} />
        <b className={`dt-hp__n ${hpPop}`} key={f.hp}>{fa(Math.max(0, f.hp))}</b>
      </div>
      <div className="dt-status">
        {f.wound > 0 && <span className="dt-badge dt-badge--wound">زخم ×{fa(f.wound)}</span>}
        {f.stun && <span className="dt-badge dt-badge--stun">گیج</span>}
        {f.shield && <span className="dt-badge dt-badge--shield">سپر</span>}
      </div>
    </section>
  );
}

type Hint = { type: string; keep?: boolean[]; ability?: number; hero?: number } | null;

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

  return (
    <div className="dt" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <Banner view={view} seat={opp} label={who(opp)} active={view.current === opp && !view.outcome} />

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
          <ul className="dt-abilities" aria-label={`توانایی‌های ${atkHero.name}`}>
            {atkHero.abilities.map((a, i) => {
              const e = abilityEffect(atkHero, a, view.dice);
              const can = attacks.has(i);
              return (
                <li key={i}>
                  <button type="button" disabled={busy || !can} onClick={() => onAction({ type: 'attack', ability: i })}
                    className={['dt-ab', e && view.rolled ? 'dt-ab--met' : '', can ? 'dt-ab--can' : '', i === 4 ? 'dt-ab--ult' : '', hint?.type === 'attack' && hint.ability === i ? 'dt-hint' : ''].join(' ')}>
                    <b>{a.name}</b><span className="dt-ab__need">{needText(atkHero, a)}</span>
                    <small>{a.tiers.map(effText).join(' | ')}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Banner view={view} seat={me} label={who(me)} active={view.current === me && !view.outcome} />
      {view.log.length > 0 && <ol className="dt-log" aria-label="رویدادها">{view.log.slice(-3).map((l, i) => <li key={`${view.seq}-${i}`}><bdi>{who(l.seat)}</bdi>: {l.text}</li>)}</ol>}
    </div>
  );
}
