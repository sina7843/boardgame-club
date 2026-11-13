import type { GameSummary } from '@bg/contracts';
import { GameCard as BgvGameCard } from '@bg/ui/bgv';
import { ACCESS_FA, range } from '../lib/format.ts';
import { GameBox } from './covers.tsx';

/**
 * Catalogue card (DS GameCard v2.4): the box on its shelf, Persian name with the Latin original, players and time, then
 * one tag row: flags («آزمایشی»، ویژه) and who can play (ModeTag «آنلاین | ربات» or «آنلاین»); no category tags (Catalog-Desktop).
 */
export function GameCard({ game, compact = false }: { game: GameSummary; compact?: boolean }) {
  const flags = [
    ...(game.isTestGame ? [{ tone: 'test' as const, icon: 'triangle-alert', label: 'آزمایشی' }] : []),
    ...(game.access === 'premium' ? [{ tone: 'premium' as const, icon: 'crown', label: ACCESS_FA.premium }] : [])
  ];
  return (
    <BgvGameCard href={`/games/${game.id}`} boxArt={<GameBox gameId={game.id} nameFa={game.nameFa} fill />} title={game.nameFa} latin={game.nameOriginal}
      aria-label={`${game.nameFa} (${game.nameOriginal})`} flags={flags}
      meta={[
        { icon: 'users', text: range(game.minPlayers, game.maxPlayers, 'نفر') },
        { icon: 'clock', text: range(game.minMinutes, game.maxMinutes, 'دقیقه') }
      ]}
      mode={{ bot: game.botAvailable, ...(compact ? { compact: true } : {}) }}
    />
  );
}
