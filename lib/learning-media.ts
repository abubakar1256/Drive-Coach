export const learningLessons = [
  { id: "observation", title: "Observation & anticipation", titleNl: "Kijken en anticiperen", steps: ["Look ahead and notice the setting.", "Discuss mirror and blind-spot checks.", "Choose one observation focus together."], stepsNl: ["Kijk vooruit en bekijk de situatie.", "Bespreek spiegels en dode hoeken.", "Kies samen een aandachtspunt."] },
  { id: "junctions", title: "Preparing for junctions", titleNl: "Kruispunten voorbereiden", steps: ["Notice the junction layout ahead.", "Review the signs and visibility.", "Discuss a calm approach with your supervisor."], stepsNl: ["Bekijk de indeling van het kruispunt.", "Bespreek borden en zichtbaarheid.", "Bespreek een rustige nadering."] },
  { id: "roundabouts", title: "Preparing for roundabouts", titleNl: "Rotondes voorbereiden", steps: ["Study the approach before your drive.", "Review the actual signs and lane layout.", "Discuss the planned exit with your supervisor."], stepsNl: ["Bestudeer de nadering voor je rit.", "Bekijk actuele borden en rijstroken.", "Bespreek de geplande uitrit."] },
  { id: "lane-planning", title: "Observation before changing position", titleNl: "Kijken voor je positie verandert", steps: ["Notice the road layout and other users.", "Discuss mirrors, blind spots and space.", "Review your plan before moving."], stepsNl: ["Bekijk de weg en andere weggebruikers.", "Bespreek spiegels, dode hoeken en ruimte.", "Bespreek je plan voor vertrek."] },
] as const;
export function lessonForCategory(category?: string) {
  if (category === "roundabout") return "roundabouts";
  if (["junction", "traffic-light", "difficult-turn", "priority"].includes(category ?? "")) return "junctions";
  if (["lane-change", "merging"].includes(category ?? "")) return "lane-planning";
  return "observation";
}
