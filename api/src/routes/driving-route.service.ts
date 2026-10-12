import { BadRequestException, Injectable } from "@nestjs/common";
import { Coordinate, geometryIssues, MIN_DRIVING_SECONDS } from "./route-quality";

type Point = { latitude: number; longitude: number };
export type DrivingRoute = {
  valid: boolean; issues: string[]; durationSec: number | null;
  distanceM: number | null; coordinates: Coordinate[];
};
const invalid = (issue: string): DrivingRoute => ({ valid: false, issues: [issue], durationSec: null, distanceM: null, coordinates: [] });

@Injectable()
export class DrivingRouteService {
  private readonly cache = new Map<string, { expires: number; value: Promise<DrivingRoute> }>();

  async evaluate(points: Point[]): Promise<DrivingRoute> {
    if (points.length < 2 || points.length > 25) return invalid("WAYPOINT_COUNT");
    if (points.some(p => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) return invalid("INVALID_COORDINATES");
    const token = process.env.MAPBOX_DIRECTIONS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return invalid("ROUTING_NOT_CONFIGURED");
    const coordinates = points.map(p => `${p.longitude},${p.latitude}`).join(";");
    const existing = this.cache.get(coordinates);
    if (existing && existing.expires > Date.now()) return existing.value;
    if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
    const value = this.fetchRoute(coordinates, points.length, token);
    this.cache.set(coordinates, { expires: Date.now() + 300_000, value });
    const result = await value;
    if (result.issues.includes("ROUTING_UNAVAILABLE") || result.issues.includes("ROUTING_NOT_CONFIGURED")) this.cache.delete(coordinates);
    return result;
  }

  private async fetchRoute(coordinates: string, count: number, token: string): Promise<DrivingRoute> {
    try {
      const params = new URLSearchParams({ access_token: token, geometries: "geojson", overview: "full", steps: "true", continue_straight: "true", radiuses: Array(count).fill("50").join(";") });
      const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return invalid("ROUTING_UNAVAILABLE");
      const payload = await response.json();
      const route = payload.routes?.[0];
      if (payload.code !== "Ok" || !route) return invalid("NO_DRIVABLE_ROUTE");
      const geometry = route.geometry?.coordinates;
      if (!Array.isArray(geometry) || geometry.length < 2 || geometry.length > 12000 || geometry.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)
          || !Number.isFinite(route.duration) || route.duration <= 0 || !Number.isFinite(route.distance) || route.distance <= 0) return invalid("INVALID_ROUTING_RESPONSE");
      const issues = geometryIssues(geometry);
      if (route.duration < MIN_DRIVING_SECONDS) issues.push("UNDER_24_MINUTES");
      if (route.legs?.some((leg: { steps?: Array<{ maneuver?: { modifier?: string } }> }) => leg.steps?.some(step => step.maneuver?.modifier === "uturn"))) issues.push("U_TURN");
      // Preserve the exact seconds for the minimum check, never round a short
      // route up to 24 minutes before deciding whether it can be practised.
      return { valid: !issues.length, issues, durationSec: route.duration, distanceM: route.distance, coordinates: geometry };
    } catch { return invalid("ROUTING_UNAVAILABLE"); }
  }

  async requireValid(points: Point[]) {
    const driving = await this.evaluate(points);
    if (!driving.valid) throw new BadRequestException({ message: `Route needs review: ${driving.issues.join(", ")}. Use a drivable route of at least 24 minutes without self-crossing, repeated roads or U-turns.`, issues: driving.issues });
    return driving;
  }
}
