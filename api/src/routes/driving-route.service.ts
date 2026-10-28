import { BadRequestException, Injectable } from "@nestjs/common";
import { Coordinate, geometryIssues, durationIssues, loopClosureIssues } from "./route-quality";

type Point = { latitude: number; longitude: number; bearing?: number | null };
export type DrivingRoute = {
  valid: boolean; issues: string[]; durationSec: number | null;
  distanceM: number | null; coordinates: Coordinate[];
  snappedPoints?: Array<{ latitude: number; longitude: number; name: string; bearing?: number | null }>;
  observedFeatures?: string[];
};
const invalid = (issue: string): DrivingRoute => ({ valid: false, issues: [issue], durationSec: null, distanceM: null, coordinates: [] });

@Injectable()
export class DrivingRouteService {
  private readonly cache = new Map<string, { expires: number; value: Promise<DrivingRoute> }>();

  async evaluate(points: Point[], snapRadiusM = 50): Promise<DrivingRoute> {
    if (points.length < 2 || points.length > 25) return invalid("WAYPOINT_COUNT");
    if (points.some(p => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) return invalid("INVALID_COORDINATES");
    if (loopClosureIssues(points.map(p => [p.longitude, p.latitude])).length) return invalid("OPEN_ROUTE");
    const token = process.env.MAPBOX_DIRECTIONS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return invalid("ROUTING_NOT_CONFIGURED");
    const coordinates = points.map(p => `${p.longitude},${p.latitude}`).join(";");
    const bearings = points.map(p => Number.isFinite(p.bearing) ? `${Math.round(p.bearing!) % 360},20` : "").join(";");
    const cacheKey = `${snapRadiusM}:${bearings}:${coordinates}`;
    const existing = this.cache.get(cacheKey);
    if (existing && existing.expires > Date.now()) return existing.value;
    if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
    const value = this.fetchRoute(coordinates, points.length, token, snapRadiusM, bearings);
    this.cache.set(cacheKey, { expires: Date.now() + 300_000, value });
    const result = await value;
    if (result.issues.includes("ROUTING_UNAVAILABLE") || result.issues.includes("ROUTING_NOT_CONFIGURED")) this.cache.delete(cacheKey);
    return result;
  }

  private async fetchRoute(coordinates: string, count: number, token: string, snapRadiusM: number, bearings: string): Promise<DrivingRoute> {
    try {
      const params = new URLSearchParams({ access_token: token, geometries: "geojson", overview: "full", steps: "true", continue_straight: "true", radiuses: Array(count).fill(String(snapRadiusM)).join(";") });
      if (/\d/.test(bearings)) {
        params.set("bearings", bearings);
        // Generated geometry anchors shape a continuous drive, not stopovers.
        params.set("waypoints", `0;${count - 1}`);
      }
      const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return invalid("ROUTING_UNAVAILABLE");
      const payload = await response.json();
      const route = payload.routes?.[0];
      if (payload.code !== "Ok" || !route) return invalid("NO_DRIVABLE_ROUTE");
      const geometry = route.geometry?.coordinates;
      if (!Array.isArray(geometry) || geometry.length < 2 || geometry.length > 12000 || geometry.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)
          || !Number.isFinite(route.duration) || route.duration <= 0 || !Number.isFinite(route.distance) || route.distance <= 0) return invalid("INVALID_ROUTING_RESPONSE");
      const issues = geometryIssues(geometry);
      // Provider snapping may offset the endpoint slightly; never draw an
      // invented closing line or call a drive to another place a full round.
      issues.push(...loopClosureIssues(geometry, 25));
      issues.push(...durationIssues(route.duration));
      if (route.legs?.some((leg: { steps?: Array<{ maneuver?: { modifier?: string } }> }) => leg.steps?.some(step => step.maneuver?.modifier === "uturn"))) issues.push("U_TURN");
      // Preserve the exact seconds for the duration-band check, never round a short
      // route into the permitted band before deciding whether it can be practised.
      const snappedPoints = Array.isArray(payload.waypoints) && payload.waypoints.length === count && payload.waypoints.every((p: { location?: unknown[] }) => Array.isArray(p.location) && p.location.length === 2 && p.location.every(Number.isFinite)) ? payload.waypoints.map((p: { location: number[]; name?: string }) => ({ latitude: p.location[1], longitude: p.location[0], name: typeof p.name === "string" ? p.name : "" })) : undefined;
      // Provider-reported manoeuvres, not instructor-reviewed hazards/rules.
      const manoeuvres: string[] = (route.legs ?? []).flatMap((leg: any) => (leg.steps ?? []).map((step: any) => step.maneuver?.type).filter((type: unknown) => typeof type === "string"));
      const observedFeatures = [...new Set(manoeuvres.flatMap((type: string) => /roundabout|rotary/.test(type) ? ["roundabouts"] : ["turn", "end of road"].includes(type) ? ["junctions"] : type === "merge" ? ["lanes"] : []))];
      return { valid: !issues.length, issues, durationSec: route.duration, distanceM: route.distance, coordinates: geometry, observedFeatures, ...(snappedPoints ? { snappedPoints } : {}) };
    } catch { return invalid("ROUTING_UNAVAILABLE"); }
  }

  async requireValid(points: Point[]) {
    const driving = await this.evaluate(points);
    if (!driving.valid) throw new BadRequestException({ message: `Route needs review: ${driving.issues.join(", ")}. Use a 23–27 minute drive (25 ±2 minutes) without self-crossing, repeated roads or U-turns.`, issues: driving.issues });
    return driving;
  }
}
