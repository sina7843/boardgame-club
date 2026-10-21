// Tournaments: public list/detail, player registration (free, coins or a gateway payment), admin create/cancel and the
// Toman refund queue. All rules live in @bg/play; the worker starts tournaments and advances rounds.
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, createTournamentBody, tournamentDetail, tournamentPlacements, tournamentRefundItem, tournamentSummary } from '@bg/contracts';
import {
  adminCancelTournament, checkinTournament, createTournament, disqualifyPlayer, listRefunds, listTournaments, markRefundPaid, overrideTableResult,
  registerForTournament, requestBye, tournamentCheckout, tournamentDetail as detail, tournamentRecords, withdrawFromTournament
} from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { BAZAAR_NO_SALE_FA, fromBazaarApp } from '../billing/routes.ts';

const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema, 502: apiErrorSchema };
// Excel needs the byte-order mark to read UTF-8 (Persian) CSV.
const BOM = String.fromCharCode(0xfeff);
const idParams = z.object({ id: z.uuid() });

export function tournamentRoutes(app: FastifyInstance, { db, registry, billing }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/tournaments', { schema: { tags: ['tournaments'], summary: 'Open, running and recently ended tournaments', response: { 200: z.object({ items: z.array(tournamentSummary) }) } } },
    async (req) => ({ items: await listTournaments(db, req.auth?.userId ?? null) }));

  r.get('/tournaments/:id', { schema: { tags: ['tournaments'], summary: 'Tournament rules, prizes, standings and one round (?round=, default current)', params: idParams,
    querystring: z.object({ round: z.coerce.number().int().min(1).max(64).optional() }), response: { 200: tournamentDetail, ...errors } } },
    async (req) => {
      const t = await detail(db, billing, req.params.id, req.auth?.userId ?? null, req.query.round);
      return fromBazaarApp(req) ? { ...t, checkout: { available: false, reasonFa: BAZAAR_NO_SALE_FA, fixture: false } } : t;
    });

  r.get('/tournaments/:id/standings.csv', { schema: { tags: ['tournaments'], summary: 'Standings as CSV (UTF-8 with BOM, opens in Excel)', params: idParams } }, async (req, reply) => {
    const t = await detail(db, billing, req.params.id, null, 1);
    const cell = (v: string | number | null) => `"${String(v ?? '').replaceAll('"', '""').replace(/^([=+\-@])/, "'$1")}"`;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows = [['رتبه', 'بازیکن', 'امتیاز', 'بوخهولتس کات ۱', 'بوخهولتس', 'میانگین رتبهٔ حریفان', 'سونبورن-برگر', 'برد', 'وضعیت'],
      ...t.standings.map((s) => [s.finalRank, s.player.displayName, s.points, r2(s.buchholzCut1), r2(s.buchholz), s.aro, r2(s.sonnebornBerger), s.wins,
        s.disqualified ? 'محروم' : s.eliminatedRound ? `حذف در دور ${s.eliminatedRound}` : ''])];
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="tournament-${t.id}.csv"`)
      .send(`${BOM}${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`);
  });

  r.post('/tournaments/:id/checkin', {
    schema: { tags: ['tournaments'], summary: 'Confirm attendance inside the check-in window (unconfirmed players are withdrawn at the start)', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await checkinTournament(db, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });

  r.post('/tournaments/:id/bye', {
    schema: { tags: ['tournaments'], summary: 'Swiss: ask to sit a future round out (½ point) or take the request back', params: idParams,
      body: z.strictObject({ round: z.number().int().min(1).max(64), requested: z.boolean() }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await requestBye(db, requireUser(req).userId, req.params.id, req.body.round, req.body.requested);
    return reply.code(204).send(null);
  });

  r.post('/tournaments/:id/register', {
    schema: { tags: ['tournaments'], summary: 'Register with a free or coin entry (coins are debited once, under the coin lock)', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await registerForTournament(db, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });

  r.post('/tournaments/:id/checkout', {
    schema: { tags: ['tournaments'], summary: 'Start a gateway payment for a Toman entry; the verified payment registers (or queues a refund)', params: idParams,
      response: { 200: z.object({ orderId: z.string(), redirectUrl: z.url() }), ...errors } }
  }, async (req) => {
    if (fromBazaarApp(req)) throw new AppError('PAYMENT_UNAVAILABLE');
    return tournamentCheckout(db, billing, requireUser(req).userId, req.params.id);
  });

  r.post('/tournaments/:id/withdraw', {
    schema: { tags: ['tournaments'], summary: 'Withdraw before the start: coins return at once, a Toman entry is queued for refund', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await withdrawFromTournament(db, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });

  // ---------- Admin ----------
  r.post('/admin/tournaments', {
    schema: { tags: ['admin'], summary: 'Create a tournament (validated against the game; audited)', body: createTournamentBody, response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    return reply.code(201).send({ id: await createTournament(db, registry, userId, req.body, req.id) });
  });

  r.post('/admin/tournaments/:id/cancel', {
    schema: { tags: ['admin'], summary: 'Cancel a tournament and give every entry back (audited)', params: idParams,
      body: z.strictObject({ reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await adminCancelTournament(db, userId, req.params.id, req.body.reason, req.id);
    return reply.code(204).send(null);
  });

  r.get('/admin/tournaments/:id/games', {
    schema: { tags: ['admin'], summary: 'Every finished game of the tournament in one file (chess: PGN) for arbiters', params: idParams }
  }, async (req, reply) => {
    requireRole(req, 'admin');
    const rec = await tournamentRecords(db, registry, req.params.id);
    return reply.header('content-type', `${rec.mimeType}; charset=utf-8`).header('content-disposition', `attachment; filename="${rec.filename}"`).send(rec.text);
  });

  r.post('/admin/tournaments/:id/disqualify', {
    schema: { tags: ['admin'], summary: 'Disqualify a player of a running tournament (forfeits the current table; audited)', params: idParams,
      body: z.strictObject({ userId: z.uuid(), reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await disqualifyPlayer(db, userId, req.params.id, req.body.userId, req.body.reason, req.id);
    return reply.code(204).send(null);
  });

  r.post('/admin/tournaments/:id/tables/:tableId/result', {
    schema: { tags: ['admin'], summary: 'Arbiter: set the result of a tournament table (a table in play is closed; audited)', params: z.object({ id: z.uuid(), tableId: z.uuid() }),
      body: z.strictObject({ placements: tournamentPlacements, reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await overrideTableResult(db, userId, req.params.id, req.params.tableId, req.body.placements, req.body.reason, req.id);
    return reply.code(204).send(null);
  });

  r.get('/admin/tournament-refunds', {
    schema: { tags: ['admin'], summary: 'Toman entry fees to give back (paid by hand, then marked paid)', querystring: z.object({ status: z.enum(['pending', 'paid']).optional() }),
      response: { 200: z.object({ items: z.array(tournamentRefundItem) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    return { items: (await listRefunds(db, req.query.status)).map(({ r: x, titleFa, displayName, mobile, orderId, providerRef }) => ({
      id: x.id, tournamentTitleFa: titleFa, userId: x.userId, displayName, mobile, orderId, providerRef, amount: x.amount, reason: x.reason,
      status: x.status, createdAt: x.createdAt.toISOString(), note: x.note })) };
  });

  r.post('/admin/tournament-refunds/:id/paid', {
    schema: { tags: ['admin'], summary: 'Mark a refund as paid (bank transfer reference in the note; audited)', params: idParams,
      body: z.strictObject({ note: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await markRefundPaid(db, userId, req.params.id, req.body.note, req.id);
    return reply.code(204).send(null);
  });
}
