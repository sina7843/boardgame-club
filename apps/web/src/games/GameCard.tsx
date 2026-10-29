import { useState } from 'react';
import { GAME_TAG_FA, type GameSummary } from '@bg/contracts';
import { GameCard as BgvGameCard, Tag } from '@bg/ui/bgv';
import { ACCESS_FA, DIFFICULTY_FA, range } from '../lib/format.ts';

/** The game's box photo on the shelf; our own games (no photo) get the house box. */
export function BoxArt({ game }: { game: Pick<GameSummary, 'id' | 'nameFa'> }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <span className="game-housebox">
        <img src="/brand/symbol-reversed-small.svg" alt="" width={28} height={28} />
        <b>{game.nameFa}</b>
        <small>ساخت بردگیم‌ورس</small>
      </span>
    );
  }
  // The photo is flat; `.box3d` (home.css) gives it a spine, thickness and a slight turn so it reads as a standing box.
  return <span className="box3d"><img src={`/covers/box/${game.id}.webp`} alt="" loading="lazy" decoding="async" onError={() => setMissing(true)} /></span>;
}

/** Catalogue card (DS GameCard v2.1): box photo on a shelf, Persian name with the Latin original, players / time / difficulty. */
export function GameCard({ game }: { game: GameSummary }) {
  const flags = [
    ...(game.isTestGame ? [{ tone: 'test' as const, icon: 'triangle-alert', label: 'آزمایشی' }] : []),
    ...(game.access === 'premium' ? [{ tone: 'premium' as const, icon: 'crown', label: ACCESS_FA.premium }] : []),
    ...(game.botAvailable ? [{ icon: 'bot', label: 'ربات' }] : [])
  ];
  return (
    <BgvGameCard href={`/games/${game.id}`} boxArt={<BoxArt game={game} />} title={game.nameFa} latin={game.nameOriginal}
      aria-label={`${game.nameFa} (${game.nameOriginal})`} flags={flags}
      meta={[
        { icon: 'users', text: range(game.minPlayers, game.maxPlayers, 'نفر') },
        { icon: 'clock', text: range(game.minMinutes, game.maxMinutes, 'دقیقه') },
        { icon: 'gauge', text: DIFFICULTY_FA[game.difficulty] }
      ]}
      {...(game.tags.length ? { footer: <span className="bgv-row" style={{ gap: 6 }}>{game.tags.slice(0, 2).map((t) => <Tag key={t}>{GAME_TAG_FA[t]}</Tag>)}</span> } : {})} />
  );
}
