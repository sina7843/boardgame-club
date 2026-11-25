import { describe, expect, it } from 'vitest';
import { damerauLevenshtein, gameSearchText, matchGames } from '../src/index.ts';

const g = (id: string, nameFa: string, nameOriginal: string) => ({ id, nameFa, nameOriginal });
const GAMES = [
  g('catan', 'کاتان', 'Catan'), g('chess', 'شطرنج', 'Chess'), g('backgammon', 'تخته‌نرد', 'Backgammon'),
  g('ludo', 'منچ', 'Ludo'), g('splendor', 'کهربا', 'Splendor'), g('brass', 'برس: بیرمنگام', 'Brass: Birmingham'),
  g('carcassonne', 'کارکاسون', 'Carcassonne'), g('kingdomino', 'کینگ‌دومینو', 'Kingdomino'), g('go', 'گو', 'Go'),
  g('coup', 'کودتا', 'Coup'), g('terraforming-mars', 'ترافورمینگ مارس', 'Terraforming Mars')
];
const ids = (q: string) => matchGames(q, GAMES).map((x) => x.id);

describe('damerauLevenshtein', () => {
  it('counts an adjacent swap as one edit', () => {
    expect(damerauLevenshtein('katan', 'katan')).toBe(0);
    expect(damerauLevenshtein('katna', 'katan')).toBe(1);
    expect(damerauLevenshtein('splender', 'splendor')).toBe(1);
    expect(damerauLevenshtein('abc', '')).toBe(3);
  });
});

describe('matchGames', () => {
  it('finds Finglish spellings and alternative names', () => {
    expect(ids('katan')[0]).toBe('catan');
    expect(ids('kataan')[0]).toBe('catan');
    expect(ids('shatranj')[0]).toBe('chess');
    expect(ids('takhte nard')[0]).toBe('backgammon');
    expect(ids('takhtenard')[0]).toBe('backgammon');
    expect(ids('monch')[0]).toBe('ludo');
    expect(ids('kahroba')[0]).toBe('splendor');
    expect(ids('اسپلندور')[0]).toBe('splendor');
    expect(ids('زمین‌ساز')[0]).toBe('terraforming-mars');
  });
  it('tolerates typos in longer words', () => {
    expect(ids('karkasoon')[0]).toBe('carcassonne');
    expect(ids('carcasone')[0]).toBe('carcassonne');
    expect(ids('splendr')[0]).toBe('splendor');
    expect(ids('brass birmingam')[0]).toBe('brass');
    expect(ids('کاتن')[0]).toBe('catan'); // 4 letters: one edit allowed
    expect(ids('کتن')).toEqual([]); // 3 letters: no typo tolerance
  });
  it('unifies Persian/Arabic letters, ZWNJ and spaces', () => {
    expect(ids('كاتان')[0]).toBe('catan');
    expect(ids('تخته نرد')[0]).toBe('backgammon');
    expect(ids('کینگ دومینو')[0]).toBe('kingdomino');
  });
  it('ranks name prefix above contains above alias above typo', () => {
    expect(ids('کا')).toEqual(['catan', 'carcassonne']);
    expect(ids('Go')[0]).toBe('go');
  });
  it('has no typo hits for very short queries', () => {
    expect(ids('gu')).toEqual([]);
    expect(ids('kup')).toEqual([]);
    expect(ids('')).toEqual([]);
  });
});

describe('gameSearchText', () => {
  it('includes the normalized names and aliases', () => {
    const t = gameSearchText(g('catan', 'کاتان', 'Catan'));
    expect(t).toContain('کاتان');
    expect(t).toContain('catan');
    expect(t).toContain('kataan');
  });
});
