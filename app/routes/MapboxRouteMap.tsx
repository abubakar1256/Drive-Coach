"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Centre } from "../../lib/data";

type Props = { centre: Centre; selectedIndex: number; onSelect: (index: number) => void };

export default function MapboxRouteMap({ centre, selectedIndex, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const coordinates = centre.routeCoordinates;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: coordinates[0],
      zoom: 13.4,
      attributionControl: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("practice-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } } });
      map.addLayer({ id: "practice-route-line", type: "line", source: "practice-route", paint: { "line-color": "#1e5c4a", "line-width": 5, "line-opacity": 0.9 } });
      const bounds = coordinates.reduce((bounds, coordinate) => bounds.extend(coordinate as [number, number]), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: 70, duration: 0 });
    });

    markersRef.current = coordinates.slice(0, centre.routePoints.length).map((coordinate, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = `mapbox-point-marker ${index === selectedIndex ? "is-active" : ""}`;
      markerElement.setAttribute("aria-label", `Select route point ${index + 1}`);
      markerElement.addEventListener("click", () => onSelect(index));
      return new mapboxgl.Marker({ element: markerElement }).setLngLat(coordinate).addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [centre, onSelect]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => marker.getElement().classList.toggle("is-active", index === selectedIndex));
  }, [selectedIndex]);

  return <div className="mapbox-shell"><div ref={containerRef} className="mapbox-container" /><div className="mapbox-helper"><span><i /> Live map layer</span><small>Click a marker to inspect a point</small></div></div>;
}
