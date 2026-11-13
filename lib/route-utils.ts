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
  return Number(routeDistances(coordinates).at(-1)!.toFixed(1));
}

function routeDistances(coordinates: { latitude: number; longitude: number }[]) {
  const distances = [0];
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
    distance += earthRadiusKm * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
    distances.push(distance);
  }

  return distances;
}

export function googleMapsNavigationUrl(points: RoutePointLike[]): string | null {
  if (points.length < 2 || !points.every(hasCoordinates)) return null;
  const route = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || point.latitude !== previous.latitude || point.longitude !== previous.longitude;
  });
  if (route.length < 2) return null;

  const coordinates = route.map(({ latitude, longitude }) => `${latitude},${longitude}`);
  const last = coordinates.length - 1;
  const distances = routeDistances(route);
  const totalKm = distances[last];
  // Mobile browser directions links support three intermediate waypoints.
  // Spread them across the drive and preserve the actual start and finish.
  const waypointCount = Math.min(3, last - 1);
  const waypoints: string[] = [];
  let previousIndex = 0;
  for (let slot = 1; slot <= waypointCount; slot++) {
    const targetKm = totalKm * slot / (waypointCount + 1);
    const lastCandidate = last - 1 - (waypointCount - slot);
    let closest = previousIndex + 1;
    for (let candidate = closest + 1; candidate <= lastCandidate; candidate++) {
      if (Math.abs(distances[candidate] - targetKm) < Math.abs(distances[closest] - targetKm)) closest = candidate;
    }
    waypoints.push(coordinates[closest]);
    previousIndex = closest;
  }
  const params = new URLSearchParams({
    api: "1", origin: coordinates[0], destination: coordinates[last], travelmode: "driving", dir_action: "navigate",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Waze deep links take one destination.
// No live location, account data or API key is included in this outbound URL.
export function wazeStartNavigationUrl(point?: RoutePointLike | null): string | null {
  if (!point || !hasCoordinates(point)) return null;
  const params = new URLSearchParams({ ll: `${point.latitude},${point.longitude}`, navigate: "yes", utm_source: "drivecoach" });
  return `https://www.waze.com/ul?${params.toString()}`;
}

export function routeNavigationLinks(points: RoutePointLike[]) {
  const googleUrl = googleMapsNavigationUrl(points);
  return googleUrl ? { googleUrl, wazeUrl: wazeStartNavigationUrl(points[0]) } : null;
}
