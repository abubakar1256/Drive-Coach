# Phase 2 — reviewed route foundation

Implemented on the Phase 1 Free / Basic / Premium model. No prices, purchased periods, trial rules or existing route identities are migrated by Phase 2.

## Quality contract

- New publication, practice-start driving checks, road-network generation and explicit maintenance/import checks require **1,380–1,620 exact driving seconds (23–27 minutes, target 25 ±2)**. Rounding is display-only. Real traffic, stops and Google Maps recalculation can change actual elapsed time.
- Existing Mapbox geometry checks reject self-crossings, revisited roads, backtracking and U-turn maneuvers conservatively. This is not a guarantee about current signs, closures, legal access or grade-separated junctions.
- Reviewed passage drafts additionally check start/finish proximity and every selected passage in driving order. The route starts and finishes at the same reviewed public-road meeting location.
- Existing routes are not automatically edited, unpublished or relabelled official. Metadata remains visible for historical longer routes; fresh navigation/practice checks can require reworking them to the new band. Do not call the historical 24–30 minute JSON export a Phase 2-ready catalogue.

## Verified operator source bundles

Checked 18 October 2026 against the linked operator pages/PDFs. These are **156 numbered source entries across six Autoveiligheid centres**, not 156 unique junctions, not every centre in the app, and not mandatory points on every exam.

| App centre | Entries | Printed revision | Operator page / PDF |
|---|---:|---|---|
| Alken | 32 | 2024-11-01 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-alken) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1005-1758689674.pdf) |
| Bree | 24 | 2025-11-17 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-bree) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1033-1781607015.pdf) |
| Deurne / antwerp-north | 29 | 2025-11-17 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-deurne) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1004-1764336868.pdf) |
| Geel / antwerp-geel | 27 | 2025-10-31 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-geel) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1023-1763127051.pdf) |
| Kontich / antwerp-kontich | 25 | 2024-11-01 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-kontich) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1022-1758689674.pdf) |
| Haasrode | 19 | 2025-11-17 | [Centre](https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-haasrode) · [PDF](https://www.autoveiligheid.be/storage/files/doorgangspunten-1024-1763560723.pdf) |

The source supplies names and municipalities, **not coordinates or fixed exam itineraries**. Coordinates are deliberately absent from the bundle. Duplicate/reversed junction rows remain in source order; duplicate rows are not eligible for route selection. Other centres explicitly show that no verified operator passage list is bundled yet.

## Admin workflow (all-centre selector)

1. In `/admin` → **Route foundation**, select a centre, including centres without routes. Read its operator address/PDF and explicitly import/refresh the source. No startup import or external scraping job runs.
2. Review the legal public-road meeting point, exact coordinates, source and access evidence. A directory marker is not an exam entrance. Save pending/rejected or explicitly reviewed status. Existing directory anchors are not moved.
3. Review distinct passage coordinates with evidence. The server records the reviewer and date; changing coordinates without renewed confirmation demotes the point. No automatic geocoding or verification occurs.
4. Select **2–6** reviewed points in explicit driving order, between departure and return. Confirm one bounded Mapbox Directions check under existing account limits. Failed time/geometry/coverage checks save nothing. No paid upgrade or automatic exhaustive search.
5. A passing result is an idempotent **DRAFT / PENDING_REVIEW**, named and labelled passage-point **practice**, never an official examiner itinerary. Review its map/content in the existing route editor, confirm content review, then publish through the existing publication gate.

Optional advanced road-shaping controls accept a full **4–25** coordinate sequence, with optional 0–359° bearings. The exact reviewed departure must be first/last; every selected source point must appear once and in the selected order. These controls connect streets, not additional official passage points. All exact-time, road geometry and coverage gates still apply. The private snapshot includes the controls and bearings; moving one or changing its bearing invalidates publication/access until rebuilt and reviewed.

Private provenance captures reviewed source fingerprints, location coordinates, reviewer timestamps and departure version. Publication rechecks/locks those records; access and a new trial claim revalidate them. Source changes/rejection invalidate old snapshots. Catalogue entries then display review-needed and withhold points, not a misleading upgrade prompt. Re-review requires rebuilding/reviewing the route; it does not silently revive stale proof.

Public centre cards expose only operator source metadata, reviewed counts and departure-review status. Raw proof coordinates/ids are stripped from public route/list/catalogue responses. Free/Basic/Premium authorization remains enforced server-side.

## Migration and rollout

`0018_official_route_foundation` is additive: private route JSON proof, source fingerprint/check metadata and `CentreDeparture`. It does not publish anything or change existing routes, payments, subscriptions, trial expiry or prices. The seed no longer overwrites reviewed passage metadata.

Before a **separately authorized live rollout**, back up and rehearse the migration, deploy the API and frontend together, then perform real coordinate/access/content review. This implementation does not certify or publish geographic content across every centre. It does not claim that existing live routes are all 23–27 minutes.

## Reproducible verification

Run `pnpm test:foundation` for the focused API/route suite. For full regression: build API, run `node --test api/test/*.test.cjs tests/*.test.cjs`, then `pnpm build` and `pnpm --dir api exec prisma validate`.

For the isolated PostgreSQL integration script, create a **new empty** `drivecoach_phase2_test...` database on loopback port **55443**. Set `PHASE_TWO_TEST_DATABASE_URL` and `PHASE_TWO_PSQL_PATH`, then run `node api/scripts/verify-phase-two.cjs`. It refuses any non-loopback host, other database name/port or non-empty database. It applies all migrations, uses synthetic coordinates and a mock routing provider, and verifies actual SQL locks/constraints, 156-row imports, publication, revocation, redaction and preservation of legacy billing/route data. Never point it at a live database.

Phase 3 hometown/difficulty/AI personalisation, offline/mobile and additional languages are outside this phase.

### Verification performed locally — 18 October 2026

- API build, frontend production build and Prisma validation passed.
- 171 API tests plus 64 frontend/shared tests passed (235 total).
- The final isolated PostgreSQL run passed the complete additive migration/import/review/draft/publish/access/revocation rehearsal. All Directions responses were synthetic fixtures; no external routing spend or live account changes.
- Browser QA checked the all-centre selector, 32-row Alken mock import feedback, disabled generation before location review, and public source-status layout. The temporary mock servers and test database server were stopped afterwards; test data remains local.
- A fresh private PostgreSQL 18 archive was restored in an isolated password-protected loopback cluster. Migration 0018 preserved every existing table value; staged source imports left protected tables unchanged.
- On 18 October, the approved additive migration 0018 and audited six-centre import of 156 source names were applied in production. Source import does not verify coordinates or publish routes.
- `api/prisma/data/road-practice-phase-two-prepared.json` contains 130 freshly validated, distinct closed practice options in the exact 23–27 minute band. The old 24–30 minute asset remains unchanged. One shared Ghent mapping means 131 generated live records are covered by the replacement plan; the three unverified legacy/curated records are not replacement targets.
- Operational preparation is explicitly bounded, checkpointed and separate from seeding/startup. `ROAD_REPLACEMENT_BUNDLE` selects the reviewed export; live replacement still requires a matching recent full restore/late-conflict rollback rehearsal. No paid upgrade is required or performed.
- The approved production replacement passed after the full restore and late-conflict rollback rehearsal: 75 generated routes updated, 56 preserved across 33 directory entries. Existing route IDs/slugs/creation order and historical snapshots are retained. Fresh provider measurements for all 131 targets were 23.1089–26.9805 minutes. Three unverified legacy/curated records were left untouched, not presented as validated routes.
- Public map collection produces **candidates only**, with OpenStreetMap attribution and cache provenance. An unavailable, ambiguous, private or restricted location must remain pending; a matching road name is not a legal-access review. Do not report official passage/start coverage complete while those reviews remain pending.

### Remote map/register completion release — 19 October 2026 (Pakistan time)

The task-only review uses the dated [Geofabrik Belgium extract](https://download.geofabrik.de/europe/belgium-261017.osm.pbf) (official MD5 checked) and the [Flemish road register](https://www.vlaanderen.be/digitaal-vlaanderen/onze-diensten-en-platformen/wegenregister). An exact shared OSM junction is cross-checked against both published street names, explicit public access (`TGBEP=1`), in-use status (`STATUS=4`) and a recognized driving-road morphology. Presence in either map alone is insufficient. Foot/cycle/tram-only ways, private/forbidden roads, unknown morphology and parking entrances do not qualify. Source/response URLs, timestamps and hashes remain in ignored local evidence, never credentials or a startup import.

Six additional practice loops were prepared, using **13 selected reviewed source junctions** and six public-road drive-through references. Exact measured times were 23.80–26.23 minutes. These are **remote map/register reviews, not field inspections, instructor approvals, confirmed exam entrances, stopping/parking permissions or guaranteed current signage**. Other source rows remain pending; this does not certify all 156 entries or invent operator lists for the other directory centres.

The release is separate from the 131 existing road-network practice records. Publication is additive and audited through the foundation and administrator services. A single transaction rechecks current source snapshots, reviews only selected coordinates, creates checked drafts and publishes reviewed content. A recent matching full archive restore, all-centre late-conflict rollback and idempotency rehearsal are mandatory. Existing route IDs/content/history, purchases, prices, subscriptions, trials and sessions must remain unchanged. A rerun preserves the same reviews and published route identities.

Operational scripts: `prepare-road-register-evidence.cjs` (read-only cached government checks), `prepare-reviewed-passage-loops.cjs` / `prepare-shaped-passage-loops.cjs` (bounded preparation), `prepare-reviewed-passage-release.cjs --confirm-remote-review` (explicit remote content review), `rehearse-reviewed-passage-release.cjs` (isolated restore), and `apply-reviewed-passage-release.cjs --apply-private-production` (matching rehearsal required). There is no recurring generation/import or paid upgrade. Task-specific SSH key directories are confined to ignored backup output; revoke the exact temporary identity after the private operation.

Verification: 246 regression tests, API/frontend production builds and Prisma validation passed. The restored real archive passed all-six publication, forced late rollback, repeat-run idempotency and preservation of all 137 pre-existing route records/protected tables. Deployment/publication results belong in the dated private operational receipt; staging success is not itself a claim of live publication.

Map attribution: [© OpenStreetMap contributors, ODbL 1.0](https://www.openstreetmap.org/copyright); Wegenregister / Digitaal Vlaanderen. The centre page exposes this attribution and explains the limits of remote review.

### Complete source-location reconciliation — prepared 19 October 2026

The follow-up remote review covers all **156 printed rows**: **153 non-duplicate source entries** (including the 13 previously published reviews) and **3 exact duplicate rows excluded from selection**. These are source entries, not 153 geographically distinct junctions: different arms of one junction and a separately listed roundabout can share a location. The existing 80-metre selection guard still rejects treating nearby references as distinct stops.

This is a qualified location-reference review, not a claim that every historical source label describes a current flat intersection:

- Government `LGEMEENTE` / `RGEMEENTE` and explicit district mappings disambiguate same-name streets. Specific operator-versus-register municipality conflicts are recorded, never silently rewritten.
- The [Hasselt merger decision](https://besluitvorming.hasselt.be/zittingen/23.1019.7144.5952/agendapunten/24.0823.9103.1805) documents Sint-Lambertusstraat becoming Jozef Droogmansstraat. Other spelling/current-name interpretations retain the printed source label and an explicit qualification.
- [AWV identifies the Herentals roundabout](https://wegenenverkeer.be/nieuws/herstellingswerken-rotonde-ringlaan-n153-met-augustijnenlaan-herentals) as Ringlaan N153 / Augustijnenlaan; unnamed register segments must not cause it to be confused with Ringlaan in another town.
- Small government topology windows verify public/in-use connecting segments. A connecting-road approach is labelled as such, not presented as an exact shared-node junction. A planar road crossing alone supplies no connection evidence.
- The E40/N25 reference is on the public interchange approach at its ramp junction, not a motorway stopping place or a flat E40 crossing. Current signs and restrictions still need to be checked on the ground.

Read-only tools are `reconcile-passage-registry.cjs`, `reconcile-passage-connectors.cjs` and `analyse-passage-reconciliation.cjs`. `passage-review-decisions.cjs` records the exceptional interpretations and primary evidence. Collectors never verify database rows. `prepare-complete-passage-review.cjs --confirm-remote-review` serializes an explicit content review; source metadata and private evidence hashes must match the current bundle.

`apply-complete-passage-review.cjs` is **coordinate-only**. It refuses changed fingerprints, overwrites of existing location reviews, changes to referenced route proof, unverified preserved records and duplicate verification. It preserves the 13 existing reviewer timestamps and all six published practice proofs. It does not create/replace routes, change departures, alter accounts/plans/prices, or call Mapbox. Production requires a matching recent full archive restore, forced late rollback, protected-table hashes and exact idempotency via `rehearse-complete-passage-review.cjs`. The public summary distinguishes pending locations, excluded duplicates and complete review without exposing private coordinates.

**Rollout status:** fresh private backup and full restore/late-rollback/idempotency rehearsal passed on 19 October. Production application/deployment are the next explicit steps; do not call the release live-complete before its production receipt and public counters are verified. A known, unreviewed Alken coordinate is bound to its exact preimage before replacement; a later edit, reviewed status or route reference aborts the release. This exception never overwrites a verified location or published source proof.

Verification includes API/frontend builds and Prisma validation, source-identity preservation, all six route proofs, untouched protected tables and exact repeat-run behavior. The fresh rehearsal updates 140 locations, preserves 13 published reviews and excludes 3 duplicate rows. Historical pre-publication backups remain recoverable but are not accepted as proof of the current state. The task-only SSH identity must be revoked and its key files deleted after live verification. Phase 3 implementation remains gated on Phase 2 completion.
