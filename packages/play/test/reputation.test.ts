import { describe, expect, it } from 'vitest';
import { meetsReputation, reputationFrom, reputationView } from '../src/reputation.ts';

const now = new Date('2026-11-25T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const sig = (kind: string, d = 1, humanSeats = 2) => ({ kind, at: daysAgo(d), humanSeats });
const veteran = { total: 20, recent: 0 };

describe('reputationFrom «اعتبار»', () => {
  it('starts at 100 and applies −5 timeout, −2 ready no-show, +1 per recent game', () => {
    expect(reputationFrom({ signals: [], finishedGames: veteran, now })).toEqual({ score: 100, band: 'reliable' });
    expect(reputationFrom({ signals: [sig('timeout_loss'), sig('ready_no_show')], finishedGames: veteran, now }).score).toBe(93);
    expect(reputationFrom({ signals: [sig('timeout_loss'), sig('timeout_loss')], finishedGames: { total: 20, recent: 3 }, now }).score).toBe(93);
  });

  it('clamps to 0 to 100', () => {
    expect(reputationFrom({ signals: [], finishedGames: { total: 50, recent: 50 }, now }).score).toBe(100);
    expect(reputationFrom({ signals: Array.from({ length: 30 }, () => sig('timeout_loss')), finishedGames: veteran, now })).toEqual({ score: 0, band: 'low' });
  });

  it('counts only the last 90 days', () => {
    expect(reputationFrom({ signals: [sig('timeout_loss', 89), sig('timeout_loss', 91)], finishedGames: veteran, now }).score).toBe(95);
  });

  it('ignores resigning a game with fewer than 3 human seats', () => {
    expect(reputationFrom({ signals: [sig('resigned', 1, 2)], finishedGames: veteran, now }).score).toBe(100);
    expect(reputationFrom({ signals: [sig('resigned', 1, 3)], finishedGames: veteran, now }).score).toBe(95);
  });

  it('bands: ≥90 reliable, 70 to 89 normal, <70 low; fewer than 5 games → newcomer without a number', () => {
    const at = (n: number) => reputationFrom({ signals: Array.from({ length: n }, () => sig('ready_no_show')), finishedGames: veteran, now }).band;
    expect([at(5), at(6), at(15), at(16)]).toEqual(['reliable', 'normal', 'normal', 'low']);
    const fresh = reputationFrom({ signals: [], finishedGames: { total: 4, recent: 4 }, now });
    expect(fresh.band).toBe('newcomer');
    expect(reputationView(fresh, true)).toEqual({ band: 'newcomer', score: null });
    expect(reputationView(reputationFrom({ signals: [], finishedGames: veteran, now }), true).score).toBe(100);
    expect(reputationView(reputationFrom({ signals: [], finishedGames: veteran, now }), false).score).toBeNull();
  });

  it('minimum: newcomers meet 70 but not 90', () => {
    const fresh = reputationFrom({ signals: [], finishedGames: { total: 0, recent: 0 }, now });
    expect([meetsReputation(fresh, 70), meetsReputation(fresh, 90), meetsReputation(fresh, null)]).toEqual([true, false, true]);
    const normal = reputationFrom({ signals: Array.from({ length: 3 }, () => sig('timeout_loss')), finishedGames: veteran, now });
    expect([meetsReputation(normal, 70), meetsReputation(normal, 90)]).toEqual([true, false]);
  });
});
