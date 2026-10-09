import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { GameDetail } from '@bg/contracts';
import { Badge, Button, Icon, StateBlock } from '@bg/ui';
import { GameCover } from '../games/covers.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { ACCESS_FA, COMPETITION_FA, DIFFICULTY_FA, PACE_FA, range } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

/** Rules lines; a line starting with "## " opens a titled section (Goal, Setup, Turn, Scoring, End, Tips). */
export function RulesText({ lines }: { lines: string[] }) {
  const sections: { title: string | null; items: string[] }[] = [];
  for (const l of lines) {
    if (l.startsWith('## ')) sections.push({ title: l.slice(3), items: [] });
    else (sections.at(-1) ?? sections[sections.push({ title: null, items: [] }) - 1]!).items.push(l);
  }
  return (
    <div className="rules-text">{sections.map((s, i) => (
      <div key={i} className="rules-section">
        {s.title && <h3 className="rules-section__title">{s.title}</h3>}
        {s.items.length > 0 && <ol className="rules">{s.items.map((r) => <li key={r}>{r}</li>)}</ol>}
      </div>))}
    </div>
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

  const back = <Link to="/games" className="breadcrumb"><Icon name="chevron" size={18} />همه بازی‌ها</Link>;
  if (loading && !g) return <>{back}<StateBlock kind="loading" title="در حال بارگذاری صفحه بازی…" /></>;
  if (error?.status === 404) return <>{back}<StateBlock kind="empty" title="این بازی پیدا نشد">ممکن است نشانی اشتباه باشد یا بازی هنوز منتشر نشده باشد.</StateBlock></>;
  if (error || !g) return <>{back}<StateBlock kind="error" title="صفحه بازی بارگذاری نشد" action={<Button onClick={reload}>تلاش دوباره</Button>}>{error?.messageFa}</StateBlock></>;

  return (
    <>
      {back}
      <div className="detail">
        <article className="stack">
          <div className="detail__cover"><GameCover gameId={g.id} title={`تصویر جلد ${g.nameFa}`} /></div>
          <header>
            <div className="row">
              <h1 className="page-title">{g.nameFa}</h1>
              {g.isTestGame && <Badge tone="test" icon="alert">بازی آزمایشی</Badge>}
              {g.status === 'suspended' && <Badge tone="danger">متوقف‌شده</Badge>}
            </div>
            <p className="page-sub"><bdi>{g.nameOriginal}</bdi></p>
          </header>
          {g.isTestGame && (
            <div className="banner banner--info" role="note">
              این بازی اختصاصی و برای آزمون موتور بازی ساخته شده است؛ جزو فهرست نهایی بازی‌های عرضه نیست.
            </div>
          )}
          <p>{g.summaryFa}</p>
          <section className="section" aria-labelledby="rules-h">
            <h2 id="rules-h" className="section-title"><Icon name="book" />قوانین</h2>
            <RulesText lines={g.rulesFa} />
          </section>
          <section className="section" aria-labelledby="policy-h">
            <h2 id="policy-h" className="section-title"><Icon name="clock" />اتمام زمان و انصراف</h2>
            <p className="policy"><strong>اتمام زمان: </strong>{g.timeoutPolicyFa}</p>
            <p className="policy"><strong>انصراف: </strong>{g.resignPolicyFa}</p>
          </section>
          {g.options.length > 0 && (
            <section className="section" aria-labelledby="variants-h">
              <h2 id="variants-h" className="section-title"><Icon name="settings" />گزینه‌های قانون</h2>
              {g.options.map((o) => (
                <p key={o.key} className="policy"><strong>{o.labelFa}: </strong>
                  {o.hostChooses && o.choices.length > 1 ? `به انتخاب میزبان (${o.choices.map((c) => c.labelFa).join('، ')})` : o.choices.find((c) => c.value === o.default)?.labelFa}
                </p>
              ))}
            </section>
          )}
        </article>

        <aside className="panel stack" aria-label="مشخصات و شروع">
          <dl className="facts">
            <div><dt>تعداد نفر</dt><dd>{range(g.minPlayers, g.maxPlayers, 'نفر')}</dd></div>
            <div><dt>زمان</dt><dd>{range(g.minMinutes, g.maxMinutes, 'دقیقه')}</dd></div>
            <div><dt>دشواری</dt><dd>{DIFFICULTY_FA[g.difficulty]}</dd></div>
            <div><dt>دسترسی</dt><dd>{ACCESS_FA[g.access]}{g.access === 'premium' ? '، نیازمند اشتراک' : '، بدون اشتراک'}</dd></div>
            <div><dt>حالت‌ها</dt><dd>{g.paces.map((p) => PACE_FA[p]).join('، ')}</dd></div>
            <div><dt>نوع رقابت</dt><dd>{g.competitions.map((c) => COMPETITION_FA[c]).join('، ')}</dd></div>
          </dl>
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <h2 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>آموزش</h2>
            <p className="muted" style={{ margin: 0 }}>{g.tutorialFa}</p>
          </div>
          {g.activeVersion && <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>نسخه قوانین <bdi dir="ltr">{g.activeVersion.rulesVersion}</bdi></p>}
          {g.access === 'premium' && <div className="banner banner--info" role="note" style={{ margin: 0 }}>ساخت میز این بازی به اشتراک پریمیوم نیاز دارد. اگر میزبان پریمیوم باشد، دوستانی که دعوت می‌کند می‌توانند بدون اشتراک بازی کنند. <Link to="/plans">اشتراک</Link></div>}
          {!g.acceptingNewTables && <div className="banner banner--warn" role="status" style={{ margin: 0 }}>پذیرش میز جدید برای این بازی موقتاً متوقف است.</div>}
          {!me ? (
            <Link className="btn btn--primary btn--block" to={`/login?next=/games/${g.id}`}>برای بازی و آموزش وارد شوید</Link>
          ) : g.acceptingNewTables && (
            <>
              <Link className="btn btn--primary btn--block" to={`/games/${g.id}/new`}>ساخت میز</Link>
              <Link className="btn btn--secondary btn--block" to={`/play?game=${g.id}`}>حریف‌یابی سریع</Link>
              {g.tutorialEnabled && <Button variant="secondary" block busy={tutorialBusy} onClick={startTutorial} icon="book">
                {tutorialStatus === 'in_progress' ? 'ادامه آموزش تعاملی' : tutorialStatus === 'completed' ? 'اجرای دوباره آموزش' : 'آموزش تعاملی'}
              </Button>}
              {tutorialStatus === 'completed' && <p className="muted" style={{ margin: 0 }}>آموزش این بازی را کامل کرده‌اید.</p>}
              {tutorialError && <p className="field__error" role="alert" style={{ margin: 0 }}>{tutorialError}</p>}
              <Link className="btn btn--ghost btn--block" to="/tables">میزهای باز دیگران</Link>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
