"use client";

import { useState } from "react";
import type { GoogleMapsSection } from "../../lib/route-utils";
import { useCurrentLocale } from "../../lib/useLocale";

export default function GoogleMapsLinks({ sections, navigation = false, routeLabel }: { sections: GoogleMapsSection[]; navigation?: boolean; routeLabel?: string }) {
  const nl = useCurrentLocale() === "nl";
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(sections.length - 1, 0));
  const section = sections[index];
  if (!section) return null;
  return <div className="google-maps-links">
    {sections.length > 1 && <>
      <label>{routeLabel && `${routeLabel} · `}{nl ? "Google Maps-traject" : "Google Maps section"}
        <select value={index} onChange={(event) => setSelected(Number(event.target.value))}>
          {sections.map((item, i) => <option key={item.firstPoint} value={i}>{routeLabel && `${routeLabel} · `}{nl ? "Deel" : "Section"} {i + 1}/{sections.length} · {nl ? "punten" : "points"} {item.firstPoint}–{item.lastPoint}</option>)}
        </select>
      </label>
      <p>{nl ? "Alle routepunten blijven behouden. Open elk deel in volgorde; het eindpunt is het startpunt van het volgende deel. Kies alleen een ander deel wanneer je veilig geparkeerd staat." : "Every route point is included. Open sections in order; each finish is the next start. Change sections only while safely parked."}</p>
    </>}
    {routeLabel && <p>{nl ? `Dit zijn uitsluitend delen van ${routeLabel}, geen andere routes. Je keuze verandert de volledige ${routeLabel}-kaart niet en ontgrendelt geen betaalde routes.` : `These are parts of ${routeLabel} only, not other routes. Selecting a part does not change the full ${routeLabel} map or unlock paid routes.`}</p>}
    <a className="google-maps-button" href={navigation ? section.navigationUrl : section.url} target="_blank" rel="noopener noreferrer">
      {navigation ? (nl ? "Navigeren met Google Maps" : "Navigate with Google Maps") : (nl ? "Openen in Google Maps" : "Open in Google Maps")} {routeLabel && `· ${routeLabel} `}{sections.length > 1 && <span>· {nl ? "Deel" : "Section"} {index + 1}</span>} ↗
    </a>
    <small>{nl ? "Google Maps kan andere wegen kiezen. De volledige gecontroleerde route blijft op de Mapbox-kaart staan. GPS-tracking kan pauzeren wanneer je de browser verlaat." : "Google Maps may choose different roads. The full checked route stays on the Mapbox map. GPS tracking may pause when you leave the browser."}</small>
  </div>;
}
