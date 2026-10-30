import { useState, type ReactNode } from 'react';
import { LEVEL_UP_COINS, RATING_MODE_FA, type Progression } from '@bg/contracts';
import { Badge, Button, Icon, League, PageHead, Progress, Reward, Ring, Segmented, StateBlock, Trophy } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate, remainingFa } from '../lib/format.ts';
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
  const [achFilter, setAchFilter] = useState<'all' | 'earned' | 'near'>('all');
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
  // The season card shows the best-placed ranked game (Progress-Desktop); the full list lives on /ranking.
  const top = [...d.ratings].sort((a, b) => b.display - a.display)[0];
  return (
    <>
      <PageTabs group="progress" />
      <PageHead className="app-hide-phone" title="پیشرفت" sub="مهارت، سطح حساب و تسلط هر بازی جدا از هم سنجیده می‌شوند؛ XP و دستاورد روی رتبه اثر ندارند." />
      <div className="pf-prog3">
        <section className="bgv-card pf-pcard" aria-label="سطح حساب">
          <div className="pf-level">
            <Ring value={into / span} size={84} label="تا سطح بعد"><b className="t-num-lg">{faNum(d.level)}</b></Ring>
            <div className="pf-level__text"><span className="t-caption bgv-muted">سطح حساب</span>
              <b className="t-title pf-level__n">سطح {faNum(d.level)}</b>
              <span className="t-caption bgv-muted bgv-num"><bdi>{faNum(d.xp)} XP</bdi></span></div>
          </div>
          <Progress label={`تا سطح ${faNum(d.level + 1)}`} tone="accent" value={into / span} valueText={`${faNum(into)} از ${faNum(span)}`} />
          <Reward coin label={`پاداش سطح ${faNum(d.level + 1)}`} value={faNum((d.level + 1) * LEVEL_UP_COINS)} unit="سکه" />
        </section>

        <section className="bgv-card pf-pcard" aria-labelledby="ms-h">
          <div className="bgv-row"><h2 id="ms-h" className="pf-h2">مأموریت‌های این هفته</h2>
            <Badge icon="calendar">تا {jalaliDate(d.missions.endsAt)}</Badge>
            <Hint id="missions">هر شنبه مأموریت‌های تازه می‌آید. با کامل کردن میزها (حتی با باخت) پیش می‌روند و XP می‌دهند؛ هیچ‌کدام برد اجباری ندارد.</Hint></div>
          {d.missions.items.map((m) => (
            <div key={m.key} className="pf-mission" title={m.descriptionFa}>
              <div className="bgv-row pf-mission__head"><b>{m.titleFa}</b>
                {m.completed ? <Badge tone="success" icon="check">کامل</Badge> : <span className="t-caption bgv-num pf-mission__xp"><bdi dir="ltr">+{faNum(m.xp)} XP</bdi></span>}</div>
              <div className="pf-mission__bar"><Progress aria-label={m.titleFa} value={m.progress / Math.max(1, m.target)} />
                <span className="t-caption bgv-muted bgv-num">{faNum(m.progress)} از {faNum(m.target)}</span></div>
            </div>
          ))}
        </section>

        <section className="bgv-card pf-pcard" aria-labelledby="season-h">
          <div className="bgv-row"><h2 id="season-h" className="pf-h2">{d.season?.nameFa ?? 'مهارت (رتبه‌دار)'}</h2>
            {d.season && <Badge icon="clock">{remainingFa(d.season.endsAt)} مانده</Badge>}</div>
          {top ? (
            <div className="pf-seasontop">
              <img src={`/covers/${top.gameId}.webp`} alt="" loading="lazy" />
              <div className="pf-seasontop__text"><b>{gameName(top.gameId)}، {RATING_MODE_FA[top.mode]}</b>
                <span className="t-caption bgv-muted bgv-row">{top.league && <League tier={top.league} />}{top.provisional ? `موقت، ${faNum(top.games)} بازی` : `${faNum(top.games)} بازی`}</span></div>
              <b className="t-num-lg bgv-num pf-seasontop__n">{faNum(top.display)}</b>
            </div>
          ) : <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>هنوز بازی رتبه‌داری نکرده‌اید. در «بازی سریع» حالت «رتبه‌دار» را انتخاب کنید.</p>}
          {d.ratings.length > 1 && <span className="t-caption bgv-muted">و {faNum(d.ratings.length - 1)} بازی رتبه‌دار دیگر</span>}
          <a href={top ? `/ranking?game=${top.gameId}` : '/ranking'} className="t-label">جدول رتبه‌بندی{top ? ` ${gameName(top.gameId)}` : ''}</a>
        </section>
      </div>

      <section className="bgv-card pf-pcard" aria-labelledby="ach-h">
        <div className="bgv-row pf-achhead"><h2 id="ach-h" className="pf-h2">دستاوردها</h2>
          <span className="t-caption bgv-muted">{faNum(earned)} از {faNum(d.achievements.length)} جام</span>
          <Hint id="achievements">جام‌ها خودکار و فقط از نتیجهٔ واقعی بازی‌ها و آموزش‌ها داده می‌شوند و روی پروفایل شما دیده می‌شوند.</Hint>
          <Segmented label="فیلتر دستاوردها" value={achFilter} onChange={(v) => setAchFilter(v as typeof achFilter)}
            options={[{ value: 'all', label: 'همه' }, { value: 'earned', label: 'کسب‌شده' }, { value: 'near', label: 'نزدیک به کسب' }]} /></div>
        {/* Every earned trophy, then the next few locked ones; the rest behind the toggle. */}
        <Clamped items={achFilter === 'all' ? earnedFirst : achFilter === 'earned' ? earnedFirst.filter((a) => a.grantedAt) : earnedFirst.filter((a) => !a.grantedAt && ratio(a) >= 0.5)}
          limit={achFilter === 'all' ? earned + 6 : 12}>{(shown) => (
          <ul className="pf-ach">{shown.map((a) => (
            <li key={a.key} className={a.grantedAt ? 'pf-achtile' : 'pf-achtile is-locked'}>
              <div className="pf-achtile__head">
                <Trophy tier={a.tier} locked={!a.grantedAt} />
                <div className="pf-achtile__name"><span className="t-micro">{TIER_FA[a.tier]}</span><b>{a.titleFa}</b></div>
              </div>
              <span className="t-caption bgv-muted">{a.descriptionFa}</span>
              {a.grantedAt ? <span className="t-caption pf-achtile__got"><Icon name="circle-check" size="sm" />کسب‌شده {jalaliDate(a.grantedAt)}</span> : (
                <div className="pf-mission__bar"><Progress aria-label={`پیشرفت ${a.titleFa}`} value={ratio(a)} />
                  <span className="t-caption bgv-muted bgv-num">{faNum(a.progress)} از {faNum(a.target)}</span></div>
              )}
            </li>))}</ul>)}
        </Clamped>
      </section>

      <div className="pf-prog2">
        <section className="bgv-card pf-pcard" aria-labelledby="mastery-h">
          <div className="bgv-row"><h2 id="mastery-h" className="pf-h2">تسلط بر بازی‌ها</h2>
            <span className="t-caption bgv-muted">{faNum(played.length)} از {faNum(d.mastery.length)} بازی</span></div>
          {played.length === 0 ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>هنوز بازی‌ای را تمام نکرده‌اید. با آموزش یا اولین بازی، تسلط شروع می‌شود. <a href="/games">دیدن بازی‌ها</a></p> : (
            <Clamped items={played} limit={6}>{(shown) => (
              <ul className="pf-ul pf-rows">{shown.map((m) => (
                <li key={m.gameId} className="pf-mrow">
                  <img src={`/covers/${m.gameId}.webp`} alt="" loading="lazy" />
                  <div className="pf-mrow__text"><b>{m.gameNameFa}</b>
                    <span className="t-caption bgv-muted">{faNum(m.completed)} بازی<span className="bgv-sep" />{faNum(m.wins)} اول<span className="bgv-sep" />{faNum(m.ranked)} رتبه‌دار{m.tutorial ? <><span className="bgv-sep" />آموزش ✓</> : null}</span></div>
                  <Badge tone={m.tier === 'master' ? 'premium' : m.tier === 'seasoned' ? 'success' : 'neutral'}>{m.tierFa}</Badge>
                </li>))}</ul>)}
            </Clamped>
          )}
        </section>

        <section className="bgv-card pf-pcard" aria-labelledby="ledger-h">
          <div className="bgv-row"><h2 id="ledger-h" className="pf-h2">پاداش‌های اخیر و دلیل آن‌ها</h2></div>
          {d.ledger.length === 0 ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>هنوز پاداشی ثبت نشده است. بازی کامل، آموزش و مأموریت XP می‌دهند.</p> : (
            <Clamped items={d.ledger} limit={6}>{(shown) => (
              <ul className="pf-ul pf-rows">{shown.map((l, i) => (
                <li key={i} className="pf-lrow">
                  <Badge size="sm">{ruleFa(l.ruleId)}</Badge>
                  <div className="pf-mrow__text"><span>{l.reason}</span><span className="t-caption bgv-muted">{jalaliDate(l.createdAt)}</span></div>
                  <b className="bgv-num" dir="ltr">{l.amount > 0 ? `+${faNum(l.amount)}` : faNum(l.amount)}{l.kind === 'xp' ? ' XP' : ''}</b>
                </li>))}</ul>)}
            </Clamped>
          )}
        </section>
      </div>
    </>
  );
}
