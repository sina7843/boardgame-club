// بلاد ریج renderer — the BGA layout of design/games/blood-rage (HANDOFF «تصمیم‌های اصلی», COMPONENTS.md §2–§24, layout.json):
// sticky status bar with the BGA buttons → map box (board art on the sea, tokens = handoff art) → «یک کارت نگه دارید» (draft)
// → «دست من» → clan sheets; rail = BGA player boards, then the log. Every move: buttons → target on the map / sheet / hand →
// «ثبت». The renderer computes no rules: targets, costs and effects come from `legalActions` (ENGINE.md §9).
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RailSlot, type GameAction, type GameRendererProps } from '@bg/ui';
import IDS from './content/content-id-map.json' with { type: 'json' };
import { CARD_BY_NUM, CLANS, FJORDS as C_FJORDS, MAP_SIZE, PROVINCES as C_PROV, SLOTS, ART_OF_DEF, RAGNAROK_GLORY } from './content/index.ts';
import { CARD_BY_ID } from './data.ts';
import type { BloodRageView, FigureView, PendingKind, SeatView, StatKey, Where, BattleRecordView } from './contract.ts';
import type { LogEntry } from './rules.ts';

const ART = import.meta.glob<string>('./art/**/*.webp', { eager: true, import: 'default' });
const art = (path: string) => ART[`./art/${path}`] ?? '';
// ponytail: one module-level language (one Blood Rage table per page); move to a React context if two tables ever share a page.
let LANG: 'fa' | 'en' = 'fa';
const t = (faText: string, en: string) => (LANG === 'en' ? en : faText);
const fa = (n: number) => (LANG === 'en' ? String(n) : n.toLocaleString('fa-IR', { useGrouping: Math.abs(n) >= 1000 }).replace(/٬/g, ','));
const SLUG = (clan: number) => CLANS.find((c) => c.id === clan)?.slug ?? 'wolf';
const CLAN_FA = (clan: number) => { const c = CLANS.find((x) => x.id === clan); return (LANG === 'en' ? c?.nameEn : c?.nameFa) ?? ''; };
const cc = (clan: number) => ({ '--cc': `var(--bdr-${SLUG(clan)})` }) as CSSProperties;
const ink = (clan: number) => ({ color: `var(--bdr-${SLUG(clan)}-ink)` });
/** Game-art coordinates: the board is a fixed LTR picture (layout.json x/16 %, y/16 %); some pieces carry dir=rtl text, so physical left. */
const pos = (x: number, y: number): CSSProperties => ({ left: `${(x / MAP_SIZE) * 100}%`, top: `${(y / MAP_SIZE) * 100}%` }); // ds-check-ignore: LTR game-art coordinates
const PROV_KEY = ['ygg', 'myr', 'elv', 'ang', 'mus', 'hor', 'utg', 'and', 'gim'];
const provOfKey = (k: string | undefined) => (k === undefined ? -1 : PROV_KEY.indexOf(k));
const provFa = (n: number) => (LANG === 'en' ? C_PROV[n]?.nameEn : C_PROV[n]?.nameFa) ?? '';
const STAT_L: Record<StatKey, [string, string]> = { rage: ['خشم', 'Rage'], axe: ['تبر', 'Axes'], horn: ['شاخ', 'Horns'] };
const STAT_FA = new Proxy({} as Record<StatKey, string>, { get: (_, k: StatKey) => t(...STAT_L[k]) });
const KIND_L: Record<string, [string, string]> = { leader: ['سردار', 'Leader'], warrior: ['جنگجو', 'Warrior'], ship: ['کشتی', 'Ship'], monster: ['هیولا', 'Monster'] };
const REWARD_L: Record<string, [string, string]> = { yggdrasil: ['هر سه ویژگی قبیله یک پله', 'All three clan stats +1'], rage: ['ویژگی خشم یک پله', 'Rage stat +1'], axe: ['ویژگی تبر یک پله', 'Axes stat +1'], horn: ['ویژگی شاخ یک پله', 'Horns stat +1'], glory: ['۵ افتخار', '5 Glory'] };
const REWARD_FA = new Proxy({} as Record<string, string>, { get: (_, k: string) => (REWARD_L[k] ? t(...REWARD_L[k]!) : '') });
const PHASES: [string, string, string][] = [['draft', 'هدایای خدایان', "Gods' Gifts"], ['action', 'اقدام', 'Action'], ['discard', 'دور ریختن', 'Discard'], ['quest', 'مأموریت‌ها', 'Quests'], ['ragnarok', 'راگناروک', 'Ragnarök'], ['valhalla', 'آزادی از والهالا', 'Release Valhalla']];
const readLang = (): 'fa' | 'en' => { try { return localStorage.getItem('bdr-lang') === 'en' ? 'en' : 'fa'; } catch { return 'fa'; } };
/** The page theme (html data-theme): the status bar, dialogs and sheet are DS boards on the page theme, not on the night stage. */
function usePageTheme(): 'light' | 'dark' {
  const read = () => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [theme, setTheme] = useState<'light' | 'dark'>(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const o = new MutationObserver(() => setTheme(read()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);
  return theme;
}
/** Phone layout (layout.json `squareMap` ≤760): action sheet, auto-zoom. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 760px)');
    const f = () => setPhone(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return phone;
}

// ---------- art lookups (content-id-map.json) ----------
type Tokens = Record<string, Record<string, string>>;
const FIG_TOKENS = IDS.figureTokens as unknown as Tokens;
/** clan slug → engine card id → upgraded token path (copies of the 5th-player cards share the same art). */
const TOKEN_BY_DEF: Record<string, Record<string, string>> = Object.fromEntries(Object.entries(FIG_TOKENS).filter(([k]) => k !== 'fifthPlayerCopies').map(([slug, m]) => [slug,
  Object.fromEntries(Object.entries(m).filter(([k]) => k.startsWith('card-')).map(([k, v]) => [CARD_BY_NUM[Number(k.slice(5))]?.def ?? k, v]))]));
function cardArt(num: number | null | undefined, def?: string): string {
  if (num === null || num === undefined) return '';
  const c = CARD_BY_NUM[num];
  return art(`cards/${c?.art ?? ART_OF_DEF[def ?? ''] ?? ''}.webp`);
}
const cardBack = (age: number) => art(`card-backs/age-${age}-back.webp`);
function tokenArt(v: BloodRageView, f: FigureView): string {
  const seat = v.seats[f.seat]!;
  const slug = SLUG(seat.clan);
  const up = f.kind === 'monster' ? f.def : f.kind === 'leader' ? defOf(v, seat.upgrades.leader) : f.kind === 'warrior' ? defOf(v, seat.upgrades.warrior) : defOf(v, seat.upgrades.ship);
  const byDef = up ? TOKEN_BY_DEF[slug]?.[up] : undefined;
  return art(byDef ?? FIG_TOKENS[slug]?.[f.kind] ?? '');
}
const defOf = (v: BloodRageView, num: number | null) => (num === null ? null : v.defs[num] ?? CARD_BY_NUM[num]?.def ?? null);
function cardTitle(num: number): { en: string; fa: string; text: string; textEn: string; type: string } {
  const c = CARD_BY_NUM[num];
  if (c) return { en: c.titleEn, fa: c.titleFa, text: c.rulesFa, textEn: c.rulesEn, type: c.type };
  return { en: '', fa: '', text: '', textEn: '', type: '' };
}
const figName = (_v: BloodRageView, f: FigureView) => (f.kind === 'monster' && f.def ? (LANG === 'en' ? CARD_BY_ID[f.def]?.nameEn : CARD_BY_ID[f.def]?.nameFa) ?? t('هیولا', 'Monster') : t(...KIND_L[f.kind]!));

// ---------- map positions (layout.json §11) ----------
function figurePositions(v: BloodRageView): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const ygg = v.figures.filter((f) => f.where === 'yggdrasil');
  const step = 360 / Math.max(ygg.length, 6);
  ygg.forEach((f, i) => { const a = ((-120 + i * step) * Math.PI) / 180; out.set(f.id, { x: C_PROV[0]!.x + 130 * Math.cos(a), y: C_PROV[0]!.y + 130 * Math.sin(a) }); });
  for (const fj of C_FJORDS) {
    const here = v.figures.filter((f) => f.where === `fjord:${fj.id}`);
    here.forEach((f, i) => out.set(f.id, { x: fj.x + (i - (here.length - 1) / 2) * 95, y: fj.y }));
  }
  for (const f of v.figures) if (f.where.startsWith('village:')) { const s = SLOTS[Number(f.where.slice(8))]; if (s) out.set(f.id, { x: s.x, y: s.y }); }
  return out;
}
function wherePos(w: Where): { x: number; y: number } | null {
  if (w === 'yggdrasil') return { x: C_PROV[0]!.x, y: C_PROV[0]!.y };
  if (w.startsWith('village:')) { const s = SLOTS[Number(w.slice(8))]; return s ? { x: s.x, y: s.y } : null; }
  if (w.startsWith('fjord:')) { const f = C_FJORDS[Number(w.slice(6))]; return f ? { x: f.x, y: f.y } : null; }
  return null;
}
const whereProvince = (w: Where) => (w === 'yggdrasil' ? 0 : w.startsWith('village:') ? SLOTS[Number(w.slice(8))]?.province ?? -1 : -1);

// ---------- the selection state ----------
type Mode =
  | { k: 'invade'; figure?: string; to?: Where }
  | { k: 'march'; from?: number; to?: number; figs?: string[] }
  | { k: 'pillage'; province?: number }
  | { k: 'upgrade' | 'monster' | 'quest'; card?: number; index?: number }
  | { k: 'clan'; card: number; target?: number; figs?: string[]; stat?: StatKey }
  | { k: 'pass' }
  | { k: 'decide'; to?: Where; figure?: string; cards?: number[]; figs?: string[]; province?: number | null; all?: boolean };

type H = GameAction & { [k: string]: unknown };

export default function BloodRageRenderer({ view: v, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<BloodRageView>) {
  const hints = legalActions as H[];
  const [mode, setMode] = useState<Mode | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<'map' | 'hand' | 'clan' | 'players'>('map');
  const [shownBattle, setShownBattle] = useState<number | null>(null);
  const [lang, setLang] = useState<'fa' | 'en'>(readLang);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [inShell, setInShell] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const theme = usePageTheme();
  useEffect(() => { setInShell(!!wrapRef.current?.closest('[data-hud="on"]')); }, []);
  useEffect(() => {
    // «جزئیات آمار» on the shell rail cards (bloodRageSeatCard) opens our stats dialog
    const f = (e: Event) => setOpen((e as CustomEvent<string>).detail);
    window.addEventListener('bdr-open', f);
    return () => window.removeEventListener('bdr-open', f);
  }, []);
  useEffect(() => { setNudge(null); }, [mode]);
  LANG = lang;
  const phone = usePhone();
  const boxRef = useRef<HTMLElement>(null);
  const seenBattles = useRef(v.battles.length);
  const lastDoom = v.log.filter((e) => e.e === 'ragnarok').at(-1)?.n ?? 0;
  const seenDoom = useRef(lastDoom);
  useEffect(() => { setMode(null); setSheetOpen(false); setNudge(null); }, [v.seq]);
  useEffect(() => {
    // §22: the end of every Age opens the quests / Ragnarök summary once
    if (lastDoom > seenDoom.current) setOpen('endage');
    seenDoom.current = lastDoom;
  }, [lastDoom]);
  const switchLang = (l: 'fa' | 'en') => { setLang(l); try { localStorage.setItem('bdr-lang', l); } catch { /* private mode */ } };
  useEffect(() => {
    if (v.battles.length > seenBattles.current) { setShownBattle(v.battles.length - 1); setOpen('battle'); }
    seenBattles.current = v.battles.length;
  }, [v.battles.length]);

  const name = (s: number) => seatName(s);
  const me = mySeat !== null ? v.seats[mySeat] ?? null : null;
  const kind = (v.pending && mySeat !== null && v.pending.seats.includes(mySeat) ? v.pending.kind : null) as PendingKind | null;
  const myTurn = !kind && v.phase === 'action' && v.turn === mySeat && !v.battle;
  const send = (a: GameAction) => { if (!busy) { onAction(a); setMode(null); } };
  const of = (type: string) => hints.filter((h) => h.type === type && !h.disabled);
  const decides = hints.filter((h) => h.type === 'decide');
  const exp = expected as H | null;
  const hintCls = (on: boolean) => (on ? ' bdr-hint' : '');
  const posMap = useMemo(() => figurePositions(v), [v]);

  // ---------- targets on the map for the current mode ----------
  const spots: { to: Where; on: boolean; onClick: () => void }[] = [];
  const provRings: { p: number; on: boolean; onClick: () => void }[] = [];
  const selFigs = new Map<string, { on: boolean; onClick: () => void }>();
  let ghost: { figure: string; to: Where } | null = null;
  let note: ReactNode = null;
  const effects: string[] = [];

  if (mode?.k === 'invade' && mode.figure) {
    for (const h of of('invade').filter((x) => x.figure === mode.figure)) {
      const to = h.to as Where;
      spots.push({ to, on: mode.to === to, onClick: () => setMode({ ...mode, to }) });
      if (mode.to === to) for (const e of (h.effects as { figures?: string[] }[] | undefined) ?? []) effects.push(...(e.figures ?? []));
    }
    if (mode.to) ghost = { figure: mode.figure, to: mode.to };
  }
  if (mode?.k === 'march') {
    const marches = of('march');
    if (mode.from === undefined) for (const p of [...new Set(marches.map((h) => h.from as number))]) provRings.push({ p, on: false, onClick: () => setMode({ k: 'march', from: p }) });
    else {
      for (const h of marches.filter((x) => x.from === mode.from)) {
        const p = h.to as number;
        provRings.push({ p, on: mode.to === p, onClick: () => setMode({ ...mode, to: p, figs: (h.figures as string[]).slice() }) });
      }
      const h = marches.find((x) => x.from === mode.from && x.to === mode.to);
      if (h) {
        const max = h.maxFigures as number;
        for (const f of v.figures.filter((x) => x.seat === mySeat && whereProvince(x.where) === mode.from && x.kind !== 'ship' && !x.where.startsWith('fjord'))) {
          const on = mode.figs?.includes(f.id) ?? false;
          selFigs.set(f.id, { on, onClick: () => setMode({ ...mode, figs: on ? mode.figs!.filter((x) => x !== f.id) : (mode.figs ?? []).length < max ? [...(mode.figs ?? []), f.id] : mode.figs }) });
        }
      }
    }
  }
  if (mode?.k === 'pillage') for (const h of of('pillage')) { const p = h.province as number; provRings.push({ p, on: mode.province === p, onClick: () => setMode({ k: 'pillage', province: p }) }); }
  if (mode?.k === 'clan') {
    const hs = of('clanAction').filter((h) => h.card === mode.card);
    for (const h of hs) if (typeof h.target === 'number') { const p = h.target; provRings.push({ p, on: mode.target === p, onClick: () => setMode({ ...mode, target: p }) }); }
    if (hs.some((h) => h.target === undefined)) for (const f of v.figures.filter((x) => x.seat === mySeat && !['reserve', 'valhalla', 'box'].includes(x.where))) {
      const on = mode.figs?.includes(f.id) ?? false;
      selFigs.set(f.id, { on, onClick: () => setMode({ ...mode, figs: on ? mode.figs!.filter((x) => x !== f.id) : [...(mode.figs ?? []), f.id].slice(-2) }) });
    }
  }
  const dm = mode?.k === 'decide' ? mode : null;
  if (kind === 'freeInvade' || kind === 'extraWarrior' || kind === 'loserInvade') {
    for (const h of decides) {
      const to = (h.choice as { to?: Where } | null)?.to;
      if (!to) continue;
      const on = dm?.to === to;
      spots.push({ to, on, onClick: () => setMode({ k: 'decide', to }) });
      if (on) { for (const e of (h.effects as { figures?: string[] }[] | undefined) ?? []) effects.push(...(e.figures ?? [])); if (typeof h.figure === 'string') ghost = { figure: h.figure, to }; }
    }
  }
  if (kind === 'callToBattle') {
    for (const h of decides) {
      const c = h.choice as { figure?: string } | string;
      if (typeof c !== 'object' || !c.figure) continue;
      const fid = c.figure;
      selFigs.set(fid, { on: dm?.figure === fid, onClick: () => setMode({ k: 'decide', figure: fid }) });
      if (dm?.figure === fid) for (const to of h.targets as Where[]) spots.push({ to, on: dm.to === to, onClick: () => setMode({ k: 'decide', figure: fid, to }) });
    }
    if (dm?.figure && dm.to) ghost = { figure: dm.figure, to: dm.to };
  }
  if (kind === 'moveLeader') for (const h of decides) if (typeof h.choice === 'number') { const p = h.choice; provRings.push({ p, on: dm?.province === p, onClick: () => setMode({ k: 'decide', province: p }) }); }
  if (kind === 'saveFigure' || kind === 'keepOneFigure') {
    const list = kind === 'saveFigure' ? ((decides[0]?.figures as string[]) ?? []) : decides.map((h) => h.choice as string);
    const max = kind === 'saveFigure' ? (decides[0]?.max as number) : 1;
    for (const fid of list) {
      const on = dm?.figs?.includes(fid) ?? false;
      selFigs.set(fid, { on, onClick: () => setMode({ k: 'decide', figs: on ? dm!.figs!.filter((x) => x !== fid) : [...(dm?.figs ?? []), fid].slice(-max) }) });
    }
  }

  // ---------- status bar ----------
  const btn = (label: ReactNode, act: string, onClick: () => void, o: { variant?: string; pressed?: boolean; disabled?: boolean; title?: string; hint?: boolean } = {}) => (
    <button key={act} type="button" data-act={act} className={`bgv-btn bgv-btn--${o.variant ?? 'secondary'} bgv-btn--sm${hintCls(!!o.hint)}`}
      aria-pressed={o.pressed} disabled={busy || o.disabled} title={o.title} onClick={onClick}>{label}</button>
  );
  const confirm = (a: GameAction | null, label = 'ثبت') => [
    btn(label === 'ثبت' ? t('ثبت', 'Confirm') : label, 'confirm', () => (a ? send(a) : setNudge(t('اول هدف را روی نقشه، صفحهٔ قبیله یا دست انتخاب کنید.', 'Pick the target on the map, clan sheet or hand first.'))), { variant: 'primary', hint: !!a && !!exp && JSON.stringify(exp) === JSON.stringify(a) }),
    btn(t('انصراف', 'Cancel'), 'cancel', () => setMode(null), { variant: 'ghost' })
  ];
  const costPill = (rage: number | undefined) => <span className="bdr-pill">{rage ? <><img src={art('tokens/icon-rage-mini.webp')} alt="" /><span className="bdr-num">{fa(rage)}</span></> : 'رایگان'}</span>;
  let text: ReactNode = null;
  let buttons: ReactNode[] = [];
  let waiting = false;
  let actionList: { label: string; sub: string; act: string; go: () => void; hint?: boolean; variant?: string }[] = [];
  const handPick = new Map<number, { on: boolean; onClick: () => void }>();
  const sheetPick = new Map<string, { on: boolean; onClick: () => void }>();

  if (v.outcome) text = <>{t('بازی تمام شد.', 'The game is over.')}</>;
  else if (kind) {
    const pickCard = (cards: number[], one: boolean) => {
      for (const c of cards) {
        const on = dm?.cards?.includes(c) ?? false;
        handPick.set(c, { on, onClick: () => setMode({ k: 'decide', cards: one ? [c] : on ? dm!.cards!.filter((x) => x !== c) : [...(dm?.cards ?? []), c] }) });
      }
    };
    switch (kind) {
      case 'draftPick': {
        const h = hints.find((x) => x.type === 'draftPick');
        const need = (h?.need as number) ?? 1;
        const chosen = dm?.cards ?? [];
        for (const c of (h?.cards as number[]) ?? []) {
          const on = chosen.includes(c);
          handPick.set(c, { on, onClick: () => setMode({ k: 'decide', cards: on ? chosen.filter((x) => x !== c) : need === 1 ? [c] : [...chosen, c].slice(-need) }) });
        }
        text = <>{t('هدایای خدایان', "Gods' Gifts")}: {need === 2 ? t('دو کارت نگه دارید', 'keep two cards') : t('یک کارت نگه دارید', 'keep one card')}</>;
        note = t(`انتخاب ${fa(chosen.length)} از ${fa(need)}`, `Picked ${chosen.length} of ${need}`);
        const a = chosen.length === need ? { type: 'draftPick', cards: chosen } : null;
        buttons = [btn(chosen.length ? `${t('نگه دار', 'Keep')}: ${chosen.map((c) => cardTitle(c).en).join('، ')}` : t('نگه دار', 'Keep'), 'keep', () => (a ? send(a) : setNudge(need === 2 ? t('دو کارت از دستهٔ رسیده انتخاب کنید.', 'Pick two cards from the pack.') : t('یک کارت از دستهٔ رسیده انتخاب کنید.', 'Pick a card from the pack.'))), { variant: 'primary' })];
        break;
      }
      case 'battleCard': {
        pickCard(decides.map((h) => (h.choice as { card: number }).card), true);
        text = <>نبرد در <b>{provFa(v.battle?.province ?? 0)}</b>: یک کارت نبرد انتخاب کنید</>;
        const c = dm?.cards?.[0];
        buttons = [btn('بازی کارت', 'play-card', () => (c !== undefined ? send({ type: 'decide', kind, choice: { card: c } }) : setNudge(t('یک کارت از دست انتخاب کنید.', 'Pick a card from your hand.'))), { variant: 'primary', hint: !!exp && exp.type === 'decide' && c !== undefined && (exp.choice as { card?: number })?.card === c })];
        break;
      }
      case 'discardKeep': {
        pickCard(decides.map((h) => h.choice as number), true);
        text = <>دور ریختن: فقط یک کارت برای عصر بعد نگه دارید</>;
        const c = dm?.cards?.[0];
        buttons = [btn('دور ریختن بقیه', 'discard', () => (c !== undefined ? send({ type: 'decide', kind, choice: c }) : setNudge(t('کارتی را که نگه می‌دارید انتخاب کنید.', 'Pick the card you keep.'))), { variant: 'primary' })];
        break;
      }
      case 'callToBattle': {
        text = <>نبرد در <b>{provFa(v.battle?.province ?? 0)}</b>: یک مهره برای پیوستن به نبرد انتخاب کنید</>;
        const canAll = decides.some((h) => h.choice === 'passAll');
        if (dm?.all) {
          note = <>تأیید کنید که تا پایان همین نبرد رد می‌کنید.</>;
          buttons = [btn('ثبت', 'confirm', () => send({ type: 'decide', kind, choice: 'passAll' }), { variant: 'primary' }), btn('انصراف', 'cancel', () => setMode(null), { variant: 'ghost' })];
        } else if (dm?.figure) {
          buttons = confirm(dm.to ? { type: 'decide', kind, choice: { figure: dm.figure, to: dm.to } } : null);
        } else {
          buttons = [btn('رد', 'pass', () => send({ type: 'decide', kind, choice: 'pass' })), ...(canAll ? [btn('رد تا پایان این نبرد', 'pass-all', () => setMode({ k: 'decide', all: true }), { variant: 'danger' })] : [])];
        }
        break;
      }
      case 'freeInvade': case 'extraWarrior': case 'loserInvade': {
        const fig = v.figures.find((f) => f.id === (v.pending?.figure ?? ''));
        text = kind === 'freeInvade' ? <>یورش رایگان با <b>{fig ? figName(v, fig) : 'مهره'}</b>: روستا را روی نقشه انتخاب کنید</>
          : kind === 'extraWarrior' ? <>یاری فریگا: یک جنگجوی دیگر رایگان در {provFa(v.pending?.province ?? 0)}؟</> : <>برکت لوکی: یورش رایگان یک جنگجو در {provFa(v.pending?.province ?? 0)}؟</>;
        buttons = dm?.to ? confirm({ type: 'decide', kind, choice: { to: dm.to } }) : [btn('رد', 'pass', () => send({ type: 'decide', kind, choice: null }))];
        break;
      }
      case 'instantPillage':
        text = <>قلمرو تور: با ۲ خشم {provFa(v.pending?.province ?? 0)} را فوراً غارت کنید؟</>;
        buttons = [btn(<>غارت {costPill(2)}</>, 'pillage', () => send({ type: 'decide', kind, choice: true }), { variant: 'primary' }), btn('رد', 'pass', () => send({ type: 'decide', kind, choice: false }))];
        break;
      case 'raiseStat':
        text = <>یک ویژگی را یک پله بالا ببرید</>;
        buttons = decides.map((h) => {
          const st = h.choice as StatKey;
          const next = me ? Math.min(5, me.steps[st] + 1) : 0;
          return btn(<>{STAT_FA[st]} ← {fa(TRACK[st][next]!)}</>, `stat-${st}`, () => send({ type: 'decide', kind, choice: st }), { disabled: !!h.disabled, title: h.disabled ? 'این ویژگی در آخرین پله است' : undefined, hint: !!exp && exp.choice === st });
        });
        break;
      case 'moveLeader':
        text = <>سرور پتک‌ها: سردار را به استان همسایه ببرید یا بماند</>;
        buttons = typeof dm?.province === 'number' ? confirm({ type: 'decide', kind, choice: dm.province }) : [btn('ماندن', 'pass', () => send({ type: 'decide', kind, choice: null }))];
        break;
      case 'keepCards': {
        const cards = (decides[0]?.cards as number[]) ?? [];
        const max = (decides[0]?.max as number) ?? 0;
        for (const c of cards) { const on = dm?.cards?.includes(c) ?? false; handPick.set(c, { on, onClick: () => setMode({ k: 'decide', cards: on ? dm!.cards!.filter((x) => x !== c) : [...(dm?.cards ?? []), c].slice(-max) }) }); }
        text = <>دلاوری تیر: کارت‌های آشکار را با ۱ خشم برای هر کدام نگه دارید</>;
        const keep = dm?.cards ?? [];
        buttons = [btn(<>نگه‌داری {costPill(keep.length)}</>, 'keep', () => send({ type: 'decide', kind, choice: keep }), { variant: 'primary' })];
        break;
      }
      case 'saveFigure': {
        const sel = dm?.figs ?? [];
        text = <>پناه فریگا: برای هر مهره ۱ خشم بدهید تا نابود نشود</>;
        buttons = [btn(<>نگه‌داری {costPill(sel.length)}</>, 'keep', () => send({ type: 'decide', kind, choice: sel }), { variant: 'primary' })];
        break;
      }
      case 'keepOneFigure':
        text = <>موج اودین: مهره‌ای را که می‌ماند روی نقشه انتخاب کنید</>;
        buttons = confirm(dm?.figs?.[0] ? { type: 'decide', kind, choice: dm.figs[0] } : null);
        break;
      case 'afterReveal': {
        const c = v.pending?.card;
        text = <>پس از آشکار شدن: کارت {c !== undefined ? <b>{cardTitle(c).en}</b> : ''} را بازی می‌کنید؟</>;
        buttons = [btn('بازی کارت', 'play-card', () => c !== undefined && send({ type: 'decide', kind, choice: { card: c } }), { variant: 'primary' }), btn('رد', 'pass', () => send({ type: 'decide', kind, choice: null }))];
        break;
      }
    }
  } else if (myTurn && me) {
    const inv = of('invade');
    const ups = of('upgrade');
    if (!mode) {
      text = <><b>{name(mySeat!)}</b>: {t('یک اقدام انتخاب کنید', 'choose an action')}</>;
      const qs = of('quest');
      const monsters = ups.filter((h) => h.slot === 'monster');
      const others = ups.filter((h) => h.slot !== 'monster');
      const list: { label: string; sub: string; act: string; go: () => void; hint?: boolean; variant?: string }[] = [
        ...(qs.length ? [{ label: t('بازی مأموریت', 'Play quest'), sub: t('رایگان', 'Free'), act: 'quest', go: () => setMode({ k: 'quest' }), hint: exp?.type === 'quest' }] : []),
        ...(others.length ? [{ label: t('ارتقا', 'Upgrade'), sub: t('خشم = قدرت کارت', 'Rage = card STR'), act: 'upgrade', go: () => setMode({ k: 'upgrade' }), hint: exp?.type === 'upgrade' && exp.slot !== 'monster' }] : []),
        ...(monsters.length ? [{ label: t('بازی هیولا', 'Play monster'), sub: monsters.map((h) => `${cardTitle(h.card as number)[LANG === 'en' ? 'en' : 'fa']}، ${fa((h.cost as { rage: number }).rage)} ${t('خشم', 'rage')}`).join('، '), act: 'monster', go: () => setMode({ k: 'monster' }), hint: exp?.type === 'upgrade' && exp.slot === 'monster' }] : []),
        ...(inv.length ? [{ label: t('یورش', 'Invade'), sub: t('خشم = قدرت مهره', 'Rage = figure STR'), act: 'invade', go: () => setMode({ k: 'invade' }), hint: exp?.type === 'invade' }] : []),
        ...(of('march').length ? [{ label: t('لشکرکشی', 'March'), sub: t('۱ خشم', '1 rage'), act: 'march', go: () => setMode({ k: 'march' }), hint: exp?.type === 'march' }] : []),
        ...(of('pillage').length ? [{ label: t('غارت', 'Pillage'), sub: t('رایگان', 'Free'), act: 'pillage', go: () => setMode({ k: 'pillage' }), hint: exp?.type === 'pillage' }] : []),
        ...[...new Set(of('clanAction').map((h) => h.card as number))].map((c) => ({ label: cardTitle(c)[LANG === 'en' ? 'en' : 'fa'] || t('اقدام قبیله', 'Clan action'), sub: '', act: `clan-${c}`, go: () => setMode({ k: 'clan', card: c }) })),
        { label: t('کنار کشیدن', 'Pass'), sub: t('خشم باقی می‌سوزد', 'Remaining rage is lost'), act: 'pass', go: () => setMode({ k: 'pass' }), hint: exp?.type === 'pass', variant: 'leave' }
      ];
      actionList = list;
      buttons = phone
        ? [btn(t('اقدام‌ها', 'Actions'), 'actions', () => setSheetOpen(true), { variant: 'primary', hint: list.some((x) => x.hint) })]
        : list.map((x) => btn(x.label, x.act, x.go, { hint: x.hint, variant: x.variant }));
    } else if (mode.k === 'invade') {
      const figs = [...new Map(inv.map((h) => [h.figure as string, h])).values()];
      text = mode.figure ? <>روستا را برای یورش با <b>{figName(v, v.figures.find((f) => f.id === mode.figure)!)}</b> انتخاب کنید</> : <>یورش با:</>;
      buttons = [
        ...figs.map((h) => { const f = v.figures.find((x) => x.id === h.figure)!; return btn(<>{figName(v, f)} {costPill((h.cost as { rage: number }).rage)}</>, `invade-${f.kind}`, () => setMode({ k: 'invade', figure: f.id }), { pressed: mode.figure === f.id }); }),
        ...confirm(mode.figure && mode.to ? { type: 'invade', figure: mode.figure, to: mode.to } : null)
      ];
      const h = inv.find((x) => x.figure === mode.figure && x.to === mode.to);
      if (h) note = <><span className="bdr-rage"><img src={art('tokens/icon-rage-mini.webp')} alt="" /><span className="bdr-num">{fa((h.cost as { rage: number }).rage)}</span></span> خشم {fa(me.rage)} ← {fa(me.rage - (h.cost as { rage: number }).rage)}، مهره روی نقشه {fa(me.onMap + 1)} از {fa(me.horns)}{effects.length ? <>، اثر: <b>{effects.map((id) => { const f = v.figures.find((x) => x.id === id); return f ? `${figName(v, f)} ${name(f.seat)}` : id; }).join('، ')}</b> نابود می‌شود</> : null}.</>;
    } else if (mode.k === 'march') {
      text = mode.from === undefined ? <>لشکرکشی: استان مبدأ را انتخاب کنید</> : mode.to === undefined ? <>لشکرکشی از <b>{provFa(mode.from)}</b>: مقصد را انتخاب کنید</> : <>لشکرکشی از <b>{provFa(mode.from)}</b> به <b>{provFa(mode.to)}</b>: مهره‌ها را روی نقشه انتخاب کنید</>;
      buttons = confirm(mode.from !== undefined && mode.to !== undefined && mode.figs?.length ? { type: 'march', from: mode.from, to: mode.to, figures: mode.figs } : null);
      if (mode.to !== undefined) note = <>هزینه ۱ خشم؛ {fa(mode.figs?.length ?? 0)} مهره.</>;
    } else if (mode.k === 'pillage') {
      text = <>غارت: استان را روی نقشه انتخاب کنید</>;
      buttons = confirm(mode.province !== undefined ? { type: 'pillage', province: mode.province } : null);
      if (mode.province !== undefined) note = <>پاداش: {REWARD_FA[v.pillage[mode.province]?.reward ?? '']}</>;
    } else if (mode.k === 'upgrade' || mode.k === 'monster' || mode.k === 'quest') {
      const list = mode.k === 'quest' ? of('quest') : ups.filter((h) => (mode.k === 'monster') === (h.slot === 'monster'));
      for (const h of list) { const c = h.card as number; handPick.set(c, { on: mode.card === c, onClick: () => setMode({ k: mode.k, card: c }) }); }
      const h = list.find((x) => x.card === mode.card);
      const needIndex = !!h?.replace;
      if (h && needIndex) {
        const slotKind = h.slot as string;
        const arr = slotKind === 'monster' ? me.upgrades.monster : me.upgrades.clan;
        arr.forEach((_, i) => sheetPick.set(`${slotKind}${i}`, { on: mode.index === i, onClick: () => setMode({ ...mode, index: i }) }));
      }
      text = mode.k === 'quest' ? <>بازی مأموریت: کارت را انتخاب کنید</> : needIndex && mode.card !== undefined ? <>ارتقای جایگزین را روی صفحهٔ قبیله انتخاب کنید</> : <>{mode.k === 'monster' ? 'بازی هیولا' : 'ارتقا'}: کارت را انتخاب کنید</>;
      const a: GameAction | null = !h ? null : mode.k === 'quest' ? { type: 'quest', card: h.card } : needIndex && mode.index === undefined ? null : { type: 'upgrade', card: h.card, slot: h.slot, ...(needIndex ? { index: mode.index } : {}) };
      buttons = confirm(a);
      if (h && mode.k !== 'quest') note = <>هزینه: {costPill((h.cost as { rage: number }).rage)}{needIndex ? '، کارت قبلی دور ریخته می‌شود' : ''}</>;
    } else if (mode.k === 'clan') {
      const t = cardTitle(mode.card);
      const hs = of('clanAction').filter((h) => h.card === mode.card);
      const sacrifice = hs.some((h) => h.target === undefined);
      text = <>{t.fa}: {sacrifice ? 'دو مهرهٔ خود را روی نقشه و یک ویژگی انتخاب کنید' : 'استان را روی نقشه انتخاب کنید'}</>;
      const a: GameAction | null = sacrifice ? (mode.figs?.length === 2 && mode.stat ? { type: 'clanAction', card: mode.card, figures: mode.figs, stat: mode.stat } : null) : mode.target !== undefined ? { type: 'clanAction', card: mode.card, target: mode.target } : null;
      buttons = [...(sacrifice ? (['rage', 'axe', 'horn'] as StatKey[]).map((st) => btn(STAT_FA[st], `stat-${st}`, () => setMode({ ...mode, stat: st }), { pressed: mode.stat === st, disabled: me.steps[st] >= 5 })) : []), ...confirm(a)];
    } else if (mode.k === 'pass') {
      text = <>کنار کشیدن: همهٔ خشم باقی ({fa(me.rage)}) از دست می‌رود و تا پایان این فاز اقدامی ندارید</>;
      buttons = confirm({ type: 'pass' });
    }
  } else {
    waiting = true;
    const who = v.pending?.seats ?? (v.turn !== null ? [v.turn] : []);
    text = who.length ? <>{t('منتظر', 'Waiting for')} <b>{who.map(name).join('، ')}</b>{v.battle ? <> (نبرد در {provFa(v.battle.province)})</> : v.phase === 'draft' ? ' (هدایای خدایان)' : v.phase === 'discard' ? ' (دور ریختن)' : ''}</> : <>…</>;
  }
  if (mode?.k === 'march' || mode?.k === 'pillage') { /* notes set above */ }

  // ---------- auto-zoom onto the legal villages (phone §25) ----------
  const spotKey = phone ? spots.map((x) => x.to).join(',') : '';
  useEffect(() => {
    if (!spotKey) { setZoom(1); return; }
    const pts = spotKey.split(',').map((w) => wherePos(w as Where)).filter((x): x is { x: number; y: number } => !!x);
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 360;
    const z = Math.min(2.5, Math.max(1, MAP_SIZE / span));
    setZoom(z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 / MAP_SIZE, cy = (Math.min(...ys) + Math.max(...ys)) / 2 / MAP_SIZE;
    requestAnimationFrame(() => {
      const box = boxRef.current, map = box?.querySelector<HTMLElement>('.bdr-map');
      if (box && map) box.scrollTo({ left: cx * map.offsetWidth - box.clientWidth / 2, top: cy * map.offsetHeight - box.clientHeight / 2 }); // ds-check-ignore: DOM scroll API of the LTR map box
    });
  }, [spotKey]);

  // ---------- pieces ----------
  const doomed = new Set(effects);
  const battleProv = v.battle?.province ?? null;
  const lastBattle: BattleRecordView | null = v.battles.length ? v.battles[v.battles.length - 1]! : null;

  const mapBox = (
    <section ref={boxRef} className={`bdr-mapbox${zoom > 1 ? ' is-zoomed' : ''}`} dir="ltr" aria-label={t('نقشه', 'Map')} id="bdr-map"
      style={{ backgroundImage: `url(${art('backgrounds/sea-background.webp')})`, '--zoom': zoom } as CSSProperties}>
      <img src={art('branding/blood-rage-logo.webp')} className="bdr-mapbox__logo" alt="Blood Rage" />
      <div className="bdr-pager" dir="rtl">
        <button className="bdr-agebadge" type="button" data-open="ages" aria-label="مسیر عصرها" onClick={() => setOpen('ages')}>{`${t('عصر', 'Age')} ${fa(v.age)}`}</button>
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" aria-label="بخش قبلی" onClick={() => document.getElementById('bdr-map')?.scrollIntoView({ behavior: 'smooth' })}><img src={art('ui-icons/button-page-up.webp')} alt="" /></button>
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" aria-label="بخش بعدی" onClick={() => document.getElementById('bdr-sheets')?.scrollIntoView({ behavior: 'smooth' })}><img src={art('ui-icons/button-page-down.webp')} alt="" /></button>
      </div>
      {lastBattle && <button className="bgv-btn bgv-btn--secondary bgv-btn--sm bdr-mapbox__battle" type="button" data-open="battle" dir="rtl" onClick={() => { setShownBattle(v.battles.length - 1); setOpen('battle'); }}>{`${t('آخرین نبرد', 'Last battle')}: ${provFa(lastBattle.province)}`}</button>}
      <div className="bdr-mapbox__tools">
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" aria-label="بزرگ‌تر" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}><img src={art('ui-icons/button-zoom-plus.webp')} alt="" /></button>
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" aria-label="کل نقشه" onClick={() => setZoom(1)}><img src={art('ui-icons/button-zoom-center.webp')} alt="" /></button>
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" aria-label="کوچک‌تر" onClick={() => setZoom((z) => Math.max(1, z - 0.25))}><img src={art('ui-icons/button-zoom-minus.webp')} alt="" /></button>
      </div>
      <div className="bdr-mapbox__bottom" dir="rtl">
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" data-open="archive" aria-label="بایگانی نبردها" onClick={() => setOpen('archive')}><img src={art('ui-icons/button-archive.webp')} alt="" /></button>
        <button className="bgv-btn bgv-btn--icon bgv-btn--secondary bdr-mapbtn" type="button" data-open="discard" aria-label={`کارت‌های نبرد دورریخته: ${fa(v.discardPublic.length)}`} onClick={() => setOpen('discard')}><img src={art('ui-icons/button-discard.webp')} alt="" /></button>
        <button className="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-open="valhalla" onClick={() => setOpen('valhalla')}>{`${t('والهالا', 'Valhalla')} (${fa(v.figures.filter((f) => f.where === 'valhalla').length)})`}</button>
      </div>
      {spotKey && zoom > 1 && <span className="bdr-mapinfo" dir="rtl">{t(`بزرگ‌نمایی خودکار: ${fa(spots.length)} روستا`, `Auto zoom: ${spots.length} villages`)}</span>}
      <div className="bdr-map" data-age={v.age}>
        <img className="bdr-base" src={art('boards/main-board.webp')} alt="نقشهٔ بلاد ریج: ایگدراسیل و هشت استان" />
        {C_PROV.map((p) => {
          if (v.destroyed.includes(p.id)) return <img key={`d${p.id}`} src={art('tokens/ragnarok.webp')} className="bdr-at bdr-destroyed" style={pos(p.x, p.y)} data-province={p.id} alt={`${p.nameFa} نابود شده`} />;
          const pl = v.pillage[p.id];
          if (!pl) return null;
          const icon = art(IDS.pillageReward[pl.reward as keyof typeof IDS.pillageReward]);
          if (pl.pillaged) return <span key={`r${p.id}`} className="bdr-at bdr-pdone" style={pos(p.x, p.y)} data-province={p.id} dir="rtl"><img src={icon} alt="" /><span>غارت موفق{pl.by !== undefined ? <><br />توسط <b>{name(pl.by)}</b></> : null}</span></span>;
          return <img key={`r${p.id}`} src={icon} className="bdr-at bdr-reward" style={pos(p.x, p.y)} data-province={p.id} title={`پاداش غارت: ${REWARD_FA[pl.reward]}`} alt={REWARD_FA[pl.reward]} />;
        })}
        {v.doom !== null && C_PROV[v.doom] && <img src={art('tokens/icon-destiny.webp')} className="bdr-at bdr-doom" style={pos(C_PROV[v.doom]!.doomX, C_PROV[v.doom]!.doomY)} title="نشان نابودی: این استان در راگناروک همین عصر نابود می‌شود" alt="نشان نابودی" />}
        {battleProv !== null && C_PROV[battleProv] && <img src={art('tokens/battle.webp')} className="bdr-at bdr-battlemark" style={pos(C_PROV[battleProv]!.x, C_PROV[battleProv]!.y - 90)} alt={`نبرد در ${provFa(battleProv)}`} />}
        {v.figures.map((f) => {
          const at = posMap.get(f.id);
          if (!at) return null;
          const sel = selFigs.get(f.id);
          const cls = `bdr-at bdr-tok${sel ? (sel.on ? ' is-on' : ' is-sel') : ''}${doomed.has(f.id) ? ' is-fx' : ''}`;
          const alt = `${figName(v, f)} ${name(f.seat)}، قدرت ${fa(f.str)}`;
          const inner = <><img src={tokenArt(v, f)} alt={alt} />{doomed.has(f.id) && <img src={art('ui-icons/remove.webp')} className="bdr-x" alt="" />}{mode?.k === 'march' && sel?.on && <img src={art('tokens/icon-march.webp')} className="bdr-mk" alt="" />}</>;
          return sel
            ? <button key={f.id} type="button" className={cls} style={pos(at.x, at.y)} data-fig={f.id} data-seat={f.seat} aria-pressed={sel.on} aria-label={alt} disabled={busy} onClick={sel.onClick}>{inner}</button>
            : <span key={f.id} className={cls} style={pos(at.x, at.y)} data-fig={f.id} data-seat={f.seat}>{inner}</span>;
        })}
        {spots.map((s) => {
          const at = wherePos(s.to);
          if (!at) return null;
          const p = s.to.startsWith('fjord:') ? 'آبدره' : provFa(whereProvince(s.to));
          const isExp = !!exp && JSON.stringify(exp).includes(`"${s.to}"`);
          return <button key={s.to} type="button" className={`bdr-spot${s.on ? ' is-on' : ''}${hintCls(isExp)}`} style={pos(at.x, at.y)} data-slot={s.to.split(':')[1] ?? s.to} aria-pressed={s.on} aria-label={`${p}، روستای خالی`} disabled={busy} onClick={s.onClick}>{!s.on && <img src={art('ui-icons/spot-target.webp')} alt="" />}</button>;
        })}
        {ghost && (() => { const f = v.figures.find((x) => x.id === ghost!.figure); const at = wherePos(ghost!.to); return f && at ? <span className="bdr-at bdr-tok is-ghost" style={pos(at.x, at.y)}><img src={tokenArt(v, f)} alt="" /></span> : null; })()}
        {provRings.map((r) => {
          const p = C_PROV[r.p]!;
          const isExp = !!exp && (exp.province === r.p || exp.to === r.p || exp.from === r.p);
          return <button key={`p${r.p}`} type="button" className={`bdr-prov${r.on ? ' is-on' : ''}${hintCls(isExp)}`} style={pos(p.x, p.y + 70)} data-province={r.p} aria-pressed={r.on} aria-label={`${p.nameFa}، انتخاب استان`} disabled={busy} onClick={r.onClick}>{p.nameFa}</button>;
        })}
      </div>
    </section>
  );

  // ---------- hand ----------
  const cardBtn = (c: number, pick: { on: boolean; onClick: () => void } | undefined, off = false, tag?: string) => {
    const t = cardTitle(c);
    const isExp = !!exp && (exp.card === c || (exp.choice as { card?: number } | null)?.card === c || (exp.cards as number[] | undefined)?.includes(c));
    return (
      <div className="bdr-hcard" key={c}>
        <button className={`bdr-card${hintCls(!!isExp && !!pick)}`} type="button" data-card={c} data-flip={`card-${c}`} data-pick={pick ? (pick.on ? 'picked' : 'selectable') : off ? 'off' : undefined}
          aria-pressed={pick ? pick.on : undefined} aria-label={`${t.en} (${t.fa}): ${t.text}`} disabled={busy || !pick} onClick={pick?.onClick}>
          <img src={cardArt(c, v.defs[c])} alt="" />{pick?.on && <span className="bdr-check" aria-hidden>✓</span>}{tag && <span className="bdr-cardtag">{tag}</span>}
        </button>
        <Tip c={c} age={CARD_BY_NUM[c]?.age ?? v.age} />
      </div>
    );
  };
  const draftPack = kind === 'draftPick' ? ((hints.find((x) => x.type === 'draftPick')?.cards as number[]) ?? []) : [];
  const draftNeed = (hints.find((x) => x.type === 'draftPick')?.need as number | undefined) ?? v.draft?.need ?? 1;
  const discarding = kind === 'discardKeep';

  // ---------- clan sheets ----------
  const order = mySeat !== null ? [mySeat, ...v.seats.map((s) => s.seat).filter((s) => s !== mySeat)] : v.seats.map((s) => s.seat);
  const reserveTarget = mode?.k === 'invade' ? new Set(of('invade').map((h) => h.figure as string)) : null;
  const sheet = (s: SeatView) => {
    const slug = SLUG(s.clan);
    const sh = IDS.clanSheet[slug as keyof typeof IDS.clanSheet];
    const mine = s.seat === mySeat;
    const repOf = (k: string) => (reserveTarget && mine ? v.figures.find((f) => f.seat === s.seat && f.kind === k && f.where === 'reserve' && reserveTarget.has(f.id)) : undefined);
    const cell = (key: string, kindAttr: string, num: number | null, base: string, invKind?: string) => {
      const pick = sheetPick.get(key);
      const rep = invKind ? repOf(invKind) : undefined;
      const monsterRep = kindAttr.startsWith('monster') && num !== null && reserveTarget && mine ? v.figures.find((f) => f.seat === s.seat && f.kind === 'monster' && f.monster === num && reserveTarget.has(f.id)) : undefined;
      const inv = rep ?? monsterRep;
      const content = <>
        <img src={num !== null ? cardArt(num, v.defs[num]) : art(base)} alt={num !== null ? `${cardTitle(num).en} — ${cardTitle(num).fa}` : ''} />
        {inv && <span className={`bdr-slot__inv${mode?.k === 'invade' && mode.figure === inv.id ? ' is-on' : ''}`}><img src={art('ui-icons/hover-invade.webp')} alt="" /></span>}
        {pick && <span className={`bdr-slot__inv${pick.on ? ' is-on' : ''}`} />}
        {num !== null && <Tip c={num} age={CARD_BY_NUM[num]?.age ?? 1} />}
      </>;
      const click = pick?.onClick ?? (inv ? () => setMode({ k: 'invade', figure: inv.id }) : undefined);
      return click
        ? <button key={key} type="button" className="bdr-slot" data-slot-kind={kindAttr} data-card={num ?? undefined} aria-pressed={pick?.on} disabled={busy} onClick={click}>{content}</button>
        : <div key={key} className="bdr-slot" data-slot-kind={kindAttr} data-card={num ?? undefined}>{content}</div>;
    };
    return (
      <article key={s.seat} className={`bgv-felt bdr-sheet${mine ? ' is-me' : ''}`} style={cc(s.clan)} data-seat={s.seat} data-flip-anchor={`sheet-${s.seat}`}>
        <h3 className="bdr-sheet__name" style={ink(s.clan)}><bdi>{name(s.seat)}</bdi></h3>
        <div className="bdr-sheet__btns">
          <button className="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-open={`reserve-${s.seat}`} onClick={() => setOpen(`reserve-${s.seat}`)}>{`${t('ذخیره', 'Reserve')}:\u00A0${fa(s.reserve)}`}</button>
          <button className="bgv-btn bgv-btn--secondary bgv-btn--sm" type="button" data-open={`quests-${s.seat}`} onClick={() => setOpen(`quests-${s.seat}`)}>{`${t('مأموریت‌ها', 'Quests')}:\u00A0${fa(s.questCount)}`}</button>
        </div>
        <div className="bdr-slots" dir="ltr">
          {cell('clanCard', 'clan-card', null, sh.clanCard)}
          {cell('leader', 'leader', s.upgrades.leader, sh.leader, 'leader')}
          {cell('warrior', 'warrior', s.upgrades.warrior, sh.warrior, 'warrior')}
          {cell('monster0', 'monster', s.upgrades.monster[0] ?? null, sh.monsterSlot)}
          {cell('monster1', 'monster2', s.upgrades.monster[1] ?? null, sh.monsterSlot)}
          <div className="bdr-slot is-void" aria-hidden="true" />
          {cell('ship', 'ship', s.upgrades.ship, sh.ship, 'ship')}
          {[0, 1, 2].map((i) => cell(`clan${i}`, `clan${i}`, s.upgrades.clan[i] ?? null, sh.clanSlot))}
        </div>
      </article>
    );
  };

  // ---------- rail (hidden inside the table shell: the shell draws these from publicSummary via bloodRageSeatCard) ----------
  const panel = (s: SeatView) => {
    const turn = v.turn === s.seat || (v.pending?.seats.includes(s.seat) ?? false);
    const d: SeatDetail = {
      seat: s.seat, clan: s.clan, glory: s.glory, rage: v.phase === 'action' ? s.rage : s.values.rage, hand: s.handCount, first: v.first === s.seat, onMap: s.onMap,
      steps: s.steps, values: s.values, passed: v.phase === 'action' && s.passed && !s.resigned, noRage: v.phase === 'action' && !s.passed && s.rage === 0 && !s.resigned,
      out: s.resigned, reserve: s.reserve, valhalla: s.valhalla, quests: s.questCount
    };
    return (
      <div key={s.seat} className={`bdr-panel${turn ? ' is-turn' : ''}${s.resigned ? ' is-out' : ''}`} style={cc(s.clan)} data-seat={s.seat} data-flip-anchor={`seat-${s.seat}`}>
        <div className="bdr-panel__head"><b style={ink(s.clan)}><bdi>{name(s.seat)}</bdi></b>{s.seat === mySeat && <span className="bgv-badge bgv-badge--sm">{t('شما', 'You')}</span>}</div>
        <div className="bdr-panel__score" title={t('افتخار', 'Glory')}><b className="bdr-num">{fa(s.glory)}</b> ★ <small>{t('افتخار', 'Glory')}</small></div>
        <PanelBody d={d} />
        <button className="bgv-btn bgv-btn--secondary bgv-btn--sm bdr-panel__more" type="button" data-open={`stats-${s.seat}`} onClick={() => setOpen(`stats-${s.seat}`)}>{t('جزئیات آمار', 'Stats details')}</button>
      </div>
    );
  };

  const logBox = (
    <section className="bdr bdr-logbox" aria-label={t('گزارش', 'Log')} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <h3>{t('گزارش', 'Log')}</h3>
      <ol className="bgv-log">{v.log.slice(-30).reverse().map((e, i) => <li key={i} className={`bgv-log__item${i === 0 ? ' is-new' : ''}`}>{e.seat >= 0 && v.seats[e.seat] && <b style={ink(v.seats[e.seat]!.clan)}><bdi>{name(e.seat)}</bdi></b>} {logText(e)}</li>)}</ol>
    </section>
  );
  const dialog = renderDialog(open, v, mySeat, name, shownBattle, () => setOpen(null), (i) => { setShownBattle(i); setOpen('battle'); });

  return (
    <div className="bdr-wrap" ref={wrapRef}>
    <div className={`bdr bdr-table${inShell ? ' is-shell' : ''}`} dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang} data-age={v.age} data-phase={v.phase} data-tab={tab} data-seq={v.seq}>
      <div className="bdr-main">
        <div className="bdr-chips" role="list" aria-label={t('بازیکنان به ترتیب نوبت', 'Players in turn order')}>
          {v.seats.map((s) => {
            const turn = v.turn === s.seat || (v.pending?.seats.includes(s.seat) ?? false);
            return (
              <div key={s.seat} role="listitem" className={`bdr-chip${turn ? ' is-turn' : ''}${s.seat === mySeat ? ' is-you' : ''}`} style={cc(s.clan)} data-seat={s.seat}>
                <img src={art(IDS.clanIcon[String(s.clan) as keyof typeof IDS.clanIcon])} alt="" />
                <span className="bdr-chip__id"><b><bdi>{s.seat === mySeat ? t('شما', 'You') : name(s.seat)}</bdi></b>
                  <small>{t(`${fa(v.phase === 'action' ? s.rage : s.values.rage)} خشم، ${fa(s.handCount)} کارت`, `${v.phase === 'action' ? s.rage : s.values.rage} rage, ${s.handCount} cards`)}</small></span>
                <span className="bdr-chip__glory">{`${fa(s.glory)} ${t('افتخار', 'Glory')}`}</span>
              </div>
            );
          })}
        </div>
        {phone && <div className="bdr-turnrow"><span className="bdr-bar__clock" data-shell-clock="" /><span className="bdr-agechip">{`${t('عصر', 'Age')} ${fa(v.age)}`}</span></div>}
        <div className="bdr-top">
          <nav className="bdr-tabs" role="tablist" aria-label={t('بخش‌های میز', 'Table sections')}>
            {([['map', t('نقشه', 'Map')], ['hand', `${t('دست', 'Hand')} ${v.me ? fa(v.me.hand.length) : ''}`], ['clan', t('قبیلهٔ من', 'My clan')], ['players', t('بازیکنان', 'Players')]] as [typeof tab, string][]).map(([k, l]) =>
              <button key={k} type="button" role="tab" className="bdr-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </nav>
          <div className="bdr-lang" data-theme={theme} role="group" aria-label={t('زبان بازی', 'Game language')}>
            <button type="button" aria-pressed={lang === 'fa'} onClick={() => switchLang('fa')}>فا</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>EN</button>
          </div>
        </div>
        <section className={`bdr-bar${waiting ? ' is-waiting' : ''}`} data-theme={theme} aria-label={t('نوار وضعیت', 'Status bar')} aria-live="polite">
          <div className="bdr-bar__row"><p className="bdr-bar__text">{text}</p>{buttons}{!phone && <span className="bdr-bar__clock" data-shell-clock="" />}</div>
          {nudge ? <p className="bdr-bar__note is-nudge" role="alert">{nudge}</p> : note && <p className="bdr-bar__note">{note}</p>}
        </section>
        {v.final && <FinalTable v={v} name={name} />}
        {mapBox}
        {draftPack.length > 0 && (
          <section className="bgv-felt bdr-zone bdr-draftzone" aria-label={t('یک کارت نگه دارید', 'Keep a card')}>
            <h2 className="bdr-ztitle">{draftNeed === 2 ? t('دو کارت نگه دارید', 'Keep two cards') : t('یک کارت نگه دارید', 'Keep a card')}</h2>
            <p className="bdr-zsub">{t('دستهٔ رسیده؛ بقیه به نفر چپ می‌رود', 'The rest goes to the next player clockwise')}</p>
            <div className="bdr-hand">{draftPack.map((c) => cardBtn(c, handPick.get(c)))}</div>
          </section>
        )}
        {v.me && (
          <section className="bgv-felt bdr-zone bdr-handzone" aria-label="دست من">
            <h2 className="bdr-ztitle">{t('دست من', 'My hand')}</h2>
            {v.me.hand.length === 0 && <p className="bdr-zsub">دست خالی است.</p>}
            <div className="bdr-hand">{v.me.hand.map((c) => cardBtn(c, kind === 'draftPick' ? undefined : handPick.get(c), discarding && !handPick.get(c)?.on))}</div>
            {v.me.quests.length > 0 && <><p className="bdr-zsub">مأموریت‌های متعهدشده</p><div className="bdr-hand">{v.me.quests.map((c) => cardBtn(c, undefined))}</div></>}
          </section>
        )}
        <section className="bdr-sheetszone" aria-label={t('صفحه‌های قبیله', 'Clan sheets')} id="bdr-sheets">
          <div className="bdr-sheets">{order.map((s) => sheet(v.seats[s]!))}</div>
        </section>
      </div>
      {inShell && !phone && <RailSlot>{logBox}</RailSlot>}
      <aside className="bdr-rail" aria-label={t('بازیکن‌ها', 'Players')}>
        {v.seats.map(panel)}
        {(!inShell || phone) && logBox}
      </aside>
      {dialog}
      {sheetOpen && phone && actionList.length > 0 && (
        <div className="bdr-scrim bdr-scrim--sheet" data-theme={theme} onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}>
          <section className="bgv-sheet bdr-bsheet" role="dialog" aria-modal="true" aria-label={t('اقدام‌ها', 'Actions')}>
            <span className="bgv-sheet__handle" />
            <div className="bdr-bsheet__head"><b>{t('یک اقدام انتخاب کنید', 'Choose an action')}</b>{me && <span className="bdr-pill"><img src={art('tokens/icon-rage-mini.webp')} alt="" /><span className="bdr-num">{fa(me.rage)}</span></span>}</div>
            <div className="bdr-sgrid">{actionList.map((x) => (
              <button key={x.act} type="button" data-act={x.act} className={`bgv-btn bgv-btn--${x.variant === 'leave' ? 'ghost' : 'secondary'}${hintCls(!!x.hint)}`} disabled={busy} onClick={() => { setSheetOpen(false); x.go(); }}>
                {x.label}{x.sub && <small>{x.sub}</small>}
              </button>))}</div>
            {me && <p className="bdr-note">{t(`مهره روی نقشه ${fa(me.onMap)} از ${fa(me.horns)} (شاخ)`, `Figures on the map ${me.onMap} of ${me.horns} (Horns)`)}</p>}
          </section>
        </div>
      )}
    </div>
    </div>
  );
}

/** Public per-seat data of the BGA player board (rules.ts publicSummary `detail`). */
export interface SeatDetail {
  seat: number; clan: number; glory: number; rage: number; hand: number; first: boolean; onMap: number;
  steps: Record<StatKey, number>; values: Record<StatKey, number>; passed: boolean; noRage: boolean; out: boolean; reserve: number; valhalla: number; quests: number;
}
/** BGA player board body (§18), shared by the shell rail and the renderer's own rail outside the shell. */
function PanelBody({ d, clan = true }: { d: SeatDetail; clan?: boolean }) {
  return (
    <>
      <div className="bdr-panel__line1">
        {clan && <img src={art(IDS.clanIcon[String(d.clan) as keyof typeof IDS.clanIcon])} className="bdr-panel__clan" alt={`${t('قبیلهٔ', 'Clan')} ${CLAN_FA(d.clan)}`} title={`${t('قبیلهٔ', 'Clan')} ${CLAN_FA(d.clan)}`} />}
        <span className="bdr-ragebox" title={t(`خشم فعلی؛ شروع هر عصر ${fa(d.values.rage)}`, `Current rage; ${d.values.rage} each Age`)}><img src={art('tokens/icon-rage.webp')} alt="" /><b className="bdr-num">{fa(d.rage)}</b></span>
        <span className="bdr-cardbox" title={t('کارت در دست', 'Cards in hand')}><img src={art('ui-icons/board-card.webp')} alt="" /><b className="bdr-num">{fa(d.hand)}</b></span>
        {d.first && <img src={art('tokens/firstplayer.webp')} className="bdr-fp" title={t('بازیکن اول این عصر', 'First player this Age')} alt={t('بازیکن اول', 'First player')} />}
      </div>
      <div className="bdr-stats">
        {(['rage', 'axe', 'horn'] as StatKey[]).map((st) => (
          <span key={st} className={`bdr-stat${d.steps[st] >= 3 ? ' is-legend' : ''}`} title={`${STAT_FA[st]}: ${t('پلهٔ', 'step')} ${fa(d.steps[st] + 1)} ${t('از ۶', 'of 6')}`}>
            <img src={art(`tokens/icon-${st}-mini.webp`)} alt={STAT_FA[st]} /><span className="bdr-num">{st === 'horn' ? `${fa(d.onMap)}/${fa(d.values.horn)}` : `${fa(d.values[st])}/${fa(TRACK[st][5]!)}`}</span>
          </span>
        ))}
      </div>
      <div className="bdr-panel__badges">
        {d.out && <span className="bgv-badge bgv-badge--sm">{t('انصراف', 'Resigned')}</span>}
        {d.passed && <span className="bgv-badge bgv-badge--sm">{t('کنار کشید', 'Passed')}</span>}
        {d.noRage && <span className="bgv-badge bgv-badge--sm bgv-badge--warning">{t('خشم تمام شد', 'Out of rage')}</span>}
      </div>
    </>
  );
}
/** Rail panel in the table shell (apps/web SEAT_CARDS): glory + BGA board body from publicSummary `detail`. */
export function bloodRageSeatCard(seat: { seat: number; primary?: { value: number }; status?: string; detail?: unknown }, turn: boolean) {
  const d = seat.detail as SeatDetail | undefined;
  if (!d) return {};
  return {
    stats: undefined,
    score: undefined, scoreLabel: undefined, clock: undefined, badge: undefined, strikes: undefined, strikesOf: undefined,
    avatar: { src: art(IDS.clanIcon[String(d.clan) as keyof typeof IDS.clanIcon]), name: `${t('قبیلهٔ', 'Clan')} ${CLAN_FA(d.clan)}`, className: 'bdr-avatar', style: cc(d.clan) },
    sub: `${fa(d.glory)} ★ ${t('افتخار', 'Glory')}${d.out ? `، ${t('انصراف داده', 'Resigned')}` : turn ? `، ${t('در نوبت', 'To act')}` : ''}`,
    detail: (
      <div className="bdr bdr-panel--shell" style={cc(d.clan)}>
        <PanelBody d={d} clan={false} />
        <button className="bgv-btn bgv-btn--secondary bgv-btn--sm bdr-panel__more" type="button" data-open={`stats-${d.seat}`}
          onClick={() => window.dispatchEvent(new CustomEvent('bdr-open', { detail: `stats-${d.seat}` }))}>{t('جزئیات آمار', 'Stats details')}</button>
      </div>
    )
  };
}

const TRACK: Record<StatKey, number[]> = { rage: [6, 7, 8, 9, 12, 12], axe: [3, 4, 5, 6, 8, 8], horn: [4, 5, 6, 7, 10, 10] };

function Tip({ c, age }: { c: number; age: number }) {
  const card = CARD_BY_NUM[c];
  if (!card) return null;
  const TYPE_FA: Record<string, string> = { battle: 'نبرد', quest: 'مأموریت', clan: 'ارتقای قبیله', leader: 'ارتقای سردار', warrior: 'ارتقای جنگجو', ship: 'ارتقای کشتی', monster: 'هیولا' };
  const val = card.type === 'battle' ? (card.value < 0 ? 'قدرت: بالاترین کارت حریف' : `قدرت +${fa(card.value)}`) : card.type === 'quest' ? `${fa(card.value)} افتخار` : `هزینه ${fa(card.value)} خشم`;
  return (
    <div className="bdr-tip" role="tooltip">
      <img src={cardArt(c)} alt="" />
      <div><h3>{card.titleFa}<small dir="ltr">{card.titleEn}</small></h3>
        <p>{TYPE_FA[card.type] ?? card.type}<span className="bgv-sep" />{val}<span className="bgv-sep" />عصر {fa(age)}<span className="bgv-sep" />{fa(card.minPlayers)}+ نفر</p>
        <p>{card.rulesFa}</p><p className="bdr-tip__en" dir="ltr">{card.rulesEn}</p></div>
    </div>
  );
}

function FinalTable({ v, name }: { v: BloodRageView; name: (s: number) => string }) {
  const rows = [...v.final!].sort((a, b) => a.place - b.place);
  return (
    <section className="bdr-frame" data-theme={typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} aria-label={t('پایان بازی', 'Game over')}>
      <h2>{t('پایان بازی', 'Game over')}</h2>
      <table className="bdr-table">
        <thead><tr><th>رتبه</th><th>بازیکن</th><th>افتخار</th><th>خشم</th><th>تبر</th><th>شاخ</th><th>کارت‌های پایانی</th><th>جمع</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.seat} className={r.place === 1 ? 'is-win' : ''}>
            <td>{fa(r.place)}</td><td><bdi>{name(r.seat)}</bdi></td><td>{fa(r.glory)}</td>
            {(['rage', 'axe', 'horn'] as StatKey[]).map((st) => <td key={st}><span className="bdr-num">{r.legend[st] ? `+${fa(r.legend[st])}` : fa(0)}</span></td>)}
            <td>{fa(r.cards)}</td><td><b>{fa(r.total)}</b></td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function Dlg({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="bdr-scrim" data-theme={typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className="bgv-dialog bdr-dlg" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <header className="bdr-dlg__head"><h2>{title}</h2><button type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm" onClick={onClose}>{t('بستن', 'Close')}</button></header>
        {children}
      </section>
    </div>
  );
}

function BattleBox({ v, r, name }: { v: BloodRageView; r: BattleRecordView; name: (s: number) => string }) {
  const tok = (id: string) => { const f = v.figures.find((x) => x.id === id); return f ? <img key={id} src={tokenArt(v, f)} alt={figName(v, f)} /> : null; };
  return (
    <div className="bdr-battle">
      {r.lines.map((l) => {
        const s = v.seats[l.seat]!;
        return (
          <div key={l.seat} className={`bdr-bline${r.winner === l.seat ? ' is-win' : ''}`} style={cc(s.clan)}>
            <div className="bdr-bline__who"><img src={art(IDS.clanIcon[String(s.clan) as keyof typeof IDS.clanIcon])} alt="" /><span><bdi>{name(l.seat)}</bdi>{l.seat === r.attacker && <small>(غارتگر)</small>}</span></div>
            <span className="bdr-bline__str bdr-num">{fa(l.str)}</span>
            <span className="bdr-bline__card">{l.cards.length ? l.cards.map((c) => <img key={c} src={cardArt(c, v.defs[c])} alt={cardTitle(c).en} />) : <small>بی‌کارت</small>}</span>
            <span className="bdr-bline__figs">{l.figures.map(tok)}</span>
          </div>
        );
      })}
      <p className={`bdr-result${r.winner === null ? ' is-bad' : ''}`}>
        {r.winner === null ? 'برابری: همه باختند و کسی غارت نکرد.' : <><b><bdi>{name(r.winner)}</bdi></b> برد{r.pillaged ? ' و غارت موفق شد' : ''}؛ افتخار نبرد = تبر برنده.</>}
      </p>
    </div>
  );
}

function renderDialog(open: string | null, v: BloodRageView, mySeat: number | null, name: (s: number) => string, shown: number | null, close: () => void, showBattle: (i: number) => void): ReactNode {
  if (!open) return null;
  const tok = (f: FigureView) => <img key={f.id} src={tokenArt(v, f)} alt={`${figName(v, f)} ${name(f.seat)}`} />;
  if (open === 'ages') return (
    <Dlg title="مسیر عصرها" onClose={close}>
      <ul className="bdr-ages">{[1, 2, 3].map((a) => (
        <li key={a} className={a === v.age ? 'is-cur' : a < v.age ? 'is-past' : ''}>
          <img src={cardBack(a)} alt="" style={{ blockSize: 28 }} /><b>عصر {fa(a)}</b>
          {a === v.age && PHASES.map(([k, l, en]) => <span key={k} className={k === v.phase ? 'bdr-pill' : ''}>{t(l, en)}</span>)}
          <small>راگناروک در {provFa(v.ragnarok[a - 1] ?? 0)}، {fa(RAGNAROK_GLORY[a] ?? 0)} افتخار برای هر مهره</small>
        </li>))}</ul>
    </Dlg>
  );
  if (open === 'battle') { const r = v.battles[shown ?? v.battles.length - 1]; return r ? <Dlg title={<>نبرد در {provFa(r.province)}!</>} onClose={close}><BattleBox v={v} r={r} name={name} /></Dlg> : null; }
  if (open === 'archive') return (
    <Dlg title="بایگانی نبردها" onClose={close}>
      {v.battles.length === 0 ? <p>هنوز نبردی نشده است.</p> : <ul className="bdr-ages">{v.battles.map((r, i) => (
        <li key={i}><b>عصر {fa(r.age)}</b> {provFa(r.province)}<span className="bgv-sep" />{r.winner === null ? 'برابری' : <>برنده: <bdi>{name(r.winner)}</bdi></>}
          <button type="button" className="bgv-btn bgv-btn--secondary bgv-btn--sm" onClick={() => showBattle(i)}>نمایش</button></li>))}</ul>}
    </Dlg>
  );
  if (open === 'discard') return (
    <Dlg title="کارت‌های نبرد دورریخته" onClose={close}>
      {v.discardPublic.length ? <div className="bdr-cardrow">{v.discardPublic.map((c) => <img key={c} src={cardArt(c, v.defs[c])} alt={`${cardTitle(c).en} — ${cardTitle(c).fa}`} />)}</div> : <p>هنوز کارتی دور ریخته نشده است.</p>}
    </Dlg>
  );
  if (open === 'valhalla') return (
    <Dlg title="والهالا" onClose={close}>
      <div className="bdr-valh">{v.seats.map((s) => { const fs = v.figures.filter((f) => f.seat === s.seat && f.where === 'valhalla'); return fs.length ? <div key={s.seat} style={cc(s.clan)}><bdi>{name(s.seat)}</bdi>{fs.map(tok)}</div> : null; })}</div>
      {!v.figures.some((f) => f.where === 'valhalla') && <p>والهالا خالی است.</p>}
    </Dlg>
  );
  if (open === 'endage') return <EndAge v={v} name={name} onClose={close} />;
  const [k, n] = open.split('-');
  const seat = Number(n);
  const s = v.seats[seat];
  if (!s) return null;
  if (k === 'reserve') return (
    <Dlg title={<>ذخیره: <bdi>{name(seat)}</bdi></>} onClose={close}>
      <div className="bdr-resgrid">{v.figures.filter((f) => f.seat === seat && f.where === 'reserve').map(tok)}</div>
    </Dlg>
  );
  if (k === 'quests') return (
    <Dlg title={<>مأموریت‌ها: <bdi>{name(seat)}</bdi></>} onClose={close}>
      {seat === mySeat && v.me ? (v.me.quests.length ? <div className="bdr-cardrow">{v.me.quests.map((c) => <img key={c} src={cardArt(c, v.defs[c])} alt={`${cardTitle(c).en} — ${cardTitle(c).fa}: ${cardTitle(c).text}`} />)}</div> : <p>مأموریتی ندارید.</p>)
        : <p>{fa(s.questCount)} مأموریت رو به پایین.</p>}
    </Dlg>
  );
  if (k === 'stats') {
    const ROWY: Record<StatKey, number> = { rage: 80, axe: 183, horn: 286 };
    const STEPX = [229, 328, 427, 527, 626, 725];
    return (
      <Dlg title={<>آمار <bdi>{name(seat)}</bdi></>} onClose={close}>
        <div className="bdr-statboard" dir="ltr"><img src={art('boards/clan-statistics.webp')} alt="مسیر ویژگی‌ها" />
          {(['rage', 'axe', 'horn'] as StatKey[]).map((st) => <img key={st} className="bdr-stok" src={art(IDS.clanIcon[String(s.clan) as keyof typeof IDS.clanIcon])} alt={`${STAT_FA[st]}: پلهٔ ${fa(s.steps[st] + 1)}`}
            style={{ left: `${(STEPX[s.steps[st]]! / 800) * 100}%`, top: `${((ROWY[st] - 6) / 347) * 100}%` }} />)} {/* ds-check-ignore: LTR stat board art */}
        </div>
        <p>خشم {fa(s.values.rage)}<span className="bgv-sep" />تبر {fa(s.values.axe)}<span className="bgv-sep" />شاخ {fa(s.values.horn)}<span className="bgv-sep" />والهالا {fa(s.valhalla)}</p>
      </Dlg>
    );
  }
  return null;
}

/** §22 end of the Age: committed quests with the result, Ragnarök (province, figures lost, glory) and the Valhalla release. */
function EndAge({ v, name, onClose }: { v: BloodRageView; name: (s: number) => string; onClose: () => void }) {
  const rIdx = v.log.map((e) => e.e).lastIndexOf('ragnarok');
  const start = v.log.slice(0, rIdx).map((e) => e.e).lastIndexOf('end-action');
  const quests = v.log.slice(start + 1, rIdx).filter((e) => e.e === 'quest' || e.e === 'quest-failed');
  const after = v.log.slice(rIdx + 1);
  const rag = v.log[rIdx];
  const doom = after.filter((e) => e.e === 'doom');
  const release = after.filter((e) => e.e === 'release');
  const age = rag?.n ?? v.age;
  const prov = provOfKey(rag?.at);
  const qArt = (def?: string) => (def ? art(`cards/${ART_OF_DEF[def] ?? ''}.webp`) : '');
  return (
    <Dlg title={t(`عصر ${fa(age)}، پایان عصر`, `Age ${age}: end of the Age`)} onClose={onClose}>
      <h3>{t('مأموریت‌ها', 'Quests')}</h3>
      {quests.length ? <div className="bdr-cardrow">{quests.map((e, i) => (
        <div key={i} className="bdr-q">
          <img src={qArt(e.card)} alt={CARD_BY_ID[e.card ?? '']?.nameEn ?? ''} />
          <b><bdi>{name(e.seat)}</bdi></b>
          {e.e === 'quest' ? <span className="bdr-ok">{t(`انجام شد +${fa(e.n ?? 0)}`, `Done +${e.n ?? 0}`)}</span> : <span className="bdr-no2">{t('ناموفق', 'Failed')}</span>}
        </div>))}</div> : <p>{t('مأموریتی متعهد نشده بود.', 'No quests were committed.')}</p>}
      <h3>{t('راگناروک', 'Ragnarök')}</h3>
      <p className="bdr-ragline"><img src={art('tokens/ragnarok.webp')} alt="" />{t(`استان ${provFa(prov)} نابود شد؛ هر مهره ${fa(RAGNAROK_GLORY[age] ?? 0)} افتخار.`, `${provFa(prov)} was destroyed; ${RAGNAROK_GLORY[age] ?? 0} glory per figure.`)}</p>
      {doom.length > 0 && <table className="bdr-table"><thead><tr><th>{t('بازیکن', 'Player')}</th><th>{t('مهره‌های نابود', 'Figures lost')}</th><th>{t('افتخار', 'Glory')}</th></tr></thead>
        <tbody>{doom.map((e) => <tr key={e.seat}><td><bdi>{name(e.seat)}</bdi></td><td>{fa(e.w ?? 0)}</td><td><span className="bdr-num">+{fa(e.n ?? 0)}</span></td></tr>)}</tbody></table>}
      <h3>{t('آزادی از والهالا', 'Release Valhalla')}</h3>
      {release.length ? <ul className="bdr-ages">{release.map((e) => <li key={e.seat}><bdi>{name(e.seat)}</bdi><span className="bgv-sep" />{t(`${fa(e.w ?? 0)} مهره به ذخیره`, `${e.w ?? 0} figures back to reserve`)}{(e.n ?? 0) > 0 && <><span className="bgv-sep" /><span className="bdr-num">+{fa(e.n!)}</span> {t('افتخار (لوکی)', 'glory (Loki)')}</>}</li>)}</ul> : <p>{t('والهالا خالی بود.', 'Valhalla was empty.')}</p>}
    </Dlg>
  );
}

function logText(e: LogEntry): string {
  const p = (k?: string) => provFa(provOfKey(k));
  const c = (d?: string) => (LANG === 'en' ? CARD_BY_ID[d ?? '']?.nameEn : CARD_BY_ID[d ?? '']?.nameFa) ?? '';
  const n = fa(e.n ?? 0), w = fa(e.w ?? 0);
  switch (e.e) {
    case 'age': return t(`عصر ${n} شروع شد.`, `Age ${n} begins.`);
    case 'invade': return e.at?.startsWith('f') ? t('یورش به آبدره.', 'invades a fjord.') : t(`یورش به ${p(e.at)}.`, `invades ${p(e.at)}.`);
    case 'march': return t(`لشکرکشی از ${p(e.to)} به ${p(e.at)}.`, `marches from ${p(e.to)} to ${p(e.at)}.`);
    case 'pillage': return t(`${p(e.at)} را غارت می‌کند.`, `pillages ${p(e.at)}.`);
    case 'call': return t(`مهره‌ای را به نبرد ${p(e.at)} فراخواند.`, `calls a figure to the battle in ${p(e.at)}.`);
    case 'win': return t(`نبرد ${p(e.at)} را برد.`, `wins the battle in ${p(e.at)}.`);
    case 'tie': return t(`نبرد ${p(e.at)} برابر شد؛ همه باختند.`, `the battle in ${p(e.at)} is a tie; everybody loses.`);
    case 'reward': return t(`پاداش غارت ${p(e.at)} را گرفت.`, `takes the pillage reward of ${p(e.at)}.`);
    case 'upgrade': return t(`ارتقا: ${c(e.card)}.`, `upgrades: ${c(e.card)}.`);
    case 'commit': return t('یک مأموریت متعهد شد.', 'commits a quest.');
    case 'quest': return t(`مأموریت ${c(e.card)} انجام شد (+${n}).`, `completes ${c(e.card)} (+${n}).`);
    case 'quest-failed': return t(`مأموریت ${c(e.card)} ناموفق بود.`, `fails ${c(e.card)}.`);
    case 'ragnarok': return t(`راگناروک: ${p(e.at)} نابود شد.`, `Ragnarök: ${p(e.at)} is destroyed.`);
    case 'doom': return t(`راگناروک: ${w} مهره در ${p(e.at)} نابود شد (+${n} افتخار).`, `loses ${w} figures in Ragnarök (+${n} glory).`);
    case 'release': return t(`${w} مهره از والهالا آزاد شد${(e.n ?? 0) > 0 ? ` (+${n} افتخار)` : ''}.`, `${w} figures leave Valhalla${(e.n ?? 0) > 0 ? ` (+${n} glory)` : ''}.`);
    case 'pass': return t('کنار کشید.', 'passes.');
    case 'timeout': return t('زمان نوبت تمام شد؛ نوبت رد شد.', 'ran out of time; turn skipped.');
    case 'resign': return t('انصراف داد.', 'resigns.');
    case 'watch': return t(`دیدبان هایمدال: ${n} افتخار.`, `Heimdall's Watch: ${n} glory.`);
    case 'sacrifice': return t('فداکاری فریگا.', "Frigga's Sacrifice.");
    case 'end-action': return t('فاز اقدام تمام شد.', 'The Action phase ends.');
    case 'final': return t(`امتیاز نهایی: ${n}.`, `final score: ${n}.`);
    default: return '';
  }
}
