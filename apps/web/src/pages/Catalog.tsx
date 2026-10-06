import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { GameSummary } from '@bg/contracts';
import { Button, Input, Select, StateBlock } from '@bg/ui';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

type FilterKey = 'players' | 'maxMinutes' | 'difficulty' | 'mode' | 'access';

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

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">بازی‌ها</h1>
          <p className="page-sub">بر اساس نام فارسی یا اصلی، تعداد نفر، زمان و سبک بازی جست‌وجو کنید.</p>
        </div>
      </div>

      <search>
        <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو و فیلتر بازی‌ها">
          <div className="filters__search">
            <Input label="جست‌وجو" type="search" name="q" placeholder="مثلاً مزایده یا Line Three" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select label="تعداد نفر" value={params.get('players') ?? ''} onChange={(e) => setFilter('players', e.target.value)}
            options={[{ value: '', label: 'همه' }, ...[2, 3, 4].map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))]} />
          <Select label="حداکثر زمان" value={params.get('maxMinutes') ?? ''} onChange={(e) => setFilter('maxMinutes', e.target.value)}
            options={[{ value: '', label: 'همه' }, ...[5, 15, 30, 60].map((n) => ({ value: String(n), label: `تا ${faNum(n)} دقیقه` }))]} />
          <Select label="دشواری" value={params.get('difficulty') ?? ''} onChange={(e) => setFilter('difficulty', e.target.value)}
            options={[{ value: '', label: 'همه' }, { value: 'easy', label: 'آسان' }, { value: 'medium', label: 'متوسط' }, { value: 'hard', label: 'دشوار' }]} />
          <Select label="حالت" value={params.get('mode') ?? ''} onChange={(e) => setFilter('mode', e.target.value)}
            options={[{ value: '', label: 'همه' }, { value: 'live', label: 'زنده' }, { value: 'turn', label: 'نوبتی' }, { value: 'friendly', label: 'دوستانه' }, { value: 'ranked', label: 'رتبه‌دار' }]} />
          <Select label="دسترسی" value={params.get('access') ?? ''} onChange={(e) => setFilter('access', e.target.value)}
            options={[{ value: '', label: 'همه' }, { value: 'free', label: 'رایگان' }, { value: 'premium', label: 'پریمیوم' }]} />
        </form>
      </search>

      {loading && !data && (
        <div className="grid-cards" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ blockSize: 300 }} />)}</div>
      )}
      {loading && !data && <span className="visually-hidden" role="status">در حال بارگذاری بازی‌ها…</span>}
      {error && <StateBlock kind="error" title="فهرست بازی‌ها بارگذاری نشد" action={<Button onClick={reload}>تلاش دوباره</Button>}>{error.messageFa}</StateBlock>}
      {data && !error && (
        data.items.length === 0 ? (
          <StateBlock kind="empty" title="بازی‌ای با این مشخصات پیدا نشد"
            action={hasFilters ? <Button variant="secondary" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>پاک‌کردن فیلترها</Button> : undefined}>
            {hasFilters ? 'فیلترها را کمتر کنید یا عبارت دیگری جست‌وجو کنید.' : 'هنوز بازی‌ای در کاتالوگ منتشر نشده است.'}
          </StateBlock>
        ) : (
          <>
            <p className="results-meta" role="status" aria-live="polite">{faNum(data.items.length)} بازی</p>
            <div className="grid-cards">{data.items.map((g) => <GameCard key={g.id} game={g} />)}</div>
          </>
        )
      )}
    </>
  );
}
