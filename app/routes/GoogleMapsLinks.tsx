"use client";

import { useState } from "react";
import { googleMapsSectionRange, wazeStartNavigationUrl, type GoogleMapsSection } from "../../lib/route-utils";
import { useCurrentLocale } from "../../lib/useLocale";

export default function GoogleMapsLinks({ sections, routeLabel }: { sections: GoogleMapsSection[]; routeLabel?: string }) {
  const nl = useCurrentLocale() === "nl";
  const [selected, setSelected] = useState(0);
  const first = sections[0];
  const index = Math.min(selected, sections.length - 1);
  const section = sections[index];
  if (!first || !section) return null;

  const multiple = sections.length > 1;
  const range = googleMapsSectionRange(section, sections);
  const wazeUrl = first.firstPoint === 1 ? wazeStartNavigationUrl(first.startPoint) : null;
  const closed = new URL(first.url).searchParams.get("origin") === new URL(sections[sections.length - 1].url).searchParams.get("destination");
  const googleLabel = index === 0
    ? (nl ? "Start oefenroute in Google Maps" : "Start route in Google Maps")
    : (nl ? "Verder in Google Maps" : "Continue in Google Maps");

  return <section className="google-maps-links route-navigation" aria-label={nl ? "Routenavigatie" : "Route navigation"}>
    <div className="navigation-range-heading">
      <div>
        <span className="small-label">{nl ? "ROUTENAVIGATIE" : "ROUTE NAVIGATION"}</span>
        <strong>{routeLabel ?? (nl ? "Je route" : "Your route")} · {closed ? (nl ? "Volledige ronde" : "Full loop") : (nl ? "Volledige route" : "Full route")}</strong>
      </div>
    </div>
    <div className="route-navigation-actions">
      <a className="google-maps-button" href={section.navigationUrl} referrerPolicy="no-referrer">
        {googleLabel}{multiple && ` · ${nl ? "Deel" : "Part"} ${index + 1}/${sections.length}`} ↗
      </a>
      {wazeUrl && <a className="google-maps-button waze-start-button" href={wazeUrl} referrerPolicy="no-referrer">
        {nl ? "Naar startpunt met Waze" : "Navigate to start in Waze"} ↗
      </a>}
    </div>
    {wazeUrl && <p>{nl
      ? "Open Google Maps vanaf het startpunt van je oefenrit. Waze krijgt het startpunt automatisch als bestemming."
      : "Open Google Maps from the practice route's start point. Waze loads that start point as its destination."}</p>}
    {multiple && <details className="google-handoff-details">
      <summary>{nl ? "Kies een volgend routedeel" : "Choose another route part"}</summary>
      <label>{nl ? "Google Maps-routedeel" : "Google Maps route part"}
        <select value={index} onChange={event => setSelected(Number(event.target.value))}>
          {sections.map((item, i) => {
            const part = googleMapsSectionRange(item, sections);
            return <option key={item.firstPoint} value={i}>
              {routeLabel && `${routeLabel} · `}{nl ? "Deel" : "Section"} {i + 1}/{sections.length} · {part.start}–{part.end}% · {nl ? "punten" : "points"} {item.firstPoint}–{item.lastPoint}
            </option>;
          })}
        </select>
      </label>
      <small>{range.start}–{range.end}% · {nl
        ? "Google Maps opent de oefenroute in delen. Wissel in volgorde wanneer je veilig geparkeerd staat."
        : "Google Maps opens the practice route in parts. Switch in order while safely parked."}</small>
    </details>}
    <small>{nl
      ? "Google Maps berekent zelf de wegen tussen de routepunten. Op de kaart hieronder zie je de volledige oefenroute."
      : "Google Maps calculates the roads between the route points. See the full practice route on the map below."}</small>
  </section>;
}
