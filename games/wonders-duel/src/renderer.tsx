// شگفتی‌ها: دوئل renderer: a sandstone court. The age structure is laid out as overlapping cards (face-down backs by
// age, purple for guilds); uncovered cards lift and can be picked to build, sell or turn into a wonder. Between the two
// cities runs the conflict track with its pawn and coin tokens; progress tokens sit on discs above it.
import './renderer.css';
import { useEffect, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { CARDS, PROGRESS_FA, RES_FA, WONDERS, type Card, type Color, type DuelView, type Progress, type Res } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const SCI: Record<string, string> = { wheel: '⚙', compass: '⌖', quill: '✒', mortar: '⚗', sundial: '◷', globe: '◍', law: '⚖' };
const COLOR_FA: Record<Color, string> = { brown: 'مواد خام', grey: 'کالا', blue: 'مدنی', red: 'نظامی', green: 'علمی', yellow: 'تجاری', purple: 'صنف' };
const RES_LETTER: Record<Res, string> = { W: 'چ', C: 'ر', S: 'س', G: 'ش', P: 'پ' };

export function Cost({ cost, coins }: { cost: string; coins?: number }) {
  if (!cost && !coins) return <span className="wd-cost wd-cost--free">رایگان</span>;
  return (
    <span className="wd-cost" aria-label={`هزینه: ${[coins ? `${fa(coins)} سکه` : '', ...[...cost].map((r) => RES_FA[r as Res])].filter(Boolean).join('، ')}`}>
      {coins ? <i className="wd-coin">{fa(coins)}</i> : null}
      {[...cost].map((r, i) => <i key={i} className={`wd-res wd-res--${r}`}>{RES_LETTER[r as Res]}</i>)}
    </span>
  );
}

export function effectText(c: Card) {
  const out: string[] = [];
  if (c.prod) out.push([...c.prod].map((r) => RES_FA[r as Res]).join('+'));
  if (c.choice) out.push([...c.choice].map((r) => RES_FA[r as Res]).join('/'));
  if (c.shields) out.push(`${'⚔'.repeat(c.shields)}`);
  if (c.sci) out.push(SCI[c.sci]!);
  if (c.vp) out.push(`${fa(c.vp)}★`);
  if (c.trade) out.push(`${[...c.trade].map((r) => RES_FA[r as Res]).join('/')} به ۱`);
  if (c.gain) out.push(`${fa(c.gain)} سکه`);
  if (c.per) out.push(`سکه برای ${c.per === 'wonder' ? 'شگفتی' : COLOR_FA[c.per]}`);
  if (c.guild) out.push(c.guild === 'wonder' ? 'شگفتی‌ها' : c.guild === 'coins' ? 'ثروت' : c.guild.map((g) => COLOR_FA[g]).join('+'));
  return out.join(' · ');
}

export function CardFace({ id, size = 'md' }: { id: number; size?: 'sm' | 'md' }) {
  const c = CARDS[id]!;
  return (
    <span className={`wd-card wd-card--${size} wd-c--${c.color}`} aria-label={`${c.name}: ${effectText(c)}`}>
      <span className="wd-card__band">{effectText(c)}</span>
      <span className="wd-card__name">{c.name}</span>
      {size === 'md' && <Cost cost={c.cost} coins={c.coins} />}
      {c.chain && size === 'md' && <small className="wd-card__chain" title="زنجیره">⛓</small>}
    </span>
  );
}

export function WonderPlate({ id, built, size = 'md' }: { id: number; built?: boolean; size?: 'sm' | 'md' }) {
  const w = WONDERS[id]!;
  const fx = [w.vp ? `${fa(w.vp)}★` : '', w.coins ? `${fa(w.coins)} سکه` : '', w.steal ? `حریف −${fa(w.steal)}` : '', w.shields ? '⚔'.repeat(w.shields) : '',
    w.choice ? [...w.choice].map((r) => RES_FA[r as Res]).join('/') : '', w.replay ? 'نوبت دوباره' : '', w.destroy ? `نابودی ${COLOR_FA[w.destroy]}` : '',
    w.mausoleum ? 'ساخت از دورریز' : '', w.library ? 'نشان پنهان' : ''].filter(Boolean).join(' · ');
  return (
    <span className={`wd-wonder wd-wonder--${size} ${built ? 'is-built' : ''}`} aria-label={`${w.name}${built ? ' (ساخته‌شده)' : ''}: ${fx}`}>
      <span className="wd-wonder__name">{w.name}</span>
      <span className="wd-wonder__fx">{fx}</span>
      {size === 'md' && !built && <Cost cost={w.cost} />}
    </span>
  );
}

function City({ view, seat, label }: { view: DuelView; seat: number; label: string }) {
  const cards = view.cities[seat]!.map((id) => CARDS[id]!);
  const colors: Color[] = ['brown', 'grey', 'yellow', 'blue', 'red', 'green', 'purple'];
  return (
    <section className={`wd-city ${view.current === seat && !view.outcome ? 'wd-city--now' : ''}`} aria-label={`شهر ${label}`}>
      <div className="wd-city__head">
        <bdi className="wd-city__name">{label}</bdi>
        <span className="wd-coin wd-coin--lg" key={view.coins[seat]}>{fa(view.coins[seat]!)}</span>
        {view.progress[seat]!.map((p) => <span key={p} className="wd-token wd-token--sm" title={PROGRESS_FA[p][1]}>{PROGRESS_FA[p][0]}</span>)}
      </div>
      <div className="wd-city__wonders">{view.wonders[seat]!.map((w) => <WonderPlate key={w.id} id={w.id} built={w.built} size="sm" />)}</div>
      <div className="wd-city__cols">
        {colors.map((col) => {
          const xs = cards.filter((c) => c.color === col);
          return xs.length ? <span key={col} className={`wd-stack wd-c--${col}`} title={xs.map((c) => c.name).join('، ')}>{xs.map((c) => <CardFace key={c.id} id={c.id} size="sm" />)}</span> : null;
        })}
        {!cards.length && <small>هنوز ساختمانی نیست</small>}
      </div>
    </section>
  );
}

type Hint = { type: string; slot?: number; token?: string; wonder?: number } | null;

export default function WondersDuelRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<DuelView>) {
  const me = mySeat ?? 0;
  const opp = 1 - me;
  const hint = expected as unknown as Hint;
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { setPick(null); }, [view.seq]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const of = (t: string) => legalActions.filter((a) => a.type === t);
  const myTurn = view.phase === 'play' && view.current === me && legalActions.some((a) => a.type === 'discard');
  const sel = pick;
  const build = of('build').find((a) => a.slot === sel) as { cost: number } | undefined;
  const sell = of('discard').find((a) => a.slot === sel) as { coins: number } | undefined;
  const wonders = of('wonder').filter((a) => a.slot === sel) as unknown as { wonder: number; cost: number }[];
  const drafting = of('draftWonder');
  const choosing = view.choice && view.choice.seat === me ? view.choice : null;

  const status = view.outcome ? null
    : drafting.length ? { tone: 'mine' as const, text: 'یک شگفتی انتخاب کنید' }
      : choosing ? { tone: 'mine' as const, text: choosing.kind === 'destroy' ? 'یک کارت حریف را نابود کنید' : choosing.kind === 'mausoleum' ? 'یک کارت دورریخته را رایگان بسازید' : 'یک نشان پیشرفت بردارید' }
        : myTurn ? { tone: 'mine' as const, text: sel === null ? 'یک کارت آزاد از هرم بردارید' : 'بسازید، بفروشید یا شگفتی بنا کنید' }
          : { tone: 'wait' as const, text: view.phase === 'draft' ? `${seatName(1 - me)} شگفتی انتخاب می‌کند` : `نوبت ${seatName(view.current)}` };

  const lead = me === 0 ? view.military : -view.military;
  const maxX = Math.max(...view.structure.map((x) => x.x)) + 2;
  const rows = Math.max(...view.structure.map((x) => x.row), 0) + 1;

  return (
    <div className="wd" data-seq={view.seq} data-phase={view.phase}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <City view={view} seat={opp} label={who(opp)} />

      <section className="wd-track" dir="ltr" aria-label={`نبرد: ${lead > 0 ? `شما ${fa(lead)} خانه جلوترید` : lead < 0 ? `حریف ${fa(-lead)} خانه جلوتر است` : 'برابر'}`}>
        <span className="wd-track__cap">⛫</span>
        <div className="wd-track__lane">
          {Array.from({ length: 19 }, (_, i) => i - 9).map((k) => (
            <span key={k} className={`wd-track__cell ${Math.abs(k) >= 6 ? 'is-far' : Math.abs(k) >= 3 ? 'is-mid' : ''} ${k === 0 ? 'is-zero' : ''}`}>
              {(k === -3 || k === -6) && !view.milTokens[opp]![k === -3 ? 0 : 1] && <i className="wd-mtok">{k === -3 ? '۲' : '۵'}</i>}
              {(k === 3 || k === 6) && !view.milTokens[me]![k === 3 ? 0 : 1] && <i className="wd-mtok">{k === 3 ? '۲' : '۵'}</i>}
            </span>
          ))}
          <span className="wd-pawn" style={{ insetInlineStart: `calc(${(9 - lead) / 19 * 100}% + ${100 / 38}%)` }} aria-hidden />
        </div>
        <span className="wd-track__cap wd-track__cap--me">⛫</span>
      </section>

      <div className="wd-progress" aria-label="نشان‌های پیشرفت">
        {view.progressBoard.map((p) => {
          const can = choosing && (choosing.kind === 'progress') && legalActions.some((a) => a.type === 'progress' && a.token === p);
          return can
            ? <button key={p} type="button" className={`wd-token ${hint?.token === p ? 'wd-hint' : ''}`} disabled={busy} onClick={() => onAction({ type: 'progress', token: p })} title={PROGRESS_FA[p][1]}><b>{PROGRESS_FA[p][0]}</b><small>{PROGRESS_FA[p][1]}</small></button>
            : <span key={p} className="wd-token" title={PROGRESS_FA[p][1]}><b>{PROGRESS_FA[p][0]}</b><small>{PROGRESS_FA[p][1]}</small></span>;
        })}
      </div>

      {drafting.length > 0 || view.phase === 'draft' ? (
        <section className="wd-draft" aria-label="انتخاب شگفتی">
          {view.draftPool.map((w) => drafting.length
            ? <button key={w} type="button" className="wd-pickw" disabled={busy} onClick={() => onAction({ type: 'draftWonder', wonder: w })}><WonderPlate id={w} /></button>
            : <span key={w} className="wd-pickw"><WonderPlate id={w} /></span>)}
        </section>
      ) : (
        <section className="wd-age" aria-label={`دوران ${fa(view.age)}`}>
          <p className="wd-age__title">دوران {['', 'یکم', 'دوم', 'سوم'][view.age]}</p>
          <div className="wd-pyr" dir="ltr" style={{ ['--cols' as string]: maxX, ['--rows' as string]: rows }}>
            {view.structure.map((x, i) => {
              if (x.taken) return null;
              const free = view.accessible.includes(i);
              const style = { insetInlineStart: `calc(${x.x} * var(--hw))`, insetBlockStart: `calc(${x.row} * var(--rh))`, zIndex: x.row + 1 };
              const face = x.card !== null ? <CardFace id={x.card} /> : <span className={`wd-back wd-back--${x.back}`} aria-label="کارت پشت‌ورو" />;
              return free && myTurn
                ? <button key={i} type="button" style={style} disabled={busy} aria-pressed={sel === i} onClick={() => setPick(sel === i ? null : i)}
                  className={['wd-slot wd-slot--free', sel === i ? 'wd-slot--on' : '', hint?.slot === i && sel !== i ? 'wd-hint' : ''].join(' ')}>{face}</button>
                : <span key={i} style={style} className={`wd-slot ${free ? 'wd-slot--free' : ''}`}>{face}</span>;
            })}
          </div>
        </section>
      )}

      {myTurn && sel !== null && (
        <div className="wd-acts" role="group" aria-label="کار با کارت">
          <Button size="sm" disabled={busy || !build} className={hint?.type === 'build' ? 'wd-hint' : ''} onClick={() => onAction({ type: 'build', slot: sel })}>
            {build ? `ساختن (${build.cost ? `${fa(build.cost)} سکه` : 'رایگان'})` : 'ساختن (ناتوان)'}
          </Button>
          {sell && <Button size="sm" variant="secondary" disabled={busy} className={hint?.type === 'discard' ? 'wd-hint' : ''} onClick={() => onAction({ type: 'discard', slot: sel })}>فروختن (+{fa(sell.coins)} سکه)</Button>}
          {wonders.map((w) => <Button key={w.wonder} size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'wonder', slot: sel, wonder: w.wonder })}>بنای {WONDERS[w.wonder]!.name} ({fa(w.cost)} سکه)</Button>)}
        </div>
      )}

      {choosing && choosing.kind === 'library' && choosing.options && (
        <div className="wd-acts">{(choosing.options as Progress[]).map((p) => <Button key={p} size="sm" disabled={busy} onClick={() => onAction({ type: 'progress', token: p })}>{PROGRESS_FA[p][0]}</Button>)}</div>
      )}
      {choosing && (choosing.kind === 'destroy' || choosing.kind === 'mausoleum') && (
        <div className="wd-acts">{(choosing.options as number[]).map((id) => <button key={id} type="button" className="wd-pickw" disabled={busy} onClick={() => onAction({ type: choosing.kind, card: id })}><CardFace id={id} /></button>)}</div>
      )}

      {view.last && view.last.kind !== 'draft' && view.phase !== 'draft' && (
        <p className="wd-last" key={view.seq}><bdi>{who(view.last.seat)}</bdi>: {view.last.kind === 'build' ? `ساختن ${CARDS[view.last.card!]!.name}` : view.last.kind === 'discard' ? `فروش ${CARDS[view.last.card!]!.name} (+${fa(view.last.coins!)})` : view.last.kind === 'wonder' ? `بنای ${WONDERS[view.last.wonder!]!.name}` : view.last.kind === 'progress' ? 'گرفتن نشان پیشرفت' : view.last.kind === 'destroy' ? `نابودی ${CARDS[view.last.card!]!.name}` : `ساختن از دورریز: ${CARDS[view.last.card!]!.name}`}</p>
      )}
      <City view={view} seat={me} label={who(me)} />
    </div>
  );
}
