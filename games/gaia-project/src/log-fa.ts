// Persian text of one game-log entry without the player's name (the table's move log shows the name beside it).
// Used by publicSummary().moves so the shell's MoveLog in the rail is the one game log (COMPONENTS.md 1.4).
import { BASE_CONVERSIONS, CONTENT } from './core.ts';
import { BUILDING_FA, TRACK_FA, type LogEntry } from './types.ts';

const faN = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
const convFa = (id: string) => [...BASE_CONVERSIONS, ...Object.values(CONTENT.factions).flatMap((f) => f.effects?.conversions ?? [])].find((c) => c.id === id)?.labelFa ?? id;
function specialFa(key: string): string {
  if (key === 'ac2') return 'اقدام آکادمی QIC';
  const [kind, id] = key.split(':') as [string, string];
  if (kind === 'faction') return CONTENT.factions[id]?.effects?.action?.labelFa ?? key;
  if (kind === 'booster') return CONTENT.boosters[id]?.effects?.action?.labelFa ?? key;
  if (kind === 'tech') return CONTENT.techs[id]?.effects.action?.labelFa ?? key;
  return key;
}

export function logTextFa(e: LogEntry, powerLabel: (id: string) => string): string {
  switch (e.t) {
    case 'faction': return `جناح ${CONTENT.factions[e.faction]?.nameFa ?? e.faction} را برداشت`;
    case 'place': return `${BUILDING_FA[e.building]} شروع را گذاشت`;
    case 'booster': return `بوستر برداشت: ${CONTENT.boosters[e.booster]?.labelFa ?? e.booster}`;
    case 'round': return `دور ${faN(e.round)} آغاز شد`;
    case 'mine': return `معدن ساخت${e.steps ? ` (${faN(e.steps)} گام زمین‌سازی)` : ''}`;
    case 'upgrade': return `به ${BUILDING_FA[e.to]} ارتقا داد`;
    case 'gaiaform': return 'پروژهٔ گایا را شروع کرد';
    case 'federation': return `فدراسیون ساخت: ${CONTENT.feds[e.token]?.labelFa ?? e.token}`;
    case 'research': return `در ${TRACK_FA[e.track]} به سطح ${faN(e.level)} رسید`;
    case 'power': return `اقدام قدرت: ${powerLabel(e.action)}`;
    case 'special': return `اقدام ویژه: ${specialFa(e.action)}`;
    case 'convert': return `تبدیل: ${e.id === 'burn' ? 'سوزاندن قدرت' : convFa(e.id)}`;
    case 'leech': return `${faN(e.amount)} قدرت گرفت (${faN(e.vp)} امتیاز)`;
    case 'decline': return 'قدرت را نپذیرفت';
    case 'tech': return `کاشی گرفت: ${CONTENT.techs[e.tech]?.labelFa ?? e.tech}`;
    case 'pass': return 'پاس داد';
    case 'vp': return `${faN(e.n)} امتیاز`;
    case 'final': return `امتیاز نهایی: ${faN(e.vp)}`;
    case 'timeout': return 'زمانش تمام شد';
    case 'left': return e.reason === 'resign' ? 'انصراف داد' : 'به‌علت تأخیر خارج شد';
  }
}
