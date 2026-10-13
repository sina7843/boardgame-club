import { useState, type SyntheticEvent } from 'react';

// Catalog covers: one painted WebP per game in /covers/<gameId>.webp (real components of each game, no text).
// Hovering a card cross-fades to the real box photo from BoardGameGeek (/covers/box/<gameId>.webp, scripts/bgg-box-images.py).
// Touch screens never hover, so they skip the box download unless the cover is `flippable` (tap to switch, game page).
// The name stays in the card/heading next to it, so the image itself is decorative unless a title is passed.
const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
const hide = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };

export function GameCover({ gameId, title, box = canHover, flippable = false }: { gameId: string; title: string; box?: boolean; flippable?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const images = (
    <>
      <img className="game-cover" src={`/covers/${gameId}.webp?v=2`} alt={title} width={800} height={450} loading="lazy" decoding="async" onError={hide} />
      {(box || flippable) && <img className="game-cover game-cover--box" src={`/covers/box/${gameId}.webp`} alt="" loading="lazy" decoding="async" onError={hide} />}
    </>
  );
  if (!flippable) return <span className="cover-flip">{images}</span>;
  return (
    <button type="button" className={`cover-flip${flipped ? ' is-flipped' : ''}`} aria-pressed={flipped} aria-label="نمایش جعبهٔ اصلی بازی"
      onClick={() => setFlipped((f) => !f)}>{images}</button>
  );
}
