import { Link } from 'react-router';
import { ArrowLeft, Bell, CalendarCheck, Clock, Dices, Flame, Hourglass, Sparkles, Users } from 'lucide-react';
import type { DailyGame, GameSummary } from '@bg/contracts';
import { Button, StateBlock, buttonClass, cn } from '@bg/ui';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliToday } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { MyTurnPanel, NotificationsPanel } from './MyTables.tsx';
import { InviteCard } from '../social/InviteCard.tsx';

/** Game of the day: picked and rewarded by the server; the card only shows it, dressed in the game's cover art. */
function DailyCard({ games }: { games: GameSummary[] | undefined }) {
  const daily = useApi<DailyGame>('/me/daily');
  const d = daily.data;
  const g = d?.gameId ? games?.find((x) => x.id === d.gameId) : undefined;
  if (daily.loading && !d) return <section className="panel section mb-6" aria-label="بازی روز"><StateBlock kind="loading" title="در حال بارگذاری بازی روز…" /></section>;
  if (daily.error) return <section className="panel section mb-6" aria-label="بازی روز"><StateBlock kind="error" title="بازی روز بارگذاری نشد" action={<Button onClick={daily.reload}>تلاش دوباره</Button>}>{daily.error.messageFa}</StateBlock></section>;
  if (!d) return null;
  if (!d.gameId) return <section className="panel section mb-6" aria-label="بازی روز"><StateBlock kind="empty" title="امروز بازی روزی در دسترس نیست" /></section>;
  const week = Math.min(d.streak, 7);
  return (
    <section className="daily relative isolate mb-6 overflow-hidden rounded-surface bg-felt text-white shadow-overlay" aria-labelledby="daily-h">
      <img src={`/covers/${d.gameId}.webp?v=2`} alt="" aria-hidden className="daily__art absolute inset-0 -z-20 size-full object-cover" onError={(e) => { e.currentTarget.hidden = true; }} />
      <div aria-hidden className="daily__shade absolute inset-0 -z-10" />
      <div className="grid max-w-xl gap-3 p-6 sm:p-8">
        <p className="m-0 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-foreground shadow-control">
          <CalendarCheck className="size-4" aria-hidden />بازی روز
        </p>
        <h2 id="daily-h" className="m-0 text-3xl font-extrabold sm:text-4xl">{d.gameNameFa}</h2>
        {g && <p className="m-0 line-clamp-2 opacity-90">{g.summaryFa}</p>}
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm" aria-label="جزئیات">
          <li className="daily__chip"><Sparkles className="size-4" aria-hidden /><bdi>+{faNum(d.bonusXp)} XP</bdi> پاداش</li>
          {g && <li className="daily__chip"><Users className="size-4" aria-hidden />{faNum(g.minPlayers)}{g.maxPlayers > g.minPlayers && `–${faNum(g.maxPlayers)}`} نفر</li>}
          {g && <li className="daily__chip"><Clock className="size-4" aria-hidden />{faNum(g.minMinutes)}{g.maxMinutes > g.minMinutes && `–${faNum(g.maxMinutes)}`} دقیقه</li>}
        </ul>
        <div className="flex items-center gap-3 text-sm" aria-label={`رشته: ${faNum(d.streak)} روز`}>
          <Flame className={cn('size-5', d.streak > 0 ? 'text-amber-300' : 'opacity-60')} aria-hidden />
          <span className="flex gap-1" aria-hidden>{Array.from({ length: 7 }, (_, i) => <span key={i} className={cn('size-2.5 rounded-full', i < week ? 'bg-amber-300' : 'bg-white/25')} />)}</span>
          <span className="font-semibold">رشته: {faNum(d.streak)} روز</span>
        </div>
        <div className="mt-1">
          {d.doneToday
            ? <span className="inline-flex items-center gap-1.5 rounded-control bg-white/15 px-4 py-2 font-bold"><CalendarCheck className="size-5" aria-hidden />امروز انجام شد؛ فردا برگردید</span>
            : <Link className={cn(buttonClass('brand', 'lg'), 'relative overflow-hidden')} to={`/games/${d.gameId}`}>
                <span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/35 to-transparent animate-shine" />
                بازی کن<ArrowLeft className="size-4" aria-hidden />
              </Link>}
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  usePageTitle('داشبورد');
  const { me, status } = useSession();
  const games = useApi<{ items: GameSummary[] }>('/games');

  return (
    <>
      {/* The café table: felt hero with the greeting and the two ways to start. */}
      <section className="relative isolate mb-6 overflow-hidden rounded-surface bg-felt p-6 text-felt-foreground shadow-overlay sm:p-8" aria-labelledby="hello-h">
        <div aria-hidden className="absolute -end-10 -top-10 -z-10 size-56 rounded-full bg-brand/25 blur-3xl" />
        <Dices aria-hidden className="absolute -bottom-6 end-4 -z-10 size-40 rotate-12 opacity-10" strokeWidth={1.25} />
        <p className="m-0 text-sm opacity-80">{jalaliToday()}</p>
        <h1 id="hello-h" className="mt-1 text-3xl sm:text-4xl">{me ? `سلام، ${me.displayName}` : 'باشگاه بردگیم'}</h1>
        <p className="mt-2 mb-6 max-w-xl opacity-85">میز خصوصی بسازید و دوستان را دعوت کنید، یا به یک میز عمومی بپیوندید.</p>
        <div className="flex flex-wrap gap-3">
          <Link className={`${buttonClass('brand', 'lg')} relative overflow-hidden`} to="/games">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/35 to-transparent animate-shine" />
            انتخاب بازی
          </Link>
          <Link className={cn(buttonClass('ghost', 'lg'), 'bg-white/10 text-felt-foreground! hover:bg-white/20')} to="/tables">میزهای باز<ArrowLeft className="size-4" aria-hidden /></Link>
        </div>
      </section>

      {me && <DailyCard games={games.data?.items} />}
      {me && <div className="mb-6"><InviteCard /></div>}

      <div className="dash">
        <section className="panel section" aria-labelledby="my-turn-h" style={{ marginBlockEnd: 0 }}>
          <h2 id="my-turn-h" className="section-title"><Hourglass className="size-5 text-primary" aria-hidden />نوبت من</h2>
          {status === 'loading' ? <StateBlock kind="loading" title="در حال بررسی حساب…" />
            : !me ? (
              <StateBlock kind="denied" title="برای دیدن میزهای خود وارد شوید"
                action={<Link className={buttonClass('primary', 'md')} to="/login">ورود / ثبت‌نام</Link>}>
                میزهای نوبتی که منتظر حرکت شما هستند اینجا نمایش داده می‌شوند.
              </StateBlock>
            ) : <MyTurnPanel />}
        </section>

        {me && (
          <section className="panel section" aria-labelledby="notif-h" style={{ marginBlockEnd: 0 }}>
            <h2 id="notif-h" className="section-title"><Bell className="size-5 text-primary" aria-hidden />اعلان‌ها</h2>
            <NotificationsPanel />
          </section>
        )}
      </div>

      <section className="section" aria-labelledby="catalog-h" style={{ marginBlockStart: 'var(--sp-6)' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="catalog-h" className="section-title m-0">بازی‌های کاتالوگ</h2>
          <Link to="/games" className="inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline hover:gap-2 transition-all duration-(--motion) ease-motion">همه بازی‌ها<ArrowLeft className="size-4" aria-hidden /></Link>
        </div>
        {games.loading && !games.data && <StateBlock kind="loading" title="در حال بارگذاری بازی‌ها…" />}
        {games.error && <StateBlock kind="error" title="بازی‌ها بارگذاری نشدند" action={<Button onClick={games.reload}>تلاش دوباره</Button>}>{games.error.messageFa}</StateBlock>}
        {games.data && (games.data.items.length === 0
          ? <StateBlock kind="empty" title="هنوز بازی‌ای منتشر نشده است" />
          : <div className="grid-cards">{games.data.items.slice(0, 4).map((g) => <GameCard key={g.id} game={g} />)}</div>)}
      </section>
    </>
  );
}
