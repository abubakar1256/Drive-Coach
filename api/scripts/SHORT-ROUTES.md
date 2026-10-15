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
