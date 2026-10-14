export const publishedRoutePolicy = {
  status: "PUBLISHED" as const,
  verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] },
  reviewedBy: { not: null },
  durationMin: { gte: 24 },
};

// Keep Route A/free access stable when administrators add or rename routes.
export const publishedRouteOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];
