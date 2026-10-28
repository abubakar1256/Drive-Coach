"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Centre } from "../../lib/data";
import { useCurrentLocale } from "../../lib/useLocale";
import { routeLoopSummary } from "../../lib/route-utils";

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
  const markersRef = useRef<Array<mapboxgl.Marker | null>>([]);
  const liveMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const roadLoop = routeLoopSummary(centre.roadGeometry?.map(([longitude, latitude]) => ({longitude, latitude})) ?? [], 25);
  const loop = { closed: routeLoopSummary(centre.routePoints).closed && roadLoop.closed, direction: roadLoop.direction };

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current || !centre.routeCoordinates.length) return;

    setMapReady(false);
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
      // Attention-point anchors are not road geometry; show markers only until
      // the server has obtained an actual driving route.
      map.addSource("practice-route", { type: "geojson", data: { type: "FeatureCollection", features: (centre.roadGeometry?.length ?? 0) > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: centre.roadGeometry! } }] : [] } });
      map.addLayer({ id: "practice-route-line", type: "line", source: "practice-route", paint: { "line-color": "#1e5c4a", "line-width": 5, "line-opacity": 0.9 } });
      map.addLayer({ id: "practice-route-direction", type: "symbol", source: "practice-route", layout: { "symbol-placement": "line", "symbol-spacing": 100, "text-field": "▶", "text-size": 15, "text-keep-upright": false, "text-rotation-alignment": "map" }, paint: { "text-color": "#ffffff", "text-halo-color": "#1e5c4a", "text-halo-width": 1 } });
      map.addSource("practice-track", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "practice-track-line", type: "line", source: "practice-track", paint: { "line-color": "#ef8069", "line-width": 5, "line-opacity": 0.95, "line-dasharray": [1, 1.2] } });
      const bounds = (centre.roadGeometry?.length ? centre.roadGeometry : coordinates).reduce((bounds, coordinate) => bounds.extend(coordinate as [number, number]), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: 70, duration: 0 });
      setMapReady(true);
    });

    markersRef.current = coordinates.slice(0, centre.routePoints.length).map((coordinate, index) => {
      const closed = loop.closed;
      const finish = index === centre.routePoints.length - 1;
      if (closed && finish) return null;
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      const endpoint = index === 0 || finish;
      markerElement.className = `mapbox-point-marker ${endpoint ? "mapbox-endpoint-marker" : ""} ${index === selectedIndex ? "is-active" : ""}`;
      const label = index === 0 ? (closed ? "START / FINISH" : "START") : finish ? "FINISH" : String(index + 1);
      const number = document.createElement("span"); number.textContent = label; markerElement.appendChild(number);
      markerElement.hidden = !endpoint && index !== selectedIndex;
      markerElement.setAttribute("aria-label", endpoint ? label : nl ? `Selecteer vormpunt ${index + 1}` : `Select shaping point ${index + 1}`);
      markerElement.addEventListener("click", () => onSelect(index));
      return new mapboxgl.Marker({ element: markerElement }).setLngLat(coordinate).addTo(map);
    });

    return () => {
      setMapReady(false);
      markersRef.current.forEach((marker) => marker?.remove());
      liveMarkerRef.current?.remove();
      liveMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [centre, onSelect, nl]);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      if (!marker) return;
      marker.getElement().classList.toggle("is-active", index === selectedIndex || (loop.closed && index === 0 && selectedIndex === centre.routePoints.length-1));
      marker.getElement().hidden = !showPoints && index !== selectedIndex && index !== 0 && index !== centre.routePoints.length-1;
    });
  }, [selectedIndex, showPoints, mapReady, loop.closed, centre.routePoints.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("practice-track") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: liveTrack.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: liveTrack } }] : [],
    });
  }, [liveTrack, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !livePosition) return;
    if (!liveMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className = "mapbox-live-marker";
      markerElement.setAttribute("aria-label", nl ? "Je live oefenpositie" : "Your live practice position");
      liveMarkerRef.current = new mapboxgl.Marker({ element: markerElement }).setLngLat(livePosition).addTo(map);
    } else {
      liveMarkerRef.current.setLngLat(livePosition);
    }
    liveMarkerRef.current.getElement().classList.toggle("is-tracking", tracking);
    if (tracking) map.easeTo({ center: livePosition, duration: 650, essential: true });
  }, [livePosition, tracking, nl, mapReady]);

  return <div className="mapbox-shell"><div ref={containerRef} className="mapbox-container" /><div className="mapbox-loop-key"><strong>{loop.closed ? (nl ? "Eén ronde · start = einde" : "One loop · start = finish") : (nl ? "Geen gesloten ronde bevestigd" : "Closed loop not confirmed")}</strong><small>{loop.direction ? `${nl ? "Vertrek richting" : "Initial direction"}: ${loop.direction} · ` : ""}{nl ? "Volg de pijlen; niet stoppen bij elk punt." : "Follow the arrows; points are not stops."}</small><button type="button" aria-pressed={showPoints} onClick={() => setShowPoints(v => !v)}>{showPoints ? (nl ? "Vormpunten verbergen" : "Hide shaping points") : (nl ? "Vormpunten tonen" : "Show shaping points")}</button></div><div className="mapbox-helper"><span><i className={tracking ? "is-live" : ""} /> {tracking ? (nl ? "Live oefen-GPS" : "Live practice GPS") : (nl ? "Volledige route" : "Full route")}</span><small>{tracking ? (nl ? "Je positie en spoor verschijnen hier" : "Your position and track appear here") : (nl ? "Eén doorlopende oefenrit" : "One continuous practice drive")}</small></div></div>;
}
