type RoutePointLike = {
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function hasCoordinates(point: RoutePointLike): point is RoutePointLike & { latitude: number; longitude: number } {
  return typeof point.latitude === "number" && Number.isFinite(point.latitude)
    && typeof point.longitude === "number" && Number.isFinite(point.longitude);
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
  if (!coordinates.length) return null;

  const origin = coordinates[0];
  const destination = coordinates[coordinates.length - 1] ?? origin;
  const waypoints = coordinates.slice(1, -1).join("|");
  const params = new URLSearchParams({ api: "1", origin, destination });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsNavigationUrl(points: RoutePointLike[]): string | null {
  const coordinates = points.filter(hasCoordinates).map((point) => `${point.latitude},${point.longitude}`);
  if (!coordinates.length) return null;

  const destination = coordinates[coordinates.length - 1];
  const waypoints = coordinates.slice(0, -1).join("|");
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving", dir_action: "navigate" });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
