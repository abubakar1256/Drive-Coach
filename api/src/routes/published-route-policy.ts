export const publishedRoutePolicy = {
  status: "PUBLISHED" as const,
  verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] },
  reviewedBy: { not: null },
  // Keep legacy route metadata visible for review rather than silently deleting
  // catalogue entries. Fresh driving checks enforce the complete 23–27m band.
  durationMin: { gte: 23 },
};

// Keep route labels and progression stable when administrators add or rename routes.
export const publishedRouteOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];
