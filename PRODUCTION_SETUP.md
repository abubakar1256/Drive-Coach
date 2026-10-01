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

The web app exposes `/manifest.webmanifest`, `/sw.js`, and `/icon.svg`. The service worker caches the app shell and public centre/route API responses. Mapbox tiles still require connectivity.
