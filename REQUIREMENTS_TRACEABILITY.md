# Requirement evidence

| Requirement | Implementation phases | Status | Evidence / command / blocker |
|---|---|---|---|
| FR-01 | 00, 02 | PARTIAL — blocked on SMS provider | OTP limits, masked/redacted mobile, display name + avatar (00); display name reportable with moderation decisions (02: `social.test.ts`). Blocker: real SMS provider (production refuses the fixture — verified in 04). |
| FR-02 | 00, 02 | DONE | Catalog search/filters with ی/ي ک/ك (00); same normalization for player and club search (02). |
| FR-03 | 00, 01 | DONE | Detail shows rules/players/time/modes/access/policies; interactive tutorial reachable from detail (`e2e/play.spec.ts` tutorial). |
| FR-04 | 01, 02 | DONE | Server-side interactive tutorials with skip/replay/resume (01); discovery → tutorial → queue flow and admin tutorial toggle (02: `e2e/social.spec.ts`). |
| FR-05 | 01, 02 | DONE | Public/private, friendly/ranked (ranked via matchmaking), live/turn, invitations, premium access per game: tables/social/billing tests. |
| FR-06 | 02, 03 | DONE | Queues incl. ranked with skill window on real ratings, no premium priority: `matchmaking.test.ts`, `billing.test.ts`. |
| FR-07 | 01 | DONE | Server-only rules; invalid actions never mutate; per-viewer projections; module-decided outcome: engine tests, `tables.test.ts` command service, `play-integrity.test.ts` hidden information. |
| FR-08 | 01, 04 | DONE | Snapshot on (re)subscribe, receipt lookup, «در انتظار تأیید» UI, no auto-resubmit after stale: `tables.test.ts` receipt/restart, `apps/web/src/lib/useTableSession.ts`, docs/ENGINE_PROTOCOL.md. 04: missed-push race on subscribe fixed (join before read); duplicate resends under load returned identical receipts. |
| FR-09 | 01, 04 | DONE | Server deadlines with token+expectedRevision, timeout race, stale deadline, policies before ready, incident freeze/compensation: `tables.test.ts` deadlines, `play-integrity.test.ts` incident. 04: deadlines due during a DB outage executed after restore. |
| FR-10 | 01, 03 | DONE (implementation) | Result, reason, rating change and rewards stored; redelivery/reordering applies once: `progression.test.ts`, e2e result rewards. |
| FR-11 | 02 | DONE | Friend request/accept/remove, block, report, mute; DMs friends-only by default: `social.test.ts`, `e2e/social.spec.ts`. |
| FR-12 | 02 | DONE | Groups and clubs with owner/manager/member, open/request/invite, server-side permissions: `social.test.ts` groups/clubs, e2e club flow. |
| FR-13 | 01, 02 | DONE | In-app turn/invite/message/result (+ match/friend/club) notifications, preferences, optional browser notifications, no hidden info, idempotent: `social.test.ts`, `play-integrity.test.ts`. 04: turn-based return via «نوبت من» E2E. |
| FR-14 | 03 | DONE (implementation) | XP, missions, leagues, achievements from server events with explained reasons; values are tunable defaults: `progression.test.ts`, docs/PROGRESSION.md. |
| FR-15 | 03 | IMPLEMENTED — production BLOCKED | Server-verified activation, idempotent callbacks, expiry never stops a started game, renewal/recovery, tested with the dev-only fake gateway (`billing.test.ts`, e2e). Blocker: no real gateway/credentials/prices; no real money tested. |
| FR-16 | 01, 02, 03, 04 | DONE | Games/versions/tutorials, suspend new tables keeping history, seasons + correction, plans/prices, game access, missions (04), subscriptions/manual grants view (04), payments, reports/moderation, audit history with filters (04), platform incident, health/metrics (04): `ops.test.ts`, `billing.test.ts`, `progression.test.ts`, `social.test.ts`; admin denial E2E (04). |
| NFR-01 | 01, 04 | DONE (local) | Hidden bid absent from opponent/spectator HTTP + socket payloads, logs, outbox and metrics; 3-player E2E checks each client's payload; 0 violations in ~72 k projection checks under load (docs/QA_REPORT.md). No analytics pipeline exists. |
| NFR-02 | 01, 04 | DONE (local) — production restore BLOCKED on target infra | Restart recovery (01; worker restart under load 04); encrypted base backup + WAL restore drill with identical receipts/revisions/results/ledger, deadline + outbox resume, no duplicate rewards (`docs/evidence/phase-04/backup-restore-drill.log`). Blocker: off-host storage + drill on target. |
| NFR-03 | 04 | MEASURED — target met up to the documented bound | Server command time excl. network ≤ 250 ms for 99.6 % at 190 live players (A), 96 % at 398 (B), 44 % at 600 (C) on an i7-12650H laptop; profiles/hardware in docs/QA_REPORT.md#load. Not measured on production hardware. |
| NFR-04 | 04 | MEASURED (local) | Connections, tables and moves/s reported separately (QA_REPORT); safe limited-release bound ≤ 150 concurrent live players / ≤ 200 sockets per API instance; no capacity claim beyond tests. |
| NFR-05 | 04 | DEFINED — UNVERIFIED | 99.5 % monthly target, measurement method, maintenance and incident rules in docs/OPERATIONS.md; not claimed achieved (no production). |
| NFR-06 | 00, 01, 02, 04 | DONE (automated) | axe WCAG 2.1 A/AA: 0 violations on 21 pages × 4 widths; keyboard smoke; labelled controls, text+icon state (docs/evidence/phase-04/a11y-*.json). Manual screen-reader pass not done. |
| NFR-07 | 00, 01, 02, 04 | PARTIAL — devices UNVERIFIED | Chromium at 360/768/1440/1920 incl. 92 phase-04 screenshots. Safari iOS and Chrome Android NOT tested (no devices); not substituted by viewport emulation. |
| NFR-08 | 04 | DONE (local) — BLOCKED for production | age-encrypted WAL archive + base backups, key never on DB host, restore drill RPO 32 s / RTO 19.5 s vs 15 min / 4 h targets; retention/access/key custody documented. Blocker: off-host storage, target-environment drill, cost approval. |

Phase 04 re-audited FR-01..FR-16 and NFR-01..08 against the PRD; no requirement is omitted without an explanation
above. External blockers: docs/KNOWN_LIMITATIONS.md.
