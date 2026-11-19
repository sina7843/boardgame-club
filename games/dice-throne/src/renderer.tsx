// نبرد تاس renderer: an arena. Two hero banners face off with health bars, combat-point gems and status badges;
// the dice tray shows each die as the hero's symbol (tap to keep); the ability board lists every combo with its
// effect and lights up the ones your dice make. The defender gets a single «دفاع» roll.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, useFlip, useInFrame, type GameRendererProps, DockSlot } from '@bg/ui';
import boardWarrior from './art/dice-throne-board-warrior.png';
import boardShadow from './art/dice-throne-board-shadow.png';
import boardPyro from './art/dice-throne-board-pyro.png';
import boardPaladin from './art/dice-throne-board-paladin.png';
import wound from './art/dice-throne-st-wound.png';
import stun from './art/dice-throne-st-stun.png';
import shieldArt from './art/dice-throne-st-shield.png';
import w1 from './art/dice-throne-warrior-1.png'; import w2 from './art/dice-throne-warrior-2.png'; import w3 from './art/dice-throne-warrior-3.png';
import w4 from './art/dice-throne-warrior-4.png'; import w5 from './art/dice-throne-warrior-5.png'; import w6 from './art/dice-throne-warrior-6.png';
import s1 from './art/dice-throne-shadow-1.png'; import s2 from './art/dice-throne-shadow-2.png'; import s3 from './art/dice-throne-shadow-3.png';
import s5 from './art/dice-throne-shadow-5.png'; import s6 from './art/dice-throne-shadow-6.png';
import { HEROES, MAX_HP, abilityEffect, symOf, type Ability, type DtView, type Effect, type Hero } from './rules.ts';

// Art: design/games/group-d/art/dice-throne. Dice faces exist for warrior and shadow (no shadow-4); pyro and paladin dice
// are still pending upstream (design PENDING.md) and keep the plain symbol face below.
export const BOARD: Record<string, string> = { warrior: boardWarrior, shadow: boardShadow, pyro: boardPyro, paladin: boardPaladin };
const DIE_ART: Record<string, Record<number, string>> = {
  warrior: { 1: w1, 2: w2, 3: w3, 4: w4, 5: w5, 6: w6 },
  shadow: { 1: s1, 2: s2, 3: s3, 5: s5, 6: s6 }
};
// Ability hotspots on the 874x310 board image (percent): main attack, heal row, stun row, straight, ultimate.
const BOX = [
  { left: 40.85, top: 5.81, width: 38.33, height: 27.42 }, { left: 1.14, top: 5.81, width: 38.79, height: 27.42 },
  { left: 40.85, top: 35.48, width: 38.33, height: 27.42 }, { left: 1.14, top: 35.48, width: 38.79, height: 27.42 },
  { left: 1.14, top: 65.48, width: 78.03, height: 28.71 }
];
const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const effText = (e: Effect) => [e.dmg ? `${fa(e.dmg)} آسیب` : '', e.heal ? `+${fa(e.heal)} جان` : '', e.cp ? `+${fa(e.cp)} CP` : '', e.steal ? `دزدی ${fa(e.steal)} CP` : '',
  e.wound ? `زخم ${fa(e.wound)}` : '', e.stun ? 'گیجی' : '', e.shield ? 'سپر' : '', e.undefendable ? 'دفاع‌ناپذیر' : ''].filter(Boolean).join('، ');
const needText = (h: Hero, a: Ability) => (a.need.sym ? `${a.need.counts!.map(fa).join('/')}× ${h.symFa[a.need.sym]}` : a.need.combo ? Object.entries(a.need.combo).map(([s, c]) => `${fa(c)}× ${h.symFa[s]}`).join(' + ') : a.need.straight === 5 ? 'ردیف بلند (۵)' : 'ردیف کوتاه (۴)');

export function DieFace({ hero, n, kept, rolling, tumble }: { hero: Hero; n: number; kept?: boolean; rolling?: boolean; tumble?: boolean }) {
  const sym = symOf(hero, n);
  const art = DIE_ART[hero.key]?.[n];
  // tumble: the server has not rolled yet; the faces are hidden (bg-tumble hides [data-pip]) and not announced.
  return (
    <span className={`dt-die dt-h--${hero.key} ${kept ? 'is-kept is-lock' : ''} ${rolling ? 'bg-roll' : ''} ${tumble ? 'bg-tumble' : ''}`} aria-label={tumble ? 'در حال ریختن' : `تاس ${fa(n)}: ${hero.symFa[sym]}`}>
      {art ? <img data-pip src={art} alt="" draggable={false} /> : <><b data-pip>{hero.symFa[sym]}</b><small data-pip>{fa(n)}</small></>}
    </span>
  );
}

type Hint = { type: string; keep?: boolean[]; ability?: number; hero?: number } | null;

interface AbCtx { attacks: Set<number>; busy: boolean; hint: Hint; onAction: GameRendererProps<DtView>['onAction']; view: DtView }

/** The hero board is the printed board image; the five abilities are hotspots over it (buttons on your own board, lit as the
 *  dice make them). HP, CP and status tokens sit next to it (the table frame also shows them in the seat strip). */
function HeroBoard({ seat, label, active, mine, ctx }: { seat: number; label: string; active: boolean; mine: boolean; ctx: AbCtx }) {
  const { view } = ctx;
  const f = view.fighters[seat]!;
  const hero = f.hero !== null ? HEROES[f.hero]! : null;
  // Shake the plate when health dropped (stamp = seq of the drop, used as the retrigger key).
  const hit = useRef({ hp: f.hp, at: 0 });
  if (f.hp < hit.current.hp) hit.current.at = view.seq;
  hit.current.hp = f.hp;
  const attacking = view.current === seat && view.phase !== 'pick' && view.rolled;
  const tokens = [{ key: 'wound', src: wound, fa: 'زخم', n: f.wound }, { key: 'stun', src: stun, fa: 'گیجی', n: f.stun ? 1 : 0 }, { key: 'shield', src: shieldArt, fa: 'سپر', n: f.shield ? 1 : 0 }];
  return (
    <section className={`dt-banner dt-board ${mine ? 'dt-board--mine' : 'dt-board--opp'} ${hero ? `dt-h--${hero.key}` : ''} ${active ? 'dt-banner--now' : ''}`} aria-label={`صفحهٔ ${label}${hero ? `، ${hero.name}` : ''}`}>
      {hero ? (
        <div className="dt-side">
          <div key={hit.current.at} className={`${hit.current.at ? 'bg-hit ' : ''}dt-b ${mine ? '' : 'dt-b--opp'}`}>
            <img src={BOARD[hero.key]} alt={`صفحهٔ ${hero.name}، ${label}`} draggable={false} />
            {hero.abilities.map((a, i) => {
              const met = attacking && !!abilityEffect(hero, a, view.dice);
              const can = mine && ctx.attacks.has(i);
              const cls = ['dt-box', 'dt-ab', met ? 'dt-ab--met is-pick' : '', can ? 'dt-ab--can' : '', mine && ctx.hint?.type === 'attack' && ctx.hint.ability === i ? 'dt-hint' : ''].join(' ');
              const box = BOX[i]!;
              const style = { left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` };
              const text = `${a.name}: ${needText(hero, a)}، ${a.tiers.map(effText).join(' | ')}`;
              if (!mine) return met ? <span key={i} className={cls} style={style} aria-label={text} /> : null;
              return can || met
                ? <button key={i} type="button" disabled={ctx.busy || !can} aria-label={text} style={style} onClick={() => ctx.onAction({ type: 'attack', ability: i })} className={cls}>{can && <b>{a.name}</b>}</button>
                : null;
            })}
          </div>
          <div className="dt-stats">
            <div className="dt-hp" role="meter" aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={Math.max(0, f.hp)} aria-label="جان"><b>{fa(Math.max(0, f.hp))}</b><small>جان</small></div>
            <div className="dt-cp" aria-label="امتیاز رزم"><b>{fa(f.cp)}</b><small>CP</small></div>
            <div className="dt-st" aria-label="نشانه‌های وضعیت">
              {tokens.map((t) => <span key={t.key} className={t.n ? '' : 'is-zero'} aria-label={`${t.fa}: ${t.n ? fa(t.n) : 'ندارد'}`}><img src={t.src} alt="" />{fa(t.n)}</span>)}
            </div>
          </div>
        </div>
      ) : <small>بدون قهرمان</small>}
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
  const framed = useInFrame() !== null;

  return (
    <div className="dt" ref={root} data-seq={view.seq} data-phase={view.phase}>
      {framed && <RailSlot>{status && <p><b>{status.text}</b></p>}<p>تا سه بار تاس بریزید و تاس‌هایی را که می‌خواهید نگه دارید؛ هر ریختن اضافه ۲ CP خرج دارد. جور شدن ترکیب، توانایی را روشن می‌کند.</p></RailSlot>}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <HeroBoard seat={opp} label={who(opp)} active={view.current === opp && !view.outcome} mine={false} ctx={ctx} />

      {view.phase === 'pick' ? (
        <section className="dt-heroes" aria-label="قهرمان‌ها">
          {HEROES.map((h, i) => {
            const can = picks.includes(i);
            const taken = view.fighters.some((f) => f.hero === i) || (queued?.type === 'pickHero' && queued.hero === i);
            return (
              <button key={h.key} type="button" disabled={busy || !can} onClick={() => onAction({ type: 'pickHero', hero: i })} className={`dt-hero dt-h--${h.key} ${taken ? 'is-taken' : ''}`}>
                <img src={BOARD[h.key]} alt="" aria-hidden="true" draggable={false} />
                <b>{h.name}</b>
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
            {roll && <DockSlot><Button size="sm" disabled={busy} className={hint?.type === 'roll' ? 'dt-hint' : ''} onClick={() => onAction({ type: 'roll', keep: view.rolled ? keep : [false, false, false, false, false] })}>{roll.extra ? 'ریختن اضافه (۲ CP)' : view.rolled ? 'ریختن دوباره' : 'ریختن تاس‌ها'}</Button></DockSlot>}
            {canPass && <DockSlot><Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'pass' })}>بدون حمله</Button></DockSlot>}
            {canDefend && <Button size="sm" disabled={busy} className="dt-defend" onClick={() => onAction({ type: 'defend' })}>دفاع ({fa(defHero?.defense.dice ?? 0)} تاس)</Button>}
          </div>
        </section>
      )}

      <HeroBoard seat={me} label={who(me)} active={view.current === me && !view.outcome} mine ctx={ctx} />
      {!framed && view.log.length > 0 && <ol className="dt-log" aria-label="رویدادها">{view.log.slice(-3).map((l, i) => <li key={`${view.seq}-${i}`}><bdi>{who(l.seat)}</bdi>: {l.text}</li>)}</ol>}
    </div>
  );
}
