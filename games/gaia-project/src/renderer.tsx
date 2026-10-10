// Gaia Project table renderer. Everything in Gaia Project is public, so every panel shows every player's state; only
// the legal actions offered come from the viewer's own seat. Layout: status + open decision, the space map (SVG,
// dir="ltr" — spatial coordinates), the action area (power/QIC actions, specials, free actions, federation builder,
// boosters/pass), the research board with tech tiles, and one panel per player. Hex actions (mine, upgrade, gaia
// project, power/booster/faction actions with a target) are chosen by tapping a highlighted hex, then a button.
// Motion: useFlip moves tech tiles and boosters between board and player, new structures fade in, numbers pop.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { ActionBar, Button, TurnIndicator, ZoomBoard, fa, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import {
  BASE_CONVERSIONS, BUILDING_FA, CONTENT, HEX_SIZE, PLANET_FA, POWER_ACTIONS, RES_FA, TRACKS, TRACK_FA, hexCenter,
  type Building, type Gain, type GaiaView, type Planet, type PlayerState, type Track
} from './rules.ts';
import pR from './art/planet-r.webp';
import pO from './art/planet-o.webp';
import pV from './art/planet-v.webp';
import pD from './art/planet-d.webp';
import pS from './art/planet-s.webp';
import pT from './art/planet-t.webp';
import pI from './art/planet-i.webp';
import pG from './art/planet-g.webp';
import pM from './art/planet-m.webp';
import pL from './art/planet-l.webp';
import rC from './art/res-c.webp';
import rO from './art/res-o.webp';
import rK from './art/res-k.webp';
import rQ from './art/res-q.webp';
import rPw from './art/res-pw.webp';
import gfArt from './art/gaiaformer.webp';

const PLANET_ART: Partial<Record<Planet, string>> = { r: pR, o: pO, v: pV, d: pD, s: pS, t: pT, i: pI, g: pG, m: pM, l: pL };
const RES_ART = { c: rC, o: rO, k: rK, q: rQ, pw: rPw } as const;

// ---------------- labels ----------------

const gainFa = (g: Gain) => Object.entries(g).filter(([, v]) => v).map(([k, v]) => `${fa(v as number)} ${RES_FA[k as keyof Gain]}`).join('، ') || '—';
const techFa = (id: string) => CONTENT.techs[id]?.labelFa ?? id;
const boosterFa = (id: string) => CONTENT.boosters[id]?.labelFa ?? id;
const fedFa = (id: string) => CONTENT.feds[id]?.labelFa ?? id;
const factionFa = (id: string) => CONTENT.factions[id]?.nameFa ?? id;
const CONV_FA: Record<string, string> = Object.fromEntries([
  ...BASE_CONVERSIONS, ...Object.values(CONTENT.factions).flatMap((f) => f.effects?.conversions ?? [])
].map((c) => [c.id, c.labelFa]));
const CHOICE_FA: Record<string, string> = {
  accept: 'پذیرفتن', decline: 'رد کردن', 'token-first': 'اول ژتون، بعد شارژ', 'charge-first': 'اول شارژ، بعد ژتون',
  yes: 'بله', no: 'نه', done: 'تمام', q: '۱ QIC', k: '۱ دانش', o: '۱ سنگ معدن', c: '۱ اعتبار'
};

function specialFa(key: string): string {
  if (key === 'ac2') return 'اقدام آکادمی QIC';
  const [kind, id] = key.split(':') as [string, string];
  if (kind === 'faction') return `${factionFa(id)}: ${CONTENT.factions[id]?.effects?.action?.labelFa ?? key}`;
  if (kind === 'booster') return `تقویت‌کننده: ${CONTENT.boosters[id]?.effects?.action?.labelFa ?? key}`;
  if (kind === 'tech') return `فناوری: ${CONTENT.techs[id]?.effects.action?.labelFa ?? key}`;
  return key;
}

function decisionTitle(view: GaiaView, who: (s: number) => string): string {
  const d = view.decision!;
  switch (d.kind) {
    case 'leech': return `${who(d.seat)}: پیشنهاد ${fa(d.amount)} قدرت از ساخت ${who(d.from)} (هزینه: یک امتیاز کمتر از قدرت شارژشده)`;
    case 'tech': return `${who(d.seat)}: یک کاشی فناوری انتخاب کنید`;
    case 'cover': return `${who(d.seat)}: یک کاشی فناوری استاندارد را زیر ${techFa(d.adv)} بپوشانید`;
    case 'research': return `${who(d.seat)}: یک گام پژوهش رایگان`;
    case 'lostPlanet': return `${who(d.seat)}: جای سیارهٔ گمشده را روی نقشه انتخاب کنید`;
    case 'custom': return `${who(d.seat)}: ${d.labelFa}`;
  }
}

function choiceFa(view: GaiaView, choice: string): string {
  const d = view.decision;
  if (!d) return choice;
  if (d.kind === 'tech' || d.kind === 'cover') return techFa(choice);
  if (d.kind === 'research') return TRACK_FA[choice as Track] ?? choice;
  if (d.kind === 'lostPlanet') return 'اینجا';
  return CHOICE_FA[choice] ?? choice;
}

function actionFa(view: GaiaView, a: GameAction): string {
  switch (a.type) {
    case 'place': return `گذاشتن ${view.setupQueue[0]?.what === 'pi' ? 'مؤسسهٔ سیاره‌ای' : 'معدن'}`;
    case 'mine': return 'ساخت معدن';
    case 'upgrade': return `ارتقا به ${BUILDING_FA[a.to as Building]}`;
    case 'gaiaform': return 'پروژهٔ گایا (گایاساز)';
    case 'power': { const pa = POWER_ACTIONS.find((x) => x.id === a.id); return pa ? `${gainFa(pa.cost)}: ${pa.labelFa}` : String(a.id); }
    case 'special': return specialFa(a.id as string);
    case 'decide': return choiceFa(view, a.choice as string);
    default: return a.type;
  }
}

const sortKeys = (v: unknown): unknown => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v);
const same = (a: GameAction | null, b: GameAction) => !!a && JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const keyOf = (a: GameAction) => (a.type === 'power' || a.type === 'special' ? `${a.type}:${String(a.id)}` : a.type);

// ---------------- small pieces ----------------

function Num({ value, label }: { value: number; label: string }) {
  const pop = usePop(value);
  return <span key={value} className={`gp-num ${pop}`} aria-label={`${label} ${fa(value)}`}>{fa(value)}</span>;
}

function Res({ k, n }: { k: keyof typeof RES_ART; n: number }) {
  return (
    <span className="gp-res" title={RES_FA[k]}>
      <img src={RES_ART[k]} alt="" draggable={false} />
      <Num value={n} label={RES_FA[k]} />
    </span>
  );
}

function GainIcons({ g }: { g: Gain }) {
  const parts = Object.entries(g).filter(([, v]) => v) as [keyof Gain, number][];
  if (!parts.length) return <span>—</span>;
  return <span className="gp-gain">{parts.map(([k, v]) => (k in RES_ART
    ? <span key={k} className="gp-res" title={RES_FA[k]}><img src={RES_ART[k as keyof typeof RES_ART]} alt="" />{fa(v)}</span>
    : <span key={k}>{fa(v)} {RES_FA[k]}</span>))}</span>;
}

function TechTile({ id, covered, hint, flip, from, anchor }: { id: string; covered?: boolean; hint?: boolean; flip?: string; from?: string; anchor?: string }) {
  const t = CONTENT.techs[id];
  return (
    <span data-flip={flip} data-flip-from={from} data-flip-anchor={anchor} className={['gp-tile', t?.kind === 'adv' ? 'gp-tile--adv' : '', covered ? 'gp-tile--covered' : '', hint ? 'gp-hint' : ''].join(' ')}>
      <small>{t?.kind === 'adv' ? 'پیشرفته' : 'فناوری'}</small>{techFa(id)}{covered && <em> (پوشیده)</em>}
    </span>
  );
}

function BoosterTile({ id }: { id: string }) {
  return <span data-flip={`boost-${id}`} className="gp-tile gp-tile--boost"><small>تقویت‌کننده</small>{boosterFa(id)}</span>;
}

function Bowls({ p }: { p: PlayerState }) {
  const brain = p.power.brain;
  const bowl = (n: number, label: string, b: 1 | 2 | 3 | 0) => (
    <span className={`gp-bowl gp-bowl--${b}`} title={label}>
      <small>{label}</small><Num value={n} label={label} />{brain === b && <span className="gp-brain" title="سنگ مغز">◆</span>}
    </span>
  );
  return (
    <span className="gp-bowls" aria-label="کاسه‌های قدرت">
      {bowl(p.power.b1, 'کاسهٔ I', 1)}{bowl(p.power.b2, 'کاسهٔ II', 2)}{bowl(p.power.b3, 'کاسهٔ III', 3)}{bowl(p.power.gaia, 'ناحیهٔ گایا', 0)}
    </span>
  );
}

function PlayerPanel({ view, seat, name, me, waiting }: { view: GaiaView; seat: number; name: string; me: boolean; waiting: boolean }) {
  const p = view.pl[seat]!;
  const f = p.faction ? CONTENT.factions[p.faction] : undefined;
  const count = (b: Building | 'ac') => view.hexes.filter((h) => h.owner === seat && (b === 'ac' ? h.building === 'ac1' || h.building === 'ac2' : h.building === b)).length
    + (b === 'mine' ? view.hexes.filter((h) => h.extra === seat).length : 0);
  const gfUsed = p.gfGaia + view.hexes.filter((h) => h.owner === seat && h.building === 'gf').length;
  const left = !view.active[seat];
  const place = view.outcome?.placements.find((x) => x.seat === seat)?.place;
  return (
    <section data-flip-anchor={`seat-${seat}`} className={['gp-player', `gp-seat-${seat}`, waiting ? 'gp-player--current' : '', me ? 'gp-player--me' : ''].join(' ')} aria-label={`بازیکن ${name}`}>
      <header>
        <span className="gp-swatch" aria-hidden="true">{fa(seat + 1)}</span>
        <strong><bdi>{name}</bdi>{me && ' (شما)'}</strong>
        <span>{f ? f.nameFa : 'بدون جناح'}</span>
        {f && PLANET_ART[f.home] && <img className="gp-home" src={PLANET_ART[f.home]} alt={PLANET_FA[f.home]} title={`سیارهٔ خانه: ${PLANET_FA[f.home]}`} />}
        <span className="gp-vp" title="امتیاز">★ <Num value={p.vp} label="امتیاز" /></span>
        {p.passed && !left && <span className="gp-tag">پاس داده</span>}
        {left && <span className="gp-tag">خارج شده</span>}
        {place && <span className="gp-tag">رتبهٔ {fa(place)}</span>}
      </header>
      <div className="gp-resrow">
        <Res k="c" n={p.c} /><Res k="o" n={p.o} /><Res k="k" n={p.k} /><Res k="q" n={p.q} />
      </div>
      <Bowls p={p} />
      <p className="gp-line">
        معدن {fa(count('mine'))}/۸ · ایستگاه تجاری {fa(count('ts'))}/۴ · آزمایشگاه {fa(count('lab'))}/۳ · مؤسسه {fa(count('pi'))}/۱ · آکادمی {fa(count('ac'))}/۲
      </p>
      <p className="gp-line">
        <img className="gp-ico" src={gfArt} alt="" /> گایاساز {fa(p.gf - gfUsed)} آزاد از {fa(p.gf)} · ماهواره {fa(p.satellites)}
      </p>
      {p.faction && view.active[seat] && <p className="gp-line">درآمد دور بعد: <GainIcons g={view.income[seat] ?? {}} /></p>}
      <div className="gp-tiles">
        {p.booster && <BoosterTile id={p.booster} />}
        {p.techs.map((t) => (CONTENT.techs[t.id]?.kind === 'adv'
          ? <TechTile key={t.id} id={t.id} covered={t.covered} flip={`tech-${t.id}`} />
          : <TechTile key={t.id} id={t.id} covered={t.covered} flip={`tech-${seat}-${t.id}`} from={`std-${t.id}`} />))}
        {p.feds.map((x, i) => <span key={i} data-flip={`fed-${seat}-${i}`} data-flip-from="fed-supply" className={`gp-tile gp-tile--fed${x.green ? ' gp-tile--green' : ''}`}><small>فدراسیون{x.green ? ' (سبز)' : ''}</small>{fedFa(x.id)}</span>)}
      </div>
      {f && (
        <details className="gp-ability">
          <summary>توانایی جناح</summary>
          <p>{f.abilityFa}</p>
          <p><strong>مؤسسهٔ سیاره‌ای:</strong> {f.piFa}</p>
        </details>
      )}
    </section>
  );
}

// ---------------- renderer ----------------

/** The served view with my queued move applied as far as it is certain: the structure on its hex, the research marker
 *  one level up, the booster taken (the old one back in the pool). Resources, leech offers and VP wait for the server. */
function previewView(v: GaiaView, a: GameAction | null, me: number | null): GaiaView {
  if (!a || me === null || !v.pl[me]) return v;
  const build = (i: number, b: Building): GaiaView => ({
    ...v, hexes: v.hexes.map((h, k) => (k !== i ? h : h.owner !== null && h.owner !== me && b === 'mine' ? { ...h, extra: me } : { ...h, owner: me, building: b }))
  });
  const hex = typeof a.hex === 'number' && v.hexes[a.hex] ? a.hex : null;
  if (a.type === 'place' && hex !== null && v.setupQueue[0]) return build(hex, v.setupQueue[0].what as Building);
  if (a.type === 'mine' && hex !== null) return build(hex, 'mine');
  if (a.type === 'upgrade' && hex !== null) return build(hex, a.to as Building);
  if (a.type === 'gaiaform' && hex !== null) return build(hex, 'gf');
  const pl = (p: PlayerState): GaiaView => ({ ...v, pl: v.pl.map((x, k) => (k === me ? p : x)) });
  const p = v.pl[me]!;
  if (a.type === 'research' && typeof a.track === 'string') return pl({ ...p, research: { ...p.research, [a.track]: p.research[a.track as Track] + 1 } });
  if ((a.type === 'booster' || a.type === 'pass') && typeof a.booster === 'string') {
    const b = a.booster;
    return { ...pl({ ...p, booster: b }), boosters: [...v.boosters.filter((x) => x !== b), ...(p.booster ? [p.booster] : [])] };
  }
  return v;
}

export default function GaiaProjectRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<GaiaView>) {
  const root = useRef<HTMLDivElement>(null);
  // Undo-window preview, kept while the move is in flight (see previewView).
  const held = useRef<{ seq: number; a: GameAction } | null>(null);
  if (queued) held.current = { seq: served.seq, a: queued };
  const preview = queued ?? (busy && held.current?.seq === served.seq ? held.current.a : null);
  if (!preview) held.current = null;
  const view = previewView(served, preview, mySeat);
  useFlip(root, `${view.seq}|${preview ? JSON.stringify(preview) : ''}`);
  const [hex, setHex] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [fed, setFed] = useState<number[] | null>(null);
  const [qic2, setQic2] = useState(false);
  useEffect(() => { setHex(null); setFocus(null); setFed(null); setQic2(false); }, [view.seq]);

  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const play = (a: GameAction) => { if (!busy) { setHex(null); setFocus(null); setFed(null); setQic2(false); onAction(a); } };
  const hinted = (a: GameAction) => same(expected, a);
  const acts = legalActions.filter((a) => a.type !== 'resign');
  const myTurn = acts.length > 0;
  const actionsTurn = acts.some((a) => a.type === 'pass');

  // Hex-targeted actions (incl. the Lost Planet decision, whose choices are hex ids).
  const byHex = new Map<number, GameAction[]>();
  const addHex = (i: number, a: GameAction) => byHex.set(i, [...(byHex.get(i) ?? []), a]);
  for (const a of acts) {
    if (typeof a.hex === 'number') addHex(a.hex, a);
    else if (a.type === 'decide' && view.decision?.kind === 'lostPlanet') addHex(Number(a.choice), a);
  }
  const focused = (a: GameAction) => !focus || keyOf(a) === focus;
  const hexActs = (i: number) => (byHex.get(i) ?? []).filter(focused);
  const of = (t: string) => acts.filter((a) => a.type === t);
  const waiting = view.decision ? view.decision.seat : view.current;
  const expectedHex = typeof expected?.hex === 'number' ? expected.hex : null;
  const fedHint = new Set(expected?.type === 'federation' ? (expected.hexes as number[]) : []);

  // Map geometry
  const cs = view.hexes.map(hexCenter);
  const minX = Math.min(...cs.map((c) => c.x)) - HEX_SIZE, maxX = Math.max(...cs.map((c) => c.x)) + HEX_SIZE;
  const minY = Math.min(...cs.map((c) => c.y)) - HEX_SIZE, maxY = Math.max(...cs.map((c) => c.y)) + HEX_SIZE;
  const corner = (k: number) => `${(HEX_SIZE * 0.97 * Math.cos((Math.PI / 3) * k)).toFixed(2)},${(HEX_SIZE * 0.97 * Math.sin((Math.PI / 3) * k)).toFixed(2)}`;
  const shape = [0, 1, 2, 3, 4, 5].map(corner).join(' ');
  const R = HEX_SIZE;

  const tapHex = (i: number) => {
    if (busy) return;
    if (fed) { setFed(fed.includes(i) ? fed.filter((x) => x !== i) : [...fed, i]); return; }
    if (hexActs(i).length) setHex(i);
  };

  const structure = (b: Building, owner: number) => {
    const cls = `gp-st gp-seat-${owner}`;
    switch (b) {
      case 'mine': return <path className={cls} d={`M${-R * 0.28},${R * 0.3} v${-R * 0.32} l${R * 0.28},${-R * 0.26} l${R * 0.28},${R * 0.26} v${R * 0.32} z`} />;
      case 'ts': return <rect className={cls} x={-R * 0.3} y={-R * 0.3} width={R * 0.6} height={R * 0.6} rx={R * 0.06} />;
      case 'lab': return <circle className={cls} r={R * 0.32} />;
      case 'pi': return <rect className={cls} x={-R * 0.42} y={-R * 0.34} width={R * 0.84} height={R * 0.68} rx={R * 0.22} />;
      case 'ac1': case 'ac2': return <g><rect className={cls} x={-R * 0.26} y={-R * 0.42} width={R * 0.52} height={R * 0.84} rx={R * 0.12} /><text className="gp-ac" textAnchor="middle" dy="0.35em">{b === 'ac1' ? 'K' : 'Q'}</text></g>;
      case 'gf': return <image href={gfArt} x={-R * 0.45} y={-R * 0.45} width={R * 0.9} height={R * 0.9} />;
      case 'station': return <path className={cls} d={`M0,${-R * 0.34} L${R * 0.34},0 L0,${R * 0.34} L${-R * 0.34},0 z`} />;
    }
  };

  const boosterAction = (b: string) => acts.find((a) => (a.type === 'booster' || a.type === 'pass') && a.booster === b);
  const power = (id: string) => acts.filter((a) => a.type === 'power' && a.id === id);
  const specials = of('special');
  const specialKeys = [...new Set(specials.map((a) => String(a.id)))];
  const tokens = Object.entries(view.fedSupply).filter(([, n]) => n > 0).map(([id]) => id);
  const status = view.outcome ? null
    : queued ? 'حرکت شما در حال ثبت است…'
    : myTurn ? (view.decision ? 'تصمیم با شماست' : view.phase === 'faction' ? 'یک جناح انتخاب کنید' : view.phase === 'setup' ? 'یک سازهٔ شروع روی سیارهٔ خانگی خود بگذارید'
      : view.phase === 'booster' ? 'یک تقویت‌کنندهٔ دور انتخاب کنید' : 'نوبت شماست: یک اقدام اصلی (و هر تعداد اقدام آزاد)')
      : `در انتظار ${who(waiting)}`;
  const phaseFa = { faction: 'انتخاب جناح', setup: 'آماده‌سازی', booster: 'انتخاب تقویت‌کننده', actions: `دور ${fa(view.round)} از ۶`, finished: 'پایان بازی' }[view.phase];

  const order = mySeat === null || !view.pl[mySeat] ? view.pl.map((_, i) => i) : [mySeat, ...view.pl.map((_, i) => i).filter((i) => i !== mySeat)];

  return (
    <div className="gp" ref={root} data-seq={view.seq} data-round={view.round}>
      <div className="gp-top">
        {status && <TurnIndicator tone={myTurn && !queued ? 'mine' : 'wait'}>{status} — {phaseFa}</TurnIndicator>}
        <ol className="gp-rounds" aria-label="کاشی‌های امتیاز دور">
          {view.roundTiles.map((t, i) => (
            <li key={t} className={i + 1 === view.round ? 'gp-now' : i + 1 < view.round ? 'gp-past' : undefined} aria-current={i + 1 === view.round ? 'step' : undefined}>
              <small>دور {fa(i + 1)}</small>{CONTENT.rounds[t]?.labelFa ?? t}
            </li>
          ))}
        </ol>
      </div>

      {view.decision && (
        <section className="gp-decide" aria-label="تصمیم">
          <strong>{decisionTitle(view, who)}</strong>
          {myTurn && view.decision.kind !== 'lostPlanet' && (
            <div className="gp-btns">
              {of('decide').map((a, k) => (
                <Button key={k} size="sm" className={hinted(a) ? 'gp-hint' : undefined} variant={hinted(a) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(a)}>{actionFa(view, a)}</Button>
              ))}
            </div>
          )}
        </section>
      )}

      {myTurn && view.phase === 'faction' && (
        <section className="gp-pick" aria-label="جناح‌ها">
          {of('faction').map((a) => {
            const f = CONTENT.factions[a.faction as string]!;
            return (
              <article key={f.id} className="gp-faction">
                <header>{PLANET_ART[f.home] && <img src={PLANET_ART[f.home]} alt="" />}<strong>{f.nameFa}</strong> <bdi>{f.nameEn}</bdi></header>
                <p><small>خانه: {PLANET_FA[f.home]}</small></p>
                <p>{f.abilityFa}</p>
                <p><small>مؤسسه: {f.piFa}</small></p>
                <Button size="sm" className={`gp-faction-pick${hinted(a) ? ' gp-hint' : ''}`} disabled={busy} onClick={() => play(a)}>انتخاب {f.nameFa}</Button>
              </article>
            );
          })}
        </section>
      )}

      <div dir="ltr" className="gp-mapwrap"><ZoomBoard label="نقشهٔ فضا">
        <svg className="gp-map" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="group" aria-label="نقشهٔ فضا">
          {view.hexes.map((h, i) => {
            const c = cs[i]!;
            const can = !busy && (fed ? actionsTurn : hexActs(i).length > 0);
            const owner = h.owner !== null ? who(h.owner) : null;
            const label = `${PLANET_FA[h.planet]}، بخش ${fa(h.sector)}${h.building ? `، ${BUILDING_FA[h.building]} ${owner}` : ''}${h.extra !== null ? `، معدن ${who(h.extra)}` : ''}${h.sats.length ? `، ماهواره ${h.sats.map(who).join('، ')}` : ''}${h.feds.length ? '، در فدراسیون' : ''}${hexActs(i).length && !fed ? '، اقدام ممکن' : ''}`;
            return (
              <g key={i} transform={`translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})`}
                className={['gp-hex', `gp-sector-${h.sector % 2}`, hexActs(i).length && !busy && !fed ? 'gp-hex--legal' : '', hex === i ? 'gp-hex--sel' : '', expectedHex === i || fedHint.has(i) ? 'gp-hex--hint' : '', fed?.includes(i) ? 'gp-hex--fedsel' : ''].filter(Boolean).join(' ')}
                role={can ? 'button' : 'img'} tabIndex={can ? 0 : -1} aria-label={label} aria-pressed={fed ? fed.includes(i) : undefined}
                onClick={() => { if (can) tapHex(i); }}
                onKeyDown={(e) => { if (can && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapHex(i); } }}>
                <polygon points={shape} className="gp-cell" />
                {h.feds.length > 0 && <polygon points={shape} className={`gp-fed gp-seat-${h.feds[0]}`} />}
                {PLANET_ART[h.planet] && <image href={PLANET_ART[h.planet]} x={-R * 0.62} y={-R * 0.62} width={R * 1.24} height={R * 1.24} />}
                {h.building && h.owner !== null && <g data-flip={`st-${i}-${h.building}`} data-flip-from={`seat-${h.owner}`}>{structure(h.building, h.owner)}{h.building !== 'gf' && <text className="gp-own" x={R * 0.5} y={R * 0.62} textAnchor="middle">{fa(h.owner + 1)}</text>}</g>}
                {h.extra !== null && <g data-flip={`ex-${i}`} data-flip-from={`seat-${h.extra}`}><circle r={R * 0.16} cx={R * 0.45} cy={-R * 0.42} className={`gp-st gp-seat-${h.extra}`} /></g>}
                {h.sats.map((s, k) => <g key={s} data-flip={`sat-${i}-${s}`} data-flip-from={`seat-${s}`}><circle r={R * 0.14} cx={-R * 0.36 + k * R * 0.26} cy={R * 0.42} className={`gp-st gp-seat-${s}`} /></g>)}
              </g>
            );
          })}
        </svg>
      </ZoomBoard></div>

      {hex !== null && hexActs(hex).length > 0 && (
        <ActionBar label="اقدام‌های این خانه">
          <div className="gp-hexmenu">
            <span>{PLANET_FA[view.hexes[hex]!.planet]}:</span>
            {hexActs(hex).map((a, k) => (
              <Button key={k} size="sm" className={hinted(a) ? 'gp-hint' : undefined} variant={hinted(a) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(a)}>{actionFa(view, a)}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setHex(null)}>بستن</Button>
          </div>
        </ActionBar>
      )}
      {focus && <p className="gp-note">خانه‌های مجاز روی نقشه روشن شده‌اند. <button type="button" className="gp-link" onClick={() => setFocus(null)}>لغو</button></p>}

      {actionsTurn && !view.decision && (
        <section className="gp-actions" aria-label="اقدام‌ها">
          <div className="gp-block">
            <h3>اقدام‌های قدرت و QIC</h3>
            <div className="gp-pw">
              {POWER_ACTIONS.map((pa) => {
                const list = power(pa.id);
                const used = view.powerUsed.includes(pa.id);
                const hexy = list.some((a) => typeof a.hex === 'number');
                const hint = list.some(hinted) || (expected?.type === 'power' && expected.id === pa.id);
                const click = () => {
                  if (!list.length || busy) return;
                  if (hexy) { setFocus(`power:${pa.id}`); setHex(null); } else if (pa.id === 'qic2') setQic2(!qic2); else play(list[0]!);
                };
                return (
                  <button key={pa.id} type="button" className={['gp-pa', pa.cost.q ? 'gp-pa--q' : '', used ? 'gp-pa--used' : '', hint ? 'gp-hint' : ''].join(' ')}
                    disabled={!list.length || busy} onClick={click} aria-label={`${gainFa(pa.cost)}: ${pa.labelFa}${used ? ' (استفاده‌شده)' : ''}`}>
                    <span className="gp-pa__cost"><img src={pa.cost.q ? rQ : rPw} alt="" />{fa(pa.cost.q ?? pa.cost.pw ?? 0)}</span>
                    <span>{pa.labelFa}</span>
                    {used && <small>استفاده‌شده</small>}
                  </button>
                );
              })}
            </div>
            {qic2 && (
              <div className="gp-btns">
                {power('qic2').map((a, k) => <Button key={k} size="sm" disabled={busy} onClick={() => play(a)}>{fedFa(a.pick as string)}</Button>)}
              </div>
            )}
          </div>

          {(of('research').length > 0 || specialKeys.length > 0) && (
            <div className="gp-block">
              {specialKeys.length > 0 && <h3>اقدام‌های ویژه (هر دور یک بار)</h3>}
              <div className="gp-btns">
                {specialKeys.map((k) => {
                  const list = specials.filter((a) => a.id === k);
                  const hexy = list.some((a) => typeof a.hex === 'number');
                  const hint = list.some(hinted);
                  return <Button key={k} size="sm" className={hint ? 'gp-hint' : undefined} variant={hint ? 'primary' : 'secondary'} disabled={busy}
                    onClick={() => (hexy ? (setFocus(`special:${k}`), setHex(null)) : play(list[0]!))}>{specialFa(k)}{hexy ? ' (روی نقشه)' : ''}</Button>;
                })}
              </div>
            </div>
          )}

          <div className="gp-block">
            <h3>فدراسیون</h3>
            <div className="gp-btns">
              {of('federation').map((a, k) => (
                <Button key={k} size="sm" className={hinted(a) ? 'gp-hint' : undefined} variant={hinted(a) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(a)}>
                  پیشنهاد {fa((a.hexes as number[]).length)} خانه — {fedFa(a.token as string)}
                </Button>
              ))}
              {tokens.length > 0 && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setFed(fed ? null : []); setHex(null); setFocus(null); }}>{fed ? 'لغو انتخاب دستی' : 'انتخاب دستی خانه‌ها'}</Button>
              )}
            </div>
            {fed && (
              <div className="gp-btns">
                <span>سازه‌ها و خانه‌های ماهواره را روی نقشه بزنید ({fa(fed.length)} خانه)، سپس توکن را انتخاب کنید:</span>
                {tokens.map((t) => <Button key={t} size="sm" disabled={busy || !fed.length} onClick={() => play({ type: 'federation', hexes: [...fed].sort((a, b) => a - b), token: t })}>{fedFa(t)}</Button>)}
              </div>
            )}
          </div>

          {(of('convert').length > 0 || of('burn').length > 0) && (
            <div className="gp-block">
              <h3>اقدام‌های آزاد (نوبت را تمام نمی‌کنند)</h3>
              <div className="gp-btns">
                {of('convert').map((a) => <Button key={String(a.id)} size="sm" variant="secondary" className={hinted(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => play(a)}>{CONV_FA[a.id as string] ?? String(a.id)}</Button>)}
                {of('burn').map((a) => <Button key="burn" size="sm" variant="secondary" className={hinted(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => play(a)}>سوزاندن قدرت (۲ ژتون کاسهٔ II ← ۱ ژتون کاسهٔ III)</Button>)}
              </div>
            </div>
          )}

          {acts.some((a) => a.type === 'pass' && a.booster === undefined) && (
            <div className="gp-block">
              {acts.filter((a) => a.type === 'pass' && a.booster === undefined).map((a) => (
                <Button key="pass" className={`gp-pass${hinted(a) ? ' gp-hint' : ''}`} variant={hinted(a) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(a)}>پاس (پایان دور برای شما)</Button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="gp-block" aria-label="تقویت‌کننده‌ها">
        <h3>تقویت‌کننده‌های آزاد{actionsTurn && view.round < 6 ? ' — برای پاس یکی را بردارید' : ''}</h3>
        <div className="gp-boosters">
          {view.boosters.map((b) => {
            const a = boosterAction(b);
            return (
              <div key={b} className="gp-boostcell">
                <BoosterTile id={b} />
                {a && <Button size="sm" className={`${a.type === 'pass' ? 'gp-pass' : 'gp-booster-pick'}${hinted(a) ? ' gp-hint' : ''}`} variant={hinted(a) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(a)}>
                  {a.type === 'pass' ? 'پاس و برداشتن' : 'برداشتن'}
                </Button>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="gp-block gp-research" aria-label="صفحهٔ پژوهش">
        <h3>پژوهش و کاشی‌های فناوری</h3>
        <div className="gp-tracks">
          {TRACKS.map((t, ti) => {
            const ra = acts.find((a) => a.type === 'research' && a.track === t);
            const adv = view.techBoard.adv[ti];
            const std = view.techBoard.std[ti];
            return (
              <div key={t} className="gp-track">
                <div className="gp-track__adv">{adv ? <TechTile id={adv} flip={`tech-${adv}`} /> : <span className="gp-tile gp-tile--empty">—</span>}</div>
                <div className="gp-levels">
                  {[5, 4, 3, 2, 1, 0].map((lvl) => (
                    <div key={lvl} className={`gp-level gp-level--${lvl}`}>
                      <small>{fa(lvl)}</small>
                      {lvl === 5 && t === 'terra' && view.terraFed && <span className="gp-mini" title={fedFa(view.terraFed)}>فدراسیون</span>}
                      {view.pl.map((p, s) => (p.faction && p.research[t] === lvl ? <span key={s} data-flip={`rs-${s}-${t}`} className={`gp-marker gp-seat-${s}`} title={who(s)}>{fa(s + 1)}</span> : null))}
                    </div>
                  ))}
                </div>
                <strong>{TRACK_FA[t]}</strong>
                {ra && <Button size="sm" className={hinted(ra) ? 'gp-hint' : undefined} variant={hinted(ra) ? 'primary' : 'secondary'} disabled={busy} onClick={() => play(ra)}>پژوهش (۴ دانش)</Button>}
                <div className="gp-track__std">{std ? <TechTile id={std} anchor={`std-${std}`} /> : <span className="gp-tile gp-tile--empty">—</span>}</div>
              </div>
            );
          })}
        </div>
        <div className="gp-tiles">
          <small>کاشی‌های آزاد (یک گام در مسیر دلخواه):</small>
          {view.techBoard.std.slice(6).map((t, i) => (t ? <TechTile key={t} id={t} anchor={`std-${t}`} /> : <span key={i} className="gp-tile gp-tile--empty">—</span>))}
        </div>
      </section>

      <section className="gp-block gp-supply" aria-label="ذخیره">
        <div>
          <h3>امتیاز پایانی</h3>
          <ul>{view.finalTiles.map((t) => <li key={t}>{CONTENT.finals[t]?.labelFa ?? t}{view.players === 2 ? ` (خنثی: ${fa(CONTENT.finals[t]?.neutral ?? 0)})` : ''}</li>)}</ul>
        </div>
        <div>
          <h3>توکن‌های فدراسیون</h3>
          <ul data-flip-anchor="fed-supply">
            {Object.entries(view.fedSupply).map(([id, n]) => <li key={id}>{fedFa(id)} × {fa(n)}{CONTENT.feds[id]?.green ? ' (سبز)' : ''}</li>)}
            {view.terraFed && <li>روی زمین‌سازی ۵: {fedFa(view.terraFed)}</li>}
          </ul>
        </div>
      </section>

      <div className="gp-players">
        {order.map((seat) => <PlayerPanel key={seat} view={view} seat={seat} name={seatName(seat)} me={seat === mySeat} waiting={!view.outcome && seat === waiting} />)}
      </div>

      <details className="gp-block gp-log">
        <summary>رویدادهای اخیر</summary>
        <ol>{view.log.slice(-12).reverse().map((e) => <li key={e.seq}>{logFa(e, who)}</li>)}</ol>
      </details>
    </div>
  );
}

function logFa(e: GaiaView['log'][number], who: (s: number) => string): string {
  switch (e.t) {
    case 'faction': return `${who(e.seat)} جناح ${factionFa(e.faction)} را برداشت`;
    case 'place': return `${who(e.seat)} ${BUILDING_FA[e.building]} شروع را گذاشت`;
    case 'booster': return `${who(e.seat)} تقویت‌کننده برداشت: ${boosterFa(e.booster)}`;
    case 'round': return `دور ${fa(e.round)} آغاز شد`;
    case 'mine': return `${who(e.seat)} معدن ساخت${e.steps ? ` (${fa(e.steps)} گام زمین‌سازی)` : ''}`;
    case 'upgrade': return `${who(e.seat)} به ${BUILDING_FA[e.to]} ارتقا داد`;
    case 'gaiaform': return `${who(e.seat)} پروژهٔ گایا را شروع کرد`;
    case 'federation': return `${who(e.seat)} فدراسیون ساخت: ${fedFa(e.token)}`;
    case 'research': return `${who(e.seat)} در ${TRACK_FA[e.track]} به سطح ${fa(e.level)} رسید`;
    case 'power': return `${who(e.seat)} اقدام قدرت: ${POWER_ACTIONS.find((p) => p.id === e.action)?.labelFa ?? e.action}`;
    case 'special': return `${who(e.seat)} اقدام ویژه: ${specialFa(e.action)}`;
    case 'convert': return `${who(e.seat)} تبدیل: ${e.id === 'burn' ? 'سوزاندن قدرت' : CONV_FA[e.id] ?? e.id}`;
    case 'leech': return `${who(e.seat)} ${fa(e.amount)} قدرت گرفت (${fa(e.vp)} امتیاز)`;
    case 'decline': return `${who(e.seat)} قدرت را نپذیرفت`;
    case 'tech': return `${who(e.seat)} کاشی گرفت: ${techFa(e.tech)}`;
    case 'pass': return `${who(e.seat)} پاس داد`;
    case 'vp': return `${who(e.seat)} ${fa(e.n)} امتیاز`;
    case 'final': return `امتیاز نهایی ${who(e.seat)}: ${fa(e.vp)}`;
    case 'timeout': return `زمان ${who(e.seat)} تمام شد`;
    case 'left': return `${who(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌علت تأخیر خارج شد'}`;
  }
}
