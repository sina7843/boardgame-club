import { Link } from 'react-router';
import type { Progression } from '@bg/contracts';
import { Badge, Button, LeagueBadge, Progress, StateBlock } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate, PACE_FA } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';

export const ruleFa = (ruleId: string) => (ruleId.startsWith('mission.') ? 'مأموریت' : ruleId.startsWith('achievement.') ? 'دستاورد'
  : { 'xp.match_completed': 'بازی کامل', 'xp.first_place': 'رتبه اول', 'xp.new_title': 'عنوان تازه', 'xp.tutorial': 'آموزش', 'season.badge': 'نشان فصل', manual: 'پاداش دستی' }[ruleId] ?? ruleId);

/** Three separate kinds of progress (Requirements §12): skill per game, account level from XP, and mastery per game. */
export function ProgressPage() {
  usePageTitle('پیشرفت');
  const p = useApi<Progression>('/me/progression');
  const games = useApi<{ items: { id: string; nameFa: string }[] }>('/games');
  if (p.error) return <StateBlock kind={p.error.status === 401 ? 'denied' : 'error'} title={p.error.status === 401 ? 'برای دیدن پیشرفت وارد شوید' : 'پیشرفت دریافت نشد'} action={p.error.status === 401 ? <Link className="btn btn--primary" to="/login?next=/progress">ورود</Link> : <Button onClick={p.reload}>تلاش دوباره</Button>} />;
  if (!p.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = p.data;
  const gameName = (id: string) => games.data?.items.find((g) => g.id === id)?.nameFa ?? id;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">پیشرفت</h1><p className="page-sub">مهارت، سطح حساب و تسلط هر بازی جدا از هم سنجیده می‌شوند؛ XP و دستاورد روی رتبه اثر ندارند.</p></div></div>
      <div className="progress-grid">
        <section className="panel stack" aria-labelledby="lvl-h">
          <h2 id="lvl-h" className="section-title">سطح حساب</h2>
          <div className="row"><strong style={{ fontSize: 'var(--fs-2xl)' }}>سطح {faNum(d.level)}</strong><span className="muted">{faNum(d.xp)} XP</span></div>
          <Progress label="تا سطح بعد" value={d.xp - d.levelFloor} max={d.nextLevelAt - d.levelFloor} valueText={`${faNum(d.xp - d.levelFloor)} از ${faNum(d.nextLevelAt - d.levelFloor)}`} />
        </section>

        <section className="panel stack" aria-labelledby="skill-h">
          <h2 id="skill-h" className="section-title">مهارت (رتبه‌دار)</h2>
          {d.season && <p className="muted" style={{ margin: 0 }}>فصل فعال: {d.season.nameFa} — تا {jalaliDate(d.season.endsAt)}</p>}
          {d.ratings.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز بازی رتبه‌داری نکرده‌اید. از <Link to="/play">حریف‌یابی</Link> «رتبه‌دار» را انتخاب کنید.</p> : (
            <ul className="list">{d.ratings.map((r) => (
              <li key={`${r.gameId}-${r.mode}`} className="list__item list__item--compact">
                <span style={{ flex: 1 }}>{gameName(r.gameId)} · {PACE_FA[r.mode]}</span>
                <strong className="num">{faNum(r.display)}</strong>
                {r.provisional && <Badge>موقت ({faNum(r.games)} بازی)</Badge>}
                {r.league && <LeagueBadge league={r.league} />}
              </li>))}</ul>
          )}
          <Link to="/ranking">جدول رتبه‌بندی و سابقه</Link>
        </section>

        <section className="panel stack" aria-labelledby="mastery-h">
          <h2 id="mastery-h" className="section-title">تسلط بر بازی‌ها</h2>
          <ul className="list">{d.mastery.map((m) => (
            <li key={m.gameId} className="list__item list__item--compact">
              <span style={{ flex: 1 }}>{m.gameNameFa}</span><Badge tone={m.tier === 'master' ? 'premium' : undefined}>{m.tierFa}</Badge>
              <span className="muted">{faNum(m.completed)} بازی · {faNum(m.wins)} اول · {faNum(m.ranked)} رتبه‌دار{m.tutorial ? ' · آموزش ✓' : ''}</span>
            </li>))}</ul>
        </section>

        <section className="panel stack" aria-labelledby="missions-h">
          <h2 id="missions-h" className="section-title">مأموریت‌های این هفته</h2>
          <p className="muted" style={{ margin: 0 }}>تا {jalaliDate(d.missions.endsAt)} — هیچ مأموریتی برد اجباری ندارد.</p>
          {d.missions.items.map((m) => (
            <div key={m.key} className="stack" style={{ gap: 'var(--sp-1)' }}>
              <div className="row"><strong style={{ flex: 1 }}>{m.titleFa}</strong>{m.completed ? <Badge tone="success">کامل (+{faNum(m.xp)} XP)</Badge> : <span className="muted">+{faNum(m.xp)} XP</span>}</div>
              <span className="muted">{m.descriptionFa}</span>
              <Progress label={m.titleFa} value={m.progress} max={m.target} valueText={`${faNum(m.progress)} از ${faNum(m.target)}`} />
            </div>
          ))}
        </section>

        <section className="panel stack" aria-labelledby="ach-h">
          <h2 id="ach-h" className="section-title">دستاوردها</h2>
          <ul className="achievements">{d.achievements.map((a) => (
            <li key={a.key} className={a.grantedAt ? 'ach ach--on' : 'ach'}>
              <strong>{a.titleFa}</strong><span className="muted">{a.descriptionFa}</span>
              <span className="muted">{a.grantedAt ? `کسب‌شده ${jalaliDate(a.grantedAt)}` : 'هنوز کسب نشده'}</span>
            </li>))}</ul>
        </section>

        <section className="panel stack" aria-labelledby="ledger-h">
          <h2 id="ledger-h" className="section-title">پاداش‌های اخیر و دلیل آن‌ها</h2>
          {d.ledger.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز پاداشی ثبت نشده است. بازی کامل، آموزش و مأموریت XP می‌دهند.</p> : (
            <ul className="list">{d.ledger.map((l, i) => (
              <li key={i} className="list__item list__item--compact">
                <Badge>{ruleFa(l.ruleId)}</Badge><span style={{ flex: 1 }}>{l.reason}</span>
                <strong className="num">{l.amount > 0 ? `+${faNum(l.amount)}` : faNum(l.amount)}</strong>
              </li>))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
