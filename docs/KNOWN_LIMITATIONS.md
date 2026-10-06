# Known limitations (release candidate, phase 04)

Status words: **BLOCKED** = cannot go to public production until resolved; **UNVERIFIED** = built but not tested
where it matters; **LIMIT** = deliberate bound of this delivery.

## Release blockers (external / owner decisions)

| Item | Status | What is needed |
|---|---|---|
| SMS / OTP provider | BLOCKED | Only the development fixture exists; production refuses to start with it. Choose a provider, implement the `OtpDelivery` adapter, test delivery, rate limits and costs. |
| Payment gateway | BLOCKED | Only the labelled development fake gateway exists (refused in production). Real gateway adapter, merchant credentials, sandbox + real-money test, reconciliation with the provider's API. |
| Prices and plans | BLOCKED (owner) | Plans are seeded inactive with no price; an admin must set approved prices. Currency is stored in Rial; Toman display is a product decision. |
| Hosting, domain, TLS | BLOCKED (owner) | No target environment exists. Deployment is documented (Compose / optional Coolify) but not performed. |
| Off-host backup storage | BLOCKED (owner) | Encrypted WAL archive works locally; it must be synced to independent storage, and the private backup key needs named custodians. RPO/RTO must be re-measured there. |
| Launch catalog and branding | Owner decision | The two games (Line Three, Sealed Bids) are labelled test games; final catalog, names, artwork and copy need approval. |
| Real devices | UNVERIFIED | Safari on iOS and Chrome on Android were **not** tested. Playwright Chromium emulation at 360/768/1440/1920 is not a substitute. |
| Availability 99.5 % | UNVERIFIED | Measurement method is defined (docs/OPERATIONS.md); no production uptime exists to measure. |

## Capacity and performance

- One API process saturates at ≈ 80 accepted moves/s on the test laptop; p95 server command time stays under
  250 ms up to ≈ 190 concurrent live players at a 1.5 s mean think time, not at 400+. Safe limited-release bound:
  **≤ 150 concurrent live players per API instance**. Multi-instance API is designed for (pushes via PostgreSQL
  NOTIFY) but UNVERIFIED.
- Load generator, proxy, API, worker and database shared one laptop (Docker Desktop on Windows); production
  hardware will differ — re-run `apps/api/load/loadtest.ts` on the target before raising limits.
- Each accepted move costs one command transaction plus one snapshot read for the actor's acknowledgement and one
  shared read for subscribers; per-viewer projection runs in the event loop. Further optimisation options:
  return the projected view from the command transaction, cache static table metadata.

## Product scope (deliberately out)

AI opponents, native apps, voice chat, no-code game builder, cash tournaments, item markets, publisher/licensing
management — excluded by the requirements of this delivery.

## Technical limitations

- **Stale commands are not auto-resubmitted** (protocol choice): in simultaneous games (Sealed Bids) a player whose
  bid races another player's by a few milliseconds sees «وضعیت تغییر کرد» and submits again. Under heavy
  contention this was ~5–40 % of commands in the load test.
- **Chat pagination cursor** is millisecond-based; two messages in the same millisecond at a page boundary could be
  skipped (PostgreSQL stores microseconds).
- **CSP allows inline styles** (`style-src 'unsafe-inline'`) because React components use `style` attributes;
  scripts are strictly `'self'`.
- **Socket.IO polling fallback** with more than one API replica needs sticky sessions at the proxy (not configured;
  single replica today).
- **Metrics are per process** and reset on restart (normal for Prometheus counters); there is no bundled
  Prometheus/Grafana — operators bring their own scraper on the internal network.
- **Browser notifications** are optional and depend on the browser's permission; no push service (Web Push)
  is configured.
- **Analytics**: no analytics pipeline exists, so NFR-01's "no hidden information in analytics" is satisfied
  vacuously; any future pipeline must consume projections only.
- **Git ignore policy**: the packaged `.gitignore` excludes tests, E2E, lint config and status documents
  (see DECISIONS.md); a fresh clone would lack them until the owner decides.
