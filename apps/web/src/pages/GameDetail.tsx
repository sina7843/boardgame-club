import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { GameDetail } from '@bg/contracts';
import { Avatar, Badge, Banner, Breadcrumbs, Button, Card, Icon, Skeleton, StateBlock } from '@bg/ui/bgv';
import { AvatarArt } from '../lib/bgv.tsx';
import { BotPlay } from '../games/BotPlay.tsx';
import { GameWiki } from './Wiki.tsx';
import { GameCover } from '../games/covers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { ACCESS_FA, COMPETITION_FA, DIFFICULTY_FA, durationFa, faNum, PACE_FA, range } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

/** Rules lines; a line starting with "## " opens a titled section (Goal, Setup, Turn, Scoring, End, Tips). */
export function RulesText({ lines }: { lines: string[] }) {
  const sections: { title: string | null; items: string[] }[] = [];
  for (const l of lines) {
    if (l.startsWith('## ')) sections.push({ title: l.slice(3), items: [] });
    else (sections.at(-1) ?? sections[sections.push({ title: null, items: [] }) - 1]!).items.push(l);
  }
  return (
    <div className="pg-rules">{sections.map((s, i) => (
      <div key={i} className="pg-sec">
        {s.title && <h3>{s.title}</h3>}
        {s.items.length > 0 && <ol>{s.items.map((r) => <li key={r}>{r}</li>)}</ol>}
      </div>))}
    </div>
  );
}

interface OpenRow { id: string; pace: 'live' | 'turn'; players: number; capacity: number; turnSeconds: number; host: { displayName: string }; seated: { name: string; avatarKey: string }[] }

/** Public tables of this game still waiting for players: sit straight down from the game page. */
function GameOpenTables({ gameId }: { gameId: string }) {
  const list = useApi<{ items: OpenRow[] }>(`/tables?gameId=${encodeURIComponent(gameId)}`);
  const rows = list.data?.items ?? [];
  return (
    <Card flush as="section" aria-labelledby="gopen-h">
      <div className="pg-cardhead"><h2 id="gopen-h" className="ac-h3" style={{ margin: 0 }}>میزهای باز این بازی</h2>
        {rows.length > 0 && <Badge size="sm">{faNum(rows.length)}</Badge>}<span className="bgv-spacer" /><Button size="sm" variant="ghost" href="/tables">همه میزها</Button></div>
      {list.error ? <StateBlock kind="error" title="میزها دریافت نشد" action={<Button variant="primary" icon="refresh-cw" onClick={list.reload}>تلاش دوباره</Button>} />
        : !list.data ? <StateBlock kind="loading" title="در حال بارگذاری…" />
        : rows.length === 0 ? <p className="t-body-sm bgv-muted pg-pad">فعلاً میز بازی منتظر بازیکن نیست؛ خودتان میز بسازید.</p>
        : <ul className="pg-ul">{rows.slice(0, 5).map((t) => (
          <li key={t.id} className="pg-gorow">
            <span className="bgv-avatars" aria-hidden="true">{t.seated.map((p, i) => <Avatar key={i} size="xs" initials={p.name.trim().charAt(0)} className={`seat-${i + 1}`}><AvatarArt avatarKey={p.avatarKey} /></Avatar>)}</span>
            <span className="pg-meta"><bdi>{t.host.displayName}</bdi><span className="bgv-sep" />{PACE_FA[t.pace]}<span className="bgv-sep" />{durationFa(t.turnSeconds)}<span className="bgv-sep" />{faNum(t.players)} از {faNum(t.capacity)}</span>
            <span className="bgv-spacer" />
            <Button size="sm" variant="primary" icon="armchair" href={`/tables/${t.id}`}>نشستن</Button>
          </li>))}</ul>}
    </Card>
  );
}

export function GameDetailPage() {
  const { id = '' } = useParams();
  const { data: g, error, loading, reload } = useApi<GameDetail>(`/games/${encodeURIComponent(id)}`);
  usePageTitle(g?.nameFa ?? 'صفحه بازی');
  const { me } = useSession();
  const navigate = useNavigate();
  const tutorials = useApi<{ items: { gameId: string; status: string }[] }>(me ? '/me/tutorials' : null);
  const tutorialStatus = tutorials.data?.items.find((t) => t.gameId === id)?.status;
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [tutorialError, setTutorialError] = useState<string>();
  const startTutorial = async () => {
    setTutorialBusy(true); setTutorialError(undefined);
    try { navigate(`/tables/${(await api<{ tableId: string }>(`/tutorials/${id}/start`, { method: 'POST', body: {} })).tableId}`); }
    catch (e) { setTutorialError(e instanceof ApiFailure ? e.messageFa : 'آموزش شروع نشد.'); }
    finally { setTutorialBusy(false); }
  };

  const crumbs = (last: string) => <Breadcrumbs items={[{ label: 'بازی‌ها', href: '/games' }, { label: last }]} />;
  if (loading && !g) return <>{crumbs('…')}<Skeleton height={320} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری صفحه بازی…</span></>;
  if (error?.status === 404) return <>{crumbs('بازی پیدا نشد')}<StateBlock kind="empty" title="این بازی پیدا نشد" text="ممکن است نشانی اشتباه باشد یا بازی هنوز منتشر نشده باشد." action={<Button href="/games">همه بازی‌ها</Button>} /></>;
  if (error || !g) return <>{crumbs('خطا')}<StateBlock kind="error" title="صفحه بازی بارگذاری نشد" text={error?.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} /></>;

  const tutorialLabel = tutorialStatus === 'in_progress' ? 'ادامه آموزش تعاملی' : tutorialStatus === 'completed' ? 'اجرای دوباره آموزش' : 'آموزش تعاملی';
  const defaultOf = (o: GameDetail['options'][number]) => o.choices.find((c) => c.value === o.default)?.labelFa;

  return (
    <>
      {crumbs(g.nameFa)}
      <article className="pg-dethero">
        <div className="pg-dethero__cover"><GameCover gameId={g.id} title={`تصویر جلد ${g.nameFa}`} flippable /></div>
        <div className="pg-dethero__text" data-tour="game-actions">
          <div className="pg-head-actions">
            <Badge icon={g.access === 'premium' ? 'crown' : 'lock-open'} tone={g.access === 'premium' ? 'premium' : 'neutral'}>{ACCESS_FA[g.access]}</Badge>
            {g.paces.map((p) => <Badge key={p} icon={p === 'live' ? 'zap' : 'hourglass'}>{PACE_FA[p]}</Badge>)}
            {g.botAvailable && <Badge icon="bot">ربات</Badge>}
            {g.isTestGame && <Badge tone="test" icon="triangle-alert">بازی آزمایشی</Badge>}
            {g.status === 'suspended' && <Badge tone="danger">متوقف‌شده</Badge>}
          </div>
          <h1 className="t-page" style={{ margin: 0 }}>{g.nameFa} <bdi className="bgv-latin bgv-muted" dir="ltr">{g.nameOriginal}</bdi></h1>
          {g.isTestGame && <Banner tone="info" text="این بازی اختصاصی و برای آزمون موتور بازی ساخته شده است؛ جزو فهرست نهایی بازی‌های عرضه نیست." />}
          <p className="t-body" style={{ margin: 0 }}>{g.summaryFa}</p>
          <dl className="pg-facts" aria-label="مشخصات">
            <div><dt>تعداد نفر</dt><dd>{range(g.minPlayers, g.maxPlayers, 'نفر')}</dd></div>
            <div><dt>زمان</dt><dd>{range(g.minMinutes, g.maxMinutes, 'دقیقه')}</dd></div>
            <div><dt>دشواری</dt><dd>{DIFFICULTY_FA[g.difficulty]}</dd></div>
            <div><dt>دسترسی</dt><dd>{ACCESS_FA[g.access]}{g.access === 'premium' ? '، نیازمند اشتراک' : '، بدون اشتراک'}</dd></div>
            <div><dt>حالت‌ها</dt><dd>{g.paces.map((p) => PACE_FA[p]).join('، ')}</dd></div>
            <div><dt>نوع رقابت</dt><dd>{g.competitions.map((c) => COMPETITION_FA[c]).join('، ')}</dd></div>
          </dl>
          {g.access === 'premium' && <Banner tone="info" text={<>ساخت میز این بازی به اشتراک پریمیوم نیاز دارد. اگر میزبان پریمیوم باشد، دوستانی که دعوت می‌کند می‌توانند بدون اشتراک بازی کنند. <a href="/plans">اشتراک</a></>} />}
          {!g.acceptingNewTables && <Banner tone="warning" text="پذیرش میز جدید برای این بازی موقتاً متوقف است." />}
          {!me ? (
            <div className="pg-actions"><Button variant="primary" href={`/login?next=/games/${g.id}`}>برای بازی و آموزش وارد شوید</Button></div>
          ) : g.acceptingNewTables && (
            <>
              <div className="pg-actions">
                <Button variant="primary" icon="zap" href={`/play?game=${g.id}`}>حریف‌یابی سریع</Button>
                <Button icon="plus" href={`/games/${g.id}/new`}>ساخت میز</Button>
                <Button variant="ghost" href="/tables">میزهای باز دیگران</Button>
              </div>
              {g.tutorialEnabled && (
                <div className="pg-tutor">
                  <Icon name="book-open" />
                  <div><b>آموزش تعاملی</b><span className="bgv-muted t-body-sm">{g.tutorialFa}</span>
                    {tutorialStatus === 'completed' && <span className="t-body-sm">آموزش این بازی را کامل کرده‌اید.</span>}
                  </div>
                  <Button loading={tutorialBusy} onClick={startTutorial}>{tutorialLabel}</Button>
                </div>
              )}
              {tutorialError && <p className="bgv-hint bgv-hint--error" role="alert">{tutorialError}</p>}
              {g.botAvailable && <Card raised title="بازی با ربات"><BotPlay gameId={g.id} minPlayers={g.minPlayers} maxPlayers={g.maxPlayers} /></Card>}
            </>
          )}
        </div>
      </article>

      <div className="bgv-cols">
        <div className="pg-stack">
          {me && <GameOpenTables gameId={g.id} />}
          <Card title="قوانین" as="section" aria-label="قوانین"><RulesText lines={g.rulesFa} /></Card>
          <GameWiki gameId={g.id} />
        </div>
        <aside className="pg-stack" aria-label="مشخصات و شروع">
          {!g.tutorialEnabled && <Card title="آموزش"><p className="pg-policy">{g.tutorialFa}</p></Card>}
          <Card title="اتمام زمان و انصراف">
            <p className="pg-policy"><b>اتمام زمان: </b>{g.timeoutPolicyFa}</p>
            <p className="pg-policy"><b>انصراف: </b>{g.resignPolicyFa}</p>
          </Card>
          {g.options.length > 0 && (
            <Card title="گزینه‌های قانون">
              {g.options.map((o) => (
                <p key={o.key} className="pg-policy"><b>{o.labelFa}: </b>
                  {o.hostChooses && o.choices.length > 1 ? `به انتخاب میزبان (${o.choices.map((c) => c.labelFa).join('، ')})` : defaultOf(o)}
                </p>
              ))}
            </Card>
          )}
          {g.activeVersion && <span className="pg-meta">نسخه قوانین <bdi className="bgv-latin" dir="ltr">{g.activeVersion.rulesVersion}</bdi></span>}
        </aside>
      </div>
    </>
  );
}
