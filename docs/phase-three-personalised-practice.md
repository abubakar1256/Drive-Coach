# Phase 3 — personalised preparation

Planning/readiness only. Implementation starts after the complete Phase 2 location release passes fresh backup, restore, production application and public verification. This is the agreed custom phase sequence, not the original generic roadmap headings retained in the Word document.

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
