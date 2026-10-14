import { GAME_TAG_FA, type GameSummary } from '@bg/contracts';
import { GameCard as BgvGameCard, Tag } from '@bg/ui/bgv';
import { ACCESS_FA, DIFFICULTY_FA, range } from '../lib/format.ts';
import { GameCover } from './covers.tsx';

/** Catalogue card (DS GameCard): painted cover, Persian name with the Latin original, players / time / difficulty. */
export function GameCard({ game }: { game: GameSummary }) {
  const flags = [
    ...(game.isTestGame ? [{ tone: 'test' as const, icon: 'triangle-alert', label: 'آزمایشی' }] : []),
    ...(game.access === 'premium' ? [{ tone: 'premium' as const, icon: 'crown', label: ACCESS_FA.premium }] : []),
    ...(game.botAvailable ? [{ icon: 'bot', label: 'ربات' }] : [])
  ];
  return (
    <BgvGameCard href={`/games/${game.id}`} art={<GameCover gameId={game.id} title="" />} title={game.nameFa} latin={game.nameOriginal}
      aria-label={`${game.nameFa} (${game.nameOriginal})`} flags={flags}
      meta={[
        { icon: 'users', text: range(game.minPlayers, game.maxPlayers, 'نفر') },
        { icon: 'clock', text: range(game.minMinutes, game.maxMinutes, 'دقیقه') },
        { icon: 'gauge', text: DIFFICULTY_FA[game.difficulty] }
      ]}
      {...(game.tags.length ? { footer: <span className="bgv-row" style={{ gap: 6 }}>{game.tags.slice(0, 2).map((t) => <Tag key={t}>{GAME_TAG_FA[t]}</Tag>)}</span> } : {})} />
  );
}
