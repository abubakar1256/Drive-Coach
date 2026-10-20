// A transparent map-feature workload estimate, not an ability/safety/exam score.
export const MAPPED_WORKLOAD_RUBRIC = "MAPPED_INTERACTIONS_V1";
export function mappedWorkload(metrics: { junctionClusters: number; signalClusters: number; roundaboutClusters: number; motorwayRampWays: number }) {
  const values = [metrics.junctionClusters, metrics.signalClusters, metrics.roundaboutClusters, metrics.motorwayRampWays];
  if (values.some(n => !Number.isSafeInteger(n) || n < 0 || n > 10000) || metrics.junctionClusters === 0) return null;
  const interactions = metrics.junctionClusters + 2 * metrics.signalClusters + 4 * metrics.roundaboutClusters;
  // Matched motorway approaches never receive the low band merely because
  // there are few ordinary intersections. This is not a merge-skill claim.
  return { band: metrics.motorwayRampWays > 0 ? "HIGH" : interactions <= 55 ? "LOW" : interactions <= 105 ? "MEDIUM" : "HIGH", interactions, rubric: MAPPED_WORKLOAD_RUBRIC };
}
export function mappedCoverageDetails(notes: string, complexity: string) {
  try {
    const evidence = JSON.parse(notes);
    if (evidence.kind !== "REMOTE_MAP_FEATURES_V1" || evidence.rubric !== MAPPED_WORKLOAD_RUBRIC || !evidence.metrics || !/^[a-f0-9]{64}$/.test(evidence.mapSha256 ?? "") || !/^[a-f0-9]{64}$/.test(evidence.drivingSha256 ?? "")) return null;
    const workload = mappedWorkload(evidence.metrics);
    if (!workload || workload.band !== complexity) return null;
    return { basis: "REMOTE_MAP_FEATURES", label: "Map-based workload", rubric: workload.rubric, metrics: { junctionClusters: evidence.metrics.junctionClusters, signalClusters: evidence.metrics.signalClusters, roundaboutClusters: evidence.metrics.roundaboutClusters, motorwayRampWays: evidence.metrics.motorwayRampWays }, limitation: "Mapped-feature planning estimate, not instructor approval, learner ability or guaranteed current signs/traffic. Discuss route suitability with your instructor." };
  } catch { return null; }
}
