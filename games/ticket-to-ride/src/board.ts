// Ticket to Ride boards: three selectable maps (North America, Europe, Iran) played with the same classic rules.
// Cities carry real longitude/latitude (the renderer projects them); routes are [from, to, length, ...colours] where
// two colours make a double route. Ticket values are not hand-typed: each is the shortest connection between its two
// cities in train cars, computed below. Indexes are stable: they key state arrays, actions and tickets.

export const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'pink', 'black', 'white'] as const;
export type CardColor = (typeof COLORS)[number];
/** Card colour index: 0–7 = COLORS, 8 = locomotive (wild). */
export const LOCO = 8;
export type RouteColor = CardColor | 'gray';
export const COLOR_FA: Record<CardColor | 'gray' | 'loco', string> = {
  red: 'قرمز', orange: 'نارنجی', yellow: 'زرد', green: 'سبز', blue: 'آبی', pink: 'صورتی', black: 'مشکی', white: 'سفید',
  gray: 'خاکستری (هر رنگ)', loco: 'لوکوموتیو'
};
export const CARDS_PER_COLOR = 12;
export const LOCO_CARDS = 14;
export const TRAINS = 45;
/** Points for a claimed route by length. */
export const ROUTE_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15, 7: 18, 8: 21 };
export const LONGEST_BONUS = 10;

export type MapId = 'usa' | 'europe' | 'iran';
export const MAP_IDS: readonly MapId[] = ['usa', 'europe', 'iran'];

type RouteSpec = [string, string, number, RouteColor, RouteColor?];
interface MapSpec { nameFa: string; cities: Record<string, [string, number, number]>; routes: RouteSpec[]; tickets: [string, string][] }

const SPECS: Record<MapId, MapSpec> = {
  usa: {
    nameFa: 'آمریکای شمالی',
    cities: {
      vancouver: ['ونکوور', -123.1, 49.3], seattle: ['سیاتل', -122.3, 47.6], portland: ['پورتلند', -122.7, 45.5],
      sanFrancisco: ['سان‌فرانسیسکو', -122.4, 37.8], losAngeles: ['لس‌آنجلس', -118.2, 34.05], calgary: ['کلگری', -114.1, 51.05],
      helena: ['هلنا', -112.0, 46.6], saltLake: ['سالت‌لیک‌سیتی', -111.9, 40.76], lasVegas: ['لاس‌وگاس', -115.1, 36.2],
      phoenix: ['فینیکس', -112.1, 33.45], elPaso: ['ال‌پاسو', -106.5, 31.76], santaFe: ['سانتافه', -105.9, 35.7],
      denver: ['دنور', -104.99, 39.74], winnipeg: ['وینیپگ', -97.1, 49.9], duluth: ['دولوث', -92.1, 46.8],
      omaha: ['اوماها', -95.9, 41.26], kansasCity: ['کانزاس‌سیتی', -94.6, 39.1], oklahomaCity: ['اوکلاهماسیتی', -97.5, 35.47],
      dallas: ['دالاس', -96.8, 32.78], houston: ['هیوستون', -95.37, 29.76], saultStMarie: ['سوسنت‌ماری', -84.35, 46.5],
      chicago: ['شیکاگو', -87.63, 41.88], saintLouis: ['سنت‌لوئیس', -90.2, 38.63], littleRock: ['لیتل‌راک', -92.29, 34.75],
      newOrleans: ['نیواورلئان', -90.07, 29.95], toronto: ['تورنتو', -79.38, 43.65], montreal: ['مونترال', -73.57, 45.5],
      boston: ['بوستون', -71.06, 42.36], newYork: ['نیویورک', -74.0, 40.71], pittsburgh: ['پیتسبورگ', -79.99, 40.44],
      washington: ['واشنگتن', -77.04, 38.9], raleigh: ['رالی', -78.64, 35.78], nashville: ['نشویل', -86.78, 36.16],
      atlanta: ['آتلانتا', -84.39, 33.75], charleston: ['چارلستون', -79.93, 32.78], miami: ['میامی', -80.19, 25.76]
    },
    routes: [
      ['vancouver', 'seattle', 1, 'gray', 'gray'], ['vancouver', 'calgary', 3, 'gray'], ['seattle', 'portland', 1, 'gray', 'gray'],
      ['seattle', 'calgary', 4, 'gray'], ['seattle', 'helena', 6, 'yellow'], ['portland', 'sanFrancisco', 5, 'green', 'pink'],
      ['portland', 'saltLake', 6, 'blue'], ['sanFrancisco', 'saltLake', 5, 'orange', 'white'], ['sanFrancisco', 'losAngeles', 3, 'yellow', 'pink'],
      ['losAngeles', 'lasVegas', 2, 'gray'], ['losAngeles', 'phoenix', 3, 'gray'], ['losAngeles', 'elPaso', 6, 'black'],
      ['lasVegas', 'saltLake', 3, 'orange'], ['phoenix', 'denver', 5, 'white'], ['phoenix', 'santaFe', 3, 'gray'],
      ['phoenix', 'elPaso', 3, 'gray'], ['calgary', 'helena', 4, 'gray'], ['calgary', 'winnipeg', 6, 'white'],
      ['helena', 'winnipeg', 4, 'blue'], ['helena', 'duluth', 6, 'orange'], ['helena', 'omaha', 5, 'red'],
      ['helena', 'denver', 4, 'green'], ['helena', 'saltLake', 3, 'pink'], ['saltLake', 'denver', 3, 'red', 'yellow'],
      ['denver', 'omaha', 4, 'pink'], ['denver', 'kansasCity', 4, 'black', 'orange'], ['denver', 'oklahomaCity', 4, 'red'],
      ['denver', 'santaFe', 2, 'gray'], ['santaFe', 'elPaso', 2, 'gray'], ['santaFe', 'oklahomaCity', 3, 'blue'],
      ['elPaso', 'oklahomaCity', 5, 'yellow'], ['elPaso', 'dallas', 4, 'red'], ['elPaso', 'houston', 6, 'green'],
      ['winnipeg', 'duluth', 4, 'black'], ['winnipeg', 'saultStMarie', 6, 'gray'], ['duluth', 'saultStMarie', 3, 'gray'],
      ['duluth', 'toronto', 6, 'pink'], ['duluth', 'chicago', 3, 'red'], ['duluth', 'omaha', 2, 'gray', 'gray'],
      ['omaha', 'chicago', 4, 'blue'], ['omaha', 'kansasCity', 1, 'gray', 'gray'], ['kansasCity', 'oklahomaCity', 2, 'gray', 'gray'],
      ['kansasCity', 'saintLouis', 2, 'blue', 'pink'], ['oklahomaCity', 'dallas', 2, 'gray', 'gray'], ['oklahomaCity', 'littleRock', 2, 'gray'],
      ['dallas', 'houston', 1, 'gray', 'gray'], ['dallas', 'littleRock', 2, 'gray'], ['houston', 'newOrleans', 2, 'gray'],
      ['littleRock', 'saintLouis', 2, 'gray'], ['littleRock', 'nashville', 3, 'white'], ['littleRock', 'newOrleans', 3, 'green'],
      ['newOrleans', 'atlanta', 4, 'yellow', 'orange'], ['newOrleans', 'miami', 6, 'red'], ['saintLouis', 'chicago', 2, 'green', 'white'],
      ['saintLouis', 'nashville', 2, 'gray'], ['saintLouis', 'pittsburgh', 5, 'green'], ['chicago', 'pittsburgh', 3, 'orange', 'black'],
      ['chicago', 'toronto', 4, 'white'], ['saultStMarie', 'toronto', 2, 'gray'], ['saultStMarie', 'montreal', 5, 'black'],
      ['toronto', 'montreal', 3, 'gray'], ['toronto', 'pittsburgh', 2, 'gray'], ['montreal', 'boston', 2, 'gray', 'gray'],
      ['montreal', 'newYork', 3, 'blue'], ['boston', 'newYork', 2, 'yellow', 'red'], ['newYork', 'pittsburgh', 2, 'white', 'green'],
      ['newYork', 'washington', 2, 'orange', 'black'], ['pittsburgh', 'washington', 2, 'gray'], ['pittsburgh', 'raleigh', 2, 'gray'],
      ['pittsburgh', 'nashville', 4, 'yellow'], ['washington', 'raleigh', 2, 'gray', 'gray'], ['nashville', 'raleigh', 3, 'black'],
      ['nashville', 'atlanta', 1, 'gray'], ['raleigh', 'atlanta', 2, 'gray', 'gray'], ['raleigh', 'charleston', 2, 'gray'],
      ['atlanta', 'charleston', 2, 'gray'], ['atlanta', 'miami', 5, 'blue'], ['charleston', 'miami', 4, 'pink']
    ],
    tickets: [
      ['denver', 'elPaso'], ['kansasCity', 'houston'], ['newYork', 'atlanta'], ['chicago', 'newOrleans'], ['calgary', 'saltLake'],
      ['helena', 'losAngeles'], ['duluth', 'houston'], ['saultStMarie', 'nashville'], ['montreal', 'atlanta'], ['saultStMarie', 'oklahomaCity'],
      ['seattle', 'losAngeles'], ['chicago', 'santaFe'], ['duluth', 'elPaso'], ['toronto', 'miami'], ['portland', 'phoenix'],
      ['dallas', 'newYork'], ['denver', 'pittsburgh'], ['winnipeg', 'littleRock'], ['winnipeg', 'houston'], ['boston', 'miami'],
      ['vancouver', 'santaFe'], ['calgary', 'phoenix'], ['montreal', 'newOrleans'], ['losAngeles', 'chicago'], ['sanFrancisco', 'atlanta'],
      ['portland', 'nashville'], ['vancouver', 'montreal'], ['losAngeles', 'miami'], ['losAngeles', 'newYork'], ['seattle', 'newYork']
    ]
  },
  europe: {
    nameFa: 'اروپا',
    cities: {
      edinburgh: ['ادینبورو', -3.19, 55.95], london: ['لندن', -0.13, 51.5], dieppe: ['دی‌یپ', 1.08, 49.92], brest: ['برست', -4.49, 48.39],
      paris: ['پاریس', 2.35, 48.86], bruxelles: ['بروکسل', 4.35, 50.85], amsterdam: ['آمستردام', 4.9, 52.37], essen: ['اسن', 7.01, 51.46],
      frankfurt: ['فرانکفورت', 8.68, 50.11], zurich: ['زوریخ', 8.54, 47.37], munchen: ['مونیخ', 11.58, 48.14], berlin: ['برلین', 13.4, 52.52],
      kobenhavn: ['کپنهاگ', 12.57, 55.68], stockholm: ['استکهلم', 18.07, 59.33], danzig: ['دانزیگ', 18.65, 54.35], warszawa: ['ورشو', 21.01, 52.23],
      wien: ['وین', 16.37, 48.21], venezia: ['ونیز', 12.32, 45.44], marseille: ['مارسی', 5.37, 43.3], pamplona: ['پامپلونا', -1.64, 42.81],
      barcelona: ['بارسلونا', 2.17, 41.39], madrid: ['مادرید', -3.7, 40.42], lisboa: ['لیسبون', -9.14, 38.72], cadiz: ['کادیز', -6.29, 36.53],
      roma: ['رم', 12.5, 41.9], palermo: ['پالرمو', 13.36, 38.12], brindisi: ['بریندیزی', 17.94, 40.63], zagrab: ['زاگرب', 15.98, 45.81],
      budapest: ['بوداپست', 19.04, 47.5], sarajevo: ['سارایوو', 18.41, 43.86], sofia: ['صوفیه', 23.32, 42.7], athina: ['آتن', 23.73, 37.98],
      bucuresti: ['بخارست', 26.1, 44.43], constantinople: ['قسطنطنیه', 28.98, 41.01], smyrna: ['ازمیر', 27.14, 38.42], angora: ['آنقره', 32.86, 39.93],
      erzurum: ['ارزروم', 41.27, 39.9], sochi: ['سوچی', 39.72, 43.6], sevastopol: ['سواستوپل', 33.52, 44.6], rostov: ['روستوف', 39.7, 47.24],
      kharkov: ['خارکف', 36.23, 49.99], kyiv: ['کی‌یف', 30.52, 50.45], smolensk: ['اسمولنسک', 32.05, 54.78], moskva: ['مسکو', 37.62, 55.76],
      wilno: ['ویلنو', 25.28, 54.69], riga: ['ریگا', 24.1, 56.95], petrograd: ['پتروگراد', 30.31, 59.94]
    },
    routes: [
      ['edinburgh', 'london', 4, 'black', 'orange'], ['london', 'amsterdam', 2, 'gray'], ['london', 'dieppe', 2, 'gray', 'gray'],
      ['dieppe', 'brest', 2, 'orange'], ['dieppe', 'paris', 1, 'pink'], ['dieppe', 'bruxelles', 2, 'green'], ['brest', 'paris', 3, 'black'],
      ['brest', 'pamplona', 4, 'pink'], ['paris', 'bruxelles', 2, 'yellow', 'red'], ['paris', 'frankfurt', 3, 'white', 'orange'],
      ['paris', 'zurich', 3, 'gray'], ['paris', 'marseille', 4, 'gray'], ['paris', 'pamplona', 4, 'blue', 'green'],
      ['bruxelles', 'amsterdam', 1, 'black'], ['bruxelles', 'frankfurt', 2, 'blue'], ['amsterdam', 'frankfurt', 2, 'white'],
      ['amsterdam', 'essen', 3, 'yellow'], ['essen', 'frankfurt', 2, 'green'], ['essen', 'berlin', 2, 'blue'], ['essen', 'kobenhavn', 3, 'gray', 'gray'],
      ['frankfurt', 'berlin', 3, 'black', 'red'], ['frankfurt', 'munchen', 2, 'pink'], ['munchen', 'zurich', 2, 'yellow'],
      ['munchen', 'venezia', 2, 'blue'], ['munchen', 'wien', 3, 'orange'], ['zurich', 'venezia', 2, 'green'], ['zurich', 'marseille', 2, 'pink'],
      ['marseille', 'barcelona', 4, 'gray'], ['marseille', 'roma', 4, 'gray'], ['pamplona', 'barcelona', 2, 'gray'],
      ['pamplona', 'madrid', 3, 'black', 'white'], ['madrid', 'barcelona', 2, 'yellow'], ['madrid', 'lisboa', 3, 'pink'],
      ['madrid', 'cadiz', 3, 'orange'], ['lisboa', 'cadiz', 2, 'blue'], ['venezia', 'roma', 2, 'black'], ['venezia', 'zagrab', 2, 'gray'],
      ['roma', 'brindisi', 2, 'white'], ['roma', 'palermo', 4, 'gray'], ['palermo', 'brindisi', 3, 'gray'], ['brindisi', 'athina', 4, 'gray'],
      ['kobenhavn', 'stockholm', 3, 'yellow', 'white'], ['berlin', 'danzig', 4, 'gray'], ['berlin', 'warszawa', 4, 'pink', 'yellow'],
      ['berlin', 'wien', 3, 'green'], ['danzig', 'warszawa', 2, 'gray'], ['danzig', 'riga', 3, 'black'], ['stockholm', 'petrograd', 8, 'gray'],
      ['riga', 'petrograd', 4, 'gray'], ['riga', 'wilno', 4, 'green'], ['warszawa', 'wilno', 3, 'red'], ['warszawa', 'wien', 4, 'blue'],
      ['warszawa', 'kyiv', 4, 'gray'], ['wilno', 'petrograd', 4, 'blue'], ['wilno', 'smolensk', 3, 'yellow'], ['wilno', 'kyiv', 2, 'gray'],
      ['petrograd', 'moskva', 4, 'white'], ['smolensk', 'moskva', 2, 'orange'], ['smolensk', 'kyiv', 3, 'red'], ['moskva', 'kharkov', 4, 'gray'],
      ['kyiv', 'kharkov', 4, 'gray'], ['kyiv', 'budapest', 6, 'gray'], ['kyiv', 'bucuresti', 4, 'gray'], ['kharkov', 'rostov', 2, 'green'],
      ['rostov', 'sevastopol', 4, 'gray'], ['rostov', 'sochi', 2, 'gray'], ['sochi', 'sevastopol', 2, 'gray'], ['sochi', 'erzurum', 3, 'red'],
      ['sevastopol', 'bucuresti', 4, 'white'], ['sevastopol', 'constantinople', 4, 'gray'], ['sevastopol', 'erzurum', 4, 'gray'],
      ['erzurum', 'angora', 3, 'black'], ['angora', 'constantinople', 2, 'gray'], ['angora', 'smyrna', 3, 'orange'],
      ['smyrna', 'constantinople', 2, 'gray'], ['smyrna', 'athina', 2, 'gray'], ['constantinople', 'bucuresti', 3, 'yellow'],
      ['constantinople', 'sofia', 3, 'blue'], ['athina', 'sofia', 3, 'pink'], ['athina', 'sarajevo', 4, 'green'], ['sofia', 'bucuresti', 2, 'gray'],
      ['sofia', 'sarajevo', 2, 'gray'], ['bucuresti', 'budapest', 4, 'gray'], ['budapest', 'wien', 1, 'red', 'white'],
      ['budapest', 'zagrab', 2, 'orange'], ['budapest', 'sarajevo', 3, 'pink'], ['wien', 'zagrab', 2, 'gray'], ['zagrab', 'sarajevo', 3, 'red']
    ],
    tickets: [
      ['athina', 'angora'], ['budapest', 'sofia'], ['frankfurt', 'kobenhavn'], ['rostov', 'erzurum'], ['sofia', 'smyrna'], ['kyiv', 'petrograd'],
      ['zurich', 'brindisi'], ['zurich', 'budapest'], ['warszawa', 'smolensk'], ['zagrab', 'brindisi'], ['paris', 'zagrab'], ['brest', 'marseille'],
      ['london', 'berlin'], ['edinburgh', 'paris'], ['amsterdam', 'pamplona'], ['roma', 'smyrna'], ['palermo', 'constantinople'],
      ['sarajevo', 'sevastopol'], ['madrid', 'dieppe'], ['barcelona', 'bruxelles'], ['paris', 'wien'], ['barcelona', 'munchen'],
      ['brest', 'venezia'], ['smolensk', 'rostov'], ['marseille', 'essen'], ['kyiv', 'sochi'], ['madrid', 'zurich'], ['berlin', 'bucuresti'],
      ['bruxelles', 'danzig'], ['berlin', 'roma'], ['angora', 'kharkov'], ['riga', 'bucuresti'], ['essen', 'kyiv'], ['venezia', 'constantinople'],
      ['london', 'wien'], ['athina', 'wilno'], ['stockholm', 'wien'], ['berlin', 'moskva'], ['amsterdam', 'wilno'], ['frankfurt', 'smolensk'],
      ['lisboa', 'danzig'], ['brest', 'petrograd'], ['palermo', 'moskva'], ['kobenhavn', 'erzurum'], ['edinburgh', 'athina'], ['cadiz', 'stockholm']
    ]
  },
  iran: {
    nameFa: 'ایران',
    cities: {
      tabriz: ['تبریز', 46.29, 38.08], urmia: ['ارومیه', 45.07, 37.55], ardabil: ['اردبیل', 48.29, 38.25], rasht: ['رشت', 49.58, 37.28],
      zanjan: ['زنجان', 48.48, 36.67], qazvin: ['قزوین', 50.0, 36.27], tehran: ['تهران', 51.39, 35.69], sari: ['ساری', 53.06, 36.56],
      gorgan: ['گرگان', 54.43, 36.84], bojnurd: ['بجنورد', 57.33, 37.47], mashhad: ['مشهد', 59.6, 36.3], semnan: ['سمنان', 53.39, 35.58],
      qom: ['قم', 50.88, 34.64], arak: ['اراک', 49.69, 34.09], hamadan: ['همدان', 48.51, 34.8], sanandaj: ['سنندج', 47.0, 35.31],
      kermanshah: ['کرمانشاه', 47.06, 34.31], ilam: ['ایلام', 46.42, 33.64], khorramabad: ['خرم‌آباد', 48.36, 33.49], ahvaz: ['اهواز', 48.67, 31.32],
      abadan: ['آبادان', 48.3, 30.34], isfahan: ['اصفهان', 51.67, 32.65], kashan: ['کاشان', 51.44, 33.98], yazd: ['یزد', 54.36, 31.9],
      shiraz: ['شیراز', 52.53, 29.59], bushehr: ['بوشهر', 50.84, 28.92], bandarAbbas: ['بندرعباس', 56.27, 27.18], kerman: ['کرمان', 57.08, 30.28],
      zahedan: ['زاهدان', 60.86, 29.5], birjand: ['بیرجند', 59.22, 32.87], tabas: ['طبس', 56.92, 33.6], chabahar: ['چابهار', 60.64, 25.29],
      yasuj: ['یاسوج', 51.59, 30.67], shahrekord: ['شهرکرد', 50.86, 32.33], bam: ['بم', 58.36, 29.1]
    },
    routes: [
      ['tabriz', 'urmia', 2, 'blue'], ['tabriz', 'ardabil', 2, 'gray'], ['tabriz', 'zanjan', 3, 'red', 'green'], ['urmia', 'sanandaj', 4, 'yellow'],
      ['ardabil', 'rasht', 2, 'orange'], ['ardabil', 'zanjan', 3, 'gray'], ['rasht', 'qazvin', 2, 'white'], ['rasht', 'sari', 4, 'blue'],
      ['zanjan', 'qazvin', 2, 'black', 'pink'], ['zanjan', 'hamadan', 3, 'gray'], ['zanjan', 'sanandaj', 3, 'pink'],
      ['qazvin', 'tehran', 2, 'yellow', 'orange'], ['qazvin', 'hamadan', 3, 'white'], ['tehran', 'sari', 3, 'green'],
      ['tehran', 'semnan', 3, 'red', 'black'], ['tehran', 'qom', 2, 'gray', 'gray'], ['sari', 'gorgan', 2, 'gray'], ['gorgan', 'bojnurd', 3, 'white'],
      ['gorgan', 'semnan', 3, 'pink'], ['bojnurd', 'mashhad', 3, 'orange'], ['semnan', 'mashhad', 6, 'yellow', 'blue'], ['semnan', 'tabas', 5, 'gray'],
      ['mashhad', 'birjand', 4, 'green'], ['mashhad', 'tabas', 4, 'red'], ['birjand', 'tabas', 3, 'gray'], ['birjand', 'zahedan', 4, 'black'],
      ['sanandaj', 'kermanshah', 2, 'gray'], ['sanandaj', 'hamadan', 2, 'orange'], ['kermanshah', 'hamadan', 2, 'red'], ['kermanshah', 'ilam', 2, 'white'],
      ['kermanshah', 'khorramabad', 3, 'blue'], ['ilam', 'ahvaz', 4, 'green'], ['hamadan', 'arak', 2, 'green'], ['hamadan', 'khorramabad', 2, 'gray'],
      ['arak', 'qom', 2, 'pink'], ['arak', 'khorramabad', 3, 'yellow'], ['arak', 'isfahan', 4, 'gray'], ['qom', 'kashan', 2, 'blue'],
      ['kashan', 'isfahan', 2, 'black', 'white'], ['kashan', 'yazd', 4, 'orange'], ['isfahan', 'shahrekord', 1, 'gray'], ['isfahan', 'yazd', 4, 'pink', 'red'],
      ['khorramabad', 'ahvaz', 4, 'black', 'pink'], ['khorramabad', 'shahrekord', 4, 'orange'], ['ahvaz', 'abadan', 2, 'gray', 'gray'],
      ['ahvaz', 'yasuj', 4, 'yellow'], ['abadan', 'bushehr', 5, 'white'], ['shahrekord', 'yasuj', 2, 'red'], ['yasuj', 'shiraz', 2, 'black'],
      ['shiraz', 'bushehr', 3, 'blue', 'yellow'], ['shiraz', 'isfahan', 5, 'green'], ['shiraz', 'yazd', 5, 'gray'], ['shiraz', 'kerman', 6, 'orange'],
      ['shiraz', 'bandarAbbas', 6, 'pink'], ['bushehr', 'bandarAbbas', 6, 'red'], ['yazd', 'tabas', 4, 'white'], ['yazd', 'kerman', 4, 'black', 'blue'],
      ['kerman', 'bam', 2, 'gray', 'gray'], ['kerman', 'bandarAbbas', 4, 'green'], ['kerman', 'tabas', 5, 'red'], ['bam', 'zahedan', 3, 'yellow'],
      ['bam', 'bandarAbbas', 4, 'gray'], ['zahedan', 'chabahar', 6, 'green'], ['bandarAbbas', 'chabahar', 5, 'orange']
    ],
    tickets: [
      ['tabriz', 'tehran'], ['tehran', 'mashhad'], ['tehran', 'isfahan'], ['tehran', 'shiraz'], ['tabriz', 'mashhad'], ['rasht', 'isfahan'],
      ['urmia', 'ahvaz'], ['ardabil', 'kermanshah'], ['tehran', 'ahvaz'], ['mashhad', 'zahedan'], ['isfahan', 'bandarAbbas'], ['shiraz', 'zahedan'],
      ['kermanshah', 'shiraz'], ['hamadan', 'yazd'], ['qazvin', 'kerman'], ['sari', 'kashan'], ['gorgan', 'yazd'], ['bojnurd', 'kerman'],
      ['tabriz', 'bushehr'], ['rasht', 'bandarAbbas'], ['abadan', 'chabahar'], ['urmia', 'mashhad'], ['sanandaj', 'qom'], ['ilam', 'isfahan'],
      ['arak', 'bushehr'], ['yasuj', 'kerman'], ['shahrekord', 'tabas'], ['birjand', 'bandarAbbas'], ['semnan', 'bam'], ['tehran', 'chabahar'],
      ['ardabil', 'zahedan'], ['khorramabad', 'yazd'], ['tehran', 'shahrekord']
    ]
  }
};

export interface City { id: string; fa: string; lon: number; lat: number }
export interface Route { a: number; b: number; len: number; color: RouteColor; /** The other half of a double route. */ sib: number | null }
export interface Ticket { a: number; b: number; points: number }
export interface Board { id: MapId; nameFa: string; cities: City[]; routes: Route[]; tickets: Ticket[] }

/** Shortest connection (in train cars) between every pair of cities. */
function distances(n: number, routes: Route[]): number[][] {
  const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const r of routes) { d[r.a]![r.b] = Math.min(d[r.a]![r.b]!, r.len); d[r.b]![r.a] = d[r.a]![r.b]!; }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (d[i]![k]! + d[k]![j]! < d[i]![j]!) d[i]![j] = d[i]![k]! + d[k]![j]!;
  }
  return d;
}

function build(id: MapId): Board {
  const spec = SPECS[id];
  const cities = Object.entries(spec.cities).map(([cid, [fa, lon, lat]]) => ({ id: cid, fa, lon, lat }));
  const idx = new Map(cities.map((c, i) => [c.id, i]));
  const at = (c: string) => { const i = idx.get(c); if (i === undefined) throw new Error(`${id}: unknown city ${c}`); return i; };
  const routes: Route[] = [];
  for (const [a, b, len, c1, c2] of spec.routes) {
    const i = routes.length;
    routes.push({ a: at(a), b: at(b), len, color: c1, sib: c2 ? i + 1 : null });
    if (c2) routes.push({ a: at(a), b: at(b), len, color: c2, sib: i });
  }
  const d = distances(cities.length, routes);
  const tickets = spec.tickets.map(([a, b]) => ({ a: at(a), b: at(b), points: d[at(a)]![at(b)]! }));
  return { id, nameFa: spec.nameFa, cities, routes, tickets };
}

export const BOARDS: Record<MapId, Board> = { usa: build('usa'), europe: build('europe'), iran: build('iran') };

/** Train cards: 12 of each colour and 14 locomotives, as colour indexes. */
export const fullDeck = (): number[] => [...COLORS.flatMap((_, c) => Array<number>(CARDS_PER_COLOR).fill(c)), ...Array<number>(LOCO_CARDS).fill(LOCO)];

/** Union-find: is the ticket connected through these routes? */
export function connected(board: Board, routeIds: readonly number[], a: number, b: number): boolean {
  const parent = board.cities.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (const r of routeIds) parent[find(board.routes[r]!.a)] = find(board.routes[r]!.b);
  return find(a) === find(b);
}

/** Longest continuous path (train cars) through these routes; each route used once, cities may repeat. */
export function longestPath(board: Board, routeIds: readonly number[]): number {
  const adj = new Map<number, { r: number; to: number; len: number }[]>();
  for (const r of routeIds) {
    const { a, b, len } = board.routes[r]!;
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ r, to: b, len });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ r, to: a, len });
  }
  const used = new Set<number>();
  let best = 0;
  const dfs = (city: number, total: number) => {
    if (total > best) best = total;
    for (const e of adj.get(city) ?? []) {
      if (used.has(e.r)) continue;
      used.add(e.r);
      dfs(e.to, total + e.len);
      used.delete(e.r);
    }
  };
  for (const city of adj.keys()) dfs(city, 0);
  return best;
}
