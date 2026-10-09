import { describe, expect, it } from 'vitest';
import { newMoments } from '../src/shell/Celebration.tsx';

const ach = (key: string, granted: boolean) =>
  ({ key, titleFa: key, descriptionFa: '', tier: 'bronze' as const, progress: 0, target: 1, grantedAt: granted ? '2026-10-09T00:00:00.000Z' : null });

describe('celebration moments', () => {
  it('first visit on a device only records a baseline', () => {
    expect(newMoments(null, { level: 5, achievements: [ach('a', true)] })).toEqual([]);
  });
  it('level-up first, then newly granted achievements only', () => {
    const m = newMoments({ level: 2, keys: ['a'] }, { level: 3, achievements: [ach('a', true), ach('b', true), ach('c', false)] });
    expect(m.map((x) => (x.kind === 'level' ? `level ${x.level}` : x.key))).toEqual(['level 3', 'b']);
  });
  it('nothing new, nothing shown', () => {
    expect(newMoments({ level: 3, keys: ['a'] }, { level: 3, achievements: [ach('a', true)] })).toEqual([]);
  });
});
