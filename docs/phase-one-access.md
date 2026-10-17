# Phase 1 — Free / Basic / Premium

Implemented locally. No production database or real payment is used by tests.

| Period | Fixed hours | Basic: one purchased centre | Premium: all centres |
| --- | ---: | ---: | ---: |
| 1 day | 24 | €2 | €3 |
| 1 week | 168 | €4 | €6 |
| 1 month (30 days) | 720 | €6 | €9 |
| 3 months (90 days) | 2160 | €8 | €12 |

Payments are one-time, not auto-renewing. The period begins when a paid Stripe checkout is fulfilled. Basic cannot switch its purchased centre. Active subscribers cannot accidentally buy the same/lower tier again; Basic can upgrade to Premium, without altering the earlier purchase or its expiry.

Free accounts can explicitly choose **one reviewed published route** for **one 24-hour trial per account**. Merely browsing does not start the trial. Another centre, another route, expiry or route deletion cannot reset it. An active trial unlocks that route's map and basic practice, not paid AI, voice or media. Current sign-in state and backend authorization govern all route content; route sections do not unlock other routes.

First-party media files require authenticated, paid access for the asset's exact route (content editors can preview managed drafts). The client retrieves them as authenticated blobs, without placing tokens in media URLs. Existing externally hosted public media URLs are still public at their hosting provider; this change does not promise DRM or revoke copies/links a user already obtained.

## Compatibility

Migration `0017_phase_one_access` maps legacy single-centre Premium to canonical Basic and legacy Diamond to canonical Premium through `Plan.tier`. Original plan IDs/names, prices, payment records, subscriptions, purchased centres and expiry timestamps remain unchanged. Historical receipts deliberately retain their original product name. Old offers are retired only from new checkout. Eight distinct duration offers are added. Seed reruns do not rewrite existing offer prices.

Payment metadata captures the purchased tier, duration and centre. Signed webhook fulfillment compares against the saved payment amount/currency and remains idempotent; it does not reprice an existing checkout against today's offer. Legacy unbound single-centre purchases can still select a centre once.

## Deployment gate

Before production rollout, take and verify a recoverable database backup. Deploy migration `0017_phase_one_access` before serving the new API (the API container already runs `prisma migrate deploy`). Then deploy the matching frontend and verify Free trial / Basic centre scope / Premium all-centre access plus a Stripe **test-mode** checkout and webhook. Do not run a full seed over production content merely to add these offers. The migration already inserts them.

No production migration, deployment, GitHub push or live charge is performed as part of this local implementation. Real Stripe settlement has not been exercised by the mocked regression tests.

## Verification

Local verification completed: 220 regression tests, Prisma schema validation, TypeScript checks and the production frontend build passed. The isolated PostgreSQL migration/concurrency script passed. Browser checks confirmed the 1-day (€2/€3) and 3-month (€8/€12) selections and the locked, signed-out route trial entry. Temporary local API/frontend/database processes were stopped afterward.

- `pnpm test:access`: access, pricing, legacy compatibility and UI regression tests.
- `node --test tests/*.test.cjs api/test/*.test.cjs` after API build: full regression suite; requires localhost networking for Nest HTTP tests, but mocks external providers.
- `pnpm build`: production frontend build.
- `api/scripts/verify-phase-one.cjs`: applies all SQL migrations to a **new empty local database** named `drivecoach_phase1_test...`, inserts legacy purchase fixtures before 0017, and verifies history, expiry, all eight prices, actual concurrent trial claims, foreign-key/check constraints and expired-access denial. It refuses non-local or non-empty targets. Set `PHASE_ONE_TEST_DATABASE_URL` and optionally `PHASE_ONE_PSQL_PATH`. It never reads the production connection from `.env`.
