"use client";

import type { routeNavigationLinks } from "../../lib/route-utils";
import { useCurrentLocale } from "../../lib/useLocale";

type Props = { links: ReturnType<typeof routeNavigationLinks>; routeLabel?: string };

export default function GoogleMapsLinks({ links, routeLabel }: Props) {
  const nl = useCurrentLocale() === "nl";
  if (!links) return null;

  return <section className="google-maps-links route-navigation" aria-label={nl ? "Routenavigatie" : "Route navigation"}>
    <div className="route-navigation-heading">
      <div>
        <span className="small-label">{nl ? "ROUTENAVIGATIE" : "ROUTE NAVIGATION"}</span>
        <strong>{routeLabel ?? (nl ? "Je oefenroute" : "Your practice route")}</strong>
      </div>
    </div>
    <div className="route-navigation-actions">
      <a className="google-maps-button" href={links.googleUrl} referrerPolicy="no-referrer">
        {nl ? "Routebeschrijving in Google Maps" : "Get directions in Google Maps"} ↗
      </a>
      {links.wazeUrl && <a className="google-maps-button waze-start-button" href={links.wazeUrl} referrerPolicy="no-referrer">
        {nl ? "Naar startpunt met Waze" : "Navigate to start in Waze"} ↗
      </a>}
    </div>
    <small>{nl
      ? "Google Maps berekent zelf de wegen tussen de geselecteerde punten. De volledige oefenroute staat op de Drive Coach-kaart."
      : "Google Maps calculates its own roads between the selected points. See the full practice route on the Drive Coach map."}</small>
  </section>;
}
