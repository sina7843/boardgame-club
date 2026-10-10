import { Link } from 'react-router';
import { ArrowLeft, Bell, CalendarCheck, Dices, Flame, Hourglass } from 'lucide-react';
import type { DailyGame, GameSummary } from '@bg/contracts';
import { Button, StateBlock, buttonClass, cn } from '@bg/ui';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliToday } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { MyTurnPanel, NotificationsPanel } from './MyTables.tsx';

/** Game of the day: picked and rewarded by the server; the card only shows it. */
function DailyCard() {
  const daily = useApi<DailyGame>('/me/daily');
  const d = daily.data;
  return (
    <section className="panel section mb-6" aria-labelledby="daily-h">
      <h2 id="daily-h" className="section-title"><CalendarCheck className="size-5 text-primary" aria-hidden />بازی روز</h2>
      {daily.loading && !d && <StateBlock kind="loading" title="در حال بارگذاری بازی روز…" />}
      {daily.error && <StateBlock kind="error" title="بازی روز بارگذاری نشد" action={<Button onClick={daily.reload}>تلاش دوباره</Button>}>{daily.error.messageFa}</StateBlock>}
      {d && (!d.gameId ? <StateBlock kind="empty" title="امروز بازی روزی در دسترس نیست" /> : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-lg font-semibold">بازی امروز: {d.gameNameFa}</p>
            <p className="muted m-0 mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span><bdi>+{faNum(d.bonusXp)} XP</bdi></span>
              <span className="inline-flex items-center gap-1"><Flame className="size-4" aria-hidden />رشته: {faNum(d.streak)} روز</span>
            </p>
          </div>
          {d.doneToday
            ? <span className="inline-flex items-center gap-1 font-semibold text-primary"><CalendarCheck className="size-4" aria-hidden />امروز انجام شد</span>
            : <Link className={buttonClass('primary', 'md')} to={`/games/${d.gameId}`}>بازی کن</Link>}
        </div>
      ))}
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

      {me && <DailyCard />}

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
