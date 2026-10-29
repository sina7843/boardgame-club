import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GAME_TAG_FA, type GameSummary, type GameTag } from '@bg/contracts';
import { Button, Chip, ChipGroup, Icon, PageHead, Segmented, Select, Skeleton, StateBlock, Switch, TextField } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

// Server-side filters (sent to /games) and client-side ones (`bot`, `sort`) that stay in the URL too.
type FilterKey = 'players' | 'maxMinutes' | 'difficulty' | 'mode' | 'access' | 'tags';
const SERVER_KEYS = ['q', 'players', 'maxMinutes', 'difficulty', 'mode', 'access', 'tags'];
const TAG_OPTIONS = (Object.keys(GAME_TAG_FA) as GameTag[]).map((value) => ({ value, label: GAME_TAG_FA[value] }));
const ALL = { value: '', label: 'همه' };
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
const PRESETS: { label: string; text: string; icon: string; set: Record<string, string> }[] = [
  { label: 'شروع آسان', text: 'قانون کوتاه، یاد گرفتن سریع', icon: 'sparkles', set: { difficulty: 'easy' } },
  { label: 'دونفره', text: 'تو و یک حریف', icon: 'swords', set: { players: '2' } },
  { label: 'با ربات', text: 'بدون انتظار برای حریف', icon: 'bot', set: { bot: '1' } },
  { label: 'کمتر از ۳۰ دقیقه', text: 'یک دست سریع', icon: 'clock', set: { maxMinutes: '30' } }
];

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
  const hasFilters = params.toString().replace(/(^|&)sort=[^&]*/, '').length > 0;
  const clear = () => { setQ(''); setShown(PAGE); setParams({}, { replace: true }); };
  const sel = (key: FilterKey, label: string, options: { value: string; label: string }[]) => (
    <Select label={label} value={params.get(key) ?? ''} onChange={(e) => setFilter(key, e.target.value)} options={[ALL, ...options]} />
  );
  const mode = params.get('mode');
  const onlyBot = params.get('bot') === '1';
  const sort = params.get('sort') ?? 'popular';
  const players = params.get('players') ?? '';

  const items = useMemo(() => sortGames((data?.items ?? []).filter((g) => !onlyBot || g.botAvailable), sort), [data, onlyBot, sort]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const live = mode === 'live' || mode === 'turn' ? mode : '';

  return (
    <>
      <PageTabs group="games" />
      <PageHead title="بازی‌ها" sub={`${data && !hasFilters ? `${faNum(data.items.length)} بردگیم رومیزی؛ ` : ''}نوبتی یا زنده، با دوستان یا با ربات؛ بر اساس نام فارسی یا اصلی جست‌وجو کنید.`}
        actions={<Button href="/wiki" icon="book-open">دانشنامه</Button>} />

      <div className="pg-presets" role="group" aria-label="شروع سریع">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="bgv-card pg-preset" onClick={() => { setShown(PAGE); setParams(new URLSearchParams(p.set), { replace: true }); setQ(''); }}>
            <span className="pg-preset__icon"><Icon name={p.icon} /></span>
            <span className="pg-preset__text"><b>{p.label}</b><small>{p.text}</small></span>
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
                  {[2, 3, 4, 5].map((n) => <Chip key={n} selected={players === String(n)} onClick={() => setFilter('players', players === String(n) ? '' : String(n))}>{faNum(n)}</Chip>)}
                </div>
              </div>
              {sel('maxMinutes', 'زمان یک دست', [5, 15, 30, 60, 120].map((n) => ({ value: String(n), label: `تا ${faNum(n)} دقیقه` })))}
              {sel('difficulty', 'دشواری', [{ value: 'easy', label: 'آسان' }, { value: 'medium', label: 'متوسط' }, { value: 'hard', label: 'دشوار' }])}
              <Select label="رقابت" value={mode === 'friendly' || mode === 'ranked' ? mode : ''} onChange={(e) => setFilter('mode', e.target.value)} options={[ALL, { value: 'friendly', label: MODE_FA.friendly! }, { value: 'ranked', label: MODE_FA.ranked! }]} />
              {sel('access', 'دسترسی', [{ value: 'free', label: 'رایگان' }, { value: 'premium', label: 'پریمیوم' }])}
              <Switch label="با ربات" hint="فقط بازی‌هایی که ربات دارند" checked={onlyBot} onChange={(v) => setKey('bot', v ? '1' : '')} />
              <fieldset className="pg-tags">
                <legend className="bgv-label">برچسب‌ها</legend>
                <ChipGroup size="sm" label="برچسب‌ها" options={TAG_OPTIONS}
                  value={(params.get('tags') ?? '').split(',').filter((t): t is GameTag => t in GAME_TAG_FA)}
                  onChange={(v) => setFilter('tags', (v as string[]).join(','))} />
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
                  {mode && <Chip size="sm" selected icon="x" onClick={() => setFilter('mode', '')} aria-label="حذف فیلتر حالت">{MODE_FA[mode] ?? mode}</Chip>}
                  {onlyBot && <Chip size="sm" selected icon="x" onClick={() => setKey('bot', '')} aria-label="حذف فیلتر ربات">با ربات</Chip>}
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
