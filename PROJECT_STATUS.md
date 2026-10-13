# Boardgame Web App — prompt progress

Exactly five phases; 00 → 01 → 02 → 03 → 04. Only check after acceptance. 00–03 accepted 2026-10-06; 04 accepted
as a **local release candidate** 2026-10-06 (evidence in IMPLEMENTATION_STATUS.md and docs/QA_REPORT.md).

- [x] DRAGON-00
- [x] DRAGON-01
- [x] DRAGON-02
- [x] DRAGON-03
- [x] DRAGON-04 (local candidate)

Local candidate: complete — all local mandatory checks pass (lint, typecheck, build, 134 tests, E2E at four widths,
axe, production-image smoke, load profiles, encrypted backup/restore drill).

Public release readiness: **NOT READY** — blocked by: real SMS provider; real payment gateway, credentials and
approved prices; hosting/domain; off-host backup storage, key custody and a restore drill on the target; real-device
tests (Safari iOS, Chrome Android); load test on target hardware; owner decisions on catalog/branding.
Checklist: docs/RELEASE_CHECKLIST.md (Gate B).

Owner-requested extension in progress: bot opponents «بازی با ربات» — waves 0–3 done locally (17 games); waves 4–11 pending (see DECISIONS.md).
Owner-requested extension: tournaments «تورنمنت» — done locally 2026-10-13 (Toman entries untested against the real gateway).
Owner-requested extension: encyclopedia «دانشنامه» (/wiki + section on each game page) from a BoardGameGeek snapshot with Persian translations — done locally 2026-10-13; e2e/wiki.spec.ts passes on all four viewports.

Owner-requested extension: chat upgrades «گفت‌وگو» (quick chat, bubbles, seen/typing, replies/edits, unread badge, flood guard, slow mode, word filter) — done locally 2026-10-13.

Next eligible phase: none (five prompts complete). Remaining work is owner/provider/infrastructure decisions.
