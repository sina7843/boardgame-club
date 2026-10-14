import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { TournamentDetail, TournamentSummary } from '@bg/contracts';
import { Badge, Banner, Breadcrumbs, Button, Card, Chip, Coin, DataTable, Icon, Identity, PageHead, Progress, Segmented, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { coinsChanged } from '../lib/coins.tsx';
import { userIdentity } from '../lib/bgv.tsx';
import { durationFa, faNum, jalaliDateTime, PACE_FA, tomanFa } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

const FORMAT_FA = { swiss: 'امتیازی (سوئیسی)', knockout: 'حذفی' } as const;
const STATUS_FA = { open: 'ثبت‌نام باز', running: 'در جریان', finished: 'پایان‌یافته', cancelled: 'لغوشده' } as const;
const STATUS_ICON = { open: 'calendar', running: 'play', finished: 'flag', cancelled: 'ban' } as const;
const statusTone = (s: TournamentSummary['status']) => (s === 'running' ? 'success' : s === 'cancelled' ? 'danger' : s === 'open' ? 'info' : 'neutral') as 'success' | 'danger' | 'info' | 'neutral';

export function entryFa(t: Pick<TournamentSummary, 'entryKind' | 'entryAmount'>) {
  return t.entryKind === 'free' ? 'رایگان' : t.entryKind === 'coins' ? `${faNum(t.entryAmount)} سکه` : tomanFa(t.entryAmount);
}
const entryNode = (t: Pick<TournamentSummary, 'entryKind' | 'entryAmount'>) => (t.entryKind === 'coins' ? <Coin amount={t.entryAmount} /> : entryFa(t));

function prizeFa(p: TournamentSummary['prizes'][number]) {
  return [p.coins ? `${faNum(p.coins)} سکه` : '', p.premiumDays ? `${faNum(p.premiumDays)} روز پریمیوم` : ''].filter(Boolean).join(' و ') || 'افتخار';
}

/** Re-fetch every few seconds while something can change (registration count, live rounds). */
function usePoll(reload: () => void, on: boolean, ms = 5000) {
  useEffect(() => {
    if (!on) return;
    const t = setInterval(reload, ms);
    return () => clearInterval(t);
  }, [reload, on, ms]);
}

const cover = (gameId: string) => `/covers/${gameId}.webp?v=2`;

export function TournamentsPage() {
  usePageTitle('تورنمنت‌ها');
  const list = useApi<{ items: TournamentSummary[] }>('/tournaments');
  const [mine, setMine] = useState(false);
  usePoll(list.reload, true, 15000);
  const head = <><PageTabs group="tables" /></>;
  if (list.error) return <>{head}<StateBlock kind="error" title="تورنمنت‌ها دریافت نشد" text={list.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={list.reload}>تلاش دوباره</Button>} /></>;
  if (!list.data) return <>{head}<Skeleton height={320} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری…</span></>;
  const items = list.data.items.filter((t) => !mine || t.registered);
  const live = items.filter((t) => t.status === 'open' || t.status === 'running');
  const ended = items.filter((t) => t.status === 'finished' || t.status === 'cancelled');
  return (
    <>
      {head}
      <PageHead title="تورنمنت‌ها" sub="مسابقه‌های زمان‌بندی‌شده با جایزهٔ ثابت. دور بعد خودکار شروع می‌شود؛ اگر سر میز نیایید ربات جای شما بازی می‌کند و امتیاز آن میز صفر است."
        actions={<div className="bgv-chips">
          <Chip selected={!mine} onClick={() => setMine(false)}>همه</Chip>
          <Chip selected={mine} onClick={() => setMine(true)}>ثبت‌نام‌های من</Chip>
        </div>} />
      <section className="pg-sec" aria-labelledby="live-h">
        <h2 id="live-h" className="pg-h2"><Icon name="trophy" />در جریان و ثبت‌نام باز</h2>
        {live.length === 0
          ? <StateBlock kind="empty" title="فعلاً تورنمنتی برگزار نمی‌شود" text="به‌زودی برمی‌گردیم؛ اعلان‌ها را روشن نگه دارید." />
          : <div className="bgv-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', alignItems: 'stretch' }}>{live.map((t) => <TournamentCard key={t.id} t={t} />)}</div>}
      </section>
      {ended.length > 0 && (
        <section className="pg-sec" aria-labelledby="ended-h">
          <h2 id="ended-h" className="pg-h2"><Icon name="history" />پایان‌یافته</h2>
          <Card flush>
            <ul className="pg-ul">{ended.map((t) => (
              <li key={t.id} className="pg-ended">
                <img className="pg-thumb" style={{ inlineSize: 72, blockSize: 40 }} src={cover(t.gameId)} alt="" />
                <div className="pg-ended__main"><b>{t.titleFa}</b><span className="pg-meta">{t.gameNameFa}<span className="bgv-sep" />{jalaliDateTime(t.startsAt)}</span></div>
                <Badge tone={statusTone(t.status)} icon={STATUS_ICON[t.status]}>{STATUS_FA[t.status]}</Badge>
                <Button size="sm" variant="ghost" href={`/tournaments/${t.id}`}>جدول نهایی</Button>
              </li>))}</ul>
          </Card>
        </section>
      )}
    </>
  );
}

function TournamentCard({ t }: { t: TournamentSummary }) {
  const top = t.prizes[0];
  return (
    <article className="pg-tcard">
      <div className="pg-tcard__cover">
        <img src={cover(t.gameId)} alt="" />
        <span className="pg-tcard__flag"><Badge tone={statusTone(t.status)} icon={STATUS_ICON[t.status]}>{STATUS_FA[t.status]}{t.status === 'running' ? `، دور ${faNum(t.currentRound)}` : ''}</Badge></span>
      </div>
      <div className="pg-tcard__body">
        <div>
          <h2 className="pg-h2" style={{ fontSize: 18 }}>{t.titleFa}</h2>
          <span className="pg-meta">{t.gameNameFa}<span className="bgv-sep" />{FORMAT_FA[t.format]}</span>
        </div>
        <dl>
          <div><dt>شروع</dt><dd>{jalaliDateTime(t.startsAt)}</dd></div>
          <div><dt>ورودی</dt><dd>{entryNode(t)}</dd></div>
          <div><dt>ثبت‌نام</dt><dd><Progress value={t.maxEntrants ? t.entrants / t.maxEntrants : 0} label={`${faNum(t.entrants)} از ${faNum(t.maxEntrants)}`} /></dd></div>
          <div><dt>جایزهٔ اول</dt><dd>{top ? prizeFa(top) : '—'}</dd></div>
        </dl>
        {t.registered && <Badge tone="success" icon="circle-check">ثبت‌نام کرده‌اید</Badge>}
        <Button variant="primary" block href={`/tournaments/${t.id}`}>{t.registered ? 'جزئیات و جدول' : t.status === 'open' ? 'جزئیات و ثبت‌نام' : 'جزئیات و جدول'}</Button>
      </div>
    </article>
  );
}

export function TournamentPage() {
  const { id } = useParams();
  const { me: session } = useSession();
  const toast = useToast();
  const d = useApi<TournamentDetail>(`/tournaments/${id}`);
  const [busy, setBusy] = useState(false);
  const [roundSel, setRoundSel] = useState<number>();
  usePageTitle(d.data?.titleFa ?? 'تورنمنت');
  usePoll(d.reload, d.data?.status === 'running' || d.data?.status === 'open');
  const crumbs = (last: string) => <Breadcrumbs items={[{ label: 'میزها و حریف‌یابی', href: '/tables' }, { label: 'تورنمنت‌ها', href: '/tournaments' }, { label: last }]} />;
  if (d.error) return <>{crumbs('…')}<StateBlock kind={d.error.status === 404 ? 'empty' : 'error'} title={d.error.status === 404 ? 'این تورنمنت پیدا نشد' : 'تورنمنت دریافت نشد'}
    action={<Button variant="primary" href="/tournaments">همهٔ تورنمنت‌ها</Button>} /></>;
  if (!d.data) return <>{crumbs('…')}<Skeleton height={260} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری…</span></>;
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
  const top = t.prizes[0];
  const round = roundSel ?? (t.roundsPlayed.some((r) => r.round === t.currentRound) ? t.currentRound : t.roundsPlayed.at(-1)?.round);
  const roundData = t.roundsPlayed.find((r) => r.round === round);

  return (
    <>
      {crumbs(t.titleFa)}
      <section aria-labelledby="t-h" className="bgv-hero pg-thero">
        <div className="pg-stack">
          <div className="bgv-row">
            <span className="bgv-hero__eyebrow">{t.gameNameFa}، {FORMAT_FA[t.format]}</span>
            <span className="pg-hero-chip"><Icon name={STATUS_ICON[t.status]} size="sm" />{STATUS_FA[t.status]}{t.status === 'running' ? `، دور ${faNum(t.currentRound)}${t.rounds ? ` از ${faNum(t.rounds)}` : ''}` : ''}</span>
          </div>
          <h1 id="t-h" className="t-page" style={{ margin: 0 }}>{t.titleFa}</h1>
          <div className="pg-hero-meta">
            <span><Icon name="calendar" size="sm" />{jalaliDateTime(t.startsAt)}</span>
            <span><Icon name="users" size="sm" />{faNum(t.entrants)} از {faNum(t.maxEntrants)} نفر (حداقل {faNum(t.minEntrants)})</span>
            <span><Icon name="swords" size="sm" />{PACE_FA[t.pace]}، هر حرکت {durationFa(t.turnSeconds)}</span>
            {top && <span><Icon name="gift" size="sm" />جایزهٔ اول {prizeFa(top)}</span>}
          </div>
        </div>
        {t.me?.tableId && (
          <div className="pg-plate">
            <span className="bgv-hero__eyebrow">میز شما آماده است</span>
            <span className="t-body-sm" style={{ color: 'var(--felt-muted)' }}>{durationFa(t.arrivalSeconds)} فرصت دارید سر میز بیایید؛ بعد ربات جای شما بازی می‌کند.</span>
            <Button variant="primary" size="lg" block icon="armchair" href={`/tables/${t.me.tableId}`}>میز شما آماده است؛ ورود به میز</Button>
          </div>
        )}
      </section>

      {t.status === 'cancelled' && <div role="alert"><Banner tone="warning" text={`این تورنمنت لغو شد${t.cancelReason ? `: ${t.cancelReason}` : '.'} ورودی‌ها برگشت داده می‌شود.`} /></div>}
      {t.me?.refundStatus && <div role="status"><Banner tone="info" text={t.me.refundStatus === 'pending' ? 'بازپرداخت ورودی شما ثبت شده و پشتیبانی آن را به حساب شما واریز می‌کند.' : 'ورودی شما بازپرداخت شد.'} /></div>}

      <div className="bgv-cols">
        <div className="pg-stack">
          {t.status === 'finished' && leader && (
            <Card aria-label="قهرمان"><Identity size="lg" {...userIdentity(leader.player, { you: leader.player.id === session?.id, sub: 'قهرمان' })} /></Card>
          )}
          <Card flush as="section" aria-labelledby="stand-h">
            <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)' }}>
              <h2 id="stand-h" className="pg-h2" style={{ flex: 1 }}><Icon name="list" />جدول</h2>
              <span className="bgv-muted t-caption">{faNum(t.standings.length)} نفر</span>
            </div>
            {t.standings.length === 0 ? <p className="bgv-muted" style={{ padding: 'var(--space-5)', margin: 0 }}>هنوز کسی ثبت‌نام نکرده است.</p> : (
              <div className="bgv-scroll-x pg-tablewrap">
                <DataTable caption="جدول تورنمنت" rows={t.standings.map((r) => ({ ...r, you: r.player.id === session?.id }))} columns={[
                  { key: 'rank', label: 'رتبه', render: (r) => (r.finalRank ? (r.finalRank <= 3 ? <span className={`pf-medal ${['tier-gold', 'tier-silver', 'tier-bronze'][r.finalRank - 1]}`}>{faNum(r.finalRank)}</span> : faNum(r.finalRank)) : '—') },
                  { key: 'p', label: 'بازیکن', render: (r) => <a href={`/users/${r.player.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><Identity size="sm" {...userIdentity(r.player, { you: r.you })} /></a> },
                  { key: 'pts', label: 'امتیاز', strong: true, render: (r) => faNum(Math.round(r.points * 100) / 100) },
                  { key: 'w', label: 'برد', render: (r) => faNum(r.wins) },
                  { key: 's', label: 'وضعیت', render: (r) => (r.eliminatedRound ? `حذف در دور ${faNum(r.eliminatedRound)}` : r.noShows ? `${faNum(r.noShows)} غیبت` : '') }
                ]} />
              </div>
            )}
          </Card>
          {t.roundsPlayed.length > 0 && round !== undefined && (
            <Card flush as="section" aria-labelledby="rounds-h">
              <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)', flexWrap: 'wrap' }}>
                <h2 id="rounds-h" className="pg-h2" style={{ flex: 1 }}><Icon name="swords" />دورها</h2>
                <Segmented label="دور" value={String(round)} onChange={(v) => setRoundSel(Number(v))} options={t.roundsPlayed.map((r) => ({ value: String(r.round), label: `دور ${faNum(r.round)}` }))} />
              </div>
              <ul className="pg-ul">{roundData?.tables.map((tb, i) => (
                <li key={tb.tableId} className={`pg-round${tb.tableId === t.me?.tableId ? ' is-you' : ''}`}>
                  <b className="t-body-sm">میز {faNum(i + 1)}</b>
                  <div className="bgv-row" style={{ gap: 'var(--space-2) var(--space-4)', flexWrap: 'wrap' }}>
                    {tb.players.map((p) => (
                      <span key={p.player.id} className="pg-meta" style={{ color: 'var(--text)' }}>
                        <bdi>{p.player.displayName}</bdi>
                        {p.absent ? <Badge tone="danger" size="sm">غایب</Badge> : p.place ? <Badge tone={p.place === 1 ? 'success' : 'neutral'} size="sm">نفر {faNum(p.place)}</Badge> : null}
                      </span>
                    ))}
                  </div>
                  <span className="bgv-row">
                    {(tb.status === 'open' || tb.status === 'active') && <span className="bgv-pstate bgv-pstate--done"><Icon name="play" size="sm" />در حال بازی</span>}
                    {tb.status === 'active' && tb.tableId !== t.me?.tableId && <Button size="sm" icon="eye" href={`/tables/${tb.tableId}`}>تماشا</Button>}
                  </span>
                </li>))}</ul>
            </Card>
          )}
        </div>

        <aside className="pg-stack">
          <Card title="ورود" as="section" aria-label="ورود">
            <div className="pg-stack">
              <b className="t-title">{entryNode(t)}</b>
              {t.entryKind === 'toman' && t.checkout.fixture && <div role="note"><Banner tone="warning" text="درگاه آزمایشی است و پول واقعی جابه‌جا نمی‌شود." /></div>}
              {!session ? <Button variant="primary" block href={`/login?next=/tournaments/${t.id}`}>برای ثبت‌نام وارد شوید</Button>
                : t.me?.registered ? (
                  <>
                    <Badge tone="success" icon="circle-check">ثبت‌نام کرده‌اید</Badge>
                    {open && <Button variant="ghost" loading={busy} onClick={() => act('withdraw', 'از تورنمنت انصراف دادید؛ ورودی برمی‌گردد.')}>انصراف</Button>}
                  </>
                ) : open ? (
                  t.entryKind === 'toman'
                    ? <Button variant="primary" block loading={busy} disabled={full || !t.checkout.available} onClick={() => act('checkout', '')}>{full ? 'ظرفیت تکمیل است' : 'پرداخت و ثبت‌نام'}</Button>
                    : <Button variant="primary" block loading={busy} disabled={full} onClick={() => act('register', 'ثبت‌نام شد. زمان شروع اعلان می‌گیرید.')}>{full ? 'ظرفیت تکمیل است' : 'ثبت‌نام'}</Button>
                ) : <p className="bgv-muted" style={{ margin: 0 }}>ثبت‌نام بسته است.</p>}
              {t.entryKind === 'toman' && !t.checkout.available && t.checkout.reasonFa && <p className="bgv-hint">{t.checkout.reasonFa}</p>}
              <p className="bgv-hint"><Icon name="info" size="sm" />جایزه را سکوی بازی می‌دهد و از ورودی‌ها جمع نمی‌شود. انصراف پیش از شروع ورودی را برمی‌گرداند.</p>
            </div>
          </Card>
          <Card title="جایزه‌ها" as="section" aria-label="جایزه‌ها">
            {t.prizes.length === 0 ? <p className="bgv-muted" style={{ margin: 0 }}>این تورنمنت جایزه ندارد.</p> : (
              <ul className="pg-ul pg-stack" style={{ gap: 'var(--space-2)' }}>{t.prizes.map((p) => (
                <li key={p.place} className="pg-reward"><span className={`pg-rank${p.place <= 3 ? ` r${p.place}` : ''}`}>{faNum(p.place)}</span>{['قهرمان', 'دوم', 'سوم'][p.place - 1] ?? `رتبهٔ ${faNum(p.place)}`}<b>{prizeFa(p)}</b></li>
              ))}</ul>
            )}
          </Card>
          <Card title="قوانین" as="section" aria-label="قوانین">
            {t.descriptionFa && <p className="t-body-sm" style={{ margin: 0 }}>{t.descriptionFa}</p>}
            <ul className="pg-bullets">
              <li>{t.format === 'swiss' ? `${faNum(t.rounds ?? 0)} دور؛ هر دور با هم‌امتیازها هم‌میز می‌شوید.` : `از هر میز ${faNum(t.advance)} نفر بالا می‌رود تا میز نهایی.`}</li>
              <li>هر میز {faNum(t.tableSize)} نفره؛ بُرد کامل یک امتیاز، مساوی نصف آن.</li>
              <li>{durationFa(t.arrivalSeconds)} فرصت دارید سر میز بیایید؛ بعد از آن ربات (یا باخت فنی) جای شما را می‌گیرد و امتیاز آن میز صفر است.</li>
              <li>دو غیبت یعنی حذف از تورنمنت. نتیجهٔ میزها روی رتبه‌بندی رتبه‌دار اثری ندارد.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
