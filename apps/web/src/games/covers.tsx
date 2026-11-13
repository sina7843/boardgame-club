import { useState } from 'react';

// DS v2.4.3: every game image is its box (`img.bgv-box` inside `.bgv-box-slot`, shadow by filter: drop-shadow), never a
// painted cover or a gameplay photo. Box photos live in /covers/box/<gameId>.webp. Our own games have no real box: they
// get the house box (brand symbol + name) until the owner supplies one (design/GAMES-BOXES.md).

export function GameBox({ gameId, nameFa, size, fill = false, alt = '' }: {
  gameId: string; nameFa: string; size?: 'sm' | 'lg'; fill?: boolean; alt?: string;
}) {
  const [missing, setMissing] = useState(false);
  const slot = `bgv-box-slot${fill ? ' bgv-box-slot--fill' : ''}`;
  if (missing) {
    return (
      <span className={slot}>
        <span className="game-housebox" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
          <img src="/brand/symbol-reversed-small.svg" alt="" width={28} height={28} />
          <b>{nameFa}</b>
          <small>ساخت بردگیم‌ورس</small>
        </span>
      </span>
    );
  }
  return (
    <span className={slot}>
      <img className={`bgv-box${size ? ` bgv-box--${size}` : ''}`} src={`/covers/box/${gameId}.webp`} alt={alt} loading="lazy" decoding="async"
        onError={() => setMissing(true)} />
    </span>
  );
}
