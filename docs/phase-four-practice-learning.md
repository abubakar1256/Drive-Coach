# Phase 4 — Practice and learning content

This implements Phase 4 of the agreed eight-phase plan. It does not rename the
phases from the longer product specification. This release adds no migration,
provider-generation job, purchase, entitlement change or production content import.

## Practice continuity

- Account-owned `GET /me/practice-status` supplies route-level attempts, confirmed
  completions, latest report and an unfinished session. Centre/route filters are
  bounded and parameterized. It does not return GPS, notes or route geometry, and
  historical completion never grants access. Results are private/no-store.
- Centre route cards show previous completion separately from a current attempt.
  The dashboard learning journal links reports and the route's current access
  check. Dashboard statistics aggregate all sessions rather than the last eight.
- `GET /practice-sessions/:id` resumes an owned active session only with current
  exact-route access and matching route version/control-point fingerprint.
  It uses the saved geometry; resuming does not request a new Directions route.
  The map receives that same saved geometry. It does not restart GPS silently.
- Changed/legacy sessions can be ended while preserving their report before a
  fresh practice is started. Repeating a compatible ended session creates a new
  attempt, keeps its route snapshot and removes both old feedback collections.
  Previous reports remain intact. Existing start/repeat concurrency locks remain.
- GPS requires the existing explicit location consent. Stale device positions are
  ignored by the UI. Hiding the page stops its GPS watcher; returning requires
  explicit re-enabling. Native background GPS/CarPlay are outside this web phase.
  A browser may suspend JavaScript; reliable background recording is not promised.
- Same-account access-token rotation sends a session-refresh event, preserving
  consented practice and unsaved feedback rather than treating it as a new login.
  The plan provider rechecks access. Real login/logout/expiry still clears private
  state; forbidden tracking responses stop GPS. Late refreshes cannot overwrite
  a newer login, and a pending request cannot retry with another account's token.
- Only server-confirmed GPS route following can produce COMPLETED. Ending a
  no-GPS/partial attempt saves ENDED; it does not create an ability/pass score.

## After-drive feedback

- Self-review and account-holder-entered accompanying-person feedback are stored
  separately in the existing session JSON. Older single-review snapshots still
  load. The immutable route snapshot and structured self-reflection are preserved.
- The report loads the original structured reflection, both saved checklists,
  provenance, notes, GPS quality, confidence and improvement prompts. Unassessed
  skills remain unassessed. A parent/friend/instructor needs no separate account;
  their identity is not independently authenticated by this workflow.
- The client sends the selected source's saved revision. A row lock and optimistic
  check reject stale same-source updates, including legacy attempts to overwrite
  an existing timestamped review without its revision. Different sources can be
  saved concurrently without replacing each other. Audit failure rolls back.
- Source switching keeps separate in-memory drafts. Reload explicitly discards
  unsaved drafts; account changes clear them. The report is usable after plan
  expiry, but paid route geometry remains redacted. Ending precedes checklist edits.
- Reflection-history recommendations read both checklist sources while counting
  one assessed drive once. Feedback is reported evidence, not camera assessment.

## Optional voice

Voice reminders reuse the practice's explicitly enabled GPS stream. There is no
second geolocation watcher, automatic GPS request or replay queue. An active
session, paid access to that exact route, reliable fresh position and an approved
server tip are required. Requests are deduplicated and reminders spaced apart.
Stopping GPS, ending practice, changing account or hiding the page stops speech.
Light/Coach/Intensive and stop controls remain optional. Browser/device speech
support varies. This is not the separate unfinished full-route turn-by-turn task.

## Images, video and rights

Four original project lessons cover observation, junction preparation, roundabout
preparation and planning observation before changing position. Each has a poster,
an eight-second MP4, English/Dutch captions and a text transcript. Playback is
user initiated and pauses on backgrounding. They are clearly labelled generic
diagrams, **not location photographs, verified junction footage or a simulation
of applicable traffic priority**. No competitor content is copied. The generator
and SHA-256/provenance manifest are included. No real driving or legal-rule claim
is inferred from these diagrams.

Files live under `api/content/learning-media`, not public web assets. The
`/learning-media/:id/:kind?routeId=…` endpoint checks current paid access to that
exact route before reading a whitelisted file; a free route trial is insufficient.
The API Dockerfile already copies this content directory. No external media
provider, paid licence or new account is required.

Admin point upload now requires a rights holder, publication licence/permission,
ownership/licensed choice and confirmation. Third-party media additionally needs
an HTTPS source/licence reference. The upload audit stores the rights declaration
atomically with the asset; it is **uploader-declared, not independently certified**.
The editor previews the file and links it through the existing draft/review flow.
Learners can inspect available attribution through an authorized description
endpoint. Legacy files without a rights record are explicitly identified.

Actual difficult-junction photos/recordings still require an owner/licensor to
provide the relevant material and permissions. This software supplies the complete
upload/review/delivery workflow and original instructional alternatives; it does
not claim that real footage for every centre exists.

## Verification and rollout

`node api/scripts/verify-phase4-completion.cjs` creates a new password-protected
loopback PostgreSQL instance, applies canonical migrations and uses synthetic
accounts/routes only. It checks real status SQL and all-history totals, ownership,
two-source and stale-edit concurrency, rollback, resume/repeat geometry, no-GPS
completion, rights metadata, Basic centre isolation and expired-access redaction.
It asserts unchanged plans/trials/payments and forbids provider HTTP calls.

`--preview` additionally runs a temporary synthetic local API for UI checks. Its
temporary login metadata stays in ignored output. Stop it using the recorded
stop-file, or its 15-minute lifetime; cleanup stops its API/database and removes
temporary passwords. These fixtures are labelled SYNTHETIC / DO NOT DRIVE and
must never be imported or published in production.

Full API/frontend builds, regression tests and browser verification accompany this
phase. A production rollout must separately be recorded; local implementation is
not evidence that a live deployment or real-device GPS drive test occurred.

### Local verification record — 2 November 2026

- Isolated frontend production build and API build passed. The review checkout
  excludes the four pre-existing unfinished navigation files.
- That exact Phase 4 source set passed **350/350** regression tests. The mixed
  development workspace passed **352/352**, including two separate navigation
  tests which are not part of this phase.
- Disposable PostgreSQL verification passed actual ownership, status SQL,
  concurrency, rollback, access expiry and unchanged financial/trial state.
- Local HTTP checks passed JWT guards, private/no-store, invalid source rejection,
  stale-edit conflicts, wrong-owner rejection, exact-centre media gates and actual
  MP4 delivery. Repeat/resume used the identical saved geometry.
- Browser checks on synthetic accounts passed separate-source checklist save,
  preserved unsaved source drafts, full-history journal, captioned eight-second
  video decoding, explicit resume consent, no-GPS resume and partial session end.
  No real device location was requested or simulated as a real drive.
- Existing production service and catalogue were not modified by this phase.
- A fresh local database archive and checksum were verified before starting the
  ordinary local backend/frontend. Local health/dashboard return 200; private
  status/media endpoints reject unauthenticated requests with 401. No reset,
  migration or replacement of the existing local route catalogue was performed.
