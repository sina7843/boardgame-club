// Game page content (DS v2.4 GameDetail template) entered by hand by the team, and players' reviews. No data from other
// sites: everything here is written for boardgameverse.ir.
import { z } from 'zod';
import { publicProfile } from './api.ts';

const text = (max: number) => z.string().trim().max(max);
/** Site-relative image path under /games/<id>/ or /covers/ (files shipped in apps/web/public). */
const imagePath = z.string().trim().max(200).regex(/^\/(games|covers)\/[a-z0-9/_.-]+\.(webp|png|jpe?g)$/, 'مسیر تصویر باید با /games/ یا /covers/ شروع شود.');

export const gameContent = z.strictObject({
  /** Longer «درباره» text (paragraphs). */
  aboutFa: z.array(text(1200).min(1)).max(4).default([]),
  /** Two to four highlight tiles beside the text (e.g. the two eras of Brass). */
  highlights: z.array(z.strictObject({ titleFa: text(60).min(1), textFa: text(240).min(1) })).max(4).default([]),
  /** Key moves as chips under «چطور بازی کنیم» (e.g. the seven actions); an optional note per chip. */
  moves: z.array(z.strictObject({ labelFa: text(40).min(1), noteFa: text(30).optional() })).max(10).default([]),
  screenshots: z.array(z.strictObject({ src: imagePath, captionFa: text(160).min(1) })).max(6).default([]),
  faq: z.array(z.strictObject({ qFa: text(160).min(1), aFa: text(800).min(1) })).max(10).default([]),
  sheet: z.strictObject({
    /** Weight on a 1–5 scale (one decimal). */
    weight: z.number().min(1).max(5).multipleOf(0.1).nullable().default(null),
    bestPlayersFa: text(40).default(''),
    minAge: z.number().int().min(3).max(21).nullable().default(null),
    mechanics: z.array(z.strictObject({ fa: text(40).min(1), en: text(60).default('') })).max(12).default([]),
    themes: z.array(z.strictObject({ fa: text(40).min(1), en: text(60).default('') })).max(12).default([]),
    designer: text(120).default(''), artist: text(120).default(''), publisher: text(120).default(''),
    publisherFa: text(120).default(''), year: z.number().int().min(1800).max(2100).nullable().default(null)
  }).default({ weight: null, bestPlayersFa: '', minAge: null, mechanics: [], themes: [], designer: '', artist: '', publisher: '', publisherFa: '', year: null })
});
export type GameContent = z.infer<typeof gameContent>;
export const emptyGameContent = (): GameContent => gameContent.parse({});

export const gameReview = z.object({
  id: z.uuid(), user: publicProfile, stars: z.number().int().min(1).max(5), bodyFa: z.string(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime()
});
export type GameReview = z.infer<typeof gameReview>;

export const gameReviews = z.object({
  /** Average of visible reviews (one decimal), count, and how many gave 5..1 stars (index 0 = 5 stars). */
  average: z.number().nullable(), count: z.number().int(), distribution: z.array(z.number().int()).length(5),
  items: z.array(gameReview),
  /** The viewer's own review and whether they may write one (finished at least one table of this game). */
  mine: gameReview.nullable(), canReview: z.boolean()
});
export type GameReviews = z.infer<typeof gameReviews>;

export const reviewBody = z.strictObject({ stars: z.number().int().min(1).max(5), bodyFa: z.string().trim().min(3).max(1000) });
