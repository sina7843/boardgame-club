import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { normalizeSearch, type GameSummary } from '@bg/contracts';
import { Button, Icon, Input, Select, StateBlock } from '@bg/ui';
import { GameCover } from '../games/covers.tsx';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

// Encyclopedia: a BoardGameGeek snapshot (scripts/bgg-sync.mjs → data/bgg.json) plus Persian text (data/bgg-fa.json)
// and Persian names for BGG categories/mechanics (data/bgg-terms-fa.json). Loaded lazily so it stays out of the main bundle.

type Link_ = { id: number; name: string };
type Bgg = {
  bggId: number; name: string; year: number | null; players: [number | null, number | null]; best: [number, number] | null;
  minutes: [number | null, number | null]; minAge: number | null; weight: number | null; rating: number | null; ratings: number;
  owned: number; rank: number | null; designers: Link_[]; artists: Link_[]; publishers: Link_[]; categories: Link_[]; mechanics: Link_[];
  honors: number; image: string | null;
};
type Fa = { taglineFa: string; aboutFa: string[] };
type Wiki = { fetchedAt: string; games: Record<string, Bgg>; fa: Record<string, Fa>; terms: Record<string, string> };

let wiki: Promise<Wiki> | undefined;
const loadWiki = () => (wiki ??= Promise.all([import('../data/bgg.json'), import('../data/bgg-fa.json'), import('../data/bgg-terms-fa.json')])
  .then(([b, f, t]) => ({ fetchedAt: b.default.fetchedAt, games: b.default.games as unknown as Record<string, Bgg>, fa: f.default as Record<string, Fa>, terms: t.default as Record<string, string> })));

function useWiki() {
  const [data, setData] = useState<Wiki>();
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadWiki().then(setData, () => { wiki = undefined; setFailed(true); }); }, []);
  return { data, failed };
}

const yearNum = (y: number) => Math.abs(y).toLocaleString('fa-IR', { useGrouping: false });
const yearFa = (y: number) => (y < 0 ? `حدود ${yearNum(y)} پیش از میلاد` : `${yearNum(y)} میلادی`);
const weightFa = (w: number) => `${w < 1.8 ? 'سبک' : w < 2.6 ? 'سبک تا متوسط' : w < 3.4 ? 'متوسط' : w < 4.2 ? 'سنگین' : 'خیلی سنگین'} (${faNum(w)} از ۵)`;
const span = ([a, b]: [number | null, number | null], unit: string) => (a && b && a !== b ? `${faNum(a)} تا ${faNum(b)} ${unit}` : a || b ? `${faNum((a || b)!)} ${unit}` : null);
const names = (l: Link_[]) => l.map((x, i) => <span key={x.id}>{i > 0 && '، '}<bdi>{x.name}</bdi></span>);
const bggUrl = (id: number) => `https://boardgamegeek.com/boardgame/${id}`;

function Terms({ items, terms, kind }: { items: Link_[]; terms: Record<string, string>; kind: 'category' | 'mechanic' }) {
  return (
    <ul className="wiki-terms">{items.map((t) => (
      <li key={t.id}><Link to={`/wiki?${kind}=${t.id}`}>{terms[t.id] ?? <bdi>{t.name}</bdi>}</Link></li>
    ))}</ul>
  );
}

/** Encyclopedia section on a game page; renders nothing for games without a BGG entry (e.g. test games). */
export function GameWiki({ gameId }: { gameId: string }) {
  const { data } = useWiki();
  const g = data?.games[gameId];
  // Links from the encyclopedia land on #wiki; the section only exists once the lazy data arrives.
  useEffect(() => { if (g && location.hash === '#wiki') document.getElementById('wiki')?.scrollIntoView(); }, [g]);
  if (!data || !g) return null;
  const fa = data.fa[gameId];
  const facts: [string, ReactNode][] = [
    ['نام اصلی', <bdi>{g.name}</bdi>],
    ['سال انتشار', g.year ? yearFa(g.year) : null],
    ['طراح', g.designers.length ? names(g.designers) : null],
    ['تصویرگر', g.artists.length ? names(g.artists) : null],
    ['ناشر', g.publishers.length ? names(g.publishers) : null],
    ['تعداد نفر (چاپی)', span(g.players, 'نفر')],
    ['بهترین تعداد', g.best ? span(g.best, 'نفر') : null],
    ['زمان (چاپی)', span(g.minutes, 'دقیقه')],
    ['سن', g.minAge ? `${faNum(g.minAge)} سال به بالا` : null],
    ['پیچیدگی', g.weight ? weightFa(g.weight) : null],
    ['امتیاز کاربران', g.rating ? `${faNum(g.rating)} از ۱۰ (${faNum(g.ratings)} رأی)` : null],
    ['رتبهٔ کلی BGG', g.rank ? faNum(g.rank) : null],
    ['جوایز و نامزدی‌ها', g.honors ? faNum(g.honors) : null]
  ];
  return (
    <section className="section" id="wiki" aria-labelledby="wiki-h">
      <h2 id="wiki-h" className="section-title"><Icon name="book" />دانشنامه</h2>
      {fa?.taglineFa && <p className="wiki-tagline">{fa.taglineFa}</p>}
      {fa?.aboutFa.map((p, i) => <p key={i}>{p}</p>)}
      <dl className="facts">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {g.categories.length > 0 && <><h3 className="rules-section__title">دسته‌ها</h3><Terms items={g.categories} terms={data.terms} kind="category" /></>}
      {g.mechanics.length > 0 && <><h3 className="rules-section__title">سازوکارها</h3><Terms items={g.mechanics} terms={data.terms} kind="mechanic" /></>}
      <p className="muted wiki-source">
        منبع اطلاعات: <a href={bggUrl(g.bggId)} target="_blank" rel="noopener noreferrer"><bdi>BoardGameGeek</bdi></a>،
        به‌روزرسانی {jalaliDate(data.fetchedAt)}. مشخصات «چاپی» مربوط به نسخهٔ رومیزی است و ممکن است با تنظیمات این سایت فرق کند.
      </p>
    </section>
  );
}

type Sort = 'rank' | 'rating' | 'weight' | 'year';
const SORTS: Record<Sort, (a: Bgg, b: Bgg) => number> = {
  rank: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  weight: (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
  year: (a, b) => (b.year ?? -1e9) - (a.year ?? -1e9)
};

function termOptions(data: Wiki | undefined, pick: (g: Bgg) => Link_[]) {
  const seen = new Map<number, string>();
  for (const g of Object.values(data?.games ?? {})) for (const t of pick(g)) seen.set(t.id, data!.terms[t.id] ?? t.name);
  return [...seen].map(([id, label]) => ({ value: String(id), label })).sort((a, b) => a.label.localeCompare(b.label, 'fa'));
}

export function WikiPage() {
  usePageTitle('دانشنامه');
  const { data, failed } = useWiki();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const set = (key: string, value: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });
  const category = params.get('category') ?? '', mechanic = params.get('mechanic') ?? '';
  const sort = (params.get('sort') as Sort | null) ?? 'rank';

  const entries = useMemo(() => {
    if (!data || !games.data) return [];
    const text = normalizeSearch(q);
    return games.data.items.flatMap((s) => (data.games[s.id] ? [{ s, g: data.games[s.id]!, fa: data.fa[s.id] }] : []))
      .filter(({ s, g }) => (!text || normalizeSearch(`${s.nameFa} ${s.nameOriginal} ${g.name} ${g.designers.map((d) => d.name).join(' ')}`).includes(text))
        && (!category || g.categories.some((c) => String(c.id) === category))
        && (!mechanic || g.mechanics.some((m) => String(m.id) === mechanic)))
      .sort((a, b) => (SORTS[sort] ?? SORTS.rank)(a.g, b.g));
  }, [data, games.data, q, category, mechanic, sort]);

  const categories = useMemo(() => termOptions(data, (g) => g.categories), [data]);
  const mechanics = useMemo(() => termOptions(data, (g) => g.mechanics), [data]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">دانشنامهٔ بازی‌ها</h1>
          <p className="page-sub">تاریخچه، طراحان، پیچیدگی، امتیاز و سازوکار بازی‌های سایت، برگرفته از <bdi>BoardGameGeek</bdi>.</p>
        </div>
      </div>
      <search>
        <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="جست‌وجو در دانشنامه">
          <div className="filters__search">
            <Input label="جست‌وجو" type="search" placeholder="نام بازی یا طراح" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select label="دسته" value={category} onChange={(e) => set('category', e.target.value)} options={[{ value: '', label: 'همه' }, ...categories]} />
          <Select label="سازوکار" value={mechanic} onChange={(e) => set('mechanic', e.target.value)} options={[{ value: '', label: 'همه' }, ...mechanics]} />
          <Select label="مرتب‌سازی" value={sort} onChange={(e) => set('sort', e.target.value === 'rank' ? '' : e.target.value)}
            options={[{ value: 'rank', label: 'رتبهٔ BGG' }, { value: 'rating', label: 'امتیاز کاربران' }, { value: 'weight', label: 'پیچیدگی' }, { value: 'year', label: 'جدیدترین' }]} />
        </form>
      </search>
      {failed || games.error ? (
        <StateBlock kind="error" title="دانشنامه بارگذاری نشد" action={<Button onClick={() => location.reload()}>تلاش دوباره</Button>}>{games.error?.messageFa}</StateBlock>
      ) : !data || !games.data ? (
        <StateBlock kind="loading" title="در حال بارگذاری دانشنامه…" />
      ) : entries.length === 0 ? (
        <StateBlock kind="empty" title="موردی پیدا نشد"
          action={<Button variant="secondary" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>پاک‌کردن فیلترها</Button>}>عبارت یا فیلتر دیگری را امتحان کنید.</StateBlock>
      ) : (
        <>
          <p className="results-meta" role="status" aria-live="polite">{faNum(entries.length)} بازی</p>
          <ul className="wiki-list">{entries.map(({ s, g, fa }) => (
            <li key={s.id}>
              <Link to={`/games/${s.id}#wiki`} className="wiki-item">
                <div className="wiki-item__cover"><GameCover gameId={s.id} title="" /></div>
                <div className="wiki-item__body">
                  <div className="game-card__title">{s.nameFa}</div>
                  <div className="game-card__original"><bdi>{g.name}</bdi>{g.year ? ` · ${yearFa(g.year)}` : ''}</div>
                  {fa?.taglineFa && <p className="wiki-item__tagline">{fa.taglineFa}</p>}
                  <ul className="game-card__facts">
                    {g.rating && <li className="row" style={{ gap: 4 }}><Icon name="star" size={16} />{faNum(g.rating)}</li>}
                    {g.weight && <li>پیچیدگی {faNum(g.weight)} از ۵</li>}
                    {g.rank && <li>رتبهٔ {faNum(g.rank)}</li>}
                    {g.designers[0] && <li><bdi>{g.designers[0].name}</bdi></li>}
                  </ul>
                </div>
              </Link>
            </li>
          ))}</ul>
          <p className="muted wiki-source">داده‌ها از <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer"><bdi>BoardGameGeek</bdi></a>، به‌روزرسانی {jalaliDate(data.fetchedAt)}.</p>
        </>
      )}
    </>
  );
}
