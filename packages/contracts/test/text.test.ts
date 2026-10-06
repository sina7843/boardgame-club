import { describe, expect, it } from 'vitest';
import { commandEnvelope, maskMobile, normalizeIranMobile, normalizeSearch } from '../src/index.ts';

describe('normalizeSearch', () => {
  it('unifies Arabic yeh/kaf with Persian forms', () => {
    expect(normalizeSearch('مزايده')).toBe(normalizeSearch('مزایده'));
    expect(normalizeSearch('كارت')).toBe(normalizeSearch('کارت'));
    expect(normalizeSearch('سه‌خطی')).toBe('سه خطی');
  });
  it('lowercases Latin, strips diacritics and collapses spaces', () => {
    expect(normalizeSearch('  Line   THREE ')).toBe('line three');
    expect(normalizeSearch('مُزایده')).toBe('مزایده');
    expect(normalizeSearch('۱۲٣')).toBe('123');
  });
});

describe('normalizeIranMobile', () => {
  it.each([
    ['09121234567', '09121234567'],
    ['+989121234567', '09121234567'],
    ['00989121234567', '09121234567'],
    ['۰۹۱۲ ۱۲۳ ۴۵۶۷', '09121234567']
  ])('%s → %s', (input, expected) => expect(normalizeIranMobile(input)).toBe(expected));
  it.each(['0812123456', '091212345678', 'abc', ''])('rejects %s', (input) => {
    expect(normalizeIranMobile(input)).toBeNull();
  });
  it('masks', () => expect(maskMobile('09121234567')).toBe('0912***4567'));
});

describe('commandEnvelope', () => {
  const base = {
    commandId: '7f2c8e9a-1b2c-4d3e-8f4a-5b6c7d8e9f01',
    tableId: '0d1e2f3a-4b5c-4d6e-9f70-8192a3b4c5d6',
    expectedRevision: 3,
    action: { type: 'place', cell: 4 }
  };
  it('accepts a well-formed envelope', () => expect(commandEnvelope.safeParse(base).success).toBe(true));
  it('rejects a client-supplied actorId', () => {
    expect(commandEnvelope.safeParse({ ...base, actorId: 'someone-else' }).success).toBe(false);
  });
});
