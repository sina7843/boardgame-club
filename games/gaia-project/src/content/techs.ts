// Chunk "techs": the standard and advanced tech tiles not implemented in base.ts. Owned by one chunk agent;
// see README.md for the API and the tile numbering.
import { countBuilding, gaiaPlanets, gain, planetTypes, sectorsOf, vp } from '../core.ts';
import type { ContentBundle, TechDef } from '../types.ts';

const TECHS: TechDef[] = [
  // ---------- standard ----------
  { id: 'std2', kind: 'std', labelFa: 'فوری: ۷ امتیاز', effects: { onGain: (x) => vp(x.s, x.seat, 7, 'tech') } },
  { id: 'std4', kind: 'std', labelFa: 'فوری: ۱ دانش برای هر نوع سیاره', effects: { onGain: (x) => gain(x.s, x.seat, { k: planetTypes(x.s, x.seat) }) } },
  { id: 'std6', kind: 'std', labelFa: 'درآمد: ۱ دانش و ۱ اعتبار', effects: { income: { k: 1, c: 1 } } },
  { id: 'std8', kind: 'std', labelFa: 'درآمد: ۴ اعتبار', effects: { income: { c: 4 } } },
  // ---------- advanced ----------
  { id: 'adv2', kind: 'adv', labelFa: 'هنگام پاس: ۳ امتیاز برای هر آزمایشگاه پژوهشی', effects: { onPass: (x) => vp(x.s, x.seat, 3 * countBuilding(x.s, x.seat, 'lab'), 'tech') } },
  { id: 'adv3', kind: 'adv', labelFa: 'هنگام پاس: ۱ امتیاز برای هر نوع سیاره', effects: { onPass: (x) => vp(x.s, x.seat, planetTypes(x.s, x.seat), 'tech') } },
  { id: 'adv5', kind: 'adv', labelFa: 'فوری: ۴ امتیاز برای هر ایستگاه تجاری', effects: { onGain: (x) => vp(x.s, x.seat, 4 * countBuilding(x.s, x.seat, 'ts'), 'tech') } },
  { id: 'adv6', kind: 'adv', labelFa: 'فوری: ۵ امتیاز برای هر فدراسیون', effects: { onGain: (x) => vp(x.s, x.seat, 5 * x.s.pl[x.seat]!.feds.length, 'tech') } },
  { id: 'adv7', kind: 'adv', labelFa: 'فوری: ۲ امتیاز برای هر بخشی که در آن حضور دارید', effects: { onGain: (x) => vp(x.s, x.seat, 2 * sectorsOf(x.s, x.seat), 'tech') } },
  { id: 'adv8', kind: 'adv', labelFa: 'فوری: ۱ سنگ معدن برای هر بخشی که در آن حضور دارید', effects: { onGain: (x) => gain(x.s, x.seat, { o: sectorsOf(x.s, x.seat) }) } },
  { id: 'adv9', kind: 'adv', labelFa: 'فوری: ۲ امتیاز برای هر سیارهٔ گایا', effects: { onGain: (x) => vp(x.s, x.seat, 2 * gaiaPlanets(x.s, x.seat), 'tech') } },
  { id: 'adv10', kind: 'adv', labelFa: 'اقدام: ۱ QIC و ۵ اعتبار', effects: { action: { labelFa: '۱ QIC و ۵ اعتبار', run: (x) => gain(x.s, x.seat, { q: 1, c: 5 }) } } },
  { id: 'adv11', kind: 'adv', labelFa: 'اقدام: ۳ سنگ معدن', effects: { action: { labelFa: '۳ سنگ معدن', run: (x) => gain(x.s, x.seat, { o: 3 }) } } },
  { id: 'adv12', kind: 'adv', labelFa: 'اقدام: ۳ دانش', effects: { action: { labelFa: '۳ دانش', run: (x) => gain(x.s, x.seat, { k: 3 }) } } },
  { id: 'adv13', kind: 'adv', labelFa: 'هر ایستگاه تجاری: ۳ امتیاز', effects: { on: { upgrade: (x, e) => { if (e.to === 'ts') vp(x.s, x.seat, 3, 'tech'); } } } },
  { id: 'adv15', kind: 'adv', labelFa: 'هر پیشرفت پژوهش: ۲ امتیاز', effects: { on: { research: (x) => vp(x.s, x.seat, 2, 'tech') } } }
];

export const techs: ContentBundle = { techs: TECHS };
