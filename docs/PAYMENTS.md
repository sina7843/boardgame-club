# Subscriptions and payment integration

Code: `packages/play/src/billing.ts` (gateway boundary, verification, activation, reconciliation, expiry),
`apps/api/src/modules/billing/routes.ts`, worker loops in `apps/worker/src/main.ts`.

## Status

- **Implemented and tested** with a development-only fake gateway: checkout, gateway redirect, callback, server-side
  verification, activation, renewal, expiry, reconciliation, failure handling and admin controls.
- **Not done (blocker):** no real Iranian gateway is integrated, no credentials exist, no prices are approved.
  `PAYMENT_PROVIDER=none` (production default) disables checkout and the UI says why; production refuses
  `PAYMENT_PROVIDER=fake`. **No real money has been processed or tested.**

## Flow

1. `POST /api/subscriptions/checkout {planId}` — plan must be active with an approved price. A `payments` row is
   created first (`pending`, amount/currency from the plan, unique `order_id`, 30-minute expiry), then the gateway
   is asked for an authority token and redirect URL.
2. The payer completes the payment on the gateway and is redirected to `GET /api/payments/callback`.
3. **The callback proves nothing.** The server locks the payment row and calls the gateway's verify API
   server-to-server. Activation requires: payment still `pending`, provider matches, gateway says paid, paid amount
   equals the order amount, and the provider reference has never been used (unique index).
4. On success: payment `verified`, a subscription starting at the later of now and the current subscription end
   (renewal extends; never shortens), a `premium` entitlement for the same window, `payment_events` and audit rows.
5. Redirect to `/payments/result?order=…`, which polls status and offers «بررسی دوباره».

| Situation | Result |
|---|---|
| duplicate callback | `already_verified`, nothing changes (one subscription) |
| forged / unknown authority / wrong provider | logged as `unknown`, no activation |
| payer cancelled / declined | `failed (DECLINED_BY_PAYER)` |
| amount differs | `failed (AMOUNT_MISMATCH)` |
| provider reference reused | `failed (DUPLICATE_REFERENCE)` |
| gateway still pending | stays `pending`; worker re-verifies every 30 s after 60 s; user can re-check |
| never confirmed in 30 min | `expired (NOT_CONFIRMED_IN_TIME)` |
| failed then later "paid" | stays failed (final states are never reopened); support can grant manually |
| gateway unreachable at checkout | payment `failed (PROVIDER_ERROR)`, `PAYMENT_PROVIDER_ERROR` shown; no charge |

No card data ever reaches this system. No automatic renewal exists; buying again extends from the current end.

## Entitlements and access

- Premium = an unrevoked `premium` entitlement whose window contains now (subscription or manual support grant).
- Per-game access (`games.access`, `premium_host_invites_free`, admin-controlled and audited):
  - creating a table for a premium game needs premium;
  - joining needs premium, or — when the game allows it — a personal invitation or the private invite link from a
    premium host;
  - public joining and matchmaking for a premium game need premium.
- **Start snapshot:** at game start each player's basis (`free_game` / `premium` / `host_invite`) is stored in
  the table settings; if the host lost premium before start, the start is refused. After start nothing is
  re-checked, so expiry or revocation never interrupts a running game.
- Turn-based concurrent table cap: 10 free / 30 premium (operational limit, configurable).
- Premium never grants rating, queue priority or in-game help. Advanced trend stats are premium; results, ratings
  and history are free.

## Admin controls (all audited)

Plan price/terms/availability, game access policy, manual premium grant/revoke with reason, manual XP with
reason, recent payments list.

## Real gateway integration checklist (before enabling production checkout)

- [ ] Product owner chooses the provider and approves monthly/yearly prices, terms text and refund policy.
- [ ] Implement `PaymentGateway` for the provider: `create` (request + authority + redirect URL) and `verify`
      (server-to-server verify returning reference id and paid amount). Map provider error codes to failure reasons.
- [ ] Store merchant credentials only in the deployment secret store; never in the repository or logs.
- [ ] Register the callback URL `https://<domain>/api/payments/callback?provider=<id>&authority=` with the provider
      and set `PUBLIC_WEB_URL`.
- [ ] Confirm currency unit (Rial vs Toman) and amount format with the provider; add a test.
- [ ] Test in the provider sandbox: success, cancel, wrong amount, duplicate verify, timeout/pending, reconciliation,
      refund/reversal handling; record results here.
- [ ] Configure request timeouts and retry policy for verify; alert on rising failure/pending counts.
- [ ] Define the reconciliation report with finance (daily payments vs provider settlement).
- [ ] Only then set `PAYMENT_PROVIDER=<id>` in production and activate the plans.
