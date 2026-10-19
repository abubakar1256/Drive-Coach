# Phase 3 — personalised preparation

Started locally on 19 October 2026 after the Phase 2 location release passed backup, restore, production application and public verification. **3A and the pure focus-policy portion of 3B are implemented/tested locally; this is not the full Phase 3 product or a production rollout.** This is the agreed custom phase sequence, not the original generic roadmap headings retained in the Word document.

## First increment delivered locally

- Additive `0019_private_preparation_profile`: an optional account-owned profile, no legacy backfill and no changes to existing route/billing/trial tables. Preferred name, optional age, centre/town preference and chosen level are private; town input does not request an address or device location.
- JWT-protected private/no-store GET/PATCH/DELETE endpoints at `/api/v1/me/preparation-profile`. The authenticated actor owns every operation. A body owner binding prevents in-flight account confusion; user-row locking plus version/UUID revision checks prevent stale writes, including after clear/recreate. Audit records contain field names, not age/name/town values.
- Dashboard form, accessible level choices, optional-profile clearing confirmation with safe cancellation focus, and private reflection-focus cards. Preference selection never moves a Basic purchase or grants route access.
- Pure `preparationFocus` labels self-reported and instructor-reported inputs, ignores unknown categories, distinguishes an unselected default from a user choice, and never infers competence from age or GPS. All levels retain the same route validation/time/access contract. No routing or AI provider is called.
- Privacy disclosure updated in the existing English/Dutch copy. Clearing removes active optional preferences, not practice history, purchases or the registered account name; backups follow the existing retention process.

Verification: 269/269 regression tests, API/frontend builds and Prisma validation; a real isolated PostgreSQL archive restore passed additive-migration preservation, owner/version checks, forced late-audit rollback, SQL constraints and account cascade. Browser QA used only a synthetic loopback account: save/reload, level change, unchanged Free access and clear/cancel keyboard focus. Temporary preview servers were stopped. Private production data was not used by the browser fixture.

**Rollout remains pending:** this increment is not pushed/deployed to production. Migration 0019 needs a new matching backup/rehearsal and explicit rollout authorization. Do not infer that a Phase 2 backup/temporary-key approval authorizes a Phase 3 schema rollout. Route-feature coverage/ranking, bounded hometown generation and the remaining acceptance work below are still pending.

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

The first implementation increment is 3A plus a pure, no-provider-call recommendation policy from 3B. The broader hometown generator is not marked complete merely because a profile form exists.
