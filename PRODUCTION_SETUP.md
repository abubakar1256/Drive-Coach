# RoutePilot production setup

The local MVP runs with PostgreSQL, a NestJS API on port 4000 and Next.js on port 3000. The web app defaults to the same-origin `/api/v1` proxy; set `API_SERVER_URL` when the API is hosted elsewhere.

## Docker deployment

For a production-like local stack, copy `.env.example` values into your deployment environment and run:

```bash
docker compose up --build
```

This starts PostgreSQL 17, applies Prisma migrations before the API starts, and serves the web app on `http://localhost:3000`. Change the generated/default secrets before exposing the stack publicly.

## Railway deployment

Railway should contain three services in one project:

1. PostgreSQL: add Railway's PostgreSQL service.
2. API: connect this GitHub repository, keep the repository root as the build context, and set `RAILWAY_DOCKERFILE_PATH=api/Dockerfile`.
3. Web: connect the same repository and use the root `Dockerfile`.

Do not set the API service root directory to `/api`: both Dockerfiles use the repository root as their build context.

Set these API variables:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=4000
WEB_ORIGIN=https://<your-web-service-domain>
JWT_ACCESS_SECRET=<long-random-production-secret>
```

Set these Web variables before deploying (the API URL is also used by server-rendered centre and route pages):

```env
API_SERVER_URL=https://<your-api-service-domain>
NEXT_PUBLIC_SITE_URL=https://<your-web-service-domain>
NEXT_PUBLIC_MAPBOX_TOKEN=<public-mapbox-token>
```

The API container runs `prisma migrate deploy` automatically at startup. After the first successful API deployment, run the seed once from the API service shell:

```bash
pnpm --dir api prisma:seed
```

This creates the demo centres, plans, coaching data, Alken and its official passage-point reference list. Alken Route 1 is created as a draft until its coordinates and sequence are verified in the admin panel.

Set the API health check path to `/api/v1/health`. Generate public domains for both Web and API; the client receives the Web domain only. Keep `DATABASE_URL`, `JWT_ACCESS_SECRET`, Stripe secrets and email-provider secrets private.

## Drive Coach AI chat

Set `GEMINI_API_KEY` and `GEMINI_MODEL` on the **API service**, not the Web service. Existing configured keys and models can be kept; no new variable is required for the chatbot fixes.

The chat reserves 4,096 output tokens (including thinking), uses low thinking for Gemini 3 or a small thinking budget for Gemini 2.5, and regenerates once with 8,192 tokens if an answer is empty, truncated or has unfinished formatting. Only a complete `STOP` response is shown as a successful answer. Provider failures, quota limits and timeouts have separate localized messages, and the question remains available for retry.

Each request sends at most 19 recent messages; the displayed conversation can be longer. The welcome text and failed questions are excluded from model history. Earlier messages outside that window are not remembered.

Drive Coach AI requires login and an active **Premium or Diamond** subscription. The server checks the account's database entitlement before every question; guests receive HTTP 401 and free, pending, expired, cancelled or refunded subscriptions receive HTTP 403 without calling Gemini. Existing ADMIN/SUPER_ADMIN accounts retain their internal Diamond access. A checkout-success URL alone does not grant access: the payment webhook must activate the subscription first. The English/Dutch widget shows a plans/login screen until access is confirmed, rechecks on opening, focus and session changes, and locks at subscription expiry. No new environment variables or database migration are needed.

On `/routes/:slug`, chat retrieves published route notes on the server. Paid users receive full points only when the existing route-access check allows them; otherwise only preview points are used. Selected points are resolved against those accessible points. Precise GPS positions, credentials, private reflections and account details are not included in the model prompt. Stored notes are not a guarantee of current signs or an official test route.

Deploy **both API and Web** to activate these changes on Railway. Test locally with `pnpm test:chatbot` (mocked provider regression tests) and `pnpm build`. Free-provider quota and external outages can still prevent an answer; a complete response is not guaranteed on every request.

## Payments

Add these values to `api/.env`:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://your-domain.example/account?checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://your-domain.example/account?checkout=cancelled
```

Create a Stripe webhook for `POST /api/v1/webhooks/stripe` and subscribe to `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`, and `invoice.paid`. The server verifies the `Stripe-Signature` header and ignores duplicate event IDs.

## Email

For verification and password-reset email delivery, configure:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=RoutePilot <noreply@your-domain.example>
```

Without these values, local development returns a one-time development token; production never exposes the token.

## Media CDN

Cloudinary unsigned uploads are optional:

```env
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
CLOUDINARY_FOLDER=routepilot
```

If `MEDIA_PROVIDER=local` (the default), files are stored under `api/uploads/media`. When Cloudinary is enabled, the same admin multipart endpoint returns the CDN URL and `/api/v1/media/:id` redirects to it.

## Mobile/PWA

### Driving-route quality checks (all centres)

Set `MAPBOX_DIRECTIONS_TOKEN` on the **backend** Railway service to a Mapbox token that can call Directions. `NEXT_PUBLIC_MAPBOX_TOKEN` on that same service is a fallback; the frontend's token is not automatically available to the backend. A browser URL-restricted token may not work server-side. Directions requests are subject to Mapbox account limits/pricing.

Admin → select route → Check driving route. Keep accurate start/finish coordinates and add/reorder actual road waypoints until the road-based estimate is at least 1,440 seconds. Publishing and starting practice reject shorter routes, U-turns, repeated geometry and 2D self-crossings. A bridge/tunnel may trigger the conservative crossing screen; this is not evidence of an illegal road crossing. Normal junctions on a simple path remain allowed. This check does not replace instructor review or verify that a supplied starting point is the actual test-centre entrance.

Full-route responses contain driving geometry and calculated duration/distance. Preview points never provide full-route navigation. Google Maps links use driving mode, fixed start and full waypoint order, but are disabled above three intermediate waypoints for mobile compatibility rather than silently dropping points. Google independently recalculates roads and time; its result is not guaranteed identical to Mapbox. Longer routes remain visible in the in-app road map.

Existing route records are **not automatically extended, verified or overwritten**. Invalid legacy previews cannot start practice and need actual instructor-selected waypoints. Missing/unavailable routing fails closed. Newly seeded example routes remain drafts and seed reruns preserve existing route points. Road results are cached by exact waypoint order for five minutes, bounded to 200 entries. The platform workflow changes below require the new migration.

The web app exposes `/manifest.webmanifest`, `/sw.js`, and `/icon.svg`. The service worker caches the app shell and public centre/route API responses. Mapbox tiles still require connectivity.

## Platform workflow completion

Run the new `0015_platform_completion` and `0016_durable_media` migrations before starting the new API. The API Dockerfile already runs `prisma migrate deploy`; other deployments must add that as a pre-deploy step. Take a database backup first. Financial duplicates are not deleted automatically: if legacy Commission rows share a payment ID, or a school already has multiple referral codes in one UTC month, reconcile them before migrating. The migration intentionally fails rather than erasing those records.

Premium purchases now require `centreId` and remain bound to that centre; Diamond covers all centres. Legacy active Premium accounts without a centre must choose it once in Account → Billing. An account can use the first reviewed published route of each centre without a paid plan. Other full routes and their practice/voice endpoints enforce paid centre access on the API. The AI chatbot remains Premium/Diamond only.

### Road-network practice content

Admin → Generate road-network practice loops (experimental) supports a selected centre or sequential generation for all centres. Each generation is bounded to six candidates and up to twelve Directions calls, subject to Mapbox limits/pricing. Only snapped real road points are saved, after a second driving validation. Routes must be at least 24 minutes; generated loops are limited to 60 minutes. Existing routes are never overwritten. Failure to find a compliant loop is reported and does not create a fake route. Corner-preserving shaping now passes live checks. `api/prisma/data/road-practice-loops.json` contains one real road-network loop for each of the 32 official-directory centres, freshly checked at 27.2–59.5 minutes. These are practice loops, not official exam content.

Generated routes are explicitly `ROAD_VALIDATED` practice loops, **not official examiner routes or instructor-approved material**. They use a mapped practice meeting point, which is not necessarily the exam-centre entrance. Start/finish are closed-loop road points. The existing centre directory mostly contains area anchors; Alken's anchor was corrected from the official centre directions link at https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-alken . Verify meeting-point accessibility before driving. Generation can remain draft or publish passing loops under this disclaimer. Longer waypoint sequences remain in the in-app map when Google Maps cannot preserve all mobile waypoints.

For instructor-provided content, create a draft, import ordered JSON points or edit them on the map, add source/instructor references, confirm the content review and run the driving check before publication. Coordinates, sequence and media edits invalidate review and return the route to draft. Unreviewed old previews are no longer publicly listed. This implementation does not fabricate streets, junction categories, speed limits, photos or videos.

### Practice and media

Practice start captures the exact road geometry and ordered point snapshot. Duration is computed from server timestamps; client-supplied duration/completion cannot force 100%. GPS updates require usable accuracy, proximity and plausible progress along the ordered route. Low-quality/off-route fixes do not advance progress. Ending early records actual partial progress (`ENDED`); coverage of the route and all points records `COMPLETED`. These are route-following metrics, not a driving-skill score. GPS can still be falsified by a client; the system does not claim forensic proof of a physical drive. Snapshots preserve session history when routes are edited.

Admin point media uploads support JPEG/PNG/WebP/MP4/WebM up to 15 MB, with server file-signature checks. Uploaded media can be linked to the point and is rendered on the selected point's learner view. Production defaults to database-backed byte storage; explicitly set `MEDIA_PROVIDER=database` if needed. This requires `0016_durable_media` and persists uploads in PostgreSQL without a new paid hosting product. Database media increases database/backup size and is suitable for modest uploads; use a CDN for a large video library. Explicit `MEDIA_PROVIDER=local` still needs a durable volume. Previously missing local files cannot be recovered automatically. Actual licensed location photos/videos must still be supplied; points without media now show a clearly labelled generic driving-preparation illustration, never a fake location photo. Signature checks are not an antivirus scanner.

### Schools, commissions and notifications

School owners can invite registered instructors; instructors accept before gaining student-history permissions. Students must accept enrollment before teachers can read history or assign routes/send feedback. Assignments do not bypass the student's own route entitlement. Verified full-route completion marks matching assignments complete. Genuine teacher feedback is stored separately from the learner's self-reported instructor notes. Owner-only school purchase/invoice history covers school-tagged per-account Premium/Diamond purchases, not an invented bulk-seat product.

School referral codes rotate on request each UTC month under a transaction lock. Prior monthly codes cannot be claimed; old attribution records remain eligible for their agreed commission. Successful verified Stripe payments create payment-unique commissions based on the net paid amount. Duplicate events/fulfillment do not create duplicate access or commissions, and failed processing remains retryable. Subscribe the Stripe webhook to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, `charge.refunded`, and `invoice.paid`. Unpaid asynchronous checkouts do not grant access. Refunds reverse pending commissions or flag paid/partially refunded ones for reconciliation. Admin payout recording is audited and requires an external bank-transfer reference; it does not actually move money. Content managers cannot run finance actions.

In-app notices cover payment/access changes, route publication updates, school invitations/assignments/feedback, practice completion, payouts and admin announcements. Users can opt into exam reminders (one and seven days before the stored exam time), practice reminders and assignment reminders. The backend checks due reminders every minute, with notification deduplication and automatic subscription expiry. Set `NOTIFICATION_SCHEDULER_ENABLED=false` to disable the worker in tests/maintenance. Native push/offline/mobile and additional languages were intentionally left out of this request.

Verification commands: `pnpm test:platform`, `pnpm test:chatbot`, `pnpm build`, and `pnpm --dir api exec prisma validate`. Unit tests use isolated fixtures; real Stripe, durable storage, migration rollout and actual driving tests still require staging/production verification.

### Import and deployment gate

Admin → **Publish checked starter routes** performs a one-time authenticated import, one centre at a time, with fresh road validation and stable slugs. It never creates a recurring deployment job or overwrites existing route edits. The live legacy `ghent-east` directory entry uses the nearby `sint-denijs-westrem` loop with an explicit shared Ghent-area practice label. Failures remain visible per centre; they do not create fake routes.

The route-content bundle does not automatically publish routes or change the database. After a verified backup and staging restore/migration test, run `pnpm --dir api content:import` for drafts or `pnpm --dir api content:import -- --publish` to publish freshly passing road-network loops. Set backend `MAPBOX_DIRECTIONS_TOKEN` first. Existing slugs/points, including instructor edits, are preserved. Imports record an audit fingerprint and recheck actual roads/time; they are not proof of instructor approval.

Railway Pro is not required for a local PostgreSQL backup. Install the official PostgreSQL client tools (`pg_dump`/`pg_restore`), configure the production public connection in the ignored `api/.env`, then run `pnpm --dir api db:backup`. Backups are private generated archives under ignored `output/db-backups`. The script keeps credentials out of arguments/logs and checks archive readability. A successful archive listing is not a staging restore test. Restore into a separate staging database before production migration; never restore over production for a test.

The user has authorized a main-branch GitHub push, which may trigger Railway auto-deployment. Production backups, migration rollout and route publication have not been verified. The route-content bundle still requires the explicit import command above; deployment alone does not publish it. Stripe live payments remain untested; use isolated test-mode checkout/webhook/refund verification before launch. No paid upgrade is required by the code. Language/offline/mobile changes remain out of scope.
