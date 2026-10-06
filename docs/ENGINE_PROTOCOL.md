# Engine and command protocol

How a move travels from a browser to durable state and back, and how the system recovers from failures.
Code: `packages/game-engine` (pure engine), `packages/play` (authoritative runtime shared by API and worker),
`apps/api/src/modules/tables`, `apps/api/src/realtime/socket.ts`, `apps/worker`.

## Layers

| Layer | Knows about | Never touches |
|---|---|---|
| Game module (`games/*/src/rules.ts`) | its own state, actions, rules | network, DB, clock, `Math.random`, users |
| Engine (`@bg/game-engine`) | modules, seeded RNG, replay, projection | HTTP, DB, commerce |
| Play runtime (`@bg/play`) | tables, seats, receipts, deadlines, outbox, results | rule details (only calls the module) |
| Transports (API HTTP, Socket.IO) | sessions, schemas | game state (only snapshots built by `buildTableSnapshot`) |

## Command envelope

```
POST /api/tables/:id/commands          socket: emit('table.command', {...}, ack)
{ commandId: uuid, expectedRevision: int, action: { type, ... } }      (+ tableId on the socket)
```

The actor is **never** in the envelope (`strictObject` rejects `actorId`/anything extra). It is the seat of the
session user, looked up inside the transaction. HTTP and Socket.IO call the same `executeCommand()`.

Response: `{ status: accepted|rejected, revision, errorCode, duplicate, snapshot }` where `snapshot` is the
caller's authorized view. Errors that are not game decisions (not a participant, reused commandId, validation)
are HTTP 4xx / `ack {ok:false}` with the standard `{errorCode, messageFa}`.

## Processing order (one PostgreSQL transaction)

1. `SELECT … FROM game_tables WHERE id = $1 FOR UPDATE` — serializes every command, timeout and lifecycle change
   of this table.
2. Participant lookup → `NOT_PARTICIPANT` (403) if the session user has no seat.
3. Receipt lookup by `(table_id, actor_id, command_id)`:
   - exists with the same payload hash → return the **original receipt** (`duplicate: true`) — this happens
     **before** any revision check, so a retried accepted command never turns into `STALE_REVISION`;
   - exists with a different payload hash → `COMMAND_ID_REUSED` (409).
4. Table not active → rejected `TABLE_NOT_ACTIVE`.
5. `expectedRevision ≠ table.revision` → rejected `STALE_REVISION` + current permitted snapshot.
6. Tutorial tables: action must equal the script's expected step (`TUTORIAL_EXPECTED_OTHER`).
7. Engine: runtime schema (`INVALID_ACTION`) → `module.validate` (game codes) → `module.apply`.
   Rejections never write a snapshot.
8. `persistStep`: new snapshot (state + RNG) at revision+1, engine input + internal events, deadline changes,
   canonical result (unique per table) when finished, outbox events, `pg_notify('table_changed')`.
9. Receipt row (accepted or rejected) — so every retry of the same command gets the same answer.

Commit. PostgreSQL delivers `NOTIFY` only after commit; the API then pushes a **fresh per-viewer projection** to
every subscribed socket. Nothing is broadcast before it is durable, and raw state, internal events, RNG and seed
never leave the server.

## Deadlines

- Modules request `{kind:'set'|'clear', deadlineKey:'turn'}`; the runtime turns `set` into a row in
  `scheduled_deadlines` with a fresh `token`, `expected_revision = new revision` and `due_at = now() + turnSeconds`.
  Turn-based tables with reminders also get a `reminder` row (¼ of the turn before the deadline, max 6 h).
- A step without schedule changes (e.g. one sealed bid in a round) carries the pending deadline forward to the new
  revision; a `set`/`clear` cancels the old rows. A partial unique index allows one pending row per key per table.
- The worker polls due rows (default every second) and calls `fireDeadline`: lock the **table** first (same order
  as commands → no deadlock, moves and timeouts serialize), re-read the deadline, and fire only if it is still
  pending and `expected_revision == table.revision`; otherwise mark it cancelled (stale). Timeout input records the
  deadline token.
- Server time is authoritative; snapshots carry `deadline.dueAt` and `serverTime`, the client corrects for clock
  skew and only displays the countdown.

## Platform incidents vs. personal disconnects

- A player's own disconnect changes nothing on the server: the clock keeps running; on reconnect the client
  re-subscribes and receives the latest committed snapshot. This policy is shown in the lobby before «آماده‌ام».
- An admin can open a **platform incident** (`POST /api/admin/incidents`): the worker stops firing deadlines and
  snapshots show `deadline.frozen` + the incident banner. Closing it extends every pending deadline by the incident
  duration (`due_at += ended_at − started_at`) and is audited.

## Reconnect and unconfirmed commands (client)

`apps/web/src/lib/useTableSession.ts`:

- one command in flight; renderers receive `busy`;
- network failure with no response → state «در انتظار تأیید»; the client polls
  `GET /api/tables/:id/commands/:commandId` until the receipt is found (then shows the real outcome);
- the user may explicitly resend **the same** command (same `commandId` + `expectedRevision`) — idempotent;
- `STALE_REVISION` replaces the view with the fresh snapshot and shows a message; nothing is resubmitted
  automatically;
- on every socket (re)connect the table is re-subscribed and the ack returns the current snapshot, so missed pushes
  (Socket.IO is at-most-once) never prevent recovery. Out-of-order pushes with an older revision are ignored.

## Outbox (at-least-once, idempotent consumers)

`runOutbox` claims a batch with `FOR UPDATE SKIP LOCKED` and a lease (`claimed_until`, default 60 s), runs the
consumer outside the claim transaction, then sets `processed_at`. A crashed worker's lease expires and the event is
delivered again; failures back off exponentially (max 10 min). Topics without a registered consumer stay queued.

| Topic | Payload (public only) | Consumer |
|---|---|---|
| `table.turn` | tableId, revision, gameId, userIds to act | in-app notification, dedupe `turn:{table}:{rev}:{user}` |
| `table.reminder` | same | notification, dedupe `reminder:…` |
| `table.finished` | tableId, resultId, gameId, rulesVersion, pace, competition, placements(+userId), reason | notification, dedupe `finished:{table}:{user}`; rating/rewards in DRAGON-03 |
| `tutorial.completed` | userId, gameId, tableId | none yet (DRAGON-03 XP) |

## Durability and recovery notes

| Failure | What happens |
|---|---|
| API crash before commit | transaction rolls back; client has no response → receipt lookup says `found:false` → user may resend the same command safely |
| API crash after commit, before response | receipt exists → lookup / resend returns the original result (`duplicate:true`) |
| API restart | all state is in PostgreSQL; a new process serves the same revision (integration-tested) |
| Worker crash while firing a deadline | the per-deadline transaction rolls back; the deadline is still pending and fires on the next poll |
| Worker crash while consuming outbox | lease expires; event redelivered; consumers deduplicate |
| Two workers | `SKIP LOCKED` for the outbox; table lock + status re-check for deadlines |
| Old timer after a move | `expected_revision` mismatch or `cancelled` status → stale, never applied |
| Socket message lost | next push or reconnect delivers a full authorized snapshot |
| PostgreSQL loss | backup/restore plan and test are phase 04 (NFR-08) |

## Deterministic replay

Each revision stores the engine input (`game_events.seq = 0`, type `input`: start seed / seat + action + logical
time / timeout token) and the RNG state after the step. `replay(module, {playerCount, seed}, inputs)` reproduces the
exact state and RNG (unit-tested). Internal events and inputs may contain hidden information and are for debugging
only — not exposed to clients or analytics. Public replay is a later feature.

## Version pinning

A table stores `game_version_id` at creation; its `rulesVersion`, `stateSchemaVersion` and `clientBundleRef` never
change. The engine resolves `gameId@rulesVersion` from the reviewed registry; the web resolves the renderer by
`clientBundleRef`. Publishing/retiring versions only changes which version **new** tables get. See
docs/ADDING_A_GAME.md for rollout and rollback.
