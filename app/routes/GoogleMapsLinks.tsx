"use client";
import { useState } from "react";
import { googleMapsSectionRange, wazeStartNavigationUrl, type GoogleMapsSection } from "../../lib/route-utils";
import { useCurrentLocale } from "../../lib/useLocale";

export default function GoogleMapsLinks({ sections, navigation = false, routeLabel }: { sections: GoogleMapsSection[]; navigation?: boolean; routeLabel?: string }) {
  const nl = useCurrentLocale() === "nl";
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(sections.length - 1, 0));
  const section = sections[index];
  if (!section) return null;
  const range = googleMapsSectionRange(section, sections);
  // Always the full route's start, never the currently selected Google hand-off.
  const wazeUrl = sections[0].firstPoint === 1 ? wazeStartNavigationUrl(sections[0].startPoint) : null;
  const closed = new URL(sections[0].url).searchParams.get("origin") === new URL(sections[sections.length-1].url).searchParams.get("destination");
  const action = <a className="google-maps-button" href={navigation ? section.navigationUrl : section.url} target="_blank" rel="noopener noreferrer">
    {navigation ? (nl ? "Navigeren met Google Maps" : "Navigate with Google Maps") : (nl ? "Openen in Google Maps" : "Open in Google Maps")} · {routeLabel ?? "Route"}{sections.length > 1 && ` · ${nl ? "Deel" : "Section"} ${index + 1}`} ↗
  </a>;
  return <div className="google-maps-links">
    <div className="navigation-range-heading"><div><span className="small-label">{nl ? "ÉÉN DOORLOPENDE OEFENRIT" : "ONE CONTINUOUS PRACTICE ROUTE"}</span><strong>{routeLabel ?? (nl ? "Je route" : "Your route")} · {closed ? (nl ? "Volledige ronde" : "Full loop") : (nl ? "Volledige route" : "Full route")}</strong></div><span className="navigation-range-badge">0–100%</span></div>
    <div className="continuous-route-line" aria-hidden="true"><span>●</span><i /><span>➜</span><i /><span>⚑</span></div>
    <div className="navigation-range-scale"><span>0% · Start</span><span>100% · {nl ? "Einde" : "Finish"}</span></div>
    <p>{closed ? (nl ? "Eén ronde: je eindigt bij hetzelfde startpunt. Volg de pijlen op de volledige Mapbox-kaart." : "One round: finish at the same starting point. Follow the direction arrows on the full Mapbox map.") : (nl ? "Alle punten horen bij dezelfde route. Volg de volledige Mapbox-kaart." : "All points belong to this one route. Follow the full Mapbox map.")}</p>
    {!navigation && <a className="google-maps-button" href="#practice-controls">{nl ? "Volledige oefenrit instellen" : "Set up the complete practice route"} ↗</a>}
    {wazeUrl && <div className="waze-start-navigation">
      <a className="google-maps-button waze-start-button" href={wazeUrl} target="_blank" rel="noopener noreferrer" aria-label={`${nl ? "Openen in Waze · alleen naar het startpunt" : "Open in Waze · start point only"}${routeLabel ? ` · ${routeLabel}` : ""}`}>
        {nl ? "Openen in Waze" : "Open in Waze"} · {routeLabel ? `${routeLabel} · ` : ""}{nl ? "Naar startpunt" : "To start point"} ↗
      </a>
      <small>{nl ? "Alleen naar het startpunt: Waze berekent zijn eigen aanrijroute, niet de volledige oefenronde. Gebruik daarna Mapbox voor de ronde. Open Waze alleen terwijl je veilig geparkeerd staat; browser-GPS kan buiten de browser pauzeren." : "Start point only: Waze calculates its own approach, not the full practice loop. Use Mapbox for the round afterwards. Open Waze only while safely parked; browser GPS may pause when you leave the browser."}</small>
    </div>}
    {sections.length > 1 ? <details className="google-handoff-details"><summary>{nl ? "Optioneel: openen met Google Maps" : "Optional: open with Google Maps"}</summary>
      <p>{nl ? "Google Maps-links ondersteunen niet alle vormpunten in één mobiele link. Alleen de externe navigatie is opgesplitst; dit zijn geen aparte routes. Er worden geen punten weggelaten." : "Google Maps links cannot carry all shaping points in one mobile link. Only the external navigation is split; these are not separate routes. No points are omitted."}</p>
      <label>{nl ? "Extern navigatiedeel" : "External navigation hand-off"}<select value={index} onChange={event => setSelected(Number(event.target.value))}>
        {sections.map((item, i) => { const part = googleMapsSectionRange(item, sections); return <option key={item.firstPoint} value={i}>{routeLabel && `${routeLabel} · `}{nl ? "Deel" : "Section"} {i+1}/{sections.length} · {part.start}–{part.end}% · {nl ? "punten" : "points"} {item.firstPoint}–{item.lastPoint}</option>; })}
      </select></label><small>{range.start}–{range.end}% · {nl ? "Volg de delen op volgorde; wissel alleen wanneer je veilig geparkeerd staat." : "Open hand-offs in order; change sections only while safely parked."}</small>{action}
      <small>{nl ? "Dit is puntvolgorde, geen GPS-voortgang." : "Percentages describe waypoint coverage, not GPS progress."}</small>
      {routeLabel && <p>{nl ? `Dit zijn uitsluitend delen van ${routeLabel}, geen andere routes. Je keuze ontgrendelt geen betaalde routes.` : `These are parts of ${routeLabel} only, not other routes. Selecting a hand-off does not unlock paid routes.`}</p>}
    </details> : action}
    <small>{nl ? "Google Maps kan andere wegen kiezen. De volledige gecontroleerde route blijft op de Mapbox-kaart staan. GPS kan pauzeren buiten de browser." : "Google Maps may choose different roads. The full checked route stays on the Mapbox map. GPS tracking may pause when you leave the browser."}</small>
  </div>;
}
