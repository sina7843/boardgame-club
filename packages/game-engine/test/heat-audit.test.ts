import { describe, expect, it } from 'vitest';
import { heat, trackOf } from '@bg/game-heat';

const fa = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });

describe('heat audit: Persian rules text matches the engine', () => {
  it('every track length and corner (position + limit) in rulesFa equals tracks.ts', () => {
    const text = heat.catalog.rulesFa.join('\n');
    for (const id of ['usa', 'italy', 'france', 'gb'] as const) {
      const t = trackOf(id);
      // Each track paragraph: "<name>: <length> خانه … پیچ‌ها: <at> (<limit>)، …" (the first says "(محدودیت n)").
      const para = text.split('. ').find((p) => p.includes(t.nameFa))!;
      expect(para, id).toContain(`${fa(t.length)} خانه`);
      for (const c of t.corners) expect(para, `${id} ${c.at}`).toMatch(new RegExp(`${fa(c.at)} \\((محدودیت )?${fa(c.limit)}\\)`));
    }
  });
});
