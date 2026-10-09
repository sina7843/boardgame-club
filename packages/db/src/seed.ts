// Idempotent seed: publishes the reviewed registry games (labelled test games) to the catalog.
import { and, eq, sql } from 'drizzle-orm';
import { normalizeSearch } from '@bg/contracts';
import { createDb, type Db } from './index.ts';
import { requireDatabaseUrl } from './env.ts';
import { gameRegistry } from './registry.ts';
import { achievementDefinitions, games, gameVersions, missionDefinitions, plans } from './schema.ts';

/** Versioned reward definitions (docs/PROGRESSION.md). Criteria are evaluated only from server events. */
export const MISSIONS = [
  { key: 'weekly_complete_3', titleFa: 'سه میز کامل', descriptionFa: 'این هفته سه بازی را تا پایان کامل کنید (برد لازم نیست).', criteria: { type: 'complete_tables', count: 3, xp: 50 } },
  { key: 'weekly_two_games', titleFa: 'تنوع', descriptionFa: 'این هفته دو بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 2, xp: 40 } },
  { key: 'weekly_learn', titleFa: 'یک بازی تازه یاد بگیر', descriptionFa: 'آموزش یک بازی را کامل کنید یا اولین بازی‌تان را در عنوانی تازه تمام کنید.', criteria: { type: 'learn_new_game', count: 1, xp: 40 } }
];
/** Achievements: `tier` (bronze → diamond) is presentation only and picks the trophy art; evaluation reads type + count. */
export const ACHIEVEMENTS = [
  { key: 'first_game', titleFa: 'اولین میز', descriptionFa: 'اولین بازی کامل.', criteria: { type: 'matches', count: 1, tier: 'bronze' } },
  { key: 'warm_up', titleFa: 'گرم‌کردن', descriptionFa: 'پنج بازی کامل.', criteria: { type: 'matches', count: 5, tier: 'bronze' } },
  { key: 'regular', titleFa: 'پای ثابت', descriptionFa: 'بیست بازی کامل.', criteria: { type: 'matches', count: 20, tier: 'silver' } },
  { key: 'veteran', titleFa: 'کهنه‌کار', descriptionFa: 'پنجاه بازی کامل.', criteria: { type: 'matches', count: 50, tier: 'gold' } },
  { key: 'centurion', titleFa: 'صدتایی', descriptionFa: 'صد بازی کامل.', criteria: { type: 'matches', count: 100, tier: 'turquoise' } },
  { key: 'table_legend', titleFa: 'افسانهٔ میزها', descriptionFa: 'دویست‌وپنجاه بازی کامل.', criteria: { type: 'matches', count: 250, tier: 'diamond' } },
  { key: 'first_win', titleFa: 'اولین برد', descriptionFa: 'اولین رتبه اول.', criteria: { type: 'wins', count: 1, tier: 'bronze' } },
  { key: 'hat_trick', titleFa: 'هت‌تریک', descriptionFa: 'سه بار رتبه اول.', criteria: { type: 'wins', count: 3, tier: 'bronze' } },
  { key: 'winner_10', titleFa: 'برنده', descriptionFa: 'ده بار رتبه اول.', criteria: { type: 'wins', count: 10, tier: 'silver' } },
  { key: 'winner_25', titleFa: 'قهرمان میز', descriptionFa: 'بیست‌وپنج بار رتبه اول.', criteria: { type: 'wins', count: 25, tier: 'gold' } },
  { key: 'winner_50', titleFa: 'پهلوان', descriptionFa: 'پنجاه بار رتبه اول.', criteria: { type: 'wins', count: 50, tier: 'turquoise' } },
  { key: 'winner_100', titleFa: 'رستم دستان', descriptionFa: 'صد بار رتبه اول.', criteria: { type: 'wins', count: 100, tier: 'diamond' } },
  { key: 'explorer', titleFa: 'کاوشگر', descriptionFa: 'دو بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 2, tier: 'bronze' } },
  { key: 'traveler', titleFa: 'جهانگرد', descriptionFa: 'پنج بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 5, tier: 'silver' } },
  { key: 'collector', titleFa: 'کلکسیونر', descriptionFa: 'ده بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 10, tier: 'gold' } },
  { key: 'encyclopedia', titleFa: 'دانشنامه', descriptionFa: 'بیست بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 20, tier: 'turquoise' } },
  { key: 'polymath', titleFa: 'همه‌فن‌حریف', descriptionFa: 'چهل بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 40, tier: 'diamond' } },
  { key: 'first_lesson', titleFa: 'کلاس اول', descriptionFa: 'آموزش یک بازی را کامل کنید.', criteria: { type: 'tutorials', count: 1, tier: 'bronze' } },
  { key: 'graduate', titleFa: 'شاگرد ممتاز', descriptionFa: 'آموزش دو بازی را کامل کنید.', criteria: { type: 'tutorials', count: 2, tier: 'silver' } },
  { key: 'scholar', titleFa: 'دانش‌پژوه', descriptionFa: 'آموزش پنج بازی را کامل کنید.', criteria: { type: 'tutorials', count: 5, tier: 'gold' } },
  { key: 'professor', titleFa: 'استاد دانشگاه', descriptionFa: 'آموزش ده بازی را کامل کنید.', criteria: { type: 'tutorials', count: 10, tier: 'turquoise' } },
  { key: 'sage', titleFa: 'حکیم', descriptionFa: 'آموزش بیست‌وپنج بازی را کامل کنید.', criteria: { type: 'tutorials', count: 25, tier: 'diamond' } },
  { key: 'ranked_debut', titleFa: 'ورود به رقابت', descriptionFa: 'اولین بازی رتبه‌دار.', criteria: { type: 'ranked', count: 1, tier: 'bronze' } },
  { key: 'contender', titleFa: 'مدعی', descriptionFa: 'ده بازی رتبه‌دار.', criteria: { type: 'ranked', count: 10, tier: 'silver' } },
  { key: 'gladiator', titleFa: 'گلادیاتور', descriptionFa: 'بیست‌وپنج بازی رتبه‌دار.', criteria: { type: 'ranked', count: 25, tier: 'gold' } },
  { key: 'champion', titleFa: 'سردار', descriptionFa: 'پنجاه بازی رتبه‌دار.', criteria: { type: 'ranked', count: 50, tier: 'turquoise' } },
  { key: 'grandmaster', titleFa: 'استاد بزرگ', descriptionFa: 'صد بازی رتبه‌دار.', criteria: { type: 'ranked', count: 100, tier: 'diamond' } }
];

export async function seed(db: Db): Promise<void> {
  // Plans: prices are a product decision and stay null (checkout disabled) until an admin sets them.
  await db.insert(plans).values([
    { key: 'premium-monthly', titleFa: 'پریمیوم ماهانه', period: 'monthly', durationDays: 30,
      termsFa: 'دسترسی پریمیوم به مدت ۳۰ روز از زمان تأیید پرداخت. تمدید خودکار ندارد؛ برای ادامه دوباره خرید کنید. خرید دوباره از پایان دوره فعلی ادامه می‌یابد.' },
    { key: 'premium-yearly', titleFa: 'پریمیوم سالانه', period: 'yearly', durationDays: 365,
      termsFa: 'دسترسی پریمیوم به مدت ۳۶۵ روز از زمان تأیید پرداخت. تمدید خودکار ندارد. پریمیوم امتیاز مهارتی، اولویت صف یا کمک حین بازی نمی‌دهد.' }
  ]).onConflictDoNothing({ target: plans.key });
  await db.insert(missionDefinitions).values(MISSIONS.map((m) => ({ ...m, ruleVersion: 1, period: 'weekly', active: true }))).onConflictDoNothing();
  // Same key + version keeps its count; re-seeding refreshes copy and tier on databases seeded before tiers existed.
  await db.insert(achievementDefinitions).values(ACHIEVEMENTS.map((a) => ({ ...a, ruleVersion: 1 })))
    .onConflictDoUpdate({ target: [achievementDefinitions.key, achievementDefinitions.ruleVersion],
      set: { titleFa: sql`excluded.title_fa`, descriptionFa: sql`excluded.description_fa`, criteria: sql`excluded.criteria` } });

  for (const { manifest: m, catalog: c } of gameRegistry) {
    const row = {
      id: m.gameId,
      nameFa: c.nameFa,
      nameOriginal: c.nameOriginal,
      searchText: normalizeSearch(`${c.nameFa} ${c.nameOriginal}`),
      summaryFa: c.summaryFa,
      rulesFa: c.rulesFa,
      minPlayers: m.playerCounts.min,
      maxPlayers: m.playerCounts.max,
      minMinutes: c.minutes.min,
      maxMinutes: c.minutes.max,
      difficulty: c.difficulty,
      access: c.access,
      paces: m.supportedModes.pace,
      competitions: m.supportedModes.competition,
      isTestGame: c.isTestGame,
      timeoutPolicyFa: c.timeoutPolicyFa,
      resignPolicyFa: c.resignPolicyFa,
      tutorialFa: c.tutorialFa
    };
    await db.transaction(async (tx) => {
      // Admin-owned product choices (status, access, modes, player range, play settings) are written only on first
      // insert; re-seeding refreshes content and only narrows those choices to what the module still supports.
      const [prev] = await tx.select().from(games).where(eq(games.id, m.gameId)).for('update');
      if (!prev) {
        await tx.insert(games).values({ ...row, status: 'active' });
      } else {
        const keep = <T>(chosen: T[], supported: readonly T[]) => { const v = chosen.filter((x) => supported.includes(x)); return v.length ? v : [...supported]; };
        let minPlayers = Math.max(prev.minPlayers, m.playerCounts.min);
        let maxPlayers = Math.min(prev.maxPlayers, m.playerCounts.max);
        if (minPlayers > maxPlayers) [minPlayers, maxPlayers] = [m.playerCounts.min, m.playerCounts.max];
        const { access: _access, paces: _p, competitions: _c, minPlayers: _mi, maxPlayers: _ma, ...content } = row;
        await tx.update(games).set({
          ...content, paces: keep(prev.paces, m.supportedModes.pace), competitions: keep(prev.competitions, m.supportedModes.competition),
          minPlayers, maxPlayers, updatedAt: sql`now()`
        }).where(eq(games.id, m.gameId));
      }
      const existing = await tx.select({ id: gameVersions.id }).from(gameVersions)
        .where(and(eq(gameVersions.gameId, m.gameId), eq(gameVersions.rulesVersion, m.rulesVersion)));
      if (existing.length === 0) {
        await tx.insert(gameVersions).values({
          gameId: m.gameId,
          rulesVersion: m.rulesVersion,
          stateSchemaVersion: m.stateSchemaVersion,
          clientBundleRef: m.clientBundleRef,
          assetsRef: m.assetsRef,
          manifest: m,
          status: 'active'
        });
      }
    });
  }
}

if (import.meta.main) {
  const { db, close } = createDb(requireDatabaseUrl(), { max: 1 });
  try {
    await seed(db);
    console.log(`seeded ${gameRegistry.length} registry games`);
  } finally {
    await close();
  }
}
