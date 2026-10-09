// Catalog covers: one painted WebP per game in /covers/<gameId>.webp (real components of each game, no text).
// The name stays in the card/heading next to it, so the image itself is decorative unless a title is passed.
export function GameCover({ gameId, title }: { gameId: string; title: string }) {
  return (
    <img className="game-cover" src={`/covers/${gameId}.webp`} alt={title} width={800} height={450} loading="lazy" decoding="async"
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
  );
}
