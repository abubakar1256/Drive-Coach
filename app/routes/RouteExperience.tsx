"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFullRouteBySlug, routeToCentre, type ApiRoute } from "../../lib/api";
import type { Centre } from "../../lib/data";
import MapboxRouteMap from "./MapboxRouteMap";
import PracticeControls from "./PracticeControls";
import RouteCoach from "./RouteCoach";
import RoutePointMedia from "./RoutePointMedia";
import RouteTrialAccess from "./RouteTrialAccess";
import DriveCoachVoice from "./DriveCoachVoice";
import { useSiteCopy, useCurrentLocale } from "../../lib/useLocale";
import { googleMapsRouteSections, routeSequence } from "../../lib/route-utils";
import GoogleMapsLinks from "./GoogleMapsLinks";
import type { RouteStep } from "../../lib/route-progression";
import { localizeText } from "../../lib/localizeContent";

type Props = { centre: Centre; routeId?: string; routeSlug: string; initialDriving?: ApiRoute["driving"]; routeLabel: string; nextRoute: RouteStep | null };

export default function RouteExperience({ centre, routeId, routeSlug, initialDriving, routeLabel, nextRoute }: Props) {
  const [hasVoiceAccess, setHasVoiceAccess] = useState(false);
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
    let generation = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    setActiveCentre(centre);
    setDriving(initialDriving);
    setAccessMode("preview");
    setHasVoiceAccess(false);
    setSelectedIndex(0);
    const sync = () => {
      clearTimeout(expiryTimer);
      const request = ++generation;
      // A changed login must never keep the previous user's paid route visible.
      setActiveCentre(centre); setDriving(initialDriving); setAccessMode("preview"); setHasVoiceAccess(false); setSelectedIndex(0); resetPracticeTrack();
      if (!sessionStorage.getItem("routepilot.accessToken")) {
        setActiveCentre(centre); setDriving(initialDriving); setAccessMode("preview"); setHasVoiceAccess(false);
        return;
      }
      void getFullRouteBySlug(routeSlug).then((route) => {
      if (cancelled || request !== generation) return;
      if (!route || route.slug !== routeSlug || route.centre.slug !== centre.slug) { setActiveCentre(centre); setDriving(initialDriving); setAccessMode("preview"); setHasVoiceAccess(false); return; }
      if (route.access?.expiresAt && Date.parse(route.access.expiresAt) <= Date.now()) return;
      setActiveCentre(routeToCentre(route, centre));
      setDriving(route.driving);
      setAccessMode("full");
      setHasVoiceAccess(Boolean(route.access?.premium));
      if (route.access?.expiresAt) expiryTimer = setTimeout(sync, Math.min(2147483647, Date.parse(route.access.expiresAt) - Date.now() + 20));
      });
    };
    sync();
    window.addEventListener("routepilot-auth-change", sync);
    return () => { cancelled = true; generation++; clearTimeout(expiryTimer); window.removeEventListener("routepilot-auth-change", sync); };
  }, [centre, routeSlug, initialDriving]);

  const googleMapsSections = accessMode === "full" && driving?.valid ? googleMapsRouteSections(activeCentre.routePoints) : [];
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

  return <div className="route-workspace"><div className="route-access-summary"><p className="route-meta">{nl ? "Bereid je voor. Rijd bewust. Reflecteer." : "Prepare with purpose. Drive with confidence."}</p><span className="route-access-pill">{accessMode === "full" ? `${routeLabel} · ${nl ? "Ontgrendeld" : "Unlocked"}` : copy.route.preview}</span></div>
    <div className="route-overview-metrics"><div><span>{nl ? "GESCHATTE RIJTIJD" : "ESTIMATED DRIVE"}</span><strong>{driving?.valid ? Math.ceil(driving.durationSec! / 60) : "—"}<small> min</small></strong></div><div><span>{nl ? "AFSTAND OVER DE WEG" : "ROAD DISTANCE"}</span><strong>{driving?.valid ? (driving.distanceM! / 1000).toFixed(1) : "—"}<small> km</small></strong></div><div><span>{accessMode === "full" ? (nl ? "ROUTEPUNTEN" : "ROUTE POINTS") : (nl ? "PREVIEWPUNTEN" : "PREVIEW POINTS")}</span><strong>{activeCentre.routePoints.length}<small> {nl ? "punten" : "points"}</small></strong></div><div><span>{nl ? "PRAKTIJKMODUS" : "PRACTICE MODE"}</span><strong className="route-mode-text">{tracking ? (nl ? "Live GPS" : "Live GPS") : (nl ? "Voorbereiden" : "Preparation")}</strong><small>{nl ? "Veilig geparkeerd instellen" : "Set up while safely parked"}</small></div></div>
    <details className="route-sequence-panel"><summary><span><span className="small-label">{copy.route.sequence}</span><strong>{nl ? "Bekijk de routevolgorde" : "Explore the route sequence"}</strong></span><span aria-hidden="true">＋</span></summary><p>{localizeText(routeSequence(activeCentre.routePoints), nl ? "nl" : "en") || copy.route.unlockText}</p></details>
    <div className="route-detail-layout" data-chat-route={routeSlug} data-chat-point={selectedPoint?.id}>
    <div className="route-detail-map"><div className="route-map-topbar"><div><span className="route-map-dot" /><strong>{routeLabel}</strong><span>{nl ? "Interactieve routekaart" : "Interactive route map"}</span></div><a href="#practice-controls">{nl ? "Oefenrit instellen" : "Set up practice"} ↗</a></div>{hasMapboxToken ? <MapboxRouteMap key={routeSlug} centre={activeCentre} selectedIndex={selectedIndex} onSelect={setSelectedIndex} livePosition={livePosition} liveTrack={liveTrack} tracking={tracking} /> : <div className="route-map route-map-tall"><p role="status">{nl ? "Kaart niet beschikbaar. Geen rijroute weergegeven zonder kaartconfiguratie." : "Map unavailable. No driving route is displayed without map configuration."}</p></div>}<div className="route-map-inspector"><span className="route-inspector-index">{String(selectedIndex + 1).padStart(2, "0")}</span><div><span className="small-label">{nl ? "GESELECTEERD ROUTEPUNT" : "SELECTED ROUTE POINT"}</span><strong>{selectedPoint?.title ?? (nl ? "Routeoverzicht" : "Route overview")}</strong></div><span>{activeCentre.routePoints.length ? selectedIndex + 1 : 0} / {activeCentre.routePoints.length}</span></div><p className="route-map-safety">{nl ? "Volg de verkeersborden en de weg voor je. Dit is een oefenroute, geen officiële examenroute." : "Follow current signs and the road ahead. This is a practice route, not an official exam route."}</p></div>
    <aside className="route-detail-sidebar"><RouteTrialAccess routeId={routeId} routeSlug={routeSlug} /><div className="unlock-card" role="status"><strong>{driving?.valid ? (nl ? "Rijroute gecontroleerd" : "Driving route checked") : (nl ? "Routecontrole vereist" : "Route check required")}</strong><p>{driving?.valid ? `${Math.ceil(driving.durationSec! / 60)} min · ${(driving.distanceM! / 1000).toFixed(1)} km` : (nl ? "Doel: 25 ±2 minuten rijtijd. Deze route is nog niet vrijgegeven voor navigatie." : "Target: 25 ±2 minutes driving time. This route has not yet been cleared for navigation.")}</p>{driving && !driving.valid && <small>{driving.issues.join(", ")}</small>}<div id="google-maps"><GoogleMapsLinks key={routeSlug} routeLabel={routeLabel} sections={googleMapsSections} />{!googleMapsSections.length && <div className="google-maps-links">{accessMode === "preview" ? <Link className="google-maps-button" href={`/auth/login?next=${encodeURIComponent(`/routes/${routeSlug}#google-maps`)}`}>{nl ? "Openen in Google Maps · Inloggen" : "Open in Google Maps · Sign in"} ↗</Link> : <button className="google-maps-button" disabled>{nl ? "Openen in Google Maps" : "Open in Google Maps"} ↗</button>}<p>{accessMode === "preview" ? (nl ? "Log in met routetoegang om Google Maps te openen." : "Sign in with route access to open Google Maps.") : (nl ? "Google Maps is beschikbaar na een geslaagde routecontrole en met volledige coördinaten." : "Google Maps is available after a passing route check with complete coordinates.")}</p></div>}</div>{driving?.valid && <p>{nl ? "Google Maps berekent zelf opnieuw; tijd en wegkeuze kunnen afwijken. Gebruik de volledige routekaart als referentie." : "Google Maps recalculates independently; time and roads may differ. Use the full route map as your reference."}</p>}</div>{selectedPoint && <RoutePointMedia point={selectedPoint} />}<RouteCoach key={`${routeSlug}-${accessMode}-${hasVoiceAccess}`} routeId={routeId} />{hasVoiceAccess && driving?.valid && <DriveCoachVoice routePoints={activeCentre.routePoints} />}<PracticeControls key={`${routeSlug}-${accessMode}-${hasVoiceAccess}`} routeLabel={routeLabel} nextRoute={nextRoute} centreSlug={centre.slug} paidCentreAccess={hasVoiceAccess} routeId={routeId} routeSlug={routeSlug} practiceReady={accessMode === "full" && Boolean(driving?.valid)} googleMapsSections={googleMapsSections} onPositionUpdate={handlePositionUpdate} onTrackingChange={setTracking} onPracticeStart={resetPracticeTrack} /><div className="sidebar-heading"><div><span className="small-label">{accessMode === "full" ? copy.route.fullRoute : copy.route.previewPoints}</span><h2>{copy.route.whatWatch}</h2></div><span className="point-counter">{activeCentre.routePoints.length} {copy.route.shown}</span></div><div className="detail-point-list">{activeCentre.routePoints.map((point, index) => <button className={`detail-point ${index === selectedIndex ? "selected-point" : ""}`} key={point.number} onClick={() => setSelectedIndex(index)} aria-pressed={index === selectedIndex}><span className={`point-dot ${point.tone}-dot`} /><div><span className="detail-point-number">{point.number}</span><strong>{point.title}</strong><p>{point.detail}</p></div><span className="point-chevron">›</span></button>)}</div>{accessMode === "preview" ? <div className="unlock-card"><span className="unlock-icon">✦</span><h3>{copy.route.unlockTitle}</h3><p>{copy.route.unlockText}</p><Link className="button button-full" href="/#pricing">{copy.route.chooseAccess} <span>↗</span></Link></div> : <div className="route-unlocked-card"><span>✓</span><p><strong>{routeLabel} · {nl ? "Ontgrendeld" : "Unlocked"}</strong><small>{hasVoiceAccess ? copy.route.unlockedText : (nl ? `Je proefperiode van 24 uur geldt alleen voor ${routeLabel}. Andere routes vereisen Basic of Premium.` : `Your 24-hour trial applies only to ${routeLabel}. Other routes require Basic or Premium.`)}</small></p></div>}</aside>
  </div></div>;
}
