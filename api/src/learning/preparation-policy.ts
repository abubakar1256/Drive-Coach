export const preparationLevels = ["BEGINNER", "INTERMEDIATE", "DIFFICULT"] as const;
export type PreparationLevel = typeof preparationLevels[number];
type ReflectionInput = { difficultyCategories?: string[] | null; instructorCategories?: string[] | null; instructorFeedback?: boolean | null; flaggedSpeeding?: boolean | null; missedRightOfWay?: boolean | null; speedCompliance?: number | null; rightOfWayConfidence?: number | null; roundaboutConfidence?: number | null; laneChangeConfidence?: number | null };
const focusAreas = [
  ["speed", "Speed awareness", "Review your speed-awareness reflection with your instructor before the next drive."],
  ["priority", "Priority decisions", "Review the priority situations you found difficult before practising again."],
  ["roundabouts", "Roundabouts", "Discuss the roundabout situations you reported and choose a preparation focus."],
  ["junctions", "Junctions", "Use your junction reflection to agree on one clear preparation goal."],
  ["lanes", "Lane choice", "Review the lane-choice situations you reported with your instructor."],
  ["observation", "Observation", "Discuss the observation checks you want to practise more consistently."],
  ["parking", "Manoeuvres", "Agree on a safe, suitable place to practise the manoeuvres you reported."],
  ["vulnerable", "Vulnerable road users", "Discuss the situations involving pedestrians and cyclists that you reported."],
  ["merging", "Merging", "Review your reported merging situations with your instructor before driving."],
  ["control", "Vehicle control", "Choose a safe practice goal for the vehicle-control difficulties you reported."],
  ["signs", "Signs and signals", "Review the signs and signals you found difficult before driving."],
  ["space", "Space and distance", "Discuss your reported space-management difficulties with your instructor."],
] as const;
export function preparationFocus(level: PreparationLevel, reflection?: ReflectionInput | null, selectionConfirmed = true) {
  if (!preparationLevels.includes(level)) throw new Error("Unknown preparation level");
  const self = new Set(reflection?.difficultyCategories ?? []);
  const instructor = new Set(reflection?.instructorFeedback === true ? reflection.instructorCategories ?? [] : []);
  if (reflection?.flaggedSpeeding || (reflection?.speedCompliance != null && reflection.speedCompliance <= 2)) self.add("speed");
  if (reflection?.missedRightOfWay || (reflection?.rightOfWayConfidence != null && reflection.rightOfWayConfidence <= 2)) self.add("priority");
  if (reflection?.roundaboutConfidence != null && reflection.roundaboutConfidence <= 2) self.add("roundabouts");
  if (reflection?.laneChangeConfidence != null && reflection.laneChangeConfidence <= 2) self.add("lanes");
  const items = focusAreas.filter(([code]) => self.has(code) || instructor.has(code)).map(([code, label, prompt]) => ({ code, label, prompt, basis: [...(self.has(code) ? ["SELF_REPORTED"] : []), ...(instructor.has(code) ? ["INSTRUCTOR_REPORTED"] : [])] }));
  const pacing = { BEGINNER: "Choose one preparation focus and review it while parked.", INTERMEDIATE: "Link familiar preparation goals and reflect on consistency after driving.", DIFFICULT: "Discuss more demanding practice with your instructor; this selection does not certify readiness." };
  return { selectedLevel: level, levelSource: selectionConfirmed ? "USER_CHOICE" : "DEFAULT_NOT_YET_SELECTED", abilityInferred: false, pacing: pacing[level], items, needsReflection: items.length === 0, targetMinutes: 25, toleranceMinutes: 2, routeGeneration: "NOT_REQUESTED", safety: "Self/instructor-reported preparation, not detected traffic violations, an exam score or permission to drive. Route access and reviewed geometry stay unchanged." };
}
