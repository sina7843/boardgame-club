// Gaia Project table renderer. Everything in Gaia Project is public, so every panel shows every player's state; only
// the legal actions offered come from the viewer's own seat. Layout: status + open decision, the space map (SVG,
// dir="ltr" — spatial coordinates), the action area (power/QIC actions, specials, free actions, federation builder,
// boosters/pass), the research board with tech tiles, and one panel per player. Hex actions (mine, upgrade, gaia
// project, power/booster/faction actions with a target) are chosen by tapping a highlighted hex, then a button.
// Motion: useFlip moves tech tiles and boosters between board and player, new structures fade in, numbers pop.
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ActionBar, Button, TurnIndicator, ZoomBoard, fa, useFlip, usePop, type GameAction, type GameRendererProps } from '@bg/ui';
import {
  BASE_CONVERSIONS, BUILD_COST, BUILDING_FA, CAP, GAIA_TOKENS, RANGE, RESEARCH_INCOME, TERRAFORM_ORE, WHEEL, wheelDistance, CONTENT, HEX_SIZE, LIMIT, PLANET_FA, POWER_ACTIONS, RES_FA, TRACKS, TRACK_FA, hexCenter,
  type Building, type FactionDef, type Gain, type GaiaView, type Planet, type PlayerState, type Track
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
import bR from './art/board-r.webp';
import bO from './art/board-o.webp';
import bV from './art/board-v.webp';
import bD from './art/board-d.webp';
import bS from './art/board-s.webp';
import bT from './art/board-t.webp';
import bI from './art/board-i.webp';
import bN from './art/board-n.webp';
// Faction portraits: one Higgsfield sheet cut into 14 squares (see DECISIONS.md).
import tTerra from './art/track-terra.webp';
import tNav from './art/track-nav.webp';
import tAi from './art/track-ai.webp';
import tGaia from './art/track-gaia.webp';
import tEco from './art/track-eco.webp';
import tSci from './art/track-sci.webp';
import bgNebula from './art/bg-nebula.webp';
import bgPanel from './art/bg-panel.webp';
import bgStars from './art/bg-stars.webp';
import fTerrans from './art/faction-terrans.webp';
import fLantids from './art/faction-lantids.webp';
import fHadschHallas from './art/faction-hadsch-hallas.webp';
import fIvits from './art/faction-ivits.webp';
import fGeodens from './art/faction-geodens.webp';
import fBalTaks from './art/faction-bal-taks.webp';
import fXenos from './art/faction-xenos.webp';
import fGleens from './art/faction-gleens.webp';
import fAmbas from './art/faction-ambas.webp';
import fTaklons from './art/faction-taklons.webp';
import fFiraks from './art/faction-firaks.webp';
import fBescods from './art/faction-bescods.webp';
import fItars from './art/faction-itars.webp';
import fNevlas from './art/faction-nevlas.webp';

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
    : <span key={k} className={`gp-res gp-res--${k}`} title={RES_FA[k]}><i aria-hidden="true">{k === 'vp' ? '★' : k === 't' ? '●' : '◆'}</i>{fa(v)}<span className="sr-only"> {RES_FA[k]}</span></span>))}</span>;
}

/** When a tile's effect happens, read from its label prefix ("فوری: …"), with the symbol printed on the real tiles. */
const WHEN: [prefix: string, sym: string, cls: string][] = [['فوری', '⚡', 'now'], ['درآمد', '⟳', 'inc'], ['هنگام پاس', '⏏', 'pass'], ['اقدام', '▶', 'act']];
function splitLabel(label: string): { head: string | null; sym: string | null; cls: string; text: string } {
  const i = label.indexOf(':');
  if (i < 0) return { head: null, sym: null, cls: 'always', text: label };
  const head = label.slice(0, i).trim();
  const w = WHEN.find(([pre]) => head === pre);
  return { head, sym: w?.[1] ?? null, cls: w?.[2] ?? 'trigger', text: label.slice(i + 1).trim() };
}

/** A label laid out like a printed tile: the timing symbol in a corner badge, the effect large. */
function TileFace({ label }: { label: string }) {
  const { head, sym, cls, text } = splitLabel(label);
  return (
    <>
      {head && <span className={`gp-when gp-when--${cls}`}>{sym && <i aria-hidden="true">{sym}</i>}{head}</span>}
      <span className="gp-tile__text">{text}</span>
    </>
  );
}

function TechTile({ id, covered, hint, flip, from, anchor }: { id: string; covered?: boolean; hint?: boolean; flip?: string; from?: string; anchor?: string }) {
  const t = CONTENT.techs[id];
  return (
    <span data-flip={flip} data-flip-from={from} data-flip-anchor={anchor} title={techFa(id)}
      className={['gp-tile', 'gp-tile--tech', t?.kind === 'adv' ? 'gp-tile--adv' : '', covered ? 'gp-tile--covered' : '', hint ? 'gp-hint' : ''].join(' ')}>
      <small className="gp-tile__kind">{t?.kind === 'adv' ? 'فناوری پیشرفته' : 'فناوری'}</small>
      <TileFace label={techFa(id)} />{covered && <em className="gp-tile__cover">پوشیده</em>}
    </span>
  );
}

function BoosterTile({ id }: { id: string }) {
  const b = CONTENT.boosters[id];
  const rest = boosterFa(id).split('؛').slice(1).join('؛').trim();
  return (
    <span data-flip={`boost-${id}`} className="gp-tile gp-tile--boost" title={boosterFa(id)}>
      <small className="gp-tile__kind">تقویت‌کننده</small>
      {b && <span className="gp-boost__inc"><GainIcons g={b.income} /></span>}
      {rest && <TileFace label={rest} />}
    </span>
  );
}

/** Federation token: a hexagon with its reward, green border when it can open level 5 of a research track. */
function FedToken({ id, n }: { id: string; n?: number }) {
  const t = CONTENT.feds[id];
  return (
    <span className={`gp-fedtok${t?.green ? ' gp-fedtok--green' : ''}`} title={`${fedFa(id)}${t?.green ? ' (سبز)' : ''}`}>
      {t ? <GainIcons g={t.gain} /> : fedFa(id)}
      {n !== undefined && <small className="gp-fedtok__n">×{fa(n)}</small>}
    </span>
  );
}

// ---------------- faction board ----------------
// The printed faction board, redrawn: base income, structure tracks whose still-unbuilt pieces sit on (and hide) the
// income they unlock, the power cycle (bowls I → II → III and the gaia area), resources, gaiaformers, the PI and the
// academies, and the faction ability. Board texture = the faction's home-planet colour (the two factions of one planet
// share it, as on the printed boards). All numbers come from the view and the content definitions.

/** Total ore by mine count — mirrors the mine row of `incomeOf` in rules.ts, so the 3rd mine slot shows nothing, as on
 *  the printed board. */
const MINE_TOTAL_ORE = [0, 1, 2, 2, 3, 4, 5, 6, 7];
/** Printed defaults used by `incomeOf` / the QIC academy action when a faction does not override them. */
const DEFAULT_BOARD = {
  base: { o: 1, k: 1 } as Gain, ts: [{ c: 3 }, { c: 4 }, { c: 4 }, { c: 5 }] as Gain[], lab: [{ k: 1 }, { k: 1 }, { k: 1 }] as Gain[],
  pi: { pw: 4, t: 1 } as Gain, ac1: { k: 2 } as Gain, ac2: { q: 1 } as Gain
};
const FACTION_ART: Record<string, string> = {
  'terrans': fTerrans, 'lantids': fLantids, 'hadsch-hallas': fHadschHallas, 'ivits': fIvits, 'geodens': fGeodens, 'bal-taks': fBalTaks, 'xenos': fXenos, 'gleens': fGleens, 'ambas': fAmbas, 'taklons': fTaklons, 'firaks': fFiraks, 'bescods': fBescods, 'itars': fItars, 'nevlas': fNevlas
};
const TRACK_ART: Record<Track, string> = { terra: tTerra, nav: tNav, ai: tAi, gaia: tGaia, eco: tEco, sci: tSci };
const BOARD_ART: Record<string, string> = { r: bR, o: bO, v: bV, d: bD, s: bS, t: bT, i: bI };
const LIGHT_BOARD = new Set(['d', 'i', 't']);

type Kind = 'mine' | 'ts' | 'lab' | 'pi' | 'ac';
const KIND_FA: Record<Kind, string> = { mine: 'معدن', ts: 'ایستگاه تجاری', lab: 'آزمایشگاه پژوهشی', pi: 'مؤسسهٔ سیاره‌ای', ac: 'آکادمی' };

/** Structure piece, drawn like its map counterpart. */
function Piece({ kind }: { kind: Kind }) {
  return (
    <svg className="gpb-piece" viewBox="-10 -10 20 20" aria-hidden="true">
      {kind === 'mine' && <path d="M-6,6.5 v-6.8 l6,-5.6 l6,5.6 v6.8 z" />}
      {kind === 'ts' && <rect x="-6.5" y="-6.5" width="13" height="13" rx="1.4" />}
      {kind === 'lab' && <circle r="7" />}
      {kind === 'pi' && <rect x="-8.5" y="-7" width="17" height="14" rx="4.5" />}
      {kind === 'ac' && <rect x="-5.5" y="-8.5" width="11" height="17" rx="2.6" />}
    </svg>
  );
}

/** Icon + number chips for an income/action gain (full wording in the title). */
function SlotGain({ g }: { g: Gain }) {
  const parts = Object.entries(g).filter(([, v]) => v) as [keyof Gain, number][];
  if (!parts.length) return <span className="gpb-none">—</span>;
  return (
    <span className="gpb-gain" title={gainFa(g)}>
      {parts.map(([k, v]) => (
        <span key={k} className={`gpb-chip gpb-chip--${k}`}>
          {k in RES_ART ? <img src={RES_ART[k as keyof typeof RES_ART]} alt="" draggable={false} /> : <i className="gpb-sym" aria-hidden="true">{k === 't' ? '●' : '★'}</i>}
          {fa(v)}
        </span>
      ))}
    </span>
  );
}

/** Build cost printed at the start of each structure row. */
function Cost({ g, note }: { g: Gain; note?: string }) {
  return <span className="gpb-cost" aria-label={`هزینهٔ ساخت: ${gainFa(g)}${note ? `، ${note}` : ''}`}><SlotGain g={g} />{note && <small aria-hidden="true">{note}</small>}</span>;
}

function Slot({ kind, built, income, n }: { kind: Kind; built: boolean; income: Gain; n: number }) {
  return (
    <li className={`gpb-slot${built ? ' gpb-slot--built' : ''}`} aria-label={`${KIND_FA[kind]} ${fa(n)}: ${built ? 'ساخته شده، درآمد آشکار' : 'هنوز روی صفحه'} — ${gainFa(income)}`}>
      <SlotGain g={income} />
      {built ? <span className="gpb-check" aria-hidden="true">✓</span> : <Piece kind={kind} />}
    </li>
  );
}

function Track({ kind, total, built, incomes, cost, costNote }: { kind: Kind; total: number; built: number; incomes: Gain[]; cost?: Gain; costNote?: string }) {
  return (
    <div className={`gpb-track gpb-track--${kind}`}>
      <div className="gpb-track__head"><Piece kind={kind} /><span>{KIND_FA[kind]}</span><small>{fa(built)}/{fa(total)}</small>{cost && <Cost g={cost} note={costNote} />}</div>
      <ol className="gpb-slots" style={{ '--n': total } as CSSProperties}>
        {Array.from({ length: total }, (_, i) => <Slot key={i} kind={kind} n={i + 1} built={i < built} income={incomes[i] ?? {}} />)}
      </ol>
    </div>
  );
}

/** Tokens are numbered in cycle order (gaia area, I, II, III), so a charge moves the last token of bowl I into bowl II
 *  and useFlip slides it across; spending moves tokens from III back round to I. */
function PowerCycle({ p, seat }: { p: PlayerState; seat: number }) {
  const { b1, b2, b3, gaia, brain } = p.power;
  const first = { 0: 0, 1: gaia, 2: gaia + b1, 3: gaia + b1 + b2 } as const;
  const bowl = (n: number, b: 1 | 2 | 3 | 0, label: string) => (
    <div className={`gpb-bowl gpb-bowl--${b}`} role="img" aria-label={`${label}: ${fa(n)} ژتون${brain === b ? '، به‌علاوهٔ سنگ مغز' : ''}`}>
      <small aria-hidden="true">{label}</small>
      <span className="gpb-tokens" aria-hidden="true">
        {brain === b && <i className="gpb-brain" title="سنگ مغز" />}
        {Array.from({ length: Math.min(n, 12) }, (_, i) => <i key={first[b] + i} data-flip={`pw-${seat}-${first[b] + i}`} />)}
        {n > 12 && <em>…</em>}
      </span>
      <Num value={n} label={label} />
    </div>
  );
  return (
    <div className="gpb-plate gpb-power" aria-label="چرخهٔ قدرت">
      <h4>چرخهٔ قدرت</h4>
      <div className="gpb-cycle">
        <svg className="gpb-cycle__ring" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id="gpb-arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" /></marker></defs>
          <path d="M30,66 Q50,80 70,66" markerEnd="url(#gpb-arrowhead)" />
          <path d="M80,52 Q86,26 62,16" markerEnd="url(#gpb-arrowhead)" />
          <path d="M38,16 Q14,26 20,52" markerEnd="url(#gpb-arrowhead)" />
        </svg>
        {bowl(b1, 1, 'کاسهٔ I')}
        {bowl(b2, 2, 'کاسهٔ II')}
        {bowl(b3, 3, 'کاسهٔ III')}
      </div>
      {bowl(gaia, 0, 'ناحیهٔ گایا')}
      {brain !== null && <p className="gpb-note"><i className="gpb-brain" aria-hidden="true" /> سنگ مغز در {brain === 0 ? 'ناحیهٔ گایا' : `کاسهٔ ${['', 'I', 'II', 'III'][brain]}`}</p>}
    </div>
  );
}

/** What reaching each research level gives — mirrors advance(), RANGE, TERRAFORM_ORE, GAIA_TOKENS and RESEARCH_INCOME
 *  in core.ts. `now`: one-time gain; `inc`: income while on the level; `note`: a standing value (cost/range). */
function levelInfo(t: Track, lvl: number): { now?: Gain; inc?: Gain; note?: string } {
  const charge3: Gain | undefined = lvl === 3 ? { pw: 3 } : undefined;
  switch (t) {
    case 'terra': return { now: lvl === 1 || lvl === 4 ? { o: 2 } : charge3, note: lvl === 5 ? 'توکن فدراسیون' : `${fa(TERRAFORM_ORE[lvl]!)} سنگ/گام` };
    case 'nav': return { now: lvl === 1 || lvl === 3 ? { q: 1, ...charge3 } : undefined, note: lvl === 5 ? `برد ${fa(RANGE[lvl]!)} · سیارهٔ گمشده` : `برد ${fa(RANGE[lvl]!)}` };
    case 'ai': return { now: lvl ? { q: [0, 1, 1, 2, 2, 4][lvl]!, ...charge3 } : undefined };
    case 'gaia': return {
      now: lvl === 2 ? { t: 3 } : lvl === 5 ? { vp: 4 } : charge3,
      note: lvl === 5 ? '+۱ امتیاز هر سیارهٔ گایا' : lvl === 1 || lvl === 3 || lvl === 4 ? `+گایاساز · ${fa(GAIA_TOKENS(lvl))} ژتون` : lvl ? `${fa(GAIA_TOKENS(lvl))} ژتون` : undefined
    };
    case 'eco': return lvl === 5 ? { now: { c: 6, o: 3, pw: 6 } } : { inc: RESEARCH_INCOME.eco[lvl], now: charge3 };
    case 'sci': return lvl === 5 ? { now: { k: 9 } } : { inc: RESEARCH_INCOME.sci[lvl], now: charge3 };
  }
}
const nonEmpty = (g?: Gain) => !!g && Object.values(g).some(Boolean);
const levelFa = (t: Track, lvl: number) => {
  const i = levelInfo(t, lvl);
  return [nonEmpty(i.now) && `فوری ${gainFa(i.now!)}`, nonEmpty(i.inc) && `درآمد ${gainFa(i.inc!)}`, i.note].filter(Boolean).join('، ');
};

function LevelInfo({ t, lvl }: { t: Track; lvl: number }) {
  const i = levelInfo(t, lvl);
  return (
    <span className="gp-lvl__info" aria-hidden="true">
      {nonEmpty(i.now) && <span className="gp-lvl__now"><GainIcons g={i.now!} /></span>}
      {nonEmpty(i.inc) && <span className="gp-lvl__inc"><i>⟳</i><GainIcons g={i.inc!} /></span>}
      {i.note && <small>{i.note}</small>}
    </span>
  );
}

/** The printed terraforming wheel: the seven home planet types around the faction's home planet (top), each with its
 *  terraforming steps and — beyond the printed board — the mine's current ore at the player's terraforming level.
 *  Gaia and transdim planets sit in the middle. Mirrors minePlan in core.ts (range QIC not included). */
function TerraWheel({ f, terra }: { f: FactionDef; terra: number }) {
  const per = TERRAFORM_ORE[terra]!;
  const start = WHEEL.indexOf(f.home);
  const ring = WHEEL.map((_, k) => WHEEL[(start + k) % WHEEL.length]!);
  const R = 70;
  // Gleens pay 1 ore instead of the gaia QIC (their mineCost effect in content/factions-b.ts).
  const gaia: Gain = f.id === 'gleens' ? { c: BUILD_COST.mine.c, o: BUILD_COST.mine.o + 1 } : { ...BUILD_COST.mine, q: 1 };
  const costFa = (pl: Planet) => {
    const steps = wheelDistance(f.home, pl);
    return `${PLANET_FA[pl]}: ${steps ? `${fa(steps)} گام` : 'سیارهٔ خانه'} — ${gainFa({ c: BUILD_COST.mine.c, o: BUILD_COST.mine.o + steps * per })}`;
  };
  return (
    <div className="gpb-plate gpb-terra" aria-label="چرخهٔ زمین‌سازی">
      <h4>زمین‌سازی <small>— هر گام {fa(per)} سنگ معدن</small></h4>
      <svg className="gpb-wheel" viewBox="-104 -104 208 208" aria-hidden="true">
        <circle r={R} className="gpb-wheel__ring" />
        {ring.map((pl, k) => {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / ring.length;
          const steps = wheelDistance(f.home, pl);
          return (
            <g key={pl} transform={`translate(${(R * Math.cos(a)).toFixed(1)} ${(R * Math.sin(a)).toFixed(1)})`} className={steps ? 'gpb-wheel__p' : 'gpb-wheel__p gpb-wheel__p--home'}>
              <circle r="19" className="gpb-wheel__halo" />
              <image href={PLANET_ART[pl]} x="-16" y="-16" width="32" height="32" />
              <circle cx="15" cy="-14" r="8" className="gpb-wheel__steps" />
              <text x="15" y="-10.5" className="gpb-wheel__stepsN">{steps ? fa(steps) : '★'}</text>
              <image href={rO} x="-15" y="18" width="12" height="12" />
              <text x="-1" y="28.5" className="gpb-wheel__cost">{fa(BUILD_COST.mine.o + steps * per)}</text>
            </g>
          );
        })}
        <g transform="translate(-22 -6)">
          <image href={PLANET_ART.g} x="-14" y="-14" width="28" height="28" />
          <text y="26" className="gpb-wheel__mid">{gaia.q ? `${fa(gaia.q)} QIC` : `${fa(gaia.o ?? 0)} سنگ`}</text>
        </g>
        <g transform="translate(22 -6)">
          <image href={PLANET_ART.m} x="-14" y="-14" width="28" height="28" />
          <image href={gfArt} x="-8" y="14" width="16" height="16" />
        </g>
      </svg>
      <p className="gpb-text">معدن: {fa(BUILD_COST.mine.c)} اعتبار + سنگ معدنِ زیر هر سیاره · گایا: {gainFa(gaia)} · فرابُعدی: اول گایاساز</p>
      <ul className="sr-only">{ring.map((pl) => <li key={pl}>{costFa(pl)}</li>)}<li>{PLANET_FA.g}: {gainFa(gaia)}</li><li>{PLANET_FA.m}: با گایاساز</li></ul>
    </div>
  );
}

/** Numbered resource tracks as printed (credits 0–30, ore and knowledge 0–15); the marker sits on the current value. */
function ResTrack({ k, n, max, seat }: { k: 'c' | 'o' | 'k'; n: number; max: number; seat: number }) {
  return (
    <div className={`gpb-rtrack gpb-rtrack--${k}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={n} aria-label={RES_FA[k]}>
      <span className="gpb-rtrack__head"><img src={RES_ART[k]} alt="" draggable={false} /><small>{RES_FA[k]}</small><Num value={n} label={RES_FA[k]} /></span>
      <ol aria-hidden="true">
        {Array.from({ length: max + 1 }, (_, i) => <li key={i} className={i === n ? 'on' : undefined}>{i === n ? <img src={RES_ART[k]} alt="" draggable={false} data-flip={`res-${seat}-${k}`} /> : fa(i)}</li>)}
      </ol>
    </div>
  );
}

function Header({ view, seat, name, me, f }: { view: GaiaView; seat: number; name: string; me: boolean; f: FactionDef | undefined }) {
  const p = view.pl[seat]!;
  const left = !view.active[seat];
  const place = view.outcome?.placements.find((x) => x.seat === seat)?.place;
  return (
    <span className="gpb-head">
      <span className={`gp-swatch gp-seat-${seat}`} title={`صندلی ${fa(seat + 1)}`}>{fa(seat + 1)}</span>
      {f && <span className="gpb-avatar">
        {FACTION_ART[f.id] && <img className="gpb-portrait" src={FACTION_ART[f.id]} alt="" draggable={false} />}
        {PLANET_ART[f.home] && <img className="gpb-home" src={PLANET_ART[f.home]} alt={PLANET_FA[f.home]} title={`سیارهٔ خانه: ${PLANET_FA[f.home]}`} />}
      </span>}
      <span className="gpb-who">
        <strong><bdi>{name}</bdi>{me && ' (شما)'}</strong>
        <span>{f ? <>{f.nameFa} <bdi className="gpb-en">{f.nameEn}</bdi></> : 'بدون جناح'}</span>
      </span>
      {p.passed && !left && <span className="gp-tag">پاس داده</span>}
      {left && <span className="gp-tag">خارج شده</span>}
      {place && <span className="gp-tag">رتبهٔ {fa(place)}</span>}
      <span className="gp-vp" title="امتیاز">★ <Num value={p.vp} label="امتیاز" /></span>
    </span>
  );
}

/** Opponent summary line (shown while the board is folded): resources and bowls at a glance. */
function Glance({ p }: { p: PlayerState }) {
  return (
    <span className="gpb-glance">
      <Res k="c" n={p.c} /><Res k="o" n={p.o} /><Res k="k" n={p.k} /><Res k="q" n={p.q} />
      <span className="gpb-mini-bowls" title="کاسه‌های قدرت I · II · III">
        <img src={rPw} alt="" />{fa(p.power.b1)}·{fa(p.power.b2)}·{fa(p.power.b3)}
      </span>
    </span>
  );
}

function FactionBoard({ view, seat, f, compact }: { view: GaiaView; seat: number; f: FactionDef; compact: boolean }) {
  const p = view.pl[seat]!;
  // Same counting as countBuilding in core.ts: the Lost Planet mine does not come from the board.
  const count = (b: Kind) => view.hexes.filter((h) => (b === 'mine'
    ? (h.owner === seat && h.building === 'mine' && h.planet !== 'l') || h.extra === seat
    : h.owner === seat && (b === 'ac' ? h.building === 'ac1' || h.building === 'ac2' : h.building === b))).length;
  const has = (b: Building) => view.hexes.some((h) => h.owner === seat && h.building === b);
  const gfUsed = p.gfGaia + view.hexes.filter((h) => h.owner === seat && h.building === 'gf').length;
  const mines = MINE_TOTAL_ORE.slice(1, LIMIT.mine + 1).map((o, i): Gain => ({ o: o - MINE_TOTAL_ORE[i]! }));
  const b = f.buildings ?? {};
  const ac1 = b.ac1 ?? DEFAULT_BOARD.ac1, ac2 = b.ac2Action ?? DEFAULT_BOARD.ac2, ac2Used = p.used.includes('ac2');
  return (
    <div className="gpb-body">
      <div className="gpb-col">
        <TerraWheel f={f} terra={p.research.terra} />
        <PowerCycle p={p} seat={seat} />
        <div className="gpb-plate gpb-gf" aria-label="گایاسازها و ماهواره‌ها">
          <h4>گایاساز و ماهواره</h4>
          <ol className="gpb-gfslots">
            {[0, 1, 2].map((i) => {
              const k = i >= p.gf ? 'locked' : i < p.gf - gfUsed ? 'free' : 'used';
              const state = { locked: 'قفل', free: 'آزاد', used: 'در کار' }[k];
              return (
                <li key={i} className={`gpb-gfslot gpb-gfslot--${k}`} aria-label={`گایاساز ${fa(i + 1)}: ${state}`}>
                  {k === 'free' ? <img src={gfArt} alt="" /> : <span aria-hidden="true">{k === 'locked' ? '🔒' : '⟳'}</span>}<small>{state}</small>
                </li>
              );
            })}
          </ol>
          <p className="gpb-note">ماهواره‌های گذاشته‌شده: <Num value={p.satellites} label="ماهواره" /></p>
        </div>
      </div>
      <div className="gpb-col">
        <div className="gpb-plate gpb-structs" aria-label="سازه‌ها و درآمدشان">
          <h4>سازه‌ها <small>— هر سازهٔ ساخته‌شده درآمد زیرش را آشکار می‌کند</small></h4>
          <div className="gpb-baseinc"><span>درآمد پایه</span><SlotGain g={f.income ?? DEFAULT_BOARD.base} /></div>
          <Track kind="mine" total={LIMIT.mine} built={count('mine')} incomes={mines} cost={BUILD_COST.mine} costNote="+ زمین‌سازی" />
          <Track kind="ts" total={LIMIT.ts} built={count('ts')} incomes={b.ts ?? DEFAULT_BOARD.ts} cost={BUILD_COST.ts} costNote={`بی‌همسایه ${fa(BUILD_COST.tsAlone.c)}`} />
          <Track kind="lab" total={LIMIT.lab} built={count('lab')} incomes={b.lab ?? DEFAULT_BOARD.lab} cost={BUILD_COST.lab} />
          <div className="gpb-big">
            <div className="gpb-track gpb-track--pi">
              <div className="gpb-track__head"><Piece kind="pi" /><span>مؤسسهٔ سیاره‌ای</span><Cost g={b.piCost ?? BUILD_COST.pi} /></div>
              <ol className="gpb-slots"><Slot kind="pi" n={1} built={has('pi')} income={b.pi ?? DEFAULT_BOARD.pi} /></ol>
              {!compact && <p className="gpb-text">{f.piFa}</p>}
            </div>
            <div className="gpb-track gpb-track--ac">
              <div className="gpb-track__head"><Piece kind="ac" /><span>آکادمی‌ها</span><Cost g={BUILD_COST.ac} /></div>
              <ol className="gpb-slots">
                <li className={`gpb-slot${has('ac1') ? ' gpb-slot--built' : ''}`} aria-label={`آکادمی دانش: ${has('ac1') ? 'ساخته شده' : 'هنوز روی صفحه'} — درآمد ${gainFa(ac1)}`}>
                  <small className="gpb-cap">درآمد</small><SlotGain g={ac1} />{has('ac1') ? <span className="gpb-check" aria-hidden="true">✓</span> : <Piece kind="ac" />}
                </li>
                <li className={`gpb-slot${has('ac2') ? ' gpb-slot--built' : ''}${ac2Used ? ' gpb-slot--spent' : ''}`} aria-label={`آکادمی QIC: ${has('ac2') ? 'ساخته شده' : 'هنوز روی صفحه'} — اقدام ${gainFa(ac2)}${ac2Used ? '، این دور استفاده شده' : ''}`}>
                  <small className="gpb-cap">اقدام</small><SlotGain g={ac2} />{has('ac2') ? <span className="gpb-check" aria-hidden="true">{ac2Used ? '✕' : '✓'}</span> : <Piece kind="ac" />}
                </li>
              </ol>
            </div>
          </div>
        </div>
        {compact ? (
          <details className="gpb-plate gpb-ability">
            <summary>توانایی جناح و مؤسسه</summary>
            <p>{f.abilityFa}</p>
            <p><strong>مؤسسهٔ سیاره‌ای:</strong> {f.piFa}</p>
          </details>
        ) : (
          <div className="gpb-plate gpb-ability" aria-label="توانایی جناح">
            {FACTION_ART[f.id] && <img className="gpb-art" src={FACTION_ART[f.id]} alt={`نگارهٔ ${f.nameFa}`} draggable={false} />}
            <h4>توانایی جناح</h4>
            <p>{f.abilityFa}</p>
          </div>
        )}
        <div className="gpb-plate gpb-res" aria-label="منابع">
          <h4>منابع</h4>
          {(['c', 'o', 'k'] as const).map((k) => <ResTrack key={k} k={k} n={p[k]} max={CAP[k]} seat={seat} />)}
          <div className="gpb-qic" aria-label={`${RES_FA.q}: ${fa(p.q)}`}>
            <small>{RES_FA.q}</small><Num value={p.q} label={RES_FA.q} />
            <span aria-hidden="true">{Array.from({ length: Math.min(p.q, 10) }, (_, i) => <img key={i} src={RES_ART.q} alt="" draggable={false} />)}</span>
          </div>
        </div>
      </div>
      <div className="gpb-plate gpb-foot">
        {view.active[seat] && <p className="gp-line"><strong>درآمد دور بعد:</strong> <GainIcons g={view.income[seat] ?? {}} /></p>}
        <div className="gp-tiles">
          {p.booster && <BoosterTile id={p.booster} />}
          {p.techs.map((t) => (CONTENT.techs[t.id]?.kind === 'adv'
            ? <TechTile key={t.id} id={t.id} covered={t.covered} flip={`tech-${t.id}`} />
            : <TechTile key={t.id} id={t.id} covered={t.covered} flip={`tech-${seat}-${t.id}`} from={`std-${t.id}`} />))}
          {p.feds.map((x, i) => <span key={i} data-flip={`fed-${seat}-${i}`} data-flip-from="fed-supply" className={`gp-fedtok${x.green ? ' gp-fedtok--green' : ''}`} aria-label={`فدراسیون${x.green ? ' (سبز)' : ''}: ${fedFa(x.id)}`}>{CONTENT.feds[x.id] ? <GainIcons g={CONTENT.feds[x.id]!.gain} /> : fedFa(x.id)}</span>)}
          {!p.booster && !p.techs.length && !p.feds.length && <small className="gpb-note">هنوز کاشی‌ای ندارد</small>}
        </div>
      </div>
    </div>
  );
}

const wideScreen = () => (typeof matchMedia === 'function' ? matchMedia('(min-width: 720px)').matches : true);

function PlayerPanel({ view, seat, name, me, waiting }: { view: GaiaView; seat: number; name: string; me: boolean; waiting: boolean }) {
  const p = view.pl[seat]!;
  const f = p.faction ? CONTENT.factions[p.faction] : undefined;
  const [open] = useState(wideScreen);
  const home = f?.home ?? 'n';
  const cls = ['gp-player', 'gpb', `gpb--${home}`, LIGHT_BOARD.has(home) ? 'gpb--light' : '', me ? 'gp-player--me' : 'gpb--compact', waiting ? 'gp-player--current' : ''].filter(Boolean).join(' ');
  const style = { '--art': `url(${BOARD_ART[home] ?? bN})` } as CSSProperties;
  const header = <Header view={view} seat={seat} name={name} me={me} f={f} />;
  const body = f ? <FactionBoard view={view} seat={seat} f={f} compact={!me} /> : <p className="gpb-plate gpb-note">هنوز جناحی انتخاب نشده است.</p>;
  return (
    <section data-flip-anchor={`seat-${seat}`} className={cls} style={style} aria-label={`صفحهٔ جناح ${name}`}>
      {me ? <>{header}{body}</> : (
        <details className="gpb-fold" open={open}>
          <summary>{header}<Glance p={p} /></summary>
          {body}
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

  // Sector borders: a hex edge is drawn when the neighbour across it is in another sector or off the map. Edge k joins
  // corners k and k+1 of a flat-top hex; its neighbour is the axial step NB[k].
  const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
  const at = new Map(view.hexes.map((h, i) => [`${h.q},${h.r}`, i]));
  const across = (i: number, k: number) => at.get(`${view.hexes[i]!.q + NB[k]![0]},${view.hexes[i]!.r + NB[k]![1]}`);
  const pt = (i: number, k: number) => { const a = (Math.PI / 3) * (k % 6); return `${(cs[i]!.x + HEX_SIZE * Math.cos(a)).toFixed(2)},${(cs[i]!.y + HEX_SIZE * Math.sin(a)).toFixed(2)}`; };
  const borders = view.hexes.flatMap((h, i) => NB.flatMap((_, k) => {
    const j = across(i, k);
    return j === undefined || (view.hexes[j]!.sector !== h.sector && j > i) ? [`M${pt(i, k)}L${pt(i, k + 1)}`] : [];
  })).join('');
  const sectors = [...new Set(view.hexes.map((h) => h.sector))].map((sec) => {
    const own = view.hexes.flatMap((h, i) => (h.sector === sec ? [cs[i]!] : []));
    return { sec, x: own.reduce((a, c) => a + c.x, 0) / own.length, y: own.reduce((a, c) => a + c.y, 0) / own.length };
  });
  // Federation links between neighbouring hexes of the same player's federations.
  const fedLinks = view.hexes.flatMap((h, i) => h.feds.flatMap((seat) => NB.slice(0, 3).flatMap((_, k) => {
    const j = across(i, k);
    return j !== undefined && view.hexes[j]!.feds.includes(seat) ? [{ seat, a: cs[i]!, b: cs[j]! }] : [];
  })));

  const structure = (b: Building, owner: number) => {
    const cls = `gp-st gp-seat-${owner}`;
    return <g>{shapeOf(b, cls)}{b !== 'gf' && shapeOf(b, 'gp-shine')}</g>;
  };
  const shapeOf = (b: Building, cls: string) => {
    switch (b) {
      case 'mine': return <path className={cls} d={`M${-R * 0.28},${R * 0.3} v${-R * 0.32} l${R * 0.28},${-R * 0.26} l${R * 0.28},${R * 0.26} v${R * 0.32} z`} />;
      case 'ts': return <rect className={cls} x={-R * 0.3} y={-R * 0.3} width={R * 0.6} height={R * 0.6} rx={R * 0.06} />;
      case 'lab': return <circle className={cls} r={R * 0.32} />;
      case 'pi': return <rect className={cls} x={-R * 0.42} y={-R * 0.34} width={R * 0.84} height={R * 0.68} rx={R * 0.22} />;
      case 'ac1': case 'ac2': return <g><rect className={cls} x={-R * 0.26} y={-R * 0.42} width={R * 0.52} height={R * 0.84} rx={R * 0.12} />{cls !== 'gp-shine' && <text className="gp-ac" textAnchor="middle" dy="0.35em">{b === 'ac1' ? 'K' : 'Q'}</text>}</g>;
      case 'gf': return cls === 'gp-shine' ? null : <image href={gfArt} x={-R * 0.45} y={-R * 0.45} width={R * 0.9} height={R * 0.9} />;
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
    <div className="gp" ref={root} data-seq={view.seq} data-round={view.round} style={{ '--gp-panel': `url(${bgPanel})`, '--gp-stars': `url(${bgStars})`, '--gp-nebula': `url(${bgNebula})` } as CSSProperties}>
      <div className="gp-top">
        {status && <TurnIndicator tone={myTurn && !queued ? 'mine' : 'wait'}>{status} — {phaseFa}</TurnIndicator>}
        <ol className="gp-rounds" aria-label="کاشی‌های امتیاز دور">
          {view.roundTiles.map((t, i) => (
            <li key={t} className={i + 1 === view.round ? 'gp-now' : i + 1 < view.round ? 'gp-past' : undefined} aria-current={i + 1 === view.round ? 'step' : undefined}>
              <span className="gp-round__n">{fa(i + 1)}</span><TileFace label={CONTENT.rounds[t]?.labelFa ?? t} />
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
                <header>{FACTION_ART[f.id] && <img className="gp-faction__art" src={FACTION_ART[f.id]} alt="" />}{PLANET_ART[f.home] && <img src={PLANET_ART[f.home]} alt="" />}<strong>{f.nameFa}</strong> <bdi>{f.nameEn}</bdi></header>
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
          <defs>
            <linearGradient id="gp-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0.08" /><stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </linearGradient>
            <radialGradient id="gp-planet-glow"><stop offset="0.55" stopColor="#9fd8ff" stopOpacity="0.28" /><stop offset="1" stopColor="#9fd8ff" stopOpacity="0" /></radialGradient>
          </defs>
          {sectors.map(({ sec, x, y }) => <text key={sec} x={x} y={y} className="gp-sector-n" textAnchor="middle" dy="0.35em" aria-hidden="true">{fa(sec)}</text>)}
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
                {PLANET_ART[h.planet] && <circle r={R * 0.78} fill="url(#gp-planet-glow)" />}
                {PLANET_ART[h.planet] && <image href={PLANET_ART[h.planet]} x={-R * 0.62} y={-R * 0.62} width={R * 1.24} height={R * 1.24} />}
                {h.building && h.owner !== null && <g data-flip={`st-${i}-${h.building}`} data-flip-from={`seat-${h.owner}`}>{structure(h.building, h.owner)}{h.building !== 'gf' && <text className="gp-own" x={R * 0.5} y={R * 0.62} textAnchor="middle">{fa(h.owner + 1)}</text>}</g>}
                {h.extra !== null && <g data-flip={`ex-${i}`} data-flip-from={`seat-${h.extra}`}><circle r={R * 0.16} cx={R * 0.45} cy={-R * 0.42} className={`gp-st gp-seat-${h.extra}`} /></g>}
                {h.sats.map((s, k) => <g key={s} data-flip={`sat-${i}-${s}`} data-flip-from={`seat-${s}`}><circle r={R * 0.14} cx={-R * 0.36 + k * R * 0.26} cy={R * 0.42} className={`gp-st gp-seat-${s}`} /></g>)}
              </g>
            );
          })}
          <path d={borders} className="gp-borders" aria-hidden="true" />
          {fedLinks.map((l, k) => <line key={k} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} className={`gp-fedlink gp-seat-${l.seat}`} aria-hidden="true" />)}
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

      {view.phase === 'actions' && (
        <section className="gp-actions" aria-label="اقدام‌ها">
          <div className="gp-block gp-pwboard">
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
                    disabled={!list.length || busy || view.decision !== null} onClick={click} aria-label={`${gainFa(pa.cost)}: ${pa.labelFa}${used ? ' (استفاده‌شده)' : ''}`}>
                    <span className="gp-pa__cost"><img src={pa.cost.q ? rQ : rPw} alt="" />{fa(pa.cost.q ?? pa.cost.pw ?? 0)}</span>
                    <span className="gp-pa__label">{pa.labelFa}</span>
                    {used && <span className="gp-pa__used" aria-hidden="true">✕</span>}
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

          {actionsTurn && !view.decision && (of('research').length > 0 || specialKeys.length > 0) && (
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

          {actionsTurn && !view.decision && <div className="gp-block">
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
          </div>}

          {actionsTurn && !view.decision && (of('convert').length > 0 || of('burn').length > 0) && (
            <div className="gp-block">
              <h3>اقدام‌های آزاد (نوبت را تمام نمی‌کنند)</h3>
              <div className="gp-btns">
                {of('convert').map((a) => <Button key={String(a.id)} size="sm" variant="secondary" className={hinted(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => play(a)}>{CONV_FA[a.id as string] ?? String(a.id)}</Button>)}
                {of('burn').map((a) => <Button key="burn" size="sm" variant="secondary" className={hinted(a) ? 'gp-hint' : undefined} disabled={busy} onClick={() => play(a)}>سوزاندن قدرت (۲ ژتون کاسهٔ II ← ۱ ژتون کاسهٔ III)</Button>)}
              </div>
            </div>
          )}

          {actionsTurn && !view.decision && acts.some((a) => a.type === 'pass' && a.booster === undefined) && (
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
              <div key={t} className={`gp-track gp-track--${t}`}>
                <div className="gp-track__adv">{adv ? <TechTile id={adv} flip={`tech-${adv}`} /> : <span className="gp-tile gp-tile--empty">—</span>}</div>
                <div className="gp-track__emblem"><img src={TRACK_ART[t]} alt="" draggable={false} /><strong>{TRACK_FA[t]}</strong></div>
                <div className="gp-levels">
                  {[5, 4, 3, 2, 1, 0].map((lvl) => (
                    <div key={lvl} className={`gp-level gp-level--${lvl}`} aria-label={`${TRACK_FA[t]} سطح ${fa(lvl)}: ${levelFa(t, lvl) || 'شروع'}`}>
                      <small className="gp-lvl">{fa(lvl)}</small>
                      {lvl === 5 && t === 'terra' && view.terraFed ? <FedToken id={view.terraFed} /> : <LevelInfo t={t} lvl={lvl} />}
                      <span className="gp-lvl__marks">
                        {view.pl.map((p, s) => (p.faction && p.research[t] === lvl ? <span key={s} data-flip={`rs-${s}-${t}`} className={`gp-marker gp-seat-${s}`} title={who(s)}>{fa(s + 1)}</span> : null))}
                      </span>
                    </div>
                  ))}
                </div>
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
          <ul className="gp-finals">{view.finalTiles.map((t) => (
            <li key={t} className="gp-tile gp-tile--final"><span className="gp-final__vp" aria-hidden="true">۱۸ ★</span>{CONTENT.finals[t]?.labelFa ?? t}
              {view.players === 2 && <small>بازیکن خنثی: {fa(CONTENT.finals[t]?.neutral ?? 0)}</small>}</li>
          ))}</ul>
        </div>
        <div>
          <h3>توکن‌های فدراسیون</h3>
          <ul className="gp-feds" data-flip-anchor="fed-supply">
            {Object.entries(view.fedSupply).map(([id, n]) => <li key={id} aria-label={`${fedFa(id)} × ${fa(n)}${CONTENT.feds[id]?.green ? ' (سبز)' : ''}`}><FedToken id={id} n={n} /></li>)}
            {view.terraFed && <li aria-label={`روی زمین‌سازی ۵: ${fedFa(view.terraFed)}`}><FedToken id={view.terraFed} /><small>زمین‌سازی ۵</small></li>}
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
