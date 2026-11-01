# Phase 2 / 3 local completion increment — 1 November 2026

This increment follows the original eight-phase implementation plan: official
route foundation and personalized practice. It does not rename the phases from
the longer product document. The owner selected **local implementation only**;
no production data, deployment, live route generation or provider allowance is
changed by this work.

## Phase 2: source review is different from route coverage

`GET /api/v1/exam-centres/:slug/passage-coverage` reports distinct source entries,
reviewed coordinates, points linked to current published route proofs, gaps and
stale proofs. A route only counts after its source fingerprints, departure review,
exact control-point sequence and publication policy pass. An ordinary road-network
loop is not silently called an official passage-point route. No provider request
is needed to inspect this report. It is not a fresh driving-time measurement or
a claim that every source point is compulsory during every exam.

The public centre screen displays the counts separately. The protected admin
endpoint `/api/v1/admin/centres/:id/passage-coverage` additionally lists per-entry
route links and missing entries. It suggests 2–6 point selections, excluding
duplicate/unreviewed/nearby locations. Selections are labelled unvalidated inputs,
never shown as actual road geometry or assigned a fabricated duration. The editor
loads a selection into the existing checked draft/review/publish workflow.

`POST /api/v1/admin/centres/:id/passage-coverage/drafts` accepts a confirmed UUID
request and a maximum of 1–8 selections. `PASSAGE_DAILY_REQUEST_BUDGET` and
`PASSAGE_MONTHLY_REQUEST_BUDGET` default to zero. Configure them only after checking
the existing Mapbox allowance, accounting for hometown generation and other clients.
These are conservative application caps, not provider billing guarantees.

Before any evaluation, a transaction locks current actor permission and shared
daily/monthly budget rows, reserves the whole bounded run and records its unique
request key. Replays cannot reserve/spend again. Role permission is checked again
before each evaluation and before saving a draft. Exact reviewed source/departure,
ordered coverage, closed-loop and 1,380–1,620-second checks still apply. Accepted
routes are drafts only; publication/content approval remains a separate operation.
Failures are reported without automatic retries or invented geometry. A cancelled
HTTP request cannot undo a provider request or saved draft: inspect the catalogue
and audit record before starting a new UUID. Interrupted runs keep their reserved
allowance, rather than risking unaccounted duplicate spend.

The last read-only live Alken check, before the local-only instruction, found 32
reviewed source entries, five published loops and one source-linked loop with two
passage points. This local change does not make the remaining 30 entries covered
or claim that 50 different routes exist. Other centres still require their actual
reviewed content and qualifying roads. Complete coverage is reported only when
the current source entries, departure and published proofs actually support it.

## Phase 3: reflection history and explainable workload suggestions

Recommendations and hometown generation now supplement the latest feedback with
at most 12 explicitly assessed drives in the last 90 days. Collection queries are
account-owned and bounded. Source timestamps preserve the distinction between
when a drive happened and when a reflection was edited. Re-saving a report or
having both learner and supervisor feedback never counts as an additional drive.
Public/practice and private hometown session identities cannot collide.

Counts distinguish the six most recent reported drives from up to six previous
ones, explicit difficulties, explicit positive checklist ratings and unknowns.
Not assessed, an omitted difficulty, a positive general feeling and GPS completion
never become an assessed skill success. Conflicting positive/negative feedback
does not erase the reported difficulty. Supervisor identity is not verified by an
account-holder entering supervisor-reported feedback.

The suggestion rubric is a transparent preparation-workload heuristic, **not a
validated ability, safety or exam score**. At least three reported drives and a
recurring issue suggest lighter practice. Three recent drives with at least three
explicit positive areas and no reported issue can suggest Intermediate; with at
least five assessed drives it can suggest Difficult. Otherwise there is no level
suggestion. The learner's selected level is never automatically changed. A manual
profile change still uses the existing owner/version/revision checks.

The dashboard explains the counts and offers a link to review the level choice.
Route matching continues to require current, exact-version reviewed feature
coverage. Hometown loops retain the user's chosen level, bounded provider search,
exact 23–27-minute checks, private ownership and immutable repeat snapshots.
An explicit guard also prevents a final snapped-point validation from running
after all eight hometown evaluations have been used.

AI history sharing stays opt-in. Only the same bounded selected level and labelled
focus codes are exported; raw report text, history tables, name, age, town and GPS
are not added to the model request. No new purchases, plan changes or migrations
are introduced. Missing route/skill evidence remains unknown, and no town or
passage selection is guaranteed a qualifying loop.

## Verification

- API production build, full local regression suite and frontend production build.
- Synthetic coverage tests: edited/stale proof rejection, duplicate-route union,
  private/public redaction, uncovered selection validity, no implicit provider use,
  disabled/exhausted budgets, replay rejection and permission checks.
- Reflection tests: deduplication, source separation, explicit-positive evidence,
  90-day/12-drive limits, missing evidence and unchanged chosen level/access.
- `node api/scripts/verify-phase23-completion.cjs`: disposable password-protected
  PostgreSQL on loopback, synthetic data only, all canonical migrations, actual
  owner-bound Prisma history queries and competing administrators reserving the
  same limited allowance. It checks no new trial/purchase, no publication and no
  provider HTTP request. The cluster is stopped and its generated password file
  deleted in cleanup; local test evidence remains ignored.

No live driving/device test, paid checkout, provider quota verification, complete
new route catalogue, GitHub push or production rollout is claimed by these checks.
Existing unfinished full-route turn-by-turn voice changes remain a separate task.

### Local results

- Final API build passed; **333/333 regression tests** passed.
- Final Next.js production build passed, including type checks.
- Disposable PostgreSQL verification passed actual history queries, account
  isolation, concurrent reservations by different administrators, revoked-role
  rejection and unchanged trial/purchase state. No provider HTTP was permitted.
- No schema migration was introduced. No production route was added or published;
  the 32-reviewed-versus-2-source-linked Alken gap still needs actual validated
  route content and a separately authorized live publication run.
