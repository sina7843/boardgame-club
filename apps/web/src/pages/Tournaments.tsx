import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { TournamentDetail, TournamentSummary } from '@bg/contracts';
import { Badge, Banner, Breadcrumbs, Button, Card, Chip, Coin, DataTable, Icon, Identity, PageHead, Progress, Segmented, Skeleton, StateBlock, Tabs } from '@bg/ui/bgv';
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
      <PageHead title="تورنمنت‌ها" sub="مسابقه‌های زمان‌بندی‌شده با جایزهٔ ثابت. دور بعد خودکار شروع می‌شود؛ اگر سر میز نیایید امتیاز آن میز را از دست می‌دهید (در بازی دونفره حریف برنده می‌شود)."
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
  const [roundSel, setRoundSel] = useState<number>();
  const d = useApi<TournamentDetail>(`/tournaments/${id}${roundSel ? `?round=${roundSel}` : ''}`);
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState<'table' | 'rounds' | 'prizes' | 'rules'>('table');
  usePageTitle(d.data?.titleFa ?? 'تورنمنت');
  usePoll(d.reload, d.data?.status === 'running' || d.data?.status === 'open');
  const crumbs = (last: string) => <Breadcrumbs items={[{ label: 'میزها', href: '/tables' }, { label: 'تورنمنت‌ها', href: '/tournaments' }, { label: last }]} />;
  if (d.error) return <>{crumbs('…')}<StateBlock kind={d.error.status === 404 ? 'empty' : 'error'} title={d.error.status === 404 ? 'این تورنمنت پیدا نشد' : 'تورنمنت دریافت نشد'}
    action={<Button variant="primary" href="/tournaments">همهٔ تورنمنت‌ها</Button>} /></>;
  if (!d.data) return <>{crumbs('…')}<Skeleton height={260} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری…</span></>;
  const t = d.data;

  const act = async (path: string, ok: string, body?: unknown) => {
    setBusy(true);
    try {
      if (path === 'checkout') { location.assign((await api<{ redirectUrl: string }>(`/tournaments/${t.id}/checkout`, { method: 'POST' })).redirectUrl); return; }
      await api(`/tournaments/${t.id}/${path}`, { method: 'POST', ...(body !== undefined ? { body } : {}) });
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
  const roundData = t.roundsPlayed[0];
  const round = roundData?.round;
  const startsMs = Date.parse(t.startsAt);
  const checkinOpen = open && t.checkinMinutes > 0 && Date.now() >= startsMs - t.checkinMinutes * 60_000;
  const headToHead = t.tableSize === 2;
  const swiss = t.format === 'swiss';
  const clockFa = typeof t.options.clock === 'string' && t.options.clock !== 'none' ? `ساعت ${t.options.clock}` : null;
  const futureRounds = swiss && t.rounds ? Array.from({ length: t.rounds }, (_, i) => i + 1).filter((r) => r > t.currentRound) : [];

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
            <span><Icon name="swords" size="sm" />{PACE_FA[t.pace]}، {clockFa ?? `هر حرکت ${durationFa(t.turnSeconds)}`}</span>
            {top && <span><Icon name="gift" size="sm" />جایزهٔ اول {prizeFa(top)}</span>}
          </div>
        </div>
        {t.me?.tableId && (
          <div className="pg-plate">
            <span className="bgv-hero__eyebrow">میز شما آماده است</span>
            <span className="t-body-sm" style={{ color: 'var(--felt-muted)' }}>{durationFa(t.arrivalSeconds)} فرصت دارید سر میز بیایید؛ {headToHead ? 'بعد از آن باخت فنی می‌خورید.' : 'بعد ربات جای شما بازی می‌کند.'}</span>
            <Button variant="primary" size="lg" block icon="armchair" href={`/tables/${t.me.tableId}`}>میز شما آماده است؛ ورود به میز</Button>
          </div>
        )}
      </section>

      {t.status === 'cancelled' && <div role="alert"><Banner tone="warning" text={`این تورنمنت لغو شد${t.cancelReason ? `: ${t.cancelReason}` : '.'} ورودی‌ها برگشت داده می‌شود.`} /></div>}
      {t.me?.disqualified && <div role="alert"><Banner tone="warning" text="شما از این تورنمنت محروم شده‌اید." /></div>}
      {t.nextRoundAt && t.status === 'running' && <div role="status"><Banner tone="info" text={`استراحت بین دورها؛ دور ${faNum(t.currentRound + 1)} در ${jalaliDateTime(t.nextRoundAt)} شروع می‌شود.`} /></div>}
      {checkinOpen && t.me?.registered && !t.me.checkedIn && (
        <div role="alert"><Banner tone="warning" text={`تأیید حضور باز است؛ تا شروع تورنمنت حضورتان را تأیید کنید وگرنه از تورنمنت خارج می‌شوید و ورودی برمی‌گردد.`}
          action={<Button variant="primary" size="sm" loading={busy} onClick={() => act('checkin', 'حضور شما تأیید شد.')}>تأیید حضور</Button>} /></div>
      )}
      {t.me?.refundStatus &&<div role="status"><Banner tone="info" text={t.me.refundStatus === 'pending' ? 'بازپرداخت ورودی شما ثبت شده و پشتیبانی آن را به حساب شما واریز می‌کند.' : 'ورودی شما بازپرداخت شد.'} /></div>}

      <div className="pg-phonetabs">
        <Tabs label="بخش‌های تورنمنت" value={pane} onChange={(v) => setPane(v as typeof pane)}
          items={[{ value: 'table', label: 'جدول' }, { value: 'rounds', label: 'دورها' }, { value: 'prizes', label: 'جایزه‌ها' }, { value: 'rules', label: 'قوانین' }]} />
      </div>
      <div className="bgv-cols pg-panes" data-tab={pane}>
        <div className="pg-stack">
          {t.status === 'finished' && leader && (
            <Card data-pane="table" aria-label="قهرمان"><Identity size="lg" {...userIdentity(leader.player, { you: leader.player.id === session?.id, sub: 'قهرمان' })} /></Card>
          )}
          {t.featured.length > 0 && (
            <Card data-pane="table" flush as="section" aria-labelledby="feat-h">
              <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)' }}>
                <h2 id="feat-h" className="pg-h2" style={{ flex: 1 }}><Icon name="eye" />میزهای برتر (پخش زنده)</h2>
              </div>
              <ul className="pg-ul">{t.featured.map((f) => (
                <li key={f.tableId} className="pg-round">
                  <div className="bgv-row" style={{ gap: 'var(--space-2) var(--space-4)', flexWrap: 'wrap', flex: 1 }}>
                    {f.players.map((p) => <span key={p.player.id} className="pg-meta" style={{ color: 'var(--text)' }}><bdi>{p.player.displayName}</bdi> ({faNum(Math.round(p.points * 100) / 100)})</span>)}
                  </div>
                  {f.tableId !== t.me?.tableId && <Button size="sm" icon="eye" href={`/tables/${f.tableId}`}>تماشا</Button>}
                </li>))}</ul>
            </Card>
          )}
          <Card data-pane="table" flush as="section" aria-labelledby="stand-h">
            <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)' }}>
              <h2 id="stand-h" className="pg-h2" style={{ flex: 1 }}><Icon name="list" />جدول</h2>
              <span className="bgv-muted t-caption">{faNum(t.standings.length)} نفر</span>
              {t.roundCount > 0 && <Button size="sm" variant="ghost" icon="download" onClick={() => location.assign(`/api/tournaments/${t.id}/standings.csv`)}>خروجی CSV</Button>}
            </div>
            {t.standings.length === 0 ? <p className="bgv-muted" style={{ padding: 'var(--space-5)', margin: 0 }}>هنوز کسی ثبت‌نام نکرده است.</p> : (
              <div className="bgv-scroll-x pg-tablewrap">
                <DataTable caption="جدول تورنمنت" rows={t.standings.map((r) => ({ ...r, you: r.player.id === session?.id }))} columns={[
                  { key: 'rank', label: 'رتبه', render: (r) => (r.finalRank ? (r.finalRank <= 3 ? <span className={`pf-medal ${['tier-gold', 'tier-silver', 'tier-bronze'][r.finalRank - 1]}`}>{faNum(r.finalRank)}</span> : faNum(r.finalRank)) : '—') },
                  { key: 'p', label: 'بازیکن', render: (r) => <a href={`/users/${r.player.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><Identity size="sm" {...userIdentity(r.player, { you: r.you })} /></a> },
                  { key: 'pts', label: 'امتیاز', strong: true, render: (r) => faNum(Math.round(r.points * 100) / 100) },
                  ...(swiss ? [
                    ...(headToHead ? [{ key: 'bc1', label: 'بوخهولتس کات ۱', render: (r: typeof t.standings[number]) => faNum(Math.round(r.buchholzCut1 * 100) / 100) }] : []),
                    ...(t.standings.some((r) => r.aro !== null) ? [{ key: 'aro', label: 'میانگین رتبهٔ حریفان', render: (r: typeof t.standings[number]) => (r.aro === null ? '—' : faNum(r.aro)) }] : []),
                    ...(t.standings.some((r) => r.tpr !== null) ? [{ key: 'tpr', label: 'عملکرد رتبه‌ای', render: (r: typeof t.standings[number]) => (r.tpr === null ? '—' : faNum(r.tpr)) }] : []),
                    { key: 'bh', label: 'بوخهولتس', render: (r: typeof t.standings[number]) => faNum(Math.round(r.buchholz * 100) / 100) },
                    { key: 'sb', label: 'سونبورن‌برگر', render: (r: typeof t.standings[number]) => faNum(Math.round(r.sonnebornBerger * 100) / 100) }
                  ] : []),
                  { key: 'w', label: 'برد', render: (r) => faNum(r.wins) },
                  { key: 's', label: 'وضعیت', render: (r) => (r.disqualified ? 'محروم' : r.eliminatedRound ? `حذف در دور ${faNum(r.eliminatedRound)}` : r.noShows ? `${faNum(r.noShows)} غیبت` : '') }
                ]} />
              </div>
            )}
          </Card>
          {swiss && headToHead && t.roundCount > 0 && t.standings.some((s) => s.results.length > 0) && (
            <Card data-pane="rounds" flush as="section" aria-labelledby="cross-h">
              <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)' }}>
                <h2 id="cross-h" className="pg-h2" style={{ flex: 1 }}><Icon name="grid" />جدول متقاطع</h2>
              </div>
              <p className="bgv-hint" style={{ padding: '0 var(--space-5)' }}>هر خانه: نتیجه (+ برد، = مساوی، − باخت)، شمارهٔ ردیف حریف در جدول، و رنگ (س سفید، ی سیاه). «بای» استراحت است و «ف» یعنی نتیجهٔ فنی.</p>
              <div className="bgv-scroll-x pg-tablewrap">
                <DataTable caption="جدول متقاطع" rows={t.standings.map((r, i) => ({ ...r, n: i + 1 }))} columns={[
                  { key: 'n', label: '#', render: (r) => faNum(r.n) },
                  { key: 'p', label: 'بازیکن', render: (r) => <bdi>{r.player.displayName}</bdi> },
                  ...Array.from({ length: t.rounds ?? t.roundCount }, (_, i) => ({
                    key: `r${i + 1}`, label: `دور ${faNum(i + 1)}`,
                    render: (r: typeof t.standings[number] & { n: number }) => {
                      const x = r.results.find((y) => y.round === i + 1);
                      if (!x) return '';
                      if (x.kind === 'bye') return 'بای +';
                      if (x.kind === 'requestedBye') return 'بای =';
                      const opp = x.opponentId ? t.standings.findIndex((s) => s.player.id === x.opponentId) + 1 : 0;
                      const glyph = x.result === 1 ? '+' : x.result === 0.5 ? '=' : '−';
                      return <bdi dir="ltr">{glyph}{opp || ''}{x.kind === 'forfeitWin' || x.kind === 'forfeitLoss' ? 'ف' : x.side === 'first' ? 'س' : x.side === 'second' ? 'ی' : ''}</bdi>;
                    }
                  })),
                  { key: 'pts', label: 'امتیاز', strong: true, render: (r) => faNum(Math.round(r.points * 100) / 100) }
                ]} />
              </div>
            </Card>
          )}
          {t.roundCount > 0 && round !== undefined && (
            <Card data-pane="rounds" flush as="section" aria-labelledby="rounds-h">
              <div className="bgv-row" style={{ padding: 'var(--space-5) var(--space-5) var(--space-2)', flexWrap: 'wrap' }}>
                <h2 id="rounds-h" className="pg-h2" style={{ flex: 1 }}><Icon name="swords" />دورها</h2>
                <Segmented label="دور" value={String(round)} onChange={(v) => setRoundSel(Number(v))} options={Array.from({ length: t.roundCount }, (_, i) => ({ value: String(i + 1), label: `دور ${faNum(i + 1)}` }))} />
              </div>
              <ul className="pg-ul">{roundData?.tables.map((tb, i) => (
                <li key={tb.tableId} className={`pg-round${tb.tableId === t.me?.tableId ? ' is-you' : ''}`}>
                  <b className="t-body-sm">{tb.playoff ? <Badge tone="warning" size="sm">حکم نهایی (آرماگدون)</Badge> : <>میز {faNum(i + 1)}</>}</b>
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
                    {tb.status === 'finished' && t.gameId === 'chess' && <Button size="sm" variant="ghost" icon="download" onClick={() => location.assign(`/api/tables/${tb.tableId}/record`)}>PGN</Button>}
                  </span>
                </li>))}</ul>
            </Card>
          )}
        </div>

        <aside className="pg-stack">
          <Card data-pane="prizes" title="ورود" as="section" aria-label="ورود">
            <div className="pg-stack">
              <b className="t-title">{entryNode(t)}</b>
              {t.entryKind === 'toman' && t.checkout.fixture && <div role="note"><Banner tone="warning" text="درگاه آزمایشی است و پول واقعی جابه‌جا نمی‌شود." /></div>}
              {!session ? <Button variant="primary" block href={`/login?next=/tournaments/${t.id}`}>برای ثبت‌نام وارد شوید</Button>
                : t.me?.registered ? (
                  <>
                    <Badge tone="success" icon="circle-check">{t.checkinMinutes > 0 && t.me.checkedIn ? 'ثبت‌نام و حضور تأیید شد' : 'ثبت‌نام کرده‌اید'}</Badge>
                    {open && <Button variant="ghost" loading={busy} onClick={() => act('withdraw', 'از تورنمنت انصراف دادید؛ ورودی برمی‌گردد.')}>انصراف</Button>}
                    {futureRounds.length > 0 && !t.me.disqualified && (
                      <div className="pg-stack" style={{ gap: 'var(--space-2)' }}>
                        <b className="t-body-sm">استراحت در یک دور (نیم‌امتیاز، حداکثر ۲ دور)</b>
                        <div className="bgv-chips">{futureRounds.map((r) => {
                          const on = t.me!.requestedByes.includes(r);
                          return <Chip key={r} selected={on} onClick={() => act('bye', on ? 'درخواست استراحت پس گرفته شد.' : `برای دور ${faNum(r)} استراحت ثبت شد.`, { round: r, requested: !on })}>دور {faNum(r)}</Chip>;
                        })}</div>
                      </div>
                    )}
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
          <Card data-pane="prizes" title="جایزه‌ها" as="section" aria-label="جایزه‌ها">
            {t.prizes.length === 0 ? <p className="bgv-muted" style={{ margin: 0 }}>این تورنمنت جایزه ندارد.</p> : (
              <ul className="pg-ul pg-stack" style={{ gap: 'var(--space-2)' }}>{t.prizes.map((p) => (
                <li key={p.place} className="pg-reward"><span className={`pg-rank${p.place <= 3 ? ` r${p.place}` : ''}`}>{faNum(p.place)}</span>{['قهرمان', 'دوم', 'سوم'][p.place - 1] ?? `رتبهٔ ${faNum(p.place)}`}<b>{prizeFa(p)}</b></li>
              ))}</ul>
            )}
          </Card>
          <Card data-pane="rules" title="قوانین" as="section" aria-label="قوانین">
            {t.descriptionFa && <p className="t-body-sm" style={{ margin: 0 }}>{t.descriptionFa}</p>}
            <ul className="pg-bullets">
              <li>{swiss ? `${faNum(t.rounds ?? 0)} دور؛ هر دور با هم‌امتیازها هم‌میز می‌شوید${headToHead ? ' و هرگز دوبار با یک حریف بازی نمی‌کنید' : ''}.` : `از هر میز ${faNum(t.advance)} نفر بالا می‌رود تا میز نهایی.`}</li>
              <li>هر میز {faNum(t.tableSize)} نفره؛ بُرد کامل یک امتیاز، مساوی نصف آن.{headToHead && t.options.firstMove === 'host' ? ' رنگ مهره‌ها بین دورها متعادل می‌شود.' : ''}</li>
              {clockFa && <li>کنترل زمان {clockFa}؛ تمام شدن ساعت یعنی باخت.</li>}
              <li>{durationFa(t.arrivalSeconds)} فرصت دارید سر میز بیایید؛ بعد از آن {headToHead ? 'باخت فنی می‌خورید و حریف برنده است' : 'ربات جای شما را می‌گیرد'} و امتیاز آن میز صفر است.</li>
              <li>دو غیبت یعنی حذف از تورنمنت. نتیجهٔ میزها روی رتبه‌بندی رتبه‌دار اثری ندارد.</li>
              {swiss && <li>{headToHead
                ? 'برابری امتیاز طبق آیین‌نامهٔ حکم تساوی فیده (C.07) شکسته می‌شود، به این ترتیب: بوخهولتس کات ۱، بوخهولتس، میانگین رتبهٔ حریفان (فقط اگر همهٔ بازیکنان رتبه داشته باشند)، سونبورن‌برگر، نتیجهٔ رودررو، تعداد برد، تعداد برد با سیاه. اگر باز هم برابر بودید رتبه مشترک است و جایزهٔ آن رتبه‌ها بین‌تان تقسیم می‌شود.'
                : 'برابری امتیاز با بوخهولتس (جمع امتیاز حریفان)، سپس سونبورن‌برگر، سپس تعداد برد شکسته می‌شود؛ اگر باز هم برابر بودید جایزهٔ آن رتبه‌ها بین‌تان تقسیم می‌شود.'}</li>}
              {t.checkinMinutes > 0 && <li>{faNum(t.checkinMinutes)} دقیقه مانده به شروع باید حضورتان را تأیید کنید، وگرنه ورودی برمی‌گردد و از تورنمنت خارج می‌شوید.</li>}
              {t.roundGapSeconds > 0 && <li>بین دورها {durationFa(t.roundGapSeconds)} استراحت است.</li>}
              {t.playoff === 'armageddon' && <li>اگر دو نفر بعد از همهٔ حکم‌های تساوی برای رتبهٔ اول برابر بمانند، یک بازی آرماگدون می‌کنند: رنگ‌ها قرعه‌کشی می‌شود، سفید ۵ دقیقه و سیاه ۴ دقیقه وقت دارد و در صورت تساوی سیاه برنده است.</li>}
              {clockFa && <li>تأخیر اینترنت تا سقف مشخصی (حدود ۱٫۵ ثانیه، با بازیابی کند در هر حرکت) از ساعت شما کم نمی‌شود.</li>}
              <li>برای بررسی بازی منصفانه، زمان هر حرکت و پنهان‌شدن صفحهٔ بازی (تعویض تب) در میزهای تورنمنت ثبت می‌شود؛ این‌ها فقط نشانه‌اند و تصمیم با داور است.</li>
              <li>تقلب (مثلاً کمک گرفتن از موتور شطرنج) با محرومیت و حذف از جدول و جایزه همراه است؛ داور می‌تواند نتیجهٔ میز را اصلاح کند.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
