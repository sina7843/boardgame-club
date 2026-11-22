/** Search title of a game page: the prerendered page (scripts/seo.ts) and GameDetail at runtime use the same one,
 *  since search engines read the rendered document title. */
export const gameDocTitle = (nameFa: string, nameOriginal: string) => `بازی آنلاین ${nameFa} (${nameOriginal}) و آموزش قوانین`;
