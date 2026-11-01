import type { DriveReview } from "./drive-report";

// One independently editable review per source. Older single-review snapshots
// remain readable; neither saving another source nor repeating erases history.
export function sessionReviews(snapshot: unknown): DriveReview[] {
  const s = snapshot as { coachingReview?: DriveReview; coachingReviews?: Record<string, DriveReview> } | null;
  const reviews = new Map<string, DriveReview>();
  for (const r of [s?.coachingReview, ...Object.values(s?.coachingReviews ?? {})]) {
    if (!r || !["self", "instructor_reported"].includes(r.source) || !r.ratings || Array.isArray(r.ratings)) continue;
    const prior = reviews.get(r.source);
    if (!prior || Date.parse(r.savedAt ?? "") >= Date.parse(prior.savedAt ?? "") || !prior.savedAt) reviews.set(r.source, r);
  }
  return [...reviews.values()];
}

export function withoutSessionFeedback(snapshot: Record<string, any>) {
  const { coachingReview, coachingReviews, ...route } = snapshot;
  return route;
}
