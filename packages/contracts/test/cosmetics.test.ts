import { describe, expect, it } from 'vitest';
import { ITEM_KINDS, KIND_SLOT, RARITIES, kindOfKey, rarityOf, AVATAR_SLOTS, COSMETICS, DEFAULT_AVATAR, avatarKeySchema, avatarSvg, bioSchema, formatAvatar, parseAvatar, slotItems } from '../src/index.ts';

describe('avatar codec', () => {
  it('round-trips a built avatar and renders it', () => {
    const key = 'v1:s3.f2.h11.hc6.e5.m4.o7.oc2.a9.b7.fr8';
    const p = parseAvatar(key)!;
    expect(p).not.toBeNull();
    expect(formatAvatar(p)).toBe(key);
    const svg = avatarSvg(p);
    expect(svg).not.toMatch(/\{(skin|hair|cloth)\}/);
    expect(svg).toContain('#C68650');
  });
  it('rejects unknown indexes, wrong order, missing slots and junk', () => {
    for (const k of ['v1:s99.f0.h1.hc1.e0.m0.o0.oc0.a0.b0.fr0', 'v1:f0.s1.h1.hc1.e0.m0.o0.oc0.a0.b0.fr0', 'v1:s1.f0', 'v2:s1', '<svg>', DEFAULT_AVATAR + '.x1']) {
      expect(parseAvatar(k)).toBeNull();
      expect(avatarKeySchema.safeParse(k).success).toBe(false);
    }
  });
  it('accepts legacy keys and the default avatar', () => {
    expect(avatarKeySchema.safeParse('meeple').success).toBe(true);
    expect(avatarKeySchema.safeParse(DEFAULT_AVATAR).success).toBe(true);
  });
});

describe('table cosmetic kinds', () => {
  it('keeps keys unique, gives every kind a free and a premium item with visual art, and maps keys to kinds', () => {
    expect(new Set(COSMETICS.map((c) => c.key)).size).toBe(COSMETICS.length);
    for (const k of ITEM_KINDS) {
      const items = slotItems(KIND_SLOT[k]);
      expect(items.length).toBeGreaterThanOrEqual(5);
      expect(items.some((c) => 'free' in c.unlock)).toBe(true);
      expect(items.some((c) => 'premium' in c.unlock)).toBe(true);
      for (const c of items) {
        expect(c.art?.colors.length).toBeGreaterThan(0);
        expect(RARITIES).toContain(rarityOf(c));
        expect(kindOfKey(c.key)).toBe(k);
      }
    }
    expect(kindOfKey('h.1')).toBeUndefined();
  });
});

describe('catalogue', () => {
  it('has unique keys, a free first item in every avatar slot, and art for every drawn slot', () => {
    expect(new Set(COSMETICS.map((c) => c.key)).size).toBe(COSMETICS.length);
    for (const s of AVATAR_SLOTS) {
      const items = slotItems(s);
      expect(items[0]!.unlock).toEqual({ free: true });
      for (const c of items) expect(['s', 'hc', 'oc'].includes(s) ? c.color : c.svg).toBeDefined();
    }
  });
  it('bio refuses bidi overrides but keeps Persian ZWNJ', () => {
    expect(bioSchema.safeParse('عاشق‌بازی').success).toBe(true);
    expect(bioSchema.safeParse('abc‮def').success).toBe(false);
  });
});
