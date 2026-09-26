"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFullRouteBySlug, routeToCentre } from "../../lib/api";
import type { Centre } from "../../lib/data";
import MapboxRouteMap from "./MapboxRouteMap";
import PracticeControls from "./PracticeControls";
import RouteCoach from "./RouteCoach";
import DriveCoachVoice from "./DriveCoachVoice";

type Props = { centre: Centre; routeId?: string; routeSlug: string };

export default function RouteExperience({ centre, routeId, routeSlug }: Props) {
  const [activeCentre, setActiveCentre] = useState(centre);
  const [accessMode, setAccessMode] = useState<"preview" | "full">("preview");
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  return <div className="route-detail-layout">
    <div className="route-detail-map">{hasMapboxToken ? <MapboxRouteMap centre={activeCentre} selectedIndex={selectedIndex} onSelect={setSelectedIndex} /> : <div className="route-map route-map-tall"><div className="map-grid" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" /><div className="map-route" /><div className={`map-point point-a ${selectedIndex === 0 ? "active-marker" : ""}`}><span>A</span></div><div className={`map-point point-b ${selectedIndex === 1 ? "active-marker" : ""}`}><span>!</span></div><div className={`map-point point-c ${selectedIndex === 2 ? "active-marker" : ""}`}><span>↗</span></div><div className="map-legend"><i className="legend-route" /> Test route <i className="legend-alert" /> Attention point</div><div className="map-control">+</div><div className="map-control map-control-minus">−</div>{selectedPoint && <div className="route-map-callout"><span className={`point-dot ${selectedPoint.tone}-dot`} /><div><span className="small-label">SELECTED POINT {selectedPoint.number}</span><strong>{selectedPoint.title}</strong><p>{selectedPoint.detail}</p></div></div>}</div>}</div>
    <aside className="route-detail-sidebar"><RouteCoach routeId={routeId} />{accessMode === "full" && <DriveCoachVoice routePoints={activeCentre.routePoints} />}<PracticeControls routeId={routeId} routeSlug={activeCentre.slug} /><div className="sidebar-heading"><div><span className="small-label">{accessMode === "full" ? "FULL ROUTE" : "PREVIEW POINTS"}</span><h2>What to watch</h2></div><span className="point-counter">{activeCentre.routePoints.length} shown</span></div><div className="detail-point-list">{activeCentre.routePoints.map((point, index) => <button className={`detail-point ${index === selectedIndex ? "selected-point" : ""}`} key={point.number} onClick={() => setSelectedIndex(index)} aria-pressed={index === selectedIndex}><span className={`point-dot ${point.tone}-dot`} /><div><span className="detail-point-number">{point.number}</span><strong>{point.title}</strong><p>{point.detail}</p></div><span className="point-chevron">›</span></button>)}</div>{accessMode === "preview" ? <div className="unlock-card"><span className="unlock-icon">✦</span><h3>Unlock the full route</h3><p>See every point, image, warning and preparation note for this centre.</p><Link className="button button-full" href="/#pricing">Choose access <span>↗</span></Link></div> : <div className="route-unlocked-card"><span>✓</span><p><strong>Full route unlocked</strong><small>Your premium access includes all verified points and preparation details.</small></p></div>}</aside>
  </div>;
}
