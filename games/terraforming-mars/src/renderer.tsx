// Terraforming Mars table: global parameter gauges, the Tharsis map (dir="ltr", spatial, keyboard operable), milestones,
// awards and standard projects, the decision panel (every prompt kind, corporation / draft / research picks, a payment
// picker for steel / titanium / Helion heat), the viewer's hand, and every player's public tableau. Only what the
// server projected is shown: other players' hands are counts, prompts of others show only who is deciding.
// Motion: cards glide hand → tableau (useFlip), new tiles land (useFresh), changed numbers pop (usePop).
import './renderer.css';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Button, TurnIndicator, useFlip, useFresh, usePop, usePrevious, type GameAction, type GameRendererProps, DockSlot } from '@bg/ui';
import { hexX } from './board.ts';
import { BOARD_ART, CARDRES_ART, MARS_ART, PARAM_ART, RES_ART, TILE_ART } from './art.ts';
import {
  AWARD_COSTS, AWARDS, CARD, MARS, MILESTONE_COST, MILESTONES, NAME_FA, PROJECT_FA, RES, RES_FA, SPACE, CARDRES_FA, OCEANS_MAX, OXY_MAX, TEMP_MAX, TEMP_MIN, PROJECTS,
  type CardDef, type Project, type Req, type Res, type Tag, type TmView
} from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const sfa = (n: number) => (n < 0 ? `${fa(-n)}−` : n > 0 ? `${fa(n)}+` : fa(0));
const TAG_FA: Record<Tag, string> = { building: 'ساختمان', space: 'فضا', science: 'علم', power: 'انرژی', earth: 'زمین', jovian: 'مشتری', plant: 'گیاه', microbe: 'میکروب', animal: 'جانور', city: 'شهر' };
const PHASE_FA: Record<TmView['phase'], string> = { corp: 'انتخاب شرکت', draft: 'درفت', research: 'پژوهش', action: 'کنش‌ها', final: 'دور پایانی فضای سبز', end: 'پایان بازی' };
const TILE_FA = { greenery: 'فضای سبز', ocean: 'اقیانوس', city: 'شهر', special: 'کاشی ویژه' } as const;
const BONUS_FA = { steel: 'فولاد', titanium: 'تیتانیوم', plants: 'گیاه', card: 'کارت' } as const;
const KIND_FA = { automated: 'خودکار', active: 'فعال', event: 'رویداد', corporation: 'شرکت' } as const;
const LOG_FA: Record<string, string> = { pass: 'پاس داد', endTurn: 'نوبتش را تمام کرد', convertPlants: 'گیاه را فضای سبز کرد', convertHeat: 'گرما را به دما تبدیل کرد', firstAction: 'کنش اول شرکت', play: 'بازی کرد', cardAction: 'کنش کارت', project: 'پروژهٔ استاندارد', milestone: 'نقطهٔ عطف ثبت کرد', award: 'جایزه تأمین کرد' };
const PROJECT_FX: Record<Project, string> = { sellPatents: 'هر کارت ← ۱ مگاکردیت', powerPlant: '۱+ تولید انرژی', asteroid: '۱+ پلهٔ دما', aquifer: 'یک اقیانوس', greenery: 'فضای سبز · ۱+ اکسیژن', city: 'شهر · ۱+ تولید مگاکردیت' };
const name = (id: string) => CARD[id]?.nameFa ?? id;

function reqText(r: Req | undefined): string {
  if (!r) return '';
  const out: string[] = [];
  const rng = (label: string, x: { min?: number; max?: number } | undefined, unit = '') => {
    if (x?.min !== undefined) out.push(`${label} دست‌کم ${sfa(x.min)}${unit}`);
    if (x?.max !== undefined) out.push(`${label} حداکثر ${sfa(x.max)}${unit}`);
  };
  rng('دما', r.temperature, '°'); rng('اکسیژن', r.oxygen, '٪'); rng('اقیانوس', r.oceans);
  for (const [t, n] of Object.entries(r.tags ?? {})) out.push(`${fa(n)} نشان ${TAG_FA[t as Tag]}`);
  for (const [x, n] of Object.entries(r.prod ?? {})) out.push(`تولید ${RES_FA[x as Res]} ${fa(n)}`);
  if (r.cities !== undefined) out.push(`${fa(r.cities)} شهر در بازی`);
  if (r.greeneries !== undefined) out.push(`${fa(r.greeneries)} فضای سبز خودتان`);
  return out.join('، ');
}
const vpText = (c: CardDef) => (c.vp === undefined ? '' : typeof c.vp === 'number' ? (c.vp ? `${sfa(c.vp)} امتیاز` : '') : 'امتیاز متغیر');

const TAG_GLYPH: Record<Tag, string> = { building: '⚒', space: '✦', science: '⚛', power: '⚡', earth: '⊕', jovian: '♃', plant: '❦', microbe: '✺', animal: '✥', city: '▦' };

function Card({ id, res, on, onClick, disabled, note, hint, flip, from, exit, children }: { id: string; flip?: boolean; from?: string; exit?: string; res?: number; on?: boolean; onClick?: () => void; disabled?: boolean; note?: string; hint?: boolean; children?: ReactNode }) {
  const c = CARD[id];
  if (!c) return null;
  const req = reqText(c.req);
  const vp = vpText(c);
  // The printed card: coloured title band with the cost coin and the round tag icons, requirement banner, text, VP badge at the foot.
  const body = (
    <>
      <span className="tm-card__top">
        {c.kind !== 'corporation' && <span className="tm-card__cost" aria-label={`هزینه ${fa(c.cost)}`}>{fa(c.cost)}</span>}
        <b className="tm-card__title">{c.nameFa}</b>
        {c.tags.length > 0 && <span className="tm-card__tags">{c.tags.map((t, i) => <span key={i} role="img" aria-label={TAG_FA[t]} title={TAG_FA[t]} className={`tm-tagdot tm-tag--${t}`}>{TAG_GLYPH[t]}</span>)}</span>}
      </span>
      {req && <span className="tm-card__req">شرط: {req}</span>}
      <span className="tm-card__text">{c.textFa}</span>
      {res !== undefined && c.resource && (
        <span className="tm-card__res"><img src={CARDRES_ART[c.resource]} alt="" />{fa(res)} {CARDRES_FA[c.resource]}</span>
      )}
      {note && <span className="tm-card__note">{note}</span>}
      {children}
      <span className="tm-card__foot">
        <span className="tm-card__name"><bdi>{c.name}</bdi> · {KIND_FA[c.kind]}{c.kind !== 'corporation' ? ` · ${fa(Number(c.id))}` : ''}</span>
        {vp && <span className="tm-card__vp">{vp}</span>}
      </span>
    </>
  );
  const cls = `tm-card tm-card--${c.kind}${on ? ' tm-card--on' : ''}${hint ? ' tm-hint' : ''}`;
  const fl = flip ? { 'data-flip': `card-${id}`, 'data-flip-from': from, 'data-flip-exit': exit } : {};
  return onClick
    ? <button type="button" className={cls} aria-pressed={on} disabled={disabled} onClick={onClick} {...fl}>{body}</button>
    : <div className={cls} {...fl}>{body}</div>;
}

// Printed marks on the global tracks (mirrors core.raise): +1 heat production at -24 and -20 °C, an ocean at 0 °C,
// +1 temperature step at 8 % oxygen.
const TEMP_STEPS = Array.from({ length: (TEMP_MAX - TEMP_MIN) / 2 + 1 }, (_, i) => TEMP_MAX - 2 * i);
const OXY_STEPS = Array.from({ length: OXY_MAX + 1 }, (_, i) => OXY_MAX - i);
const TR_RULER = 100, TR_COLS = 10;

function Track({ label, art, steps, value, unit, pop, signed, hue, mark }: { label: string; art: string; steps: number[]; value: number; unit: string; pop: string; signed?: boolean; hue: [number, number]; mark: (v: number) => ReactNode }) {
  const f = signed ? sfa : fa;
  const lo = steps[steps.length - 1]!, hi = steps[0]!;
  return (
    <div className="tm-gp__col" role="meter" aria-label={label} aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={value} aria-valuetext={`${label} ${f(value)}${unit} از ${f(hi)}${unit}`}>
      <span className="tm-gp__head"><img src={art} alt="" /><span>{label}</span><b key={value} className={pop}>{f(value)}{unit}</b></span>
      <ol className="tm-gp__track" dir="ltr" aria-hidden="true">
        {steps.map((v, i) => (
          <li key={v} className={`tm-gp__cell${v <= value ? ' is-on' : ''}${v === value ? ' is-cur' : ''}`} style={{ '--c': `hsl(${Math.round(hue[0] + ((hue[1] - hue[0]) * (steps.length - 1 - i)) / (steps.length - 1))} 65% 48%)` } as CSSProperties}>
            <span className="tm-gp__n">{f(v)}</span><span className="tm-gp__bar" /><span className="tm-gp__mk">{mark(v)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Params({ view, seatName, pops }: { view: TmView; seatName: (k: number) => string; pops: { t: string; o: string; w: string } }) {
  const heat = <img src={RES_ART.heat} alt="" title="+۱ تولید گرما" />;
  return (
    <section className="tm-params" aria-label="پارامترهای جهانی">
      <div className="tm-gp">
        <Track label="دما" art={PARAM_ART.temperature} steps={TEMP_STEPS} value={view.temperature} unit="°" pop={pops.t} signed hue={[215, 365]}
          mark={(v) => (v === -24 || v === -20 ? <>{heat}<small>۱+</small></> : v === 0 ? <><img src={TILE_ART.ocean} alt="" title="اقیانوس" /><small>۱+</small></> : null)} />
        <Track label="اکسیژن" art={PARAM_ART.oxygen} steps={OXY_STEPS} value={view.oxygen} unit="٪" pop={pops.o} hue={[200, 120]}
          mark={(v) => (v === 8 ? <><img src={PARAM_ART.temperature} alt="" title="+۱ پلهٔ دما" /><small>۱+</small></> : null)} />
        <div className="tm-gp__col" role="meter" aria-label="اقیانوس" aria-valuemin={0} aria-valuemax={OCEANS_MAX} aria-valuenow={view.oceans} aria-valuetext={`اقیانوس ${fa(view.oceans)} از ${fa(OCEANS_MAX)}`}>
          <span className="tm-gp__head"><img src={PARAM_ART.ocean} alt="" /><span>اقیانوس</span><b key={view.oceans} className={pops.w}>{fa(view.oceans)}/{fa(OCEANS_MAX)}</b></span>
          <ol className="tm-gp__oceans" aria-hidden="true">
            {Array.from({ length: OCEANS_MAX }, (_, i) => <li key={i} className={i < view.oceans ? 'is-on' : ''}>{i < view.oceans ? <img src={TILE_ART.ocean} alt="" /> : <span>{fa(i + 1)}</span>}</li>)}
          </ol>
        </div>
        <div className="tm-gp__col tm-gp__tr" role="group" aria-label="مسیر رتبهٔ ترافورمینگ">
          <span className="tm-gp__head"><span>رتبهٔ ترافورمینگ</span><b>نسل {fa(view.generation)}</b></span>
          <ol className="tm-trg" dir="ltr" aria-hidden="true">
            {Array.from({ length: TR_RULER }, (_, i) => (TR_RULER / TR_COLS - 1 - Math.floor(i / TR_COLS)) * TR_COLS + (i % TR_COLS) + 1).map((v) => {
              const who = view.players.flatMap((p, k) => (Math.min(TR_RULER, Math.max(1, p.tr)) === v ? [k] : []));
              const bg = who.length ? `linear-gradient(90deg, ${who.map((k, j) => `var(--s${k}) ${Math.round((100 * j) / who.length)}% ${Math.round((100 * (j + 1)) / who.length)}%`).join(', ')})` : undefined;
              return <li key={v} className={`tm-trg__c${who.length ? ' is-on' : ''}${v % 10 === 0 ? ' is-ten' : ''}`} style={bg ? { background: bg } : undefined}>{fa(v)}</li>;
            })}
          </ol>
          <ul className="tm-trg__who">
            {view.players.map((p, k) => <li key={k}><i className={`tm-plaque__cube tm-seat-${k}`} aria-hidden="true" /><bdi>{seatName(k)}</bdi> <b>{fa(p.tr)}</b></li>)}
          </ul>
        </div>
      </div>
      <p className="tm-gp__legend">علامت‌ها: <img src={RES_ART.heat} alt="" /> ۱+ تولید گرما در ‎−۲۴° و ‎−۲۰° · <img src={TILE_ART.ocean} alt="" /> اقیانوس در ‎۰° · <img src={PARAM_ART.temperature} alt="" /> ۱+ پلهٔ دما در اکسیژن ۸٪</p>
    </section>
  );
}

/** Placement bonus drawn as the printed board does: brown steel cube, black titanium cube, green plant disc, blue card. */
function BonusShape({ kind, x, y, z }: { kind: keyof typeof BONUS_FA; x: number; y: number; z: number }) {
  const h = z / 2;
  switch (kind) {
    case 'steel': return <rect x={x - h} y={y - h} width={z} height={z} rx="1.2" className="tm-bn tm-bn--steel" />;
    case 'titanium': return <rect x={x - h} y={y - h} width={z} height={z} rx="1.2" className="tm-bn tm-bn--titanium" />;
    case 'plants': return <circle cx={x} cy={y} r={h} className="tm-bn tm-bn--plants" />;
    default: return <rect x={x - h * 0.75} y={y - h} width={z * 0.75} height={z} rx="1" className="tm-bn tm-bn--card" />;
  }
}

function Board({ view, pick, hint, onPick, seatName }: { view: TmView; pick: Set<string>; hint: string | null; onPick: (id: string) => void; seatName: (k: number) => string }) {
  const r = 22, w = Math.sqrt(3) * r;
  const xs = MARS.map((s) => hexX(s));
  const minX = Math.min(...xs);
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return `${(r * 0.94 * Math.cos(a)).toFixed(1)},${(r * 0.94 * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const fresh = useFresh(Object.keys(view.tiles).sort());
  const tileLabel = (id: string) => {
    const t = view.tiles[id];
    if (!t) return '';
    return `، ${t.card ? name(t.card) : TILE_FA[t.kind]}${t.owner !== null ? ' از ' + seatName(t.owner) : ''}`;
  };
  const keys = (id: string) => ({
    role: 'button', tabIndex: 0, onClick: () => onPick(id),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } }
  });
  return (
    <div className="tm-board" dir="ltr" style={{ backgroundImage: `url(${MARS_ART})` }}>
      <svg viewBox={`${-w / 2 - 2} ${-r - 2} ${((Math.max(...xs) - minX) * w) / 2 + w + 4} ${8 * 1.5 * r + 2 * r + 4}`} role="group" aria-label="نقشهٔ تارسیس">
        <defs><clipPath id="tm-hexclip"><polygon points={pts} /></clipPath></defs>
        {MARS.map((s) => {
          const t = view.tiles[s.id];
          const x = ((hexX(s) - minX) * w) / 2, y = s.row * 1.5 * r;
          const can = pick.has(s.id);
          const claim = view.claims[s.id];
          const label = `${s.name ? NAME_FA[s.name] + '، ' : ''}ناحیهٔ ${fa(Number(s.id))}${s.ocean ? ' (اقیانوسی)' : ''}${!t && s.bonus.length ? '، پاداش ' + s.bonus.map((b) => BONUS_FA[b]).join(' و ') : ''}${tileLabel(s.id)}${claim !== undefined ? '، نشانه‌گذاری ' + seatName(claim) : ''}`;
          return (
            <g key={s.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <g className={`tm-hex${s.ocean ? ' tm-hex--ocean' : ''}${s.name ? ' tm-hex--named' : ''}${t ? ` tm-hex--${t.kind}` : ''}${can ? ' tm-hex--pick' : ''}${hint === s.id ? ' tm-hint' : ''}${fresh.has(s.id) ? ' bg-pop' : ''}`}
                data-space={s.id} {...(can ? keys(s.id) : {})} aria-label={label}>
                <polygon points={pts} className="tm-hex__base" />
                {t && <image href={TILE_ART[t.kind]} x={-r} y={-r} width={2 * r} height={2 * r} clipPath="url(#tm-hexclip)" preserveAspectRatio="xMidYMid slice" />}
                {t && t.owner !== null && <><circle r="6.5" className={`tm-cube tm-seat-${t.owner}`} /><text y="3" className="tm-cube__n">{fa(t.owner + 1)}</text></>}
                {!t && s.ocean && <path d="M-7 7 q3.5 -4 7 0 t7 0" className="tm-hex__wave" />}
                {!t && s.bonus.map((b, i) => { const z = s.bonus.length > 2 ? 7 : 9, gap = z + 2.5; return <BonusShape key={i} kind={b} x={(i - (s.bonus.length - 1) / 2) * gap} y={s.ocean ? -3 : -1} z={z} />; })}
                {!t && s.name && <text y="14" className="tm-hex__name">{NAME_FA[s.name]!.split(' ')[0]}</text>}
                {claim !== undefined && <><circle r="5" cy="-13" className={`tm-cube tm-seat-${claim}`} /><text y="-10.5" className="tm-cube__n">{fa(claim + 1)}</text></>}
                <polygon points={pts} className="tm-hex__edge" />
              </g>
            </g>
          );
        })}
      </svg>
      <div className="tm-offmap" dir="rtl">
        {(['01', '02'] as const).map((id) => {
          const t = view.tiles[id];
          return (
            <Button key={id} variant="secondary" size="sm" disabled={!pick.has(id)} className={hint === id ? 'tm-hint' : ''} onClick={() => onPick(id)}>
              {NAME_FA[SPACE[id]!.name!]} (بیرون از نقشه){t ? ` — شهر ${seatName(t.owner!)}` : ''}
            </Button>
          );
        })}
      </div>
      <p className="tm-legend" dir="rtl">
        {(Object.keys(BONUS_FA) as (keyof typeof BONUS_FA)[]).map((b) => <span key={b} className="tm-legend__i"><svg viewBox="-7 -7 14 14" width="14" height="14" aria-hidden="true"><BonusShape kind={b} x={0} y={0} z={10} /></svg>{BONUS_FA[b]}</span>)}
        <span className="tm-legend__i"><svg viewBox="-9 -7 18 14" width="18" height="14" aria-hidden="true"><path d="M-7 3 q3.5 -4 7 0 t7 0" className="tm-hex__wave" /></svg>نواحی آبی فقط برای اقیانوس</span>
      </p>
    </div>
  );
}

/** The served view with my queued move applied as far as the client already knows it. */
function previewView(v: TmView, a: GameAction | null, seat: number | null): TmView {
  if (!a || seat === null || !v.me) return v;
  if (a.type === 'play' && typeof a.card === 'string' && v.me.hand.includes(a.card)) {
    const card = a.card;
    return {
      ...v, me: { ...v.me, hand: v.me.hand.filter((x) => x !== card) },
      players: v.players.map((p, k) => (k === seat ? { ...p, hand: p.hand - 1, played: [...p.played, card] } : p))
    };
  }
  const q = v.prompt;
  if (a.type === 'respond' && typeof a.space === 'string' && q?.kind === 'space') {
    if (q.claim) return { ...v, claims: { ...v.claims, [a.space]: seat } };
    return { ...v, tiles: { ...v.tiles, [a.space]: { kind: q.tile, owner: q.tile === 'ocean' ? null : seat, ...(q.card ? { card: q.card } : {}) } } };
  }
  return v;
}

type PayAct = { action: GameAction; cost: number; steel: boolean; titanium: boolean };
type Pay = { steel: number; titanium: number; heat: number };

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="tm-step" role="group" aria-label={label}>
      <span>{label}</span>
      <Button size="sm" variant="secondary" aria-label={`${label} کمتر`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</Button>
      <b>{fa(value)}</b>
      <Button size="sm" variant="secondary" aria-label={`${label} بیشتر`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</Button>
    </span>
  );
}

export default function TerraformingMarsRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<TmView>) {
  const root = useRef<HTMLDivElement>(null);
  // Undo-window preview (kept while the move is in flight): a played card leaves the hand for my tableau, a chosen space
  // gets its tile / claim marker. Effects that depend on hidden or random things (draws, bonuses) wait for the server.
  const held = useRef<{ seq: number; a: GameAction } | null>(null);
  if (queued) held.current = { seq: served.seq, a: queued };
  const preview = queued ?? (busy && held.current?.seq === served.seq ? held.current.a : null);
  if (!preview) held.current = null;
  const view = previewView(served, preview, mySeat);
  const pvCard = preview?.type === 'play' ? String(preview.card) : '';
  const undone = usePrevious(`${served.seq}|${pvCard}`, pvCard); // an undone play comes back from my tableau, not the deck
  useFlip(root, `${view.seq}|${preview ? JSON.stringify(preview) : ''}`);
  const [sel, setSel] = useState<string[]>([]);
  const [corp, setCorp] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [selling, setSelling] = useState(false);
  const [payFor, setPayFor] = useState<PayAct | null>(null);
  const [pay, setPay] = useState<Pay>({ steel: 0, titanium: 0, heat: 0 });
  const prompt = view.prompt;
  useEffect(() => {
    setSel([]); setCorp(null); setSelling(false); setPayFor(null);
    setAmount(prompt?.kind === 'amount' ? prompt.min : 0);
  }, [view.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const hint = expected as (GameAction & { card?: string; project?: string; id?: string; space?: string }) | null;
  const isHint = (a: GameAction) => !!hint && Object.entries(a).every(([k, v]) => hint[k] === v) && Object.keys(hint).every((k) => k in a);
  const send = (a: GameAction) => { setSel([]); setCorp(null); setSelling(false); setPayFor(null); onAction(a); };
  const has = (t: string) => legalActions.find((a) => a.type === t);
  const toggle = (id: string, max = 99) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < max ? [...s, id] : s));
  const me = view.me;
  const meP = mySeat !== null ? view.players[mySeat] : undefined;
  const respond = has('respond') as (GameAction & { options: (string | number)[]; optional: boolean }) | undefined;
  const spacePick = new Set(prompt?.kind === 'space' && respond ? (respond.options as string[]) : []);
  const mine = mySeat !== null && legalActions.some((a) => a.type !== 'resign');
  const plays = legalActions.filter((a) => a.type === 'play');
  const cardActs = legalActions.filter((a) => a.type === 'cardAction');
  const projects = legalActions.filter((a) => a.type === 'project');
  const corpHint = has('corp') as (GameAction & { corps: string[]; cards: string[] }) | undefined;
  const research = has('research') as (GameAction & { cards: string[]; max: number }) | undefined;
  const draft = has('draft') as (GameAction & { cards: string[] }) | undefined;
  const actionTurn = !prompt && mine && (view.phase === 'action' || view.phase === 'final');

  // Payment: steel/titanium values and Helion heat come from the viewer's public tableau (same rule as the server).
  const myTableau = meP ? [...(meP.corp ? [meP.corp] : []), ...meP.played].map((id) => CARD[id]!).filter((c) => c.kind !== 'event') : [];
  const val = { steel: 2 + myTableau.reduce((n, c) => n + (c.steelBonus ?? 0), 0), titanium: 3 + myTableau.reduce((n, c) => n + (c.titaniumBonus ?? 0), 0), heat: myTableau.some((c) => c.heatAsMc) };
  const pmc = payFor ? Math.max(0, payFor.cost - pay.steel * val.steel - pay.titanium * val.titanium - pay.heat) : 0;
  const payOk = !!payFor && !!meP && pmc <= meP.res.mc && pmc + pay.heat <= payFor.cost;
  /** Send an action that costs M€: open the payment picker only when there is a real choice (never in the tutorial). */
  const paid = (action: GameAction, cost: number, steel: boolean, titanium: boolean) => {
    if (!meP) return;
    const alt = (steel && meP.res.steel > 0) || (titanium && meP.res.titanium > 0) || (val.heat && meP.res.heat > 0);
    if (!alt || cost === 0 || hint) { send(action); return; }
    const ti = titanium ? Math.min(meP.res.titanium, Math.floor(cost / val.titanium)) : 0;
    const st = steel ? Math.min(meP.res.steel, Math.floor((cost - ti * val.titanium) / val.steel)) : 0;
    const rest = cost - ti * val.titanium - st * val.steel;
    setPay({ titanium: ti, steel: st, heat: val.heat ? Math.max(0, Math.min(meP.res.heat, rest - meP.res.mc)) : 0 });
    setPayFor({ action, cost, steel, titanium });
  };
  const popTemp = usePop(view.temperature), popOxy = usePop(view.oxygen), popOcean = usePop(view.oceans);

  const status = view.outcome ? 'بازی تمام شد'
    : queued ? 'حرکت شما در حال ثبت است…'
    : prompt ? 'تصمیم بگیرید'
      : mine ? (corpHint ? 'شرکت و کارت‌های آغازین را انتخاب کنید' : draft ? 'یک کارت درفت کنید' : research ? 'کارت‌های پژوهش را بخرید' : view.phase === 'final' ? 'دور پایانی: گیاه را فضای سبز کنید یا پاس بدهید' : view.actionsTaken === 1 ? 'کنش دوم یا پایان نوبت' : 'نوبت شما: ۱ یا ۲ کنش')
        : view.promptSeat !== null ? `در انتظار تصمیم ${seatName(view.promptSeat)}`
          : view.phase === 'corp' || view.phase === 'research' || view.phase === 'draft' ? 'در انتظار انتخاب بقیه' : `نوبت ${seatName(view.current)}`;

  return (
    <div className="tm" ref={root} data-seq={view.seq} data-phase={view.phase}>
      <header className="tm-top">
        <TurnIndicator tone={view.outcome ? 'done' : mine && !queued ? 'mine' : 'wait'}>{status}</TurnIndicator>
        <span className="tm-gen">نسل {fa(view.generation)} · {PHASE_FA[view.phase]} · <span data-flip-anchor="deck">دسته {fa(view.deck)}</span> · <span data-flip-anchor="discard">دورریز {fa(view.discard)}</span></span>
      </header>
      <Params view={view} seatName={seatName} pops={{ t: popTemp, o: popOxy, w: popOcean }} />

      <div className="tm-main">
        <Board view={view} pick={spacePick} hint={hint?.type === 'respond' && hint.space ? hint.space : null} onPick={(id) => !busy && send({ type: 'respond', space: id })} seatName={seatName} />

        <aside className="tm-side">
          {/* ---- decisions ---- */}
          {prompt && respond && (
            <section className="tm-panel tm-prompt" aria-label="تصمیم">
              <b>{prompt.labelFa ?? (prompt.kind === 'space' ? `جای ${TILE_FA[prompt.tile]} را روی نقشه انتخاب کنید` : 'انتخاب کنید')}</b>
              {prompt.kind === 'space' && <small>{fa(spacePick.size)} ناحیهٔ مجاز روی نقشه با قاب زرد مشخص است.</small>}
              <div className="tm-row">
                {prompt.kind === 'player' && prompt.options.map((k) => <Button key={k} disabled={busy} className={isHint({ type: 'respond', seat: k }) ? 'tm-hint' : ''} onClick={() => send({ type: 'respond', seat: k })}><bdi>{seatName(k)}</bdi></Button>)}
                {prompt.kind === 'choice' && prompt.options.map((o, i) => <Button key={i} disabled={busy} className={isHint({ type: 'respond', index: i }) ? 'tm-hint' : ''} onClick={() => send({ type: 'respond', index: i })}>{o}</Button>)}
              </div>
              {prompt.kind === 'card' && <div className="tm-cards">{prompt.options.map((id) => <Card key={id} id={id} hint={isHint({ type: 'respond', card: id })} onClick={() => send({ type: 'respond', card: id })} disabled={busy} />)}</div>}
              {prompt.kind === 'cards' && <>
                <small>{fa(prompt.min)} تا {fa(prompt.max)} کارت انتخاب کنید.</small>
                <div className="tm-cards">{prompt.cards.map((id) => <Card key={id} id={id} on={sel.includes(id)} onClick={() => toggle(id, prompt.max)} />)}</div>
                <Button data-act="cards" disabled={busy || sel.length < prompt.min || sel.length > prompt.max} onClick={() => send({ type: 'respond', cards: sel })}>تأیید ({fa(sel.length)})</Button>
              </>}
              {prompt.kind === 'amount' && <div className="tm-row">
                <Stepper label="مقدار" value={amount} max={prompt.max} onChange={(v) => setAmount(Math.max(prompt.min, v))} />
                <Button data-act="amount" disabled={busy || amount < prompt.min || amount > prompt.max} onClick={() => send({ type: 'respond', amount })}>تأیید</Button>
              </div>}
              {prompt.optional && <Button variant="secondary" data-act="skip" disabled={busy} onClick={() => send({ type: 'respond', skip: true })}>صرف‌نظر</Button>}
            </section>
          )}

          {payFor && meP && (
            <section className="tm-panel tm-pay" aria-label="پرداخت">
              <b>پرداخت {fa(payFor.cost)} مگاکردیت</b>
              <div className="tm-row">
                {payFor.titanium && <Stepper label={`تیتانیوم (×${fa(val.titanium)})`} value={pay.titanium} max={meP.res.titanium} onChange={(v) => setPay({ ...pay, titanium: v })} />}
                {payFor.steel && <Stepper label={`فولاد (×${fa(val.steel)})`} value={pay.steel} max={meP.res.steel} onChange={(v) => setPay({ ...pay, steel: v })} />}
                {val.heat && <Stepper label="گرما (×۱)" value={pay.heat} max={meP.res.heat} onChange={(v) => setPay({ ...pay, heat: v })} />}
              </div>
              <span>مگاکردیت: {fa(pmc)} از {fa(meP.res.mc)}</span>
              {!payOk && <small className="tm-warn">این ترکیب پرداخت ممکن نیست.</small>}
              <div className="tm-row">
                <Button data-act="pay" disabled={busy || !payOk} onClick={() => send({ ...payFor.action, pay: { mc: pmc, ...pay } })}>پرداخت و انجام</Button>
                <Button variant="secondary" onClick={() => setPayFor(null)}>انصراف</Button>
              </div>
            </section>
          )}

          {corpHint && me && (
            <section className="tm-panel" aria-label="انتخاب شرکت">
              <b>یک شرکت انتخاب کنید و کارت‌های آغازین را بخرید (هر کارت ۳ مگاکردیت)</b>
              <div className="tm-cards tm-corps">{corpHint.corps.map((id) => <Card key={id} id={id} on={corp === id} onClick={() => setCorp(id)} />)}</div>
              <div className="tm-cards">{corpHint.cards.map((id) => <Card key={id} id={id} on={sel.includes(id)} onClick={() => toggle(id, 10)} />)}</div>
              <Button data-act="corp" disabled={busy || !corp || 3 * sel.length > (CARD[corp ?? '']?.startMc ?? 0)} onClick={() => send({ type: 'corp', corp, cards: sel })}>
                تأیید ({fa(sel.length)} کارت، {fa(3 * sel.length)} از {fa(CARD[corp ?? '']?.startMc ?? 0)} مگاکردیت)
              </Button>
            </section>
          )}
          {me && !corpHint && view.phase === 'corp' && me.pick && <p className="tm-panel">انتخاب شما ثبت شد: {name(me.pick.corp ?? '')} و {fa(me.pick.cards.length)} کارت.</p>}
          {draft && (
            <section className="tm-panel" aria-label="درفت"><b>یک کارت نگه دارید؛ بقیه به نفر بعد می‌رسد</b>
              {me && me.drafted.length > 0 && <small>درفت‌شده: {me.drafted.map(name).join('، ')}</small>}
              <div className="tm-cards">{draft.cards.map((id) => <Card key={id} id={id} disabled={busy} onClick={() => send({ type: 'draft', card: id })} />)}</div>
            </section>
          )}
          {research && (
            <section className="tm-panel" aria-label="پژوهش"><b>کارت‌هایی که می‌خرید (هر کدام ۳ مگاکردیت، حداکثر {fa(research.max)})</b>
              <div className="tm-cards">{research.cards.map((id) => <Card key={id} id={id} flip exit="discard" on={sel.includes(id)} onClick={() => toggle(id, research.max)} />)}</div>
              <Button data-act="research" disabled={busy} onClick={() => send({ type: 'research', cards: sel })}>خرید {fa(sel.length)} کارت ({fa(3 * sel.length)} مگاکردیت)</Button>
            </section>
          )}

          {actionTurn && !payFor && (
            <section className="tm-panel tm-acts" aria-label="کنش‌ها">
              {has('firstAction') && meP?.corp && <Button disabled={busy} className={isHint({ type: 'firstAction' }) ? 'tm-hint' : ''} data-act="firstAction" onClick={() => send({ type: 'firstAction' })}>کنش اول {name(meP.corp)}</Button>}
              {selling ? (
                <div className="tm-row">
                  <span>کارت‌های دست را برای فروش انتخاب کنید (هر کدام ۱ مگاکردیت).</span>
                  <Button disabled={busy || !sel.length} onClick={() => send({ type: 'project', project: 'sellPatents', cards: sel })}>فروش {fa(sel.length)} کارت</Button>
                  <Button variant="secondary" onClick={() => { setSelling(false); setSel([]); }}>انصراف</Button>
                </div>
              ) : <>
                <div className="tm-row">
                  {has('convertPlants') && <Button disabled={busy} className={isHint({ type: 'convertPlants' }) ? 'tm-hint' : ''} data-act="convertPlants" onClick={() => send({ type: 'convertPlants' })}>گیاه ← فضای سبز</Button>}
                  {has('convertHeat') && <Button disabled={busy} className={isHint({ type: 'convertHeat' }) ? 'tm-hint' : ''} data-act="convertHeat" onClick={() => send({ type: 'convertHeat' })}>۸ گرما ← ۱ پلهٔ دما</Button>}
                  {cardActs.map((a) => {
                    const ad = CARD[a.card as string]!.action!;
                    return <Button key={a.card as string} disabled={busy} className={isHint({ type: 'cardAction', card: a.card }) ? 'tm-hint' : ''}
                      onClick={() => paid({ type: 'cardAction', card: a.card }, a.cost as number, !!ad.payWith?.steel, !!ad.payWith?.titanium)}>کنش «{name(a.card as string)}»{a.cost ? ` (${fa(a.cost as number)})` : ''}</Button>;
                  })}
                </div>
                <div className="tm-row">
                  {has('endTurn') && <DockSlot><Button variant="secondary" disabled={busy} className={isHint({ type: 'endTurn' }) ? 'tm-hint' : ''} data-act="endTurn" onClick={() => send({ type: 'endTurn' })}>پایان نوبت</Button></DockSlot>}
                  {has('pass') && <DockSlot><Button variant="secondary" disabled={busy} className={`tm-pass${isHint({ type: 'pass' }) ? ' tm-hint' : ''}`} data-act="pass" onClick={() => send({ type: 'pass' })}>{view.phase === 'final' ? 'پاس (پایان)' : 'پاس تا نسل بعد'}</Button></DockSlot>}
                </div>
              </>}
            </section>
          )}

          <section className="tm-panel tm-sp" aria-label="پروژه‌های استاندارد">
            <b className="tm-h">پروژه‌های استاندارد</b>
            <ul className="tm-sp__list">
              {(Object.keys(PROJECTS) as Project[]).map((pr) => {
                const a = projects.find((x) => x.project === pr);
                const cost = (a?.cost as number | undefined) ?? PROJECTS[pr];
                const go = () => { if (pr === 'sellPatents') { setSelling(true); setSel([]); } else paid({ type: 'project', project: pr }, cost, false, false); };
                return (
                  <li key={pr}>
                    <button type="button" className={`tm-sp__row${isHint({ type: 'project', project: pr }) ? ' tm-hint' : ''}`} data-act={pr === 'sellPatents' ? undefined : `project-${pr}`} disabled={busy || !a || !!payFor || selling} onClick={go}>
                      <span className="tm-sp__cost" aria-label={pr === 'sellPatents' ? 'بدون هزینه' : `هزینه ${fa(cost)}`}>{pr === 'sellPatents' ? '—' : fa(cost)}</span>
                      <span className="tm-sp__name">{PROJECT_FA[pr]}</span>
                      <small className="tm-sp__fx">{PROJECT_FX[pr]}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="tm-panel tm-goals" aria-label="نقطه‌های عطف و جایزه‌ها">
            <b className="tm-h">نقطه‌های عطف <small>· {fa(MILESTONE_COST)} مگاکردیت · {fa(view.milestones.length)} از ۳ ثبت‌شده</small></b>
            <div className="tm-plaques">{MILESTONES.map((m) => {
              const t = view.milestones.find((x) => x.id === m.id);
              const ok = legalActions.some((a) => a.type === 'milestone' && a.id === m.id);
              return <button type="button" key={m.id} disabled={busy || !ok} aria-label={`${m.nameFa}: ${m.textFa}${t ? '، ثبت‌شده برای ' + seatName(t.seat) : ''}`}
                className={`tm-plaque${ok ? ' tm-plaque--ok' : ''}${t ? ` tm-plaque--taken tm-seat-${t.seat}` : ''}${isHint({ type: 'milestone', id: m.id }) ? ' tm-hint' : ''}`} onClick={() => paid({ type: 'milestone', id: m.id }, MILESTONE_COST, false, false)}>
                <span className="tm-plaque__name">{m.nameFa}</span>
                <small className="tm-plaque__text">{m.textFa}</small>
                <span className="tm-plaque__foot">{t ? <><i className="tm-plaque__cube" aria-hidden="true" /><bdi>{seatName(t.seat)}</bdi></> : <span className="tm-plaque__cost">{fa(MILESTONE_COST)}</span>}</span>
              </button>;
            })}</div>
            <b className="tm-h">جایزه‌ها <small>· {fa(view.awards.length)} از ۳ تأمین‌شده</small>
              <span className="tm-ladder" aria-label={view.awards.length < 3 ? `هزینهٔ بعدی ${fa(AWARD_COSTS[view.awards.length]!)} مگاکردیت` : 'همهٔ جایزه‌ها تأمین شد'}>
                {AWARD_COSTS.map((c, i) => <span key={i} className={i < view.awards.length ? 'is-used' : i === view.awards.length ? 'is-next' : ''}>{fa(c)}</span>)}
              </span>
            </b>
            <div className="tm-plaques">{AWARDS.map((aw) => {
              const t = view.awards.find((x) => x.id === aw.id);
              const ok = legalActions.find((a) => a.type === 'award' && a.id === aw.id);
              return <button type="button" key={aw.id} disabled={busy || !ok} aria-label={`${aw.nameFa}: ${aw.textFa}${t ? '، تأمین‌شده توسط ' + seatName(t.seat) : ''}`}
                className={`tm-plaque tm-plaque--award${ok ? ' tm-plaque--ok' : ''}${t ? ` tm-plaque--taken tm-seat-${t.seat}` : ''}${isHint({ type: 'award', id: aw.id }) ? ' tm-hint' : ''}`} onClick={() => ok && paid({ type: 'award', id: aw.id }, ok.cost as number, false, false)}>
                <span className="tm-plaque__name">{aw.nameFa}</span>
                <small className="tm-plaque__text">{aw.textFa}</small>
                <span className="tm-plaque__foot">{t ? <><i className="tm-plaque__cube" aria-hidden="true" /><bdi>{seatName(t.seat)}</bdi></> : <span className="tm-plaque__cost">{view.awards.length < 3 ? fa(AWARD_COSTS[view.awards.length]!) : '—'}</span>}</span>
              </button>;
            })}</div>
          </section>

          {view.log.length > 0 && (
            <section className="tm-panel tm-log" aria-label="رویدادهای اخیر" aria-live="polite">
              <b>رویدادهای اخیر</b>
              <ol>{view.log.slice(-6).reverse().map((l, i) => (
                <li key={`${view.seq}-${i}`}><bdi>{seatName(l.seat)}</bdi>: {LOG_FA[l.kind] ?? l.kind}{l.card ? ` «${name(l.card)}»` : ''}{l.detail ? ` «${PROJECT_FA[l.detail as Project] ?? MILESTONES.find((m) => m.id === l.detail)?.nameFa ?? AWARDS.find((a) => a.id === l.detail)?.nameFa ?? l.detail}»` : ''}</li>
              ))}</ol>
              {view.revealed && <small>آخرین کارت رو شده: {name(view.revealed)}</small>}
            </section>
          )}
        </aside>
      </div>

      {me && me.hand.length > 0 && (
        <section className="tm-hand" aria-label="دست شما">
          <b>دست شما ({fa(me.hand.length)} کارت){selling ? ' — برای فروش انتخاب کنید' : ''}</b>
          <div className="tm-cards">{me.hand.map((id) => {
            const pl = plays.find((a) => a.card === id);
            const hinted = isHint({ type: 'play', card: id });
            return (
              <Card key={id} id={id} flip from={id === undone ? `seat-${mySeat}` : 'deck'} exit={`seat-${mySeat}`} on={sel.includes(id)} onClick={selling ? () => toggle(id) : undefined} note={pl ? `هزینهٔ شما ${fa(pl.cost as number)}` : undefined}>
                {pl && !selling && <Button size="sm" disabled={busy} className={hinted ? 'tm-hint' : ''} onClick={() => paid({ type: 'play', card: id }, pl.cost as number, !!pl.steel, !!pl.titanium)}>بازی</Button>}
              </Card>
            );
          })}</div>
        </section>
      )}

      <section className="tm-players" aria-label="بازیکنان">
        {view.players.map((p, k) => (
          <PlayerPanel key={k} k={k} p={p} view={view} seatName={seatName} me={k === mySeat} />
        ))}
      </section>

      {view.outcome && (
        <section className="tm-panel tm-result" aria-label="امتیاز پایانی">
          <table>
            <thead><tr><th scope="col">رتبه</th><th scope="col">بازیکن</th><th scope="col">TR</th><th scope="col">نقطهٔ عطف</th><th scope="col">جایزه</th><th scope="col">فضای سبز</th><th scope="col">شهر</th><th scope="col">کارت</th><th scope="col">جمع</th><th scope="col">مگاکردیت</th></tr></thead>
            <tbody>{view.outcome.placements.map((pl) => {
              const sc = view.players[pl.seat]!.score;
              return <tr key={pl.seat}><td>{fa(pl.place)}</td><td><bdi>{seatName(pl.seat)}</bdi></td><td>{fa(sc.tr)}</td><td>{fa(sc.milestones)}</td><td>{fa(sc.awards)}</td><td>{fa(sc.greenery)}</td><td>{fa(sc.city)}</td><td>{fa(sc.cards)}</td><td><b>{fa(sc.total)}</b></td><td>{fa(view.players[pl.seat]!.res.mc)}</td></tr>;
            })}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** Is the viewport wide enough to open opponents' boards by default (phones start with the collapsed summary). */
const wideScreen = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 720px)').matches;

function PlayerPanel({ k, p, view, seatName, me }: { k: number; p: TmView['players'][number]; view: TmView; seatName: (k: number) => string; me: boolean }) {
  const popTr = usePop(p.tr);
  const [open, setOpen] = useState(() => me || wideScreen());
  const cards = [...(p.corp ? [p.corp] : []), ...p.played];
  const active = cards.filter((id) => CARD[id]!.kind !== 'event');
  const events = cards.filter((id) => CARD[id]!.kind === 'event');
  const tags = new Map<Tag, number>();
  for (const id of active) for (const t of CARD[id]!.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  // Conversion rates printed on the real board, adjusted by this player's public tableau (same rule as the server).
  const defs = active.map((id) => CARD[id]!);
  const rate = {
    steel: 2 + defs.reduce((n, c) => n + (c.steelBonus ?? 0), 0), titanium: 3 + defs.reduce((n, c) => n + (c.titaniumBonus ?? 0), 0),
    plants: Math.min(8, ...defs.map((c) => c.greeneryPlants ?? 8)), heatPays: defs.some((c) => c.heatAsMc)
  };
  const rule: Record<Res, string> = {
    mc: `درآمد نسل = تولید + رتبه (${sfa(p.prod.mc + p.tr)})`,
    steel: `هر فولاد = ${fa(rate.steel)} مگاکردیت در ساختمان`,
    titanium: `هر تیتانیوم = ${fa(rate.titanium)} مگاکردیت در فضا`,
    plants: `${fa(rate.plants)} گیاه ← ۱ فضای سبز`,
    energy: 'انرژی باقی‌مانده ← گرما در تولید',
    heat: `۸ گرما ← ۱ پلهٔ دما${rate.heatPays ? ' · پرداخت به‌جای مگاکردیت' : ''}`
  };
  const cur = !view.outcome && (view.phase === 'action' || view.phase === 'final') && k === view.current;
  const corp = p.corp ? CARD[p.corp] : undefined;
  const head = (
    <>
      <span className={`tm-cube tm-seat-${k}`} aria-hidden="true" />
      <b className="tm-pb__name"><bdi>{seatName(k)}</bdi>{me ? ' (شما)' : ''}</b>
      <span className="tm-pb__corp">{corp ? <>{corp.nameFa} <small><bdi>{corp.name}</bdi></small></> : 'بدون شرکت'}</span>
      <span key={p.tr} className={`tm-pb__tr ${popTr}`} style={{ backgroundImage: `url(${BOARD_ART.tr})` }} aria-label={`رتبهٔ ترافورمینگ ${fa(p.tr)}`}>
        <span className={`tm-pb__trcube tm-seat-${k}`} aria-hidden="true" />رتبه <b>{fa(p.tr)}</b>
      </span>
      <span className="tm-pb__meta" title={`TR ${p.score.tr} + نقطهٔ عطف ${p.score.milestones} + جایزه ${p.score.awards} + فضای سبز ${p.score.greenery} + شهر ${p.score.city} + کارت ${p.score.cards}`}>امتیاز {fa(p.score.total)}</span>
      <span className="tm-pb__meta">{fa(p.hand)} کارت در دست</span>
      {p.passed && view.phase !== 'end' && <span className="tm-badge">پاس</span>}
      {p.ready && <span className="tm-badge">آماده</span>}
      {cur && <span className="tm-badge tm-badge--cur">▶ نوبت</span>}
    </>
  );
  const board = (
    <>
      <div className="tm-pb" style={{ backgroundImage: `url(${BOARD_ART.plate})` }} role="group" aria-label={`صفحهٔ بازیکن ${seatName(k)}: منابع و تولید`}>
        {RES.map((r) => <ResBox key={r} r={r} n={p.res[r]} prod={p.prod[r]} seat={k} rule={rule[r]} />)}
      </div>
      {tags.size > 0 && <div className="tm-card__tags tm-tagsum" aria-label="نشان‌ها">{[...tags].map(([t, n]) => <span key={t} className={`tm-tag tm-tag--${t}`}>{TAG_FA[t]} {fa(n)}</span>)}</div>}
      {active.length > 0 && (
        <details className="tm-tableau" open={active.length <= 6}>
          <summary>کارت‌های بازی‌شده ({fa(active.length)}){events.length ? ` · ${fa(events.length)} رویداد` : ''}</summary>
          <div className="tm-cards tm-cards--small">
            {active.map((id) => <Card key={id} id={id} flip={active.length <= 6} from={`seat-${k}`} res={p.cardRes[id] ?? 0} note={p.used.includes(id) ? 'کنش این نسل استفاده شد' : undefined} />)}
          </div>
          {events.length > 0 && <p className="tm-events">رویدادها: {events.map(name).join('، ')}</p>}
        </details>
      )}
    </>
  );
  return (
    <article data-flip-anchor={`seat-${k}`} className={`tm-player tm-seat-${k}${me ? ' tm-player--me' : ' tm-player--opp'}${cur ? ' tm-player--cur' : ''}`} aria-label={`بازیکن ${seatName(k)}`}>
      {me ? <><header className="tm-pb__head">{head}</header>{board}</> : (
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="tm-pb__head">{head}<span className="tm-pb__fold" aria-hidden="true">{open ? '▴' : '▾'}</span></summary>
          {board}
        </details>
      )}
    </article>
  );
}

/** One resource box of the printed board: production track with the seat's marker cube on top, stock cubes below. */
function ResBox({ r, n, prod, seat, rule }: { r: Res; n: number; prod: number; seat: number; rule: string }) {
  const pop = usePop(n), popProd = usePop(prod);
  const tens = prod >= 10 ? Math.min(5, Math.floor(prod / 10)) : 0, units = prod >= 0 ? prod - 10 * Math.floor(prod / 10) : -1;
  // Stock as the game's cubes: gold = 10, silver = 5, bronze = 1 (first 12 drawn; the number is always exact).
  const cubes = [...Array<string>(Math.floor(n / 10)).fill('g'), ...Array<string>(Math.floor((n % 10) / 5)).fill('s'), ...Array<string>(n % 5).fill('b')];
  return (
    <div className={`tm-box tm-box--${r}`} role="group" aria-label={`${RES_FA[r]}: موجودی ${fa(n)}، تولید ${sfa(prod)}`} style={{ backgroundImage: `url(${BOARD_ART.box})` }}>
      <span className="tm-box__head">
        <span className="tm-box__name">{RES_FA[r]}</span>
        <small key={`p${prod}`} className={`tm-box__prod ${popProd}`}>تولید <b>{sfa(prod)}</b></small>
      </span>
      <span className="tm-box__body">
        <span className="tm-box__stock">
          <img src={RES_ART[r]} alt="" />
          <b key={n} className={pop}>{fa(n)}</b>
          <span className="tm-box__cubes" aria-hidden="true">
            {cubes.slice(0, 12).map((c, i) => <i key={i} className={`tm-rc tm-rc--${c}`} />)}{cubes.length > 12 && <small>…</small>}
          </span>
        </span>
      <span className="tm-box__track" dir="ltr" aria-hidden="true">
        {/* printed track: -5..-1 (M€ only; an empty row elsewhere so the boxes align), 0..9 in two rows, then the +10 row */}
        <span className="tm-box__row">{[-5, -4, -3, -2, -1].map((v) => <span key={v} className={`tm-box__step${r === 'mc' ? '' : ' tm-box__step--off'}`}>{r === 'mc' && <>{fa(v)}{prod === v && <span className={`tm-box__marker tm-seat-${seat}`} />}</>}</span>)}</span>
        {[0, 5].map((o) => <span key={o} className="tm-box__row">{[0, 1, 2, 3, 4].map((i) => { const v = o + i; return <span key={v} className={`tm-box__step${v === 0 ? ' tm-box__step--zero' : ''}`}>{fa(v)}{units === v && <span className={`tm-box__marker tm-seat-${seat}`} />}</span>; })}</span>)}
        <span className="tm-box__row">{[1, 2, 3, 4, 5].map((t) => <span key={t} className="tm-box__step tm-box__step--ten">+{fa(t * 10)}{tens === t && <span className={`tm-box__marker tm-seat-${seat}`} />}</span>)}</span>
      </span>
      </span>
      <small className="tm-box__rule">{rule}</small>
    </div>
  );
}
