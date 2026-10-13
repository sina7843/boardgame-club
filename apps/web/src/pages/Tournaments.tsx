import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CalendarClock, Crown, Medal, Swords, Users } from 'lucide-react';
import type { TournamentDetail, TournamentSummary } from '@bg/contracts';
import { Avatar, Badge, Button, DataTable, StateBlock, buttonClass, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { CoinMark, coinsChanged } from '../lib/coins.tsx';
import { durationFa, faNum, jalaliDateTime, PACE_FA, tomanFa } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

const FORMAT_FA = { swiss: 'امتیازی (سوئیسی)', knockout: 'حذفی' } as const;
const STATUS_FA = { open: 'ثبت‌نام باز', running: 'در جریان', finished: 'پایان‌یافته', cancelled: 'لغوشده' } as const;
const statusTone = (s: TournamentSummary['status']) => (s === 'running' ? 'success' : s === 'cancelled' ? 'danger' : undefined);

export function entryFa(t: Pick<TournamentSummary, 'entryKind' | 'entryAmount'>) {
  return t.entryKind === 'free' ? 'رایگان' : t.entryKind === 'coins' ? `${faNum(t.entryAmount)} سکه` : tomanFa(t.entryAmount);
}

function prizeFa(p: TournamentSummary['prizes'][number]) {
  return [p.coins ? `${faNum(p.coins)} سکه` : '', p.premiumDays ? `${faNum(p.premiumDays)} روز پریمیوم` : ''].filter(Boolean).join(' + ') || 'افتخار';
}

/** Re-fetch every few seconds while something can change (registration count, live rounds). */
function usePoll(reload: () => void, on: boolean, ms = 5000) {
  useEffect(() => {
    if (!on) return;
    const t = setInterval(reload, ms);
    return () => clearInterval(t);
  }, [reload, on, ms]);
}

export function TournamentsPage() {
  usePageTitle('تورنمنت‌ها');
  const list = useApi<{ items: TournamentSummary[] }>('/tournaments');
  usePoll(list.reload, true, 15000);
  if (list.error) return <StateBlock kind="error" title="تورنمنت‌ها دریافت نشد" action={<Button onClick={list.reload}>تلاش دوباره</Button>}>{list.error.messageFa}</StateBlock>;
  if (!list.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const live = list.data.items.filter((t) => t.status === 'open' || t.status === 'running');
  const ended = list.data.items.filter((t) => t.status === 'finished' || t.status === 'cancelled');
  return (
    <>
      <PageTabs group="tables" />
      <div className="page-head"><div><h1 className="page-title">تورنمنت‌ها</h1>
        <p className="page-sub">مسابقه‌های زمان‌بندی‌شده با جایزهٔ ثابت. دور بعد خودکار شروع می‌شود؛ اگر سر میز نیایید ربات جای شما بازی می‌کند و امتیاز آن میز صفر است.</p></div></div>
      {live.length === 0
        ? <StateBlock kind="empty" title="فعلاً تورنمنتی برگزار نمی‌شود">به‌زودی برمی‌گردیم؛ اعلان‌ها را روشن نگه دارید.</StateBlock>
        : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{live.map((t, i) => <TournamentCard key={t.id} t={t} delay={i * 70} />)}</div>}
      {ended.length > 0 && (
        <section className="stack" style={{ marginBlockStart: 'var(--sp-6)' }} aria-labelledby="ended-h">
          <h2 id="ended-h" className="section-title">پایان‌یافته</h2>
          <ul className="list">{ended.map((t) => (
            <li key={t.id} className="list__item list__item--compact">
              <Link to={`/tournaments/${t.id}`} style={{ flex: 1 }}>{t.titleFa}</Link>
              <span className="muted">{t.gameNameFa}</span>
              <Badge tone={statusTone(t.status)}>{STATUS_FA[t.status]}</Badge>
            </li>))}</ul>
        </section>
      )}
    </>
  );
}

function TournamentCard({ t, delay }: { t: TournamentSummary; delay: number }) {
  const top = t.prizes[0];
  return (
    <Link to={`/tournaments/${t.id}`} style={{ animationDelay: `${delay}ms` }}
      className="flex flex-col gap-4 rounded-surface border-line border-border bg-card p-5 text-foreground no-underline shadow-surface transition-transform duration-(--motion) ease-motion animate-fade-up hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="m-0 text-lg">{t.titleFa}</h2>
          <span className="text-sm text-muted-foreground">{t.gameNameFa} · {FORMAT_FA[t.format]}</span>
        </div>
        <Badge tone={statusTone(t.status)}>{STATUS_FA[t.status]}</Badge>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3 text-sm">
        <div className="grid gap-0.5"><dt className="text-xs text-muted-foreground">شروع</dt><dd className="m-0">{jalaliDateTime(t.startsAt)}</dd></div>
        <div className="grid gap-0.5"><dt className="text-xs text-muted-foreground">ورودی</dt><dd className="m-0 font-bold">{entryFa(t)}</dd></div>
        <div className="grid gap-0.5"><dt className="text-xs text-muted-foreground">ثبت‌نام</dt><dd className="m-0"><span className="num">{faNum(t.entrants)}</span> از {faNum(t.maxEntrants)}</dd></div>
        <div className="grid gap-0.5"><dt className="text-xs text-muted-foreground">جایزهٔ اول</dt><dd className="m-0">{top ? prizeFa(top) : '—'}</dd></div>
      </dl>
      {t.registered && <Badge tone="success">ثبت‌نام کرده‌اید</Badge>}
    </Link>
  );
}

export function TournamentPage() {
  const { id } = useParams();
  const { me: session } = useSession();
  const toast = useToast();
  const d = useApi<TournamentDetail>(`/tournaments/${id}`);
  const [busy, setBusy] = useState(false);
  usePageTitle(d.data?.titleFa ?? 'تورنمنت');
  usePoll(d.reload, d.data?.status === 'running' || d.data?.status === 'open');
  if (d.error) return <StateBlock kind={d.error.status === 404 ? 'empty' : 'error'} title={d.error.status === 404 ? 'این تورنمنت پیدا نشد' : 'تورنمنت دریافت نشد'}
    action={<Link className={buttonClass('primary', 'md')} to="/tournaments">همهٔ تورنمنت‌ها</Link>} />;
  if (!d.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const t = d.data;

  const act = async (path: string, ok: string) => {
    setBusy(true);
    try {
      if (path === 'checkout') { location.assign((await api<{ redirectUrl: string }>(`/tournaments/${t.id}/checkout`, { method: 'POST' })).redirectUrl); return; }
      await api(`/tournaments/${t.id}/${path}`, { method: 'POST' });
      toast('success', ok);
      if (t.entryKind === 'coins') coinsChanged();
      d.reload();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
    setBusy(false);
  };
  const open = t.status === 'open' && Date.parse(t.startsAt) > Date.now();
  const full = t.entrants >= t.maxEntrants;
  const leader = t.standings[0];

  return (
    <>
      <section aria-labelledby="t-h" className="relative isolate grid gap-4 overflow-hidden rounded-surface bg-felt p-6 text-felt-foreground shadow-surface animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <span className="text-sm opacity-85">{t.gameNameFa} · {FORMAT_FA[t.format]}</span>
            <h1 id="t-h" className="m-0 font-display text-3xl font-extrabold">{t.titleFa}</h1>
          </div>
          {/* A light chip: tinted badges disappear on the felt. */}
          <span className="rounded-control bg-card px-3 py-1 text-xs font-bold text-foreground shadow-control">{STATUS_FA[t.status]}{t.status === 'running' ? ` · دور ${faNum(t.currentRound)}` : ''}</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden />{jalaliDateTime(t.startsAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden /><span className="num">{faNum(t.entrants)}</span> از {faNum(t.maxEntrants)} (حداقل {faNum(t.minEntrants)})</span>
          <span className="inline-flex items-center gap-1.5"><Swords className="size-4" aria-hidden />{PACE_FA[t.pace]}، هر حرکت {durationFa(t.turnSeconds)}</span>
        </div>
        {t.me?.tableId && (
          <Link className={buttonClass('primary', 'lg')} to={`/tables/${t.me.tableId}`}>میز شما آماده است؛ ورود به میز</Link>
        )}
      </section>

      {t.status === 'cancelled' && <div className="banner banner--warn" role="alert" style={{ marginBlockStart: 'var(--sp-4)' }}>این تورنمنت لغو شد{t.cancelReason ? `: ${t.cancelReason}` : '.'} ورودی‌ها برگشت داده می‌شود.</div>}
      {t.me?.refundStatus && (
        <div className="banner banner--info" role="status" style={{ marginBlockStart: 'var(--sp-4)' }}>
          {t.me.refundStatus === 'pending' ? 'بازپرداخت ورودی شما ثبت شده و پشتیبانی آن را به حساب شما واریز می‌کند.' : 'ورودی شما بازپرداخت شد.'}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" style={{ marginBlockStart: 'var(--sp-5)' }}>
        <div className="stack">
          {t.status === 'finished' && leader && (
            <section className="panel flex items-center gap-4" aria-label="قهرمان">
              <Crown className="size-8 text-brand" aria-hidden />
              <Avatar avatarKey={leader.player.avatarKey} name={leader.player.displayName} size={48} />
              <div className="grid"><span className="text-sm text-muted-foreground">قهرمان</span><bdi className="text-lg font-bold">{leader.player.displayName}</bdi></div>
            </section>
          )}
          <section className="stack" aria-labelledby="stand-h">
            <h2 id="stand-h" className="section-title">جدول</h2>
            {t.standings.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز کسی ثبت‌نام نکرده است.</p> : (
              <DataTable caption="جدول تورنمنت" rowKey={(r) => r.player.id} rows={t.standings} columns={[
                { key: 'rank', title: 'رتبه', render: (r) => (r.finalRank ? faNum(r.finalRank) : '—') },
                { key: 'p', title: 'بازیکن', render: (r) => <span className="inline-flex items-center gap-2 whitespace-nowrap"><Avatar avatarKey={r.player.avatarKey} name={r.player.displayName} size={28} />
                  <Link to={`/users/${r.player.id}`}><bdi>{r.player.displayName}</bdi></Link>{r.player.id === session?.id && <Badge>شما</Badge>}</span> },
                { key: 'pts', title: 'امتیاز', render: (r) => <span className="num">{faNum(Math.round(r.points * 100) / 100)}</span> },
                { key: 'w', title: 'برد', render: (r) => faNum(r.wins) },
                { key: 's', title: 'وضعیت', render: (r) => (r.eliminatedRound ? `حذف در دور ${faNum(r.eliminatedRound)}` : r.noShows ? `${faNum(r.noShows)} غیبت` : '') }
              ]} />
            )}
          </section>
          {t.roundsPlayed.length > 0 && (
            <section className="stack" aria-labelledby="rounds-h">
              <h2 id="rounds-h" className="section-title">دورها</h2>
              {[...t.roundsPlayed].reverse().map((r) => (
                <details key={r.round} open={r.round === t.currentRound} className="panel">
                  <summary className="font-bold">دور {faNum(r.round)}</summary>
                  <ul className="m-0 mt-3 grid list-none gap-3 p-0">{r.tables.map((tb, i) => (
                    <li key={tb.tableId} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0">
                      <span className="text-sm text-muted-foreground">میز {faNum(i + 1)}</span>
                      {tb.players.map((p) => (
                        <span key={p.player.id} className="inline-flex items-center gap-1.5 text-sm">
                          <bdi>{p.player.displayName}</bdi>
                          {p.absent ? <Badge tone="danger">غایب</Badge> : p.place && <Badge tone={p.place === 1 ? 'success' : undefined}>نفر {faNum(p.place)}</Badge>}
                        </span>
                      ))}
                      {(tb.status === 'open' || tb.status === 'active') && <Badge>در حال بازی</Badge>}
                    </li>))}</ul>
                </details>
              ))}
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="panel stack" aria-labelledby="entry-h">
            <h2 id="entry-h" className="section-title">ورود</h2>
            <p className="m-0 flex items-center gap-2 text-lg font-bold">{t.entryKind === 'coins' && <CoinMark className="size-5" />}{entryFa(t)}</p>
            {t.entryKind === 'toman' && t.checkout.fixture && <div className="banner banner--warn" role="note">درگاه آزمایشی است و پول واقعی جابه‌جا نمی‌شود.</div>}
            {!session ? <Link className={buttonClass('primary', 'md')} to={`/login?next=/tournaments/${t.id}`}>برای ثبت‌نام وارد شوید</Link>
              : t.me?.registered ? (
                <>
                  <Badge tone="success">ثبت‌نام کرده‌اید</Badge>
                  {open && <Button variant="ghost" busy={busy} onClick={() => act('withdraw', 'از تورنمنت انصراف دادید؛ ورودی برمی‌گردد.')}>انصراف</Button>}
                </>
              ) : open ? (
                t.entryKind === 'toman'
                  ? <Button busy={busy} disabled={full || !t.checkout.available} onClick={() => act('checkout', '')}>{full ? 'ظرفیت تکمیل است' : 'پرداخت و ثبت‌نام'}</Button>
                  : <Button busy={busy} disabled={full} onClick={() => act('register', 'ثبت‌نام شد. زمان شروع اعلان می‌گیرید.')}>{full ? 'ظرفیت تکمیل است' : 'ثبت‌نام'}</Button>
              ) : <p className="muted" style={{ margin: 0 }}>ثبت‌نام بسته است.</p>}
            {t.entryKind === 'toman' && !t.checkout.available && t.checkout.reasonFa && <p className="m-0 text-xs text-muted-foreground">{t.checkout.reasonFa}</p>}
            <p className="m-0 text-xs text-muted-foreground">جایزه را سکوی بازی می‌دهد و از ورودی‌ها جمع نمی‌شود. انصراف پیش از شروع ورودی را برمی‌گرداند.</p>
          </section>
          <section className="panel stack" aria-labelledby="prize-h">
            <h2 id="prize-h" className="section-title flex items-center gap-2"><Medal className="size-5 text-brand" aria-hidden />جایزه‌ها</h2>
            {t.prizes.length === 0 ? <p className="muted" style={{ margin: 0 }}>این تورنمنت جایزه ندارد.</p> : (
              <ul className="m-0 grid list-none gap-2 p-0">{t.prizes.map((p) => (
                <li key={p.place} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0"><span>رتبهٔ {faNum(p.place)}</span><strong>{prizeFa(p)}</strong></li>
              ))}</ul>
            )}
          </section>
          <section className="panel stack" aria-labelledby="rules-h">
            <h2 id="rules-h" className="section-title">قوانین</h2>
            {t.descriptionFa && <p className="m-0 text-sm">{t.descriptionFa}</p>}
            <ul className="m-0 grid gap-1.5 ps-5 text-sm">
              <li>{t.format === 'swiss' ? `${faNum(t.rounds ?? 0)} دور؛ هر دور با هم‌امتیازها هم‌میز می‌شوید.` : `از هر میز ${faNum(t.advance)} نفر بالا می‌رود تا میز نهایی.`}</li>
              <li>هر میز {faNum(t.tableSize)} نفره؛ بُرد کامل یک امتیاز، مساوی نصف آن.</li>
              <li>{durationFa(t.arrivalSeconds)} فرصت دارید سر میز بیایید؛ بعد از آن ربات (یا باخت فنی) جای شما را می‌گیرد و امتیاز آن میز صفر است.</li>
              <li>دو غیبت یعنی حذف از تورنمنت. نتیجهٔ میزها روی رتبه‌بندی رتبه‌دار اثری ندارد.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
