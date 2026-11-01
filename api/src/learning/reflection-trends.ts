import { preparationFocus, type PreparationLevel } from "./preparation-policy";

export type ReportedObservation = {
  sessionKey: string;
  drivenAt: string;
  savedAt: string;
  source: "SELF_REPORTED" | "INSTRUCTOR_REPORTED";
  difficulties: string[];
  assessedGood: string[];
};
const codes = preparationFocus("BEGINNER", {
  difficultyCategories: ["speed", "priority", "roundabouts", "junctions", "lanes", "observation", "parking", "vulnerable", "merging", "control", "signs", "space"],
}).items.map(i => i.code);
const skills = new Set<string>(codes);
const checklistSkills: Record<string, string> = {
  mirrors: "observation", blind_spots: "observation", signals: "signs", lane_position: "lanes",
  junctions: "junctions", roundabouts: "roundabouts", priority: "priority", speed_choice: "speed",
  following_distance: "space", vulnerable_users: "vulnerable", parking: "parking", vehicle_control: "control",
};
const bounded = (values: unknown): string[] => Array.isArray(values)
  ? [...new Set(values.filter((v): v is string => typeof v === "string" && skills.has(v)))].slice(0, codes.length) : [];

// Only explicit reported categories/ratings enter this calculation. Missing a
// difficulty, completing GPS geometry or omitting a checklist is never a success.
export function reportedObservations(sessionKey: string, drivenAt: Date | string, savedAt: Date | string, input: any, checklist = false): ReportedObservation[] {
  if (!Number.isFinite(new Date(drivenAt).getTime()) || !Number.isFinite(new Date(savedAt).getTime())) return [];
  const driven = new Date(drivenAt).toISOString(), saved = new Date(savedAt).toISOString();
  if (!input || typeof input !== "object") return [];
  if (checklist) {
    if (!["self", "instructor_reported"].includes(input.source) || !input.ratings || typeof input.ratings !== "object") return [];
    const ratings = Object.entries(input.ratings).filter(([key]) => checklistSkills[key]);
    // Several observation checks map to one skill: any reported difficulty wins.
    const difficulties = bounded(ratings.filter(([, value]) => value === "practice").map(([key]) => checklistSkills[key]));
    const assessedGood = bounded(ratings.filter(([, value]) => value === "good").map(([key]) => checklistSkills[key])).filter(c => !difficulties.includes(c));
    if (!difficulties.length && !assessedGood.length) return [];
    return [{ sessionKey, drivenAt: driven, savedAt: saved, source: input.source === "self" ? "SELF_REPORTED" : "INSTRUCTOR_REPORTED", difficulties, assessedGood }];
  }
  const self = preparationFocus("BEGINNER", input).items.filter(i => i.basis.includes("SELF_REPORTED")).map(i => i.code);
  const instructor = input.instructorFeedback === true ? bounded(input.instructorCategories) : [];
  return [
    ...(self.length ? [{ sessionKey, drivenAt: driven, savedAt: saved, source: "SELF_REPORTED" as const, difficulties: bounded(self), assessedGood: [] }] : []),
    ...(instructor.length ? [{ sessionKey, drivenAt: driven, savedAt: saved, source: "INSTRUCTOR_REPORTED" as const, difficulties: instructor, assessedGood: [] }] : []),
  ];
}

export function reflectionTrends(observations: ReportedObservation[], selectedLevel: PreparationLevel, now = new Date()) {
  const cutoff = now.getTime() - 90 * 86400000;
  // Keep the latest entry for each source/session. Self and supervisor reports
  // remain separate; one drive cannot become several statistics by re-saving it.
  const latest = new Map<string, ReportedObservation>();
  for (const observation of observations) {
    const driven = Date.parse(observation.drivenAt), saved = Date.parse(observation.savedAt);
    if (!observation.sessionKey || !["SELF_REPORTED", "INSTRUCTOR_REPORTED"].includes(observation.source) || !Number.isFinite(driven) || !Number.isFinite(saved) || driven < cutoff || driven > now.getTime() || saved > now.getTime() + 60000) continue;
    const key = `${observation.sessionKey}:${observation.source}`, prior = latest.get(key);
    if (!prior || saved > Date.parse(prior.savedAt)) latest.set(key, { ...observation, difficulties: bounded(observation.difficulties), assessedGood: bounded(observation.assessedGood).filter(c => !observation.difficulties.includes(c)) });
  }
  const sessions = [...new Set([...latest.values()].filter(o => o.difficulties.length || o.assessedGood.length).map(o => o.sessionKey))].sort((a, b) => {
    const time = (key: string) => Math.max(...[...latest.values()].filter(o => o.sessionKey === key).map(o => Date.parse(o.drivenAt)));
    return time(b) - time(a) || a.localeCompare(b);
  }).slice(0, 12);
  const recentKeys = new Set(sessions.slice(0, 6)), previousKeys = new Set(sessions.slice(6));
  const rows = [...latest.values()].filter(o => sessions.includes(o.sessionKey));
  const bySkill = codes.map(code => {
    const assessed = rows.filter(o => o.difficulties.includes(code) || o.assessedGood.includes(code));
    const issueKeys = new Set(assessed.filter(o => o.difficulties.includes(code)).map(o => o.sessionKey));
    const recent = [...issueKeys].filter(k => recentKeys.has(k)).length;
    const previous = [...issueKeys].filter(k => previousKeys.has(k)).length;
    const goodRecent = new Set(assessed.filter(o => recentKeys.has(o.sessionKey) && o.assessedGood.includes(code) && !issueKeys.has(o.sessionKey)).map(o => o.sessionKey)).size;
    const basis = [...new Set(assessed.map(o => o.source))];
    const difficultyBasis = [...new Set(assessed.filter(o => recentKeys.has(o.sessionKey) && o.difficulties.includes(code)).map(o => o.source))];
    const status = recent >= 2 ? "RECURRING" : previous > 0 && recent === 0 && goodRecent >= 2 ? "REPORTED_IMPROVEMENT" : recent === 1 ? "REPORTED_FOCUS" : "INSUFFICIENT_EVIDENCE";
    return { code, recentDifficultySessions: recent, previousDifficultySessions: previous, recentGoodSessions: goodRecent, assessedSessions: new Set(assessed.map(o => o.sessionKey)).size, status, basis, difficultyBasis };
  }).filter(s => s.assessedSessions > 0);
  const recentSessions = sessions.slice(0, 3).map(key => {
    const reports = rows.filter(o => o.sessionKey === key);
    const issues = new Set(reports.flatMap(o => o.difficulties));
    const good = new Set(reports.flatMap(o => o.assessedGood).filter(c => !issues.has(c)));
    return { issues: issues.size, good: good.size };
  });
  let suggestedLevel: PreparationLevel | null = null;
  let reason = "More explicit reports are needed. Missing difficulties are not evidence of improvement.";
  if (sessions.length >= 3 && bySkill.some(s => s.status === "RECURRING")) {
    suggestedLevel = "BEGINNER"; reason = "Repeated reported difficulties suggest a lighter workload and one preparation focus.";
  } else if (recentSessions.length === 3 && recentSessions.every(s => s.issues === 0 && s.good >= 3)) {
    suggestedLevel = sessions.length >= 5 ? "DIFFICULT" : "INTERMEDIATE";
    reason = "Three recent drives have explicit positive reports for at least three areas and no reported difficulties. Discuss a higher workload with your supervisor.";
  }
  const active = bySkill.filter(s => s.recentDifficultySessions > 0).sort((a, b) => b.recentDifficultySessions - a.recentDifficultySessions || codes.indexOf(a.code) - codes.indexOf(b.code));
  const focus = preparationFocus(selectedLevel, { difficultyCategories: active.filter(s => s.difficultyBasis.includes("SELF_REPORTED")).map(s => s.code), instructorFeedback: true, instructorCategories: active.filter(s => s.difficultyBasis.includes("INSTRUCTOR_REPORTED")).map(s => s.code) });
  return { sessionCount: sessions.length, windowDays: 90, maxSessions: 12, recentSessionCount: recentKeys.size, previousSessionCount: previousKeys.size, skills: bySkill, suggestedLevel, selectedLevel, automaticallyApplied: false, reason, focus, limitation: "Reported preparation trends and workload suggestions, not detected violations, instructor identity verification, driving ability or an exam prediction. Your chosen level and paid access are unchanged." };
}
