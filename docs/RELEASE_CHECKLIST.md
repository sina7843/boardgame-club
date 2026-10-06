# Release checklist

Two gates. **Gate A** is what this repository can prove locally (done for the phase-04 candidate, see
[QA_REPORT.md](QA_REPORT.md)). **Gate B** needs the owner's decisions and a real environment; until every Gate B
item is checked, the product is a *limited-release candidate*, not ready for the public.

## Gate A — local candidate (evidence in QA_REPORT.md)

- [x] `pnpm install --frozen-lockfile`; lint, typecheck, build clean
- [x] Unit + integration tests pass (API against PostgreSQL 18.6)
- [x] E2E (Playwright Chromium) at 360 / 768 / 1440 / 1920 incl. release spec
- [x] axe WCAG 2.1 A/AA: no violations on 21 pages × 4 widths; keyboard smoke
- [x] Production images build from the lockfile; non-root, read-only FS, internal DB network
- [x] Production config fails closed (fixture OTP, fake payments, placeholder secrets, http origins)
- [x] Reverse proxy: HTTPS-ready, WebSocket, CSP/security headers, metrics not routed publicly
- [x] Load profiles with both games, hidden info, concurrency, reconnects, worker restart; bound documented
- [x] Encrypted backup + WAL restore drill: data identical, RPO/RTO measured, deadlines/outbox resume, no duplicate rewards
- [x] Migrations apply on an empty database; seed has no user/fixture data

## Gate B — before public release (owner / environment)

- [ ] SMS provider chosen, adapter implemented and tested (delivery, throttling, cost alerts)
- [ ] Payment gateway adapter + merchant account; sandbox and one real low-value payment verified end to end; reconciliation checked against the provider
- [ ] Plan prices approved and set in admin (audited)
- [ ] Launch catalog, branding, legal pages per owner decision
- [ ] Hosting chosen; DNS + TLS; secrets in the platform secret store; `METRICS_TOKEN`, `TRUST_PROXY_HOPS` set
- [ ] Off-host encrypted archive sync configured; private backup key with two custodians; **restore drill repeated on the target** with measured RPO ≤ 15 min, RTO ≤ 4 h
- [ ] Load test repeated on target hardware; capacity limits and alert thresholds set from those numbers
- [ ] External uptime probe (HTTP + WebSocket) running; alerting to a person on call
- [ ] Real-device test: Safari iOS (current + previous major), Chrome Android (mid-range device), incl. login, both games, reconnect after network switch
- [ ] Staff roles granted (owner admin, moderators) via `grant-role`; moderator guide reviewed
- [ ] Rollback rehearsal: deploy previous tag against the new schema

## Every release

1. CI green on the tagged commit; changelog written.
2. Base backup taken; `pnpm db:generate` produced no unexpected diff; migration reviewed as additive.
3. `migrate` exits 0; rolling restart of `api`/`worker`; `web` last.
4. Smoke: readiness, login, one move in each game, metrics sane (`bg_module_failures_total` flat, no overdue deadlines).
5. Watch p95 command time, 5xx, outbox age for 30 min; rollback = previous image tag.
