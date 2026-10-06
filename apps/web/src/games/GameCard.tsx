import { Link } from 'react-router';
import type { GameSummary } from '@bg/contracts';
import { Badge, Icon } from '@bg/ui';
import { ACCESS_FA, DIFFICULTY_FA, PACE_FA, range } from '../lib/format.ts';
import { GameCover } from './covers.tsx';

export function GameCard({ game }: { game: GameSummary }) {
  return (
    <Link to={`/games/${game.id}`} className="game-card" aria-label={`${game.nameFa} (${game.nameOriginal})`}>
      <div className="game-card__cover"><GameCover gameId={game.id} title="" /></div>
      <div className="game-card__body">
        <div>
          <div className="game-card__title">{game.nameFa}</div>
          <div className="game-card__original"><bdi>{game.nameOriginal}</bdi></div>
        </div>
        <ul className="game-card__facts">
          <li className="row" style={{ gap: 4 }}><Icon name="players" size={16} />{range(game.minPlayers, game.maxPlayers, 'نفر')}</li>
          <li className="row" style={{ gap: 4 }}><Icon name="clock" size={16} />{range(game.minMinutes, game.maxMinutes, 'دقیقه')}</li>
          <li>{DIFFICULTY_FA[game.difficulty]}</li>
        </ul>
        <div className="game-card__badges">
          {game.isTestGame && <Badge tone="test" icon="alert">بازی آزمایشی</Badge>}
          <Badge tone={game.access === 'premium' ? 'premium' : undefined}>{ACCESS_FA[game.access]}</Badge>
          {game.paces.map((p) => <Badge key={p}>{PACE_FA[p]}</Badge>)}
        </div>
      </div>
    </Link>
  );
}
