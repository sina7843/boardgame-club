import type { Term } from '@bg/ui';

/** Gaia Project terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  // resources
  credits: { fa: 'اعتبار', bg: 'Credits' }, ore: { fa: 'سنگ معدن', bg: 'Ore' }, knowledge: { fa: 'دانش', bg: 'Knowledge' },
  powerCharge: { fa: 'شارژ قدرت', bg: 'Power Charge' }, powerToken: { fa: 'ژتون قدرت', bg: 'Power Token' }, brainStone: { fa: 'سنگ مغز', bg: 'Brain Stone' },
  // structures
  mine: { fa: 'معدن', bg: 'Mine' }, tradingStation: { fa: 'ایستگاه تجاری', bg: 'Trading Station' }, researchLab: { fa: 'آزمایشگاه پژوهشی', bg: 'Research Lab' },
  planetaryInstitute: { fa: 'مؤسسهٔ سیاره‌ای', bg: 'Planetary Institute' }, knowledgeAcademy: { fa: 'آکادمی دانش', bg: 'Knowledge Academy' },
  qicAcademy: { fa: 'آکادمی QIC', bg: 'QIC Academy' }, gaiaformer: { fa: 'گایاساز', bg: 'Gaiaformer' }, spaceStation: { fa: 'ایستگاه فضایی', bg: 'Space Station' },
  lostPlanet: { fa: 'سیارهٔ گمشده', bg: 'Lost Planet' },
  // research tracks
  terraforming: { fa: 'زمین‌سازی', bg: 'Terraforming' }, navigation: { fa: 'ناوبری', bg: 'Navigation' }, ai: { fa: 'هوش مصنوعی', bg: 'Artificial Intelligence' },
  gaiaProject: { fa: 'پروژهٔ گایا', bg: 'Gaia Project' }, economy: { fa: 'اقتصاد', bg: 'Economy' }, science: { fa: 'دانش', bg: 'Science' },
  // actions and tiles
  buildMine: { fa: 'ساخت معدن', bg: 'Build Mine' }, upgrade: { fa: 'ارتقای سازه', bg: 'Upgrade' }, research: { fa: 'پژوهش', bg: 'Research' },
  federation: { fa: 'فدراسیون', bg: 'Federation' }, formFederation: { fa: 'تشکیل فدراسیون', bg: 'Form Federation' }, pass: { fa: 'پاس', bg: 'Pass' },
  booster: { fa: 'بوستر', bg: 'Booster' }, techStd: { fa: 'فناوری استاندارد', bg: 'Standard Tech Tile' }, techAdv: { fa: 'فناوری پیشرفته', bg: 'Advanced Tech Tile' },
  fedToken: { fa: 'توکن فدراسیون', bg: 'Federation Token' }, fedTokens: { fa: 'توکن‌های فدراسیون', bg: 'Federation Tokens' }
} satisfies Record<string, Term>;
