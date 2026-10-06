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
export const ACHIEVEMENTS = [
  { key: 'first_game', titleFa: 'اولین میز', descriptionFa: 'اولین بازی کامل.', criteria: { type: 'matches', count: 1 } },
  { key: 'first_win', titleFa: 'اولین برد', descriptionFa: 'اولین رتبه اول.', criteria: { type: 'wins', count: 1 } },
  { key: 'explorer', titleFa: 'کاوشگر', descriptionFa: 'دو بازی مختلف را تا پایان بازی کنید.', criteria: { type: 'distinct_games', count: 2 } },
  { key: 'graduate', titleFa: 'شاگرد ممتاز', descriptionFa: 'آموزش دو بازی را کامل کنید.', criteria: { type: 'tutorials', count: 2 } },
  { key: 'ranked_debut', titleFa: 'ورود به رقابت', descriptionFa: 'اولین بازی رتبه‌دار.', criteria: { type: 'ranked', count: 1 } },
  { key: 'regular', titleFa: 'پای ثابت', descriptionFa: 'بیست بازی کامل.', criteria: { type: 'matches', count: 20 } }
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
  await db.insert(achievementDefinitions).values(ACHIEVEMENTS.map((a) => ({ ...a, ruleVersion: 1 }))).onConflictDoNothing();

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
