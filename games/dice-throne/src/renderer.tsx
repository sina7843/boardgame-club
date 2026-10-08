// نبرد تاس renderer: an arena. Two hero banners face off with health bars, combat-point gems and status badges;
// the dice tray shows each die as the hero's symbol (tap to keep); the ability board lists every combo with its
// effect and lights up the ones your dice make. The defender gets a single «دفاع» roll.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { HEROES, MAX_HP, abilityEffect, symOf, type Ability, type DtView, type Effect, type Hero } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const effText = (e: Effect) => [e.dmg ? `${fa(e.dmg)} آسیب` : '', e.heal ? `+${fa(e.heal)} جان` : '', e.cp ? `+${fa(e.cp)} CP` : '', e.steal ? `دزدی ${fa(e.steal)} CP` : '',
  e.wound ? `زخم ${fa(e.wound)}` : '', e.stun ? 'گیجی' : '', e.shield ? 'سپر' : '', e.undefendable ? 'دفاع‌ناپذیر' : ''].filter(Boolean).join('، ');
const needText = (h: Hero, a: Ability) => (a.need.sym ? `${a.need.counts!.map(fa).join('/')}× ${h.symFa[a.need.sym]}` : a.need.combo ? Object.entries(a.need.combo).map(([s, c]) => `${fa(c)}× ${h.symFa[s]}`).join(' + ') : a.need.straight === 5 ? 'ردیف بلند (۵)' : 'ردیف کوتاه (۴)');

export function DieFace({ hero, n, kept, rolling }: { hero: Hero; n: number; kept?: boolean; rolling?: boolean }) {
  const sym = symOf(hero, n);
  return (
    <span className={`dt-die dt-h--${hero.key} ${kept ? 'is-kept' : ''} ${rolling ? 'is-rolling' : ''}`} aria-label={`تاس ${fa(n)}: ${hero.symFa[sym]}`}>
      <b>{hero.symFa[sym]}</b><small>{fa(n)}</small>
    </span>
  );
}

function Banner({ view, seat, label, active }: { view: DtView; seat: number; label: string; active: boolean }) {
  const f = view.fighters[seat]!;
  const hero = f.hero !== null ? HEROES[f.hero]! : null;
  return (
    <section className={`dt-banner ${hero ? `dt-h--${hero.key}` : ''} ${active ? 'dt-banner--now' : ''}`} aria-label={`${label}${hero ? `، ${hero.name}` : ''}`}>
      <div className="dt-banner__top">
        <bdi className="dt-banner__name">{label}</bdi>
        {hero && <span className="dt-banner__hero">{hero.name}</span>}
        <span className="dt-cp" title="امتیاز رزم">{fa(f.cp)} CP</span>
      </div>
      <div className="dt-hp" role="meter" aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={Math.max(0, f.hp)} aria-label="جان">
        <span className="dt-hp__fill" style={{ inlineSize: `${Math.max(0, f.hp) / MAX_HP * 100}%` }} />
        <b className="dt-hp__n" key={f.hp}>{fa(Math.max(0, f.hp))}</b>
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

export default function DiceThroneRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<DtView>) {
  const me = mySeat ?? 0;
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
    : picks.length ? { tone: 'mine' as const, text: 'قهرمانتان را انتخاب کنید' }
      : canDefend ? { tone: 'mine' as const, text: `${atkHero?.abilities[view.pending!.ability]!.name}: دفاع کنید` }
        : view.phase === 'offense' && view.current === me ? { tone: 'mine' as const, text: view.rolled ? 'تاس نگه دارید و دوباره بریزید یا حمله کنید' : 'تاس‌ها را بریزید' }
          : { tone: 'wait' as const, text: view.phase === 'pick' ? `${seatName(view.current)} قهرمان انتخاب می‌کند` : view.phase === 'defense' ? `${seatName(1 - view.current)} دفاع می‌کند` : `نوبت ${seatName(view.current)}` };

  return (
    <div className="dt" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <Banner view={view} seat={opp} label={who(opp)} active={view.current === opp && !view.outcome} />

      {view.phase === 'pick' ? (
        <section className="dt-heroes" aria-label="قهرمان‌ها">
          {HEROES.map((h, i) => {
            const can = picks.includes(i);
            const taken = view.fighters.some((f) => f.hero === i);
            return (
              <button key={h.key} type="button" disabled={busy || !can} onClick={() => onAction({ type: 'pickHero', hero: i })} className={`dt-hero dt-h--${h.key} ${taken ? 'is-taken' : ''}`}>
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
              const mine = view.current === me && view.phase === 'offense' && view.rolled && !busy;
              return mine
                ? <button key={i} type="button" className="dt-dbtn" aria-pressed={keep[i]} onClick={() => setKeep(keep.map((k, j) => (j === i ? !k : k)))}><DieFace hero={atkHero} n={d} kept={keep[i]} /></button>
                : <span key={`${i}-${view.seq}`}><DieFace hero={atkHero} n={d} rolling={view.phase === 'offense'} /></span>;
            })}
          </div>
          {view.phase === 'offense' && <small className="dt-rolls">{view.rolled ? `${fa(view.rollsLeft)} ریختن مانده` : 'هنوز نریخته'}</small>}
          {view.defenseDice.length > 0 && defHero && view.phase !== 'defense' && (
            <div className="dt-defdice"><small>دفاع:</small>{view.defenseDice.map((d, i) => <DieFace key={i} hero={defHero} n={d} />)}</div>
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
