// Chunk "towns-south": the western, southern and eastern towns of the Birmingham board and the farm brewery between
// Kidderminster and Worcester. Owner: towns-south agent.
// Same shape as towns-north.ts. Links live in links-merchants.ts.
import type { ContentChunk } from '../types.ts';

export const townsSouth: ContentChunk = {
  locations: [
    { id: 'birmingham', nameFa: 'بیرمنگام', nameEn: 'Birmingham', kind: 'town', pos: [62, 67], color: 'purple', slots: [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']], cards: [3, 3, 3] },
    { id: 'walsall', nameFa: 'والسال', nameEn: 'Walsall', kind: 'town', pos: [51, 54], color: 'yellow', slots: [['iron', 'manufacturer'], ['manufacturer', 'brewery']], cards: [1, 1, 1] },
    { id: 'wolverhampton', nameFa: 'ولورهمپتون', nameEn: 'Wolverhampton', kind: 'town', pos: [30, 53], color: 'yellow', slots: [['manufacturer'], ['manufacturer', 'coal']], cards: [2, 2, 2] },
    { id: 'coalbrookdale', nameFa: 'کول‌بروک‌دیل', nameEn: 'Coalbrookdale', kind: 'town', pos: [13, 57], color: 'yellow', slots: [['iron', 'brewery'], ['iron'], ['coal']], cards: [3, 3, 3] },
    { id: 'dudley', nameFa: 'دادلی', nameEn: 'Dudley', kind: 'town', pos: [35, 64], color: 'yellow', slots: [['coal'], ['iron']], cards: [2, 2, 2] },
    { id: 'kidderminster', nameFa: 'کیدرمینستر', nameEn: 'Kidderminster', kind: 'town', pos: [23, 75], color: 'yellow', slots: [['cotton', 'coal'], ['cotton']], cards: [2, 2, 2] },
    { id: 'worcester', nameFa: 'وُستر', nameEn: 'Worcester', kind: 'town', pos: [25, 90], color: 'yellow', slots: [['cotton'], ['cotton']], cards: [2, 2, 2] },
    { id: 'coventry', nameFa: 'کاونتری', nameEn: 'Coventry', kind: 'town', pos: [88, 71], color: 'purple', slots: [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']], cards: [3, 3, 3] },
    { id: 'nuneaton', nameFa: 'نانیتن', nameEn: 'Nuneaton', kind: 'town', pos: [84, 58], color: 'purple', slots: [['manufacturer', 'brewery'], ['cotton', 'coal']], cards: [1, 1, 1] },
    { id: 'redditch', nameFa: 'ردیچ', nameEn: 'Redditch', kind: 'town', pos: [58, 80], color: 'purple', slots: [['manufacturer', 'coal'], ['iron']], cards: [1, 1, 1] },
    { id: 'farm-worcester', nameFa: 'آبجوسازی روستایی وُستر', nameEn: 'Farm Brewery (Worcester)', kind: 'farm', pos: [21, 83], slots: [['brewery']] }
  ]
};
