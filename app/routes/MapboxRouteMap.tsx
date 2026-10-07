"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Centre } from "../../lib/data";
import { useCurrentLocale } from "../../lib/useLocale";

type Coordinate = [number, number];
type Props = {
  centre: Centre;
  selectedIndex: number;
  onSelect: (index: number) => void;
  livePosition: Coordinate | null;
  liveTrack: Coordinate[];
  tracking: boolean;
};

export default function MapboxRouteMap({ centre, selectedIndex, onSelect, livePosition, liveTrack, tracking }: Props) {
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const liveMarkerRef = useRef<mapboxgl.Marker | null>(null);

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
      map.addSource("practice-track", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "practice-track-line", type: "line", source: "practice-track", paint: { "line-color": "#ef8069", "line-width": 5, "line-opacity": 0.95, "line-dasharray": [1, 1.2] } });
      const bounds = coordinates.reduce((bounds, coordinate) => bounds.extend(coordinate as [number, number]), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: 70, duration: 0 });
    });

    markersRef.current = coordinates.slice(0, centre.routePoints.length).map((coordinate, index) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = `mapbox-point-marker ${index === selectedIndex ? "is-active" : ""}`;
      markerElement.setAttribute("aria-label", nl ? `Selecteer routepunt ${index + 1}` : `Select route point ${index + 1}`);
      markerElement.addEventListener("click", () => onSelect(index));
      return new mapboxgl.Marker({ element: markerElement }).setLngLat(coordinate).addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [centre, onSelect, nl]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => marker.getElement().classList.toggle("is-active", index === selectedIndex));
  }, [selectedIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("practice-track") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: liveTrack.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: liveTrack } }] : [],
    });
  }, [liveTrack]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !livePosition) return;
    if (!liveMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className = "mapbox-live-marker";
      markerElement.setAttribute("aria-label", nl ? "Je live oefenpositie" : "Your live practice position");
      liveMarkerRef.current = new mapboxgl.Marker({ element: markerElement }).setLngLat(livePosition).addTo(map);
    } else {
      liveMarkerRef.current.setLngLat(livePosition);
    }
    liveMarkerRef.current.getElement().classList.toggle("is-tracking", tracking);
  }, [livePosition, tracking, nl]);

  return <div className="mapbox-shell"><div ref={containerRef} className="mapbox-container" /><div className="mapbox-helper"><span><i className={tracking ? "is-live" : ""} /> {tracking ? (nl ? "Live oefen-GPS" : "Live practice GPS") : (nl ? "Live kaartlaag" : "Live map layer")}</span><small>{tracking ? (nl ? "Je positie en spoor verschijnen hier" : "Your position and track appear here") : (nl ? "Klik op een punt voor details" : "Click a marker to inspect a point")}</small></div></div>;
}
