import { useState, type ReactNode } from 'react';
import type { Progression } from '@bg/contracts';
import { Badge, Button, Card, League, ListItem, PageHead, Progress, Ring, StateBlock, Trophy } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate, PACE_FA } from '../lib/format.ts';
import { TIER_FA } from '../lib/rewards.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { Hint } from '../shell/Onboarding.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

export const ruleFa = (ruleId: string) => (ruleId.startsWith('mission.') ? 'مأموریت' : ruleId.startsWith('achievement.') ? 'دستاورد'
  : { 'xp.match_completed': 'بازی کامل', 'xp.first_place': 'رتبه اول', 'xp.bot_match': 'بازی با ربات', 'xp.bot_win': 'برد مقابل ربات', 'xp.new_title': 'عنوان تازه', 'xp.tutorial': 'آموزش', 'season.badge': 'نشان فصل', manual: 'پاداش دستی' }[ruleId] ?? ruleId);

const MASTERY_ORDER = ['new', 'learner', 'player', 'seasoned', 'master'];

/** First `limit` items, plus a toggle for the rest, so one long section never stretches the whole page. */
function Clamped<T>({ items, limit, children }: { items: T[]; limit: number; children: (shown: T[]) => ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <>
      {children(all ? items : items.slice(0, limit))}
      {items.length > limit && <div><Button variant="ghost" size="sm" onClick={() => setAll(!all)} aria-expanded={all}>
        {all ? 'نمایش کمتر' : `نمایش همه (${faNum(items.length)})`}</Button></div>}
    </>
  );
}

/** Three separate kinds of progress (Requirements §12): skill per game, account level from XP, and mastery per game. */
export function ProgressPage() {
  usePageTitle('پیشرفت');
  const p = useApi<Progression>('/me/progression');
  const games = useApi<{ items: { id: string; nameFa: string }[] }>('/games');
  if (p.error) return <StateBlock kind={p.error.status === 401 ? 'denied' : 'error'} title={p.error.status === 401 ? 'برای دیدن پیشرفت وارد شوید' : 'پیشرفت دریافت نشد'} action={p.error.status === 401 ? <Button variant="primary" href="/login?next=/progress">ورود</Button> : <Button variant="primary" onClick={p.reload}>تلاش دوباره</Button>} />;
  if (!p.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = p.data;
  const gameName = (id: string) => games.data?.items.find((g) => g.id === id)?.nameFa ?? id;
  // Every active game has a mastery row; only the ones actually played are worth a line, best first.
  const played = d.mastery.filter((m) => m.tier !== 'new')
    .sort((a, b) => MASTERY_ORDER.indexOf(b.tier) - MASTERY_ORDER.indexOf(a.tier) || b.completed - a.completed);
  const earned = d.achievements.filter((a) => a.grantedAt).length;
  // Earned first (track order kept), then the locked ones closest to done.
  const ratio = (a: (typeof d.achievements)[number]) => a.progress / Math.max(1, a.target);
  const earnedFirst = [...d.achievements].sort((a, b) => Number(!a.grantedAt) - Number(!b.grantedAt) || (a.grantedAt ? 0 : ratio(b) - ratio(a)));
  const span = Math.max(1, d.nextLevelAt - d.levelFloor);
  const into = d.xp - d.levelFloor;
  return (
    <>
      <PageTabs group="progress" />
      <PageHead title="پیشرفت" sub="مهارت، سطح حساب و تسلط هر بازی جدا از هم سنجیده می‌شوند؛ XP و دستاورد روی رتبه اثر ندارند." />
      <div className="pf-prog">
        <Card title="سطح حساب">
          <div className="bgv-stack">
            <div className="pf-level">
              <div className="bgv-stack" style={{ gap: 'var(--space-1)' }}>
                <strong className="t-h3">سطح {faNum(d.level)}</strong>
                <span className="t-caption bgv-muted"><bdi>{faNum(d.xp)}</bdi> XP</span>
              </div>
              <Ring value={into / span} size={88} tone="accent" label="تا سطح بعد"><b className="t-num-lg">{faNum(d.level)}</b></Ring>
            </div>
            <Progress label="تا سطح بعد" tone="accent" value={into / span} valueText={`${faNum(into)} از ${faNum(span)}`} />
          </div>
        </Card>

        <Card title="مأموریت‌های این هفته">
          <div className="bgv-stack">
            <div className="bgv-row"><Badge icon="calendar">تا {jalaliDate(d.missions.endsAt)}</Badge><Hint id="missions">هر شنبه مأموریت‌های تازه می‌آید. با کامل کردن میزها (حتی با باخت) پیش می‌روند و XP می‌دهند.</Hint></div>
            <p className="t-body-sm bgv-muted">هیچ مأموریتی برد اجباری ندارد.</p>
            {d.missions.items.map((m) => (
              <div key={m.key} className="bgv-stack" style={{ gap: 'var(--space-1)' }}>
                <div className="bgv-row"><strong style={{ flex: 1 }}>{m.titleFa}</strong>
                  {m.completed ? <Badge tone="success" icon="check">کامل (+{faNum(m.xp)} XP)</Badge> : <span className="t-caption bgv-muted">+{faNum(m.xp)} XP</span>}</div>
                <span className="t-caption bgv-muted">{m.descriptionFa}</span>
                <Progress label={m.titleFa} value={m.progress / Math.max(1, m.target)} valueText={`${faNum(m.progress)} از ${faNum(m.target)}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="pf-wide" title="دستاوردها"
          actions={<span className="bgv-row"><span className="t-caption bgv-muted">{faNum(earned)} از {faNum(d.achievements.length)} جام</span><Hint id="achievements">جام‌ها خودکار و فقط از نتیجهٔ واقعی بازی‌ها و آموزش‌ها داده می‌شوند و روی پروفایل شما دیده می‌شوند.</Hint></span>}>
          <div className="bgv-stack">
            {/* Every earned trophy, then the next few locked ones; the rest behind the toggle. */}
            <Clamped items={earnedFirst} limit={earned + 4}>{(shown) => (
              <ul className="pf-ach">{shown.map((a) => (
                <li key={a.key}>
                  <Trophy tier={a.tier} locked={!a.grantedAt} name={a.titleFa} sub={TIER_FA[a.tier]} />
                  <span className="t-caption bgv-muted">{a.descriptionFa}</span>
                  {a.grantedAt ? <Badge tone="success" icon="check">کسب‌شده {jalaliDate(a.grantedAt)}</Badge> : (
                    <Progress label={`پیشرفت ${a.titleFa}`} value={ratio(a)} valueText={`${faNum(a.progress)} / ${faNum(a.target)}`} />
                  )}
                </li>))}</ul>)}
            </Clamped>
          </div>
        </Card>

        <Card title="مهارت (رتبه‌دار)">
          <div className="bgv-stack">
            {d.season && <p className="t-body-sm bgv-muted">فصل فعال: {d.season.nameFa}، تا {jalaliDate(d.season.endsAt)}</p>}
            {d.ratings.length === 0 ? <p className="bgv-muted">هنوز بازی رتبه‌داری نکرده‌اید. از <a href="/play">حریف‌یابی</a> «رتبه‌دار» را انتخاب کنید.</p> : (
              <Clamped items={d.ratings} limit={6}>{(shown) => (
                <div>{shown.map((r) => (
                  <ListItem key={`${r.gameId}-${r.mode}`} title={<>{gameName(r.gameId)}<span className="bgv-sep" />{PACE_FA[r.mode]}</>}
                    sub={r.provisional ? <Badge size="sm">موقت ({faNum(r.games)} بازی)</Badge> : undefined}
                    trailing={<span className="bgv-row">{r.league && <League tier={r.league} />}<strong className="bgv-num">{faNum(r.display)}</strong></span>} />))}</div>)}
              </Clamped>
            )}
            <a href="/ranking">جدول رتبه‌بندی و سابقه</a>
          </div>
        </Card>

        <Card title="تسلط بر بازی‌ها" actions={<span className="t-caption bgv-muted">{faNum(played.length)} از {faNum(d.mastery.length)} بازی</span>}>
          <div className="bgv-stack">
            {played.length === 0 ? <p className="bgv-muted">هنوز بازی‌ای را تمام نکرده‌اید. با آموزش یا اولین بازی، تسلط شروع می‌شود. <a href="/games">دیدن بازی‌ها</a></p> : (
              <Clamped items={played} limit={8}>{(shown) => (
                <div>{shown.map((m) => (
                  <ListItem key={m.gameId} title={m.gameNameFa}
                    sub={<>{faNum(m.completed)} بازی<span className="bgv-sep" />{faNum(m.wins)} اول<span className="bgv-sep" />{faNum(m.ranked)} رتبه‌دار{m.tutorial ? <><span className="bgv-sep" />آموزش ✓</> : null}</>}
                    trailing={<Badge tone={m.tier === 'master' ? 'premium' : 'neutral'}>{m.tierFa}</Badge>} />))}</div>)}
              </Clamped>
            )}
          </div>
        </Card>

        <Card className="pf-wide" title="پاداش‌های اخیر و دلیل آن‌ها">
          <div className="bgv-stack">
            {d.ledger.length === 0 ? <p className="bgv-muted">هنوز پاداشی ثبت نشده است. بازی کامل، آموزش و مأموریت XP می‌دهند.</p> : (
              <Clamped items={d.ledger} limit={8}>{(shown) => (
                <div>{shown.map((l, i) => (
                  <ListItem key={i} title={l.reason} sub={<Badge size="sm">{ruleFa(l.ruleId)}</Badge>}
                    trailing={<strong className="bgv-num" dir="ltr">{l.amount > 0 ? `+${faNum(l.amount)}` : faNum(l.amount)}</strong>} />))}</div>)}
              </Clamped>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
