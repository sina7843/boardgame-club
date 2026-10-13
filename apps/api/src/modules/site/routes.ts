// Public site pages (about, contact, terms, privacy, refund) and contact details, editable from the admin panel.
// Stored in app_settings (`site_info`, `site_page:<slug>`); an unsaved key serves the built-in default copy.
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Deps } from '../../app.ts';
import { requireRole } from '../auth/session.ts';
import { DEFAULT_PAGES, DEFAULT_SITE_INFO, SITE_SLUGS, type SiteInfo } from './defaults.ts';

const { appSettings, auditLog } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema };
const field = (max: number) => z.string().trim().max(max);
const infoSchema = z.strictObject({
  ownerName: field(120), email: z.union([z.literal(''), z.email().max(120)]), phone: field(40),
  address: field(400), postalCode: field(20), hours: field(120)
});
const pageSchema = z.strictObject({ titleFa: z.string().trim().min(2).max(80), bodyFa: z.string().trim().min(10).max(30000) });
/** Terms/privacy edits can bump the terms version, so every user must accept again on next visit. */
const pageEdit = pageSchema.extend({ requireReaccept: z.boolean().optional() });
const pageOut = pageSchema.extend({ slug: z.enum(SITE_SLUGS), updatedAt: z.string().nullable() });
const slugParams = z.object({ slug: z.enum(SITE_SLUGS) });

/** Current terms version users must have accepted. 'v1' until the admin first requires re-acceptance. */
export async function termsVersion(db: Db): Promise<string> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'terms_version'));
  return (row?.value as { version: string } | undefined)?.version ?? 'v1';
}

export function siteRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const info = async (): Promise<SiteInfo> => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'site_info'));
    return { ...DEFAULT_SITE_INFO, ...(row?.value as Partial<SiteInfo> | undefined) };
  };
  const save = (key: string, value: object, adminId: string) => db.insert(appSettings).values({ key, value, updatedBy: adminId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: adminId, updatedAt: new Date() } });

  r.get('/site/info', {
    schema: { tags: ['site'], summary: 'Public contact details (empty fields are hidden by the web)', response: { 200: infoSchema } }
  }, () => info());

  r.get('/site/pages/:slug', {
    schema: { tags: ['site'], summary: 'A public site page: admin-edited copy, else the built-in default', params: slugParams, response: { 200: pageOut, ...errors } }
  }, async (req) => {
    const { slug } = req.params;
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, `site_page:${slug}`));
    const saved = row?.value as { titleFa: string; bodyFa: string } | undefined;
    return { slug, ...(saved ?? DEFAULT_PAGES[slug]), updatedAt: row ? row.updatedAt.toISOString() : null };
  });

  r.put('/admin/site/info', {
    schema: { tags: ['admin'], summary: 'Edit public contact details, audited', body: infoSchema, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const before = await info();
    await save('site_info', req.body, userId);
    await db.insert(auditLog).values({ actorId: userId, action: 'site_info.update', targetType: 'setting', targetId: 'site_info', metadata: { before, after: req.body }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.put('/admin/site/pages/:slug', {
    schema: { tags: ['admin'], summary: 'Edit a public site page, audited; terms/privacy may require every user to accept again', params: slugParams, body: pageEdit, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const { requireReaccept, ...page } = req.body;
    const bump = !!requireReaccept && (req.params.slug === 'terms' || req.params.slug === 'privacy');
    await save(`site_page:${req.params.slug}`, page, userId);
    if (bump) await save('terms_version', { version: new Date().toISOString() }, userId);
    await db.insert(auditLog).values({ actorId: userId, action: 'site_page.update', targetType: 'setting', targetId: `site_page:${req.params.slug}`, metadata: { titleFa: page.titleFa, requireReaccept: bump }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.delete('/admin/site/pages/:slug', {
    schema: { tags: ['admin'], summary: 'Restore a site page to its built-in default copy, audited', params: slugParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const key = `site_page:${req.params.slug}`;
    const gone = await db.delete(appSettings).where(eq(appSettings.key, key)).returning({ key: appSettings.key });
    if (gone.length === 0) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: userId, action: 'site_page.reset', targetType: 'setting', targetId: key, metadata: {}, requestId: req.id });
    return reply.code(204).send(null);
  });
}
