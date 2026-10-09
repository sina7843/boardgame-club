import type { TrophyTier } from '@bg/contracts';

export const TIER_FA: Record<TrophyTier, string> = { bronze: 'برنزی', silver: 'نقره‌ای', gold: 'طلایی', turquoise: 'فیروزه‌ای', diamond: 'الماس' };

/** Trophy art on a tier-coloured medallion; decorative, the title next to it carries the meaning. */
export function Trophy({ tier, locked = false }: { tier: TrophyTier; locked?: boolean }) {
  return <span className={`trophy${locked ? ' trophy--locked' : ''}`}><img src={`/trophies/${tier}.webp`} alt="" width={256} height={256} loading="lazy" decoding="async" /></span>;
}

/** Thirteen level emblems; every level from 13 up keeps the last (legendary) one. */
export const LEVEL_BADGES = 13;
export function LevelBadge({ level, size = 96 }: { level: number; size?: number }) {
  const n = Math.min(Math.max(level, 1), LEVEL_BADGES);
  return <img className="level-badge" src={`/levels/${n}.webp`} alt="" width={size} height={size} decoding="async" />;
}
