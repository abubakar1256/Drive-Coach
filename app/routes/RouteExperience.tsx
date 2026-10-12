"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFullRouteBySlug, routeToCentre, type ApiRoute } from "../../lib/api";
import type { Centre } from "../../lib/data";
import MapboxRouteMap from "./MapboxRouteMap";
import PracticeControls from "./PracticeControls";
import RouteCoach from "./RouteCoach";
import DriveCoachVoice from "./DriveCoachVoice";
import { useSiteCopy, useCurrentLocale } from "../../lib/useLocale";
import { googleMapsNavigationUrl as navigationUrl, googleMapsRouteUrl } from "../../lib/route-utils";

type Props = { centre: Centre; routeId?: string; routeSlug: string; initialDriving?: ApiRoute["driving"] };

export default function RouteExperience({ centre, routeId, routeSlug, initialDriving }: Props) {
  const [driving, setDriving] = useState(initialDriving);
  const nl = useCurrentLocale() === "nl";
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
    setDriving(initialDriving);
    setAccessMode("preview");
    setSelectedIndex(0);
    const accessToken = sessionStorage.getItem("routepilot.accessToken");
    if (!accessToken) return () => { cancelled = true; };

    void getFullRouteBySlug(routeSlug, accessToken).then((route) => {
      if (cancelled || !route) return;
      setActiveCentre(routeToCentre(route, centre));
      setDriving(route.driving);
      setAccessMode("full");
    });
    return () => { cancelled = true; };
  }, [centre, routeSlug, initialDriving]);

  const googleMapsNavigationUrl = accessMode === "full" && driving?.valid ? navigationUrl(activeCentre.routePoints) : null;
  const mapsUrl = accessMode === "full" && driving?.valid ? googleMapsRouteUrl(activeCentre.routePoints) : null;
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

  return <div className="route-detail-layout" data-chat-route={routeSlug} data-chat-point={selectedPoint?.id}>
    <div className="route-detail-map">{hasMapboxToken ? <MapboxRouteMap centre={activeCentre} selectedIndex={selectedIndex} onSelect={setSelectedIndex} livePosition={livePosition} liveTrack={liveTrack} tracking={tracking} /> : <div className="route-map route-map-tall"><p role="status">{nl ? "Kaart niet beschikbaar. Geen rijroute weergegeven zonder kaartconfiguratie." : "Map unavailable. No driving route is displayed without map configuration."}</p></div>}</div>
    <aside className="route-detail-sidebar"><div className="unlock-card" role="status"><strong>{driving?.valid ? (nl ? "Rijroute gecontroleerd" : "Driving route checked") : (nl ? "Routecontrole vereist" : "Route check required")}</strong><p>{driving?.valid ? `${Math.ceil(driving.durationSec! / 60)} min · ${(driving.distanceM! / 1000).toFixed(1)} km` : (nl ? "Minimaal 24 minuten rijtijd. Deze route is nog niet vrijgegeven voor navigatie." : "At least 24 minutes driving time. This route has not yet been cleared for navigation.")}</p>{driving && !driving.valid && <small>{driving.issues.join(", ")}</small>}{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">{nl ? "Openen in Google Maps" : "Open in Google Maps"} ↗</a>}{driving?.valid && <p>{nl ? "Google Maps berekent zelf opnieuw; tijd en wegkeuze kunnen afwijken. Gebruik de volledige routekaart als referentie." : "Google Maps recalculates independently; time and roads may differ. Use the full route map as your reference."}</p>}</div><RouteCoach routeId={routeId} />{accessMode === "full" && driving?.valid && <DriveCoachVoice routePoints={activeCentre.routePoints} />}<PracticeControls routeId={routeId} routeSlug={routeSlug} practiceReady={Boolean(driving?.valid)} googleMapsNavigationUrl={googleMapsNavigationUrl} onPositionUpdate={handlePositionUpdate} onTrackingChange={setTracking} onPracticeStart={resetPracticeTrack} /><div className="sidebar-heading"><div><span className="small-label">{accessMode === "full" ? copy.route.fullRoute : copy.route.previewPoints}</span><h2>{copy.route.whatWatch}</h2></div><span className="point-counter">{activeCentre.routePoints.length} {copy.route.shown}</span></div><div className="detail-point-list">{activeCentre.routePoints.map((point, index) => <button className={`detail-point ${index === selectedIndex ? "selected-point" : ""}`} key={point.number} onClick={() => setSelectedIndex(index)} aria-pressed={index === selectedIndex}><span className={`point-dot ${point.tone}-dot`} /><div><span className="detail-point-number">{point.number}</span><strong>{point.title}</strong><p>{point.detail}</p></div><span className="point-chevron">›</span></button>)}</div>{accessMode === "preview" ? <div className="unlock-card"><span className="unlock-icon">✦</span><h3>{copy.route.unlockTitle}</h3><p>{copy.route.unlockText}</p><Link className="button button-full" href="/#pricing">{copy.route.chooseAccess} <span>↗</span></Link></div> : <div className="route-unlocked-card"><span>✓</span><p><strong>{copy.route.unlocked}</strong><small>{copy.route.unlockedText}</small></p></div>}</aside>
  </div>;
}
