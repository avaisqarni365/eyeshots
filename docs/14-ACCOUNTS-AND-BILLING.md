# 14 — Accounts, Billing & Quotas

EyeShots has user accounts, Stripe subscriptions and per-plan limits on cloud tasks. Everything lives in the **API gateway**, backed by **Postgres**. The web app is a pure client.

## Why the gateway, not Next.js (Auth.js)?
- **Desktop app:** the Tauri app ships the web UI as a static export with no server routes, so auth inside Next.js wouldn't work there.
- **Quotas:** they must be enforced where cloud work is accepted, which is the gateway.
- **One backend** owns identity, billing and processing, so there's a single place to audit for privacy.

**Privacy rule:** Postgres stores users, sessions, subscriptions and daily usage counters. **Never documents or file names.**

## Sign-in: passwordless email codes
| Step | Endpoint |
|---|---|
| Request a code | `POST /api/auth/request-code { email }` (same response whether or not the account exists) |
| Verify | `POST /api/auth/verify { email, code, transport? }` creates the account on first sign-in and sets the session |
| Current user | `GET /api/auth/me` |
| Sign out | `POST /api/auth/logout` · `POST /api/auth/logout-all` |

**Codes**
- 6 digits, valid for 10 minutes, single use.
- Up to 5 wrong attempts per code, and at most 5 codes per email per hour.
- Stored as HMAC-SHA256 (keyed with `AUTH_SECRET`).

**Sessions**
- A 256-bit random token. Only its SHA-256 is stored, so a database leak can't be replayed.
- 30-day sliding expiry.
- Web: `HttpOnly; SameSite=Lax; Secure` (in production) cookie, so JavaScript never sees the token.
- Desktop/API: `transport: "bearer"` returns the token once, for `Authorization: Bearer es_…`.

**CSRF:** cookie-authenticated POST, PUT, PATCH and DELETE requests must carry an allow-listed `Origin`. Requests from other origins, or with no Origin, get `403 CSRF`. CORS uses `credentials: true` with an explicit origin allow-list.

**Email:** `SMTP_URL` is required in production. In development without it, codes are printed to the gateway log (`[dev-mail] …`).

## Plans & quotas
| Tier | Cloud tasks / day | Max file |
|---|---|---|
| Anonymous (per IP) | 3 | 100 MB |
| Free account | 3 | 100 MB |
| Pro / Business | Unlimited | 1 GB, **capped by `MAX_UPLOAD_MB`** |

- **Scope:** only server work is metered (`/api/tools/*` and `/api/jobs/*`). Browser tools are never metered.
- **Precheck:** before the upload is buffered, an over-quota request gets `402 QUOTA_EXCEEDED` with an `upgradeUrl`.
- **Consume:** happens after validation, as an atomic "increment if below limit" in Postgres. It's race-free under parallel requests.
- **Anonymous subject:** HMAC of the IP. Raw IPs are never stored. Usage rows older than 35 days are purged.
- **Priority:** paid plans' queued jobs run before free and anonymous jobs (BullMQ priority).
- **Job ownership:** jobs submitted while signed in are visible only to their owner.
- **Source of truth:** limits are defined in `services/api-gateway/src/plans.ts`. The pricing copy in `apps/web/lib/plans.ts` must match it.

## Billing (Stripe)
| Endpoint | Purpose |
|---|---|
| `POST /api/billing/checkout { plan: pro\|team, interval: month\|year }` | Stripe Checkout (subscription). Already-subscribed users are sent to the portal instead, to avoid double billing |
| `POST /api/billing/portal` | Customer Portal: change plan, update card, cancel, invoices |
| `POST /api/billing/webhook` | Signature-verified (raw body). **The only source of truth for entitlements**; the Checkout redirect is never trusted |

**Webhook handling**
- **Idempotent:** event ids are recorded in the same transaction as the change. Failures roll back and return 500, so Stripe retries.
- **Out-of-order safe:** an older event never overwrites newer subscription state.
- **Entitlement:** `active`, `trialing` and `past_due` grant the plan (so a failed payment leaves time for Stripe's retries); anything else falls back to Free.
- **Events handled:** `checkout.session.completed` and `customer.subscription.created|updated|deleted|paused|resumed`. `invoice.payment_failed` is logged only.

### Stripe setup checklist
1. Create two products, **Pro** and **Business**, each with a monthly and a yearly price. Put the four price ids in `STRIPE_PRICE_*`. The current pricing page shows €12 / €7.50 and €49 / €39 per month.
2. Add a webhook endpoint at `https://<gateway>/api/billing/webhook` with the events listed above, and set `STRIPE_WEBHOOK_SECRET`.
3. Configure the **Customer Portal**: allow cancellation and plan switching between the four prices.
4. For EU VAT, activate Stripe Tax and set `STRIPE_AUTOMATIC_TAX=true`. Checkout already collects billing addresses.
5. Test locally with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:4000/api/billing/webhook
   ```

## Account & GDPR
- `GET /api/account` returns the plan, today's usage, limits and the number of active sessions.
- `GET /api/account/export` is the Art. 20 data export (JSON).
- `DELETE /api/account { confirm: "DELETE" }` is Art. 17 erasure. It cancels Stripe subscriptions immediately, then deletes the user, sessions, subscriptions and usage. Stripe keeps invoices, as tax law requires.

## Web UI
- `/login` has the email step, then the code step. The code auto-submits on the 6th digit, there's a resend cooldown, and `?next=` only accepts same-site relative paths.
- `/account` shows the plan and renewal, usage, billing portal, data export, "sign out everywhere" and account deletion. After Checkout (`?checkout=success`) it polls until the webhook activates the plan.
- `/pricing` CTAs start Checkout. Signed-out users sign in first and checkout resumes automatically. The page also shows "Current plan" and handles billing being disabled.
- The navbar has an account menu with a plan badge.

## Migrations
Plain SQL files in `services/api-gateway/migrations/`. They are applied automatically at gateway startup, in order, under a Postgres advisory lock (safe with several replicas). Add new files as `002_*.sql`, and never edit an applied one.

## Verification (Nov 2026)
**Backend: 33/33 checks** against real Postgres 16, Redis and Stirling.
- **Sign-in:**
  - Codes are hashed, single-use, and the wrong-attempt counter works.
  - The cookie has the right flags, and session tokens are stored as hashes only.
- **CSRF:** cross-site and Origin-less cookie POSTs are blocked.
- **Quotas:**
  - The free plan allows 3 tasks a day; the 4th gets 402 with an upgrade link, on both the sync and queue paths.
  - The anonymous IP quota works, and IPs are stored only as HMACs.
- **Webhooks:**
  - Forged signatures are rejected.
  - Customer linking works, and replays are idempotent.
  - An out-of-order older event does not downgrade the user.
  - `past_due` keeps access, and `deleted` returns the user to Free.
  - Pro is unlimited.
- **Ownership:** a user's jobs are hidden from other users.
- **GDPR:** export works, and deletion erases all rows and invalidates the session.

**Browser:** sign in with a code, then the account page, the pricing page with billing disabled, a webhook-driven upgrade to Pro (navbar badge and account page), the account menu, sign-out, and deletion with typed confirmation.

**Not tested:** real Stripe Checkout and Portal sessions (they need your Stripe test keys), and real SMTP delivery.
