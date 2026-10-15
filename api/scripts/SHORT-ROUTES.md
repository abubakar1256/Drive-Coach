# 24–30 minute route preparation

This is a content-preparation workflow, not a deployment or database migration.
Existing published routes and subscription rules are unchanged. Do not remove
long routes from the publication query: that would hide existing routes before
validated replacements are ready.

1. Build the API: `pnpm --dir api build`.
2. Load the project's existing Mapbox token through the environment (never paste
   it into source control or command arguments).
3. Run `node --env-file=.env api/scripts/prepare-short-road-catalog.cjs 256` from
   the repository root. This tries smaller clean road loops, with a hard maximum
   of 256 actual Directions requests for that run.
   The search can adapt each original search shape once toward a 27-minute
   target. Only freshly validated road points are saved; adjusted search
   coordinates are never published as roads. Resuming advances the variant round
   rather than repeatedly spending the budget on the same first variants.
4. Optionally run a second bounded pass using existing road anchors:
   `node --env-file=.env api/scripts/prepare-short-road-catalog.cjs 256 shorten`.
   No interpolated/scaled coordinates are saved as roads. The closing path must
   pass the provider and geometry checks independently.

Each run revalidates its checkpoint and saves generated results to
`output/chatbot-audit/short-routes/prepared.json`. The file lists every pending
centre/slot. Partial results are explicitly **not for publication**. Checkpoints
are local ignored artifacts, not automatically imported application data.

Only after all expected slots pass, export the freshly checked complete dataset:
`node api/scripts/prepare-short-road-catalog.cjs --export-prepared`.
This makes no provider requests and creates the reviewable generated data asset
`api/prisma/data/road-practice-short-prepared.json`. It refuses incomplete/stale
data and refuses to overwrite an existing export. The application does not load
or automatically publish this prepared asset.

Acceptance requires 1440–1800 exact provider seconds, valid driving geometry, no
detected self-crossing/repeated roads/U-turns, and sufficient distinction from
other accepted routes at that centre. This does not constitute instructor
approval or an official examiner route. Real traffic can change driving time.

The script stops at its request cap or provider 401/402/403/429. It does not
upgrade plans or inspect the Mapbox account's remaining free allowance; a request
cap is not a promise that the provider will not charge usage under its own plan.
Review account allowance before another batch. It never writes to the database.

Before any live replacement: complete the pending slots, verify a recoverable
backup, revalidate all exact saved points, preserve route IDs/slugs/created order,
version content and preserve historical practice snapshots, and perform an
explicit reviewed import. Preserve each centre's Route A/free ordering and
Premium centre scope. The existing starter importer deliberately preserves
existing rows and cannot perform this replacement by itself.

## Prepared snapshot — 2026-10-15

- All 130 source slots across 32 source centres are prepared; no slots pending.
- Exact provider durations: 24.02785–29.91724 minutes, never display-only edits.
- Every saved route starts and ends at the same meeting-point coordinate.
- The shared Ghent directory entry continues to map to Sint-Denijs-Westrem;
  this source count is not the live directory/route count.
- `road-practice-short-prepared.json` is a review asset only, not an automatic
  seeding source. No production routes or purchases were changed.
- Backup verification and a version-preserving, freshly revalidated replacement
  import remain required before these results can be called live.

## Explicit replacement maintenance

These scripts are manual maintenance tools, never application startup hooks.
They do not change billing, subscriptions, roles or access policy. The private
SSH helpers target this project's existing production Postgres service only.
Obtain explicit approval before registering a temporary SSH key, and revoke that
exact key after maintenance. Do not add public database networking or overwrite
personal SSH configuration. All archives, plans and test clusters live under
ignored `output/db-backups`; treat them as private production data.

1. `backup-private-postgres.cjs` streams a server-matched custom PostgreSQL
   archive over SSH, verifies its header and records a SHA-256 checksum. It does
   not export database credentials. A header/checksum alone is not a restore test.
2. Through `private-native-db-operation.cjs`, run
   `plan-short-route-replacement.cjs` with the existing routing token in the
   environment. It makes at most 131 Directions requests, stops on provider
   errors, and creates a read-only, one-hour-valid plan for the 131 generated live
   routes. Curated features/media and sessions without snapshots block planning.
   The shared Ghent entry reuses its source result, so normally 130 calls suffice.
3. `rehearse-short-route-replacement.cjs <archive> <plan>` requires portable
   PostgreSQL 18 tools under `output/db-backups/pg18-tools/pgsql/bin`. It creates
   a new SCRAM-password-protected cluster on **loopback port 15440**, restores the
   full archive, proves rollback after a late conflict, applies the replacements,
   and verifies every unrelated table's fingerprint. It checks IDs, slugs,
   creation order, all coordinates and Free Route A identity. Successful rehearsal
   writes a matching receipt; the local server is stopped afterward.
4. Only after reviewing that receipt, invoke `replace-short-routes.cjs
   --apply-production <plan> <receipt>` through the private wrapper. The importer
   requires the matching backup checksum and a recent successful receipt. A
   serializable transaction checks every original route snapshot, rejects
   concurrent edits, increments changed versions and archives prior route/point
   content in AuditLog. Unchanged routes are preserved. No generic point import,
   destructive seed or schema migration is used.
5. Run `verify-short-route-replacement.cjs <plan>` through the private wrapper,
   then check the public route catalogue and paid-route preview protection.
   Revoke the temporary Railway SSH key and remove its exact local private key.

PostgreSQL floating-point round trips can differ in a bearing's final decimal
place. Geometry comparisons allow only 1e-12 degrees of coordinate noise and
1e-10 degrees of bearing noise, not shifted road anchors. Routing/duration checks
remain unchanged. Unit guards: `node --test api/test/short-route-replacement.test.cjs`.

The three legacy unverified demonstration routes (and their 30 point features)
are deliberately untouched, not represented as validated practice routes. They
remain excluded by the existing public reviewed-publication policy. Production
completion must be established by the post-import verifier, not this document.

### Live replacement verified — 2026-10-15

The private backup was fully restored with matching PostgreSQL 18.6 tools.
Staging passed the replacement, late-conflict rollback, protected-table
fingerprints and stable free-route ordering checks. The initial remote attempt
rolled back completely on timeout (131 original versions, zero replacement
audits); a batched-query version was re-rehearsed before the successful retry.

Post-import database verification: 131 generated routes across 33 directory
centres, 112 versioned updates, 19 unchanged routes, 112 replacement audit entries.
All route identities and Free Route A ordering were preserved. All 30 legacy
point features remain. Historical practice snapshots were not rewritten.

Independent public API checks covered every centre: 33 free routes, 98 locked
routes, no paid waypoint preview leakage, displayed durations 25–30 minutes
(exact checked provider times 24.02785–29.92529 minutes). Alken A/B/C/D now display
29/29/25/25 minutes. Traffic and future provider updates can change real duration;
these are mapped practice routes, not official or instructor-approved exam routes.

The task's temporary Railway SSH key was revoked after verification. Task-only
restore clusters and local identity files were removed; private backup archives,
checksums, plans and successful restore receipts were retained locally, not in Git.
