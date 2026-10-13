// Chat word filter: masks common Persian and Finglish insults with stars. Whole words only, so ordinary words that
// merely contain a short insult ("کسی", "کسب") are untouched. Spacing tricks inside a word (ZWNJ, tatweel, repeated
// letters, Arabic ي/ك) are normalized before matching.
// ponytail: fixed word list, no context or obfuscation model; moderators and reports cover what it misses.

/** Matched as whole words. Left out on purpose: «کس» («هیچ کس») and Finglish «kon/koni» («bazi kon»). */
const WORDS = [
  'کص', 'کوس', 'کیر', 'کون', 'کونی', 'جنده', 'کسکش', 'کصکش', 'کسخل', 'کصخل', 'کسشر', 'کصشر', 'کسشعر', 'کصشعر',
  'حرومزاده', 'حرامزاده', 'حرومی', 'مادرجنده', 'پدرسگ', 'پفیوز', 'لاشی', 'جاکش', 'دیوث', 'قرمساق', 'گوه', 'گوز', 'ننتو',
  'kos', 'kir', 'jende', 'jakesh', 'kesafat', 'kosesher', 'koskesh', 'kosekesh', 'koskhol',
  'haroomzade', 'haramzade', 'madarjende', 'pedarsag', 'lashi', 'dayoos', 'gooh', 'goh'
];
/** Matched as word starts: stems that are never the beginning of an innocent word (e.g. «گاییدم», «کسکشا»). */
const STEMS = ['گایید', 'بگای', 'کسکش', 'کصکش', 'مادرجند', 'حرومزاد', 'حرامزاد', 'جاکش', 'kosk', 'madarjend', 'gaeid', 'gayid', 'haroomzad'];

const words = new Set(WORDS.map(normalize));
const stems = STEMS.map(normalize);

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه')
    .replace(/\u200c|\u200d|\u0640|\p{Mn}/gu, '') // ZWNJ/ZWJ, tatweel, diacritics
    .replace(/(.)\1+/gu, '$1'); // «کیییر» → «کیر»
}

/** The word list goes through the same normalization, so repeated letters collapse on both sides. */
function isBad(token: string): boolean {
  const t = normalize(token);
  return words.has(t) || stems.some((s) => t.startsWith(s));
}

export function maskProfanity(text: string): string {
  return text.replace(/[\p{L}\p{M}\u200c\u0640]+/gu, (tok) => (isBad(tok) ? '*'.repeat([...tok].length) : tok));
}
