import { describe, expect, it } from 'vitest';
import { DEFAULT_SEASON, displayRating, leagueFor, newSkill, rate, type Skill } from '../src/rating.ts';

const s = (mu: number, sigma = 25 / 3): Skill => ({ mu, sigma });

describe('Weng–Lin Bradley–Terry rating', () => {
  it('winner gains, loser loses, symmetric for equal players; uncertainty shrinks', () => {
    const [w, l] = rate([{ skill: newSkill(), place: 1 }, { skill: newSkill(), place: 2 }]);
    expect(w!.mu).toBeGreaterThan(25);
    expect(l!.mu).toBeLessThan(25);
    expect(w!.mu - 25).toBeCloseTo(25 - l!.mu, 10);
    expect(w!.sigma).toBeLessThan(25 / 3);
  });

  it('a tie between equals changes no mean; a tie with a stronger player helps the weaker one', () => {
    const [a, b] = rate([{ skill: newSkill(), place: 1 }, { skill: newSkill(), place: 1 }]);
    expect(a!.mu).toBeCloseTo(25, 10);
    expect(b!.mu).toBeCloseTo(25, 10);
    const [strong, weak] = rate([{ skill: s(30, 3), place: 1 }, { skill: s(20, 3), place: 1 }]);
    expect(strong!.mu).toBeLessThan(30);
    expect(weak!.mu).toBeGreaterThan(20);
  });

  it('upsets move ratings more than expected results', () => {
    const [favWin] = rate([{ skill: s(30, 3), place: 1 }, { skill: s(20, 3), place: 2 }]);
    const [favLoss] = rate([{ skill: s(30, 3), place: 2 }, { skill: s(20, 3), place: 1 }]);
    expect(30 - favLoss!.mu).toBeGreaterThan(favWin!.mu - 30);
  });

  it('4-player free-for-all with a shared second place orders the updates by placement', () => {
    const out = rate([2, 1, 2, 4].map((place) => ({ skill: newSkill(), place })));
    expect(out[1]!.mu).toBeGreaterThan(out[0]!.mu);
    expect(out[0]!.mu).toBeCloseTo(out[2]!.mu, 10);
    expect(out[0]!.mu).toBeGreaterThan(out[3]!.mu);
    // zero-sum on the means for equal priors
    expect(out.reduce((a, x) => a + x.mu, 0)).toBeCloseTo(100, 8);
  });

  it('input order does not change anyone’s update', () => {
    const a = rate([{ skill: s(27, 5), place: 1 }, { skill: s(22, 6), place: 2 }, { skill: s(25, 4), place: 2 }]);
    const b = rate([{ skill: s(25, 4), place: 2 }, { skill: s(27, 5), place: 1 }, { skill: s(22, 6), place: 2 }]);
    expect(b[1]).toEqual(a[0]);
    expect(b[2]).toEqual(a[1]);
    expect(b[0]).toEqual(a[2]);
  });

  it('display rating and leagues', () => {
    expect(displayRating(newSkill())).toBe(1500);
    expect(leagueFor(1200)).toBe('bronze');
    expect(leagueFor(1500)).toBe('gold');
    expect(leagueFor(2000, DEFAULT_SEASON)).toBe('master');
  });

  it('volume alone does not raise the public rating (alternating results against the same opponent)', () => {
    let a = newSkill(); let b = newSkill();
    for (let g = 0; g < 200; g++) [a, b] = rate([{ skill: a, place: g % 2 ? 1 : 2 }, { skill: b, place: g % 2 ? 2 : 1 }]) as [Skill, Skill];
    expect(Math.abs(displayRating(a) - 1500)).toBeLessThan(25);
    expect(a.sigma).toBeLessThan(3);
  });
});
