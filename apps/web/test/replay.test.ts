import { describe, expect, it } from 'vitest';
import { replayKey } from '../src/lib/replay.ts';

describe('replay keyboard', () => {
  it('RTL: ← is next, → is previous; Home/End jump; clamped to 1…total', () => {
    expect(replayKey('ArrowLeft', 3, 10, true)).toBe(4);
    expect(replayKey('ArrowRight', 3, 10, true)).toBe(2);
    expect(replayKey('ArrowRight', 1, 10, true)).toBe(1);
    expect(replayKey('ArrowLeft', 10, 10, true)).toBe(10);
    expect(replayKey('Home', 5, 10, true)).toBe(1);
    expect(replayKey('End', 5, 10, true)).toBe(10);
    expect(replayKey('x', 5, 10, true)).toBeNull();
  });
  it('LTR mirrors the arrows', () => {
    expect(replayKey('ArrowRight', 3, 10, false)).toBe(4);
    expect(replayKey('ArrowLeft', 3, 10, false)).toBe(2);
  });
});
