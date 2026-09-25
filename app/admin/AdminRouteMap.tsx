"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import mapboxgl from "mapbox-gl";

type Point = { id: string; sequence: number; title: string; latitude: number; longitude: number };
type Route = { centre: { latitude: number | null; longitude: number | null } };

export default function AdminRouteMap({ route, points, onMove, onAdd }: { route: Route; points: Point[]; onMove: (id: string, latitude: number, longitude: number) => void; onAdd?: (latitude: number, longitude: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const first = points[0] ?? { longitude: route.centre.longitude ?? 4.3047, latitude: route.centre.latitude ?? 50.8382 };
    const map = new mapboxgl.Map({ container: containerRef.current, style: "mapbox://styles/mapbox/streets-v12", center: [first.longitude, first.latitude], zoom: 13.2, attributionControl: true });
    mapRef.current = map;
    map.on("click", (event) => onAdd?.(event.lngLat.lat, event.lngLat.lng));
    map.on("load", () => {
      if (points.length > 1) {
        map.addSource("admin-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map((point) => [point.longitude, point.latitude]) } } });
        map.addLayer({ id: "admin-route-line", type: "line", source: "admin-route", paint: { "line-color": "#17604b", "line-width": 5, "line-opacity": 0.85 } });
        const bounds = points.reduce((value, point) => value.extend([point.longitude, point.latitude] as [number, number]), new mapboxgl.LngLatBounds([first.longitude, first.latitude], [first.longitude, first.latitude]));
        map.fitBounds(bounds, { padding: 55, duration: 0 });
      }
    });
    markersRef.current = points.map((point) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "admin-map-marker";
      element.textContent = String(point.sequence).padStart(2, "0");
      element.title = `Drag ${point.title}`;
      return new mapboxgl.Marker({ element, draggable: true }).setLngLat([point.longitude, point.latitude]).on("dragend", (event) => {
        const coordinates = event.target.getLngLat();
        onMove(point.id, coordinates.lat, coordinates.lng);
      }).addTo(map);
    });
    return () => { markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
  }, [token, route, points, onMove, onAdd]);

  if (!token) return <FallbackMap route={route} points={points} onAdd={onAdd} />;
  return <div className="admin-map-shell"><div ref={containerRef} className="admin-map-container" /><div className="admin-map-help">Click to add a point · drag a marker to move it</div></div>;
}

function FallbackMap({ route, points, onAdd }: { route: Route; points: Point[]; onAdd?: (latitude: number, longitude: number) => void }) {
  const centreLatitude = route.centre.latitude ?? points[0]?.latitude ?? 50.8382;
  const centreLongitude = route.centre.longitude ?? points[0]?.longitude ?? 4.3047;
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onAdd) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    onAdd(centreLatitude + (0.5 - y) * 0.04, centreLongitude + (x - 0.5) * 0.06);
  }
  return <div className="admin-map-fallback admin-map-fallback-clickable" onClick={handleClick} role="button" tabIndex={0} aria-label="Click to add a route point"><div className="admin-map-fallback-grid" /><div><span className="small-label">MAPBOX TOKEN REQUIRED</span><strong>Coordinate editor is ready</strong><p>Click this map area to add coordinates. Add `NEXT_PUBLIC_MAPBOX_TOKEN` for real tiles and draggable markers.</p></div></div>;
}
