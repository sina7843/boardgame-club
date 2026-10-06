# Matchmaking, social features, notifications and moderation

Code: `packages/play/src/matchmaking.ts`, `packages/play/src/jobs.ts` (consumers), `apps/api/src/modules/social/*`,
`apps/api/src/modules/moderation/routes.ts`, `apps/api/src/modules/matchmaking/routes.ts`.

## Matchmaking

- Queue key: game × pace × player count × time per turn. Friendly only until the rating service exists (DRAGON-03).
- **One active ticket per player** (partial unique index on `matchmaking_tickets(user_id) where status in
  ('queued','matched')`). A queued/matched live ticket also blocks creating/joining another live table, and an
  open/active live table blocks queueing for live play.
- Skill estimate: `ratings.mu` for the game/pace when it exists, otherwise the **documented baseline 1500**. Window =
  `min(400, 100 + 50 × ⌊wait / step⌋)` with step 10 s (live) / 60 s (turn-based). All values are in
  `defaultMatchConfig` and are tunable defaults, not tested commercial policy.
- Matching runs immediately after each enqueue and every 2 s in the worker, under a per-queue advisory lock with
  `FOR UPDATE SKIP LOCKED` on tickets. The oldest ticket anchors a group; players who blocked each other are never
  grouped.
- A match creates a private friendly table (`is_matchmade`), seats in queue order, tickets → `matched`, a `ready`
  deadline (30 s live / 15 min turn-based) and a `match.found` notification.
- Accepting = «آماده‌ام» on the table. When all accept, the game starts in the same transaction, after re-checking
  that the game still accepts tables and no player is suspended; tickets → `started`.
- Decline (cancel a matched ticket, or leave the lobby): the table is cancelled and **everyone else is re-queued with
  their original queue time**. Ready deadline: players who accepted are re-queued, the others leave the queue and get
  a `ready_no_show` behaviour signal (information only).
- Tickets expire after 15 min (live) / 24 h (turn-based) in the queue.

## Relationships and privacy

- Friend request → accept / decline / cancel / remove. A pending reverse request is accepted automatically.
- **Block** (either direction) prevents: friend requests, starting or continuing a DM, table and group invitations,
  joining a table with that person, being matched together. Blocking removes the friendship and pending table
  invitations. Being blocked is never revealed (shown as "none").
- **Mute** hides the muted user's messages and notifications for the muter only.
- DMs: **friends-only by default**; the user can choose "nobody". Checked on every send, not only on creation.

## Chat

Conversations: direct, table (participants only; never in tutorials), group and club (active members). Access is
recomputed on every request and every push — there are no client-joinable chat rooms; pushes go to each authorized
member's own `user:{id}` room after commit (PostgreSQL NOTIFY). Text is stored plain after removing control and
bidirectional-override characters, collapsing blank lines and trimming; the UI renders it as text only. Pagination
uses a `before` cursor (30 per page). Messages can be removed by the sender, a group/club owner/manager in their own
conversation, or a moderator — removal is audited when not by the sender.

## Groups and clubs

| | Group | Club |
|---|---|---|
| Visibility | members and invitees only | public page; pending list for managers only |
| Join | invitation by owner/manager (friends only), accept | open / request (managers approve) / invite only |
| Roles | owner, manager, member | owner, manager, member; only the owner changes roles |
| Removal | owner removes anyone but themself; managers remove members | same |
| Extra | quick invite of the whole group to a table | club chat with scoped moderation; edits audited |

## Notifications (FR-13)

Delivery path: domain transaction writes an outbox event → worker claims it with a lease → consumer inserts a
notification with a **unique dedupe key** (`ON CONFLICT DO NOTHING`) → NOTIFY → socket push to `user:{id}` and
optional browser notification.

| Kind | Source topic | Dedupe key | Preference |
|---|---|---|---|
| turn / reminder | `table.turn` / `table.reminder` (turn-based only) | `turn:{table}:{rev}:{user}` | turn |
| finished | `table.finished` | `finished:{table}:{user}` | result |
| invite | `table.invited` | `invite:{table}:{user}` | invite |
| match | `match.found` | `match:{table}:{user}` | invite |
| message | `message.created` (DMs only) | `message:{message}:{user}` | message |
| friend_request | `friend.requested` | `friend:{pair}:{requestTime}:{user}` | social |
| club | `club.requested` | per event and manager | social |

Rules: preferences are checked per recipient; muted/blocked actors never trigger notifications; payloads contain only
ids, game name and actor display name — **never hidden game state or message text**. The client renders a fixed
Persian sentence and a link (`href`); the destination page re-checks authorization (an invited user reaches the
private lobby through `table_invites`). Read state is stored per notification. Browser notifications are opt-in from
Settings; permission is requested only from that user gesture.

## Moderation (Requirements §16, FR-16)

- Anyone can report a user, display name, message (only one they could read) or table (as a participant), with a
  reason code, text and optional evidence reference. Reporting yourself is refused.
- Moderators (`moderator` role; admin implies it) see a queue and, per report, **only the evidence of that report**:
  for a message, it and up to three messages on each side; for a table, public facts and the canonical result (never
  internal state); 30-day behaviour signals and prior sanctions. Opening a report is audited (`report.view`).
- Decisions: dismiss, warning, chat restriction or suspension with optional duration; audited (`report.resolve`).
- Enforcement is server-side: suspension → every endpoint except `/me`, `/me/sanctions`, `/me/reports`, `/appeals`
  and `/reports` returns `ACCOUNT_SUSPENDED`, socket connections are refused, and a suspended player cannot start a
  table; chat restriction → `CHAT_RESTRICTED` on every send. Running tables and history are kept.
- Appeals: one per sanction, allowed while suspended; decided by **a different moderator** than the one who issued
  the sanction (admins excepted); revoke lifts the sanction immediately. Audited (`appeal.decide`).
- Behaviour signals (`timeout_loss`, `resigned`, `ready_no_show`) are recorded for moderators only. There is no
  automatic penalty; deadlines are frozen and compensated during platform incidents, so system failures do not
  produce timeout signals.
- Admin product controls (UI `/admin`): suspend/reactivate a game for new tables, enable/disable its tutorial,
  activate/retire rules versions for new tables, open/close a platform incident. All audited.
