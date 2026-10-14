import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GAME_TAG_FA, type GameSummary, type GameTag } from '@bg/contracts';
import { Button, Chip, ChipGroup, PageHead, Select, Skeleton, StateBlock, TextField } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

type FilterKey = 'players' | 'maxMinutes' | 'difficulty' | 'mode' | 'access' | 'tags';
const TAG_OPTIONS = (Object.keys(GAME_TAG_FA) as GameTag[]).map((value) => ({ value, label: GAME_TAG_FA[value] }));
const ALL = { value: '', label: 'همه' };
const MODE_FA: Record<string, string> = { live: 'زنده', turn: 'نوبتی', friendly: 'دوستانه', ranked: 'رتبه‌دار' };

export function Catalog() {
  usePageTitle('بازی‌ها');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  // Debounced free-text search kept in the URL so results are shareable and survive reload.
  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => { const n = new URLSearchParams(p); if (q.trim()) n.set('q', q.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [q, setParams]);

  const setFilter = (key: FilterKey, value: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });

  const qs = params.toString();
  const { data, error, loading, reload } = useApi<{ items: GameSummary[] }>(`/games${qs ? `?${qs}` : ''}`);
  const hasFilters = qs.length > 0;
  const clear = () => { setQ(''); setParams({}, { replace: true }); };
  const sel = (key: FilterKey, label: string, options: { value: string; label: string }[]) => (
    <Select label={label} value={params.get(key) ?? ''} onChange={(e) => setFilter(key, e.target.value)} options={[ALL, ...options]} />
  );
  const mode = params.get('mode');

  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <>
      <PageTabs group="games" />
      <PageHead title="بازی‌ها" sub={`${data && !hasFilters ? `${faNum(data.items.length)} بازی رومیزی؛ ` : ''}بر اساس نام فارسی یا اصلی، تعداد نفر، زمان و سبک بازی جست‌وجو کنید.`}
        actions={<Button href="/wiki" icon="book-open">دانشنامه</Button>} />

      <search>
        <form className={`bgv-card pg-stack pg-catform${filtersOpen ? ' is-open' : ''}`} onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو و فیلتر بازی‌ها">
          <div className="pg-filters">
            <div className="pg-q"><TextField label="جست‌وجو" icon="search" type="search" name="q" placeholder="مثلاً مزایده یا Line Three" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button className="pg-filtbtn" icon="sliders-horizontal" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>فیلترها</Button>
            {sel('players', 'تعداد نفر', [2, 3, 4].map((n) => ({ value: String(n), label: `${faNum(n)} نفر` })))}
            {sel('maxMinutes', 'حداکثر زمان', [5, 15, 30, 60].map((n) => ({ value: String(n), label: `تا ${faNum(n)} دقیقه` })))}
            {sel('difficulty', 'دشواری', [{ value: 'easy', label: 'آسان' }, { value: 'medium', label: 'متوسط' }, { value: 'hard', label: 'دشوار' }])}
            {sel('mode', 'حالت', Object.entries(MODE_FA).map(([value, label]) => ({ value, label })))}
            {sel('access', 'دسترسی', [{ value: 'free', label: 'رایگان' }, { value: 'premium', label: 'پریمیوم' }])}
          </div>
          <fieldset className="pg-tags">
            <legend className="bgv-label">برچسب‌ها</legend>
            <ChipGroup size="sm" label="برچسب‌ها" options={TAG_OPTIONS}
              value={(params.get('tags') ?? '').split(',').filter((t): t is GameTag => t in GAME_TAG_FA)}
              onChange={(v) => setFilter('tags', (v as string[]).join(','))} />
          </fieldset>
        </form>
      </search>

      {loading && !data && (
        <>
          <div className="bgv-grid" aria-hidden>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={300} radius="var(--radius-lg)" />)}</div>
          <span className="pg-sr" role="status">در حال بارگذاری بازی‌ها…</span>
        </>
      )}
      {error && <StateBlock kind="error" title="فهرست بازی‌ها بارگذاری نشد" text={error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} />}
      {data && !error && (
        data.items.length === 0 ? (
          <StateBlock kind="empty" title="بازی‌ای با این مشخصات پیدا نشد"
            text={hasFilters ? 'فیلترها را کمتر کنید یا عبارت دیگری جست‌وجو کنید.' : 'هنوز بازی‌ای در کاتالوگ منتشر نشده است.'}
            action={hasFilters ? <Button onClick={clear}>پاک‌کردن فیلترها</Button> : undefined} />
        ) : (
          <>
            <div className="pg-results">
              <b className="t-title" role="status" aria-live="polite">{faNum(data.items.length)} بازی</b>
              {mode && <Chip size="sm" selected icon="x" onClick={() => setFilter('mode', '')} aria-label="حذف فیلتر حالت">حالت: {MODE_FA[mode] ?? mode}</Chip>}
              {hasFilters && <Button size="sm" variant="ghost" onClick={clear}>پاک‌کردن فیلترها</Button>}
            </div>
            <div className="bgv-grid pg-catgrid" data-tour="catalog-grid">{data.items.map((g) => <GameCard key={g.id} game={g} />)}</div>
          </>
        )
      )}
    </>
  );
}
