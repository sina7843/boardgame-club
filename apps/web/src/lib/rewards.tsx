import type { TrophyTier } from '@bg/contracts';

export const TIER_FA: Record<TrophyTier, string> = { bronze: 'برنزی', silver: 'نقره‌ای', gold: 'طلایی', turquoise: 'فیروزه‌ای', diamond: 'الماس' };


/** Thirteen level emblems; every level from 13 up keeps the last (legendary) one. */
export const LEVEL_BADGES = 13;
export function LevelBadge({ level, size = 96 }: { level: number; size?: number }) {
  const n = Math.min(Math.max(level, 1), LEVEL_BADGES);
  return <img className="app-level-badge" src={`/levels/${n}.webp`} alt="" width={size} height={size} decoding="async" />;
}
