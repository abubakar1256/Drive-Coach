# Practice feedback and debrief

## User flow

1. Open an accessible route. Review the preparation checklist while parked.
2. Start practice and choose optional GPS consent (or practise without GPS).
3. The existing server confirms ordered route progress. A separate live observation shows near-route, possible deviation, weak signal, or unavailable evidence, plus an optional speed estimate.
4. End practice. Open the session report and its instructor/self-review checklist from the practice controls or dashboard's after-drive reports.
5. Mark observed skills Good / Needs practice / Not assessed, choose the feedback source, add notes and confirm being parked before saving. Saved needs-practice skills supply next-practice tips in this report. Existing reflection and next-route flows remain unchanged.

## Evidence boundaries

- GPS observations are not traffic-law violations or an examiner's skill score.
- A possible deviation requires at least three accurate samples (accuracy <=35 m) spanning at least five seconds, further than max(50 m, twice reported accuracy) from saved route geometry.
- Gaps over 30 seconds, poor accuracy and implausible movement reset sustained-deviation evidence. Approximate distance excludes uncertain small movement and gaps. Plot segments also break across unreliable data.
- Speeds come from browser GPS, not verified speed-limit data. Overspeed, harsh braking, acceleration, lane position, mirrors, signals and priority are NOT automatically assessed. No device-motion permission or calibrated sensor integration is added.
- GPS time coverage and ordered route completion are different measurements. Unconfirmed points may reflect missing data or an early finish, not missed road instructions.
- Google Maps does not send telemetry back. Background tabs and locked screens can interrupt collection. Reports do not invent the missing path.
- Instructor-reported checklist data is entered by the account holder. It is not independently authenticated instructor feedback; the existing school's authenticated feedback system remains separate.
- Preparation text is general safety guidance, not a comprehensive or jurisdiction-specific rules library. Existing paid, verified route voice guidance remains separate; the preparation reminder is also limited to paid route access.

## API and storage

- `GET /api/v1/practice-sessions/:id/report`: JWT/owner-only, private/no-store. Maximum 20,000 samples with an explicit truncated indicator. Uses the session's saved route snapshot. Current paid-route access is rechecked before returning saved route geometry; personal session observations remain available.
- `POST /api/v1/practice-sessions/:id/review`: JWT/owner-only, ended sessions only, row lock, 12 allowlisted skill keys, three allowlisted ratings, notes <=2000 characters. Additive `coachingReview` metadata in the existing JSON route snapshot; never rewrites route geometry, progress, payments or existing reflection.
- Consented `/track` samples rejected for route progress can still be retained for the report; otherwise off-route evidence would be lost. Poor samples never advance route progress. Existing one-second throttling and ended-session rejection remain. Stale supplied timestamps are rejected.
- No schema migration, external location-sharing integration, new provider token, or paid service is required. Reports are recomputed from saved evidence and checklist metadata.
- Older sessions cannot reconstruct GPS samples that were previously rejected/not recorded. Their reports may have incomplete evidence.

## Verification

Run `pnpm test:drive-feedback`, `pnpm test:platform`, `pnpm exec tsc --noEmit`, and `pnpm build`.
Tests use synthetic data and mocked persistence. They cover no-GPS/poor-GPS, outliers, gaps, deviation thresholds, metadata preservation, ownership, paid-route redaction, stale telemetry, manual source attribution, active-session review denial and failed-save draft retention. They do not certify real-world detection accuracy or exercise a production database.

After deployment, verify with a consenting test account while parked; a supervised road trial is still needed to evaluate device-specific accuracy. Do not label a simulated run as real driving or manually fabricate completion.
