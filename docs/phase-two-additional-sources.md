# Phase 2 additional source review — 20 October 2026

This is a bounded content increment, **not a declaration that Phase 2 is complete**.
The existing 137 reviewed practice routes, six source-grounded loops, historic
route/point identities, session snapshots, accounts and financial records remain
unchanged. No migration, automatic seed/import, paid upgrade or Mapbox request is
introduced by this increment.

## Inspected primary documents

The catalogue adds 14 inspected Category B source bundles / 486 printed entries:
11 Autosécurité centres and AIBV Braine-le-Comte, Couillet and Mariembourg. Full
rendered pages, car-category table boundaries, row order and three-point groups
were checked. Current document contents say 1 July 2026–30 June 2027, even where
the PDF URL contains an older year. Truck/motorcycle-only columns are excluded;
mixed A/B tables include the Category B rows. Wandre and Marquain preserve the
operator's rural/urban grouping. Exact repeated labels remain in printed order
and are excluded from route selection; missing towns or entrances are not guessed.

Primary entry pages: [Autosécurité brochures](https://www.autosecurite.be/fr/permis-de-conduire/brochures-videos/)
and [AIBV passage-point information](https://www.aibv.be/nl/node/160).
Each source object retains its exact PDF URL, source-byte SHA-256, check time,
validity, original labels and qualification. Historical six-centre and supplemental
ten-centre files remain unchanged, preserving old release evidence/proofs.

## Conservative coordinate subset

The remaining 24 bundles contain 980 non-duplicate references. Offline discovery
and bounded cached public-government queries produced proposals only. From 136
strict topology candidates, **117 source rows in ten Flemish centres** were
explicitly selected after remote review. Their complete published junction label
matches current named public/in-use road features, a unique shared government
endpoint and an independently mapped ground-level OSM shared node. Recognized
car-road morphology, access/status fields, coordinate proximity and grade
separation are checked. The exact evidence/coordinates/notes are hash-frozen;
changing them requires a new review, not a permissive retry.

Out-of-town proposals without an operator-specific municipality, ambiguous road
side-names, partial-label matches, single-road representative nodes, broad network
references and unresolved coordinates are not approved. Distinct printed entries
may describe different arms of one junction; they are not claimed to be 117
geographically unique intersections. The existing 80-metre selection guard remains.

These are **remote location-reference reviews**, not field/instructor approvals,
confirmed exam entrances, guaranteed current turning permissions, parking rights
or fixed exam itineraries. Follow current signs and instructor guidance.
Attribution: [© OpenStreetMap contributors / ODbL](https://www.openstreetmap.org/copyright)
and Wegenregister / Digitaal Vlaanderen.

## Release and verification

`prepare-additional-source-review.cjs --confirm-explicit-remote-review` serializes
the explicit allowlist and checks cached evidence. It does not change a database.
`rehearse-additional-source-review.cjs` restores a fresh private PostgreSQL archive
to an isolated password-protected loopback-only cluster. It checks a forced late
rollback, unchanged protected tables, unchanged unselected/previously reviewed
source rows, preserved printed identities, all existing route-foundation snapshots
and exact repeat-run idempotency.

`apply-additional-source-review.cjs --apply-private-production` requires that same
recent archive/rehearsal/release hash. One serializable transaction verifies and
locks the authorized administrator, refuses source/review overwrites, imports
only missing source rows and reviews only the fixed subset. It cannot update
routes, departures, users, payments, grants, sessions, preferences or trials.
`verify-additional-source-review.cjs` performs read-only post-release checks.
Generated source material, private archive, SSH keys and audit receipts stay out
of Git. Revoke the exact task-only SSH identity and remove only its generated key
pair after use; retain the private backup and evidence.

Local verification: API build and 301 regression tests passed. Fresh private
archive restore, rollback, preservation and idempotency passed for 486 imported
source rows and 117 location reviews. Production status requires a separate dated
receipt; preparation/rehearsal alone is not publication.

## Remaining acceptance work

After this increment, expected coverage is **30 source bundles / 1,226 printed
rows**, including 93 excluded duplicate rows, 270 reviewed source locations and
**863 pending non-duplicate references**. Six bundles have complete source-location
review; 24 do not. Existing public route durations remain 24–27 stored minutes;
their six source-grounded loops are not a claim of full official-source routes at
every centre.

Walloon government road geometry timed out through normal direct and browser
connections. Cached metadata is not fresh geometry/access evidence. Brussels
operator identities were confirmed, but a public passage list was not located in
the focused primary-source review. Ghent-East is a legacy practice-area record,
not an independently confirmed second official Gent exam centre; no user/history
identities are merged or deleted. Clear operator/instructor evidence is still
needed for ambiguous locations, legal departures and remaining source-grounded
23–27-minute loops. Do not fabricate or mark these items complete to close a phase.

## Confirmed production increment

Source catalogue commit `375a83a` deployed successfully to API and frontend.
The first serial private publication attempt stopped without committing: the
read-only check still found exactly 740 source rows, 153 reviewed locations and
zero additional-release audits. No partial import was accepted. Batching the
fixed row locks/checks, parameterized updates and per-row audits removes hundreds
of private round trips without relaxing any review or transaction boundary.

A new private PostgreSQL 18 archive from 05:34 UTC passed full restore, forced
late rollback, protected-table/source-identity preservation and exact idempotency.
The production gate is bound to both release bytes and rehearsed implementation
hash. At **05:35:48 UTC on 20 October 2026**, the atomic release committed 486 new
source names and 117 selected remote location reviews. Existing six foundation
proofs remained valid; no route/departure/account/financial records were updated.

Independent read-only private and public checks confirmed **30 source bundles,
1,226 printed rows, 270 reviewed entries, 93 excluded duplicate rows, 863 pending
non-duplicate references and six fully location-reviewed source bundles**. All
33 directory entries and 137 published routes/current coverage fingerprints remain.
Guest route-point redaction and private endpoint guards passed. Browser QA on
Brugge showed 11 reviewed entries, 46 pending entries, three excluded duplicates
and an explicitly pending departure. This is not a completed all-centre foundation.

The exact temporary SSH identity was revoked, and only its generated private/public
key pair was deleted. The private archives, verified relay host pin and dated
rehearsal/publication/verification/revocation receipts remain in ignored output.
No task database listener remains. No paid upgrade, public database exposure,
additional Mapbox generation or alteration of the user's access plan occurred.
The existing Mapbox console allowance was observed at 7,582/10,000 Directions
requests; this observation is not an authorization for paid expansion.
