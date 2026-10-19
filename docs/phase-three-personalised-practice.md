# Phase 3 — personalised preparation

Phase 3 implementation: 20 October 2026 (Pakistan time). The agreed custom phase sequence covers private preferences, explainable recommendations, AI grounding and bounded hometown practice. It does not claim field/instructor approval, fixed examiner itineraries, mobile background GPS or new payment products.

## Initial profile increment (19 October verification history)

- Additive `0019_private_preparation_profile`: an optional account-owned profile, no legacy backfill and no changes to existing route/billing/trial tables. Preferred name, optional age, centre/town preference and chosen level are private; town input does not request an address or device location.
- JWT-protected private/no-store GET/PATCH/DELETE endpoints at `/api/v1/me/preparation-profile`. The authenticated actor owns every operation. A body owner binding prevents in-flight account confusion; user-row locking plus version/UUID revision checks prevent stale writes, including after clear/recreate. Audit records contain field names, not age/name/town values.
- Dashboard form, accessible level choices, optional-profile clearing confirmation with safe cancellation focus, and private reflection-focus cards. Preference selection never moves a Basic purchase or grants route access.
- Pure `preparationFocus` labels self-reported and instructor-reported inputs, ignores unknown categories, distinguishes an unselected default from a user choice, and never infers competence from age or GPS. All levels retain the same route validation/time/access contract. No routing or AI provider is called.
- Privacy disclosure updated in the existing English/Dutch copy. Clearing removes active optional preferences, not practice history, purchases or the registered account name; backups follow the existing retention process.

Verification: 269/269 regression tests, API/frontend builds and Prisma validation; a real isolated PostgreSQL archive restore passed additive-migration preservation, owner/version checks, forced late-audit rollback, SQL constraints and account cascade. Browser QA used only a synthetic loopback account: save/reload, level change, unchanged Free access and clear/cancel keyboard focus. Temporary preview servers were stopped. Private production data was not used by the browser fixture.

## Completed Phase 3 implementation

- Recommendations use explicit source-backed `PreparationCoverage` reviews tied to an exact route version/point fingerprint. Stale coverage, legacy seed tags and description keywords cannot invent skill matches. Unknown coverage stays unknown. `/admin/preparation` is the review workflow; current database reviewer permission is checked, not only a previously signed role token. No blanket automatic content approval occurs.
- Recommendations, current route coach and repeat links retain server-side Free / Basic-centre / Premium gates. Listing never claims/renews a trial. A saved public route can be repeated only with current access and the same checked version/fingerprint; changed/legacy routes give an explicit recheck state without rewriting history.
- The latest account-owned self-reflection, instructor-reported checklist or private hometown reflection supplies labelled focus, never a competence or violation score. Chosen Beginner / Intermediate / Difficult changes preparation pacing and reviewed complexity matching, not road safety or duration constraints.
- AI context sharing is explicit and off by default. Only chosen level and bounded reported focus codes/basis are exported. No profile name, age, hometown, GPS, raw notes, private route geometry or history is exported by that control. Existing chat entitlement remains enforced on every request. The new-conversation control resets local context and consent; it cannot retract data already sent to a provider.
- Private hometown generation uses a licensed build-time GeoNames Belgian populated-place gazetteer (12,461 entries), not stored temporary paid geocodes or device GPS. Users explicitly select the exact town and consent while parked. Town/road anchors are search inputs, not confirmed entrances or stopping places.
- At most **8 Directions evaluations** per generation, database-locked daily/monthly shared reservations, an account cooldown and idempotent request keys. Missing/exhausted owner-approved allowance makes no new provider requests. A failed search never fabricates geometry, time or features. Source-centre paid access and the profile revision are rechecked after generation.
- Only closed, ordered, connected, non-self-crossing/non-backtracking driving geometry with exact **23–27 minute** measurements passes. The accepted private snapshot is immutable and separate from the public catalogue. Provider-reported roundabout/junction/merge-derived features are labelled, not called instructor-reviewed road facts. Unsupported requested skills remain explicitly unknown.
- `/hometown/:id` has Mapbox, complete Google Maps links, parked-start/optional browser GPS, permission-denial states, background pause, progress/end/reflection and exact saved-route repeat. No GPS means no guessed completion. Ownership is checked on every private operation; current source-centre paid access gates geometry/GPS. History/end/delete remain available without a route-detail paywall. Private route navigation needs rechecking after 30 days; deletion removes its own sessions/reflections. Profile clearing alone does not delete history. A composite route/owner foreign key enforces isolation in PostgreSQL.
- Migrations **0019/0020** are additive and do not backfill buyers, mutate public routes, prices, paid grants, trials or historical snapshots. Fresh private backup, matching real restore, forced late rollback, concurrency and protected-table preservation are required before deployment.

Verification and rollout: the scoped backup/deploy approval was received for Phase 3. The final verified deployment/cleanup result is recorded separately after production checks; do not equate a local build or staging rehearsal with live completion. Scope limits: feature coverage requires actual source-backed content review; unsupported matches remain unknown, and a qualifying hometown loop cannot be guaranteed for every town.

Sources: [GeoNames format/licence](https://download.geonames.org/export/dump/readme.txt), [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/). Gazetteer source URL, retrieval time and archive hash are included in the data asset. Routing budget flags in `api/.env.example` default to zero; only configure them after checking the existing provider allowance, without paid expansion.

## Scope from the updated requirements

1. Ask for name, age, chosen exam centre and preferred Beginner / Intermediate / Difficult preparation level. Legacy accounts retain purchased access while completing any new profile; never infer a learner's age or actual competence.
2. Use the learner's own reflection and optional instructor feedback to explain focus areas and suggest practice. Confidence/self-report is not proof of a traffic violation. A level remains user-adjustable and is not an official assessment or a passing prediction.
3. Keep practice history, completion markers, repeat-the-same-route and private reflections linked to the immutable saved route version. Existing history must survive rollout.
4. Prepare hometown practice around similar road-feature types and reported difficulties. Clearly label it hometown road-network practice, not a copied official itinerary or an operator-approved route. No inferred official passage points.
5. Ground preparation rules and optional short voice reminders in reviewed, versioned content. Voice defaults off. Ask the user to configure while parked; Google Maps/background browser use cannot guarantee continuous GPS capture.

Offline/mobile and additional languages remain deferred. No new school/instructor account product, payment plan, price or automatic paid provider upgrade is part of this phase.

## Implementation order

### 3A — private profile and difficulty contract

Add a separately validated, account-owned preparation profile and authenticated private/no-store endpoints. Store no precise home address by default: a user-selected town/area is sufficient. Profile updates cannot change role, subscription, expiry, trial or Basic centre entitlement. Document retention and location use before collecting new personal data. Add an accessible parked/pre-drive profile flow; do not silently block paid legacy access.

### 3B — explainable recommendations

Build a deterministic, testable focus/difficulty selector over user-reported reflection and explicitly reviewed route-feature coverage. Return the reasons and evidence provenance. Missing coverage means unknown, not an invented roundabout, hazard or speed limit. All recommended route detail/media/voice access must pass the existing Free / Basic / Premium server checks. No new trial route or extension is created by switching level or recommendation.

### 3C — bounded hometown preparation

Use the reviewed road-network validation contract: legal driving provider, connected geometry, ordered coverage, target 25 ±2 minutes, no fabricated duration or forced self-crossing. Keep practice suggestions separate from published operator-source records. Provider requests must be explicitly bounded against the existing allowance; pause before any paid expansion. Failure yields a clear unavailable state, not an invented route.

### 3D — rollout acceptance

- New and legacy accounts; Free trial available/active/expired; Basic selected/other centre; Premium; expired/revoked subscriptions.
- Profile ownership, private caching, no age/location leaks in public catalogue, stale auth and cross-account requests.
- User level override, absent reflection, contradictory instructor/self-reports, incomplete feature coverage, repeat route/version preservation.
- Optional GPS/voice denial, stop/revoke, inaccurate readings and browser background pauses.
- Full isolated migration/restore/rollback rehearsal before any schema rollout, then API/frontend deployment and a real account-owned end-to-end check.

The delivered Phase 3 implementation includes 3A, source-backed 3B ranking/AI grounding, bounded private 3C generation and 3D test/restore acceptance. It never equates an optional profile form, a matching keyword or a synthetic provider fixture with real road validation. Operational live results follow only after the approved rollout is verified.
