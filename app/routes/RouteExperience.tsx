"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFullRouteBySlug, routeToCentre } from "../../lib/api";
import type { Centre } from "../../lib/data";
import MapboxRouteMap from "./MapboxRouteMap";
import PracticeControls from "./PracticeControls";
import RouteCoach from "./RouteCoach";
import DriveCoachVoice from "./DriveCoachVoice";
import { useSiteCopy } from "../../lib/useLocale";

type Props = { centre: Centre; routeId?: string; routeSlug: string };

export default function RouteExperience({ centre, routeId, routeSlug }: Props) {
  const [activeCentre, setActiveCentre] = useState(centre);
  const [accessMode, setAccessMode] = useState<"preview" | "full">("preview");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [livePosition, setLivePosition] = useState<[number, number] | null>(null);
  const [liveTrack, setLiveTrack] = useState<[number, number][]>([]);
  const [tracking, setTracking] = useState(false);
  const copy = useSiteCopy();

  useEffect(() => {
    let cancelled = false;
    setActiveCentre(centre);
    setAccessMode("preview");
    setSelectedIndex(0);
    const accessToken = sessionStorage.getItem("routepilot.accessToken");
    if (!accessToken) return () => { cancelled = true; };

    void getFullRouteBySlug(routeSlug, accessToken).then((route) => {
      if (cancelled || !route) return;
      setActiveCentre(routeToCentre(route, centre));
      setAccessMode("full");
    });
    return () => { cancelled = true; };
  }, [centre, routeSlug]);

  const selectedPoint = activeCentre.routePoints[Math.min(selectedIndex, Math.max(activeCentre.routePoints.length - 1, 0))] ?? activeCentre.routePoints[0];
  const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  function handlePositionUpdate(position: GeolocationPosition) {
    const coordinate: [number, number] = [position.coords.longitude, position.coords.latitude];
    setLivePosition(coordinate);
    setLiveTrack((current) => current.length > 0 && current[current.length - 1][0] === coordinate[0] && current[current.length - 1][1] === coordinate[1] ? current : [...current, coordinate]);
  }
  function resetPracticeTrack() {
    setLivePosition(null);
    setLiveTrack([]);
    setTracking(false);
  }

  return <div className="route-detail-layout">
    <div className="route-detail-map">{hasMapboxToken ? <MapboxRouteMap centre={activeCentre} selectedIndex={selectedIndex} onSelect={setSelectedIndex} livePosition={livePosition} liveTrack={liveTrack} tracking={tracking} /> : <div className="route-map route-map-tall"><div className="map-grid" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" /><div className="map-route" /><div className={`map-point point-a ${selectedIndex === 0 ? "active-marker" : ""}`}><span>A</span></div><div className={`map-point point-b ${selectedIndex === 1 ? "active-marker" : ""}`}><span>!</span></div><div className={`map-point point-c ${selectedIndex === 2 ? "active-marker" : ""}`}><span>↗</span></div><div className="map-legend"><i className="legend-route" /> {copy.route.practiceRouteLegend} <i className="legend-alert" /> {copy.route.attentionPoints}</div><div className="map-control">+</div><div className="map-control map-control-minus">−</div>{selectedPoint && <div className="route-map-callout"><span className={`point-dot ${selectedPoint.tone}-dot`} /><div><span className="small-label">{copy.route.selectedPoint} {selectedPoint.number}</span><strong>{selectedPoint.title}</strong><p>{selectedPoint.detail}</p></div></div>}</div>}</div>
    <aside className="route-detail-sidebar"><RouteCoach routeId={routeId} />{accessMode === "full" && <DriveCoachVoice routePoints={activeCentre.routePoints} />}<PracticeControls routeId={routeId} routeSlug={routeSlug} onPositionUpdate={handlePositionUpdate} onTrackingChange={setTracking} onPracticeStart={resetPracticeTrack} /><div className="sidebar-heading"><div><span className="small-label">{accessMode === "full" ? copy.route.fullRoute : copy.route.previewPoints}</span><h2>{copy.route.whatWatch}</h2></div><span className="point-counter">{activeCentre.routePoints.length} {copy.route.shown}</span></div><div className="detail-point-list">{activeCentre.routePoints.map((point, index) => <button className={`detail-point ${index === selectedIndex ? "selected-point" : ""}`} key={point.number} onClick={() => setSelectedIndex(index)} aria-pressed={index === selectedIndex}><span className={`point-dot ${point.tone}-dot`} /><div><span className="detail-point-number">{point.number}</span><strong>{point.title}</strong><p>{point.detail}</p></div><span className="point-chevron">›</span></button>)}</div>{accessMode === "preview" ? <div className="unlock-card"><span className="unlock-icon">✦</span><h3>{copy.route.unlockTitle}</h3><p>{copy.route.unlockText}</p><Link className="button button-full" href="/#pricing">{copy.route.chooseAccess} <span>↗</span></Link></div> : <div className="route-unlocked-card"><span>✓</span><p><strong>{copy.route.unlocked}</strong><small>{copy.route.unlockedText}</small></p></div>}</aside>
  </div>;
}
