import { ONBOARDING_TOURS } from '@bg/contracts';
import { Badge, Button, Card, PageHead, Progress, Skeleton, StateBlock, Trophy } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { useOnboarding } from '../shell/Onboarding.tsx';

/** Every site guide in one place: start, continue, replay or skip; plus the «Getting Started» achievement status. */
export function GuidesPage() {
  usePageTitle('راهنما');
  const { me, status } = useSession();
  const { state, start, setDismissed } = useOnboarding();
  const toast = useToast();
  if (status === 'loading' || (me && !state)) return <><Skeleton height={200} radius="var(--radius-lg)" /><span className="pg-sr" role="status">در حال بارگذاری…</span></>;
  if (!me || !state) return <StateBlock kind="denied" title="برای دیدن آموزش‌ها وارد شوید" action={<Button variant="primary" href="/login?next=/guides">ورود</Button>} />;
  const doneCount = state.tours.filter((t) => t.completed).length;
  const granted = state.achievement.grantedAt;
  return (
    <>
      <PageHead title="راهنما" sub="آموزش‌ها اختیاری‌اند؛ هر کدام را هر وقت خواستید اجرا یا دوباره اجرا کنید." />
      <div className="pg-stack" style={{ maxInlineSize: 760 }}>
        <Card aria-labelledby="goal-h">
          <div className="bgv-row" style={{ gap: 'var(--space-4)' }}>
            <Trophy tier="bronze" locked={!granted} icon="sparkles" />
            <div className="pg-stack" style={{ flex: 1 }}>
              <h2 id="goal-h" className="pg-h2">دستاورد <bdi>Getting Started</bdi></h2>
              {granted
                ? <p className="bgv-muted" style={{ margin: 0 }}>همهٔ آموزش‌ها را کامل کرده‌اید؛ این دستاورد {jalaliDate(granted)} به پروفایلتان اضافه شد.</p>
                : <Progress label="آموزش‌های کامل‌شده" value={state.tours.length ? doneCount / state.tours.length : 0} valueText={`${faNum(doneCount)} از ${faNum(state.tours.length)}`} />}
            </div>
          </div>
        </Card>
        <ul className="pg-ul pg-stack">
          {ONBOARDING_TOURS.map((t) => {
            const s = state.tours.find((x) => x.key === t.key);
            const done = s?.completedSteps.length ?? 0;
            return (
              <li key={t.key}>
                <Card>
                  <div className="pg-stack">
                    <div className="bgv-row" style={{ flexWrap: 'wrap' }}>
                      <h2 className="pg-h2" style={{ flex: 1 }}>{t.titleFa}</h2>
                      <Badge icon={t.kind === 'tour' ? 'map' : 'book-open'}>{t.kind === 'tour' ? 'تور معرفی' : 'آموزش عملی'}</Badge>
                      {s?.completed ? <Badge tone="success" icon="circle-check">کامل</Badge> : s?.dismissed && <Badge>رد شده</Badge>}
                    </div>
                    <p className="bgv-muted" style={{ margin: 0 }}>{t.summaryFa}</p>
                    <ol className="pg-steps">
                      {t.steps.map((st) => <li key={st.key} className={s?.completedSteps.includes(st.key) ? 'is-done' : undefined}>{st.titleFa}</li>)}
                    </ol>
                    <div className="pg-actions">
                      {s?.completed
                        ? <Button size="sm" icon="rotate-ccw" onClick={() => start(t.key, 'replay')}>اجرای دوباره</Button>
                        : <Button size="sm" variant="primary" icon="play" onClick={() => start(t.key)}>{done ? `ادامه (${faNum(done)} از ${faNum(t.steps.length)})` : 'شروع'}</Button>}
                      {!s?.completed && !s?.dismissed && <Button size="sm" variant="ghost" onClick={() => setDismissed(t.key, true).catch(() => toast('error', 'ذخیره نشد؛ دوباره تلاش کنید.'))}>رد کردن</Button>}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
