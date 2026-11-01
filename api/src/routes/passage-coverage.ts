import { coordinate, type GeoPoint } from "./foundation-quality";
import { geometryIssues } from "./route-quality";
import { metres } from "../learning/practice-progress";

type PlanningPoint = GeoPoint & { id: string; sequence: number; junction: string };
// A gap-filling selection is only an input to the existing Directions and review
// gates. Straight-line geometry is never returned as a drivable/published route.
export function uncoveredSelections(departure: GeoPoint | null, ready: PlanningPoint[], coveredIds: Set<string>) {
  if (!departure) return [];
  const missing = new Set(ready.filter(p => !coveredIds.has(p.id)).map(p => p.id));
  const selections: Array<{ passagePointIds: string[]; sequences: number[]; newlyCovered: number; status: "NEEDS_DRIVING_VALIDATION" }> = [];
  for (const anchor of ready.filter(p => missing.has(p.id))) {
    if (!missing.has(anchor.id)) continue;
    const chosen: PlanningPoint[] = [];
    const options = [anchor, ...ready.filter(p => p.id !== anchor.id).sort((a, b) => Number(missing.has(b.id)) - Number(missing.has(a.id)) || metres(coordinate(anchor), coordinate(a)) - metres(coordinate(anchor), coordinate(b)) || a.sequence - b.sequence)];
    for (const p of options) {
      if (chosen.length === 6) break;
      if (metres(coordinate(departure), coordinate(p)) < 80 || chosen.some(q => metres(coordinate(q), coordinate(p)) < 80)) continue;
      chosen.push(p);
    }
    if (chosen.length < 2 || !chosen.some(p => p.id === anchor.id)) continue;
    const centre = [departure, ...chosen].reduce((c, p) => ({ latitude: c.latitude + p.latitude / (chosen.length + 1), longitude: c.longitude + p.longitude / (chosen.length + 1) }), { latitude: 0, longitude: 0 });
    const circular = [departure, ...chosen].sort((a, b) => Math.atan2(a.latitude - centre.latitude, a.longitude - centre.longitude) - Math.atan2(b.latitude - centre.latitude, b.longitude - centre.longitude));
    const start = circular.indexOf(departure), ordered = [...circular.slice(start + 1), ...circular.slice(0, start)] as PlanningPoint[];
    if (geometryIssues([departure, ...ordered, departure].map(coordinate)).length) continue;
    const newlyCovered = ordered.filter(p => missing.has(p.id)).length;
    selections.push({ passagePointIds: ordered.map(p => p.id), sequences: ordered.map(p => p.sequence), newlyCovered, status: "NEEDS_DRIVING_VALIDATION" });
    ordered.forEach(p => missing.delete(p.id));
  }
  return selections;
}
