import { Link } from 'react-router';
import type { GameSummary } from '@bg/contracts';
import { Button, Icon, StateBlock } from '@bg/ui';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { jalaliToday } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { MyTurnPanel, NotificationsPanel } from './MyTables.tsx';

export function Dashboard() {
  usePageTitle('داشبورد');
  const { me, status } = useSession();
  const games = useApi<{ items: GameSummary[] }>('/games');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{me ? `سلام، ${me.displayName}` : 'باشگاه بردگیم'}</h1>
          <p className="page-sub">{jalaliToday()}</p>
        </div>
      </div>

      <div className="dash">
        <section className="panel section" aria-labelledby="my-turn-h" style={{ marginBlockEnd: 0 }}>
          <h2 id="my-turn-h" className="section-title"><Icon name="turn" />نوبت من</h2>
          {status === 'loading' ? <StateBlock kind="loading" title="در حال بررسی حساب…" />
            : !me ? (
              <StateBlock kind="denied" title="برای دیدن میزهای خود وارد شوید"
                action={<Link className="btn btn--primary" to="/login">ورود / ثبت‌نام</Link>}>
                میزهای نوبتی که منتظر حرکت شما هستند اینجا نمایش داده می‌شوند.
              </StateBlock>
            ) : <MyTurnPanel />}
        </section>

        <section className="panel section cta-panel" aria-labelledby="start-h" style={{ marginBlockEnd: 0 }}>
          <h2 id="start-h" className="section-title"><Icon name="play" />شروع بازی</h2>
          <p className="muted" style={{ margin: 0 }}>میز خصوصی بسازید و دوستان را دعوت کنید، یا به یک میز عمومی بپیوندید.</p>
          <div className="row">
            <Link className="btn btn--primary" to="/games">انتخاب بازی</Link>
            <Link className="btn btn--secondary" to="/tables">میزهای باز</Link>
          </div>
          {me && <><h3 className="section-title" style={{ fontSize: 'var(--fs-md)', marginBlockStart: 'var(--sp-3)' }}>اعلان‌ها</h3><NotificationsPanel /></>}
        </section>
      </div>

      <section className="section" aria-labelledby="catalog-h" style={{ marginBlockStart: 'var(--sp-6)' }}>
        <h2 id="catalog-h" className="section-title">بازی‌های کاتالوگ</h2>
        {games.loading && !games.data && <StateBlock kind="loading" title="در حال بارگذاری بازی‌ها…" />}
        {games.error && <StateBlock kind="error" title="بازی‌ها بارگذاری نشدند" action={<Button onClick={games.reload}>تلاش دوباره</Button>}>{games.error.messageFa}</StateBlock>}
        {games.data && (games.data.items.length === 0
          ? <StateBlock kind="empty" title="هنوز بازی‌ای منتشر نشده است" />
          : <div className="grid-cards">{games.data.items.slice(0, 4).map((g) => <GameCard key={g.id} game={g} />)}</div>)}
      </section>
    </>
  );
}
