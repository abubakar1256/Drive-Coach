# Phase 2 / 3 content completion — 20 October 2026

## Scope and acceptance

This increment supplements the existing deployed profile, reflection, entitlement,
AI consent, private hometown generation and repeat/report implementation. It does
not equate software completion with field/instructor approval or complete official
source coverage for every directory entry.

### Route check and repair

All 137 published reviewed practice records were re-evaluated against Directions.
136 passed the existing exact 1,380–1,620-second, connected/order, no repeated-road,
no self-crossing and no U-turn screening contract. Anderlecht Route B needed a
repair: a simple cycle from its actual routed roads produced a distinct checked
1,428.564-second loop. It preserves the existing route ID, slug, creation order,
25 point IDs, non-geometric point content and historical session snapshots, and
increments only that route's version. Directions already rounds bearing inputs to
integer degrees; the reviewed repair stores those same integers so database JSON
floating-point serialization cannot make its coverage immediately stale.

The shared 23–27-minute target is an estimate, not guaranteed real driving time.
Current route-detail/practice checks still re-evaluate driving conditions and deny
invalid geometry. Existing trials, paid grants, Basic centres and expiry do not
change. No new recurring generation or paid expansion is introduced.

### Reviewable recommendation evidence

137 exact version/point-fingerprint coverage records are prepared from the dated
[Belgium map extract](https://download.geofabrik.de/europe/belgium-261017.osm.pbf)
and checked driving polylines. Public OSM node/way references and file hashes bind
the review. Nearby roads are not automatically skills: aligned road overlap,
shared-node topology, traversed junction arms and grade separation are screened.
Unsupported priority, speed, observation, parking, lane discipline and driving
mistakes remain unknown. This is remote map-feature review, not field inspection.

`MAPPED_INTERACTIONS_V1` is a transparent **workload planning heuristic**, not a
calibrated difficulty/ability/safety/exam score. It weights junction clusters +
2×signal clusters + 4×roundabout clusters: ≤55 low, ≤105 medium, otherwise high.
Any aligned motorway-approach reference gets high, without claiming a merge skill.
Counts describe map objects/clusters, not exam tasks. The dashboard exposes the
source and limitation. Version changes invalidate the badge and matching evidence.
Locked-route responses continue to redact all recommendation evidence.

Attribution: [© OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright).
No contributor identities are collected; this is not a copy of competitor routes.

### Additional operator documents

The supplemental catalogue transcribes **584 source references in 10 bundles**:
five SBAT centres, AIBV Asse–Mollem and four KM centres. The historical six-centre
156-row bundle stays unchanged, preserving existing source/route proofs. Original
point groups and exact duplicate labels are retained. Source bytes, official links,
retrieval times, PDF hashes, text extraction and rendered-page review are kept in
ignored evidence output. Valid-through dates use the Europe/Brussels calendar;
expired documents cannot silently qualify for new verified location reviews.

These new references are **names/grouping only**. Their database coordinates and
reviewer timestamps remain null, status PENDING_REVIEW. Operator groupings are not
complete timed routes. Missing municipality or entrance information is not guessed.
Source-location and legal departure checks remain required before source-based
route generation. Other operator documents and remaining centres are not claimed
complete by this release. An old PDF URL filename alone is not an expiry decision:
retrieved document contents must be inspected.

## Safe rollout

Read-only collectors and proposal preparation never approve database rows.
`prepare-preparation-content-release.cjs --confirm-remote-review` is a separate
explicit review step. `rehearse-preparation-content.cjs` restores the full private
PostgreSQL 18 archive into a fresh password-protected loopback-only cluster. It
tests forced late rollback, route/point identity preservation, unchanged existing
source reviews, pending-only new names, unchanged protected tables and exact
repeat-run idempotence.

`apply-preparation-content.cjs --apply-private-production` requires the matching
recent archive/hash and successful rehearsal receipt. One serializable audited
transaction locks the reviewed route/point set, checks current administrator role,
rejects concurrent route/source edits and preserves existing human coverage
reviews. It creates only absent coverage/source records and the one reviewed route
repair. Accounts, preferences, subscriptions, payments, grants, trials, practice
sessions, private hometown routes and all historical snapshots are protected.

No schema migration is needed for this increment. The existing `0019` / `0020`
schema remains unchanged. Private production access uses only the approved
task-scoped SSH identity and pinned relay host. Revoke that exact identity and
delete only its generated private/public key files after verification; retain the
backup and audit/rehearsal receipts under ignored output, never in Git.

## Verification record

- 297 regression tests passed with local HTTP networking enabled.
- API/frontend production builds and Prisma schema validation passed.
- Fresh PostgreSQL 18 archive restore, forced late rollback, unchanged protected
  tables, preserved route/point identities and exact idempotence passed: 137
  coverage inserts, 584 pending-only source references, one route repair.
- Production publication, post-release counts and SSH cleanup must be confirmed
  by dated operational receipts; a prepared manifest or staging pass alone is not
  proof of deployment/publication.

Remaining Phase 2 content work is explicit: exact location/access/departure review
for the new source names, remaining operator-source coverage and checked loops
grounded in those reviews. Phase 3 cannot honestly promise matches for skills with
no reviewed evidence, or a successful hometown loop in every town. Failures stay
unavailable rather than fabricating a route or charging for extra searches.

## Confirmed live rollout

Commit `6fc0fcd` deployed successfully to both API and frontend on 20 October
2026. The approved atomic content transaction completed at 04:53 UTC. Read-only
private checks confirmed 33 centres, 137 published routes and **137 current,
fingerprint-matched coverage reviews**, 16 bundled operator sources, 584 new
pending-only names (567 non-duplicate), all 153 previous reviewed locations and
Anderlecht Route B version 4 (23.8094 measured minutes).

Public smoke checks across all 33 centres confirmed guest redaction of all 137
routes, paid-point protection, private endpoint guards, preserved Alken review
status and clearly pending Brugge coordinates. Stored catalogue durations are
24–27 minutes. The signed-in dashboard displayed the new map evidence details
and retained Premium access, without changing the user's profile or generating
a private route. This read-only account check is not a real-world GPS drive test.

The task-only Railway SSH identity was revoked and Railway confirmed no registered
SSH keys remain. Only that identity's two generated key files were deleted. The
full backup, source evidence, screenshot and rehearsal/publication/revocation
receipts remain private in ignored local output.
