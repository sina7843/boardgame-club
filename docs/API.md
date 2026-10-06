# API (phases 00–04)

Base path `/api`. JSON only. Machine-readable contract: `GET /api/openapi.json` (snapshot: `docs/openapi.json`,
regenerate with `pnpm --filter @bg/api openapi > docs/openapi.json`). Schemas live in `packages/contracts`.

Every mutating request needs an allow-listed `Origin` header and, where marked, a session cookie.

## Errors

```json
{ "errorCode": "OTP_EXPIRED", "messageFa": "کد منقضی شده است؛ کد تازه بگیرید.", "requestId": "…" }
```

`details: [{path, message}]` is added for `VALIDATION_FAILED`; `retryAfterSeconds` (+ `Retry-After` header) for
rate limits. Codes: `VALIDATION_FAILED 400`, `INVALID_MOBILE 400`, `OTP_INVALID 400`, `OTP_EXPIRED 400`,
`OTP_ALREADY_USED 400`, `OTP_TOO_MANY_ATTEMPTS 429`, `OTP_RESEND_TOO_SOON 429`, `RATE_LIMITED 429`,
`UNAUTHENTICATED 401`, `FORBIDDEN 403`, `CSRF_ORIGIN_REJECTED 403`, `NOT_FOUND 404`, `OTP_DELIVERY_FAILED 502`,
`SERVICE_UNAVAILABLE 503`, `INTERNAL_ERROR 500`; tables: `NOT_PARTICIPANT 403`, `INVITE_REQUIRED 403`,
`PREMIUM_REQUIRED 403`, `TABLE_FULL / TABLE_NOT_OPEN / ALREADY_JOINED / GAME_NOT_ACCEPTING_TABLES / TURN_TABLE_LIMIT /
ALREADY_IN_LIVE_TABLE / COMMAND_ID_REUSED / INCIDENT_ALREADY_OPEN 409`, `MODE_NOT_SUPPORTED / RANKED_NOT_AVAILABLE /
INVALID_TIME_SETTING 400`; social: `BLOCKED / DM_NOT_ALLOWED / CHAT_RESTRICTED / ACCOUNT_SUSPENDED / NOT_A_MEMBER /
MANAGER_REQUIRED / OWNER_REQUIRED / INVITE_ONLY 403`, `ALREADY_QUEUED / TICKET_NOT_ACTIVE / ALREADY_FRIENDS / SLUG_TAKEN /
TUTORIAL_DISABLED / APPEAL_EXISTS 409`, `CANNOT_TARGET_SELF 400`; billing: `PAYMENT_UNAVAILABLE / SEASON_CLOSED 409`,
`PAYMENT_PROVIDER_ERROR 502`. Matchmaking body now takes `competition` (`friendly` | `ranked`).

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health/live` | — | process up |
| GET | `/health/ready` | — | DB + schema; 503 when not ready |
| POST | `/auth/otp/request` | — | `{mobile}` → `{challengeId, expiresAt, resendAfterSeconds, fixtureDelivery}` |
| POST | `/auth/otp/verify` | — | `{challengeId, code}` → `{isNewUser}` + session cookie |
| POST | `/auth/logout` | cookie | revoke session → 204 |
| GET | `/me` | user | private view: profile + `mobileMasked`, `roles`, `profileCompleted` |
| PATCH | `/me/profile` | user | `{displayName, avatarKey}` |
| GET | `/users/:id` | — | public profile: `id, displayName, avatarKey, joinedAt` only |
| GET | `/games` | — | active catalog; query `q, players, maxMinutes, difficulty, mode, access` |
| GET | `/games/:id` | — | detail: rules, players, time, modes, access, timeout/resign policy, tutorial, active version, `acceptingNewTables` |
| GET | `/admin/games` | admin | all games incl. draft/suspended |
| PATCH | `/admin/games/:id` | admin | `{status, reason}`; audited; suspension hides from catalog and blocks new tables, keeps history |
| GET | `/status` | — | open platform incident, if any |
| POST | `/tables` | user | create `{gameId, pace, capacity, turnSeconds, visibility='private', competition='friendly', reminders}` → 201 `{id}` |
| GET | `/tables?gameId=` | user | open public tables |
| GET | `/tables/:id` (`/view`) `?invite=` | user | authorized snapshot `{table, game, incident, serverTime}`; private tables: members, or lobby-only with invite |
| POST | `/tables/:id/join` | user | `{inviteCode?}` |
| POST | `/tables/:id/leave` | user | before start only |
| POST | `/tables/:id/ready` | user | `{ready}`; full + all ready → game starts atomically |
| POST | `/tables/:id/commands` | participant | `{commandId, expectedRevision, action}` → `{status, revision, errorCode, duplicate, snapshot}` |
| GET | `/tables/:id/commands/:commandId` | user | receipt lookup `{found, status?, revision?, errorCode?}` |
| GET | `/me/tables` | user | open/active/recent tables with `isMyTurn`, deadline |
| GET / POST | `/me/notifications`, `/me/notifications/read` | user | in-app notifications |
| POST | `/tutorials/:gameId/start` `{restart?}`, `/tutorials/:gameId/skip` | user | interactive tutorial table (resume/replay/skip) |
| GET | `/me/tutorials` | user | tutorial progress |
| POST | `/admin/incidents`, `/admin/incidents/close` | admin | freeze / compensate deadlines (audited) |
| GET / PATCH | `/admin/game-versions?gameId=`, `/admin/game-versions/:id` | admin | publish/retire versions for new tables (audited) |
| PATCH | `/admin/games/:id/tutorial` | admin | enable/disable the interactive tutorial (audited) |
| POST | `/matchmaking/tickets` | user | `{gameId, pace, playerCount, turnSeconds}` → 201; one active ticket per player |
| GET | `/me/matchmaking` | user | tickets with wait, window, matched table, ready deadline |
| DELETE | `/matchmaking/tickets/:id` | user | leave queue, or decline a proposed match |
| GET | `/users?q=`, `/users/:userId/card` | user | find players; profile + relationship |
| GET | `/me/friends` | user | friends, incoming/outgoing requests, blocked, muted |
| POST / DELETE | `/friends/requests`, `/friends/requests/:userId/accept`, `/friends/:userId` | user | request, accept, remove/decline/cancel |
| POST / DELETE | `/blocks`, `/blocks/:userId`, `/mutes`, `/mutes/:userId` | user | block/unblock, mute/unmute |
| GET / PUT | `/me/settings` | user | DM policy and notification preferences |
| POST | `/tables/:id/invites` | participant | `{userId}` (friend or community member) or `{groupId}` |
| POST | `/conversations/direct` | user | open/reuse a DM (friends-only by default) |
| GET | `/me/conversations` | user | DM, group and club conversations with unread flag |
| GET / POST | `/conversations/:id/messages` (`?before=&limit=`) | member | paginate / send |
| GET / POST | `/tables/:id/chat` | participant | table chat |
| DELETE | `/messages/:id` | sender / scope manager / moderator | remove (audited when not the sender) |
| POST / GET | `/groups`, `/me/groups`, `/groups/:id` | user / member | create, list, view |
| POST / DELETE | `/groups/:id/invites`, `/groups/:id/accept`, `/groups/:id/members/:userId` | manager / invitee / self | membership |
| GET / POST | `/clubs?q=`, `/clubs` | user | directory, create |
| GET / PATCH | `/clubs/:slug` | user / manager | public page, edit (audited) |
| POST | `/clubs/:slug/join`, `/clubs/:slug/invites`, `/clubs/:slug/requests/:userId/(approve|reject)` | user / manager | membership |
| PATCH / DELETE | `/clubs/:slug/members/:userId` | owner / manager / self | role change (owner only), remove, leave |
| POST / GET | `/reports`, `/me/reports`, `/me/sanctions`, `/appeals` | user (also suspended) | report, outcomes, sanctions, appeal |
| GET / POST | `/mod/reports`, `/mod/reports/:id`, `/mod/reports/:id/resolve` | moderator | queue, evidence (audited), decision |
| GET / POST | `/mod/appeals`, `/mod/appeals/:id/decide`, `/mod/audit` | moderator | appeals, audit history |
| POST | `/me/notifications/:id/read` | user | mark one notification read |
| GET | `/me/progression` | user | ratings (provisional/eligible/league), level/XP, mastery, weekly missions, achievements, ledger with reasons |
| GET | `/me/rewards?tableId=` | user | rating change and rewards of one finished table (after the game) |
| GET | `/games/:id/leaderboard?mode=&seasonId=` | user | eligible players by skill; closed seasons show frozen placements |
| GET | `/seasons`, `/users/:userId/achievements` | — / user | seasons; public achievements + level |
| GET | `/me/stats/history` (free), `/me/stats/trends` (premium) | user | ranked history; weekly trend and season comparison |
| POST | `/admin/seasons`, `/admin/seasons/:id/(activate|close|corrections)`, `/admin/rewards` | admin | seasons, freeze, audited correction, manual XP |
| GET | `/plans` | — | plans, terms, purchasable + reason, checkout availability (`fixture` flag) |
| POST | `/subscriptions/checkout` | user | `{planId}` → `{orderId, redirectUrl}` |
| GET | `/payments/callback?provider=&authority=` | — | gateway return; server-side verify, then redirect to the result page |
| GET / POST | `/payments/:orderId`, `/payments/:orderId/verify` | owner | status; re-check pending (recovery) |
| GET | `/me/subscription` | user (also suspended) | premium until, autoRenew=false, subscriptions, payments |
| POST | `/payments/fake/:authority/decision` | owner, **dev only** | fake gateway outcome; 404 unless the fake gateway is configured |
| GET / PATCH | `/admin/plans`, `/admin/plans/:id` | admin | price/terms/availability (audited) |
| POST / DELETE | `/admin/entitlements`, `/admin/entitlements/:id` | admin | manual premium grant/revoke (audited) |
| GET | `/admin/payments` | admin | recent payments |
| PATCH | `/admin/games/:id/access` | admin | free/premium + host-invites-free (audited) |
| GET / PUT | `/admin/games/:id/settings` | admin | module bounds + offered modes, player range, time budgets and rule variants; PUT validated against the active version's manifest, audited (`game.settings`); new tables only |
| GET | `/admin/subscriptions?userId=` | admin | subscriptions + manual grants for support (phase 04) |
| GET / PATCH | `/admin/missions`, `/admin/missions/:id` | admin | list / activate-deactivate mission definitions `{active, reason}` (audited, phase 04) |
| GET | `/mod/audit?action=&targetType=&targetId=&actorId=` | admin, moderator | audit history with filters (`action` is a prefix) |
| GET | `/metrics` | bearer `METRICS_TOKEN` | Prometheus text, aggregates only; disabled in production without a token and **not routed by the public proxy** (docs/OPERATIONS.md) |

Search normalizes Persian/Arabic forms (ی/ي/ى, ک/ك, ه/ة, diacritics, ZWNJ, Persian digits) on both stored
`search_text` and the query; LIKE wildcards in the query are escaped.

## Realtime (Socket.IO, path `/api/socket.io`)

Handshake requires an allow-listed Origin and a valid session cookie (`connect_error: UNAUTHENTICATED`
otherwise). `session.ready {userId, serverTime}` on connect; names reserved for phase 02: `presence.changed`,
`message.created` (pushed to each authorized member's own room). Client events (with ack): `table.subscribe {tableId, inviteCode?}` → `{ok, snapshot}`; `table.command
{commandId, tableId, expectedRevision, action}` → `{ok, status, revision, errorCode, duplicate, snapshot}` (no actor
field accepted); `table.unsubscribe`. Server events: `table.snapshot` (per-viewer projection after every committed
change), `notification.created`. Game-level rejection codes and Persian texts: `GAME_ERRORS_FA` in contracts.
See docs/SOCIAL_AND_MODERATION.md, docs/PROGRESSION.md and docs/PAYMENTS.md.
