import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GAME_TAG_FA, type GameSummary, type GameTag } from '@bg/contracts';
import { Button, Checkbox, Chip, Icon, PageHead, Radio, Segmented, Select, Skeleton, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

// Server-side filters (sent to /games) and client-side ones (`bot`, `sort`) that stay in the URL too.
type FilterKey = 'players' | 'maxMinutes' | 'difficulty' | 'mode' | 'access' | 'tags';
const SERVER_KEYS = ['q', 'players', 'maxMinutes', 'difficulty', 'mode', 'access', 'tags'];
const TAG_OPTIONS = (Object.keys(GAME_TAG_FA) as GameTag[]).map((value) => ({ value, label: GAME_TAG_FA[value] }));
const MODE_FA: Record<string, string> = { live: 'زنده', turn: 'نوبتی', friendly: 'دوستانه', ranked: 'رتبه‌دار' };
const PAGE = 12;

const SORTS: [string, string][] = [['popular', 'محبوب‌ترین'], ['name', 'نام'], ['time', 'کوتاه‌ترین'], ['players', 'کم‌نفرترین']];
const sortGames = (items: GameSummary[], sort: string) => {
  const by: Record<string, (a: GameSummary, b: GameSummary) => number> = {
    name: (a, b) => a.nameFa.localeCompare(b.nameFa, 'fa'), time: (a, b) => a.minMinutes - b.minMinutes, players: (a, b) => a.minPlayers - b.minPlayers
  };
  return by[sort] ? [...items].sort(by[sort]) : items;
};

/** Quick starting points shown above the grid; each one sets filters. */
const PRESETS: { label: string; text: string; icon: string; set: Record<string, string>; match: (g: GameSummary) => boolean }[] = [
  { label: 'شروع آسان', text: 'قانون کوتاه', icon: 'sparkles', set: { difficulty: 'easy' }, match: (g) => g.difficulty === 'easy' },
  { label: 'دونفره', text: 'تن‌به‌تن', icon: 'swords', set: { players: '2' }, match: (g) => g.minPlayers <= 2 && g.maxPlayers >= 2 },
  { label: 'با ربات', text: 'بدون انتظار', icon: 'bot', set: { bot: '1' }, match: (g) => g.botAvailable },
  { label: 'کمتر از ۳۰ دقیقه', text: 'یک دست سریع', icon: 'clock', set: { maxMinutes: '30' }, match: (g) => g.minMinutes <= 30 }
];
const TIMES = [30, 60, 120];
const DIFF: [string, string][] = [['easy', 'آسان'], ['medium', 'متوسط'], ['hard', 'دشوار']];

export function Catalog() {
  usePageTitle('بازی‌ها', 'همه بردگیم‌های آنلاین | بردگیم‌ورس');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [shown, setShown] = useState(PAGE);

  // Debounced free-text search kept in the URL so results are shareable and survive reload.
  useEffect(() => {
    if (q.trim() === (params.get('q') ?? '')) return; // nothing to sync (a stray replace here could clobber a navigation already under way)
    const t = setTimeout(() => {
      setParams((p) => { const n = new URLSearchParams(p); if (q.trim()) n.set('q', q.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, setParams]);

  const setKey = (key: string, value: string) => {
    setShown(PAGE);
    setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });
  };
  const setFilter = (key: FilterKey, value: string) => setKey(key, value);

  const apiQs = new URLSearchParams([...params].filter(([k]) => SERVER_KEYS.includes(k))).toString();
  const { data, error, loading, reload } = useApi<{ items: GameSummary[] }>(`/games${apiQs ? `?${apiQs}` : ''}`);
  // Unfiltered list for the counts next to each filter and the preset art.
  const everything = useApi<{ items: GameSummary[] }>('/games');
  const all = useMemo(() => (everything.data?.items ?? []).filter((g) => !g.isTestGame), [everything.data]);
  const [moreTags, setMoreTags] = useState(false);
  const hasFilters = params.toString().replace(/(^|&)sort=[^&]*/, '').length > 0;
  const clear = () => { setQ(''); setShown(PAGE); setParams({}, { replace: true }); };
  const mode = params.get('mode');
  const onlyBot = params.get('bot') === '1';
  const sort = params.get('sort') ?? 'popular';
  const players = params.get('players') ?? '';

  const items = useMemo(() => sortGames((data?.items ?? []).filter((g) => !onlyBot || g.botAvailable), sort), [data, onlyBot, sort]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const live = mode === 'live' || mode === 'turn' ? mode : '';
  const tags = (params.get('tags') ?? '').split(',').filter((t): t is GameTag => t in GAME_TAG_FA);
  const tagCount = (t: string) => all.filter((g) => (g.tags as string[]).includes(t)).length;
  // Every active filter as a removable chip next to the count (Catalog-Desktop).
  const active: [string, string][] = [
    ...(mode ? [['mode', MODE_FA[mode] ?? mode] as [string, string]] : []),
    ...(players ? [['players', players === '6' ? '+۶ نفر' : `${faNum(Number(players))} نفر`] as [string, string]] : []),
    ...(params.get('maxMinutes') ? [['maxMinutes', `تا ${faNum(Number(params.get('maxMinutes')))} دقیقه`] as [string, string]] : []),
    ...(params.get('difficulty') ? [['difficulty', DIFF.find(([v]) => v === params.get('difficulty'))?.[1] ?? ''] as [string, string]] : []),
    ...(onlyBot ? [['bot', 'با ربات'] as [string, string]] : []),
    ...tags.map((t) => [`tag:${t}`, GAME_TAG_FA[t]] as [string, string])
  ];
  const dropFilter = (key: string) => key.startsWith('tag:') ? setFilter('tags', tags.filter((t) => t !== key.slice(4)).join(',')) : setKey(key, '');

  return (
    <>
      <PageTabs group="games" />
      <PageHead title="بازی‌ها" sub={`${all.length ? `${faNum(all.length)} بردگیم رومیزی؛ ` : ''}نوبتی یا زنده، با دوستان یا با ربات.`} />

      <div className="pg-presets" role="group" aria-label="شروع سریع">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="bgv-card pg-preset" onClick={() => { setShown(PAGE); setParams(new URLSearchParams(p.set), { replace: true }); setQ(''); }}>
            {/* Catalog-Desktop: a fan of three matching boxes, the count and a short line. */}
            <span className="pg-preset__art" aria-hidden="true">{all.filter(p.match).slice(0, 3).reverse().map((g) => <img key={g.id} src={`/covers/box/${g.id}.webp`} alt="" loading="lazy" />)}</span>
            <span className="pg-preset__text"><b><Icon name={p.icon} size="sm" />{p.label}</b><small>{faNum(all.filter(p.match).length)} بازی<span className="bgv-sep" />{p.text}</small></span>
          </button>
        ))}
      </div>

      <div className="pg-catlayout">
        <search>
          <form className={`bgv-card pg-stack pg-catform${filtersOpen ? ' is-open' : ''}`} onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو و فیلتر بازی‌ها">
            <div className="bgv-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="t-title" style={{ margin: 0 }}><Icon name="sliders-horizontal" /> فیلترها</h2>
              {hasFilters && <Button size="sm" variant="ghost" onClick={clear}>پاک‌کردن</Button>}
            </div>
            <TextField label="جست‌وجو" icon="search" type="search" name="q" placeholder="نام فارسی یا اصلی" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button className="pg-filtbtn" icon="sliders-horizontal" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>فیلترهای بیشتر</Button>
            <div className="pg-filtbody">
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">نوع بازی</span>
                <Segmented label="نوع بازی" block value={live} onChange={(v) => setFilter('mode', v)} options={[{ value: '', label: 'همه' }, { value: 'turn', label: 'نوبتی', icon: 'hourglass' }, { value: 'live', label: 'زنده', icon: 'zap' }]} />
              </div>
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">تعداد نفر</span>
                <div className="bgv-chips" role="group" aria-label="تعداد نفر">
                  {[2, 3, 4, 5, 6].map((n) => <Chip key={n} selected={players === String(n)} onClick={() => setFilter('players', players === String(n) ? '' : String(n))}>{n === 6 ? '+۶' : faNum(n)}</Chip>)}
                </div>
              </div>
              <fieldset className="pg-flist" role="radiogroup" aria-label="زمان یک دست">
                <legend className="bgv-label">زمان یک دست</legend>
                {[0, ...TIMES].map((n) => (
                  <div key={n} className="pg-flist__row"><Radio name="maxMinutes" checked={(params.get('maxMinutes') ?? '') === (n ? String(n) : '')} onChange={() => setFilter('maxMinutes', n ? String(n) : '')} label={n ? `تا ${faNum(n)} دقیقه` : 'همه'} />
                    <span className="pg-flist__n">{faNum(n ? all.filter((g) => g.minMinutes <= n).length : all.length)}</span></div>
                ))}
              </fieldset>
              <fieldset className="pg-flist">
                <legend className="bgv-label">دشواری</legend>
                {DIFF.map(([v, label]) => (
                  <div key={v} className="pg-flist__row"><Checkbox checked={params.get('difficulty') === v} onChange={(e) => setFilter('difficulty', e.target.checked ? v : '')} label={label} />
                    <span className="pg-flist__n">{faNum(all.filter((g) => g.difficulty === v).length)}</span></div>
                ))}
              </fieldset>
              <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                <span className="bgv-label">با ربات</span>
                <Switch label="فقط بازی‌هایی که ربات دارند" hint="برای تمرین، بدون انتظار" checked={onlyBot} onChange={(v) => setKey('bot', v ? '1' : '')} />
              </div>
              <fieldset className="pg-flist">
                <legend className="bgv-label">برچسب‌ها</legend>
                {[...TAG_OPTIONS].sort((a, b) => tagCount(b.value) - tagCount(a.value)).slice(0, moreTags ? undefined : 7).map((t) => (
                  <div key={t.value} className="pg-flist__row"><Checkbox checked={tags.includes(t.value)} onChange={(e) => setFilter('tags', (e.target.checked ? [...tags, t.value] : tags.filter((x) => x !== t.value)).join(','))} label={t.label} />
                    <span className="pg-flist__n">{faNum(tagCount(t.value))}</span></div>
                ))}
                {TAG_OPTIONS.length > 7 && <Button size="sm" variant="ghost" icon={moreTags ? 'chevron-up' : 'plus'} onClick={() => setMoreTags(!moreTags)}>{moreTags ? 'برچسب‌های کمتر' : `${faNum(TAG_OPTIONS.length - 7)} برچسب دیگر`}</Button>}
              </fieldset>
            </div>
          </form>
        </search>

        <div className="pg-stack" style={{ minInlineSize: 0 }}>
          {loading && !data && (
            <>
              <div className="bgv-grid" aria-hidden>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={300} radius="var(--radius-lg)" />)}</div>
              <span className="bgv-sr" role="status">در حال بارگذاری بازی‌ها…</span>
            </>
          )}
          {error && <StateBlock kind="error" title="فهرست بازی‌ها بارگذاری نشد" text={error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} />}
          {data && !error && (
            items.length === 0 ? (
              <StateBlock kind="empty" title="بازی‌ای با این مشخصات پیدا نشد"
                text={hasFilters ? 'فیلترها را کمتر کنید یا عبارت دیگری جست‌وجو کنید.' : 'هنوز بازی‌ای در کاتالوگ منتشر نشده است.'}
                action={hasFilters ? <Button onClick={clear}>پاک‌کردن فیلترها</Button> : undefined} />
            ) : (
              <>
                <div className="pg-results">
                  <b className="t-title" role="status" aria-live="polite">{faNum(items.length)} بازی</b>
                  {active.map(([k, label]) => <Chip key={k} size="sm" selected icon="x" onClick={() => dropFilter(k)} aria-label={`حذف فیلتر ${label}`}>{label}</Chip>)}
                  <span className="pg-results__sort"><Select label="مرتب‌سازی" value={sort} onChange={(e) => setKey('sort', e.target.value === 'popular' ? '' : e.target.value)} options={SORTS.map(([value, label]) => ({ value, label }))} /></span>
                </div>
                <div className="bgv-grid pg-catgrid" data-tour="catalog-grid">{items.slice(0, shown).map((g) => <GameCard key={g.id} game={g} />)}</div>
                {items.length > shown && (
                  <div className="pg-more">
                    <span className="t-caption bgv-muted">{faNum(Math.min(shown, items.length))} از {faNum(items.length)} بازی</span>
                    <Button onClick={() => setShown(shown + PAGE)}>نمایش {faNum(Math.min(PAGE, items.length - shown))} بازی دیگر</Button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
