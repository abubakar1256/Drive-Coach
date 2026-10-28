type RoutePointLike = {
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function hasCoordinates(point: RoutePointLike): point is RoutePointLike & { latitude: number; longitude: number } {
  return typeof point.latitude === "number" && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === "number" && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

// One drive, not a separate route/stop for each shaping anchor.
export function routeLoopSummary(points: RoutePointLike[], toleranceM = 1) {
  if (points.length < 3 || !points.every(hasCoordinates)) return { closed: false, direction: null };
  const first = points[0], last = points[points.length - 1];
  const separation = Math.hypot((first.latitude-last.latitude)*111320, (first.longitude-last.longitude)*111320*Math.cos(first.latitude*Math.PI/180));
  const next = points.find(p => Math.hypot(p.latitude-first.latitude,p.longitude-first.longitude) > .00005);
  const bearing = next ? (Math.atan2((next.longitude-first.longitude)*Math.cos(first.latitude*Math.PI/180),next.latitude-first.latitude)*180/Math.PI+360)%360 : null;
  return { closed: separation <= toleranceM, direction: bearing === null ? null : ["N","NE","E","SE","S","SW","W","NW"][Math.round(bearing/45)%8] };
}

export function routeSequence(points: RoutePointLike[]): string {
  return points.map((point) => point.title?.trim()).filter(Boolean).join(" → ");
}

export function routeDistanceKm(points: RoutePointLike[]): number | null {
  const coordinates = points.filter(hasCoordinates);
  if (coordinates.length < 2) return null;

  let distance = 0;
  const earthRadiusKm = 6371;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const latitudeDelta = (current.latitude - previous.latitude) * Math.PI / 180;
    const longitudeDelta = (current.longitude - previous.longitude) * Math.PI / 180;
    const latitudeA = previous.latitude * Math.PI / 180;
    const latitudeB = current.latitude * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
    distance += earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  return Number(distance.toFixed(1));
}

export function googleMapsRouteUrl(points: RoutePointLike[]): string | null {
  const coordinates = points.filter(hasCoordinates).map((point) => `${point.latitude},${point.longitude}`);
  // Mobile browsers support only three intermediate waypoints. Never silently
  // drop points from a longer instructor route.
  if (coordinates.length < 2 || coordinates.length > 5 || coordinates.length !== points.length) return null;

  const origin = coordinates[0];
  const destination = coordinates[coordinates.length - 1] ?? origin;
  const waypoints = coordinates.slice(1, -1).join("|");
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsNavigationUrl(points: RoutePointLike[]): string | null {
  const coordinates = points.filter(hasCoordinates).map((point) => `${point.latitude},${point.longitude}`);
  if (coordinates.length < 2 || coordinates.length > 5 || coordinates.length !== points.length) return null;

  const destination = coordinates[coordinates.length - 1];
  const waypoints = coordinates.slice(1, -1).join("|");
  const params = new URLSearchParams({ api: "1", origin: coordinates[0], destination, travelmode: "driving", dir_action: "navigate" });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export type GoogleMapsSection = {
  firstPoint: number;
  lastPoint: number;
  url: string;
  navigationUrl: string;
  startPoint: { latitude: number; longitude: number };
};

// Waze deep links take one destination, not the full ordered practice loop.
// No live location, account data or API key is included in this outbound URL.
export function wazeStartNavigationUrl(point?: RoutePointLike | null): string | null {
  if (!point || !hasCoordinates(point)) return null;
  const params = new URLSearchParams({ ll: `${point.latitude},${point.longitude}`, navigate: "yes", utm_source: "drivecoach" });
  return `https://waze.com/ul?${params.toString()}`;
}

// Waypoint-leg coverage, not distance travelled or recorded practice completion.
export function googleMapsSectionRange(section: GoogleMapsSection, sections: GoogleMapsSection[]) {
  const legs = Math.max(1, (sections.at(-1)?.lastPoint ?? 1) - 1);
  return { start: Math.round((section.firstPoint - 1) / legs * 100), end: Math.round((section.lastPoint - 1) / legs * 100) };
}

// Each section fits mobile's three intermediate waypoints. Consecutive
// sections share their boundary point, preserving every ordered route leg.
export function googleMapsRouteSections(points: RoutePointLike[]): GoogleMapsSection[] {
  if (points.length < 2 || !points.every(hasCoordinates)) return [];
  const sections: GoogleMapsSection[] = [];
  for (let start = 0; start < points.length - 1; start += 4) {
    const end = Math.min(start + 4, points.length - 1);
    const section = points.slice(start, end + 1);
    const url = googleMapsRouteUrl(section);
    const navigationUrl = googleMapsNavigationUrl(section);
    if (!url || !navigationUrl) return [];
    sections.push({ firstPoint: start + 1, lastPoint: end + 1, url, navigationUrl, startPoint: { latitude: section[0].latitude!, longitude: section[0].longitude! } });
  }
  return sections;
}
