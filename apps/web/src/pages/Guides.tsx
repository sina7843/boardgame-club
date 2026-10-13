import { Link } from 'react-router';
import { ONBOARDING_TOURS } from '@bg/contracts';
import { Badge, Button, Progress, StateBlock, buttonClass, cn, useToast } from '@bg/ui';
import { faNum, jalaliDate } from '../lib/format.ts';
import { Trophy } from '../lib/rewards.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { useOnboarding } from '../shell/Onboarding.tsx';

/** Every site guide in one place: start, continue, replay or skip; plus the «Getting Started» achievement status. */
export function GuidesPage() {
  usePageTitle('راهنما');
  const { me, status } = useSession();
  const { state, start, setDismissed } = useOnboarding();
  const toast = useToast();
  if (status === 'loading' || (me && !state)) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!me || !state) return <StateBlock kind="denied" title="برای دیدن آموزش‌ها وارد شوید" action={<Link className={buttonClass('primary', 'md')} to="/login?next=/guides">ورود</Link>} />;
  const doneCount = state.tours.filter((t) => t.completed).length;
  const granted = state.achievement.grantedAt;
  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">راهنما</h1><p className="page-sub">آموزش‌ها اختیاری‌اند؛ هر کدام را هر وقت خواستید اجرا یا دوباره اجرا کنید.</p></div>
      </div>
      <div className="stack" style={{ maxInlineSize: 760 }}>
        <section className={cn('panel guides-goal', granted && 'is-done')} aria-labelledby="goal-h">
          <span className="guides-goal__art"><Trophy tier="bronze" locked={!granted} /></span>
          <div className="stack" style={{ gap: '0.5rem', flex: 1 }}>
            <h2 id="goal-h" className="section-title">دستاورد <bdi>Getting Started</bdi></h2>
            {granted
              ? <p className="muted" style={{ margin: 0 }}>همهٔ آموزش‌ها را کامل کرده‌اید؛ این دستاورد {jalaliDate(granted)} به پروفایلتان اضافه شد.</p>
              : <Progress label="آموزش‌های کامل‌شده" value={doneCount} max={state.tours.length} valueText={`${faNum(doneCount)} از ${faNum(state.tours.length)}`} />}
          </div>
        </section>
        <ul className="guides-list">
          {ONBOARDING_TOURS.map((t) => {
            const s = state.tours.find((x) => x.key === t.key);
            const done = s?.completedSteps.length ?? 0;
            return (
              <li key={t.key} className="panel guides-item">
                <div className="row" style={{ gap: '0.5rem' }}>
                  <h2 className="section-title" style={{ fontSize: 'var(--fs-md)', flex: 1 }}>{t.titleFa}</h2>
                  <Badge>{t.kind === 'tour' ? 'تور معرفی' : 'آموزش عملی'}</Badge>
                  {s?.completed ? <Badge tone="success">کامل</Badge> : s?.dismissed && <Badge>رد شده</Badge>}
                </div>
                <p className="muted" style={{ margin: 0 }}>{t.summaryFa}</p>
                <ol className="guides-steps">
                  {t.steps.map((st) => <li key={st.key} className={cn(s?.completedSteps.includes(st.key) && 'is-done')}>{st.titleFa}</li>)}
                </ol>
                <div className="row" style={{ gap: '0.5rem' }}>
                  {s?.completed
                    ? <Button size="sm" variant="secondary" onClick={() => start(t.key, 'replay')}>اجرای دوباره</Button>
                    : <Button size="sm" onClick={() => start(t.key)}>{done ? `ادامه (${faNum(done)} از ${faNum(t.steps.length)})` : 'شروع'}</Button>}
                  {!s?.completed && !s?.dismissed && <Button size="sm" variant="ghost" onClick={() => setDismissed(t.key, true).catch(() => toast('error', 'ذخیره نشد؛ دوباره تلاش کنید.'))}>رد کردن</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
